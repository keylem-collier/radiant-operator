"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { CreativeJob } from "@/lib/radiant/types";

type CreativeJobCardProps = {
  job: CreativeJob;
  imageDataUrl?: string;
  videoDataUrl?: string;
  veoStatus?: string;
  onGenerateImage?: (job: CreativeJob) => void;
  onStartVideoJob?: (job: CreativeJob) => void;
  generating?: boolean;
  index?: number;
};

const formatLabels: Record<CreativeJob["format"], string> = {
  image_ad: "Image Ad",
  video_prompt: "Video",
  search_ad: "Search Ad",
  hook: "Hook",
  guardrail: "Guardrail",
};

const platformLabels: Record<CreativeJob["platform"], string> = {
  meta: "Meta",
  tiktok: "TikTok",
  google_search: "Google Search",
  veo: "Veo",
  general: "General",
};

function imageStatusLabel(
  job: CreativeJob,
  imageDataUrl: string | undefined,
  generating: boolean,
): string | null {
  if (job.format !== "image_ad") return null;
  if (imageDataUrl) return "Image ready";
  if (generating || job.status === "generating") return "Generating image…";
  if (job.status === "failed") return "Image generation failed";
  if (job.status === "queued") return "Image queued";
  return "Starting image…";
}

function videoStatusLabel(
  job: CreativeJob,
  videoDataUrl: string | undefined,
  veoStatus: string | undefined,
  generating: boolean,
): string | null {
  const isVideo = job.format === "video_prompt" || job.platform === "veo";
  if (!isVideo) return null;

  if (videoDataUrl) return "Video ready";
  if (job.status === "failed") return "Video job failed";

  const veo = veoStatus?.toLowerCase() ?? "";
  if (veo.includes("starting") || veo === "starting…") return "Starting video…";
  if (veo.includes("running") || veo.includes("started")) return "Video running…";
  if (veo.includes("still running")) return "Video still running…";
  if (generating || job.status === "generating") return "Starting video…";
  if (job.status === "queued") return "Video queued";

  return "Starting video…";
}

function productionStatusLabel(
  job: CreativeJob,
  imageDataUrl: string | undefined,
  videoDataUrl: string | undefined,
  veoStatus: string | undefined,
  generating: boolean,
): string {
  return (
    imageStatusLabel(job, imageDataUrl, generating) ??
    videoStatusLabel(job, videoDataUrl, veoStatus, generating) ??
    (job.status === "queued" ? "Queued" : "Producing…")
  );
}

export function CreativeJobCard({
  job,
  imageDataUrl,
  videoDataUrl,
  veoStatus,
  onGenerateImage,
  onStartVideoJob,
  generating = false,
  index = 0,
}: CreativeJobCardProps) {
  const isImage = job.format === "image_ad";
  const isVideo = job.format === "video_prompt" || job.platform === "veo";
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  const productionLabel = productionStatusLabel(
    job,
    imageDataUrl,
    videoDataUrl,
    veoStatus,
    generating,
  );
  const mediaReady = Boolean(imageDataUrl) || Boolean(videoDataUrl);
  const canRetryImage =
    isImage && onGenerateImage && (job.status === "drafted" || job.status === "failed");
  const canRetryVideo =
    isVideo &&
    onStartVideoJob &&
    (job.status === "drafted" || job.status === "queued" || job.status === "failed");

  return (
    <article
      className="motion-job-card w-full max-w-full shrink-0 rounded-[1.35rem] border border-[#d8dacd] bg-[#fffdf5]/76 p-5 text-[#1f211d] shadow-xl shadow-[#b1a977]/18 backdrop-blur"
      style={{ "--job-stagger": `${Math.min(index * 50, 200)}ms` } as CSSProperties}
    >
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold uppercase text-[#8a633f]">
          {formatLabels[job.format]}
        </span>
        <span className="max-w-[45%] shrink-0 truncate rounded-full border border-[#d8dacd] bg-[#f3efe2] px-2 py-1 text-[11px] font-semibold text-[#66705d]">
          {platformLabels[job.platform]}
        </span>
      </div>
      <h3 className="text-xl font-semibold leading-tight break-words">
        {job.title}
      </h3>

      {!mediaReady && (
        <p
          className={`motion-job-media mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
            job.status === "failed"
              ? "bg-[#fce8e6] text-[#982f2a]"
              : "bg-[#eef4e8] text-[#315c4b]"
          }`}
          aria-live="polite"
        >
          {productionLabel}
        </p>
      )}

      {imageDataUrl && (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="motion-job-media group relative mt-4 block w-full overflow-hidden rounded-2xl border border-[#e4dfcf]"
          aria-label={`Open ${job.title} full screen`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageDataUrl}
            alt={job.title}
            className="aspect-square w-full cursor-zoom-in object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
            Tap to expand
          </span>
        </button>
      )}

      {lightboxOpen && imageDataUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm radiant-lightbox-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageDataUrl}
            alt={job.title}
            className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close full screen"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl leading-none text-white backdrop-blur transition hover:bg-white/25"
          >
            ×
          </button>
        </div>
      )}

      {videoDataUrl && (
        <video
          src={videoDataUrl}
          className="motion-job-media mt-4 aspect-video w-full rounded-2xl border border-[#e4dfcf] object-cover"
          autoPlay
          loop
          muted
          playsInline
          controls
        />
      )}

      {(canRetryImage || canRetryVideo) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {canRetryImage && (
            <button
              type="button"
              onClick={() => onGenerateImage(job)}
              disabled={generating}
              className="radiant-action-button px-3 py-2 text-xs"
            >
              {generating ? "Generating…" : job.status === "failed" ? "Retry image" : "Generate image"}
            </button>
          )}
          {canRetryVideo && (
            <button
              type="button"
              onClick={() => onStartVideoJob(job)}
              disabled={generating}
              className="radiant-action-button px-3 py-2 text-xs"
            >
              {generating
                ? "Working…"
                : job.status === "failed"
                  ? "Retry video"
                  : "Start video job"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
