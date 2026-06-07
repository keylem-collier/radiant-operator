# LiveKit + Moss Foundation

Last updated: June 6, 2026

## Decision

Use the official LiveKit/Moss hackathon starter as the implementation foundation for the voice-agent layer, not as generic inspiration.

Starter repo: https://github.com/livekit-examples/moss-hacker-starter

Hackathon resource page: https://www.livekit.info/conversational-ai-hackathon

Workshop image captured at event: [livekit-hackathon-workshop.png](../assets/livekit-hackathon-workshop.png)

## Why This Matters

This starter already does the hard sponsor-aligned plumbing:

- Python LiveKit agent.
- Next.js frontend.
- Moss semantic search.
- Moss per-user memory.
- Live retrieval results pushed into the UI as data packets.
- LiveKit Inference for STT, LLM, and TTS, which means the starter only needs LiveKit + Moss credentials.

This means our fastest win path is not to invent a new voice stack. It is to re-skin and redirect the starter from "LiveKit docs helper" to **Radiant Operator**, a live memory co-pilot for founder/operator calls.

## Starter Architecture

The starter has two apps:

- `agent-py/`: Python LiveKit voice agent.
- `frontend/`: Next.js LiveKit frontend.

Important starter files:

- `agent-py/src/agent.py`: LiveKit agent, instructions, Moss tools, LiveKit Inference models, turn detection, and `moss_context` data publishing.
- `agent-py/src/create_index.py`: creates Moss `knowledge` and `memory` indexes.
- `agent-py/knowledge.json`: seed RAG corpus.
- `frontend/app/api/token/route.ts`: creates LiveKit participant tokens, mints `lk_moss_user`, and stamps `user_id` into agent dispatch metadata.
- `frontend/hooks/useMossContextEvents.ts`: listens for `moss_context` LiveKit data packets.
- `frontend/components/app/moss-results-panel.tsx`: renders live retrieval matches and scores.
- `frontend/app-config.ts`: branding, capabilities, visualizer settings, and `AGENT_NAME`.

## Key Pattern To Preserve

The agent has three Moss tools:

- `search_knowledge`: searches the shared `knowledge` index.
- `remember_fact`: writes a fact to the `memory` index tagged with `user_id`.
- `recall_facts`: searches the `memory` index with a metadata filter for the current `user_id`.

After a Moss query, the agent publishes a reliable LiveKit data packet:

```json
{
  "type": "moss_context",
  "data": {
    "query": "user query",
    "matches": [],
    "time_taken_ms": 12,
    "timestamp": 1780790400
  }
}
```

The frontend renders those packets live. This is the exact pattern we need for the "the room sees memory happen" moment.

## Hackathon Credits

LiveKit page says attendees get a 7-day free trial of the LiveKit Ship plan:

- $50 in inference credits.
- No credit card required.
- Redeem URL: https://cloud.livekit.io/projects/p_/redeem
- Code: see the hackathon workshop page (kept out of this repo)

Official LiveKit pricing/docs also indicate Build includes one free US local phone number and 50 free inbound minutes. This supports the phone-call-first demo path.

## LiveKit Docs Tooling From Workshop Image

The workshop slide says:

```shell
npx skills add https://github.com/livekit/agent-skills --skill livekit-agents
```

It also shows the LiveKit docs MCP server:

```json
{
  "livekit-docs": {
    "url": "https://docs.livekit.io/mcp"
  }
}
```

The hackathon page gives the Codex command:

```shell
codex mcp add --url https://docs.livekit.io/mcp livekit-docs
```

Use current LiveKit docs/MCP before editing LiveKit agent code, telephony config, token routes, or deployment commands.

## Setup Path

From the starter repo:

```shell
pnpm setup
lk app env -w agent-py
lk app env -w frontend
pnpm moss:index
pnpm dev
```

LiveKit CLI:

```shell
brew install livekit-cli
lk cloud auth
lk project list
```

Deploy agent:

```shell
cd agent-py
lk agent create
```

## Adaptation Plan For Radiant Operator

1. Replace `agent-py/knowledge.json` with a seeded operator-memory corpus.
2. Rewrite `agent-py/src/agent.py` instructions from LiveKit docs helper to Radiant Operator.
3. Keep `search_knowledge`, `remember_fact`, `recall_facts`, and `moss_context` publishing.
4. Rename UI copy from "Knowledge Matches" to something like "Live Memory" or "Context Found."
5. Set `AGENT_NAME=agent-py` unless we intentionally rename both frontend dispatch and agent registration.
6. Preserve per-user memory metadata filtering.
7. Add phone-number routing once LiveKit issues the number.
8. Use the phone call as the demo entrypoint and keep browser mic as fallback.

## Proposed Seed Corpus Categories

- Prior customer commitments.
- Prospect objections.
- Pricing posture.
- Internal constraints.
- Founder preferences.
- Account-specific landmines.
- "Do not say this" context.
- The one next sentence that would save the moment.

## Open Implementation Questions

- Are we replacing this repo's current Next app with the starter frontend, or keeping our app and copying the relevant LiveKit pieces?
- Do we need LiveKit Cloud deployment tonight, or is local agent + cloud room enough for the demo?
- Is the phone number inbound-only, and how do we attach it to the correct agent dispatch rule?
- Do we want the agent to speak back, or should it primarily display suggestions while the human talks?
- How much should the UI reveal: raw matches, scored memories, or only a polished "say this next" recommendation?

## Sources

- LiveKit/Moss starter: https://github.com/livekit-examples/moss-hacker-starter
- LiveKit hackathon page: https://www.livekit.info/conversational-ai-hackathon
- LiveKit phone numbers: https://docs.livekit.io/telephony/start/phone-numbers/
- LiveKit pricing: https://livekit.com/pricing
- Moss + LiveKit integration: https://docs.moss.dev/docs/integrations/livekit
