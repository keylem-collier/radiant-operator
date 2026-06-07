# Cursor V1 Build Plan: Radiant Operator

Last updated: June 6, 2026

## Purpose

This document is the handoff plan for Cursor Composer / Agent to build V1 of **Radiant Operator**.

Radiant Operator is a browser-based voice advisor for founder/operators. The user talks casually about customer learnings, campaign problems, and paid-media strategy. The agent responds out loud with a funny, useful paid-media strategist personality. While the conversation continues, a background listener extracts creative opportunities and queues ad concepts, video prompts, search copy, hooks, and positioning guardrails.

This is hackathon code. Build the smallest believable demo loop. Do not build an enterprise platform.

## Required Reading Before Any Code

Cursor must read these files before editing:

1. [HACKATHON.md](../../HACKATHON.md)
2. [docs/foundation/agent-build-plan.md](./agent-build-plan.md)
3. [docs/foundation/livekit-moss-starter.md](./livekit-moss-starter.md)
4. [docs/foundation/vertex-veo-integration.md](./vertex-veo-integration.md)
5. [.env.example](../../.env.example)
6. [AGENTS.md](../../AGENTS.md)

Keep referencing these during implementation. In particular:

- Use `agent-build-plan.md` for product scope, providers, and non-goals.
- Use `livekit-moss-starter.md` for the Moss + LiveKit memory/event pattern.
- Use `vertex-veo-integration.md` for Google/Veo API shape. Do not improvise Veo endpoints.
- Use `HACKATHON.md` for product/narrative intent.

## Research Notes For Working With Cursor Agents

This plan follows current Cursor guidance:

- Cursor recommends planning before coding. Plan Mode has the agent inspect relevant files, ask clarifying questions, create an implementation plan with file paths, and wait for approval before implementation.
- Cursor recommends saving plans as Markdown in the workspace so future agents have durable context.
- Cursor recommends keeping rules/context focused. Do not dump unrelated docs into the model; give exact files and let the agent search when needed.
- Cursor recommends starting a new conversation when moving to a different feature, when the agent repeats errors, or after completing a logical unit.
- Cursor's Composer work emphasizes real-world usefulness beyond functional correctness: code quality, readability, latency, cost, and interactive behavior matter.

Sources:

- Cursor Agent Best Practices: https://cursor.com/es/blog/agent-best-practices
- Cursor Rules docs: https://docs.cursor.com/context/rules-for-ai
- Cursor Agent/Modes docs: https://docs.cursor.com/agent
- Composer 2 Technical Report: https://cursor.com/resources/Composer2.pdf

## Non-Negotiable Constraints

1. **Do not run `npm run build` until the final verification slice.**
2. **After each completed slice, commit and push.**
3. **Never commit `.env.local`, secrets, API keys, service account JSON, generated audio, generated images, generated video, or `.vercel/`.**
4. **Keep the app single-user and demo-only.**
5. **Prefer one clear working loop over many half-wired providers.**
6. **Do not build auth.**
7. **Do not build billing.**
8. **Do not connect Meta Ads, Google Ads, TikTok Ads, CRM, email, or production Versaunt data.**
9. **Do not build full multi-agent infrastructure.**
10. **Do not build queues with durable databases, Redis, background workers, or cron.**
11. **Do not build phone-number telephony. Browser/in-app voice only.**
12. **Do not use AWS, TrueFoundry, Unsiloed, Qwen, Minimax, or OpenMOSS/MOSS-Audio.**
13. **Do not replace the whole app with the LiveKit/Moss starter. Use it as implementation reference only.**
14. **Do not over-design the UI. Kane will personally polish later.**
15. **Do not chase unverified Gemini 3.1 model IDs unless Kane provides exact working env/context. Use current `.env.local` values.**

## Provider Contract

Use these providers in V1:

1. **LiveKit**
   - Purpose: browser/in-app realtime voice session feel.
   - V1 usage: minimal session/token wiring or local voice session surface.
   - Do not wait for phone number.

