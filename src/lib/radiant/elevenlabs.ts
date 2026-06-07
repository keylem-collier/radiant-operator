import { getElevenLabsConfig } from "@/lib/radiant/env";
import { createLogger } from "@/lib/radiant/logger";

const log = createLogger("elevenlabs");

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const { apiKey, voiceId, modelId } = getElevenLabsConfig();

  log.info("synthesizeSpeech request", {
    voiceId,
    modelId,
    textLength: text.length,
    hasApiKey: Boolean(apiKey),
  });

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
        },
      }),
    },
  );

  log.info("synthesizeSpeech response", {
    status: response.status,
    contentType: response.headers.get("content-type"),
  });

  if (!response.ok) {
    const detail = await response.text();
    log.error("ElevenLabs TTS failed", { status: response.status, detail: detail.slice(0, 300) });
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const buffer = await response.arrayBuffer();
  log.info("synthesizeSpeech ok", { bytes: buffer.byteLength });
  return buffer;
}
