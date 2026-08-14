import { Server, type Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';

import type { RoomSyncClientEvents, RoomSyncServerEvents } from '@watch-party/shared';
import {
  appendRoomChatMessage,
  applyRoomPlaybackCommand,
  getAllRoomSnapshots,
  getRoomState,
  isHost,
  listRoomMembers,
  markMemberConnected,
  markMemberDisconnected,
  setRoomMedia,
  updateRoomPermissions,
  transferHost
} from '../services/rooms.js';
import { setRealtimeServer } from './room-events.js';
import { canControlPlayback, canSendChat, canManagePermissions } from '@watch-party/shared';

type SocketData = {
  roomId?: string;
  memberId?: string;
  displayName?: string;
  lastChatMessageAt?: number;
};

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

function broadcastRoomState(io: Server<RoomSyncClientEvents, RoomSyncServerEvents>, roomId: string) {
  const room = getRoomState(roomId);
  if (!room) {
    return;
  }

  io.to(roomChannel(roomId)).emit('room:state', room);
  io.to(roomChannel(roomId)).emit('playback:state', {
    roomId,
    playbackState: room.playbackState
  });
}

function attachSocketLifecycle(socket: Socket<RoomSyncClientEvents, RoomSyncServerEvents, Record<string, never>, SocketData>, io: Server<RoomSyncClientEvents, RoomSyncServerEvents>) {
  socket.on('room:join', (payload) => {
    const room = getRoomState(payload.roomId);
    if (!room) {
      socket.emit('sync:warning', {
        roomId: payload.roomId,
        driftMs: 0,
        recommendedAction: 'none'
      });
      return;
    }

    socket.data.roomId = payload.roomId;
    socket.data.memberId = payload.memberId;
    socket.data.displayName = payload.displayName;
    void socket.join(roomChannel(payload.roomId));
    markMemberConnected(payload.roomId, payload.memberId, payload.displayName);
    io.to(roomChannel(payload.roomId)).emit('participant:joined', payload);
    broadcastRoomState(io, payload.roomId);
  });

  socket.on('room:leave', (payload) => {
    markMemberDisconnected(payload.roomId, payload.memberId);
    socket.leave(roomChannel(payload.roomId));
    io.to(roomChannel(payload.roomId)).emit('participant:left', payload);
    broadcastRoomState(io, payload.roomId);
  });

  socket.on('media:selected', (payload) => {
    if (!isHost(payload.roomId, payload.memberId)) {
      socket.emit('sync:warning', {
        roomId: payload.roomId,
        driftMs: 0,
        recommendedAction: 'none'
      });
      return;
    }

    const room = setRoomMedia(payload.roomId, payload.mediaId);
    if (room) {
      broadcastRoomState(io, payload.roomId);
    }
  });

  socket.on('playback:play', (payload) => {
    const room = getRoomState(payload.roomId);
    const member = room?.participants.find((participant) => participant.id === payload.memberId);

    if (!room || !member || !canControlPlayback(member.role, room.permissions)) {
      socket.emit('sync:warning', {
        roomId: payload.roomId,
        driftMs: 0,
        recommendedAction: 'none'
      });
      return;
    }

    const nextRoom = applyRoomPlaybackCommand(payload.roomId, {
      type: 'play',
      mediaId: payload.mediaId,
      currentTime: payload.currentTime,
      playbackRate: payload.playbackRate,
      serverTimestamp: Date.now()
    });

    if (nextRoom) {
      broadcastRoomState(io, payload.roomId);
    }
  });

  socket.on('playback:pause', (payload) => {
    const room = getRoomState(payload.roomId);
    const member = room?.participants.find((participant) => participant.id === payload.memberId);

    if (!room || !member || !canControlPlayback(member.role, room.permissions)) {
      return;
    }

    const nextRoom = applyRoomPlaybackCommand(payload.roomId, {
      type: 'pause',
      mediaId: payload.mediaId,
      currentTime: payload.currentTime,
      serverTimestamp: Date.now()
    });

    if (nextRoom) {
      broadcastRoomState(io, payload.roomId);
    }
  });

  socket.on('playback:seek', (payload) => {
    const room = getRoomState(payload.roomId);
    const member = room?.participants.find((participant) => participant.id === payload.memberId);

    if (!room || !member || !canControlPlayback(member.role, room.permissions)) {
      return;
    }

    const nextRoom = applyRoomPlaybackCommand(payload.roomId, {
      type: 'seek',
      mediaId: payload.mediaId,
      targetTime: payload.targetTime,
      serverTimestamp: Date.now()
    });

    if (nextRoom) {
      broadcastRoomState(io, payload.roomId);
    }
  });

  socket.on('playback:rate', (payload) => {
    const room = getRoomState(payload.roomId);
    const member = room?.participants.find((participant) => participant.id === payload.memberId);

    if (!room || !member || !canControlPlayback(member.role, room.permissions)) {
      return;
    }

    const nextRoom = applyRoomPlaybackCommand(payload.roomId, {
      type: 'rate',
      mediaId: payload.mediaId,
      playbackRate: payload.playbackRate,
      serverTimestamp: Date.now()
    });

    if (nextRoom) {
      broadcastRoomState(io, payload.roomId);
    }
  });

  socket.on('chat:message', (payload) => {
    const room = getRoomState(payload.roomId);
    if (!room || room.status !== 'active') {
      socket.emit('chat:error', {
        roomId: payload.roomId,
        message: 'This room is no longer active.'
      });
      return;
    }

    const member = room.participants.find((participant) => participant.id === payload.memberId);
    if (!member || !member.isConnected || !canSendChat(member.role, room.permissions)) {
      socket.emit('chat:error', {
        roomId: payload.roomId,
        message: 'You must be connected to send chat messages.'
      });
      return;
    }

    const now = Date.now();
    if (socket.data.lastChatMessageAt && now - socket.data.lastChatMessageAt < 1000) {
      socket.emit('chat:error', {
        roomId: payload.roomId,
        message: 'Please wait a moment before sending another message.'
      });
      return;
    }

    const chatMessage = appendRoomChatMessage(payload.roomId, payload.memberId, socket.data.displayName ?? member.displayName, payload.message);
    if (!chatMessage) {
      socket.emit('chat:error', {
        roomId: payload.roomId,
        message: 'Unable to send your message right now.'
      });
      return;
    }

    socket.data.lastChatMessageAt = now;
    io.to(roomChannel(payload.roomId)).emit('chat:message', chatMessage);
    broadcastRoomState(io, payload.roomId);
  });

  socket.on('room:permissions:update', (payload) => {
    const room = getRoomState(payload.roomId);
    const member = room?.participants.find((participant) => participant.id === payload.memberId);

    if (!room || !member || !canManagePermissions(member.role)) {
      socket.emit('sync:warning', {
        roomId: payload.roomId,
        driftMs: 0,
        recommendedAction: 'none'
      });
      return;
    }

    const nextRoom = updateRoomPermissions(payload.roomId, {
      ...(payload.playback ? { playback: payload.playback } : {}),
      ...(payload.chat ? { chat: payload.chat } : {}),
      ...(payload.invite ? { invite: payload.invite } : {}),
      ...(payload.share ? { share: payload.share } : {})
    });

    if (nextRoom) {
      broadcastRoomState(io, payload.roomId);
    }
  });

  socket.on('disconnect', () => {
    const { roomId, memberId } = socket.data;
    if (!roomId || !memberId) {
      return;
    }

    const room = markMemberDisconnected(roomId, memberId);
    if (!room) {
      return;
    }

    const members = listRoomMembers(roomId);
    const nextHost = members.find((member) => member.isConnected && member.id !== memberId);
    if (room.hostId === memberId && nextHost) {
      transferHost(roomId, nextHost.id);
      io.to(roomChannel(roomId)).emit('host:changed', { roomId, hostId: nextHost.id });
    }

    io.to(roomChannel(roomId)).emit('participant:left', {
      roomId,
      memberId,
      displayName: socket.data.displayName ?? 'Guest'
    });
    broadcastRoomState(io, roomId);
  });
}

export function createRealtimeServer(httpServer: HttpServer) {
  const io = new Server<RoomSyncClientEvents, RoomSyncServerEvents>(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    attachSocketLifecycle(socket as Socket<RoomSyncClientEvents, RoomSyncServerEvents, Record<string, never>, SocketData>, io);
  });

  setRealtimeServer(io);

  const timer = setInterval(() => {
    for (const room of getAllRoomSnapshots()) {
      if (room.status !== 'active') {
        continue;
      }

      io.to(roomChannel(room.roomId)).emit('room:state', room);
      io.to(roomChannel(room.roomId)).emit('playback:state', {
        roomId: room.roomId,
        playbackState: room.playbackState
      });
    }
  }, 5000);

  return {
    io,
    close: async () => {
      clearInterval(timer);
      setRealtimeServer(null);
      await io.close();
    }
  };
}