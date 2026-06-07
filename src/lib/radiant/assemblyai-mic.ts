"use client";

import { createClientLogger } from "@/lib/radiant/client-logger";
import {
  createVoiceLevelSmoothState,
  publishMicInputLevels,
  readVoiceLevels,
  resetVoiceLevelSmoothState,
} from "@/lib/radiant/voice-levels";

const log = createClientLogger("stt");

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 1600; // 100ms at 16kHz
const SILENCE_FORCE_MS = 1800;

export type AssemblyAIMicCallbacks = {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
};

type StreamingMessage = {
  type: string;
  transcript?: string;
  end_of_turn?: boolean;
};

function downsample(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    output[i] = input[Math.min(input.length - 1, Math.floor(i * ratio))] ?? 0;
  }
  return output;
}

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

export function isMicCaptureSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof AudioContext !== "undefined"
  );
}

export type AssemblyAIMicOptions = {
  /**
   * Hold-to-talk mode: never finalize on silence/endpoint. The turn only ends
   * when the caller releases the button (calls the returned stop fn). Speech is
   * accumulated across pauses so a mid-sentence breath never cuts the user off.
   */
  holdToTalk?: boolean;
};

export async function startAssemblyAIMic(
  callbacks: AssemblyAIMicCallbacks,
  options: AssemblyAIMicOptions = {},
): Promise<() => void> {
  const holdToTalk = options.holdToTalk ?? false;
  let stopped = false;
  let ws: WebSocket | null = null;
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let pendingSamples = new Float32Array(0);
  let finalSent = false;
  let lastPartialText = "";
  // Finalized segments accumulated within a single hold (AssemblyAI resets the
  // transcript on each end_of_turn, so we stitch them back together).
  let committedText = "";
  let lastPartialAt = 0;
  let silenceTimer: ReturnType<typeof setInterval> | null = null;
  let forceEndpointSent = false;
  let meterRaf = 0;
  const meterSmoothState = createVoiceLevelSmoothState();

  const composeText = () =>
    [committedText, lastPartialText]
      .map((t) => t.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

  const stopMeter = () => {
    cancelAnimationFrame(meterRaf);
    meterRaf = 0;
    resetVoiceLevelSmoothState(meterSmoothState);
    publishMicInputLevels(null);
  };

  const clearSilenceTimer = () => {
    if (silenceTimer) {
      clearInterval(silenceTimer);
      silenceTimer = null;
    }
  };

  const finalizeTurn = (text: string) => {
    if (finalSent || stopped) return;
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned.length < 3) return;

    finalSent = true;
    stopped = true;
    clearSilenceTimer();
    stopMeter();
    callbacks.onFinal(cleaned);

    processor?.disconnect();
    processor = null;
    if (audioContext) {
      void audioContext.close();
      audioContext = null;
    }
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "Terminate" }));
      } catch {
        // ignore
      }
      ws.close();
    }
    ws = null;
  };

  const cleanup = (options?: { finalizePartial?: boolean }) => {
    if (stopped && finalSent) return;

    const finalText = holdToTalk
      ? composeText()
      : lastPartialText.replace(/\s+/g, " ").trim();
    if (options?.finalizePartial && !finalSent && finalText.length >= 3) {
      finalizeTurn(finalText);
      callbacks.onEnd?.();
      return;
    }

    stopped = true;
    clearSilenceTimer();
    stopMeter();
    processor?.disconnect();
    processor = null;
    if (audioContext) {
      void audioContext.close();
      audioContext = null;
    }
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "Terminate" }));
      } catch {
        // ignore
      }
      ws.close();
    }
    ws = null;
    if (!finalSent) {
      callbacks.onEnd?.();
    }
  };

  const startSilenceWatch = () => {
    clearSilenceTimer();
    silenceTimer = setInterval(() => {
      if (stopped || finalSent || !lastPartialText || !lastPartialAt) return;
      const silentFor = Date.now() - lastPartialAt;
      if (silentFor < SILENCE_FORCE_MS) return;

      if (!forceEndpointSent && ws?.readyState === WebSocket.OPEN) {
        forceEndpointSent = true;
        log.info("ForceEndpoint after client silence");
        try {
          ws.send(JSON.stringify({ type: "ForceEndpoint" }));
        } catch {
          // ignore
        }
        return;
      }

      if (silentFor >= SILENCE_FORCE_MS + 900) {
        log.info("client fallback finalize after ForceEndpoint");
        finalizeTurn(lastPartialText);
      }
    }, 350);
  };

  const startAudioPipeline = () => {
    if (!stream || !ws) return;

    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("AudioContext not supported");
    }

    audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const tickMeter = () => {
      if (stopped) return;
      analyser.getByteFrequencyData(freqData as Uint8Array<ArrayBuffer>);
      publishMicInputLevels(readVoiceLevels(freqData, meterSmoothState));
      meterRaf = requestAnimationFrame(tickMeter);
    };
    tickMeter();

    processor = audioContext.createScriptProcessor(4096, 1, 1);
    source.connect(processor);

    processor.onaudioprocess = (event) => {
      if (stopped || !ws || ws.readyState !== WebSocket.OPEN) return;

      const channel = event.inputBuffer.getChannelData(0);
      const downsampled = downsample(channel, audioContext!.sampleRate, TARGET_SAMPLE_RATE);
      const merged = new Float32Array(pendingSamples.length + downsampled.length);
      merged.set(pendingSamples, 0);
      merged.set(downsampled, pendingSamples.length);
      pendingSamples = merged;

      while (pendingSamples.length >= CHUNK_SAMPLES) {
        const chunk = pendingSamples.slice(0, CHUNK_SAMPLES);
        pendingSamples = pendingSamples.slice(CHUNK_SAMPLES);
        ws.send(floatTo16BitPCM(chunk));
      }
    };

    source.connect(processor);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);

    log.info("AssemblyAI mic streaming started");
  };

  try {
    const tokenResponse = await fetch("/api/voice/stt/token");
    if (!tokenResponse.ok) {
      throw new Error("Could not start speech recognition");
    }
    const { token } = (await tokenResponse.json()) as { token?: string };
    if (!token) {
      throw new Error("Missing AssemblyAI streaming token");
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const wsUrl = new URL("wss://streaming.assemblyai.com/v3/ws");
    wsUrl.searchParams.set("sample_rate", String(TARGET_SAMPLE_RATE));
    wsUrl.searchParams.set("speech_model", "u3-rt-pro");
    wsUrl.searchParams.set("token", token);

    ws = new WebSocket(wsUrl.toString());
    ws.binaryType = "arraybuffer";

    await new Promise<void>((resolve, reject) => {
      if (!ws) return reject(new Error("WebSocket missing"));

      const timeout = window.setTimeout(() => {
        reject(new Error("Speech connection timed out"));
      }, 12000);

      ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;

        try {
          const message = JSON.parse(event.data) as StreamingMessage;

          if (message.type === "Begin") {
            window.clearTimeout(timeout);
            ws?.send(
              JSON.stringify({
                type: "UpdateConfiguration",
                min_turn_silence: 500,
                max_turn_silence: 1200,
                keyterms_prompt: [
                  "Maya",
                  "Meta",
                  "TikTok",
                  "Google Search",
                  "intake",
                  "paid media",
                  "Veo",
                ],
              }),
            );
            if (!holdToTalk) startSilenceWatch();
            try {
              startAudioPipeline();
            } catch (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            }
            resolve();
            return;
          }

          if (message.type !== "Turn" || stopped) return;

          const text = message.transcript?.trim() ?? "";
          if (!text) return;

          if (message.end_of_turn) {
            if (holdToTalk) {
              // Don't end the turn — the user is still holding. Commit this
              // segment and keep listening until they release.
              committedText = [committedText, text].filter(Boolean).join(" ");
              lastPartialText = "";
              lastPartialAt = Date.now();
              forceEndpointSent = false;
              callbacks.onPartial?.(composeText());
              return;
            }
            finalizeTurn(text);
            return;
          }

          lastPartialText = text;
          lastPartialAt = Date.now();
          forceEndpointSent = false;
          callbacks.onPartial?.(holdToTalk ? composeText() : text);
        } catch (err) {
          log.warn("streaming message parse failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      };

      ws.onerror = () => {
        window.clearTimeout(timeout);
        if (!stopped) {
          callbacks.onError?.("Speech connection failed. Hold to talk and try again.");
          cleanup();
        }
        reject(new Error("WebSocket failed"));
      };

      ws.onclose = () => {
        window.clearTimeout(timeout);
        if (!stopped && !finalSent) {
          callbacks.onEnd?.();
        }
      };

      ws.onopen = () => {};
    });
  } catch (err) {
    cleanup();
    const message = err instanceof Error ? err.message : "Microphone failed";
    callbacks.onError?.(message);
    throw err;
  }

  return () => cleanup({ finalizePartial: true });
}
