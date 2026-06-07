# Radiant Operator V1 — Final Checklist

Last updated: June 6, 2026

Use this before the demo, on stage, or during handoff to the co-founder. Items marked **blocker** must pass. Items marked **need from Kane** require your credentials, decisions, or manual steps. Items marked **nice** improve the demo but are not required for the core loop.

Production URL: https://radiant-operator.vercel.app

Alternate: https://radiant-operator-keylemceo-2045-versaunt.vercel.app

Local: `npm run dev` → http://localhost:3000

---

## 1. Environment variables

### Critical: local `.env.local` ≠ Vercel production

**Your `.env.local` is gitignored and never ships with the deploy.** If you see errors like `Missing required environment variable: GOOGLE_CLOUD_PROJECT_ID` on `radiant-operator.vercel.app`, the vars exist locally but **not on Vercel**.

Sync from your machine:

```bash
npm run vercel:env
npx vercel --prod --yes
```

Verify:

```bash
npx vercel env ls production
```

Should list all provider keys — not "No Environment Variables found".

### Vercel production (need from Kane)

Confirm all of these are set in the Vercel project dashboard for `radiant-operator`. Redeploy after changes.

| Variable | Required for | Notes |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | **blocker** — agent voice | |
| `ELEVENLABS_VOICE_ID` | **blocker** | Laura / quirky voice per agent-build-plan |
| `ELEVENLABS_MODEL_ID` | **blocker** | Default: `eleven_flash_v2_5` |
| `GOOGLE_CLOUD_PROJECT_ID` | **blocker** — advisor + queue | e.g. `ecolyfe` |
| `GOOGLE_CREDENTIALS_JSON` | **blocker** | Service account JSON or base64-encoded JSON |
| `GEMINI_DIRECTOR_MODEL` | **blocker** | Verified: `gemini-2.5-flash-lite` |
| `GEMINI_TWEAKER_MODEL` | **blocker** | Verified: `gemini-2.5-flash-lite` |
| `GEMINI_IMAGE_MODEL` | nice — image generation | Verified: `gemini-2.5-flash-image` |
| `GOOGLE_VEO_MODEL_ID` | nice — video jobs | Default: `veo-3.1-lite-generate-001` |
| `LIVEKIT_URL` | nice — session indicator | App works without; shows disconnected |
| `LIVEKIT_API_KEY` | nice | |
| `LIVEKIT_API_SECRET` | nice | |
| `MOSS_PROJECT_ID` | nice — sponsor retrieval | Without: local corpus fallback |
| `MOSS_PROJECT_KEY` | nice | |
| `MOSS_INDEX_NAME` | nice | Default: `knowledge` |
| `MOSS_MEMORY_INDEX_NAME` | optional | Not used in V1 |
| `MOSS_MODEL_ID` | optional | Default: `moss-minilm` |

**Need from Kane:** paste production env vars into Vercel if not already done. Local `.env.local` is not deployed.

### Local dev

```bash
cp .env.example .env.local
# fill values, then:
npm run dev
```

---

## 2. Provider smoke tests

Run locally with `.env.local` populated:

| Check | How | Pass criteria |
| --- | --- | --- |
| ElevenLabs TTS | Click **Test voice** on advisor screen | Hear spoken sentence |
| Gemini advisor | Type demo line → **Send** | Funny paid-media reply in transcript + audio |
| Creative queue | After 1–2 turns, open **Queue** | 2–5 cards: image, hook, search, guardrail |
| Moss / memory | Send message mentioning intake/dental | **Memory found** panel shows snippets |
| LiveKit | Load advisor screen | Status shows `connected` (or `disconnected` if unset) |
| Browser mic | **Mic** button (Chrome) | Speech → user turn → advisor loop |
| Image gen | Queue → image_ad card → **Generate image** | Image appears (needs `GEMINI_IMAGE_MODEL`) |
| Veo job | Queue → video card → **Start video job** | Status updates (slow; optional live) |

Optional script:

