import { describe, expect, it } from 'vitest';
import { canControlPlayback, canSendChat, defaultRoomPermissions } from '../src/permissions.js';

describe('room permissions', () => {
  it('keeps playback host-only by default', () => {
    expect(canControlPlayback('host')).toBe(true);
    expect(canControlPlayback('participant')).toBe(false);
  });

  it('allows chat for everyone by default', () => {
    expect(canSendChat('guest')).toBe(true);
    expect(canSendChat('participant', defaultRoomPermissions)).toBe(true);
  });
});