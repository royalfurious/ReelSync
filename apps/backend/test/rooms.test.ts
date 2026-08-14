import { beforeEach, describe, expect, it } from 'vitest';

import { appendRoomChatMessage, createRoom, endRoom, getRoom, joinRoom, transferHost } from '../src/services/rooms.js';

describe('room service', () => {
  beforeEach(() => {
    // The service currently uses in-memory state; each test uses unique room IDs.
  });

  it('creates a room and resolves it by id', () => {
    const room = createRoom({ hostDisplayName: 'Ava' });

    expect(room.roomId).toBeTypeOf('string');
    expect(room.hostMemberId).toBeTypeOf('string');
    expect(getRoom(room.roomId)?.roomCode).toBe(room.roomCode);
  });

  it('supports joining, host transfer, and ending', () => {
    const room = createRoom({ hostDisplayName: 'Ava' });
    const member = joinRoom({ roomId: room.roomId, displayName: 'Jordan' });

    expect(member).not.toBeNull();

    const updated = transferHost(room.roomId, member?.memberId ?? '');
    expect(updated?.hostId).toBe(member?.memberId);

    const ended = endRoom(room.roomId);
    expect(ended?.status).toBe('ended');
  });

  it('stores recent chat messages with room-local validation', () => {
    const room = createRoom({ hostDisplayName: 'Ava' });
    const member = joinRoom({ roomId: room.roomId, displayName: 'Jordan' });

    expect(member).not.toBeNull();

    const message = appendRoomChatMessage(room.roomId, member?.memberId ?? '', 'Jordan', 'Hello room');
    expect(message?.message).toBe('Hello room');
    expect(getRoom(room.roomId)?.chatMessages).toHaveLength(1);
  });
});