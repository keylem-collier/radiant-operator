"use client";

import * as React from "react";
import {
  launchBalloonsInContainer,
  launchReactionInContainer,
} from "@/lib/radiant/balloons-in-container";
import type { TurnReactionEffect } from "@/lib/radiant/types";
import { cn } from "@/lib/utils";

export interface BalloonsProps {
  className?: string;
  containerRef?: React.RefObject<HTMLElement | null>;
  onLaunch?: () => void;
}

export type BalloonsHandle = {
  launchAnimation: () => void;
  launchReaction: (effect: TurnReactionEffect, emojis?: string) => void;
};

const Balloons = React.forwardRef<BalloonsHandle, BalloonsProps>(
  ({ className, containerRef, onLaunch }, ref) => {
    const launchAnimation = React.useCallback(() => {
      const container = containerRef?.current;
      if (container) {
        void launchBalloonsInContainer(container);
      }
      onLaunch?.();
    }, [containerRef, onLaunch]);

    const launchReaction = React.useCallback(
      (effect: TurnReactionEffect, emojis?: string) => {
        const container = containerRef?.current;
        if (!container || effect === "none") return;
        launchReactionInContainer(container, effect, emojis);
        onLaunch?.();
      },
      [containerRef, onLaunch],
    );

    React.useImperativeHandle(
      ref,
      () => ({ launchAnimation, launchReaction }),
      [launchAnimation, launchReaction],
    );

    return (
      <div
        aria-hidden="true"
        className={cn("balloons-container pointer-events-none", className)}
      />
    );
  },
);

Balloons.displayName = "Balloons";

export { Balloons };
