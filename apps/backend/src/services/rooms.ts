import type { ChatMessage, CreateRoomResult, JoinRoomResult, PlaybackState, RoomMemberSummary, RoomSnapshot } from '@watch-party/shared';

import { applyPlaybackCommand, createDefaultPlaybackState, defaultRoomPermissions, projectPlaybackState, type RoomPermissions } from '@watch-party/shared';
import { sanitizeChatMessage } from '@watch-party/shared';

import { createHostToken, createMemberId, createRoomCode } from '../lib/ids.js';
import { randomUUID } from 'node:crypto';
import { persistChatMessage, persistRoomSnapshot } from './room-persistence.js';

export type RoomMemberRecord = RoomMemberSummary & {
  userId: string | null;
  joinedAt: string;
  leftAt: string | null;
};

export type RoomRecord = {
  id: string;
  roomCode: string;
  hostId: string | null;
  hostToken: string;
  status: 'active' | 'ended';
  createdAt: string;
  endedAt: string | null;
  members: Map<string, RoomMemberRecord>;
  playbackState: PlaybackState;
  chatMessages: ChatMessage[];
  permissions: RoomPermissions;
};

type CreateRoomInput = {
  hostDisplayName: string;
  hostUserId?: string | null;
};

type JoinRoomInput = {
  roomId: string;
  displayName: string;
  userId?: string | undefined;
};

const rooms = new Map<string, RoomRecord>();

function toRoomMemberSummary(member: RoomMemberRecord): RoomMemberSummary {
  return {
    id: member.id,
    displayName: member.displayName,
    role: member.role,
    isConnected: member.isConnected
  };
}

export function hydrateRooms(persistedRooms: RoomRecord[]) {
  rooms.clear();

  for (const room of persistedRooms) {
    rooms.set(room.id, room);
  }
}

function toRoomSummary(room: RoomRecord) {
  const now = Date.now();

  return {
    roomId: room.id,
    roomCode: room.roomCode,
    status: room.status,
    createdAt: room.createdAt,
    endedAt: room.endedAt,
    hostId: room.hostId,
    permissions: room.permissions,
    participants: Array.from(room.members.values()).map(toRoomMemberSummary),
    playbackState: projectPlaybackState(room.playbackState, now),
    chatMessages: room.chatMessages
  };
}

