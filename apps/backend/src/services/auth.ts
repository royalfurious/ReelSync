import { randomBytes, pbkdf2Sync, timingSafeEqual, createHash } from 'node:crypto';

import { and, eq, gt } from 'drizzle-orm';

import { createDatabaseClient, authSessions, users } from '@watch-party/db';
import type { InferSelectModel } from 'drizzle-orm';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')): string {
  const derivedKey = pbkdf2Sync(password, salt, 120_000, 64, 'sha512').toString('hex');
  return `pbkdf2$sha512$120000$${salt}$${derivedKey}`;
}

function verifyPassword(password: string, passwordHash: string): boolean {
  const [scheme, algorithm, iterations, salt, expectedHash] = passwordHash.split('$');
  if (scheme !== 'pbkdf2' || algorithm !== 'sha512' || !iterations || !salt || !expectedHash) {
    return false;
  }

  const actualHash = pbkdf2Sync(password, salt, Number(iterations), expectedHash.length / 2, 'sha512');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  return expectedBuffer.length === actualHash.length && timingSafeEqual(expectedBuffer, actualHash);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export type AuthUser = Pick<InferSelectModel<typeof users>, 'id' | 'name' | 'email' | 'avatar' | 'createdAt' | 'updatedAt'>;

export type AuthSession = {
  token: string;
  expiresAt: Date;
  user: AuthUser;
};

async function createSession(userId: string): Promise<AuthSession | null> {
  const database = getDatabaseClient();
  if (!database) {
    return null;
  }

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const tokenHash = hashToken(token);

  await database.insert(authSessions).values({
    userId,
    tokenHash,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const [user] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return null;
  }

  return {
    token,
    expiresAt,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  };
}

export async function registerUser(input: { name: string; email: string; password: string }): Promise<AuthSession | null> {
  const database = getDatabaseClient();
  if (!database) {
    return null;
  }

  const normalizedEmail = normalizeEmail(input.email);
  const existingUser = await database.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existingUser[0]) {
    return null;
  }

  const [createdUser] = await database.insert(users).values({
    name: input.name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(input.password),
    avatar: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();

  if (!createdUser) {
    return null;
  }

  return createSession(createdUser.id);
}

export async function signInUser(input: { email: string; password: string }): Promise<AuthSession | null> {
  const database = getDatabaseClient();
  if (!database) {
    return null;
  }

  const normalizedEmail = normalizeEmail(input.email);
  const [user] = await database.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    return null;
  }

  return createSession(user.id);
}

export async function getUserFromSessionToken(token: string | undefined): Promise<AuthUser | null> {
  const database = getDatabaseClient();
  if (!database || !token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const [session] = await database.select().from(authSessions).where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, new Date()))).limit(1);
  if (!session) {
    return null;
  }

  const [user] = await database.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user ?? null;
}

export async function revokeSessionToken(token: string | undefined): Promise<void> {
  const database = getDatabaseClient();
  if (!database || !token) {
    return;
  }

  const tokenHash = hashToken(token);
  await database.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_MS / 1000
  };
}
