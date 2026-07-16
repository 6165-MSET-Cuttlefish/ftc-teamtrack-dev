import type { TimestampValue } from './session';

/** A single detected robot bounding box, normalized 0-1000 as [ymin, xmin, ymax, xmax] */
export interface DetectionBox {
  label: string;
  box_2d: [number, number, number, number];
}

/** Robot detections for one sampled video frame */
export interface TrackingFrame {
  tSec: number;
  boxes: DetectionBox[];
}

/** A single coaching observation/suggestion pair from the analysis model */
export interface AnalysisFinding {
  observation: string;
  suggestion: string;
}

export interface AnalysisReport {
  summary: string;
  findings: AnalysisFinding[];
}

/** A saved robot video analysis, scoped to a team */
export interface VideoAnalysis {
  id: string;
  teamId: string;
  uploaderId: string;
  uploaderName?: string;
  createdAt: TimestampValue;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  durationSec: number;
  tracking: TrackingFrame[];
  report: AnalysisReport;
  status: 'complete' | 'error';
  errorMessage?: string;
}

/** Data needed to create a new video analysis record */
export type CreateVideoAnalysisData = Omit<VideoAnalysis, 'id' | 'createdAt'>;

/** Response shape returned by the Cloudflare Worker's /analyze endpoint */
export interface AnalyzeResponse {
  tracking: TrackingFrame[];
  report: AnalysisReport;
}
