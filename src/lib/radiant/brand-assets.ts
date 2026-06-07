import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "@/lib/radiant/logger";

const log = createLogger("brand-assets");

export type BrandReferenceImage = {
  /** Human label for prompt text, e.g. "logo" or "product UI". */
  role: string;
  mimeType: string;
  /** Raw base64 (no data: prefix). */
  data: string;
};

type BrandAssetSource = {
  role: string;
  file: string;
  mimeType: string;
};

/** Deterministic brand references attached to every image/video generation. */
const BRAND_ASSET_SOURCES: BrandAssetSource[] = [
  { role: "logo", file: "versaunt-logo.png", mimeType: "image/png" },
  { role: "product UI", file: "versaunt-product.png", mimeType: "image/png" },
];

let cachedReferences: BrandReferenceImage[] | null = null;

/**
 * Loads the Versaunt logo + product screenshot as base64 reference images.
 * Cached after first read. Missing files are skipped (never throws) so a
 * generation never fails just because an asset is absent.
 */
export function getBrandReferenceImages(): BrandReferenceImage[] {
  if (cachedReferences) return cachedReferences;

  const references: BrandReferenceImage[] = [];

  for (const source of BRAND_ASSET_SOURCES) {
    try {
      const filePath = join(process.cwd(), "public", "brand", source.file);
      const data = readFileSync(filePath).toString("base64");
      references.push({ role: source.role, mimeType: source.mimeType, data });
    } catch (error) {
      log.warn("brand reference image unavailable", {
        file: source.file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  cachedReferences = references;
  log.info("brand reference images loaded", { count: references.length });
  return references;
}

/** Brand-image guidance woven into every creative prompt. */
export const BRAND_IMAGE_CONTEXT = `Brand reference images are attached: the Versaunt logo and a screenshot of the Versaunt product UI.
- Treat the logo as the canonical Versaunt mark. When a logo appears in the creative, match this exact mark — do not invent or distort it. Keep its proportions and avoid recoloring it beyond tasteful monochrome when the layout requires it.
- Use the product screenshot only as a reference for Versaunt's visual style, UI feel, and color world. Do not copy private data from it.
- Keep the overall look consistent with Versaunt's brand: clean, modern, operator-first, premium.`;
