import { getGoogleConfig } from "@/lib/radiant/env";
import { classifyTurnReaction } from "@/lib/radiant/gemini";
import { createLogger, logRouteError } from "@/lib/radiant/logger";
import type { TranscriptTurn, TurnReactionResult } from "@/lib/radiant/types";

const log = createLogger("api:reaction");

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = (await request.json()) as {
      speaker?: "user" | "advisor";
      text?: string;
      turns?: TranscriptTurn[];
    };

    const speaker = body.speaker;
    const text = body.text?.trim() ?? "";
    const turns = body.turns ?? [];

    log.info("POST /api/advisor/reaction", {
      speaker,
      textLength: text.length,
      turnCount: turns.length,
    });

    if (!speaker || (speaker !== "user" && speaker !== "advisor")) {
      return Response.json({ error: "Invalid speaker" }, { status: 400 });
    }

    if (!text) {
      return Response.json({ effect: "none", emojis: "" } satisfies TurnReactionResult);
    }

    const config = getGoogleConfig();
    const reaction = await log.time(
      "gemini reaction",
      () =>
        classifyTurnReaction({
          projectId: config.projectId,
          location: config.location,
          model: config.tweakerModel,
          credentialsJson: config.credentialsJson,
          speaker,
          text,
          turns: turns.map((t) => ({ speaker: t.speaker, text: t.text })),
        }),
      { model: config.tweakerModel },
    );

    log.info("POST /api/advisor/reaction ok", {
      effect: reaction.effect,
      ms: Date.now() - started,
    });

    return Response.json(reaction);
  } catch (error) {
    logRouteError("api:reaction", error, { ms: Date.now() - started });
    const message = error instanceof Error ? error.message : "Reaction failed";
    const status = message.includes("Missing required environment") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
