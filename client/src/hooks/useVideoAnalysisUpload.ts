import { useState, useCallback } from 'react';
import { getFirebase, getVideoDuration, extractFrames, getErrorMessage, logger } from '@/lib';
import { uploadVideo, videoAnalysisService } from '@/services';
import { VIDEO_LIMITS } from '@/constants';
import type { AnalyzeResponse, VideoAnalysis } from '@/types';

const WORKER_URL = import.meta.env.VITE_GEMINI_WORKER_URL ?? '';

export type UploadStage =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'analyzing'
  | 'saving'
  | 'done'
  | 'error';

interface UseVideoAnalysisUploadArgs {
  teamId: string;
  uploaderId: string;
  uploaderName?: string;
}

export const useVideoAnalysisUpload = ({
  teamId,
  uploaderId,
  uploaderName,
}: UseVideoAnalysisUploadArgs) => {
  const [stage, setStage] = useState<UploadStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStage('idle');
    setError(null);
  }, []);

  const upload = useCallback(
    async (file: File): Promise<VideoAnalysis | null> => {
      setError(null);

      if (!WORKER_URL) {
        setStage('error');
        setError(
          'Video analysis isn’t configured yet — VITE_GEMINI_WORKER_URL is unset.'
        );
        return null;
      }

      try {
        setStage('validating');
        if (file.size > VIDEO_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024) {
          throw new Error(`Video must be under ${VIDEO_LIMITS.MAX_FILE_SIZE_MB}MB.`);
        }
        const durationSec = await getVideoDuration(file);
        if (durationSec > VIDEO_LIMITS.MAX_DURATION_SECONDS) {
          throw new Error(
            `Video is ${durationSec.toFixed(1)}s — must be under ${VIDEO_LIMITS.MAX_DURATION_SECONDS}s.`
          );
        }

        setStage('uploading');
        const [frames, uploadResult] = await Promise.all([
          extractFrames(file),
          uploadVideo(file),
        ]);

        const firebase = await getFirebase();
        const idToken = await firebase?.auth.currentUser?.getIdToken();
        if (!idToken) {
          throw new Error('You must be signed in to analyze video.');
        }

        setStage('analyzing');
        const response = await fetch(`${WORKER_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken,
            teamId,
            frames: frames.map((f) => ({ tSec: f.tSec, base64Jpeg: f.base64Jpeg })),
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || `Analysis failed (${response.status}).`);
        }

        const { tracking, report } = (await response.json()) as AnalyzeResponse;

        setStage('saving');
        const saved = await videoAnalysisService.createVideoAnalysis({
          teamId,
          uploaderId,
          uploaderName,
          cloudinaryUrl: uploadResult.url,
          cloudinaryPublicId: uploadResult.publicId,
          durationSec: uploadResult.durationSec || durationSec,
          tracking,
          report,
          status: 'complete',
        });

        setStage('done');
        return saved;
      } catch (err) {
        logger.error('Video analysis upload failed', err);
        setStage('error');
        setError(getErrorMessage(err));
        return null;
      }
    },
    [teamId, uploaderId, uploaderName]
  );

  return { stage, error, upload, reset };
};
