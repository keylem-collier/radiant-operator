import { GoogleAuth } from "google-auth-library";
import { createLogger } from "@/lib/radiant/logger";

const log = createLogger("google-auth");

const SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];

function decodeCredentialsJson(raw: string): object {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as object;
  } catch {
    log.info("decoding base64 credentials JSON");
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    return JSON.parse(decoded) as object;
  }
}

let authClient: GoogleAuth | null = null;

function getAuthClient(credentialsJson: string): GoogleAuth {
  if (!authClient) {
    authClient = new GoogleAuth({
      credentials: decodeCredentialsJson(credentialsJson),
      scopes: SCOPES,
    });
    log.info("GoogleAuth client initialized");
  }
  return authClient;
}

export async function getGoogleAccessToken(credentialsJson: string): Promise<string> {
  const client = getAuthClient(credentialsJson);
  const token = await client.getAccessToken();
  if (!token) {
    log.error("getAccessToken returned empty");
    throw new Error("Failed to obtain Google access token");
  }
  log.debug("access token obtained");
  return token;
}
