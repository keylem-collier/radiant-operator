import { getAssemblyAIConfig } from "@/lib/radiant/env";
import { createLogger } from "@/lib/radiant/logger";

const log = createLogger("assemblyai");

const PAID_MEDIA_KEYTERMS = [
  "Maya",
  "Meta",
  "TikTok",
  "Google Ads",
  "Google Search",
  "intake",
  "paid media",
  "Veo",
  "creative queue",
];

export async function mintStreamingToken(): Promise<string> {
  const { apiKey, streamingBaseUrl } = getAssemblyAIConfig();
  const url = new URL(`${streamingBaseUrl}/v3/token`);
  url.searchParams.set("expires_in_seconds", "120");
  url.searchParams.set("max_session_duration_seconds", "600");

  const response = await fetch(url.toString(), {
    headers: { authorization: apiKey },
  });

  if (!response.ok) {
    const detail = await response.text();
    log.error("streaming token mint failed", {
      status: response.status,
      detail: detail.slice(0, 300),
    });
    throw new Error("Failed to mint AssemblyAI streaming token");
  }

  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error("AssemblyAI token response missing token");
  }

  return data.token;
}

export { PAID_MEDIA_KEYTERMS };
