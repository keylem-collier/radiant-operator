/**
 * Quick provider smoke test (no audio playback).
 *
 * Usage:
 *   node --env-file=.env.local scripts/smoke-providers.mjs
 */

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function smokeElevenLabs() {
  const apiKey = requireEnv("ELEVENLABS_API_KEY");
  const res = await fetch("https://api.elevenlabs.io/v1/user", {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) throw new Error(`ElevenLabs: ${res.status}`);
  console.log("✓ ElevenLabs API key valid");
}

async function smokeGoogle() {
  const { GoogleAuth } = await import("google-auth-library");
  let raw = requireEnv("GOOGLE_CREDENTIALS_JSON").trim();
  try {
    JSON.parse(raw);
  } catch {
    raw = Buffer.from(raw, "base64").toString("utf8");
  }
  const auth = new GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("No Google token");
  console.log("✓ Google credentials valid");

  const projectId = requireEnv("GOOGLE_CLOUD_PROJECT_ID");
  const model = process.env.GEMINI_DIRECTOR_MODEL ?? "gemini-2.5-flash-lite";
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Say hi in 3 words." }] }],
      generationConfig: { maxOutputTokens: 32 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini: ${res.status} ${await res.text()}`);
  console.log(`✓ Gemini ${model} responds`);
}

async function smokeLiveKit() {
  if (!process.env.LIVEKIT_URL) {
    console.log("○ LiveKit skipped (not configured)");
    return;
  }
  requireEnv("LIVEKIT_API_KEY");
  requireEnv("LIVEKIT_API_SECRET");
  console.log("✓ LiveKit env present");
}

async function smokeMoss() {
  if (!process.env.MOSS_PROJECT_ID) {
    console.log("○ Moss skipped (not configured — local corpus fallback active)");
    return;
  }
  const { MossClient } = await import("@moss-dev/moss");
  const client = new MossClient(
    requireEnv("MOSS_PROJECT_ID"),
    requireEnv("MOSS_PROJECT_KEY"),
  );
  const indexes = await client.listIndexes();
  console.log(`✓ Moss connected (${indexes.length} indexes)`);
}

async function main() {
  console.log("Radiant Operator — provider smoke test\n");
  await smokeElevenLabs();
  await smokeGoogle();
  await smokeLiveKit();
  await smokeMoss();
  console.log("\nAll configured providers OK.");
}

main().catch((err) => {
  console.error("\n✗", err.message);
  process.exit(1);
});
