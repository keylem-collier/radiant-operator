/**
 * Index docs/moss-corpus into Moss Cloud.
 *
 * Usage:
 *   node --env-file=.env.local scripts/moss-index-corpus.mjs
 *
 * Requires: MOSS_PROJECT_ID, MOSS_PROJECT_KEY
 * Optional: MOSS_INDEX_NAME (default: knowledge), MOSS_MODEL_ID (default: moss-minilm)
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MossClient } from "@moss-dev/moss";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.join(__dirname, "../docs/moss-corpus");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Run with: node --env-file=.env.local scripts/moss-index-corpus.mjs`);
  }
  return value;
}

function chunkMarkdown(content, sourceFile) {
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.replace(/^#+\s*/gm, "").trim())
    .filter((p) => p.length > 30);

  return paragraphs.map((text, i) => ({
    id: `${sourceFile.replace(/\.md$/, "")}-${i}`,
    text,
    metadata: { source: sourceFile },
  }));
}

async function loadCorpusDocuments() {
  const files = (await readdir(CORPUS_DIR)).filter((f) => f.endsWith(".md"));
  const docs = [];

  for (const file of files) {
    const content = await readFile(path.join(CORPUS_DIR, file), "utf8");
    docs.push(...chunkMarkdown(content, file));
  }

  return docs;
}

async function main() {
  const projectId = requireEnv("MOSS_PROJECT_ID");
  const projectKey = requireEnv("MOSS_PROJECT_KEY");
  const indexName = process.env.MOSS_INDEX_NAME ?? "knowledge";
  const modelId = process.env.MOSS_MODEL_ID ?? "moss-minilm";

  console.log(`Loading corpus from ${CORPUS_DIR}...`);
  const documents = await loadCorpusDocuments();
  console.log(`Prepared ${documents.length} documents.`);

  const client = new MossClient(projectId, projectKey);

  const indexes = await client.listIndexes();
  const exists = indexes.some((idx) => idx.name === indexName);

  if (exists) {
    console.log(`Updating existing index "${indexName}"...`);
    await client.addDocuments(indexName, documents, {
      upsert: true,
      onProgress: (p) => console.log(`  ${p.status} ${p.progress ?? 0}%`),
    });
  } else {
    console.log(`Creating index "${indexName}" with model ${modelId}...`);
    await client.createIndex(indexName, documents, {
      modelId,
      onProgress: (p) => console.log(`  ${p.status} ${p.progress ?? 0}%`),
    });
  }

  await client.loadIndex(indexName);
  const probe = await client.query(indexName, "dental intake bottleneck leads", {
    topK: 2,
  });

  console.log("\nIndex ready. Probe results:");
  for (const doc of probe.docs ?? []) {
    console.log(`  [${doc.score?.toFixed(3)}] ${doc.text?.slice(0, 100)}...`);
  }

  console.log(`\nDone. Set MOSS_INDEX_NAME=${indexName} in Vercel and redeploy.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
