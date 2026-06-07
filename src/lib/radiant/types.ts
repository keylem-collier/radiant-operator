export type Speaker = "user" | "advisor";

export type TranscriptTurn = {
  id: string;
  speaker: Speaker;
  text: string;
  createdAt: number;
};

export type CreativeFormat =
  | "image_ad"
  | "video_prompt"
  | "search_ad"
  | "hook"
  | "guardrail";

export type CreativePlatform =
  | "meta"
  | "tiktok"
  | "google_search"
  | "veo"
  | "general";

export type CreativeJobStatus =
  | "queued"
  | "drafted"
  | "generating"
  | "done"
  | "failed";

export type CreativeJob = {
  id: string;
  sourceTurnId: string;
  status: CreativeJobStatus;
  format: CreativeFormat;
  platform: CreativePlatform;
  title: string;
  insight: string;
  prompt: string;
  outputText?: string;
  imageDataUrl?: string;
  videoDataUrl?: string;
  createdAt: number;
};

export type AdvisorResponse = {
  advisorText: string;
  mossContext?: string[];
  creativeJobs: CreativeJob[];
};

export type CreativeExtractionResult = {
  jobs: Array<{
    format: CreativeFormat;
    platform: CreativePlatform;
    title: string;
    insight: string;
    prompt: string;
  }>;
};

export type TurnReactionEffect = "hearts" | "laugh" | "money" | "balloons" | "none";

export type TurnReactionResult = {
  effect: TurnReactionEffect;
  emojis: string;
};
