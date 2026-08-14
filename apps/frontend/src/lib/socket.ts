import { io, type Socket } from 'socket.io-client';

import type { RoomSyncClientEvents, RoomSyncServerEvents } from '@watch-party/shared';

export type RoomSocket = Socket<RoomSyncServerEvents, RoomSyncClientEvents>;

export function createRoomSocket(): RoomSocket {
  return io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001', {
    autoConnect: false,
    withCredentials: true
  });
}