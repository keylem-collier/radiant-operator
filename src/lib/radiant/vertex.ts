import {
  BRAND_IMAGE_CONTEXT,
  getBrandReferenceImages,
} from "@/lib/radiant/brand-assets";
import { getGoogleAccessToken } from "@/lib/radiant/google-auth";
import { createLogger } from "@/lib/radiant/logger";

const log = createLogger("vertex");

export async function generateGeminiImage(input: {
  projectId: string;
  location: string;
  model: string;
  credentialsJson: string;
  prompt: string;
}): Promise<string> {
  log.info("generateGeminiImage", { model: input.model });
  const token = await getGoogleAccessToken(input.credentialsJson);

  const url = `https://${input.location}-aiplatform.googleapis.com/v1/projects/${input.projectId}/locations/${input.location}/publishers/google/models/${input.model}:generateContent`;

  const brandImages = getBrandReferenceImages();
  const promptText =
    brandImages.length > 0 ? `${BRAND_IMAGE_CONTEXT}\n\n${input.prompt}` : input.prompt;

  // Brand reference images first, then the brief — keeps the model anchored to
  // the Versaunt logo / product look before reading the creative direction.
  const requestParts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [
    ...brandImages.map((ref) => ({
      inlineData: { mimeType: ref.mimeType, data: ref.data },
    })),
    { text: promptText },
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: requestParts,
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Image generation failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType ?? "image/png";
      return `data:${mime};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image returned from Gemini");
}

/**
 * Mandatory house style for every generated video. All Veo ads are talking
 * puppets with a short funny tagline — distinctive, on-brand, and demo-friendly.
 */
const VEO_PUPPET_STYLE = `ART STYLE (MANDATORY — overrides any conflicting style): Render the entire video as a charming handcrafted puppet world. Every character and subject is an expressive felt/foam talking puppet (Muppet-style) with visible stitching, googly eyes, and big personality. Lighting is warm and cinematic; the world is tactile and playful, not photoreal.

PERFORMANCE: A talking puppet delivers ONE short, funny spoken tagline — fewer than 8 words total — with clear lip-sync and upbeat energy. Keep on-screen text minimal or none. The tagline should land the ad's core message in a punchy, memorable way.`;

export async function startVeoOperation(input: {
  projectId: string;
  location: string;
  model: string;
  credentialsJson: string;
  prompt: string;
}): Promise<string> {
  const token = await getGoogleAccessToken(input.credentialsJson);

  const url = `https://${input.location}-aiplatform.googleapis.com/v1/projects/${input.projectId}/locations/${input.location}/publishers/google/models/${input.model}:predictLongRunning`;

  // This Veo model rejects referenceImages (FAILED_PRECONDITION), so we keep the
  // brand/style direction in the prompt text only and skip image references —
  // avoids a wasted 400 + retry on every video.
  const promptText = `${VEO_PUPPET_STYLE}\n\n${input.prompt}`;

  const parameters = {
    aspectRatio: "16:9",
    durationSeconds: 8,
    generateAudio: true,
    resolution: "720p",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ instances: [{ prompt: promptText }], parameters }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Veo start failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as { name?: string };
  if (!data.name) {
    throw new Error("Veo did not return an operation name");
  }

  return data.name;
}

export async function pollVeoOperation(input: {
  projectId: string;
  location: string;
  model: string;
  credentialsJson: string;
  operationName: string;
}): Promise<{ done: boolean; videoDataUrl?: string; error?: string; status?: string }> {
  const token = await getGoogleAccessToken(input.credentialsJson);

  const url = `https://${input.location}-aiplatform.googleapis.com/v1/projects/${input.projectId}/locations/${input.location}/publishers/google/models/${input.model}:fetchPredictOperation`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ operationName: input.operationName }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Veo poll failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    done?: boolean;
    error?: { message?: string };
    response?: {
      videos?: Array<{
        bytesBase64Encoded?: string;
        gcsUri?: string;
        videoUri?: string;
        uri?: string;
      }>;
    };
  };

  if (!data.done) {
    return { done: false, status: "running" };
  }

  if (data.error?.message) {
    return { done: true, error: data.error.message };
  }

  const video = data.response?.videos?.[0];
  if (video?.bytesBase64Encoded) {
    return {
      done: true,
      videoDataUrl: `data:video/mp4;base64,${video.bytesBase64Encoded}`,
      status: "complete",
    };
  }

  const uri = video?.gcsUri ?? video?.videoUri ?? video?.uri;
  if (uri) {
    return { done: true, status: `complete: ${uri}` };
  }

  return { done: true, status: "complete (no playable video in response)" };
}
