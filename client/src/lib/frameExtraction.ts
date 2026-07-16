import { VIDEO_LIMITS } from '@/constants';

/** Sampled video frame ready to send to the robot-tracking model */
export interface ExtractedFrame {
  tSec: number;
  /** Base64-encoded JPEG data, without the `data:image/jpeg;base64,` prefix */
  base64Jpeg: string;
}

/** Read a video file's duration in seconds without fully decoding it */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video metadata. Is this a valid video file?'));
    };
  });
}

/**
 * Sample frames from a video file at a fixed interval by seeking a hidden
 * <video> element and drawing each frame to a <canvas>. Used instead of
 * relying on Gemini's own ~1fps video sampling so we can cap the exact
 * number of model calls made per upload (rate-limit safety on the free tier).
 */
export function extractFrames(
  file: File,
  opts: { intervalSeconds?: number; maxFrames?: number } = {}
): Promise<ExtractedFrame[]> {
  const intervalSeconds = opts.intervalSeconds ?? VIDEO_LIMITS.FRAME_INTERVAL_SECONDS;
  const maxFrames = opts.maxFrames ?? VIDEO_LIMITS.MAX_FRAMES;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onerror = () => {
      cleanup();
      reject(new Error('Could not read video for frame extraction.'));
    };

    video.onloadedmetadata = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable.');

        const timestamps: number[] = [];
        for (let t = 0; t < video.duration && timestamps.length < maxFrames; t += intervalSeconds) {
          timestamps.push(t);
        }
        if (timestamps.length === 0) timestamps.push(0);

        const frames: ExtractedFrame[] = [];
        for (const tSec of timestamps) {
          await seekTo(video, tSec);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          frames.push({ tSec, base64Jpeg: dataUrl.split(',')[1] ?? '' });
        }

        cleanup();
        resolve(frames);
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error('Frame extraction failed.'));
      }
    };
  });
}

function seekTo(video: HTMLVideoElement, tSec: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = tSec;
  });
}
