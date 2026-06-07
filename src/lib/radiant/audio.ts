"use client";

import { createClientLogger, unlockAudioPlayback } from "@/lib/radiant/client-logger";
import {
  createVoiceLevelSmoothState,
  publishSpeechPlaybackLevels,
  readVoiceLevels,
  resetVoiceLevelSmoothState,
} from "@/lib/radiant/voice-levels";

const log = createClientLogger("audio");

let activeSpeechAudio: HTMLAudioElement | null = null;
let activeSpeechCleanup: (() => void) | null = null;
let activeSpeechReject: ((reason: Error) => void) | null = null;

export function stopSpeechPlayback(): void {
  activeSpeechReject?.(new DOMException("Speech stopped", "AbortError"));
  activeSpeechReject = null;
  if (activeSpeechAudio) {
    activeSpeechAudio.pause();
    activeSpeechAudio.currentTime = 0;
  }
  activeSpeechCleanup?.();
  activeSpeechCleanup = null;
  activeSpeechAudio = null;
  publishSpeechPlaybackLevels(null);
}

export type PlaySpeechHooks = {
  onTtsBlobReady?: () => void;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
};

function attachPlaybackMeter(audio: HTMLAudioElement): () => void {
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let freqData: Uint8Array | null = null;
  let rafId = 0;
  let metering = false;
  const smoothState = createVoiceLevelSmoothState();

  const stopMeter = () => {
    metering = false;
    cancelAnimationFrame(rafId);
    resetVoiceLevelSmoothState(smoothState);
    publishSpeechPlaybackLevels(null);
    void context?.close();
    context = null;
    analyser = null;
    freqData = null;
  };

  const tick = () => {
    if (!metering || !analyser || !freqData) return;

    analyser.getByteFrequencyData(freqData as Uint8Array<ArrayBuffer>);
    publishSpeechPlaybackLevels(readVoiceLevels(freqData, smoothState));
    rafId = requestAnimationFrame(tick);
  };

  const startMeter = async () => {
    if (metering) return;

    try {
      const ctx = new AudioContext();
      context = ctx;

      // CRITICAL: only reroute the element's output into the Web Audio graph
      // once the context is actually running. createMediaElementSource hijacks
      // the element's audio, so if the context is suspended (e.g. iOS in a
      // record-oriented session after getUserMedia) the audio would be routed
      // into a dead graph and Maya would be silent. If it can't run, bail out
      // and let the element play straight to the speakers (no visual meter).
      await ctx.resume().catch(() => undefined);
      if (ctx !== context || ctx.state !== "running") {
        if (ctx === context) {
          void ctx.close();
          context = null;
        }
        return;
      }

      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;

      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      freqData = new Uint8Array(analyser.frequencyBinCount);
      metering = true;
      tick();
    } catch (err) {
      log.warn("playback meter unavailable", {
        error: err instanceof Error ? err.message : String(err),
      });
      stopMeter();
    }
  };

  audio.addEventListener("playing", startMeter);

  return () => {
    audio.removeEventListener("playing", startMeter);
    stopMeter();
  };
}

export async function playSpeech(
  text: string,
  hooks?: PlaySpeechHooks,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    log.warn("playSpeech skipped — empty text");
    return;
  }

  const loopStarted = Date.now();

  await log.time("playSpeech", async () => {
    log.info("fetching TTS", { textLength: trimmed.length });

    const ttsFetchStarted = Date.now();
    const response = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });

    log.info("TTS response", {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type"),
      ms: Date.now() - ttsFetchStarted,
    });

    if (!response.ok) {
      let errorMessage = "TTS request failed";
      try {
        const data = (await response.json()) as { error?: string };
        errorMessage = data.error ?? errorMessage;
      } catch {
        errorMessage = (await response.text()) || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "TTS returned JSON instead of audio");
    }

    const blob = await response.blob();
    hooks?.onTtsBlobReady?.();
    log.info("TTS blob received", {
      bytes: blob.size,
      type: blob.type,
      msSinceLoopStart: Date.now() - loopStarted,
    });

    if (blob.size < 128) {
      throw new Error(`TTS audio too small (${blob.size} bytes)`);
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preload = "auto";
    activeSpeechAudio = audio;
    const detachMeter = attachPlaybackMeter(audio);

    unlockAudioPlayback();

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
        detachMeter();
        URL.revokeObjectURL(url);
        if (activeSpeechAudio === audio) {
          activeSpeechAudio = null;
          activeSpeechCleanup = null;
          activeSpeechReject = null;
        }
      };

      activeSpeechCleanup = cleanup;
      activeSpeechReject = (reason) => {
        cleanup();
        reject(reason);
      };

      audio.onended = () => {
        hooks?.onPlayEnd?.();
        log.info("audio playback ended", { msSinceLoopStart: Date.now() - loopStarted });
        cleanup();
        resolve();
      };

      audio.onerror = () => {
        const mediaError = audio.error;
        log.error("audio element error", {
          code: mediaError?.code,
          message: mediaError?.message,
        });
        cleanup();
        reject(new Error(mediaError?.message ?? "Audio playback failed"));
      };

      const startPlayback = async () => {
        try {
          await audio.play();
          hooks?.onPlayStart?.();
          log.info("audio.play() started", { msSinceLoopStart: Date.now() - loopStarted });
        } catch (err) {
          unlockAudioPlayback();
          try {
            await audio.play();
            hooks?.onPlayStart?.();
            log.info("audio.play() retry ok", { msSinceLoopStart: Date.now() - loopStarted });
          } catch (retryErr) {
            cleanup();
            const message =
              retryErr instanceof Error ? retryErr.message : "Audio play rejected";
            log.error("audio.play() rejected", { error: message });
            reject(new Error(message));
          }
        }
      };

      void startPlayback();
    });
  });
}
