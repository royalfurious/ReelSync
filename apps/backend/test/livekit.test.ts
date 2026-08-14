import { beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '../src/config/env.js';
import { createRoom, joinRoom } from '../src/services/rooms.js';

describe('livekit token service', () => {
  it('uses a valid local LiveKit secret for the configured docker stack', () => {
    expect(env.LIVEKIT_API_KEY).toBe('devkey');
    expect(env.LIVEKIT_API_SECRET).toBeTruthy();
    expect(env.LIVEKIT_API_SECRET?.length ?? 0).toBeGreaterThanOrEqual(32);
    expect(env.LIVEKIT_URL ?? env.NEXT_PUBLIC_LIVEKIT_URL).toBeTruthy();
  });

  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/watch_party_test');
  });

  it('does not connect to a remote database during test runs', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://neondb_owner:secret@ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require');

    const room = createRoom({ hostDisplayName: 'Ava' });

    expect(room.roomId).toBeTypeOf('string');
    expect(room.hostMemberId).toBeTypeOf('string');
  });

  it('creates a token for the host and marks them publish-capable', async () => {
    const room = createRoom({ hostDisplayName: 'Ava' });
    const { createLiveKitToken } = await import('../src/services/livekit.js');

    const token = await createLiveKitToken(room.roomId, room.hostMemberId);

    expect(token).not.toBeNull();
    expect(token?.roomName).toBe(room.roomId);
    expect(token?.identity).toBe(room.hostMemberId);
    expect(token?.canPublish).toBe(true);
    expect(token?.token.length).toBeGreaterThan(0);
  });

  it('disables publish permissions for non-host members', async () => {
    const room = createRoom({ hostDisplayName: 'Ava' });
    const participant = joinRoom({ roomId: room.roomId, displayName: 'Jordan' });
    const { createLiveKitToken } = await import('../src/services/livekit.js');

    const token = await createLiveKitToken(room.roomId, participant?.memberId ?? '');

    expect(token).not.toBeNull();
    expect(token?.canPublish).toBe(false);
  });
});