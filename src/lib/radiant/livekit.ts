"use client";

import {
  ConnectionState,
  LocalAudioTrack,
  Room,
  RoomEvent,
  createLocalAudioTrack,
} from "livekit-client";
import { createClientLogger } from "@/lib/radiant/client-logger";

const log = createClientLogger("livekit");

export type LiveKitConnectionState = "disconnected" | "connecting" | "connected";

let micTrack: LocalAudioTrack | null = null;

export async function connectLiveKitRoom(
  onStateChange: (state: LiveKitConnectionState) => void,
): Promise<Room | null> {
  onStateChange("connecting");
  log.info("connectLiveKitRoom start");

  const response = await fetch("/api/livekit/token", { method: "POST" });
  log.info("token response", { ok: response.ok, status: response.status });

  if (!response.ok) {
    onStateChange("disconnected");
    log.warn("token fetch failed");
    return null;
  }

  const { token, url } = (await response.json()) as {
    token: string;
    url: string;
  };

  const room = new Room();

  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    log.info("connection state changed", { state });
    if (state === ConnectionState.Connected) {
      onStateChange("connected");
    } else if (state === ConnectionState.Disconnected) {
      onStateChange("disconnected");
    }
  });

  try {
    await room.connect(url, token);
    log.info("room connected (no mic yet)", { roomName: room.name });
    onStateChange("connected");
    return room;
  } catch (error) {
    log.error("room connect failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    onStateChange("disconnected");
    await room.disconnect();
    return null;
  }
}

/** Publish mic after a user gesture — browsers block getUserMedia on page load. */
export async function publishLiveKitMicrophone(room: Room | null): Promise<boolean> {
  if (!room || room.state !== ConnectionState.Connected) {
    log.warn("publishLiveKitMicrophone skipped — room not connected");
    return false;
  }

  const alreadyPublished = room.localParticipant.audioTrackPublications.size > 0;
  if (alreadyPublished || micTrack) {
    log.info("publishLiveKitMicrophone skipped — already published");
    return true;
  }

  try {
    micTrack = await createLocalAudioTrack();
    await room.localParticipant.publishTrack(micTrack);
    log.info("local audio track published after user gesture");
    return true;
  } catch (error) {
    log.warn("mic publish failed (non-fatal)", {
      error: error instanceof Error ? error.message : String(error),
    });
    micTrack = null;
    return false;
  }
}

export async function disconnectLiveKitRoom(room: Room | null): Promise<void> {
  if (!room) return;
  log.info("disconnectLiveKitRoom");

  if (micTrack) {
    micTrack.stop();
    micTrack = null;
  }

  room.removeAllListeners();
  await room.disconnect();
}
