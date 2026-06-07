"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { GlowingOrb } from "@/components/radiant/glowing-orb";
import { TranscriptFeed } from "@/components/radiant/transcript-feed";
import {
  isMicCaptureSupported,
  startAssemblyAIMic,
} from "@/lib/radiant/assemblyai-mic";
import { useMicLevel } from "@/lib/radiant/use-mic-level";
import { useSpeechPlaybackLevel } from "@/lib/radiant/use-speech-playback-level";
import {
  DEFAULT_ORB_ACCENT,
  detectPlatformAccent,
} from "@/lib/radiant/platform-accent";
import { unlockAudioPlayback } from "@/lib/radiant/client-logger";
import type { SendMessageMeta } from "@/lib/radiant/turn-latency";
import type { TranscriptTurn } from "@/lib/radiant/types";

type VoiceAdvisorScreenProps = {
  active?: boolean;
  turns: TranscriptTurn[];
  speaking?: boolean;
  thinking?: boolean;
  onSendMessage?: (text: string, meta?: SendMessageMeta) => void;
  onInterruptAgent?: () => void;
  onUserGesture?: () => void;
  onVoiceError?: (message: string) => void;
  mossContext?: string[];
  mossSource?: "moss" | "local" | null;
  liveKitConnected?: boolean;
};

function subscribeToMicSupport() {
  return () => undefined;
}

function getMicSupportSnapshot() {
  return isMicCaptureSupported();
}

function getServerMicSupportSnapshot() {
  return false;
}