```bash
node --env-file=.env.local scripts/smoke-providers.mjs
```

---

## 3. Moss index (need from Kane — sponsor moment)

V1 ships with **local corpus fallback** (`docs/moss-corpus/*.md`). For real Moss retrieval on stage:

1. Moss portal → Voice AI project → copy `MOSS_PROJECT_ID` + `MOSS_PROJECT_KEY`.
2. Index the corpus:

```bash
node --env-file=.env.local scripts/moss-index-corpus.mjs
```

3. Set `MOSS_INDEX_NAME` to match (default `knowledge`).
4. Redeploy Vercel with Moss env vars.
5. Verify **Memory found (Moss)** label (not "local corpus") on a relevant query.

**Corpus files:**

- `docs/moss-corpus/meta-ads.md`
- `docs/moss-corpus/google-ads.md`
- `docs/moss-corpus/versaunt.md`
- `docs/moss-corpus/kane-context.md`
- `docs/moss-corpus/customer-patterns.md`

**Need from Kane:** run index script once before demo if sponsor Moss moment matters.

---

## 4. Demo script rehearsal

Target line (from build plan):

> "I'm noticing with service businesses that the client thinks they need more leads, but the real bottleneck is intake. If the front desk is drowning, Meta ads just pour gasoline on the problem."

Expected outcome:

| Surface | What the room should see |
| --- | --- |
| Transcript | User turn + casual advisor reply |
| Audio | ElevenLabs speaks the reply |
| Memory | Intake/dental/lead-volume context snippets |
| Queue | Meta image, TikTok hook, Google Search ad, guardrail, optional Veo prompt |

Use **Try demo line** button on advisor screen to paste the line quickly.

Browser: **Chrome** for mic. Keep typed input as backup.

---

## 5. UI / product gaps (nice — Kane polish)

Not blockers; known gaps for post-V1 polish:

- [ ] Real swipe gesture (currently toggle buttons)
- [ ] Radiant motion / micro-emotion / taste pass
- [ ] LiveKit is session-only — no Python agent, no STT from LiveKit Inference
- [ ] No phone-number telephony path
- [ ] No durable queue persistence (refresh clears state)
- [ ] Veo playback may return URI only, not inline video
- [ ] Creative extraction can duplicate if titles differ slightly
- [ ] Safari mic may be unreliable

---

## 6. Architecture decisions (locked for V1)

- Browser voice via Web Speech API + ElevenLabs TTS (not ElevenLabs STT)
- Gemini via Vertex `generateContent` (not Gemini API key alone)
- Veo via `predictLongRunning` + `fetchPredictOperation` (never `generateContent`)
- Moss via `@moss-dev/moss` with lazy import + local fallback
- No auth, billing, ad platform APIs, databases, or multi-agent workers

---

## 7. Build and deploy verification

```bash
npm run lint    # must pass
npm run build   # must pass
git status      # clean before demo
```

Deploy:

```bash
npx vercel --prod --yes
```

**Known build fix:** `@moss-dev/moss` is in `serverExternalPackages` in `next.config.ts` and lazy-loaded in `moss.ts`.

---

## 8. Git / secrets guardrails

Never commit:

- `.env.local`
- service account JSON files
- generated audio, images, or video
- `.vercel/`

`.env.example` is safe to commit (placeholders only).

---

## 9. Definition of done (from build plan)

- [x] Open app in browser
- [x] Talk or type into advisor
- [x] Advisor responds in text + ElevenLabs audio
- [x] Funny casual paid-media personality (prompt-driven)
- [x] Toggle to creative queue without resetting session
- [x] Queue receives structured cards from conversation
- [x] Cards cover image, hook, search, guardrail formats
- [x] Moss queried OR marked pending / local fallback
- [x] `npm run lint` and `npm run build` pass
- [x] Committed and pushed; Vercel production deployed

---

## 10. Need from Kane / co-founder (non-blockers)

