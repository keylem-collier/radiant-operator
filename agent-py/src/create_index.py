"""Build Moss indexes from docs/moss-corpus (same source as scripts/moss-index-corpus.mjs)."""

from __future__ import annotations

import asyncio
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from moss import DocumentInfo, MossClient

AGENT_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = AGENT_DIR.parent
CORPUS_DIR = REPO_ROOT / "docs" / "moss-corpus"
ENV_PATHS = [AGENT_DIR / ".env.local", REPO_ROOT / ".env.local"]

for env_path in ENV_PATHS:
    load_dotenv(env_path)

DEFAULT_MODEL_ID = "moss-minilm"
DEFAULT_KNOWLEDGE_INDEX = "knowledge"
DEFAULT_MEMORY_INDEX = "memory"


def _chunk_markdown(content: str, source_file: str) -> list[DocumentInfo]:
    paragraphs = [
        re.sub(r"^#+\s*", "", p).strip()
        for p in re.split(r"\n\n+", content)
        if len(re.sub(r"^#+\s*", "", p).strip()) > 30
    ]
    docs: list[DocumentInfo] = []
    stem = source_file.replace(".md", "")
    for index, text in enumerate(paragraphs):
        docs.append(
            DocumentInfo(
                id=f"{stem}-{index}",
                text=text,
                metadata={"source": source_file},
            )
        )
    return docs


def _load_corpus_documents() -> list[DocumentInfo]:
    if not CORPUS_DIR.exists():
        raise FileNotFoundError(f"Corpus directory not found: {CORPUS_DIR}")

    documents: list[DocumentInfo] = []
    for path in sorted(CORPUS_DIR.glob("*.md")):
        documents.extend(_chunk_markdown(path.read_text(encoding="utf-8"), path.name))

    if not documents:
        raise ValueError(f"No documents loaded from {CORPUS_DIR}")
    return documents


def _memory_seed_documents() -> list[DocumentInfo]:
    return [
        DocumentInfo(
            id="__seed__",
            text="(memory seed) placeholder document so the memory index can be loaded before the first write.",
            metadata={"user_id": "__seed__"},
        )
    ]


async def build_indexes() -> None:
    project_id = os.getenv("MOSS_PROJECT_ID")
    project_key = os.getenv("MOSS_PROJECT_KEY")
    knowledge_index = os.getenv("MOSS_INDEX_NAME", DEFAULT_KNOWLEDGE_INDEX)
    memory_index = os.getenv("MOSS_MEMORY_INDEX_NAME", DEFAULT_MEMORY_INDEX)
    model_id = os.getenv("MOSS_MODEL_ID", DEFAULT_MODEL_ID)

    missing = [
        name
        for name, value in {
            "MOSS_PROJECT_ID": project_id,
            "MOSS_PROJECT_KEY": project_key,
        }.items()
        if not value
    ]
    if missing:
        raise OSError(
            "Missing required Moss environment variables: "
            + ", ".join(missing)
            + ". Set them in .env.local before running this script."
        )

    assert project_id is not None
    assert project_key is not None

    knowledge_docs = _load_corpus_documents()
    memory_docs = _memory_seed_documents()
    client = MossClient(project_id, project_key)

    print(
        f"Creating Moss knowledge index '{knowledge_index}' with "
        f"{len(knowledge_docs)} docs using model '{model_id}'..."
    )
    knowledge_result = await client.create_index(
        knowledge_index, knowledge_docs, model_id
    )
    print(
        f" done (job: {knowledge_result.job_id}, index: {knowledge_result.index_name}, "
        f"docs: {knowledge_result.doc_count})"
    )

    print(
        f"Creating Moss memory index '{memory_index}' with "
        f"{len(memory_docs)} seed doc(s) using model '{model_id}'..."
    )
    memory_result = await client.create_index(memory_index, memory_docs, model_id)
    print(
        f" done (job: {memory_result.job_id}, index: {memory_result.index_name}, "
        f"docs: {memory_result.doc_count})"
    )

    print("Moss indexes ready.")


if __name__ == "__main__":
    asyncio.run(build_indexes())
