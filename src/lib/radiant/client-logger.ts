"use client";

import type { LogLevel, LogPayload } from "@/lib/radiant/logger";

const MAX_BUFFER = 200;

type LogEntry = {
  ts: number;
  level: LogLevel;
  scope: string;
  message: string;
  data?: LogPayload;
};

declare global {
  interface Window {
    __RADIANT_LOGS__?: LogEntry[];
  }
}

function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_RADIANT_DEBUG === "1") return true;
  return new URLSearchParams(window.location.search).has("debug");
}

function pushEntry(entry: LogEntry) {
  if (typeof window === "undefined") return;
  const buffer = window.__RADIANT_LOGS__ ?? [];
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  window.__RADIANT_LOGS__ = buffer;
}

function emit(level: LogLevel, scope: string, message: string, data?: LogPayload) {
  const entry: LogEntry = { ts: Date.now(), level, scope, message, data };
  pushEntry(entry);

  const prefix = `[radiant:${scope}]`;
  const args = data ? [prefix, message, data] : [prefix, message];

  if (level === "error") console.error(...args);
  else if (level === "warn") console.warn(...args);
  else if (level === "debug" && isDebugEnabled()) console.debug(...args);
  else console.info(...args);
}

export function createClientLogger(scope: string) {
  return {
    debug: (message: string, data?: LogPayload) => emit("debug", scope, message, data),
    info: (message: string, data?: LogPayload) => emit("info", scope, message, data),
    warn: (message: string, data?: LogPayload) => emit("warn", scope, message, data),
    error: (message: string, data?: LogPayload) => emit("error", scope, message, data),
    async time<T>(label: string, fn: () => Promise<T>, data?: LogPayload): Promise<T> {
      emit("info", scope, `${label} start`, data);
      const start = Date.now();
      try {
        const result = await fn();
        emit("info", scope, `${label} ok`, { ...data, ms: Date.now() - start });
        return result;
      } catch (error) {
        emit("error", scope, `${label} failed`, {
          ...data,
          ms: Date.now() - start,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}

let unlockedAudioContext: AudioContext | null = null;
let unlockedAudioElement: HTMLAudioElement | null = null;

function getUnlockedAudioContext(log: ReturnType<typeof createClientLogger>): AudioContext | null {
  if (typeof window === "undefined") return null;

  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!unlockedAudioContext || unlockedAudioContext.state === "closed") {
      unlockedAudioContext = new AudioCtx();
    }

    void unlockedAudioContext.resume().then(() => {
      log.info("AudioContext resumed", { state: unlockedAudioContext?.state });
    });

    return unlockedAudioContext;
  } catch (error) {
    log.warn("AudioContext unlock failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Call on user gesture (click/tap) so Safari allows later async audio.play(). */
export function unlockAudioPlayback(): void {
  if (typeof window === "undefined") return;

  const log = createClientLogger("audio-unlock");
  getUnlockedAudioContext(log);

  try {
    if (!unlockedAudioElement) {
      unlockedAudioElement = new Audio(
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA",
      );
      unlockedAudioElement.preload = "auto";
      unlockedAudioElement.volume = 0.001;
    }

    void unlockedAudioElement.play().then(
      () => log.info("silent audio unlock ok"),
      (err) =>
        log.warn("silent audio unlock rejected", {
          error: err instanceof Error ? err.message : String(err),
        }),
    );
  } catch (error) {
    log.warn("silent audio unlock failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
