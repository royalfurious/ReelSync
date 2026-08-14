import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { displayNameSchema } from '@watch-party/shared';

import { createRoom, endRoom, getRoom, getRoomByCode, joinRoom, transferHost } from '../services/rooms.js';
import { emitRoomEnded, emitRoomStateSync } from '../realtime/room-events.js';
import { getUserFromSessionToken } from '../services/auth.js';

const AUTH_COOKIE_NAME = 'reelsync_session';

const createRoomSchema = z.object({
  hostDisplayName: displayNameSchema
});

const joinRoomSchema = z.object({
  displayName: displayNameSchema,
  userId: z.string().uuid().optional()
});

const hostTransferSchema = z.object({
  memberId: z.string().uuid()
});

export async function registerRoomRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/rooms', async (request, reply) => {
    const body = createRoomSchema.parse(request.body);
    const user = await getUserFromSessionToken(request.cookies[AUTH_COOKIE_NAME]);
    const room = createRoom({ hostDisplayName: body.hostDisplayName, ...(user ? { hostUserId: user.id } : {}) });

    return reply.code(201).send(room);
  });

  app.get('/api/rooms/:roomId', async (request, reply) => {
    const params = z.object({ roomId: z.string().uuid() }).parse(request.params);
    const room = getRoom(params.roomId);

    if (!room) {
      return reply.code(404).send({ error: 'Room not found' });
    }

    return reply.send(room);
  });

  app.get('/api/rooms/code/:roomCode', async (request, reply) => {
    const params = z.object({ roomCode: z.string().min(1).max(16) }).parse(request.params);
    const room = getRoomByCode(params.roomCode.toUpperCase());

    if (!room) {
      return reply.code(404).send({ error: 'Room not found' });
    }

    return reply.send({ roomId: room.id, roomCode: room.roomCode, status: room.status });
  });

  app.post('/api/rooms/:roomId/join', async (request, reply) => {
    const params = z.object({ roomId: z.string().uuid() }).parse(request.params);
    const body = joinRoomSchema.parse(request.body);
    const user = await getUserFromSessionToken(request.cookies[AUTH_COOKIE_NAME]);
    const member = joinRoom({
      roomId: params.roomId,
      displayName: body.displayName,
      ...(user ? { userId: user.id } : body.userId ? { userId: body.userId } : {})
    });

    if (!member) {
      return reply.code(404).send({ error: 'Room not found or already ended' });
    }

    return reply.send(member);
  });

  app.post('/api/rooms/:roomId/end', async (request, reply) => {
    const params = z.object({ roomId: z.string().uuid() }).parse(request.params);
    const room = endRoom(params.roomId);

    if (!room) {
      return reply.code(404).send({ error: 'Room not found' });
    }

    emitRoomEnded(params.roomId);

    return reply.send(room);
  });

  app.post('/api/rooms/:roomId/host-transfer', async (request, reply) => {
    const params = z.object({ roomId: z.string().uuid() }).parse(request.params);
    const body = hostTransferSchema.parse(request.body);
    const room = transferHost(params.roomId, body.memberId);

    if (!room) {
      return reply.code(404).send({ error: 'Room or member not found' });
    }

    emitRoomStateSync(params.roomId, room);

    return reply.send(room);
  });
}