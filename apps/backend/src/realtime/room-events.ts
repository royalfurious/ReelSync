import type { Server } from 'socket.io';

import type { RoomSnapshot, RoomSyncClientEvents, RoomSyncServerEvents } from '@watch-party/shared';

let realtimeServer: Server<RoomSyncClientEvents, RoomSyncServerEvents> | null = null;

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

export function setRealtimeServer(server: Server<RoomSyncClientEvents, RoomSyncServerEvents> | null) {
  realtimeServer = server;
}

export function emitRoomEnded(roomId: string) {
  realtimeServer?.to(roomChannel(roomId)).emit('room:ended', { roomId });
}

export function emitRoomStateSync(roomId: string, room: RoomSnapshot) {
  realtimeServer?.to(roomChannel(roomId)).emit('room:state', room);
}