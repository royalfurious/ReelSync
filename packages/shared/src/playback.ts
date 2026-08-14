import type { PlaybackState } from './events';

export type PlaybackCommand =
  | {
      type: 'play';
      mediaId: string;
      currentTime: number;
      playbackRate: number;
      serverTimestamp: number;
    }
  | {
      type: 'pause';
      mediaId: string;
      currentTime: number;
      serverTimestamp: number;
    }
  | {
      type: 'seek';
      mediaId: string;
      targetTime: number;
      serverTimestamp: number;
    }
  | {
      type: 'rate';
      mediaId: string;
      playbackRate: number;
      serverTimestamp: number;
    };

export function createDefaultPlaybackState(): PlaybackState {
  return {
    isPlaying: false,
    currentTime: 0,
    playbackRate: 1,
    updatedAt: Date.now(),
    mediaId: null
  };
}

export type DriftCorrection = {
  driftMs: number;
  severity: 'stable' | 'small' | 'large';
  recommendedAction: 'none' | 'nudge' | 'seek';
};

export function calculateExpectedPlaybackTime(state: PlaybackState, nowMs: number): number {
  if (!state.isPlaying) {
    return state.currentTime;
  }

  const elapsedSeconds = Math.max(0, (nowMs - state.updatedAt) / 1000);
  return state.currentTime + elapsedSeconds * state.playbackRate;
}

export function calculateDriftMs(expectedSeconds: number, actualSeconds: number): number {
  return Math.round((actualSeconds - expectedSeconds) * 1000);
}

export function describeDrift(driftMs: number): DriftCorrection {
  const absDrift = Math.abs(driftMs);

  if (absDrift < 250) {
    return {
      driftMs,
      severity: 'stable',
      recommendedAction: 'none'
    };
  }

  if (absDrift < 1500) {
    return {
      driftMs,
      severity: 'small',
      recommendedAction: 'nudge'
    };
  }

  return {
    driftMs,
    severity: 'large',
    recommendedAction: 'seek'
  };
}

export function clampPlaybackRate(rate: number): number {
  return Math.min(4, Math.max(0.25, rate));
}

export function applyPlaybackCommand(state: PlaybackState, command: PlaybackCommand): PlaybackState {
  switch (command.type) {
    case 'play':
      return {
        isPlaying: true,
        currentTime: Math.max(0, command.currentTime),
        playbackRate: clampPlaybackRate(command.playbackRate),
        updatedAt: command.serverTimestamp,
        mediaId: command.mediaId
      };
    case 'pause':
      return {
        isPlaying: false,
        currentTime: Math.max(0, command.currentTime),
        playbackRate: state.playbackRate,
        updatedAt: command.serverTimestamp,
        mediaId: command.mediaId
      };
    case 'seek':
      return {
        ...state,
        isPlaying: state.isPlaying,
        currentTime: Math.max(0, command.targetTime),
        updatedAt: command.serverTimestamp,
        mediaId: command.mediaId
      };
    case 'rate':
      return {
        ...state,
        playbackRate: clampPlaybackRate(command.playbackRate),
        updatedAt: command.serverTimestamp,
        mediaId: command.mediaId
      };
  }
}

export function projectPlaybackState(state: PlaybackState, nowMs: number): PlaybackState {
  return {
    ...state,
    currentTime: calculateExpectedPlaybackTime(state, nowMs),
    updatedAt: nowMs
  };
}