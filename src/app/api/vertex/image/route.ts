import { getGoogleConfig } from "@/lib/radiant/env";
import { createLogger, logRouteError } from "@/lib/radiant/logger";
import { generateGeminiImage } from "@/lib/radiant/vertex";
import type { CreativeJob } from "@/lib/radiant/types";

const log = createLogger("api:vertex-image");

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = (await request.json()) as { job?: CreativeJob };
    const job = body.job;

    log.info("POST /api/vertex/image", { jobId: job?.id, format: job?.format });

    if (!job?.prompt) {
      return Response.json({ error: "Missing job prompt" }, { status: 400 });
    }

    const config = getGoogleConfig();
    if (!config.imageModel) {
      return Response.json({ error: "Image model not configured" }, { status: 503 });
    }

    const imageDataUrl = await generateGeminiImage({
      projectId: config.projectId,
      location: config.location,
      model: config.imageModel,
      credentialsJson: config.credentialsJson,
      prompt: job.prompt,
    });

    log.info("POST /api/vertex/image ok", { ms: Date.now() - started });

    return Response.json({ imageDataUrl });
  } catch (error) {
    logRouteError("api:vertex-image", error, { ms: Date.now() - started });
    const message = error instanceof Error ? error.message : "Image generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