2. **ElevenLabs**
   - Purpose: audible agent voice.
   - Env:
     - `ELEVENLABS_API_KEY`
     - `ELEVENLABS_VOICE_ID`
     - `ELEVENLABS_MODEL_ID`
   - Current model target: `eleven_flash_v2_5`.

3. **Google Vertex AI / Gemini**
   - Purpose: paid-media advisor brain and creative job extraction.
   - Env:
     - `GOOGLE_CLOUD_PROJECT_ID`
     - `GOOGLE_CREDENTIALS_JSON`
     - `GEMINI_TWEAKER_MODEL`
     - `GEMINI_DIRECTOR_MODEL`
     - `GEMINI_IMAGE_MODEL`
   - Current verified text fallback: `gemini-2.5-flash-lite`.
   - Current verified image fallback: `gemini-2.5-flash-image`.

4. **Google Vertex AI / Veo**
   - Purpose: optional video generation path.
   - Env:
     - `GOOGLE_VEO_MODEL_ID`
     - `VEO_PROVIDER`
   - Do not use `generateContent` for Veo. Use `predictLongRunning` and `fetchPredictOperation`.
   - V1 may stop at Veo prompt cards if video generation is slow.

5. **Moss**
   - Purpose: real-time retrieval/memory from small Markdown-style context docs.
   - Env:
     - `MOSS_PROJECT_ID`
     - `MOSS_PROJECT_KEY`
     - `MOSS_INDEX_NAME`
     - `MOSS_MEMORY_INDEX_NAME`
     - `MOSS_MODEL_ID`
   - Moss does not handle TTS. ElevenLabs does.
   - Use Moss as context retrieval, not audio model.

## V1 Definition Of Done

V1 is done when:

1. User can open the app in the browser.
2. User can talk or type a turn into the advisor.
3. The advisor responds in text and audio using ElevenLabs.
4. The response is funny, casual, and useful for paid-media strategy.
5. The user can swipe/toggle to the creative queue screen without resetting conversation state.
6. The creative queue receives structured cards generated from the conversation.
7. Cards include at least:
   - one Meta image ad concept,
   - one TikTok/video hook,
   - one Google Search ad idea,
   - one positioning guardrail.
8. Moss context is either:
   - actually queried from the Moss index, or
   - explicitly marked as pending if the Moss API shape blocks progress.
9. The final app passes `npm run lint` and `npm run build`.
10. Final changes are committed and pushed.

## Architecture: Keep It Tiny

Build in the existing Next.js App Router app. Use TypeScript. Do not create a backend service unless absolutely required.

Recommended file structure:

```txt
src/
  app/
    api/
      advisor/
        respond/
          route.ts
      creative/
        extract/
          route.ts
      voice/
        tts/
          route.ts
      vertex/
        image/
          route.ts        # optional after core loop works
        veo/
          route.ts        # optional after core loop works
      livekit/
        token/
          route.ts        # optional/minimal LiveKit browser session
    page.tsx
  components/
    radiant/
      radiant-app.tsx
      voice-advisor-screen.tsx
      creative-queue-screen.tsx
      glowing-orb.tsx
      transcript-panel.tsx
      creative-job-card.tsx
      screen-switcher.tsx
  lib/
    radiant/
      types.ts
      prompts.ts
      env.ts
      elevenlabs.ts
      google-auth.ts
      gemini.ts
      moss.ts
      creative-jobs.ts
      demo-context.ts
```

If time is extremely tight, collapse components into fewer files. Do not add abstractions just to look clean.

## Shared Types

Create `src/lib/radiant/types.ts`.

Use these low-scope shapes:

```ts
export type Speaker = "user" | "advisor";

export type TranscriptTurn = {
  id: string;
  speaker: Speaker;
  text: string;
  createdAt: number;
};

export type CreativeFormat =
  | "image_ad"
  | "video_prompt"
  | "search_ad"
  | "hook"
  | "guardrail";

export type CreativePlatform =
  | "meta"
  | "tiktok"
  | "google_search"
  | "veo"
  | "general";

export type CreativeJobStatus =
  | "queued"
  | "drafted"
  | "generating"
  | "done"
  | "failed";

export type CreativeJob = {
  id: string;
  sourceTurnId: string;
  status: CreativeJobStatus;
  format: CreativeFormat;
  platform: CreativePlatform;
  title: string;
  insight: string;
  prompt: string;
  outputText?: string;
  createdAt: number;
};

export type AdvisorResponse = {
  advisorText: string;
  mossContext?: string[];
  creativeJobs: CreativeJob[];
};
```

