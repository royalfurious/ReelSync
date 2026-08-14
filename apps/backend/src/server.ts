import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { env } from './config/env.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerLiveKitRoutes } from './routes/livekit.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerRoomRoutes } from './routes/rooms.js';

export function buildServer() {
  const app = Fastify({ logger: true });

  void app.register(helmet);
  void app.register(cookie);
  void app.register(cors, {
    origin: env.NEXT_PUBLIC_APP_URL,
    credentials: true
  });
  void app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute'
  });

  void registerHealthRoutes(app);
  void registerAuthRoutes(app);
  void registerRoomRoutes(app);
  void registerLiveKitRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const normalizedError = error as { statusCode?: number; message?: string };
    const statusCode = normalizedError.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal server error' : normalizedError.message ?? 'Request failed'
    });
  });

  return app;
}