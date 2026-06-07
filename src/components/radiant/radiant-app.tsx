"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Balloons, type BalloonsHandle } from "@/components/ui/balloons";
import { CreativeQueueScreen } from "@/components/radiant/creative-queue-screen";
import { MayaSplashIntro } from "@/components/radiant/maya-splash-intro";
import { VoiceAdvisorScreen } from "@/components/radiant/voice-advisor-screen";
import { playSpeech, stopSpeechPlayback } from "@/lib/radiant/audio";
import {
  createClientLogger,
  unlockAudioPlayback,
} from "@/lib/radiant/client-logger";
import {
  connectLiveKitRoom,
  disconnectLiveKitRoom,
} from "@/lib/radiant/livekit";
import {
  createTurnLatency,
  type SendMessageMeta,
} from "@/lib/radiant/turn-latency";
import { filterMediaQueueJobs } from "@/lib/radiant/queue-config";
import { formatUserError } from "@/lib/radiant/user-errors";
import type { Room } from "livekit-client";
import type {
  CreativeJob,
  Speaker,
  TranscriptTurn,
  TurnReactionEffect,
} from "@/lib/radiant/types";

type AppScreen = "advisor" | "queue";

const log = createClientLogger("app");
const latencyLog = createClientLogger("latency");
const REACTION_COOLDOWN_MS = 4000;

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function extractJobs(
  turns: TranscriptTurn[],
  existingJobs: CreativeJob[],
  sourceTurnId: string,
  mossContext: string[],
): Promise<{ jobs: CreativeJob[]; error?: string }> {
  const response = await fetch("/api/creative/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      turns,
      existingJobs,
      existingJobTitles: existingJobs.map((j) => j.title),
      sourceTurnId,
      mossContext: mossContext.length > 0 ? mossContext : undefined,
    }),
  });

  const data = (await response.json()) as { jobs?: CreativeJob[]; error?: string };

  if (!response.ok) {
    const message = data.error ?? "Creative extraction failed";
    log.warn("creative extract failed", { status: response.status, error: message });
    return { jobs: [], error: message };
  }

  return { jobs: data.jobs ?? [] };
}

