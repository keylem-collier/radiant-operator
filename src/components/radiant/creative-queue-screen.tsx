"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CreativeJobCard } from "@/components/radiant/creative-job-card";
import {
  CreativeQueueExtractionStatus,
  CreativeQueueSkeletonCarousel,
} from "@/components/radiant/creative-queue-skeleton";
import { filterMediaQueueJobs } from "@/lib/radiant/queue-config";
import type { CreativeJob } from "@/lib/radiant/types";

type CreativeQueueScreenProps = {
  jobs: CreativeJob[];
  onUpdateJob: (jobId: string, patch: Partial<CreativeJob>) => void;
  scrollRef?: RefObject<HTMLDivElement | null>;
  extractionPending?: number;
  extractionError?: string | null;
  hasConversation?: boolean;
  lastExtractionEmpty?: boolean;
  active?: boolean;
};

export function CreativeQueueScreen({
  jobs,
  onUpdateJob,
  scrollRef,
  extractionPending = 0,
  extractionError = null,
  hasConversation = false,
  lastExtractionEmpty = false,
  active = false,
}: CreativeQueueScreenProps) {
  const [entering, setEntering] = useState(false);
  const [imageByJob, setImageByJob] = useState<Record<string, string>>({});
  const [videoByJob, setVideoByJob] = useState<Record<string, string>>({});
  const [veoStatusByJob, setVeoStatusByJob] = useState<Record<string, string>>({});
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null);
  const autoStartedRef = useRef<Set<string>>(new Set());

  const visibleJobs = useMemo(() => filterMediaQueueJobs(jobs), [jobs]);

  useEffect(() => {
    if (!active) {
      setEntering(false);
      return;
    }

    setEntering(false);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntering(true));
    });

    return () => cancelAnimationFrame(frame);
  }, [active]);

  const isExtracting = extractionPending > 0;
  const showEmptyState =
    visibleJobs.length === 0 && !isExtracting && !hasConversation;
  const showWaitingState =
    visibleJobs.length === 0 && !isExtracting && hasConversation && !lastExtractionEmpty;
  const showQueueBody = visibleJobs.length > 0 || hasConversation;

  const handleGenerateImage = useCallback(
    async (job: CreativeJob) => {
      setGeneratingJobId(job.id);
      onUpdateJob(job.id, { status: "generating" });

      try {
        const response = await fetch("/api/vertex/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? "Image generation failed");
        }

        const data = (await response.json()) as { imageDataUrl: string };
        setImageByJob((prev) => ({ ...prev, [job.id]: data.imageDataUrl }));
        onUpdateJob(job.id, { status: "done", imageDataUrl: data.imageDataUrl });
      } catch (err) {
        onUpdateJob(job.id, {
          status: "failed",
          outputText: err instanceof Error ? err.message : "Failed",
        });
      } finally {
        setGeneratingJobId(null);
      }
    },
    [onUpdateJob],
  );

  const handleStartVideoJob = useCallback(
    async (job: CreativeJob) => {
      setGeneratingJobId(job.id);
      onUpdateJob(job.id, { status: "generating" });
      setVeoStatusByJob((prev) => ({ ...prev, [job.id]: "starting…" }));

      try {
        const startResponse = await fetch("/api/vertex/veo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job, action: "start" }),
        });

        if (!startResponse.ok) {
          const data = (await startResponse.json()) as { error?: string };
          throw new Error(data.error ?? "Veo start failed");
        }

        const startData = (await startResponse.json()) as { operationName: string };
        setVeoStatusByJob((prev) => ({
          ...prev,
          [job.id]: `started (${startData.operationName.slice(-12)})`,
        }));

        // Veo (lite) commonly takes 1.5–2.5 min; poll for up to ~4 min so the
        // background job resolves on its own instead of surfacing the manual
        // "Start video job" button when a short budget runs out.
        for (let attempt = 0; attempt < 48; attempt++) {
          await new Promise((r) => setTimeout(r, 5000));

          const pollResponse = await fetch("/api/vertex/veo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "poll",
              operationName: startData.operationName,
            }),
          });

          if (!pollResponse.ok) continue;

          const pollData = (await pollResponse.json()) as {
            done?: boolean;
            error?: string;
            status?: string;
            hasVideo?: boolean;
          };

          if (!pollData.done) {
            setVeoStatusByJob((prev) => ({ ...prev, [job.id]: "running…" }));
            continue;
          }

          if (pollData.error) {
            throw new Error(pollData.error);
          }

          // The bytes are served by the streaming route (avoids piping a
          // multi-MB base64 blob through the JSON response).
          const videoUrl = pollData.hasVideo
            ? `/api/vertex/veo/stream?op=${encodeURIComponent(startData.operationName)}`
            : undefined;

          if (videoUrl) {
            setVideoByJob((prev) => ({ ...prev, [job.id]: videoUrl }));
          }
          setVeoStatusByJob((prev) => ({
            ...prev,
            [job.id]: pollData.status ?? "complete",
          }));
          onUpdateJob(job.id, {
            status: "done",
            outputText: pollData.status,
            videoDataUrl: videoUrl,
          });
          return;
        }

        setVeoStatusByJob((prev) => ({
          ...prev,
          [job.id]: "still running — check later",
        }));
        onUpdateJob(job.id, { status: "drafted" });
      } catch (err) {
        setVeoStatusByJob((prev) => ({
          ...prev,
          [job.id]: err instanceof Error ? err.message : "failed",
        }));
        onUpdateJob(job.id, { status: "failed" });
      } finally {
        setGeneratingJobId(null);
      }
    },
    [onUpdateJob],
  );

  useEffect(() => {
    for (const job of visibleJobs) {
      const isImage = job.format === "image_ad";
      const isVideo = job.format === "video_prompt" || job.platform === "veo";
      const resolvedImage = imageByJob[job.id] ?? job.imageDataUrl;
      const resolvedVideo = videoByJob[job.id] ?? job.videoDataUrl;
      const hasMedia =
        (isImage && Boolean(resolvedImage)) || (isVideo && Boolean(resolvedVideo));

      if (autoStartedRef.current.has(job.id)) {
        if (job.status === "done" && !hasMedia) {
          autoStartedRef.current.delete(job.id);
        } else {
          continue;
        }
      }

      if (
        job.status === "generating" ||
        (job.status === "done" && hasMedia) ||
        job.status === "failed"
      ) {
        autoStartedRef.current.add(job.id);
        continue;
      }

      autoStartedRef.current.add(job.id);

      if (isImage) {
        void handleGenerateImage(job);
      } else if (isVideo) {
        void handleStartVideoJob(job);
      }
    }
  }, [
    visibleJobs,
    imageByJob,
    videoByJob,
    handleGenerateImage,
    handleStartVideoJob,
  ]);

  const queueShellClass = `flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden px-5 pb-14 pt-28${
    entering ? " is-queue-entering" : ""
  }`;

  if (showEmptyState) {
    return (
      <div className={queueShellClass}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <div className="queue-radar mb-8" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="motion-rise text-5xl font-semibold">Queue</p>
        </div>
      </div>
    );
  }

  return (
    <div className={queueShellClass}>
      {extractionError && (
        <p
          className="motion-rise mb-4 shrink-0 rounded-2xl border border-[#f0b9b6] bg-[#fff7f2]/94 px-4 py-3 text-sm font-medium text-[#982f2a]"
          role="alert"
        >
          Queue extraction failed: {extractionError}
        </p>
      )}

      <CreativeQueueExtractionStatus active={isExtracting} />

      {showWaitingState && (
        <p className="motion-rise mb-4 shrink-0 rounded-2xl border border-[#d8dacd] bg-[#f3efe2]/70 px-4 py-3 text-center text-sm leading-6 text-[#66705d]">
          Maya is pulling image and video concepts from your conversation.
        </p>
      )}

      {showQueueBody && (
        <div
          ref={scrollRef}
          data-queue-scroll
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto pb-6 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-busy={isExtracting}
        >
          {visibleJobs.map((job, index) => (
            <CreativeJobCard
              key={job.id}
              job={job}
              imageDataUrl={imageByJob[job.id] ?? job.imageDataUrl}
              videoDataUrl={videoByJob[job.id] ?? job.videoDataUrl}
              veoStatus={veoStatusByJob[job.id]}
              onGenerateImage={handleGenerateImage}
              onStartVideoJob={handleStartVideoJob}
              generating={generatingJobId === job.id || job.status === "generating"}
              index={index}
            />
          ))}
          {visibleJobs.length === 0 && (
            <CreativeQueueSkeletonCarousel
              active={isExtracting}
              indexOffset={visibleJobs.length}
            />
          )}
          {isExtracting && visibleJobs.length > 0 && (
            <CreativeQueueSkeletonCarousel
              active
              indexOffset={visibleJobs.length}
            />
          )}
        </div>
      )}
    </div>
  );
}