export function createRoom(input: CreateRoomInput): CreateRoomResult & { hostMemberId: string } {
  const roomId = randomUUID();
  const roomCode = createRoomCode();
  const hostToken = createHostToken();
  const hostMemberId = createMemberId();

  const room: RoomRecord = {
    id: roomId,
    roomCode,
    hostId: hostMemberId,
    hostToken,
    status: 'active',
    createdAt: new Date().toISOString(),
    endedAt: null,
    playbackState: createDefaultPlaybackState(),
    chatMessages: [],
    permissions: defaultRoomPermissions,
    members: new Map([
      [hostMemberId, {
        id: hostMemberId,
        userId: input.hostUserId ?? null,
        displayName: input.hostDisplayName,
        role: 'host',
        isConnected: true,
        joinedAt: new Date().toISOString(),
        leftAt: null
      }]
    ])
  };

  rooms.set(roomId, room);
  void persistRoomSnapshot(room);

  return {
    roomId,
    roomCode,
    shareUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/room/${roomId}`,
    hostToken,
    hostMemberId
  };
}

export function getRoom(roomId: string) {
  const room = rooms.get(roomId);
  return room ? toRoomSummary(room) : null;
}

export function joinRoom(input: JoinRoomInput): JoinRoomResult | null {
  const room = rooms.get(input.roomId);
  if (!room || room.status !== 'active') {
    return null;
  }

  const memberId = createMemberId();
  room.members.set(memberId, {
    id: memberId,
    userId: input.userId ?? null,
    displayName: input.displayName,
    role: input.userId ? 'participant' : 'guest',
    isConnected: true,
    joinedAt: new Date().toISOString(),
    leftAt: null
  });
  void persistRoomSnapshot(room);

  return {
    roomId: room.id,
    roomCode: room.roomCode,
    memberId,
    displayName: input.displayName
  };
}

export function endRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }

  room.status = 'ended';
  room.endedAt = new Date().toISOString();
  void persistRoomSnapshot(room);

  return toRoomSummary(room);
}

export function transferHost(roomId: string, memberId: string) {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }

  const member = room.members.get(memberId);
  if (!member) {
    return null;
  }

  for (const participant of room.members.values()) {
    if (participant.role === 'host') {
      participant.role = 'participant';
    }
  }

  member.role = 'host';
  room.hostId = member.id;
  void persistRoomSnapshot(room);

  return toRoomSummary(room);
}

export function markMemberDisconnected(roomId: string, memberId: string) {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }

  const member = room.members.get(memberId);
  if (!member) {
    return null;
  }

  member.isConnected = false;
  member.leftAt = new Date().toISOString();
  void persistRoomSnapshot(room);
  return toRoomSummary(room);
}

export function markMemberConnected(roomId: string, memberId: string, displayName?: string) {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }

  const member = room.members.get(memberId);
  if (!member) {
    return null;
  }

  member.isConnected = true;
  member.leftAt = null;
  if (displayName) {
    member.displayName = displayName;
  }

  void persistRoomSnapshot(room);

  return toRoomSummary(room);
}

export function applyRoomPlaybackCommand(roomId: string, command: Parameters<typeof applyPlaybackCommand>[1]) {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'active') {
    return null;
  }

  room.playbackState = applyPlaybackCommand(room.playbackState, command);
  void persistRoomSnapshot(room);
  return toRoomSummary(room);
}

export function setRoomMedia(roomId: string, mediaId: string) {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'active') {
    return null;
  }

  room.playbackState = {
    isPlaying: false,
    currentTime: 0,
    playbackRate: 1,
    updatedAt: Date.now(),
    mediaId
  };

  void persistRoomSnapshot(room);

  return toRoomSummary(room);
}

export function updateRoomPermissions(
  roomId: string,
  permissions: Partial<Pick<RoomPermissions, 'playback' | 'chat' | 'invite' | 'share'>>
) {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'active') {
    return null;
  }

  room.permissions = {
    ...room.permissions,
    ...permissions
  };

  void persistRoomSnapshot(room);

  return toRoomSummary(room);
}

export function appendRoomChatMessage(roomId: string, senderId: string, senderName: string, message: string) {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'active') {
    return null;
  }

  const senderMember = room.members.get(senderId);
  const senderUserId = senderMember?.userId && senderMember.userId.length > 0 ? senderMember.userId : null;
  const normalizedMessage = sanitizeChatMessage(message);
  const chatMessage: ChatMessage = {
    id: randomUUID(),
    roomId,
    senderId: senderUserId,
    senderName,
    message: normalizedMessage,
    createdAt: new Date().toISOString()
  };

  room.chatMessages = [...room.chatMessages, chatMessage].slice(-50);
  void persistChatMessage(chatMessage);
  return chatMessage;
}

export function listRoomMembers(roomId: string): RoomMemberSummary[] {
  const room = rooms.get(roomId);
  return room ? Array.from(room.members.values()).map(toRoomMemberSummary) : [];
}

export function isHost(roomId: string, memberId: string): boolean {
  const room = rooms.get(roomId);
  return room?.hostId === memberId;
}

export function getRoomByCode(roomCode: string) {
  return Array.from(rooms.values()).find((room) => room.roomCode === roomCode) ?? null;
}

export function getRoomRecord(roomId: string): RoomRecord | null {
  return rooms.get(roomId) ?? null;
}

export function getRoomState(roomId: string) {
  const room = rooms.get(roomId);
  return room ? toRoomSummary(room) : null;
}

export function getAllRooms() {
  return Array.from(rooms.values()).map(toRoomSummary);
}

export function getAllRoomRecords() {
  return Array.from(rooms.values());
}

export function getRoomPlaybackState(roomId: string) {
  const room = rooms.get(roomId);
  return room ? projectPlaybackState(room.playbackState, Date.now()) : null;
}

export function getAllRoomSnapshots(): RoomSnapshot[] {
  return getAllRooms();
}