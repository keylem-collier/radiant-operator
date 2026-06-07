import { balloons, textBalloons } from "balloons-js";

import type { TurnReactionEffect } from "@/lib/radiant/types";

const REACTION_COLORS: Record<Exclude<TurnReactionEffect, "none" | "balloons">, string> = {
  hearts: "#e85d75",
  laugh: "#f5a623",
  money: "#27ae60",
};

function waitForLayer(
  selector: string,
  timeoutMs = 1200,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const started = Date.now();

    const tick = () => {
      const layer = document.querySelector(selector);
      if (layer instanceof HTMLElement) {
        resolve(layer);
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }

      requestAnimationFrame(tick);
    };

    tick();
  });
}

function clipLayerToContainer(layer: HTMLElement, container: HTMLElement): void {
  const rect = container.getBoundingClientRect();
  const top = Math.max(0, rect.top);
  const right = Math.max(0, window.innerWidth - rect.right);
  const bottom = Math.max(0, window.innerHeight - rect.bottom);
  const left = Math.max(0, rect.left);
  const radius = getComputedStyle(container).borderRadius || "0px";

  layer.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius})`;
  layer.style.overflow = "hidden";
}

export async function launchBalloonsInContainer(
  container: HTMLElement,
): Promise<void> {
  const launch = balloons();
  const layer = await waitForLayer("balloons");

  if (layer) {
    clipLayerToContainer(layer, container);
  }

  await launch;
}

export function launchTextBalloonsInContainer(
  container: HTMLElement,
  text: string,
  options?: { fontSize?: number; color?: string },
): void {
  textBalloons([
    {
      text,
      fontSize: options?.fontSize ?? 72,
      color: options?.color ?? "#171923",
    },
  ]);

  void waitForLayer("text-balloons").then((layer) => {
    if (layer) {
      clipLayerToContainer(layer, container);
    }
  });
}

export function launchReactionInContainer(
  container: HTMLElement,
  effect: TurnReactionEffect,
  emojis?: string,
): void {
  if (effect === "none") return;

  if (effect === "balloons") {
    void launchBalloonsInContainer(container);
    return;
  }

  const text = emojis?.trim();
  if (!text) return;

  launchTextBalloonsInContainer(container, text, {
    color: REACTION_COLORS[effect],
    fontSize: fitFontSize(container, [...text].length),
  });
}

/**
 * Picks a font size so the spelled-out balloons fit inside the device width.
 * Each balloon glyph occupies roughly 1.15x its font size horizontally, so we
 * size down for longer strings (e.g. a full word) and keep short emoji bursts big.
 */
function fitFontSize(container: HTMLElement, charCount: number): number {
  const width = container.getBoundingClientRect().width || 390;
  const usable = width * 0.82;
  const perChar = 1.15;
  const fitted = usable / (Math.max(1, charCount) * perChar);
  return Math.max(26, Math.min(72, Math.round(fitted)));
}
