"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Track, type Room as LiveKitRoom } from 'livekit-client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatFileSize, getVideoCaptureStream, isSupportedLocalVideoFile, supportsVideoCaptureStream } from '@/lib/local-media';

type HostMediaStageProps = {
  roomId: string;
  memberId: string;
  displayName: string;
  liveKitRoom: LiveKitRoom | null;
  liveKitState: 'idle' | 'connecting' | 'connected' | 'error';
  onPlaybackCommand: (action:
    | { type: 'play'; currentTime: number; playbackRate: number }
    | { type: 'pause'; currentTime: number }
    | { type: 'seek'; targetTime: number }
    | { type: 'rate'; playbackRate: number }) => void;
  onMediaSelected: (mediaId: string, duration: number | null) => void;
  // Lets the Playback Control Center in the parent drive this same <video> element.
  onVideoElementReady?: (element: HTMLVideoElement | null) => void;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const minuteLabel = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const secondLabel = String(secs).padStart(2, '0');
  return hours > 0 ? `${hours}:${minuteLabel}:${secondLabel}` : `${minuteLabel}:${secondLabel}`;
}

type MediaMetadata = {
  duration: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean | null;
};

type PublishStatus = 'idle' | 'ready' | 'publishing' | 'published' | 'unsupported' | 'error';

