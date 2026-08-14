import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { displayNameSchema } from '@watch-party/shared';

import { getSessionCookieOptions, getUserFromSessionToken, registerUser, revokeSessionToken, signInUser } from '../services/auth.js';

const authSchema = z.object({
  name: displayNameSchema,
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

const AUTH_COOKIE_NAME = 'reelsync_session';

function parseBody<T>(body: unknown): T {
  if (typeof body === 'string') {
    return JSON.parse(body) as T;
  }

  return body as T;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/me', async (request, reply) => {
    const sessionToken = request.cookies[AUTH_COOKIE_NAME];
    const user = await getUserFromSessionToken(sessionToken);

    if (!user) {
      return reply.send({ user: null });
    }

    return reply.send({ user });
  });

  app.post('/api/auth/register', async (request, reply) => {
    const rawBody = parseBody<unknown>(request.body);
    const parseResult = authSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid registration payload.' });
    }

    const session = await registerUser(parseResult.data);

    if (!session) {
      return reply.code(400).send({ error: 'Unable to register with those details.' });
    }

    reply.setCookie(AUTH_COOKIE_NAME, session.token, getSessionCookieOptions());
    return reply.code(201).send({ user: session.user });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = signInSchema.parse(parseBody<unknown>(request.body));
    const session = await signInUser(body);

    if (!session) {
      return reply.code(401).send({ error: 'Invalid email or password.' });
    }

    reply.setCookie(AUTH_COOKIE_NAME, session.token, getSessionCookieOptions());
    return reply.send({ user: session.user });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    await revokeSessionToken(request.cookies[AUTH_COOKIE_NAME]);
    reply.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    return reply.send({ ok: true });
  });
}