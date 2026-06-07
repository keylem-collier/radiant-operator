import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getMossConfig, hasMossConfig } from "@/lib/radiant/env";
import { createLogger } from "@/lib/radiant/logger";

const log = createLogger("moss");

export type MossQueryResult = {
  snippets: string[];
  source: "moss" | "local";
  pending?: boolean;
};

const CORPUS_DIR = path.join(process.cwd(), "docs/moss-corpus");

let mossIndexLoaded = false;
let mossClient: InstanceType<
  Awaited<typeof import("@moss-dev/moss")>["MossClient"]
> | null = null;

async function getMossClient() {
  if (!mossClient) {
    log.info("loading Moss SDK client");
    const { MossClient } = await import("@moss-dev/moss");
    const config = getMossConfig();
    mossClient = new MossClient(config.projectId, config.projectKey);
  }
  return mossClient;
}

async function queryLocalCorpus(query: string): Promise<string[]> {
  let files: string[];
  try {
    files = (await readdir(CORPUS_DIR)).filter((f) => f.endsWith(".md"));
  } catch {
    log.warn("local corpus directory missing", { path: CORPUS_DIR });
    return [];
  }

  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3);

  const scored: Array<{ text: string; score: number }> = [];

  for (const file of files) {
    const content = await readFile(path.join(CORPUS_DIR, file), "utf8");
    const paragraphs = content
      .split(/\n\n+/)
      .map((p) => p.replace(/^#+\s*/gm, "").trim())
      .filter((p) => p.length > 20 && !p.startsWith("#"));

    for (const paragraph of paragraphs) {
      const lower = paragraph.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (lower.includes(term)) score += 1;
      }
      if (score > 0) {
        scored.push({ text: paragraph.slice(0, 280), score });
      }
    }
  }

  const results = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.text);

  log.info("local corpus query", { fileCount: files.length, matchCount: results.length });
  return results;
}

async function queryMossApi(query: string): Promise<string[]> {
  const config = getMossConfig();
  const client = await getMossClient();

  if (!mossIndexLoaded) {
    log.info("loading Moss index", { indexName: config.indexName });
    await client.loadIndex(config.indexName);
    mossIndexLoaded = true;
  }

  const results = await client.query(config.indexName, query, { topK: 3 });
  const snippets = (results.docs ?? [])
    .map((doc) => doc.text?.trim())
    .filter((text): text is string => Boolean(text))
    .slice(0, 3);

  log.info("Moss API query ok", { snippetCount: snippets.length });
  return snippets;
}

export async function queryMossContext(query: string): Promise<MossQueryResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { snippets: [], source: "local" };
  }

  log.info("queryMossContext", { queryLength: trimmed.length, hasMossConfig: hasMossConfig() });

  if (hasMossConfig()) {
    try {
      const snippets = await queryMossApi(trimmed);
      if (snippets.length > 0) {
        return { snippets, source: "moss" };
      }
      log.warn("Moss returned no snippets, falling back to local corpus");
    } catch (error) {
      log.warn("Moss API failed, falling back to local corpus", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const localSnippets = await queryLocalCorpus(trimmed);
  return {
    snippets: localSnippets,
    source: "local",
    pending: hasMossConfig() ? undefined : true,
  };
}
