import { getGoogleConfig } from "@/lib/radiant/env";
import { createLogger, logRouteError } from "@/lib/radiant/logger";
import { pollVeoOperation } from "@/lib/radiant/vertex";

const log = createLogger("api:vertex-veo-stream");

// Veo bytes can be a few MB; allow time to fetch + stream them out.
export const maxDuration = 60;

/**
 * Streams a finished Veo video as binary mp4. We re-fetch the operation result
 * (Veo returns the video as base64) and emit it as a chunked ReadableStream so
 * the response is never buffered against the serverless response-size limit —
 * which is what broke inline base64 delivery on the deployed runtime.
 */
export async function GET(request: Request) {
  const started = Date.now();
  try {
    const operationName = new URL(request.url).searchParams.get("op");
    if (!operationName) {
      return new Response("Missing op parameter", { status: 400 });
    }

    const config = getGoogleConfig();
    const model = config.veoModelId;
    if (!model) {
      return new Response("Veo model not configured", { status: 503 });
    }

    const result = await pollVeoOperation({
      projectId: config.projectId,
      location: config.location,
      model,
      credentialsJson: config.credentialsJson,
      operationName,
    });

    if (!result.done) {
      return new Response("Video not ready", { status: 409 });
    }
    if (result.error) {
      return new Response(result.error, { status: 502 });
    }

    const base64 = result.videoDataUrl?.split(",")[1];
    if (!base64) {
      return new Response("No playable video in operation result", { status: 404 });
    }

    const bytes = Buffer.from(base64, "base64");
    const CHUNK = 256 * 1024;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += CHUNK) {
          controller.enqueue(bytes.subarray(offset, offset + CHUNK));
        }
        controller.close();
      },
    });

    log.info("veo stream ok", { bytes: bytes.length, ms: Date.now() - started });

    return new Response(stream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    logRouteError("api:vertex-veo-stream", error, { ms: Date.now() - started });
    return new Response("Video stream failed", { status: 500 });
  }
}
