import { AccessToken } from 'livekit-server-sdk';

import { env } from '../config/env.js';
import { getRoomRecord } from './rooms.js';

export type LiveKitTokenResult = {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  canPublish: boolean;
};

export async function createLiveKitToken(roomId: string, memberId: string) {
  const room = getRoomRecord(roomId);
  if (!room) {
    return null;
  }

  const member = room.members.get(memberId);
  if (!member) {
    return null;
  }

  const apiKey = env.LIVEKIT_API_KEY ?? 'devkey';
  const apiSecret = env.LIVEKIT_API_SECRET ?? 'devsecret';
  const livekitUrl = env.LIVEKIT_URL ?? env.NEXT_PUBLIC_LIVEKIT_URL ?? 'ws://localhost:7880';
  const token = new AccessToken(apiKey, apiSecret, {
    identity: memberId,
    name: member.displayName
  });

  token.addGrant({
    room: roomId,
    roomJoin: true,
    canPublish: member.role === 'host',
    canSubscribe: true
  });

  return {
    token: await token.toJwt(),
    url: livekitUrl,
    roomName: roomId,
    identity: memberId,
    canPublish: member.role === 'host'
  } satisfies LiveKitTokenResult;
}