function cleanupTracks(tracks: MediaStreamTrack[]) {
  for (const track of tracks) {
    try {
      track.stop();
    } catch {
      // ignore cleanup failures
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function publishTrackWithRetry(
  liveKitRoom: LiveKitRoom,
  track: MediaStreamTrack,
  options: { name: string; source: Track.Source; simulcast: boolean }
): Promise<void> {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await liveKitRoom.localParticipant.publishTrack(track, options);
      return;
    } catch (error_: unknown) {
      const message = error_ instanceof Error ? error_.message : String(error_);
      const isEngineNotReady = /not connected|engine/i.test(message);
      if (!isEngineNotReady || attempt === attempts) {
        throw error_;
      }
      // The LiveKit engine can still be finishing its handshake right after connect() resolves.
      await sleep(500 * attempt);
    }
  }
}

export function HostMediaStage({ roomId, memberId, displayName, liveKitRoom, liveKitState, onPlaybackCommand, onMediaSelected, onVideoElementReady }: HostMediaStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const publishedTracksRef = useRef<MediaStreamTrack[]>([]);
  const objectUrlRef = useRef<string | null>(null);
  const publishAttemptedRef = useRef(false);
  const manualStopRef = useRef(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [metadata, setMetadata] = useState<MediaMetadata>({ duration: null, width: null, height: null, hasAudio: null });

  const canCapture = supportsVideoCaptureStream(videoRef.current);
  const readyToPublish = Boolean(liveKitRoom) && liveKitState === 'connected' && canCapture && Boolean(fileName);

  const fileSummary = useMemo(() => {
    if (!fileName || fileSize === null) {
      return 'No local video selected yet.';
    }

    const sizeLabel = formatFileSize(fileSize);
    const durationLabel = metadata.duration ? `${Math.round(metadata.duration)}s` : 'unknown duration';
    const resolutionLabel = metadata.width && metadata.height ? `${metadata.width} × ${metadata.height}` : 'unknown resolution';

    return `${fileName} · ${sizeLabel} · ${durationLabel} · ${resolutionLabel}`;
  }, [fileName, fileSize, metadata.duration, metadata.height, metadata.width]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      cleanupTracks(publishedTracksRef.current);
    };
  }, []);

  const unpublishCurrentTracks = async () => {
    if (!liveKitRoom) {
      cleanupTracks(publishedTracksRef.current);
      publishedTracksRef.current = [];
      return;
    }

    for (const track of publishedTracksRef.current) {
      try {
        await liveKitRoom.localParticipant.unpublishTrack(track);
      } catch {
        // ignore unpublish failures during replacement
      }
    }

    cleanupTracks(publishedTracksRef.current);
    publishedTracksRef.current = [];
  };

  const publishCapturedStream = async () => {
    const videoElement = videoRef.current;
    if (!videoElement || !liveKitRoom || liveKitState !== 'connected' || !canCapture) {
      setPublishStatus(canCapture ? 'ready' : 'unsupported');
      return;
    }

    if (publishAttemptedRef.current) {
      return;
    }

    publishAttemptedRef.current = true;
    setPublishStatus('publishing');
    setError(null);

    try {
      await unpublishCurrentTracks();

      const stream = getVideoCaptureStream(videoElement);
      if (!stream) {
        setPublishStatus('unsupported');
        setError('This browser cannot capture a local video element for LiveKit publishing.');
        return;
      }

      const capturedTracks = stream.getTracks();
      if (capturedTracks.length === 0) {
        setPublishStatus('error');
        setError('The selected video did not expose a capturable MediaStream.');
        return;
      }

      const publishedTracks: MediaStreamTrack[] = [];
      for (const track of capturedTracks) {
        console.log('[HostMediaStage] Publishing track:', track.kind, track.id, track.label);
        await publishTrackWithRetry(liveKitRoom, track, {
          name: `${roomId}-${memberId}-${track.kind}`,
          source: track.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone,
          simulcast: track.kind === 'video'
        });

        publishedTracks.push(track);
        console.log('[HostMediaStage] Track published successfully:', track.kind);
      }

      publishedTracksRef.current = publishedTracks;
      setPublishStatus('published');
      console.log('[HostMediaStage] All tracks published, total:', publishedTracks.length);
      onMediaSelected(fileName ?? 'local-video', metadata.duration);
    } catch (error_: unknown) {
      setPublishStatus('error');
      setError(error_ instanceof Error ? error_.message : 'Unable to publish the local video to LiveKit.');
    } finally {
      publishAttemptedRef.current = false;
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!isSupportedLocalVideoFile({ name: file.name, type: file.type, size: file.size })) {
      setError('Unsupported video type. Use MP4, WebM, MOV, or MKV where the browser supports it.');
      setPublishStatus('idle');
      return;
    }

    setError(null);
    setFileName(file.name);
    setFileSize(file.size);
    setMetadata({ duration: null, width: null, height: null, hasAudio: null });
    setPublishStatus(canCapture ? 'ready' : 'unsupported');
    publishAttemptedRef.current = false;
    manualStopRef.current = false;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;

    if (videoRef.current) {
      videoRef.current.src = objectUrl;
      videoRef.current.load();
    }
  };

  const handleLoadedMetadata = () => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

    setMetadata({
      duration: Number.isFinite(videoElement.duration) ? videoElement.duration : null,
      width: videoElement.videoWidth || null,
      height: videoElement.videoHeight || null,
      hasAudio: null
    });
  };

  const publishIfReady = async () => {
    if (!readyToPublish || publishStatus === 'published' || manualStopRef.current) {
      return;
    }

    await publishCapturedStream();
  };

  // Publish as soon as LiveKit + the local file are both ready, instead of only on
  // the video's "play" event, otherwise a publish attempted before LiveKit finishes
  // connecting is silently dropped and never retried.
  useEffect(() => {
    void publishIfReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToPublish]);

  const togglePlayback = () => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }
    if (videoElement.paused) {
      void videoElement.play();
    } else {
      videoElement.pause();
    }
  };

  const toggleMute = () => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }
    videoElement.muted = !videoElement.muted;
    setIsMuted(videoElement.muted);
  };

  const requestFullscreen = () => {
    videoRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <Card className="overflow-hidden border-white/[0.12] bg-white/[0.06]">
      <CardHeader className="space-y-4 border-b border-white/10 bg-gradient-to-br from-white/10 to-transparent">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Host source</Badge>
          <Badge>{publishStatus}</Badge>
          <Badge>LiveKit {liveKitState}</Badge>
        </div>
        <div>
          <CardTitle className="text-2xl">Now Playing</CardTitle>
          <CardDescription>
            {fileName ?? 'Select an authorized local file, preview it in the browser, and publish the captured media track to the room.'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <div className="space-y-3">
          <input
            accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv"
            className="block w-full text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
            type="file"
            onChange={handleFileChange}
          />
          <p className="text-xs text-white/55">Only share media you own or are authorized to distribute.</p>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/40">
          <video
            ref={(node) => {
              videoRef.current = node;
              onVideoElementReady?.(node);
            }}
            className="aspect-video w-full bg-black"
            playsInline
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onError={() => {
              setPublishStatus('error');
              setError('This browser could not decode the selected file. MKV support depends on the codecs inside it — try converting to MP4/H.264 if playback fails.');
            }}
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
            onPause={() => {
              setIsPlaying(false);
              onPlaybackCommand({ type: 'pause', currentTime: videoRef.current?.currentTime ?? 0 });
            }}
            onPlay={() => {
              setIsPlaying(true);
              const currentTime = videoRef.current?.currentTime ?? 0;
              const playbackRate = videoRef.current?.playbackRate ?? 1;
              onPlaybackCommand({ type: 'play', currentTime, playbackRate });
              void publishIfReady();
            }}
            onRateChange={() => onPlaybackCommand({ type: 'rate', playbackRate: videoRef.current?.playbackRate ?? 1 })}
            onSeeked={() => onPlaybackCommand({ type: 'seek', targetTime: videoRef.current?.currentTime ?? 0 })}
          />
          <div className="flex items-center gap-3 border-t border-white/10 bg-black/60 px-4 py-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              type="button"
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <span className="w-24 text-xs tabular-nums text-white/60">
              {formatTime(currentTime)} / {metadata.duration ? formatTime(metadata.duration) : '--:--'}
            </span>
            <input
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-primary"
              max={metadata.duration ?? 0}
              min={0}
              step={0.1}
              type="range"
              value={Math.min(currentTime, metadata.duration ?? currentTime)}
              onChange={(event) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Number(event.target.value);
                }
              }}
            />
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10" type="button" onClick={toggleMute}>
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10" type="button" onClick={requestFullscreen}>
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">{fileSummary}</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
            LiveKit publish: {publishStatus === 'published' ? 'streaming' : canCapture ? 'ready' : 'fallback only'}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!readyToPublish || publishStatus === 'published'}
            variant="secondary"
            onClick={() => {
              manualStopRef.current = false;
              void publishCapturedStream();
            }}
          >
            {publishStatus === 'published' ? 'Publishing active' : 'Publish to room'}
          </Button>
          <Button
            disabled={publishStatus !== 'published'}
            variant="ghost"
            onClick={() => {
              manualStopRef.current = true;
              void unpublishCurrentTracks();
              setPublishStatus(canCapture ? 'ready' : 'unsupported');
            }}
          >
            Stop publishing
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
            Duration: {metadata.duration ? `${Math.round(metadata.duration)}s` : 'unknown'}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
            Size: {fileSize !== null ? formatFileSize(fileSize) : 'unknown'}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
            Resolution: {metadata.width && metadata.height ? `${metadata.width} × ${metadata.height}` : 'unknown'}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
            Audio track: {metadata.hasAudio === null ? 'detected on publish' : metadata.hasAudio ? 'present' : 'absent'}
          </div>
        </div>

        {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
        {!canCapture ? (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            This browser does not expose a local video capture API here, so the host can still preview the file but participants will not receive the stream until a supported browser is used.
          </p>
        ) : null}
        <p className="text-xs text-white/45">
          Room: {roomId}. Host: {displayName}. Media selection remains local; only the browser-captured stream is sent to LiveKit.
        </p>
      </CardContent>
    </Card>
  );
}