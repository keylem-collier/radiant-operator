import { queryMossContext } from "@/lib/radiant/moss";
import { createLogger, logRouteError } from "@/lib/radiant/logger";

const log = createLogger("api:moss");

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim();

    log.info("POST /api/moss/query", { queryLength: query?.length ?? 0 });

    if (!query) {
      return Response.json({ error: "Missing query" }, { status: 400 });
    }

    const result = await queryMossContext(query);

    log.info("POST /api/moss/query ok", {
      source: result.source,
      snippetCount: result.snippets.length,
      ms: Date.now() - started,
    });

    return Response.json(result);
  } catch (error) {
    logRouteError("api:moss", error, { ms: Date.now() - started });
    const message = error instanceof Error ? error.message : "Moss query failed";
    return Response.json({ error: message, snippets: [], source: "local" }, { status: 500 });
  }
}
