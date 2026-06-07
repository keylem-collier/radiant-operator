# Agent Build Plan

Last updated: June 6, 2026

## Product We Are Building

A funny, casual, voice-first paid-media advisor for founder/operators.

The user talks naturally about customers, campaign problems, daily observations, and growth ideas. The advisor responds out loud with useful strategy. In parallel, a background creative listener turns the conversation into queued ad work: image ad concepts, video prompts, search copy, hooks, and guardrails.

## Narrative Placeholder

Do not overbuild the narrative yet. The working narrative is:

Founders do not think in prompt boxes. They think out loud. This product turns that spoken founder intuition into paid-media strategy and creative production.

## Provider Decisions

### LiveKit

Use for:

- In-app/browser live voice session.
- Session state while user swipes between screens.

Why:

- It is sponsor-aligned.
- It gives the demo a real voice-agent feel without waiting on telephony.
- It pairs directly with the Moss starter.

Decision:

- Do not use the phone-number path for v1. If LiveKit provides the number later, Kane can revisit it, but the hackathon build should not wait on telephony.

### ElevenLabs

Use for:

- The actual agent voice.
- Low-latency spoken responses.

Current config:

- Model: `eleven_flash_v2_5`.
- Initial voice: Laura / quirky attitude voice.

Why:

- Kane has credits.
- Voice quality/personality matters for the demo.
- The agent should feel funny and personable, not like a default assistant.

### Google Vertex AI / Gemini / Veo

Use for:

- Paid-media reasoning and prompt generation.
- Video prompt or generation path.

Current config:

- Project: `ecolyfe`.
- Gemini text model: `gemini-2.5-flash-lite`.
- Gemini image model: `gemini-2.5-flash-image`.
- Veo model target: `veo-3.1-lite-generate-001`.
- Provider flag: `studio`.

Why:

- Gemini 2.5 Flash is fast and capable.
- Veo 3.1 Lite is the current lowest-scope video target for rapid ad concept iteration.
- This aligns with the creative-production part of the product.

Verification notes:

- `gemini-3.1-flash-lite`: official/news sources say it exists, but the Vertex API returned 404 for this project in `us-central1`.
- `gemini-3.1-flash-lite-preview` and likely adjacent IDs also returned 404.
- `gemini-2.5-flash-lite`: Vertex text generation succeeded. Use as fastest verified text fallback.
- `gemini-3.1-flash-image-preview`: official docs list it as supported, but the Vertex API returned 404 for this project in `us-central1`.
- `gemini-3.1-flash-image`: also returned 404 for this project.
- `gemini-2.5-flash-image`: Vertex image generation succeeded and returned both text and image output. Use as verified image fallback.
- `veo-3.1-lite-generate-001`: official Google docs list it as the Lite video model, preview launch stage. Not yet run as a generation job because it may consume video quota/cost.

### Moss

Use for:

- Retrieval from small Markdown-style knowledge/memory files.
- Context about paid media best practices.
- Context about Kane/Versaunt.
- Context about customer/client realities.
- Personal/life context that makes the agent feel like it actually remembers.

Why:

- This makes the product more than a talking prompt box.
- It lets the agent answer from durable context without connecting live ad accounts.
- It gives us a visible sponsor-aligned "memory" moment.
- It supports the hackathon thesis: retrieval/memory is the bottleneck, not voice.

Important distinction:

- The hackathon Moss is the real-time semantic search/retrieval product used by `livekit-examples/moss-hacker-starter`.
- `OpenMOSS/MOSS-Audio` is a separate open-source audio understanding model from OpenMOSS/MOSI. It is not the same as the sponsor's Moss retrieval API.
- If we want to honestly claim sponsor-Moss usage and use the starter pattern, we need `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY`.

Portal setup choice:

- Select **Voice AI** in the Moss onboarding/setup wizard.
- That does not mean Moss handles text-to-speech or the audible voice.
- Moss handles instant context retrieval for the conversational agent.
- ElevenLabs remains the audible voice/TTS provider.

Recommended starter corpus:

- `meta-ads.md`: Meta creative strategy, hooks, common mistakes, account structure.
- `google-ads.md`: Search/PMax strategy, intent mapping, landing-page guidance.
- `versaunt.md`: Versaunt positioning, services, ICP, tone, operating constraints.
- `kane-context.md`: Founder preferences, schedule pressure, personal context, current priorities.
- `customer-patterns.md`: fictionalized but realistic customer objections and insights.

