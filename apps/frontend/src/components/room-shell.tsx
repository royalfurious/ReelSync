"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

import { Room as LiveKitRoom, RoomEvent } from 'livekit-client';
import {
  Copy,
  Crown,
  FastForward,
  Pause,
  Play,
  Radio,
  Rewind,
  RefreshCw,
  Square,
  UserPlus,
  Users,
  Wifi
} from 'lucide-react';
import type { ChatMessage, PlaybackState, RoomPermissions, RoomRole, RoomSnapshot } from '@watch-party/shared';
import { canControlPlayback, canManagePermissions, canSendChat, defaultRoomPermissions } from '@watch-party/shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { HostMediaStage } from '@/components/host-media-stage';
import { RemoteMediaStage } from '@/components/remote-media-stage';
import { RoomSidebar } from '@/components/room-sidebar';
import { createRoomSocket } from '@/lib/socket';

type RoomSummary = {
  roomId: string;
  roomCode: string;
  status: 'active' | 'ended';
  createdAt: string;
  endedAt: string | null;
  hostId: string | null;
  permissions: RoomPermissions;
  participants: Array<{ id: string; displayName: string; role: RoomRole; isConnected: boolean }>;
  playbackState: PlaybackState;
  chatMessages: ChatMessage[];
};

type RoomShellProps = {
  roomId: string;
  memberId?: string | undefined;
};

type LiveKitTokenResponse = {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  canPublish: boolean;
};

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const parts = hours > 0 ? [hours, minutes, secs] : [minutes, secs];
  return parts.map((part, index) => (index === 0 && hours === 0 ? String(part) : String(part).padStart(2, '0'))).join(':');
}

