import { getGoogleAccessToken } from "@/lib/radiant/google-auth";
import { createLogger } from "@/lib/radiant/logger";
import {
  ADVISOR_SYSTEM_PROMPT,
  buildAdvisorUserPrompt,
  buildCreativeExtractionUserPrompt,
  buildReactionUserPrompt,
  CREATIVE_EXTRACTION_SYSTEM_PROMPT,
  REACTION_SYSTEM_PROMPT,
} from "@/lib/radiant/prompts";
import type {
  CreativeExtractionResult,
  TurnReactionEffect,
  TurnReactionResult,
} from "@/lib/radiant/types";

const log = createLogger("gemini");

/**
 * Pulls the first JSON object out of a model response. Handles code fences,
 * leading/trailing prose, and stray text the model sometimes adds around the
 * JSON — so a slightly chatty response still parses instead of yielding nothing.
 */
function parseJsonObject<T>(raw: string): T | null {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const candidates = [stripped];
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    candidates.push(stripped.slice(first, last + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try next candidate
    }
  }
  return null;
}

type GeminiGenerateParams = {
  projectId: string;
  location: string;
  model: string;
  credentialsJson: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
};

async function generateText(params: GeminiGenerateParams): Promise<string> {
  log.info("generateContent request", { model: params.model });

  const token = await getGoogleAccessToken(params.credentialsJson);

  const url = `https://${params.location}-aiplatform.googleapis.com/v1/projects/${params.projectId}/locations/${params.location}/publishers/google/models/${params.model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: params.systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: params.userPrompt }],
        },
      ],
      generationConfig: {
        temperature: params.temperature ?? 1.0,
        maxOutputTokens: params.maxOutputTokens ?? 180,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    log.error("generateContent failed", { status: response.status, detail: detail.slice(0, 300) });
    throw new Error(`Gemini request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    log.error("generateContent empty response");
    throw new Error("Gemini returned empty response");
  }

  log.info("generateContent ok", { textLength: text.length });
  return text;
}

export async function generateAdvisorResponse(input: {
  projectId: string;
  location: string;
  model: string;
  credentialsJson: string;
  turns: Array<{ speaker: string; text: string }>;
  currentUserText?: string;
  mossContext?: string[];
  latestCreativeJobs?: Array<{
    title: string;
    format: string;
    platform: string;
    insight: string;
  }>;
  queuedCreativeJobs?: Array<{
    title: string;
    format: string;
    platform: string;
    insight: string;
  }>;
}): Promise<string> {
  return generateText({
    projectId: input.projectId,
    location: input.location,
    model: input.model,
    credentialsJson: input.credentialsJson,
    maxOutputTokens: 180,
    systemPrompt: ADVISOR_SYSTEM_PROMPT,
    userPrompt: buildAdvisorUserPrompt({
      turns: input.turns,
      currentUserText: input.currentUserText,
      mossContext: input.mossContext,
      latestCreativeJobs: input.latestCreativeJobs,
      queuedCreativeJobs: input.queuedCreativeJobs,
    }),
  });
}

export async function extractCreativeJobs(input: {
  projectId: string;
  location: string;
  model: string;
  credentialsJson: string;
  turns: Array<{ speaker: string; text: string }>;
  existingJobTitles?: string[];
  mossContext?: string[];
}): Promise<CreativeExtractionResult> {
  const raw = await generateText({
    projectId: input.projectId,
    location: input.location,
    model: input.model,
    credentialsJson: input.credentialsJson,
    maxOutputTokens: 30024,
    systemPrompt: CREATIVE_EXTRACTION_SYSTEM_PROMPT,
    userPrompt: buildCreativeExtractionUserPrompt({
      turns: input.turns,
      existingJobTitles: input.existingJobTitles,
      mossContext: input.mossContext,
    }),
  });

  const parsed = parseJsonObject<CreativeExtractionResult>(raw);
  if (!parsed || !Array.isArray(parsed.jobs)) {
    log.warn("creative extract JSON parse failed", {
      rawLength: raw.length,
      rawPreview: raw.slice(0, 200),
    });
    return { jobs: [] };
  }
  log.info("creative extract parsed", { jobCount: parsed.jobs.length });
  return parsed;
}

const REACTION_EFFECTS = new Set<TurnReactionEffect>([
  "hearts",
  "laugh",
  "money",
  "balloons",
  "none",
]);

const REACTION_FALLBACK_EMOJIS: Record<Exclude<TurnReactionEffect, "none">, string> = {
  hearts: "❤️💕🫶",
  laugh: "😂🤣💀",
  money: "💰🔥💸",
  balloons: "🎈🎉✨",
};

function normalizeReaction(parsed: {
  effect?: string;
  emojis?: string;
}): TurnReactionResult {
  const effect = REACTION_EFFECTS.has(parsed.effect as TurnReactionEffect)
    ? (parsed.effect as TurnReactionEffect)
    : "none";

  if (effect === "none") {
    return { effect: "none", emojis: "" };
  }

  const emojis = parsed.emojis?.trim() || REACTION_FALLBACK_EMOJIS[effect];
  return { effect, emojis };
}

export async function classifyTurnReaction(input: {
  projectId: string;
  location: string;
  model: string;
  credentialsJson: string;
  speaker: "user" | "advisor";
  text: string;
  turns?: Array<{ speaker: string; text: string }>;
}): Promise<TurnReactionResult> {
  const raw = await generateText({
    projectId: input.projectId,
    location: input.location,
    model: input.model,
    credentialsJson: input.credentialsJson,
    maxOutputTokens: 64,
    temperature: 0.2,
    systemPrompt: REACTION_SYSTEM_PROMPT,
    userPrompt: buildReactionUserPrompt({
      speaker: input.speaker,
      text: input.text,
      turns: input.turns,
    }),
  });

  const parsed = parseJsonObject<{ effect?: string; emojis?: string }>(raw);
  if (!parsed) {
    log.warn("turn reaction JSON parse failed", { rawLength: raw.length });
    return { effect: "none", emojis: "" };
  }
  const result = normalizeReaction(parsed);
  log.info("turn reaction classified", { effect: result.effect });
  return result;
}
