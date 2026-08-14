import { asc, eq } from 'drizzle-orm';

import { createDatabaseClient, chatMessages as chatMessagesTable, roomMembers as roomMembersTable, rooms as roomsTable } from '@watch-party/db';
import { createDefaultPlaybackState, defaultRoomPermissions, type RoomPermissions } from '@watch-party/shared';

import type { ChatMessage, PlaybackState, RoomMemberSummary } from '@watch-party/shared';
import type { RoomMemberRecord, RoomRecord } from './rooms.js';

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

let databaseClient: DatabaseClient | null = null;
let databaseClientKey: string | null = null;

function getDatabaseClient(): DatabaseClient | null {
  const connectionString = process.env.DATABASE_URL;
  if (process.env.NODE_ENV === 'test' || !connectionString) {
    return null;
  }

  if (!databaseClient || databaseClientKey !== connectionString) {
    databaseClient = createDatabaseClient(connectionString);
    databaseClientKey = connectionString;
  }

  return databaseClient;
}

function serializePermissions(permissions: RoomPermissions): string {
  return JSON.stringify(permissions);
}

function deserializePermissions(value: string | null | undefined): RoomPermissions {
  if (!value) {
    return defaultRoomPermissions;
  }

  try {
    return JSON.parse(value) as RoomPermissions;
  } catch {
    return defaultRoomPermissions;
  }
}

function serializePlaybackState(playbackState: PlaybackState): string {
  return JSON.stringify(playbackState);
}

function deserializePlaybackState(value: string | null | undefined): PlaybackState {
  if (!value) {
    return createDefaultPlaybackState();
  }

  try {
    return JSON.parse(value) as PlaybackState;
  } catch {
    return createDefaultPlaybackState();
  }
}

function toMemberRecord(member: {
  id: string;
  userId: string | null;
  displayName: string;
  role: RoomMemberSummary['role'];
  isConnected: boolean;
  joinedAt: Date;
  leftAt: Date | null;
}): RoomMemberRecord {
  return {
    id: member.id,
    userId: member.userId,
    displayName: member.displayName,
    role: member.role,
    isConnected: member.isConnected,
    joinedAt: member.joinedAt.toISOString(),
    leftAt: member.leftAt ? member.leftAt.toISOString() : null
  };
}

export async function loadPersistedRooms(): Promise<RoomRecord[]> {
  const database = getDatabaseClient();
  if (!database) {
    return [];
  }

  const roomRows = await database.select().from(roomsTable);
  const records: RoomRecord[] = [];

  for (const roomRow of roomRows) {
    const memberRows = await database.select().from(roomMembersTable).where(eq(roomMembersTable.roomId, roomRow.id)).orderBy(asc(roomMembersTable.joinedAt));
    const chatRows = await database.select().from(chatMessagesTable).where(eq(chatMessagesTable.roomId, roomRow.id)).orderBy(asc(chatMessagesTable.createdAt));

    records.push({
      id: roomRow.id,
      roomCode: roomRow.roomCode,
      hostId: roomRow.hostMemberId,
      hostToken: 'persisted',
      status: roomRow.status,
      createdAt: roomRow.createdAt.toISOString(),
      endedAt: roomRow.endedAt ? roomRow.endedAt.toISOString() : null,
      permissions: deserializePermissions(roomRow.permissions),
      playbackState: deserializePlaybackState(roomRow.playbackState),
      members: new Map(memberRows.map((memberRow) => [memberRow.id, toMemberRecord(memberRow)])),
      chatMessages: chatRows.map((chatRow) => ({
        id: chatRow.id,
        roomId: chatRow.roomId,
        senderId: chatRow.senderId,
        senderName: chatRow.senderName,
        message: chatRow.message,
        createdAt: chatRow.createdAt.toISOString()
      }))
    });
  }

  return records;
}

export async function persistRoomSnapshot(room: RoomRecord): Promise<void> {
  const database = getDatabaseClient();
  if (!database) {
    return;
  }

  const hostMemberId = room.hostId ?? room.members.keys().next().value ?? room.id;

  await database.transaction(async (transaction) => {
    await transaction
      .insert(roomsTable)
      .values({
        id: room.id,
        roomCode: room.roomCode,
        hostMemberId,
        hostId: null,
        status: room.status,
        permissions: serializePermissions(room.permissions),
        playbackState: serializePlaybackState(room.playbackState),
        createdAt: new Date(room.createdAt),
        endedAt: room.endedAt ? new Date(room.endedAt) : null
      })
      .onConflictDoUpdate({
        target: roomsTable.id,
        set: {
          roomCode: room.roomCode,
          hostMemberId,
          status: room.status,
          permissions: serializePermissions(room.permissions),
          playbackState: serializePlaybackState(room.playbackState),
          endedAt: room.endedAt ? new Date(room.endedAt) : null
        }
      });

    for (const member of room.members.values()) {
      await transaction
        .insert(roomMembersTable)
        .values({
          id: member.id,
          roomId: room.id,
          userId: member.userId,
          displayName: member.displayName,
          role: member.role,
          isConnected: member.isConnected,
          joinedAt: new Date(member.joinedAt),
          leftAt: member.leftAt ? new Date(member.leftAt) : null
        })
        .onConflictDoUpdate({
          target: roomMembersTable.id,
          set: {
            displayName: member.displayName,
            role: member.role,
            isConnected: member.isConnected,
            userId: member.userId,
            leftAt: member.leftAt ? new Date(member.leftAt) : null
          }
        });
    }
  });
}

export async function persistChatMessage(message: ChatMessage): Promise<void> {
  const database = getDatabaseClient();
  if (!database) {
    return;
  }

  try {
    await database.insert(chatMessagesTable).values({
      id: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      senderName: message.senderName,
      message: message.message,
      createdAt: new Date(message.createdAt)
    });
  } catch (error) {
    console.warn('Skipping chat persistence for invalid sender relation:', error);
  }
}