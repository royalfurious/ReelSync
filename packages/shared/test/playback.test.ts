import { describe, expect, it } from 'vitest';
import { applyPlaybackCommand, createDefaultPlaybackState } from '../src/playback.js';
import {
  calculateDriftMs,
  calculateExpectedPlaybackTime,
  clampPlaybackRate,
  describeDrift
} from '../src/playback.js';

describe('playback utilities', () => {
  it('projects playing time forward from the last authoritative timestamp', () => {
    const expected = calculateExpectedPlaybackTime(
      {
        isPlaying: true,
        currentTime: 42,
        playbackRate: 1,
        updatedAt: 1_000
      },
      4_000
    );

    expect(expected).toBe(45);
  });

  it('describes drift severity for sync correction', () => {
    expect(describeDrift(120).recommendedAction).toBe('none');
    expect(describeDrift(600).recommendedAction).toBe('nudge');
    expect(describeDrift(4_000).recommendedAction).toBe('seek');
  });

  it('computes signed drift in milliseconds and clamps playback rate', () => {
    expect(calculateDriftMs(10, 10.25)).toBe(250);
    expect(clampPlaybackRate(10)).toBe(4);
    expect(clampPlaybackRate(0.1)).toBe(0.25);
  });

  it('applies authoritative playback commands with server timestamps', () => {
    const baseState = createDefaultPlaybackState();

    const playingState = applyPlaybackCommand(baseState, {
      type: 'play',
      mediaId: 'movie-1',
      currentTime: 12,
      playbackRate: 1.25,
      serverTimestamp: 5_000
    });

    expect(playingState.isPlaying).toBe(true);
    expect(playingState.mediaId).toBe('movie-1');
    expect(playingState.playbackRate).toBe(1.25);
    expect(playingState.updatedAt).toBe(5_000);

    const pausedState = applyPlaybackCommand(playingState, {
      type: 'pause',
      mediaId: 'movie-1',
      currentTime: 24,
      serverTimestamp: 8_000
    });

    expect(pausedState.isPlaying).toBe(false);
    expect(pausedState.currentTime).toBe(24);
    expect(pausedState.updatedAt).toBe(8_000);
  });
});