Do not add databases or persistent schemas.

## Prompt Contracts

Create `src/lib/radiant/prompts.ts`.

### Advisor System Prompt

The advisor should be:

- funny paid-media strategist friend,
- casual and conversational,
- opinionated,
- useful first, jokes second,
- good at Meta, Google Search, TikTok, creative strategy, offers, hooks, landing pages, and founder/operator tradeoffs.

Hard rules:

- Do not sound corporate.
- Do not over-explain.
- Do not mention internal provider names.
- Do not claim to publish ads.
- Do not claim live account access.
- Ask one sharp follow-up when needed.
- When Moss context is available, weave it in naturally.

### Creative Extraction Prompt

The extractor should:

- read recent transcript turns,
- identify customer insights, paid-media angles, objections, hooks, offer ideas, platform ideas, and guardrails,
- return JSON only,
- produce 2 to 5 jobs max per extraction,
- avoid duplicates.

Output shape:

```json
{
  "jobs": [
    {
      "format": "image_ad",
      "platform": "meta",
      "title": "Front Desk Bottleneck",
      "insight": "The client does not need more leads until intake is fixed.",
      "prompt": "Create a Meta image ad concept..."
    }
  ]
}
```

If JSON parsing fails, return an empty jobs array and keep the conversation working.

## Final Checklist

Pre-demo verification: [v1-final-checklist.md](./v1-final-checklist.md)

## Slice Plan

### Slice 0: Preflight And Guardrails

Goal: make sure Cursor starts clean and does not leak secrets.

Tasks:

1. Run `git status --short --branch`.
2. Confirm `.env.local` is ignored with `git check-ignore -v .env.local`.
3. Read all required docs listed above.
4. Do not run `npm run build`.
5. Do not modify provider docs unless the implementation discovers a real mismatch.

Completion:

- Commit only if files were changed.
- Push if committed.

Suggested commit message:

```txt
Docs: confirm Radiant Operator V1 guardrails
```

### Slice 1: Install Minimal Dependencies

Goal: add only packages required for V1.

Likely dependencies:

```txt
livekit-client
livekit-server-sdk
google-auth-library
```

Do not install:

- UI libraries,
- animation libraries,
- database packages,
- auth packages,
- queue packages,
- campaign API SDKs,
- unrelated AI SDKs unless they directly reduce code.

Tasks:

1. Install dependencies with npm.
2. Update `package.json` and `package-lock.json`.
3. Do not run build.
4. Do not add code yet unless dependency import testing requires a tiny helper.

Completion:

```shell
git add package.json package-lock.json
git commit -m "V1: add minimal runtime dependencies"
git push
```

### Slice 2: Core Types, Env Helper, Prompts

Goal: create the typed contract before UI/API work.

Files:

- `src/lib/radiant/types.ts`
- `src/lib/radiant/env.ts`
- `src/lib/radiant/prompts.ts`

Tasks:

1. Add types from this plan.
2. Add an env helper that reads server-only env vars.
3. Env helper must throw clear errors on server routes when a required key is missing.
4. Env helper must never expose secrets to client components.
5. Add advisor and creative extraction prompts.
6. Keep prompts concise. No 2,000-word system prompts.

Completion:

```shell
git add src/lib/radiant
git commit -m "V1: add Radiant core contracts"
git push
```

### Slice 3: Static Two-Screen UI With Mock Data

Goal: prove the visual/product shape before wiring providers.

Files:

- `src/app/page.tsx`
- `src/components/radiant/radiant-app.tsx`
- `src/components/radiant/voice-advisor-screen.tsx`
- `src/components/radiant/creative-queue-screen.tsx`
- `src/components/radiant/glowing-orb.tsx`
- `src/components/radiant/transcript-panel.tsx`
- `src/components/radiant/creative-job-card.tsx`
- `src/components/radiant/screen-switcher.tsx`

