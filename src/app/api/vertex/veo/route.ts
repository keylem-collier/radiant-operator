import { getGoogleConfig } from "@/lib/radiant/env";
import { createLogger, logRouteError } from "@/lib/radiant/logger";
import { pollVeoOperation, startVeoOperation } from "@/lib/radiant/vertex";
import type { CreativeJob } from "@/lib/radiant/types";

const log = createLogger("api:vertex-veo");

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = (await request.json()) as {
      job?: CreativeJob;
      operationName?: string;
      action?: "start" | "poll";
    };

    log.info("POST /api/vertex/veo", { action: body.action ?? "start" });

    const config = getGoogleConfig();
    const model = config.veoModelId;
    if (!model) {
      return Response.json({ error: "Veo model not configured" }, { status: 503 });
    }

    if (body.action === "poll" && body.operationName) {
      const result = await pollVeoOperation({
        projectId: config.projectId,
        location: config.location,
        model,
        credentialsJson: config.credentialsJson,
        operationName: body.operationName,
      });
      log.info("veo poll", { done: result.done, ms: Date.now() - started });
      return Response.json(result);
    }

    const job = body.job;
    if (!job?.prompt) {
      return Response.json({ error: "Missing job prompt" }, { status: 400 });
    }

    const operationName = await startVeoOperation({
      projectId: config.projectId,
      location: config.location,
      model,
      credentialsJson: config.credentialsJson,
      prompt: job.prompt,
    });

    log.info("POST /api/vertex/veo started", { ms: Date.now() - started });

    return Response.json({ operationName, status: "started" });
  } catch (error) {
    logRouteError("api:vertex-veo", error, { ms: Date.now() - started });
    const message = error instanceof Error ? error.message : "Veo job failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
