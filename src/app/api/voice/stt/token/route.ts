import { NextResponse } from "next/server";
import { mintStreamingToken } from "@/lib/radiant/assemblyai";
import { hasAssemblyAIConfig } from "@/lib/radiant/env";
import { createLogger, logRouteError } from "@/lib/radiant/logger";

const log = createLogger("api:stt-token");

export async function GET() {
  const started = Date.now();
  try {
    if (!hasAssemblyAIConfig()) {
      return NextResponse.json(
        { error: "AssemblyAI is not configured" },
        { status: 503 },
      );
    }

    const token = await mintStreamingToken();
    log.info("GET /api/voice/stt/token ok", { ms: Date.now() - started });
    return NextResponse.json({ token });
  } catch (error) {
    logRouteError("api:stt-token", error, { ms: Date.now() - started });
    const message = error instanceof Error ? error.message : "Token mint failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
