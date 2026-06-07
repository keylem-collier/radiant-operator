# Radiant Operator

Browser voice advisor for founder/operators: talk through paid-media strategy, get funny useful advice out loud, and watch a creative queue fill with ad concepts while the conversation continues.

**Final checklist:** [docs/foundation/v1-final-checklist.md](./docs/foundation/v1-final-checklist.md)

**Production:** https://radiant-operator.vercel.app

## Quick start

```bash
npm install
cp .env.example .env.local   # fill provider keys
npm run dev
```

Open http://localhost:3000

## Demo flow

1. Click **Try demo line** or type a paid-media observation.
2. Advisor replies in transcript + ElevenLabs audio.
3. **Memory found** shows Moss or local corpus context.
4. Toggle to **Queue** for creative cards (Meta, TikTok, Search, guardrails).
5. Optional: **Generate image** or **Start video job** on queue cards.

Use Chrome for mic input. Typed input always works.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run smoke` | Provider smoke test (needs `.env.local`) |
| `npm run moss:index` | Upload `docs/moss-corpus/` to Moss Cloud |

## Stack

- **Next.js** — app + API routes on Vercel
- **ElevenLabs** — agent voice (`eleven_flash_v2_5`)
- **Vertex Gemini** — advisor + creative extraction
- **Moss** — retrieval (local corpus fallback if unindexed)
- **LiveKit** — minimal browser session (optional)
- **Vertex Veo / Gemini Image** — optional generation buttons

## Docs

- [HACKATHON.md](./HACKATHON.md) — narrative and strategy
- [docs/foundation/cursor-v1-build-plan.md](./docs/foundation/cursor-v1-build-plan.md) — V1 slice plan
- [docs/foundation/agent-build-plan.md](./docs/foundation/agent-build-plan.md) — provider decisions
- [docs/foundation/v1-final-checklist.md](./docs/foundation/v1-final-checklist.md) — pre-demo checklist

## Deploy

```bash
npx vercel --prod --yes
```

Set environment variables in Vercel (see `.env.example` and final checklist). Never commit `.env.local`.
