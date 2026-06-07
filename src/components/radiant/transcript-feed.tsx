"use client";

import { useEffect, useRef } from "react";
import { AnimatedTranscriptWords } from "@/components/radiant/animated-transcript-words";
import type { TranscriptTurn } from "@/lib/radiant/types";

type TranscriptFeedProps = {
  turns: TranscriptTurn[];
  interimUserText?: string;
};

export function TranscriptFeed({
  turns,
  interimUserText = "",
}: TranscriptFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const interim = interimUserText.trim();

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [turns, interim]);

  if (turns.length === 0 && !interim) {
    return null;
  }

  return (
    <div className="radiant-transcript-feed">
      <div ref={scrollRef} className="radiant-transcript-feed-scroll">
        {turns.map((turn) => (
          <div key={turn.id} className="radiant-transcript-block">
            <div className="radiant-transcript-block-inner">
              <p
                className={
                  turn.speaker === "user"
                    ? "radiant-transcript-label"
                    : "radiant-transcript-label radiant-transcript-label-advisor"
                }
              >
                {turn.speaker === "user" ? "You" : "Maya"}
              </p>
              <p
                className={
                  turn.speaker === "user"
                    ? "radiant-transcript-user"
                    : "radiant-transcript-advisor"
                }
              >
                <AnimatedTranscriptWords text={turn.text} resetKey={turn.id} />
              </p>
            </div>
          </div>
        ))}
        {interim && (
          <div className="radiant-transcript-block">
            <div className="radiant-transcript-block-inner">
              <p className="radiant-transcript-label">You</p>
              <p className="radiant-transcript-user">
                <AnimatedTranscriptWords text={interim} resetKey="interim-user" />
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