Tasks:

1. Replace the current placeholder homepage with the Radiant app.
2. Use a client component for app state.
3. Create two screens:
   - advisor screen,
   - creative queue screen.
4. Use a simple toggle or swipe-like button first. Real gesture polish can wait.
5. Maintain transcript and queue state in the top-level client component.
6. Add mock transcript turns.
7. Add mock creative jobs.
8. Create a glowing orb with CSS only.
9. Keep cards readable and clean.
10. Do not use nested cards inside cards.
11. Do not build a landing page.
12. Do not over-animate.

Completion:

```shell
git add src/app/page.tsx src/components/radiant
git commit -m "V1: add two-screen Radiant demo UI"
git push
```

### Slice 4: ElevenLabs TTS Route

Goal: prove the agent can speak through ElevenLabs.

Files:

- `src/app/api/voice/tts/route.ts`
- `src/lib/radiant/elevenlabs.ts`

Tasks:

1. Add a POST route accepting `{ text: string }`.
2. Call ElevenLabs TTS using:
   - `ELEVENLABS_API_KEY`,
   - `ELEVENLABS_VOICE_ID`,
   - `ELEVENLABS_MODEL_ID`.
3. Return audio as `audio/mpeg` or the content type returned by ElevenLabs.
4. Keep request body tiny.
5. Add defensive errors for missing env.
6. Do not store generated audio.
7. Do not add ElevenLabs SDK unless fetch is painful.
8. Add a tiny UI button in the advisor screen to test speaking one hardcoded sentence.

Manual validation:

- Use the UI test button or `curl` to verify audio returns.
- Do not run build.

Completion:

```shell
git add src/app/api/voice src/lib/radiant/elevenlabs.ts src/components/radiant src/app/page.tsx
git commit -m "V1: wire ElevenLabs speech output"
git push
```

### Slice 5: Gemini Advisor Route

Goal: produce one useful paid-media advisor response.

Files:

- `src/app/api/advisor/respond/route.ts`
- `src/lib/radiant/google-auth.ts`
- `src/lib/radiant/gemini.ts`

Tasks:

1. Use `GOOGLE_CREDENTIALS_JSON` and `GOOGLE_CLOUD_PROJECT_ID`.
2. Decode base64 credentials if needed.
3. Use `google-auth-library` for access tokens.
4. Call Vertex `generateContent` for `GEMINI_DIRECTOR_MODEL`.
5. Request text only.
6. Input:
   - recent transcript turns,
   - optional current user text,
   - optional Moss context strings.
7. Output:
   - `{ advisorText: string }`.
8. Enforce short, casual paid-media strategist style.
9. Add a UI send button / typed input that posts to this route and appends advisor text to transcript.
10. After advisor text returns, call `/api/voice/tts` and play the audio.

Do not:

- stream text,
- stream audio,
- add tool calling,
- add retries beyond one simple retry,
- add complex chat history management.

Completion:

```shell
git add src/app/api/advisor src/lib/radiant/google-auth.ts src/lib/radiant/gemini.ts src/components/radiant src/app/page.tsx
git commit -m "V1: add Gemini paid-media advisor loop"
git push
```

### Slice 6: Creative Extraction And Queue

Goal: turn conversation into creative jobs.

Files:

- `src/app/api/creative/extract/route.ts`
- `src/lib/radiant/creative-jobs.ts`
- `src/components/radiant/creative-queue-screen.tsx`
- `src/components/radiant/creative-job-card.tsx`

Tasks:

1. Add route accepting `{ turns: TranscriptTurn[], existingJobTitles?: string[] }`.
2. Use Gemini text model `GEMINI_TWEAKER_MODEL`.
3. Ask for strict JSON only.
4. Parse JSON defensively.
5. Return 2 to 5 jobs max.
6. Deduplicate by title/insight.
7. In UI, after each user turn or advisor turn, call extraction route.
8. Append new jobs to queue.
9. Make queue cards visibly appear as the conversation continues.
10. Mark generated cards as `drafted`, not `done`.

