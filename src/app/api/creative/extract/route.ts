import { buildCreativeJobs, turnsForExtraction } from "@/lib/radiant/creative-jobs";
import { getGoogleConfig } from "@/lib/radiant/env";
import { extractCreativeJobs } from "@/lib/radiant/gemini";
import { createLogger, logRouteError } from "@/lib/radiant/logger";
import type { CreativeJob, TranscriptTurn } from "@/lib/radiant/types";

const log = createLogger("api:creative");

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = (await request.json()) as {
      turns?: TranscriptTurn[];
      existingJobTitles?: string[];
      sourceTurnId?: string;
      existingJobs?: CreativeJob[];
      mossContext?: string[];
    };

    const turns = body.turns ?? [];
    log.info("POST /api/creative/extract", {
      turnCount: turns.length,
      existingJobCount: body.existingJobs?.length ?? 0,
    });

    if (turns.length === 0) {
      return Response.json({ jobs: [] });
    }

    const config = getGoogleConfig();
    const recentTurns = turnsForExtraction(turns);

    const extraction = await extractCreativeJobs({
      projectId: config.projectId,
      location: config.location,
      model: config.tweakerModel,
      credentialsJson: config.credentialsJson,
      turns: recentTurns.map((t) => ({ speaker: t.speaker, text: t.text })),
      existingJobTitles: body.existingJobTitles,
      mossContext: body.mossContext,
    });

    const sourceTurnId =
      body.sourceTurnId ?? recentTurns[recentTurns.length - 1]?.id ?? "unknown";

    const jobs = buildCreativeJobs({
      extraction,
      sourceTurnId,
      existingJobs: body.existingJobs ?? [],
    });

    log.info("POST /api/creative/extract ok", {
      newJobCount: jobs.length,
      ms: Date.now() - started,
    });

    return Response.json({ jobs });
  } catch (error) {
    logRouteError("api:creative", error, { ms: Date.now() - started });
    const message = error instanceof Error ? error.message : "Extraction failed";
    const status = message.includes("Missing required environment") ? 503 : 500;
    return Response.json({ error: message, jobs: [] }, { status });
  }
}
