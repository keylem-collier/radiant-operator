"use client";

import { useEffect, useState } from "react";
import {
  subscribeSpeechPlaybackLevels,
  type VoiceLevels,
} from "@/lib/radiant/voice-levels";

export function useSpeechPlaybackLevel(active: boolean): VoiceLevels | null {
  const [levels, setLevels] = useState<VoiceLevels | null>(null);

  useEffect(() => {
    if (!active) {
      queueMicrotask(() => setLevels(null));
      return;
    }

    return subscribeSpeechPlaybackLevels(setLevels);
  }, [active]);

  return active ? levels : null;
}
