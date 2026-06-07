import type { CSSProperties } from "react";
import type { VoiceLevels } from "@/lib/radiant/voice-levels";

type GlowingOrbProps = {
  listening?: boolean;
  speaking?: boolean;
  voiceLevels?: VoiceLevels | null;
  accentColor?: string;
};

function waveScale(band: number): number {
  return 0.32 + band * 1.55;
}

export function GlowingOrb({
  listening = false,
  speaking = false,
  voiceLevels = null,
  accentColor,
}: GlowingOrbProps) {
  const active = listening || speaking;
  const status = speaking ? "speaking" : listening ? "listening" : "idle";
  const liveVoice = Boolean(
    voiceLevels && (speaking || (listening && !speaking)),
  );

  const level = voiceLevels?.level ?? 0;
  const [low, mid, high] = voiceLevels?.bands ?? [0, 0, 0];

  const instrumentStyle: CSSProperties = {};
  if (liveVoice) {
    (instrumentStyle as Record<string, string | number>)["--voice-level"] = level;
  }
  if (accentColor) {
    (instrumentStyle as Record<string, string>)["--orb-accent"] = accentColor;
  }

  return (
    <div
      className="voice-instrument relative flex h-52 w-52 items-center justify-center"
      aria-label={status}
      data-state={status}
      data-voice-live={liveVoice ? "true" : undefined}
      style={instrumentStyle}
    >
      <div
        className={`voice-halo absolute inset-4 rounded-full transition-opacity duration-700 ${
          active ? "opacity-90" : "opacity-60"
        }`}
      />
      <div
        className={`voice-orb relative h-40 w-40 rounded-full transition-transform duration-700 ${
          active && !liveVoice ? "scale-105" : "scale-100"
        }`}
        style={
          liveVoice
            ? { transform: `scale(${1 + level * 0.16})` }
            : undefined
        }
      >
        <span
          className="voice-orb-core"
          style={
            liveVoice
              ? {
                  opacity: 0.52 + level * 0.48,
                  transform: `scale(${0.92 + level * 0.14})`,
                }
              : undefined
          }
        />
        <span
          className="voice-orb-wave voice-orb-wave-a"
          style={
            liveVoice
              ? { transform: `translate(-50%, -50%) scaleY(${waveScale(low)})` }
              : undefined
          }
        />
        <span
          className="voice-orb-wave voice-orb-wave-b"
          style={
            liveVoice
              ? { transform: `translate(-50%, -50%) scaleY(${waveScale(mid)})` }
              : undefined
          }
        />
        <span
          className="voice-orb-wave voice-orb-wave-c"
          style={
            liveVoice
              ? { transform: `translate(-50%, -50%) scaleY(${waveScale(high)})` }
              : undefined
          }
        />
      </div>
    </div>
  );
}
