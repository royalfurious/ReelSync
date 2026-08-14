"use client";

import { useEffect, useRef, useState } from 'react';

import { Maximize } from 'lucide-react';
import { RoomEvent, Track, VideoQuality, type RemoteTrackPublication, type Room as LiveKitRoom } from 'livekit-client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type RemoteMediaStageProps = {
  liveKitRoom: LiveKitRoom | null;
  roomStatus: 'active' | 'ended';
  mediaId: string;
};

export function RemoteMediaStage({ liveKitRoom, roomStatus, mediaId }: RemoteMediaStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [trackState, setTrackState] = useState<'waiting' | 'receiving' | 'ready'>('waiting');
  const [participantCount, setParticipantCount] = useState(0);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoTrackRef = useRef<Track | null>(null);
  const audioTrackRef = useRef<Track | null>(null);

  useEffect(() => {
    const room = liveKitRoom;
    if (!room) {
      return;
    }

    const attachTrack = (track: Track, publication?: RemoteTrackPublication) => {
      if (track.kind === Track.Kind.Video) {
        videoTrackRef.current?.detach();
        videoTrackRef.current = track;
        // Always request the highest simulcast layer instead of letting the SFU
        // downscale to match the rendered element size.
        publication?.setVideoQuality(VideoQuality.HIGH);
        if (videoRef.current) {
          track.attach(videoRef.current);
          console.log('[RemoteMediaStage] Video track attached to element');
          // Muted playback is always allowed; unmuted autoplay needs a user gesture first.
          videoRef.current.play().catch((err) => {
            console.warn('[RemoteMediaStage] Video autoplay failed:', err);
            setNeedsInteraction(true);
          });
        }
        setTrackState('receiving');
      }

      if (track.kind === Track.Kind.Audio) {
        audioTrackRef.current?.detach();
        audioTrackRef.current = track;
        if (audioRef.current) {
          track.attach(audioRef.current);
          console.log('[RemoteMediaStage] Audio track attached to element');
          // Ensure the audio plays
          audioRef.current.play().catch((err) => {
            console.warn('[RemoteMediaStage] Audio autoplay failed:', err);
          });
        }
        setTrackState('receiving');
      }
    };

    const handleTrackSubscribed = (track: Track, publication: RemoteTrackPublication) => {
      console.log('[RemoteMediaStage] Track subscribed:', track.kind, track.source);
      attachTrack(track, publication);
      setTrackState('ready');
    };

    const handleTrackUnsubscribed = (track: Track) => {
      console.log('[RemoteMediaStage] Track unsubscribed:', track.kind);
      track.detach();
      if (videoTrackRef.current === track) {
        videoTrackRef.current = null;
      }
      if (audioTrackRef.current === track) {
        audioTrackRef.current = null;
      }
      setTrackState('waiting');
    };

    const handleParticipantConnected = () => {
      console.log('[RemoteMediaStage] Remote participant connected, checking for tracks');
      setParticipantCount(room.remoteParticipants.size);
      for (const participant of room.remoteParticipants.values()) {
        console.log('[RemoteMediaStage] Participant:', participant.identity, 'tracks:', participant.trackPublications.size);
        for (const publication of participant.trackPublications.values()) {
          if (publication.track && publication.isSubscribed) {
            console.log('[RemoteMediaStage] Found existing track:', publication.track.kind);
            attachTrack(publication.track, publication as RemoteTrackPublication);
          }
        }
      }
    };

    const handleParticipantDisconnected = () => {
      console.log('[RemoteMediaStage] Remote participant disconnected');
      setParticipantCount(room.remoteParticipants.size);
    };

    room
      .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
      .on(RoomEvent.ParticipantConnected, handleParticipantConnected)
      .on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    // Check for already-connected participants and their tracks
    setParticipantCount(room.remoteParticipants.size);
    console.log('[RemoteMediaStage] Initial check - remote participants:', room.remoteParticipants.size);
    for (const participant of room.remoteParticipants.values()) {
      console.log('[RemoteMediaStage] Checking participant:', participant.identity);
      for (const publication of participant.trackPublications.values()) {
        console.log('[RemoteMediaStage] Publication:', publication.trackName, 'subscribed:', publication.isSubscribed, 'track:', !!publication.track);
        if (publication.track && publication.isSubscribed) {
          attachTrack(publication.track, publication as RemoteTrackPublication);
        }
      }
    }

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      videoTrackRef.current?.detach();
      audioTrackRef.current?.detach();
      videoTrackRef.current = null;
      audioTrackRef.current = null;
    };
  }, [liveKitRoom]);

  const resumePlayback = () => {
    videoRef.current?.play().catch(() => undefined);
    audioRef.current?.play().catch(() => undefined);
    setNeedsInteraction(false);
  };

  const toggleMute = () => {
    if (!videoRef.current) {
      return;
    }
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
    setIsMuted(nextMuted);
    if (!nextMuted) {
      resumePlayback();
    }
  };

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!document.fullscreenElement) {
      void container?.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  };

  return (
    <Card className="overflow-hidden border-white/[0.12] bg-white/[0.06]">
      <CardHeader className="space-y-4 border-b border-white/10 bg-gradient-to-br from-white/10 to-transparent">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Participant view</Badge>
          <Badge>{trackState}</Badge>
          <Badge>Remote participants: {participantCount}</Badge>
        </div>
        <div>
          <CardTitle className="text-2xl">Live room playback</CardTitle>
          <CardDescription>
            The room receives the browser-captured movie stream through LiveKit. Playback controls stay synchronized through Socket.IO.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/40">
          <video
            ref={videoRef}
            autoPlay
            muted={isMuted}
            className="aspect-video w-full bg-black"
            controls={false}
            playsInline
            onPlay={() => console.log('[RemoteMediaStage] Video element started playing')}
            onError={(e) => console.error('[RemoteMediaStage] Video element error:', e)}
          />
          <audio ref={audioRef} autoPlay muted={isMuted} />
          {needsInteraction ? (
            <button
              type="button"
              onClick={resumePlayback}
              className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-medium text-white transition hover:bg-black/50"
            >
              Tap to play
            </button>
          ) : null}
          {!needsInteraction && trackState !== 'waiting' ? (
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/80"
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Toggle fullscreen"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80"
              >
                <Maximize className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">Mode: WebRTC subscriber</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">Media ID: {mediaId}</div>
        </div>
        <p className="text-sm text-white/55">
          {roomStatus === 'active'
            ? 'The browser is ready to consume the host stream and should recover after brief reconnects.'
            : 'The room has ended, so the incoming stream will stop when the session closes.'}
        </p>
      </CardContent>
    </Card>
  );
}