Do not:

- generate actual images/videos yet,
- add persistent queues,
- add background workers,
- run extraction on every keystroke,
- block the advisor response on creative extraction.

Completion:

```shell
git add src/app/api/creative src/lib/radiant/creative-jobs.ts src/components/radiant
git commit -m "V1: generate creative queue from conversation"
git push
```

### Slice 7: Browser Voice Input

Goal: let Kane talk instead of only type.

Files:

- `src/components/radiant/voice-advisor-screen.tsx`
- optional `src/lib/radiant/browser-speech.ts`

Tasks:

1. Use the browser SpeechRecognition API if available.
2. Add a clear fallback text input if SpeechRecognition is unavailable.
3. Add mic/listening state to the glowing orb.
4. On final transcript, append a user turn and send it through the advisor loop.
5. Keep this browser-only. Do not add server STT.
6. Do not add recording upload.
7. Do not add ElevenLabs STT unless browser transcription fails badly.

Important:

- Browser speech recognition may work better in Chrome than Safari.
- Keep typed input visible as the reliable fallback.

Completion:

```shell
git add src/components/radiant src/lib/radiant
git commit -m "V1: add browser voice input"
git push
```

### Slice 8: Minimal LiveKit Browser Session

Goal: use LiveKit without bloating the app.

Files:

- `src/app/api/livekit/token/route.ts`
- optional `src/lib/radiant/livekit.ts`
- `src/components/radiant/voice-advisor-screen.tsx`

Tasks:

1. Add a token route using `livekit-server-sdk`.
2. Token route reads:
   - `LIVEKIT_URL`,
   - `LIVEKIT_API_KEY`,
   - `LIVEKIT_API_SECRET`.
3. Client connects with `livekit-client`.
4. Publish local audio track if simple.
5. Show connection state in the UI:
   - disconnected,
   - connecting,
   - connected.
6. Keep existing browser SpeechRecognition and ElevenLabs playback.
7. Do not add phone number.
8. Do not add LiveKit Python agent.
9. Do not add remote participants.
10. Do not add screen share/video.

If this slice takes more than 90 minutes:

- stop,
- commit what works,
- leave a note in the doc,
- continue with the non-LiveKit browser voice loop.

Completion:

```shell
git add src/app/api/livekit src/lib/radiant src/components/radiant
git commit -m "V1: add minimal LiveKit browser session"
git push
```

### Slice 9: Moss Context Retrieval

Goal: make the advisor feel like it remembers context.

Files:

- `docs/moss-corpus/meta-ads.md`
- `docs/moss-corpus/google-ads.md`
- `docs/moss-corpus/versaunt.md`
- `docs/moss-corpus/kane-context.md`
- `docs/moss-corpus/customer-patterns.md`
- `src/lib/radiant/moss.ts`
- optional `src/app/api/moss/query/route.ts`

Tasks:

1. Create small Markdown corpus docs. Keep each under ~800 words.
2. Include memorable demo context:
   - Kane likes funny, direct advice.
   - Kane is building Versaunt.
   - Founder/operators are busy and need leverage.
   - Paid-media customers often think they need more leads when the real bottleneck is intake, offer, follow-up, or landing page.
   - Meta creative should lead with pain/hook.
   - Google Search copy should map to high intent.
