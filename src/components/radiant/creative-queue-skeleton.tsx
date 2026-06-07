"use client";

import { useEffect, useState, type CSSProperties } from "react";

export const QUEUE_PLACEHOLDER_CARDS = [
  {
    format: "Image Ad",
    platform: "Meta",
    headline: "Meta feed creative",
    detail: "Static ad from your conversation",
  },
  {
    format: "Video",
    platform: "Veo",
    headline: "Short-form video",
    detail: "UGC-style concept for vertical video",
  },
] as const;

const EXTRACTION_STEPS = [
  "Reading your conversation…",
  "Drafting Meta image concept…",
  "Writing video prompt…",
] as const;

type CreativeQueueSkeletonProps = {
  active?: boolean;
  showStatus?: boolean;
  indexOffset?: number;
};

export function CreativeQueueExtractionStatus({ active = true }: { active?: boolean }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) return;

    setStepIndex(0);
    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % EXTRACTION_STEPS.length);
    }, 1400);

    return () => window.clearInterval(timer);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="queue-extraction-status motion-rise mb-4 rounded-2xl border border-[#d8dacd] bg-[#fffdf5]/90 px-4 py-3 text-center shadow-sm"
      role="status"
      aria-live="polite"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a633f]">
        Building your queue
      </p>
      <p className="mt-1 text-sm font-medium text-[#3f443b]">
        {EXTRACTION_STEPS[stepIndex]}
      </p>
    </div>
  );
}

export function CreativeQueueSkeletonCard({
  card,
  index = 0,
}: {
  card: (typeof QUEUE_PLACEHOLDER_CARDS)[number];
  index?: number;
}) {
  return (
    <article
      className="queue-skeleton-card w-full max-w-full shrink-0 rounded-[1.35rem] border border-dashed border-[#c8cdbf] bg-[#fffdf5]/55 p-5 text-[#1f211d]"
      style={{ "--job-stagger": `${Math.min(index * 50, 200)}ms` } as CSSProperties}
      aria-hidden="true"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase text-[#8a633f]/80">
          {card.format}
        </span>
        <span className="rounded-full border border-[#d8dacd] bg-[#f3efe2]/80 px-2 py-1 text-[11px] font-semibold text-[#66705d]/80">
          {card.platform}
        </span>
      </div>

      <div className="queue-skeleton-line mb-3 h-6 w-[78%] rounded-full" />
      <div className="queue-skeleton-line mb-2 h-3 w-full rounded-full" />
      <div className="queue-skeleton-line mb-2 h-3 w-[92%] rounded-full" />
      <div className="queue-skeleton-line mb-4 h-3 w-[84%] rounded-full" />

      <p className="text-sm font-medium text-[#66705d]">{card.headline}</p>
      <p className="mt-1 text-xs leading-5 text-[#858b7c]">{card.detail}</p>

      <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#d8dacd] px-2.5 py-1 text-[11px] font-semibold uppercase text-[#858b7c]">
        <span className="queue-skeleton-dot" aria-hidden="true" />
        Drafting
      </p>
    </article>
  );
}

export function CreativeQueueSkeletonCarousel({
  active = true,
  indexOffset = 0,
}: CreativeQueueSkeletonProps) {
  return (
    <>
      {QUEUE_PLACEHOLDER_CARDS.map((card, index) => (
        <CreativeQueueSkeletonCard
          key={card.format}
          card={card}
          index={indexOffset + index}
        />
      ))}
    </>
  );
}
