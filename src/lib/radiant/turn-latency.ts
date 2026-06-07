export type TurnLatencyMark =
  | "stt_final"
  | "message_sent"
  | "llm_received"
  | "tts_blob_ready"
  | "audio_play_start"
  | "audio_play_end";

export type TurnLatencySnapshot = {
  turnId: string;
  sttFinalAt: number;
  micStartedAt?: number;
  marks: Partial<Record<TurnLatencyMark, number>>;
};

function msBetween(start?: number, end?: number): number | null {
  if (!start || !end) return null;
  return end - start;
}

export function createTurnLatency(turnId: string, sttFinalAt: number, micStartedAt?: number) {
  const marks: TurnLatencySnapshot["marks"] = {
    stt_final: sttFinalAt,
  };

  return {
    mark(name: TurnLatencyMark, at = Date.now()) {
      marks[name] = at;
    },
    snapshot(): TurnLatencySnapshot {
      return { turnId, sttFinalAt, micStartedAt, marks: { ...marks } };
    },
    logSummary(log: { info: (message: string, data?: Record<string, unknown>) => void }) {
      const sent = marks.message_sent;
      const llm = marks.llm_received;
      const blob = marks.tts_blob_ready;
      const play = marks.audio_play_start;
      const end = marks.audio_play_end;

      log.info("turn loop timing", {
        turnId,
        sttCaptureMs: msBetween(micStartedAt, sttFinalAt),
        sendToLlmMs: msBetween(sent, llm),
        llmToTtsBlobMs: msBetween(llm, blob),
        ttsBlobToPlayMs: msBetween(blob, play),
        sttFinalToPlayMs: msBetween(sttFinalAt, play),
        sttFinalToLlmMs: msBetween(sttFinalAt, llm),
        playDurationMs: msBetween(play, end),
        totalToPlayMs: msBetween(sttFinalAt, play),
        totalToEndMs: msBetween(sttFinalAt, end),
      });
    },
  };
}

export type SendMessageMeta = {
  sttFinalAt: number;
  micStartedAt?: number;
};
