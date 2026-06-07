export type VoiceLevels = {
  level: number;
  bands: [number, number, number];
};

export type VoiceLevelSmoothState = {
  level: number;
  bands: [number, number, number];
};

function averageBand(data: ArrayLike<number>, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i += 1) {
    sum += data[i] ?? 0;
  }
  return sum / Math.max(1, end - start) / 255;
}

function smooth(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

export function createVoiceLevelSmoothState(): VoiceLevelSmoothState {
  return { level: 0, bands: [0, 0, 0] };
}

export function resetVoiceLevelSmoothState(state: VoiceLevelSmoothState): void {
  state.level = 0;
  state.bands = [0, 0, 0];
}

export function readVoiceLevels(
  data: ArrayLike<number>,
  state: VoiceLevelSmoothState,
): VoiceLevels {
  const low = Math.min(1, averageBand(data, 2, 14) * 2.8);
  const mid = Math.min(1, averageBand(data, 14, 36) * 2.4);
  const high = Math.min(1, averageBand(data, 36, 64) * 2.1);
  const level = Math.min(1, low * 0.45 + mid * 0.4 + high * 0.15);

  state.level = smooth(state.level, level, 0.38);
  state.bands = [
    smooth(state.bands[0], low, 0.42),
    smooth(state.bands[1], mid, 0.4),
    smooth(state.bands[2], high, 0.36),
  ];

  return {
    level: state.level,
    bands: [...state.bands],
  };
}

type SpeechPlaybackListener = (levels: VoiceLevels | null) => void;

const speechPlaybackListeners = new Set<SpeechPlaybackListener>();

export function subscribeSpeechPlaybackLevels(
  listener: SpeechPlaybackListener,
): () => void {
  speechPlaybackListeners.add(listener);
  return () => speechPlaybackListeners.delete(listener);
}

export function publishSpeechPlaybackLevels(levels: VoiceLevels | null): void {
  for (const listener of speechPlaybackListeners) {
    listener(levels);
  }
}

type MicInputListener = (levels: VoiceLevels | null) => void;

const micInputListeners = new Set<MicInputListener>();

export function subscribeMicInputLevels(listener: MicInputListener): () => void {
  micInputListeners.add(listener);
  return () => micInputListeners.delete(listener);
}

export function publishMicInputLevels(levels: VoiceLevels | null): void {
  for (const listener of micInputListeners) {
    listener(levels);
  }
}