Example memory moment:

Kane says, "I'm fried today, but I need to figure out this client angle." Moss retrieves context that he is taking care of family / grandma and the agent responds with warmth before giving a sharper low-energy plan. That personal recall makes the demo feel alive.

### Providers We Are Not Using

- AWS: unnecessary for the scoped demo.
- TrueFoundry: unnecessary governance/platform layer.
- Unsiloed: no PDF parsing in the first scope.
- Qwen: skip unless needed for sponsor reasons.
- Minimax: skip unless needed for sponsor reasons.
- Meta/Google/TikTok Ads APIs: too much scope for the hackathon demo.

## What We Are Building

### Screen 1: Voice Advisor

Deliverables:

- Glowing orb / live listening state.
- User transcript.
- Agent transcript.
- Audio response through ElevenLabs.
- Casual paid-media advisor persona.
- State remains alive when switching screens.
- Personality: funny strategist friend. Casual, warm, opinionated, quick with jokes, but useful first.

### Screen 2: Creative Queue

Deliverables:

- Swipeable visual surface.
- Queue cards for generated ideas.
- Cards grouped by format: image ad, video ad, search ad, hook, guardrail.
- Cards appear while conversation continues.
- Cards can be generated from transcript and retrieved Moss context.

### Background Creative Listener

Deliverables:

- Reads ongoing transcript.
- Extracts growth insights and creative tasks.
- Creates structured queue jobs.
- Adds jobs one-by-one to avoid rate/race chaos.

Job shape:

```ts
type CreativeJob = {
  id: string;
  sourceTurnId: string;
  status: "queued" | "drafted" | "generating" | "done" | "failed";
  format: "image_ad" | "video_ad" | "search_ad" | "hook" | "guardrail";
  platform: "meta" | "tiktok" | "google_search" | "veo" | "general";
  insight: string;
  prompt: string;
  outputText?: string;
};
```

## What We Are Not Building

- Full ad-account connection.
- Campaign publishing.
- Auth.
- Billing.
- Team/multi-user support.
- Real CRM import.
- Complex persistence.
- PDF ingestion.
- Full multi-agent worker infrastructure.
- A perfect video generation pipeline before the voice/advice/queue loop works.

## Sequential Validation Plan

### Step 1: Environment Validation

Goal: confirm secrets and model identifiers work.

Deliverables:

- `.env.local` contains LiveKit, ElevenLabs, Google/Vertex values.
- Google service account base64 decodes to valid JSON.
- ElevenLabs lists voices/models.
- Official docs confirm model IDs.

### Step 2: Voice Output Validation

Goal: prove ElevenLabs can generate low-latency speech.

Deliverables:

- One local script or route sends text to ElevenLabs.
- Audio file or stream plays locally.
- Confirm chosen voice and model.

### Step 3: Advisor Brain Validation

Goal: prove Gemini can produce the paid-media advisor response.

Deliverables:

- One prompt with system persona.
- One user message.
- One casual, funny, actually useful strategy response.

### Step 4: Moss Context Validation

Goal: prove Moss can retrieve from our small docs.

Deliverables:

- Create starter corpus.
- Index it.
- Query it.
- Return relevant context for a paid-media question.

### Step 5: Creative Listener Validation

Goal: prove a transcript can become queue jobs.

Deliverables:

- Feed transcript turns into extraction prompt.
- Return structured `CreativeJob[]`.
- Render jobs on queue screen.

### Step 6: Integrated Two-Screen Demo

Goal: prove the product loop.

Deliverables:

- Talk to advisor.
- Agent speaks back.
- Transcript updates.
- Creative queue updates.
- Swipe between screens without resetting conversation state.

### Step 7: Optional Real Generation

Goal: generate one real asset if time allows.

Deliverables:

- One real Veo prompt submission or one image ad generation.
- If not stable, show queued prompts and mark actual generation as "ready to run."

## Agent Handoff Instructions

Build in this order. Do not skip ahead to polish or platform features.

1. Validate providers.
2. Build the simplest voice advisor loop.
3. Build the queue extractor.
4. Build the swipe UI.
5. Add Moss memory.
6. Add one real generation only if the loop is already stable.

No new provider or infrastructure should be added unless it replaces a failed provider and is explicitly documented.
