export type LocalVideoFile = {
  name: string;
  type: string;
  size: number;
};

type CaptureAwareVideoElement = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

const SUPPORTED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']);
const SUPPORTED_VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'mkv']);

export function isSupportedLocalVideoFile(file: LocalVideoFile): boolean {
  if (file.type && SUPPORTED_VIDEO_TYPES.has(file.type)) {
    return true;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  return Boolean(extension && SUPPORTED_VIDEO_EXTENSIONS.has(extension));
}

export function supportsVideoCaptureStream(videoElement: HTMLVideoElement | null): boolean {
  if (!videoElement) {
    return false;
  }

  const captureAwareVideoElement = videoElement as CaptureAwareVideoElement;
  return typeof captureAwareVideoElement.captureStream === 'function' || typeof captureAwareVideoElement.mozCaptureStream === 'function';
}

export function getVideoCaptureStream(videoElement: HTMLVideoElement): MediaStream | null {
  const captureAwareVideoElement = videoElement as CaptureAwareVideoElement;

  if (typeof captureAwareVideoElement.captureStream === 'function') {
    return captureAwareVideoElement.captureStream();
  }

  const mozCaptureStream = captureAwareVideoElement.mozCaptureStream;
  return mozCaptureStream ? mozCaptureStream.call(videoElement) : null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}