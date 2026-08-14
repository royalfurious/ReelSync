import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { createLiveKitToken } from '../services/livekit.js';

const tokenRequestSchema = z.object({
  memberId: z.string().uuid()
});

export async function registerLiveKitRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/rooms/:roomId/livekit/token', async (request, reply) => {
    const params = z.object({ roomId: z.string().uuid() }).parse(request.params);
    const body = tokenRequestSchema.parse(request.body);
    const token = await createLiveKitToken(params.roomId, body.memberId);

    if (!token) {
      return reply.code(404).send({ error: 'Room or member not found' });
    }

    return reply.send(token);
  });
}