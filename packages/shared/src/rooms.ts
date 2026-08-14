import { z } from 'zod';

export const roomCodeSchema = z.string().min(6).max(12).regex(/^[A-Z0-9]+$/);
export const displayNameSchema = z.string().trim().min(2).max(40);
export const messageSchema = z.string().trim().min(1).max(500);

export type CreateRoomResult = {
  roomId: string;
  roomCode: string;
  shareUrl: string;
  hostToken: string;
};

export type JoinRoomResult = {
  roomId: string;
  roomCode: string;
  memberId: string;
  displayName: string;
};

export function sanitizeDisplayName(value: string): string {
  return displayNameSchema.parse(value);
}

export function sanitizeChatMessage(value: string): string {
  return messageSchema.parse(value);
}