| Item | Why | Priority |
| --- | --- | --- |
| Vercel env vars in production | APIs fail silently or 503 without them | **High** |
| Moss index run + credentials | Sponsor-aligned live retrieval | **High** for Moss prize narrative |
| ElevenLabs voice ID confirmation | Personality of demo | Medium |
| Chrome laptop for mic demo | Safari fallback is typed only | Medium |
| Decide: run Veo live on stage? | Quota/latency risk | Low — prompt cards enough |
| Decide: run image gen live? | One card is enough | Medium |
| UI polish pass | Taste / radiance | Post-hackathon |
| LiveKit phone number | Out of V1 scope | Skip unless free number lands |
| Narrative / pitch script | YC interview framing | Parallel track |

---

## 11. Debug logging

Structured logs use the prefix `[radiant:scope]`.

### Browser (Safari / Chrome DevTools → Console)

- All client logs also append to `window.__RADIANT_LOGS__` (last 200 entries).
- In console: `copy(JSON.stringify(window.__RADIANT_LOGS__, null, 2))`
- Verbose debug lines: add `?debug=1` to the URL or set `NEXT_PUBLIC_RADIANT_DEBUG=1`.

Key scopes when voice fails:

| Scope | What it tells you |
| --- | --- |
| `app` | Send → advisor → TTS orchestration |
| `audio` | TTS fetch, blob size, `audio.play()` success/rejection |
| `audio-unlock` | Safari gesture unlock on tap |
| `livekit` | Session connect (unrelated to ElevenLabs voice) |

**Common voice issue:** Safari blocks `audio.play()` after the async Gemini delay. Fix: tap **Test** or **Send** first (unlock runs on gesture). If you see `audio.play() rejected`, that is the cause.

### Vercel server logs

Dashboard → Project → Logs, or:

```bash
npx vercel logs radiant-operator.vercel.app
```

Key scopes:

| Scope | Route |
| --- | --- |
| `api:tts` | `/api/voice/tts` |
| `api:advisor` | `/api/advisor/respond` |
| `elevenlabs` | ElevenLabs upstream |
| `gemini` | Vertex generateContent |
| `api:creative` | Queue extraction |

Local smoke test:

```bash
npm run smoke
```

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "Missing required environment variable" | Env not set on Vercel | Add vars + redeploy |
| Test voice fails | ElevenLabs key/voice | Check dashboard credits + voice ID |
| Advisor 500 | Google credentials or model ID | Verify `GOOGLE_CREDENTIALS_JSON` decodes; use `gemini-2.5-flash-lite` |
| Memory found (local corpus) only | Moss not configured or index missing | Run `scripts/moss-index-corpus.mjs` |
| LiveKit disconnected | Missing LiveKit env | Optional; ignore or add creds |
| Mic does nothing | Non-Chrome or no permission | Use typed input |
| Queue empty | Gemini extract failed or thin conversation | Send longer observation; check logs |
| Vercel build failed on Moss | Should be fixed | Ensure latest `main` with lazy Moss import |
| Image gen 404 | Wrong image model for project | Use `gemini-2.5-flash-image` |

---

## 13. File map (quick reference)

```
src/app/api/
  advisor/respond/     Gemini advisor + Moss context
  creative/extract/    Queue job extraction
  voice/tts/           ElevenLabs
  livekit/token/       Browser session token
  moss/query/          Standalone Moss query
  vertex/image/        Optional image gen
  vertex/veo/          Optional Veo job

src/components/radiant/   UI shell
src/lib/radiant/          Providers, prompts, types
docs/moss-corpus/         Seeded retrieval docs
scripts/                  Moss index + smoke tests
```

---

## 14. Pre-demo 5-minute checklist

1. Open production URL on demo machine (Chrome).
2. Confirm **Test voice** works.
3. Click **Try demo line** → **Send** → hear advisor + see memory.
4. Switch to **Queue** — cards populated.
5. Switch back to **Advisor** — conversation still there.
6. Optional: one image gen button if time.
7. Close extra tabs / notifications.

Good luck. The model is not the magic. The memory is.
