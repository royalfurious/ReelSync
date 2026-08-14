import type { RoomRole } from './events';

export type RoomPermissions = {
  playback: 'host-only' | 'host-and-participants';
  chat: 'everyone' | 'host-only';
  invite: 'host-only' | 'members';
  share: 'host-only' | 'members';
};

export const defaultRoomPermissions: RoomPermissions = {
  playback: 'host-only',
  chat: 'everyone',
  invite: 'host-only',
  share: 'host-only'
};

export function canControlPlayback(role: RoomRole, permissions: RoomPermissions = defaultRoomPermissions): boolean {
  if (permissions.playback === 'host-and-participants') {
    return role === 'host' || role === 'participant';
  }

  return role === 'host';
}

export function canSendChat(role: RoomRole, permissions: RoomPermissions = defaultRoomPermissions): boolean {
  if (permissions.chat === 'everyone') {
    return role === 'host' || role === 'participant' || role === 'guest';
  }

  return role === 'host';
}

export function canManagePermissions(role: RoomRole): boolean {
  return role === 'host';
}