export function VoiceAdvisorScreen({
  active = true,
  turns,
  speaking = false,
  thinking = false,
  onSendMessage,
  onInterruptAgent,
  onUserGesture,
  onVoiceError,
  mossContext = [],
  mossSource = null,
  liveKitConnected = false,
}: VoiceAdvisorScreenProps) {
  const [micListening, setMicListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [frozenTurns, setFrozenTurns] = useState<TranscriptTurn[] | null>(null);
  const [accentColor, setAccentColor] = useState<string>(DEFAULT_ORB_ACCENT);
  const stopMicRef = useRef<(() => void) | null>(null);
  const finalSentRef = useRef(false);
  const micStartedAtRef = useRef<number | null>(null);
  const holdActiveRef = useRef(false);
  const pendingStopRef = useRef(false);
  const startingMicRef = useRef(false);

  const micSupported = useSyncExternalStore(
    subscribeToMicSupport,
    getMicSupportSnapshot,
    getServerMicSupportSnapshot,
  );

  const agentPaused = micListening;
  const showSpeaking = !agentPaused && speaking;
  const showThinking = !agentPaused && thinking;
  const micLevels = useMicLevel(micListening);
  const speechLevels = useSpeechPlaybackLevel(showSpeaking);
  const voiceLevels = micListening ? micLevels : showSpeaking ? speechLevels : null;
  const displayTurns = frozenTurns ?? turns;
  const hasTranscript = displayTurns.length > 0 || Boolean(interimText.trim());

  const showStatus = micListening || showSpeaking || showThinking;

  const memoryViaMoss = mossSource === "moss";
  const [mossPulse, setMossPulse] = useState(false);
  const prevMossRef = useRef<string[] | null>(null);

  useEffect(() => {
    if (mossContext.length === 0 || mossContext === prevMossRef.current) return;
    prevMossRef.current = mossContext;
    setMossPulse(true);
    const timer = window.setTimeout(() => setMossPulse(false), 900);
    return () => window.clearTimeout(timer);
  }, [mossContext]);

  const statusContent = micListening
    ? "Listening…"
    : showSpeaking
      ? "Answering…"
      : showThinking
        ? "Thinking…"
        : null;

  const stopListening = useCallback(() => {
    holdActiveRef.current = false;
    pendingStopRef.current = false;
    stopMicRef.current?.();
    stopMicRef.current = null;
    finalSentRef.current = false;
    setInterimText("");
    setMicListening(false);
    setFrozenTurns(null);
  }, []);

  const startListening = useCallback(async () => {
    if (!micSupported || !active || micListening || startingMicRef.current) return;

    startingMicRef.current = true;
    if (speaking || thinking) {
      onInterruptAgent?.();
    }
    setFrozenTurns(turns);
    setInterimText("");
    setMicListening(true);
    micStartedAtRef.current = Date.now();
    finalSentRef.current = false;

    try {
      const stop = await startAssemblyAIMic({
        onPartial: (text) => {
          setInterimText(text);
        },
        onFinal: (text) => {
          if (finalSentRef.current) return;
          const cleaned = text.replace(/\s+/g, " ").trim();
          finalSentRef.current = true;
          setInterimText("");
          setMicListening(false);
          setFrozenTurns(null);
          holdActiveRef.current = false;
          stopMicRef.current = null;

          if (cleaned.length >= 3) {
            onSendMessage?.(cleaned, {
              sttFinalAt: Date.now(),
              micStartedAt: micStartedAtRef.current ?? undefined,
            });
          }
          micStartedAtRef.current = null;
        },
        onError: (message) => {
          setMicListening(false);
          setInterimText("");
          setFrozenTurns(null);
          holdActiveRef.current = false;
          stopMicRef.current = null;
          if (message.toLowerCase().includes("permission") || message.includes("NotAllowed")) {
            onVoiceError?.(
              "Microphone access blocked. Allow mic in browser settings and try again.",
            );
          } else {
            onVoiceError?.(message);
          }
        },
        onEnd: () => {
          if (finalSentRef.current) return;
          setMicListening(false);
          setInterimText("");
          setFrozenTurns(null);
          holdActiveRef.current = false;
          stopMicRef.current = null;
        },
      }, { holdToTalk: true });

      if (finalSentRef.current) return;

      stopMicRef.current = stop;
      if (pendingStopRef.current || !holdActiveRef.current) {
        pendingStopRef.current = false;
        stop();
      }
    } catch {
      setMicListening(false);
      setFrozenTurns(null);
      holdActiveRef.current = false;
    } finally {
      startingMicRef.current = false;
    }
  }, [
    active,
    micListening,
    micSupported,
    onInterruptAgent,
    onSendMessage,
    onVoiceError,
    speaking,
    thinking,
    turns,
  ]);

  const handleHoldStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      unlockAudioPlayback();
      onUserGesture?.();
      holdActiveRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      void startListening();
    },
    [onUserGesture, startListening],
  );

  const handleHoldEnd = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!holdActiveRef.current && !micListening) return;
      holdActiveRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (stopMicRef.current) {
        pendingStopRef.current = false;
        stopMicRef.current();
      } else {
        pendingStopRef.current = true;
      }
    },
    [micListening],
  );

  useEffect(() => {
    let lastUserText = "";
    for (let i = displayTurns.length - 1; i >= 0; i -= 1) {
      if (displayTurns[i]?.speaker === "user") {
        lastUserText = displayTurns[i]?.text ?? "";
        break;
      }
    }
    const detected = detectPlatformAccent(`${lastUserText} ${interimText}`);
    if (detected) setAccentColor(detected);
  }, [interimText, displayTurns]);

  useEffect(() => {
    if (!active) {
      stopListening();
    }
  }, [active, stopListening]);

  useEffect(() => {
    return () => {
      stopMicRef.current?.();
      stopMicRef.current = null;
    };
  }, []);

  return (
    <div className="radiant-advisor-page relative grid h-full min-h-0 grid-rows-[auto_1fr] overflow-hidden px-5 pt-10 sm:pt-12">
      <header className="motion-rise shrink-0 overflow-hidden pb-4 text-center">
        <h1 className="radiant-maya-title overflow-visible">Maya</h1>
      </header>

      <span
        className={`radiant-status-chip absolute left-5 top-[max(0.85rem,env(safe-area-inset-top,0px))] z-30 inline-flex items-center gap-1.5 rounded-full border border-[#d8dacd] bg-[#fffdf5]/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#66705d] backdrop-blur ${
          mossPulse ? "radiant-moss-pulse" : ""
        }`}
        title={
          memoryViaMoss
            ? "Moss memory retrieval active"
            : "Moss ready — no memory retrieved yet"
        }
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            memoryViaMoss ? "bg-[#2f9e44] radiant-livekit-pulse" : "bg-[#b6b6ad]"
          }`}
        />
        Moss {memoryViaMoss ? "live" : "ready"}
      </span>

      <span
        className="radiant-status-chip absolute right-5 top-[max(0.85rem,env(safe-area-inset-top,0px))] z-30 inline-flex items-center gap-1.5 rounded-full border border-[#d8dacd] bg-[#fffdf5]/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#66705d] backdrop-blur"
        title={liveKitConnected ? "LiveKit room connected" : "LiveKit room offline"}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            liveKitConnected ? "bg-[#2f9e44] radiant-livekit-pulse" : "bg-[#b6b6ad]"
          }`}
        />
        LiveKit {liveKitConnected ? "live" : "off"}
      </span>

      <section className="radiant-advisor-stage relative min-h-0 overflow-hidden">
        <div className="radiant-advisor-core">
          {showStatus && statusContent && (
            <div className="radiant-advisor-status">
              <p className="motion-rise text-4xl font-semibold text-[#171923] sm:text-5xl">
                {statusContent}
              </p>
            </div>
          )}

          <div className="radiant-advisor-orb relative z-[3]">
            <GlowingOrb
              listening={micListening}
              speaking={showSpeaking}
              voiceLevels={voiceLevels}
              accentColor={accentColor}
            />
          </div>

          {hasTranscript && (
            <div className="radiant-advisor-transcript-dock">
              <TranscriptFeed turns={displayTurns} interimUserText={interimText} />
            </div>
          )}
        </div>
      </section>

      <footer className="radiant-advisor-footer pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-5">
        <div className="pointer-events-auto flex w-full max-w-[21rem] flex-col items-center gap-2">
          {micSupported && (
            <button
              type="button"
              onPointerDown={handleHoldStart}
              onPointerUp={handleHoldEnd}
              onPointerCancel={handleHoldEnd}
              onLostPointerCapture={handleHoldEnd}
              className={`radiant-voice-toggle radiant-voice-hold min-w-[12.5rem] touch-none select-none px-8 py-4 text-base font-semibold ${
                micListening ? "is-active" : ""
              }`}
              aria-pressed={micListening}
            >
              {micListening ? "Release to send" : "Hold to talk"}
            </button>
          )}

          {!micSupported && (
            <p className="text-center text-xs text-[#71786a]">
              Voice input needs a browser with microphone support.
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