export function RadiantApp() {
  const [screen, setScreen] = useState<AppScreen>("advisor");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [jobs, setJobs] = useState<CreativeJob[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mossContext, setMossContext] = useState<string[]>([]);
  const [mossSource, setMossSource] = useState<"moss" | "local" | null>(null);
  const [liveKitConnected, setLiveKitConnected] = useState(false);
  const [extractionPending, setExtractionPending] = useState(0);
  const [lastExtractionEmpty, setLastExtractionEmpty] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const jobsRef = useRef<CreativeJob[]>([]);
  const mossContextRef = useRef<string[]>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const queueScrollRef = useRef<HTMLDivElement | null>(null);
  const screenRef = useRef<AppScreen>("advisor");
  const wheelDeltaXRef = useRef(0);
  const wheelCooldownRef = useRef(0);
  const wheelResetRef = useRef<number | null>(null);
  const balloonsRef = useRef<BalloonsHandle>(null);
  const queueBalloonsLaunchedRef = useRef(false);
  const lastReactionAtRef = useRef(0);
  const turnAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    mossContextRef.current = mossContext;
  }, [mossContext]);

  useEffect(() => {
    let cancelled = false;

    void connectLiveKitRoom((state) => {
      if (!cancelled) setLiveKitConnected(state === "connected");
    }).then((room) => {
      if (!cancelled) roomRef.current = room;
    });

    return () => {
      cancelled = true;
      setLiveKitConnected(false);
      void disconnectLiveKitRoom(roomRef.current);
      roomRef.current = null;
    };
  }, []);

  const handleUpdateJob = useCallback((jobId: string, patch: Partial<CreativeJob>) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
    );
  }, []);

  const handleUserGesture = useCallback(() => {
    unlockAudioPlayback();
  }, []);

  const tryLaunchReaction = useCallback(
    (effect: TurnReactionEffect, emojis?: string) => {
      if (effect === "none") return;

      const now = Date.now();
      if (now - lastReactionAtRef.current < REACTION_COOLDOWN_MS) {
        log.info("reaction skipped cooldown", { effect });
        return;
      }

      lastReactionAtRef.current = now;
      balloonsRef.current?.launchReaction(effect, emojis);
      log.info("reaction launched", { effect });
    },
    [],
  );

  const requestTurnReaction = useCallback(
    async (speaker: Speaker, text: string, contextTurns: TranscriptTurn[]) => {
      try {
        const response = await fetch("/api/advisor/reaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            speaker,
            text,
            turns: contextTurns.map((turn) => ({
              speaker: turn.speaker,
              text: turn.text,
            })),
          }),
        });

        if (!response.ok) {
          log.warn("turn reaction request failed", { status: response.status });
          return;
        }

        const data = (await response.json()) as {
          effect?: TurnReactionEffect;
          emojis?: string;
        };

        if (!data.effect || data.effect === "none") return;
        tryLaunchReaction(data.effect, data.emojis);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Reaction failed";
        log.warn("turn reaction failed", { error: message });
      }
    },
    [tryLaunchReaction],
  );

  const processAdvisorTurn = useCallback(
    async (
      turnsWithUser: TranscriptTurn[],
      text: string,
      creativeContext: {
        latestJobs: CreativeJob[];
        queuedJobs: CreativeJob[];
      },
      latency = createTurnLatency(createId("latency"), Date.now()),
    ): Promise<string | null> => {
      log.info("processAdvisorTurn start", { textLength: text.length });

      const llmStarted = Date.now();
      const response = await fetch("/api/advisor/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: turnAbortRef.current?.signal,
        body: JSON.stringify({
          turns: turnsWithUser,
          currentUserText: text,
          latestCreativeJobs: filterMediaQueueJobs(creativeContext.latestJobs).map((job) => ({
            title: job.title,
            format: job.format,
            platform: job.platform,
            insight: job.insight,
          })),
          queuedCreativeJobs: filterMediaQueueJobs(creativeContext.queuedJobs).map((job) => ({
            title: job.title,
            format: job.format,
            platform: job.platform,
            insight: job.insight,
          })),
        }),
      });

      log.info("advisor response", {
        ok: response.ok,
        status: response.status,
        ms: Date.now() - llmStarted,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Advisor request failed");
      }

      const data = (await response.json()) as {
        advisorText: string;
        mossContext?: string[];
        mossSource?: "moss" | "local";
        mossPending?: boolean;
      };

      latency.mark("llm_received");
      log.info("advisor text received", {
        advisorTextLength: data.advisorText.length,
        llmMs: Date.now() - llmStarted,
      });

      const advisorTurn: TranscriptTurn = {
        id: createId("turn"),
        speaker: "advisor",
        text: data.advisorText,
        createdAt: Date.now(),
      };

      const fullTurns = [...turnsWithUser, advisorTurn];

      if (data.mossContext && data.mossContext.length > 0) {
        setMossContext(data.mossContext);
        mossContextRef.current = data.mossContext;
        setMossSource(data.mossSource ?? "local");
      }

      setTurns(fullTurns);
      setSpeaking(true);
      try {
        await playSpeech(data.advisorText, {
          onTtsBlobReady: () => latency.mark("tts_blob_ready"),
          onPlayStart: () => latency.mark("audio_play_start"),
          onPlayEnd: () => latency.mark("audio_play_end"),
        });
        void requestTurnReaction("advisor", data.advisorText, fullTurns);
        latency.logSummary(latencyLog);
        return null;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return null;
        }
        const message = err instanceof Error ? err.message : "Speech failed";
        log.error("advisor TTS failed after text reply", { error: message });
        return formatUserError("Maya replied in text, but voice playback failed.");
      }
      return null;
    },
    [requestTurnReaction],
  );

  const handleInterruptAgent = useCallback(() => {
    stopSpeechPlayback();
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    setSpeaking(false);
    setBusy(false);
  }, []);

  const handleSendMessage = useCallback(
    async (text: string, meta?: SendMessageMeta) => {
      unlockAudioPlayback();
      handleUserGesture();
      setBusy(true);
      setLastExtractionEmpty(false);
      log.info("handleSendMessage", { textLength: text.length });

      const abortController = new AbortController();
      turnAbortRef.current = abortController;

      const sttFinalAt = meta?.sttFinalAt ?? Date.now();
      const userTurn: TranscriptTurn = {
        id: createId("turn"),
        speaker: "user",
        text,
        createdAt: sttFinalAt,
      };

      const latency = createTurnLatency(userTurn.id, sttFinalAt, meta?.micStartedAt);
      latency.mark("message_sent");

      const turnsWithUser = [...turns, userTurn];
      setTurns(turnsWithUser);
      void requestTurnReaction("user", text, turnsWithUser);

      const runBackgroundExtraction = async () => {
        setExtractionPending((count) => count + 1);
        const started = Date.now();
        log.info("creative extract start", { sourceTurnId: userTurn.id });

        try {
          const { jobs: newJobs, error } = await extractJobs(
            turnsWithUser,
            jobsRef.current,
            userTurn.id,
            mossContextRef.current,
          );

          if (error) {
            log.error("creative extract error", { error, ms: Date.now() - started });
          } else if (newJobs.length > 0) {
            setJobs((prev) => {
              const merged = [...prev, ...newJobs];
              jobsRef.current = merged;
              return merged;
            });
            setLastExtractionEmpty(false);
            log.info("creative extract done", {
              newJobCount: newJobs.length,
              ms: Date.now() - started,
            });
          } else {
            setLastExtractionEmpty(true);
            log.info("creative extract empty", { ms: Date.now() - started });
          }
        } finally {
          setExtractionPending((count) => Math.max(0, count - 1));
        }
      };

      // Run extraction in parallel — awaiting it before TTS breaks audio autoplay
      // because the user gesture expires while Gemini extracts creative jobs.
      void runBackgroundExtraction();

      try {
        await processAdvisorTurn(
          turnsWithUser,
          text,
          { latestJobs: [], queuedJobs: jobsRef.current },
          latency,
        );
        log.info("handleSendMessage ok");
      } catch (err) {
        if (abortController.signal.aborted) {
          log.info("handleSendMessage aborted");
          return;
        }
        const message = err instanceof Error ? err.message : "Something went wrong";
        log.error("handleSendMessage failed", { error: message });
      } finally {
        if (turnAbortRef.current === abortController) {
          turnAbortRef.current = null;
        }
        setSpeaking(false);
        setBusy(false);
      }
    },
    [turns, processAdvisorTurn, handleUserGesture, requestTurnReaction],
  );

  useEffect(() => {
    const stage = stageRef.current;
    const device = mainRef.current;
    if (!stage || !device) return;

    const isPointInDevice = (x: number, y: number) => {
      const rect = device.getBoundingClientRect();
      return (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      );
    };

    const isEventInDevice = (event: { target: EventTarget | null; clientX: number; clientY: number }) => {
      if (device.contains(event.target as Node)) return true;
      return isPointInDevice(event.clientX, event.clientY);
    };

    const canQueueScrollForward = () => {
      const queueScroll = queueScrollRef.current;
      if (!queueScroll) return false;
      return (
        queueScroll.scrollTop + queueScroll.clientHeight <
        queueScroll.scrollHeight - 8
      );
    };

    const canQueueScrollBack = () => {
      const queueScroll = queueScrollRef.current;
      return Boolean(queueScroll && queueScroll.scrollTop > 8);
    };

    const touchGesture = {
      active: false,
      startX: 0,
      startY: 0,
      tracking: false,
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || !isEventInDevice(touch)) return;

      touchGesture.active = true;
      touchGesture.tracking = false;
      touchGesture.startX = touch.clientX;
      touchGesture.startY = touch.clientY;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!touchGesture.active) return;

      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchGesture.startX;
      const deltaY = touch.clientY - touchGesture.startY;

      if (!touchGesture.tracking) {
        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
        touchGesture.tracking = true;
      }

      if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.1) return;

      const currentScreen = screenRef.current;

      if (currentScreen === "advisor" && deltaX < 0) {
        event.preventDefault();
        return;
      }

      if (currentScreen === "queue" && deltaX > 0 && !canQueueScrollBack()) {
        event.preventDefault();
        return;
      }

      if (currentScreen === "queue" && deltaX < 0 && !canQueueScrollForward()) {
        event.preventDefault();
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!touchGesture.active) return;

      const touch = event.changedTouches[0];
      touchGesture.active = false;

      if (!touch) return;

      const deltaX = touch.clientX - touchGesture.startX;
      if (Math.abs(deltaX) < 48) return;

      const currentScreen = screenRef.current;

      if (deltaX > 0 && currentScreen === "queue") {
        if (canQueueScrollBack()) return;
        setScreen("advisor");
        return;
      }

      if (deltaX < 0 && currentScreen === "advisor") {
        setScreen("queue");
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (!isEventInDevice(event)) return;

      const horizontal = Math.abs(event.deltaX);
      const vertical = Math.abs(event.deltaY);
      if (horizontal < 12 || horizontal < vertical * 1.15) return;

      const currentScreen = screenRef.current;
      const scrollingBack = event.deltaX < 0;
      const scrollingForward = event.deltaX > 0;

      if (currentScreen === "queue" && scrollingBack) {
        if (canQueueScrollBack()) return;
        event.preventDefault();
        setScreen("advisor");
        wheelDeltaXRef.current = 0;
        wheelCooldownRef.current = Date.now();
        return;
      }

      if (currentScreen === "queue" && scrollingForward && canQueueScrollForward()) {
        return;
      }

      event.preventDefault();

      if (wheelResetRef.current) {
        window.clearTimeout(wheelResetRef.current);
      }

      wheelDeltaXRef.current += event.deltaX;
      wheelResetRef.current = window.setTimeout(() => {
        wheelDeltaXRef.current = 0;
      }, 180);

      const now = Date.now();
      if (now - wheelCooldownRef.current < 520) return;
      if (Math.abs(wheelDeltaXRef.current) < 72) return;

      const nextScreen = wheelDeltaXRef.current > 0 ? "queue" : "advisor";
      setScreen((current) => (current === nextScreen ? current : nextScreen));
      wheelDeltaXRef.current = 0;
      wheelCooldownRef.current = now;
    };

    stage.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    stage.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    stage.addEventListener("touchend", onTouchEnd, { capture: true, passive: true });
    stage.addEventListener("touchcancel", onTouchEnd, { capture: true, passive: true });
    stage.addEventListener("wheel", onWheel, { capture: true, passive: false });

    return () => {
      stage.removeEventListener("touchstart", onTouchStart, { capture: true });
      stage.removeEventListener("touchmove", onTouchMove, { capture: true });
      stage.removeEventListener("touchend", onTouchEnd, { capture: true });
      stage.removeEventListener("touchcancel", onTouchEnd, { capture: true });
      stage.removeEventListener("wheel", onWheel, { capture: true });
      if (wheelResetRef.current) {
        window.clearTimeout(wheelResetRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (screen !== "queue" || queueBalloonsLaunchedRef.current) return;

    queueBalloonsLaunchedRef.current = true;
    const timer = window.setTimeout(() => {
      balloonsRef.current?.launchAnimation();
    }, 380);

    return () => window.clearTimeout(timer);
  }, [screen]);

  return (
    <div
      ref={stageRef}
      className="radiant-stage h-[100dvh] overflow-hidden text-[#171923]"
    >
      <main
        ref={mainRef}
        className="radiant-device relative mx-auto flex h-full w-full max-w-md touch-manipulation flex-col overflow-hidden sm:my-6 sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[2rem]"
      >
        <MayaSplashIntro>
          <Balloons ref={balloonsRef} containerRef={mainRef} />
          <div
            className="motion-screen-track flex h-full min-h-0 flex-1 w-[200%] overflow-hidden"
            style={{ transform: `translateX(${screen === "advisor" ? "0%" : "-50%"})` }}
          >
            <section
              className="flex h-full w-1/2 min-w-0 shrink-0 flex-col overflow-hidden"
              aria-hidden={screen !== "advisor"}
            >
              <VoiceAdvisorScreen
                active={screen === "advisor"}
                turns={turns}
                speaking={speaking}
                thinking={busy && !speaking}
                onSendMessage={handleSendMessage}
                onInterruptAgent={handleInterruptAgent}
                onUserGesture={handleUserGesture}
                mossContext={mossContext}
                mossSource={mossSource}
                liveKitConnected={liveKitConnected}
              />
            </section>
            <section
              className="flex h-full w-1/2 min-w-0 shrink-0 flex-col overflow-hidden"
              aria-hidden={screen !== "queue"}
            >
              <CreativeQueueScreen
                jobs={jobs}
                onUpdateJob={handleUpdateJob}
                scrollRef={queueScrollRef}
                extractionPending={extractionPending}
                hasConversation={turns.length > 0}
                lastExtractionEmpty={lastExtractionEmpty}
                active={screen === "queue"}
              />
            </section>
          </div>

          <div className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2">
            <button
              type="button"
              onClick={() => setScreen("advisor")}
              aria-label="Voice advisor"
              className={`h-1.5 rounded-full transition-all duration-300 ${
                screen === "advisor" ? "w-6 bg-[#171923]" : "w-1.5 bg-[#171923]/22"
              }`}
            />
            <button
              type="button"
              onClick={() => setScreen("queue")}
              aria-label="Creative queue"
              className={`h-1.5 rounded-full transition-all duration-300 ${
                screen === "queue" ? "w-6 bg-[#171923]" : "w-1.5 bg-[#171923]/22"
              }`}
            />
          </div>
        </MayaSplashIntro>
      </main>
    </div>
  );
}
