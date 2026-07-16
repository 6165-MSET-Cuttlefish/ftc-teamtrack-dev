/**
 * Shared domain types for the module-feedback POC.
 *
 * The product goal (from the planning doc) is a "Suggestions for Improvement"
 * report for an FTC robot mechanism: qualitative advice (Observation/Issue →
 * Suggested Modification) plus a few quantitative measurements (e.g. how many
 * game elements the intake actually grabbed).
 */

export type Method = 'method1' | 'method2' | 'method3';

export type Severity = 'low' | 'medium' | 'high';

/** One row of the "Suggestions for Improvement" table. */
export interface Suggestion {
  /** What was seen in the video (the "Observation / Issue" column). */
  observation: string;
  /** Concrete change to the mechanism (the "Suggested Modification" column). */
  suggestedModification: string;
  /** How impactful the issue looks, if the model committed to one. */
  severity?: Severity;
  /** Model's self-reported confidence, 0..1, when available. */
  confidence?: number;
}

/** A counted / measured quantity, e.g. "balls intaked: 9". */
export interface Measurement {
  label: string;
  value: number | string;
  unit?: string;
  /** Optional per-item breakdown, e.g. per-clip ball counts. */
  detail?: string;
  confidence?: number;
}

/** Normalized result any method returns, so `compare` can show them side by side. */
export interface AnalysisReport {
  method: Method;
  /** Human label, e.g. "Method 1 — Video Intelligence + Gemini". */
  methodLabel: string;
  model: string;
  /** ISO timestamp of when the analysis ran. */
  generatedAtIso: string;
  /** What was analyzed — a local path or a gs:// URI. */
  videoRef: string;
  suggestions: Suggestion[];
  measurements: Measurement[];
  /** One or two sentence overall read on the mechanism. */
  summary?: string;
  /** Raw model text, kept for debugging / auditing the qualitative layer. */
  rawText?: string;
  /** Structured quantitative layer, when a method produced one. */
  tracking?: TrackingSummary;
  /** Whether this ran against real APIs or the offline fixtures. */
  mock: boolean;
  /** Non-fatal problems (missing creds, parse fallback, etc.). */
  warnings: string[];
}

// ── Segmentation (Pegasus 1.5 structured per-attempt analysis) ──────────────

export type AttemptOutcome = 'captured' | 'dropped' | 'missed' | 'batted_away';

/** One intake attempt the model localized in time. */
export interface IntakeAttempt {
  /** When the attempt happens, in seconds into the (combined) clip. */
  tSec: number;
  ballColor: string;
  outcome: AttemptOutcome;
  note: string;
}

/** Result of a Pegasus 1.5 structured segmentation pass. */
export interface SegmentationReport {
  model: string;
  generatedAtIso: string;
  videoRef: string;
  durationSec?: number;
  summary?: string;
  attempts: IntakeAttempt[];
  /** Attempt counts keyed by outcome (captured/dropped/missed/batted_away). */
  counts: Record<AttemptOutcome, number>;
  suggestions: Suggestion[];
  mock: boolean;
  warnings: string[];
}

// ── Video Intelligence (Method 1 quantitative layer) ────────────────────────

/** A single tracked object across the clip, condensed for prompting/reporting. */
export interface TrackedObject {
  label: string;
  entityId?: string;
  confidence: number;
  firstSeenSec: number;
  lastSeenSec: number;
  /** A handful of sampled bounding boxes so trajectories stay readable. */
  sampledPositions: TrackedPosition[];
}

export interface TrackedPosition {
  tSec: number;
  /** Normalized 0..1 bounding box (Video Intelligence convention). */
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A moment worth sending to the qualitative pass. */
export interface KeyMoment {
  tSec: number;
  description: string;
}

/** Compact summary of the OBJECT_TRACKING pass, safe to feed to Gemini. */
export interface TrackingSummary {
  objects: TrackedObject[];
  keyMoments: KeyMoment[];
  /** Distinct object labels seen, with counts. */
  labelCounts: Record<string, number>;
}
