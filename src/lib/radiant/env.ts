/** Public model IDs — safe to hardcode for the hackathon demo stack. */
export const RADIANT_MODELS = {
  geminiDirector: "gemini-2.5-flash-lite",
  geminiTweaker: "gemini-2.5-flash-lite",
  geminiImage: "gemini-2.5-flash-image",
  veo: "veo-3.1-lite-generate-001",
  elevenLabs: "eleven_flash_v2_5",
  moss: "moss-minilm",
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function getElevenLabsConfig() {
  return {
    apiKey: requireEnv("ELEVENLABS_API_KEY"),
    voiceId: requireEnv("ELEVENLABS_VOICE_ID"),
    modelId: RADIANT_MODELS.elevenLabs,
  };
}

export function getGoogleConfig() {
  return {
    projectId: requireEnv("GOOGLE_CLOUD_PROJECT_ID"),
    location: optionalEnv("GOOGLE_CLOUD_LOCATION") ?? "us-central1",
    credentialsJson: requireEnv("GOOGLE_CREDENTIALS_JSON"),
    directorModel: RADIANT_MODELS.geminiDirector,
    tweakerModel: RADIANT_MODELS.geminiTweaker,
    imageModel: RADIANT_MODELS.geminiImage,
    veoModelId: RADIANT_MODELS.veo,
  };
}

export function getLiveKitConfig() {
  return {
    url: requireEnv("LIVEKIT_URL"),
    apiKey: requireEnv("LIVEKIT_API_KEY"),
    apiSecret: requireEnv("LIVEKIT_API_SECRET"),
  };
}

export function getMossConfig() {
  return {
    projectId: requireEnv("MOSS_PROJECT_ID"),
    projectKey: requireEnv("MOSS_PROJECT_KEY"),
    indexName: requireEnv("MOSS_INDEX_NAME"),
    memoryIndexName: optionalEnv("MOSS_MEMORY_INDEX_NAME"),
    modelId: RADIANT_MODELS.moss,
  };
}

export function hasMossConfig(): boolean {
  return Boolean(
    process.env.MOSS_PROJECT_ID &&
      process.env.MOSS_PROJECT_KEY &&
      process.env.MOSS_INDEX_NAME,
  );
}

export function hasLiveKitConfig(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET,
  );
}

export function getAssemblyAIConfig() {
  const region = optionalEnv("ASSEMBLYAI_REGION") ?? "us";
  const isEu = region.toLowerCase() === "eu";

  return {
    apiKey: requireEnv("ASSEMBLYAI_API_KEY"),
    streamingBaseUrl: isEu
      ? "https://streaming.eu.assemblyai.com"
      : "https://streaming.assemblyai.com",
    streamingWsHost: isEu
      ? "streaming.eu.assemblyai.com"
      : "streaming.assemblyai.com",
  };
}

export function hasAssemblyAIConfig(): boolean {
  return Boolean(process.env.ASSEMBLYAI_API_KEY);
}
