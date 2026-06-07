/** Default orb accent — Versaunt sage green (matches the resting orb look). */
export const DEFAULT_ORB_ACCENT = "#315c4b";

/**
 * Spoken platform keywords → orb accent color. Colors are kept slightly muted
 * so the orb shifts subtly rather than turning into a brand-logo swatch.
 */
const PLATFORM_ACCENTS: Array<{ keywords: string[]; color: string }> = [
  { keywords: ["google"], color: "#2f9e44" }, // green, brighter shade
  { keywords: ["tiktok", "tik tok"], color: "#ec4f8e" }, // pink
  { keywords: ["meta", "facebook", "instagram"], color: "#2f6df0" }, // blue
  { keywords: ["amazon"], color: "#f59331" }, // orange
];

/**
 * Returns the accent color for the most-recently-mentioned platform in `text`,
 * or null if none is mentioned. The latest mention wins so the orb tracks the
 * platform the user is currently talking about.
 */
export function detectPlatformAccent(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  let bestIndex = -1;
  let bestColor: string | null = null;

  for (const { keywords, color } of PLATFORM_ACCENTS) {
    for (const keyword of keywords) {
      const idx = lower.lastIndexOf(keyword);
      if (idx > bestIndex) {
        bestIndex = idx;
        bestColor = color;
      }
    }
  }

  return bestColor;
}