function formatClockTime(isoOrEpoch: number): string {
  return new Date(isoOrEpoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initialsFor(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

export function RoomShell({ roomId, memberId }: RoomShellProps) {
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [liveKitState, setLiveKitState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [displayName, setDisplayName] = useState('Guest');
  const [chatDraft, setChatDraft] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const socketRef = useRef<ReturnType<typeof createRoomSocket> | null>(null);
  const [liveKitRoom, setLiveKitRoom] = useState<LiveKitRoom | null>(null);

  type PlaybackAction =
    | { type: 'play'; currentTime: number; playbackRate: number }
    | { type: 'pause'; currentTime: number }
    | { type: 'seek'; targetTime: number }
    | { type: 'rate'; playbackRate: number };

  const currentMember = useMemo(
    () => room?.participants.find((participant) => participant.id === memberId) ?? null,
    [memberId, room]
  );

  const isHost = currentMember?.role === 'host';
  const playbackState = room?.playbackState ?? null;
  const activeMediaId = playbackState?.mediaId ?? 'demo-sync-track';
  const permissions = room?.permissions ?? defaultRoomPermissions;
  const canEditPermissions = Boolean(currentMember && canManagePermissions(currentMember.role));

  const hostVideoRef = useRef<HTMLVideoElement | null>(null);
  const [seekInput, setSeekInput] = useState('');
  const [activityLog, setActivityLog] = useState<Array<{ id: string; message: string; timestamp: number }>>([]);
  const previousParticipantIdsRef = useRef<Set<string>>(new Set());
  const previousPlaybackRef = useRef<PlaybackState | null>(null);

  const pushActivity = (message: string) => {
    setActivityLog((entries) => [...entries, { id: `${Date.now()}-${Math.random()}`, message, timestamp: Date.now() }].slice(-12));
  };

  useEffect(() => {
    if (!room) {
      return;
    }

    const currentIds = new Set(room.participants.filter((participant) => participant.isConnected).map((participant) => participant.id));
    for (const participant of room.participants) {
      if (participant.isConnected && !previousParticipantIdsRef.current.has(participant.id)) {
        pushActivity(`${participant.displayName} joined`);
      }
    }
    previousParticipantIdsRef.current = currentIds;
  }, [room]);

  useEffect(() => {
    if (!playbackState) {
      return;
    }

    const previous = previousPlaybackRef.current;
    if (previous) {
      if (!previous.isPlaying && playbackState.isPlaying) {
        pushActivity(previous.mediaId ? 'Playback resumed' : 'Movie started');
      } else if (previous.isPlaying && !playbackState.isPlaying) {
        pushActivity('Playback paused');
      } else if (Math.abs(playbackState.currentTime - previous.currentTime) > 3) {
        pushActivity(`Seek to ${formatClock(playbackState.currentTime)}`);
      }
    }
    previousPlaybackRef.current = playbackState;
  }, [playbackState]);

  useEffect(() => {
    if (currentMember?.displayName) {
      setDisplayName(currentMember.displayName);
    }
  }, [currentMember?.displayName]);

  useEffect(() => {
    setChatMessages(room?.chatMessages ?? []);
  }, [room?.chatMessages]);

  useEffect(() => {
    if (room?.status !== 'active' || !memberId) {
      return;
    }

    let isMounted = true;
    let isUnmounting = false;
    let currentLiveKitRoom: LiveKitRoom | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const maxRetries = 3;
    const controller = new AbortController();

    const connectLiveKit = async (): Promise<void> => {
      try {
        setLiveKitState('connecting');

        const tokenResponse = await fetch(`/api/rooms/${roomId}/livekit/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId }),
          signal: controller.signal
        });

        if (!tokenResponse.ok) {
          throw new Error('Unable to obtain a LiveKit token for this room.');
        }

        const token = (await tokenResponse.json()) as LiveKitTokenResponse;
        const liveKitRoom = new LiveKitRoom({
          // adaptiveStream downscales subscribed video to match the rendered element size;
          // this app favors original source quality over bandwidth savings.
          adaptiveStream: false,
          dynacast: true
        });

        currentLiveKitRoom = liveKitRoom;
        setLiveKitRoom(liveKitRoom);
        liveKitRoom.on(RoomEvent.Disconnected, () => {
          if (!isMounted) {
            return;
          }

          setLiveKitState('idle');

          // A stale session from a previous tab/refresh can race this one and get both kicked;
          // retry with backoff instead of leaving the participant stuck disconnected.
          if (!isUnmounting && retryCount < maxRetries) {
            retryCount += 1;
            retryTimeout = setTimeout(() => {
              if (isMounted && !isUnmounting) {
                void connectLiveKit();
              }
            }, 1000 * retryCount);
          }
        });

        liveKitRoom.on(RoomEvent.Reconnecting, () => {
          if (isMounted) {
            setLiveKitState('connecting');
          }
        });

        liveKitRoom.on(RoomEvent.Reconnected, () => {
          if (isMounted) {
            setLiveKitState('connected');
          }
        });

        await liveKitRoom.connect(token.url, token.token, {
          autoSubscribe: true
        });

        if (isMounted) {
          retryCount = 0;
          setLiveKitState('connected');
        }
      } catch (error_: unknown) {
        if (!isMounted) {
          return;
        }

        if (error_ instanceof DOMException && error_.name === 'AbortError') {
          return;
        }

        setLiveKitState('error');
        setError(error_ instanceof Error ? `LiveKit connection failed: ${error_.message}` : 'LiveKit connection failed.');
      }
    };

    // A hard refresh/close can tear down the page before the async disconnect() below
    // resolves, leaving the identity registered on the server to race the next connect.
    const handlePageHide = () => {
      currentLiveKitRoom?.disconnect();
    };
    window.addEventListener('pagehide', handlePageHide);

    const connectPromise = connectLiveKit();

    return () => {
      isMounted = false;
      isUnmounting = true;
      controller.abort();
      window.removeEventListener('pagehide', handlePageHide);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      // Wait for the in-flight connect() to settle before disconnecting, otherwise
      // LiveKit logs "Received leave request while trying to (re)connect".
      void connectPromise.finally(() => {
        if (currentLiveKitRoom) {
          void currentLiveKitRoom.disconnect();
        }
      });
      setLiveKitRoom(null);
    };
    // Reconnect on role change too: a host-transfer must fetch a fresh token so
    // publish permission (canPublish) matches the member's current role.
    // displayName isn't used for the LiveKit token/connect and must not retrigger this effect.
  }, [memberId, room?.status, roomId, isHost]);

  useEffect(() => {
    const controller = new AbortController();

    const loadRoom = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error('Room not found');
        }
        setRoom((await response.json()) as RoomSummary);
      } catch (error_: unknown) {
        if (error_ instanceof DOMException && error_.name === 'AbortError') {
          return;
        }

        setError(error_ instanceof Error ? error_.message : 'Unable to load room state');
      }
    };

    void loadRoom();

    return () => controller.abort();
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !memberId) {
      return;
    }

    const socket = createRoomSocket();
    socketRef.current = socket;
    socket.connect();

    socket.on('connect', () => {
      setConnectionState('connected');
      socket.emit('room:join', {
        roomId,
        memberId,
        displayName
      });
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
    });

    socket.on('room:state', (nextRoom: RoomSnapshot) => {
      setRoom(nextRoom);
    });

    socket.on('chat:message', (message: ChatMessage) => {
      if (message.roomId !== roomId) {
        return;
      }

      setChatMessages((currentMessages) => {
        if (currentMessages.some((entry) => entry.id === message.id)) {
          return currentMessages;
        }

        return [...currentMessages, message].slice(-50);
      });
    });

    socket.on('chat:error', ({ roomId: errorRoomId, message }) => {
      if (errorRoomId === roomId) {
        setChatError(message);
      }
    });

    socket.on('playback:state', ({ playbackState: nextPlaybackState }) => {
      setRoom((currentRoom) =>
        currentRoom
          ? {
              ...currentRoom,
              playbackState: nextPlaybackState
            }
          : currentRoom
      );
    });

    socket.on('host:changed', ({ hostId }) => {
      setRoom((currentRoom) =>
        currentRoom
          ? {
              ...currentRoom,
              hostId
            }
          : currentRoom
      );
    });

    socket.on('room:ended', ({ roomId: endedRoomId }) => {
      if (endedRoomId !== roomId) {
        return;
      }

      setRoom((currentRoom) =>
        currentRoom
          ? {
              ...currentRoom,
              status: 'ended',
              endedAt: currentRoom.endedAt ?? new Date().toISOString()
            }
          : currentRoom
      );
      setError('The host ended this room.');
    });

    socket.on('sync:warning', ({ roomId: warnedRoomId, recommendedAction }) => {
      if (warnedRoomId === roomId) {
        setError(recommendedAction === 'none' ? null : 'Playback drift warning received from the server.');
      }
    });

    return () => {
      socket.emit('room:leave', {
        roomId,
        memberId,
        displayName
      });
      socketRef.current = null;
      socket.disconnect();
    };
  }, [displayName, memberId, roomId]);

  const sendPlaybackCommand = (action: PlaybackAction) => {
    const socket = socketRef.current;

    if (!room || !memberId || !currentMember || !socket || !canControlPlayback(currentMember.role, permissions)) {
      return;
    }

    const clientTimestamp = Date.now();

    switch (action.type) {
      case 'play':
        socket.emit('playback:play', {
          roomId,
          memberId,
          mediaId: activeMediaId,
          currentTime: action.currentTime,
          playbackRate: action.playbackRate,
          clientTimestamp
        });
        break;
      case 'pause':
        socket.emit('playback:pause', {
          roomId,
          memberId,
          mediaId: activeMediaId,
          currentTime: action.currentTime,
          clientTimestamp
        });
        break;
      case 'seek':
        socket.emit('playback:seek', {
          roomId,
          memberId,
          mediaId: activeMediaId,
          targetTime: action.targetTime,
          clientTimestamp
        });
        break;
      case 'rate':
        socket.emit('playback:rate', {
          roomId,
          memberId,
          mediaId: activeMediaId,
          playbackRate: action.playbackRate,
          clientTimestamp
        });
        break;
    }
  };

  const sendChatMessage = () => {
    const socket = socketRef.current;
    const message = chatDraft.trim();

    if (!socket || !memberId || !room || room.status !== 'active' || !message || !currentMember || !canSendChat(currentMember.role, permissions)) {
      return;
    }

    setChatError(null);
    socket.emit('chat:message', {
      roomId,
      memberId,
      message,
      clientTimestamp: Date.now()
    });
    setChatDraft('');
  };

  const cyclePlaybackPermission = () => {
    const socket = socketRef.current;
    if (!socket || !memberId || !canEditPermissions) {
      return;
    }

    socket.emit('room:permissions:update', {
      roomId,
      memberId,
      playback: permissions.playback === 'host-only' ? 'host-and-participants' : 'host-only'
    });
  };

  const cycleChatPermission = () => {
    const socket = socketRef.current;
    if (!socket || !memberId || !canEditPermissions) {
      return;
    }

    socket.emit('room:permissions:update', {
      roomId,
      memberId,
      chat: permissions.chat === 'everyone' ? 'host-only' : 'everyone'
    });
  };

  const [inviteStatus, setInviteStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const copyInviteLink = async () => {
    const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : `/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteStatus('copied');
      window.setTimeout(() => setInviteStatus('idle'), 1800);
    } catch {
      setInviteStatus('error');
      window.setTimeout(() => setInviteStatus('idle'), 1800);
    }
  };

  const handleEndRoom = async () => {
    if (!isHost || !room) {
      return;
    }
    if (!window.confirm('End this room for everyone? This cannot be undone.')) {
      return;
    }
    try {
      const response = await fetch(`/api/rooms/${roomId}/end`, { method: 'POST' });
      if (response.ok) {
        setRoom((currentRoom) => (currentRoom ? { ...currentRoom, status: 'ended', endedAt: new Date().toISOString() } : currentRoom));
      }
    } catch {
      setError('Unable to end the room right now.');
    }
  };

  const handleTransferHost = async (targetMemberId: string) => {
    if (!isHost) {
      return;
    }
    try {
      const response = await fetch(`/api/rooms/${roomId}/host-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: targetMemberId })
      });
      if (response.ok) {
        setRoom((await response.json()) as RoomSummary);
        pushActivity('Host transferred');
      }
    } catch {
      setError('Unable to transfer host right now.');
    }
  };

  const togglePlayback = () => {
    const video = hostVideoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const stopPlayback = () => {
    const video = hostVideoRef.current;
    if (!video) {
      return;
    }
    video.pause();
    video.currentTime = 0;
  };

  const seekBy = (deltaSeconds: number) => {
    const video = hostVideoRef.current;
    if (!video) {
      return;
    }
    video.currentTime = Math.max(0, video.currentTime + deltaSeconds);
  };

  const setPlaybackRateValue = (rate: number) => {
    const video = hostVideoRef.current;
    if (!video) {
      return;
    }
    video.playbackRate = rate;
  };

  const submitSeekInput = () => {
    const video = hostVideoRef.current;
    if (!video || !seekInput.trim()) {
      return;
    }
    const parts = seekInput.split(':').map(Number);
    if (parts.some(Number.isNaN)) {
      return;
    }
    const seconds = parts.reduceRight((total, part, index) => total + part * Math.pow(60, parts.length - 1 - index), 0);
    video.currentTime = seconds;
  };

  const syncEveryone = () => {
    const video = hostVideoRef.current;
    if (!video) {
      return;
    }
    sendPlaybackCommand(
      video.paused
        ? { type: 'pause', currentTime: video.currentTime }
        : { type: 'play', currentTime: video.currentTime, playbackRate: video.playbackRate }
    );
    pushActivity('Synced playback to everyone');
  };

  return (
    <div className="flex min-h-screen">
      <RoomSidebar
        isHost={isHost}
        roomCode={room?.roomCode ?? '—'}
        onEndRoom={() => void handleEndRoom()}
        onLeaveRoom={() => window.location.assign('/')}
      />

      <div className="flex-1 px-4 py-4 md:px-6 lg:px-8">
        <header id="dashboard" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-xl md:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-semibold text-white">Room {room?.roomCode ?? '—'}</h1>
              <Badge className={room?.status === 'active' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : ''}>
                {room?.status === 'active' ? 'Live' : 'Ended'}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/45">
              <span>Room ID: {roomId}</span>
              <button
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-white/70 hover:bg-white/10"
                type="button"
                onClick={() => void copyInviteLink()}
              >
                <Copy className="h-3 w-3" /> {inviteStatus === 'copied' ? 'Copied' : inviteStatus === 'error' ? 'Copy failed' : 'Copy'}
              </button>
            </div>
          </div>
          {isHost ? (
            <Button variant="secondary" onClick={() => void handleEndRoom()}>
              End Room
            </Button>
          ) : null}
        </header>

        {error ? <p className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
          <div className="space-y-6">
            <div id="playback">
              {isHost ? (
                <HostMediaStage
                  roomId={roomId}
                  memberId={memberId ?? ''}
                  displayName={displayName}
                  liveKitRoom={liveKitRoom}
                  liveKitState={liveKitState}
                  onVideoElementReady={(element) => {
                    hostVideoRef.current = element;
                  }}
                  onMediaSelected={(mediaId, duration) => {
                    const socket = socketRef.current;
                    if (!socket || !memberId) {
                      return;
                    }

                    socket.emit('media:selected', {
                      roomId,
                      memberId,
                      mediaId,
                      fileName: mediaId,
                      duration
                    });
                  }}
                  onPlaybackCommand={(action) => sendPlaybackCommand(action)}
                />
              ) : (
                <RemoteMediaStage liveKitRoom={liveKitRoom} roomStatus={room?.status ?? 'active'} mediaId={activeMediaId} />
              )}
            </div>

            {isHost ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>Playback Control Center</CardTitle>
                    <Badge>You are the host</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <Button size="sm" variant="secondary" onClick={togglePlayback}>
                      <Play className="h-4 w-4" /> Play
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => hostVideoRef.current?.pause()}>
                      <Pause className="h-4 w-4" /> Pause
                    </Button>
                    <Button size="sm" variant="secondary" onClick={stopPlayback}>
                      <Square className="h-4 w-4" /> Stop
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => seekBy(-10)}>
                      <Rewind className="h-4 w-4" /> 10s
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => seekBy(10)}>
                      <FastForward className="h-4 w-4" /> 10s
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">Seek to</p>
                    <Input
                      className="w-32"
                      placeholder="hh:mm:ss"
                      value={seekInput}
                      onChange={(event) => setSeekInput(event.target.value)}
                    />
                    <Button size="sm" onClick={submitSeekInput}>
                      Go
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">Playback speed</p>
                    <div className="flex flex-wrap gap-2">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/75 hover:bg-white/10"
                          type="button"
                          onClick={() => setPlaybackRateValue(rate)}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button className="w-full sm:w-auto" onClick={syncEveryone}>
                    <RefreshCw className="h-4 w-4" /> Sync Everyone
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  icon: Radio,
                  label: 'Room Status',
                  value: room?.status === 'active' ? 'Live' : 'Ended',
                  hint: room?.status === 'active' ? 'Room is active' : 'Room has ended'
                },
                {
                  icon: Wifi,
                  label: 'Network',
                  value: connectionState === 'connected' ? 'Stable' : connectionState,
                  hint: `Socket ${connectionState} · LiveKit ${liveKitState}`
                },
                {
                  icon: Users,
                  label: 'Viewers',
                  value: String(room?.participants.filter((participant) => participant.isConnected).length ?? 0),
                  hint: 'Active now'
                },
                {
                  icon: Play,
                  label: 'Now Playing',
                  value: playbackState?.isPlaying ? 'Playing' : 'Paused',
                  hint: playbackState?.playbackRate ? `${playbackState.playbackRate}x speed` : '—'
                }
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-center gap-2 text-white/45">
                      <stat.icon className="h-4 w-4" />
                      <p className="text-xs uppercase tracking-[0.2em]">{stat.label}</p>
                    </div>
                    <p className="text-xl font-semibold text-white">{stat.value}</p>
                    <p className="text-xs text-white/45">{stat.hint}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Joins, leaves, and playback changes appear here as they happen.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activityLog.length ? (
                  [...activityLog].reverse().map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="text-white/45">{formatClockTime(entry.timestamp)}</span>
                      <span className="text-white/80">{entry.message}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/45">No activity yet.</p>
                )}
              </CardContent>
            </Card>

            {canEditPermissions ? (
              <Card id="room-settings">
                <CardHeader>
                  <CardTitle>Room permissions</CardTitle>
                  <CardDescription>Host-only settings keep playback and chat under control.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <button
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/80 hover:bg-white/10"
                    type="button"
                    onClick={cyclePlaybackPermission}
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">Playback</p>
                    <p className="mt-1 font-medium text-white">{permissions.playback === 'host-only' ? 'Host only' : 'Host + participants'}</p>
                  </button>
                  <button
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/80 hover:bg-white/10"
                    type="button"
                    onClick={cycleChatPermission}
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">Chat</p>
                    <p className="mt-1 font-medium text-white">{permissions.chat === 'everyone' ? 'Everyone' : 'Host only'}</p>
                  </button>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6">
            <Card id="participants">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Participants ({room?.participants.filter((participant) => participant.isConnected).length ?? 0})</CardTitle>
                    <CardDescription>Host and guests appear here once the room is live.</CardDescription>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => void copyInviteLink()}>
                    <UserPlus className="h-4 w-4" /> Invite
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {room?.participants.length ? (
                  room.participants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                          {initialsFor(participant.displayName)}
                        </span>
                        <div>
                          <p className="flex items-center gap-1.5 font-medium text-white">
                            {participant.displayName}
                            {participant.role === 'host' ? <Crown className="h-3.5 w-3.5 text-amber-300" /> : null}
                          </p>
                          <p className="text-xs uppercase tracking-[0.2em] text-white/45">{participant.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{participant.isConnected ? 'Connected' : 'Offline'}</Badge>
                        {isHost && participant.role !== 'host' && participant.isConnected ? (
                          <button
                            className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
                            type="button"
                            onClick={() => void handleTransferHost(participant.id)}
                          >
                            Make host
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/55">
                    No active participants yet. Share the room link to invite others.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card id="chat">
              <CardHeader>
                <CardTitle>Room Chat</CardTitle>
                <CardDescription>Messages stay room-scoped, validated on the server, and rate-limited to keep the room usable.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-80 space-y-3 overflow-auto rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                  {chatMessages.length ? (
                    chatMessages.map((message) => (
                      <div key={message.id} className="space-y-1 border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-white">{message.senderName}</p>
                          <p className="text-xs text-white/35">{formatClockTime(new Date(message.createdAt).getTime())}</p>
                        </div>
                        <p className="break-words text-white/70">{message.message}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-white/50">
                      No chat yet. Say hello when you join.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {chatError ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{chatError}</p> : null}
                  <div className="flex gap-3">
                    <Input
                      aria-label="Chat message"
                      disabled={room?.status !== 'active' || !currentMember || !canSendChat(currentMember.role, permissions)}
                      placeholder="Write a message"
                      value={chatDraft}
                      onChange={(event) => setChatDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          sendChatMessage();
                        }
                      }}
                    />
                    <Button disabled={room?.status !== 'active' || !chatDraft.trim() || !currentMember || !canSendChat(currentMember.role, permissions)} onClick={sendChatMessage}>
                      Send
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}