3. Inspect Moss docs / starter before coding the API wrapper.
4. Use `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, `MOSS_INDEX_NAME`.
5. Query Moss before advisor responses when possible.
6. Pass top snippets into the advisor prompt.
7. Render a tiny "Memory found" section in the advisor screen.

If Moss indexing/API shape blocks progress:

- Do not spend more than 60 minutes.
- Implement local fallback retrieval over `docs/moss-corpus/*.md`.
- Mark Moss integration as pending in the UI and docs.
- Continue building the demo.

Do not:

- build a complex ingestion pipeline,
- upload PDFs,
- sync files automatically,
- create multiple indexes unless needed,
- expose Moss keys client-side.

Completion:

```shell
git add docs/moss-corpus src/lib/radiant/moss.ts src/app/api/moss src/components/radiant
git commit -m "V1: add paid-media context retrieval"
git push
```

### Slice 10: Optional Gemini Image Generation

Goal: generate one real image ad only if the core loop already works.

Files:

- `src/app/api/vertex/image/route.ts`
- `src/components/radiant/creative-job-card.tsx`

Tasks:

1. Use `GEMINI_IMAGE_MODEL`.
2. Accept one `CreativeJob`.
3. Generate one image from the job prompt.
4. Return base64 or data URL to the client.
5. Show generated image in the card.
6. Add a per-card "Generate image" button.

Do not:

- auto-generate every card,
- store generated images,
- add batch generation,
- create download/share flows.

Completion:

```shell
git add src/app/api/vertex/image src/components/radiant
git commit -m "V1: add optional image ad generation"
git push
```

### Slice 11: Optional Veo Prompt Or Video Job

Goal: add Veo path without risking the demo.

Files:

- `src/app/api/vertex/veo/route.ts`
- `src/components/radiant/creative-job-card.tsx`

Tasks:

1. Read `docs/foundation/vertex-veo-integration.md` again.
2. Do not use `generateContent`.
3. Use `predictLongRunning` to start.
4. Use `fetchPredictOperation` to poll.
5. Keep one button: "Start video job".
6. Show operation status.
7. If this is too slow or quota-risky, do not run it live. Show the Veo prompt card only.

Do not:

- block the conversation on video generation,
- auto-run Veo,
- run many jobs,
- implement durable polling,
- spend time on perfect video playback.

Completion:

```shell
git add src/app/api/vertex/veo src/components/radiant
git commit -m "V1: add optional Veo job path"
git push
```

### Slice 12: Final Verification And Deploy

Goal: only now run full verification.

Tasks:

1. Run `npm run lint`.
2. Run `npm run build`.
3. Fix only blocking errors.
4. Do not add new features.
5. Commit final fixes.
6. Push.
7. Deploy to Vercel production.

Completion:

```shell
npm run lint
npm run build
git status --short
git add <changed files>
git commit -m "V1: finalize Radiant Operator demo"
git push
npx vercel --prod --yes
```

## Cursor Prompt To Use

Paste this into Cursor:

```txt
Build Radiant Operator V1 from docs/foundation/cursor-v1-build-plan.md.

Read these first:
- HACKATHON.md
- docs/foundation/agent-build-plan.md
- docs/foundation/livekit-moss-starter.md
- docs/foundation/vertex-veo-integration.md
- .env.example
- AGENTS.md

Follow the slice plan exactly. This is hackathon code, not enterprise code.

Rules:
- Do not run npm run build until Slice 12.
- After each completed slice, commit and push.
- Never commit .env.local or secrets.
- Do not add auth, billing, databases, campaign APIs, phone number, full multi-agent infra, or platform integrations.
- If a provider blocks progress for more than the timebox in the plan, implement the fallback and keep going.
- Keep the UI simple and functional; Kane will polish later.

Start at Slice 0. Before editing, summarize the files you inspected and the first slice you are executing.
```

## Cursor Review Checklist After Each Slice

Before committing each slice, Cursor should answer:

1. What changed?
2. Which files changed?
3. Did I accidentally add scope?
4. Did I avoid `.env.local` and secrets?
5. Did I avoid `npm run build`?
6. Is the next slice still unblocked?

If the answer to "Did I accidentally add scope?" is yes, revert the extra work before committing.

## Final Demo Script Target

Kane says:

> "I'm noticing with service businesses that the client thinks they need more leads, but the real bottleneck is intake. If the front desk is drowning, Meta ads just pour gasoline on the problem."

The advisor replies with funny paid-media strategy.

The creative queue fills with:

- Meta image concept: "More leads won't fix a broken intake process."
- TikTok hook: "Your ads aren't failing. Your follow-up is."
- Google Search ad: "Fix Lead Intake Before Scaling Ads."
- Veo prompt: a short cinematic concept showing ringing phones turning into a calm, organized intake flow.
- Guardrail: do not sell raw lead volume; sell controlled growth.

That is the V1 magic. Build only enough to make that loop happen.
