import { getGoogleConfig } from "@/lib/radiant/env";
import { generateAdvisorResponse } from "@/lib/radiant/gemini";
import { createLogger, logRouteError } from "@/lib/radiant/logger";
import { queryMossContext } from "@/lib/radiant/moss";
import type { CreativeJob, TranscriptTurn } from "@/lib/radiant/types";

const log = createLogger("api:advisor");

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = (await request.json()) as {
      turns?: TranscriptTurn[];
      currentUserText?: string;
      mossContext?: string[];
      latestCreativeJobs?: CreativeJob[];
      queuedCreativeJobs?: CreativeJob[];
    };

    const turns = body.turns ?? [];
    const currentUserText = body.currentUserText?.trim();

    log.info("POST /api/advisor/respond", {
      turnCount: turns.length,
      currentUserTextLength: currentUserText?.length ?? 0,
    });

    if (!currentUserText && turns.length === 0) {
      return Response.json({ error: "No conversation input" }, { status: 400 });
    }

    const queryText =
      currentUserText ?? turns.filter((t) => t.speaker === "user").at(-1)?.text ?? "";

    let mossContext = body.mossContext;
    let mossSource: "moss" | "local" | undefined;
    let mossPending = false;

    if (queryText && !mossContext) {
      const mossResult = await log.time("moss query", () => queryMossContext(queryText), {
        queryLength: queryText.length,
      });
      mossContext = mossResult.snippets;
      mossSource = mossResult.source;
      mossPending = mossResult.pending ?? false;
      log.info("moss context", {
        source: mossSource,
        snippetCount: mossContext.length,
        pending: mossPending,
      });
    }

    const config = getGoogleConfig();
    const toJobSummary = (job: CreativeJob) => ({
      title: job.title,
      format: job.format,
      platform: job.platform,
      insight: job.insight,
    });

    const advisorText = await log.time(
      "gemini advisor",
      () =>
        generateAdvisorResponse({
          projectId: config.projectId,
          location: config.location,
          model: config.directorModel,
          credentialsJson: config.credentialsJson,
          turns: turns.map((t) => ({ speaker: t.speaker, text: t.text })),
          currentUserText,
          mossContext,
          latestCreativeJobs: body.latestCreativeJobs?.map(toJobSummary),
          queuedCreativeJobs: body.queuedCreativeJobs?.map(toJobSummary),
        }),
      { model: config.directorModel },
    );

    log.info("POST /api/advisor/respond ok", {
      advisorTextLength: advisorText.length,
      ms: Date.now() - started,
    });

    return Response.json({
      advisorText,
      mossContext: mossContext ?? [],
      mossSource,
      mossPending,
    });
  } catch (error) {
    logRouteError("api:advisor", error, { ms: Date.now() - started });
    const message = error instanceof Error ? error.message : "Advisor failed";
    const status = message.includes("Missing required environment") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
