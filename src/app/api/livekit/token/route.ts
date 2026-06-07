import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import { AccessToken, type AccessTokenOptions, type VideoGrant } from "livekit-server-sdk";
import { getLiveKitConfig, hasLiveKitConfig } from "@/lib/radiant/env";
import { createLogger, logRouteError } from "@/lib/radiant/logger";

const log = createLogger("api:livekit");

const USER_COOKIE = "lk_moss_user";
const USER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const AGENT_NAME = process.env.AGENT_NAME ?? "agent-py";

export const revalidate = 0;

async function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  roomConfig?: RoomConfiguration,
): Promise<string> {
  const { apiKey, apiSecret } = getLiveKitConfig();
  const token = new AccessToken(apiKey, apiSecret, {
    ...userInfo,
    ttl: "1h",
  });

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  token.addGrant(grant);

  if (roomConfig) {
    token.roomConfig = roomConfig;
  }

  return token.toJwt();
}

export async function POST() {
  const started = Date.now();
  try {
    if (!hasLiveKitConfig()) {
      log.warn("LiveKit not configured");
      return Response.json(
        { error: "LiveKit is not configured" },
        { status: 503 },
      );
    }

    const { url } = getLiveKitConfig();
    const cookieStore = await cookies();
    let userId = cookieStore.get(USER_COOKIE)?.value;
    const isNewUser = !userId;
    if (!userId) {
      userId = randomUUID();
    }

    const roomName = `radiant-${Date.now()}`;
    const participantIdentity = `operator-${Math.floor(Math.random() * 10_000)}`;
    const participantName = "operator";

    const roomConfig = new RoomConfiguration();
    roomConfig.agents.push(
      new RoomAgentDispatch({
        agentName: AGENT_NAME,
        metadata: JSON.stringify({ user_id: userId }),
      }),
    );

    log.info("POST /api/livekit/token", {
      roomName,
      agentName: AGENT_NAME,
      hasUrl: Boolean(url),
    });

    const jwt = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      roomConfig,
    );

    const response = Response.json({
      token: jwt,
      url,
      roomName,
      participantName,
    });

    if (isNewUser) {
      response.headers.append(
        "Set-Cookie",
        `${USER_COOKIE}=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${USER_COOKIE_MAX_AGE}`,
      );
    }

    log.info("POST /api/livekit/token ok", { ms: Date.now() - started });
    return response;
  } catch (error) {
    logRouteError("api:livekit", error, { ms: Date.now() - started });
    const message = error instanceof Error ? error.message : "Token failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
