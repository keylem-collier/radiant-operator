import type {
  CreativeExtractionResult,
  CreativeFormat,
  CreativeJob,
  CreativePlatform,
  TranscriptTurn,
} from "@/lib/radiant/types";

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeFormat(raw: string, platform: string): CreativeFormat | null {
  const format = raw.toLowerCase().replace(/\s+/g, "_");
  const platformHint = platform.toLowerCase();

  if (format === "image_ad" || format.includes("image")) return "image_ad";
  if (
    format === "video_prompt" ||
    format.includes("video") ||
    format.includes("tiktok") ||
    format.includes("reel") ||
    format.includes("ugc")
  ) {
    return "video_prompt";
  }
  if (format === "hook" || format === "guardrail" || format === "search_ad") {
    if (platformHint === "meta" || platformHint === "general") return "image_ad";
    if (
      platformHint === "tiktok" ||
      platformHint === "veo" ||
      platformHint.includes("video")
    ) {
      return "video_prompt";
    }
  }

  return null;
}

function normalizePlatform(raw: string, format: CreativeFormat): CreativePlatform {
  const value = raw.toLowerCase().replace(/\s+/g, "_");
  if (value.includes("tiktok")) return "tiktok";
  if (value.includes("veo")) return "veo";
  if (value.includes("meta") || value.includes("facebook") || value.includes("instagram")) {
    return "meta";
  }
  if (value.includes("google")) return "google_search";
  return format === "video_prompt" ? "tiktok" : "meta";
}

export function buildCreativeJobs(input: {
  extraction: CreativeExtractionResult;
  sourceTurnId: string;
  existingJobs: CreativeJob[];
}): CreativeJob[] {
  const existingTitles = new Set(
    input.existingJobs.map((job) => normalizeKey(job.title)),
  );
  const existingInsights = new Set(
    input.existingJobs.map((job) => normalizeKey(job.insight)),
  );

  const newJobs: CreativeJob[] = [];

  for (const job of input.extraction.jobs.slice(0, 5)) {
    const format = normalizeFormat(job.format, job.platform);
    if (!format) continue;

    const titleKey = normalizeKey(job.title);
    const insightKey = normalizeKey(job.insight);

    if (existingTitles.has(titleKey) || existingInsights.has(insightKey)) {
      continue;
    }

    existingTitles.add(titleKey);
    existingInsights.add(insightKey);

    newJobs.push({
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceTurnId: input.sourceTurnId,
      status: "drafted",
      format,
      platform: normalizePlatform(job.platform, format),
      title: job.title,
      insight: job.insight,
      prompt: job.prompt,
      createdAt: Date.now(),
    });
  }

  return newJobs;
}

export function turnsForExtraction(turns: TranscriptTurn[]): TranscriptTurn[] {
  return turns.slice(-12);
}
