"use client";

import { useEffect, useState } from "react";
import {
  subscribeMicInputLevels,
  type VoiceLevels,
} from "@/lib/radiant/voice-levels";

export type { VoiceLevels };

/** Live mic levels from the active hold-to-talk stream (no second mic capture). */
export function useMicLevel(active: boolean): VoiceLevels | null {
  const [levels, setLevels] = useState<VoiceLevels | null>(null);

  useEffect(() => {
    if (!active) {
      queueMicrotask(() => setLevels(null));
      return;
    }

    return subscribeMicInputLevels(setLevels);
  }, [active]);

  return active ? levels : null;
}
