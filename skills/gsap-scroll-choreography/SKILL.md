# GSAP Scroll Choreography

## Description

Use this skill for higher-end frontend choreography: scroll-linked storytelling, pinned sections, timeline sequences, staggered reveals, product tours, motion-led hero scenes, or interactions that need precise sequencing beyond simple component state.

## Current Signals

- GSAP timelines are the best fit when multiple motion beats need shared timing.
- ScrollTrigger is the standard GSAP tool for scroll-based playback, scrubbing, pinning, snapping, callbacks, and velocity-aware behavior.
- Timeline motion requires stricter cleanup in React/Next.js than simple CSS transitions.

## Workflow

1. Sketch the sequence as beats before writing code.
2. Use one timeline for related choreography.
3. Use ScrollTrigger only where scroll position is genuinely part of the interaction.
4. Register plugins once in client-only code.
5. Scope selectors to refs. Avoid global selectors in React components.
6. Clean up timelines/triggers on unmount.
7. Test desktop and mobile separately. Mobile scroll physics can change the feel.

## React Pattern

```tsx
"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function ScrollSequence() {
  const rootRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!rootRef.current) return;

    const context = gsap.context(() => {
      gsap
        .timeline({
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 75%",
            end: "bottom 35%",
            scrub: 0.6,
          },
        })
        .from("[data-motion='title']", { y: 28, opacity: 0, duration: 0.5 })
        .from("[data-motion='card']", { y: 20, opacity: 0, stagger: 0.08 }, "-=0.2");
    }, rootRef);

    return () => context.revert();
  }, []);

  return <section ref={rootRef} />;
}
```

## Quality Bar

- Motion has a clear beginning, middle, and end.
- Pinned sections do not trap the user.
- Scroll-linked movement remains smooth at laptop and mobile widths.
- Timelines are cleaned up and do not duplicate after route changes.
- Reduced-motion mode avoids scrubbed choreography.

## Avoid

- Installing GSAP for a hover state or one-card reveal.
- Multiple ScrollTriggers fighting over the same transform property.
- Global selectors that animate unrelated elements.
- Scroll hijacking.
- Long sequences that make operational UI feel slow.

## Sources

- https://gsap.com/docs/v3/GSAP/Timeline/
- https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- https://gsap.com/cheatsheet/gsap-3-cheat-sheet.pdf
