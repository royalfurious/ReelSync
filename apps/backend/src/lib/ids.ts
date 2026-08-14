import { randomBytes, randomUUID } from 'node:crypto';

export function createRoomCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buffer = randomBytes(length);

  return Array.from(buffer)
    .map((value) => alphabet[value % alphabet.length])
    .join('')
    .slice(0, length);
}

export function createHostToken(): string {
  return randomUUID();
}

export function createMemberId(): string {
  return randomUUID();
}