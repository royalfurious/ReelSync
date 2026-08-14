import type { RoomPermissions } from './permissions';

export type PlaybackState = {
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  updatedAt: number;
  mediaId: string | null;
};

export type RoomRole = 'host' | 'participant' | 'guest';

export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string | null;
  senderName: string;
  message: string;
  createdAt: string;
};

export type RoomMemberSummary = {
  id: string;
  displayName: string;
  role: RoomRole;
  isConnected: boolean;
};

export type RoomSnapshot = {
  roomId: string;
  roomCode: string;
  status: 'active' | 'ended';
  createdAt: string;
  endedAt: string | null;
  hostId: string | null;
  permissions: RoomPermissions;
  participants: RoomMemberSummary[];
  playbackState: PlaybackState;
  chatMessages: ChatMessage[];
};

export type RoomJoinPayload = {
  roomId: string;
  memberId: string;
  displayName: string;
};

export type PlaybackPlayPayload = {
  roomId: string;
  memberId: string;
  mediaId: string;
  currentTime: number;
  playbackRate: number;
  clientTimestamp: number;
};

export type PlaybackPausePayload = {
  roomId: string;
  memberId: string;
  mediaId: string;
  currentTime: number;
  clientTimestamp: number;
};

export type PlaybackSeekPayload = {
  roomId: string;
  memberId: string;
  mediaId: string;
  targetTime: number;
  clientTimestamp: number;
};

export type PlaybackRatePayload = {
  roomId: string;
  memberId: string;
  mediaId: string;
  playbackRate: number;
  clientTimestamp: number;
};

export type RoomPermissionsUpdatePayload = {
  roomId: string;
  memberId: string;
  playback?: RoomPermissions['playback'];
  chat?: RoomPermissions['chat'];
  invite?: RoomPermissions['invite'];
  share?: RoomPermissions['share'];
};

export type ChatMessagePayload = {
  roomId: string;
  memberId: string;
  message: string;
  clientTimestamp: number;
};

export type RoomSyncClientEvents = {
  'room:join': (_payload: RoomJoinPayload) => void;
  'room:leave': (_payload: RoomJoinPayload) => void;
  'media:selected': (_payload: {
    roomId: string;
    memberId: string;
    mediaId: string;
    fileName: string;
    duration: number | null;
  }) => void;
  'playback:play': (_payload: PlaybackPlayPayload) => void;
  'playback:pause': (_payload: PlaybackPausePayload) => void;
  'playback:seek': (_payload: PlaybackSeekPayload) => void;
  'playback:rate': (_payload: PlaybackRatePayload) => void;
  'chat:message': (_payload: ChatMessagePayload) => void;
  'room:permissions:update': (_payload: RoomPermissionsUpdatePayload) => void;
};

export type RoomSyncServerEvents = {
  'room:state': (_payload: RoomSnapshot) => void;
  'participant:joined': (_payload: RoomJoinPayload) => void;
  'participant:left': (_payload: RoomJoinPayload) => void;
  'playback:state': (_payload: { roomId: string; playbackState: PlaybackState }) => void;
  'host:changed': (_payload: { roomId: string; hostId: string | null }) => void;
  'room:ended': (_payload: { roomId: string }) => void;
  'chat:message': (_payload: ChatMessage) => void;
  'chat:error': (_payload: { roomId: string; message: string }) => void;
  'sync:warning': (_payload: { roomId: string; driftMs: number; recommendedAction: 'none' | 'nudge' | 'seek' }) => void;
};

export type PlaybackEventEnvelope =
  | {
      type: 'playback:play';
      roomId: string;
      payload: {
        mediaId: string;
        currentTime: number;
        playbackRate: number;
        serverTimestamp: number;
      };
    }
  | {
      type: 'playback:pause';
      roomId: string;
      payload: {
        mediaId: string;
        currentTime: number;
        serverTimestamp: number;
      };
    }
  | {
      type: 'playback:seek';
      roomId: string;
      payload: {
        mediaId: string;
        targetTime: number;
        serverTimestamp: number;
      };
    }
  | {
      type: 'playback:rate';
      roomId: string;
      payload: {
        mediaId: string;
        playbackRate: number;
        serverTimestamp: number;
      };
    }
  | {
      type: 'media:selected';
      roomId: string;
      payload: {
        mediaId: string;
        fileName: string;
        duration: number | null;
      };
    };