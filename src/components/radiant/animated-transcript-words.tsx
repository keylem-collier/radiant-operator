"use client";

import { useEffect, useRef } from "react";

type AnimatedTranscriptWordsProps = {
  text: string;
  className?: string;
  resetKey?: string;
};

function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? [];
}

export function AnimatedTranscriptWords({
  text,
  className = "",
  resetKey = "",
}: AnimatedTranscriptWordsProps) {
  const prevLengthRef = useRef(0);
  const resetRef = useRef(resetKey);

  if (resetRef.current !== resetKey) {
    resetRef.current = resetKey;
    prevLengthRef.current = 0;
  }

  const tokens = tokenize(text);
  const wordCount = tokens.filter((token) => token.trim().length > 0).length;
  const animateFrom = prevLengthRef.current;

  useEffect(() => {
    prevLengthRef.current = wordCount;
  }, [text, wordCount]);

  let seenWords = 0;

  return (
    <span className={className}>
      {tokens.map((token, index) => {
        const isWord = token.trim().length > 0;
        let animate = false;
        let delayMs = 0;

        if (isWord) {
          if (seenWords >= animateFrom) {
            animate = true;
            delayMs = Math.min((seenWords - animateFrom) * 42, 360);
          }
          seenWords += 1;
        }

        return (
          <span
            key={`${resetKey}-${index}-${token}`}
            className={animate ? "radiant-transcript-word" : undefined}
            style={animate ? { animationDelay: `${delayMs}ms` } : undefined}
          >
            {token}
          </span>
        );
      })}
    </span>
  );
}
