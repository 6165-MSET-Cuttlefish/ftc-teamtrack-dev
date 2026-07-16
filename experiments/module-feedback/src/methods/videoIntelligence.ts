/**
 * Method 1, quantitative layer: Google Cloud Video Intelligence OBJECT_TRACKING.
 *
 * Sends a gs:// clip to annotateVideo with OBJECT_TRACKING (+ shot changes),
 * then condenses the verbose per-frame response into a compact TrackingSummary
 * we can (a) show in the report and (b) hand to the Gemini analysis pass as
 * ground-truth measurement.
 */
import { VideoIntelligenceServiceClient, protos } from '@google-cloud/video-intelligence';
import { config } from '../config.ts';
import { log } from '../logger.ts';
import type { KeyMoment, TrackedObject, TrackedPosition, TrackingSummary } from '../types.ts';

const { Feature } = protos.google.cloud.videointelligence.v1;
type IObjectTrackingAnnotation =
  protos.google.cloud.videointelligence.v1.IObjectTrackingAnnotation;
type IDuration = protos.google.protobuf.IDuration;

const MAX_OBJECTS = 40;
const SAMPLES_PER_OBJECT = 6;

export async function runObjectTracking(gcsUri: string): Promise<TrackingSummary> {
  const client = new VideoIntelligenceServiceClient({
    projectId: config.gcp.project || undefined,
    keyFilename: config.gcp.credentialsPath || undefined,
  });

  log.info('starting OBJECT_TRACKING (this can take a minute or two)…');
  const [operation] = await client.annotateVideo({
    inputUri: gcsUri,
    features: [Feature.OBJECT_TRACKING, Feature.SHOT_CHANGE_DETECTION],
    locationId: config.gcp.videoIntelligenceLocation,
  });
  const [response] = await operation.promise();

  const annotationResults = response.annotationResults?.[0];
  const annotations = annotationResults?.objectAnnotations ?? [];
  log.info(`tracking returned ${annotations.length} tracked object(s)`);

  return summarizeTracking(annotations);
}

/** Condense raw ObjectTrackingAnnotations into the compact summary shape. */
export function summarizeTracking(annotations: IObjectTrackingAnnotation[]): TrackingSummary {
  const objects: TrackedObject[] = annotations
    .slice(0, MAX_OBJECTS)
    .map(toTrackedObject)
    .sort((a, b) => a.firstSeenSec - b.firstSeenSec);

  const labelCounts: Record<string, number> = {};
  for (const o of objects) labelCounts[o.label] = (labelCounts[o.label] ?? 0) + 1;

  return { objects, labelCounts, keyMoments: deriveKeyMoments(objects) };
}

function toTrackedObject(a: IObjectTrackingAnnotation): TrackedObject {
  const frames = a.frames ?? [];
  const positions: TrackedPosition[] = frames.map((f) => {
    const box = f.normalizedBoundingBox ?? {};
    return {
      tSec: round(durationToSeconds(f.timeOffset)),
      left: round(box.left ?? 0),
      top: round(box.top ?? 0),
      right: round(box.right ?? 0),
      bottom: round(box.bottom ?? 0),
    };
  });

  const times = positions.map((p) => p.tSec);
  const segStart = a.segment?.startTimeOffset;
  const segEnd = a.segment?.endTimeOffset;

  // Prefer the annotation's segment; otherwise fall back to the frame times.
  // (Guard the empty case — Math.min/max of no args is ±Infinity, and a bare
  // `Math.min(...times, 0)` floor would wrongly pin firstSeen to 0 since all
  // timestamps are >= 0.)
  const firstSeenSec = segStart
    ? round(durationToSeconds(segStart))
    : times.length
      ? round(Math.min(...times))
      : 0;
  const lastSeenSec = segEnd
    ? round(durationToSeconds(segEnd))
    : times.length
      ? round(Math.max(...times))
      : 0;

  return {
    label: a.entity?.description ?? 'object',
    entityId: a.entity?.entityId ?? undefined,
    confidence: round(a.confidence ?? 0),
    firstSeenSec,
    lastSeenSec,
    sampledPositions: evenSample(positions, SAMPLES_PER_OBJECT),
  };
}

/**
 * Emit a key moment whenever the number of concurrently tracked objects
 * changes — the frames where something enters or leaves the mechanism's view,
 * which is where intake/release events tend to happen.
 */
function deriveKeyMoments(objects: TrackedObject[]): KeyMoment[] {
  const events = objects
    .flatMap((o) => [
      { tSec: o.firstSeenSec, delta: 1, label: o.label },
      { tSec: o.lastSeenSec, delta: -1, label: o.label },
    ])
    .sort((a, b) => a.tSec - b.tSec);

  const moments: KeyMoment[] = [];
  let active = 0;
  let prev = -1;
  for (const e of events) {
    active += e.delta;
    if (round(e.tSec) === round(prev)) continue;
    prev = e.tSec;
    const verb = e.delta > 0 ? 'appears' : 'leaves';
    moments.push({
      tSec: round(e.tSec),
      description: `"${e.label}" ${verb} → ${active} object(s) tracked`,
    });
  }
  return moments.slice(0, 25);
}

function durationToSeconds(d: IDuration | null | undefined): number {
  if (!d) return 0;
  return Number(d.seconds ?? 0) + Number(d.nanos ?? 0) / 1e9;
}

function evenSample<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const step = (items.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => items[Math.round(i * step)]!);
}

const round = (n: number) => Math.round(n * 1000) / 1000;
