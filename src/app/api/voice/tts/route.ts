import { synthesizeSpeech } from "@/lib/radiant/elevenlabs";
import { createLogger, logRouteError } from "@/lib/radiant/logger";

const log = createLogger("api:tts");

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim();

    log.info("POST /api/voice/tts", { textLength: text?.length ?? 0 });

    if (!text) {
      log.warn("missing text");
      return Response.json({ error: "Missing text" }, { status: 400 });
    }

    const audio = await synthesizeSpeech(text);

    log.info("POST /api/voice/tts ok", { bytes: audio.byteLength, ms: Date.now() - started });

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logRouteError("api:tts", error, { ms: Date.now() - started });
    const message = error instanceof Error ? error.message : "TTS failed";
    const status = message.includes("Missing required environment") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
