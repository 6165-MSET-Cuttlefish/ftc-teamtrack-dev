/**
 * Offline fixtures for `--mock` mode. These let the full pipeline run — and the
 * report render — with no API keys, no GCP, and no network. Handy for demoing
 * the output shape and for verifying the plumbing.
 *
 * The content mirrors the "Suggestions for Improvement" table and ball counts
 * from the planning doc's screenshots, so the demo shows the real target shape.
 */
import type { TrackingSummary } from '../types.ts';

/** Stand-in for the OBJECT_TRACKING pass: four balls entering an intake. */
export const mockTrackingSummary: TrackingSummary = {
  objects: [
    {
      label: 'ball',
      entityId: '/m/018xm',
      confidence: 0.91,
      firstSeenSec: 0.4,
      lastSeenSec: 1.6,
      sampledPositions: [
        { tSec: 0.4, left: 0.62, top: 0.55, right: 0.74, bottom: 0.7 },
        { tSec: 1.0, left: 0.48, top: 0.58, right: 0.6, bottom: 0.72 },
        { tSec: 1.6, left: 0.33, top: 0.6, right: 0.45, bottom: 0.74 },
      ],
    },
    {
      label: 'ball',
      entityId: '/m/018xm',
      confidence: 0.88,
      firstSeenSec: 1.2,
      lastSeenSec: 2.9,
      sampledPositions: [
        { tSec: 1.2, left: 0.66, top: 0.5, right: 0.78, bottom: 0.66 },
        { tSec: 2.0, left: 0.55, top: 0.54, right: 0.67, bottom: 0.69 },
        { tSec: 2.9, left: 0.41, top: 0.57, right: 0.53, bottom: 0.71 },
      ],
    },
    {
      label: 'wheel',
      entityId: '/m/083wq',
      confidence: 0.79,
      firstSeenSec: 0.0,
      lastSeenSec: 4.0,
      sampledPositions: [
        { tSec: 0.0, left: 0.2, top: 0.72, right: 0.35, bottom: 0.9 },
        { tSec: 4.0, left: 0.2, top: 0.72, right: 0.35, bottom: 0.9 },
      ],
    },
  ],
  labelCounts: { ball: 2, wheel: 1 },
  keyMoments: [
    { tSec: 0.4, description: '"ball" appears → 1 object(s) tracked' },
    { tSec: 1.2, description: '"ball" appears → 2 object(s) tracked' },
    { tSec: 1.6, description: '"ball" leaves → 1 object(s) tracked' },
    { tSec: 2.9, description: '"ball" leaves → 0 object(s) tracked' },
  ],
};

/** The JSON a healthy Method 1 (Gemini) analysis pass would return. */
export const mockMethod1Json = {
  summary:
    'Compliant-flap ball intake that pulls elements in reliably at center but bats them away at the edges and occasionally plows instead of grabbing.',
  suggestions: [
    {
      observation: 'Balls are batted away by the front roller instead of being pulled in',
      suggestedModification:
        'Lower the front roller axis so the intake material strikes the ball slightly above its equator, forcing the object down and backward into your chassis.',
      severity: 'high',
      confidence: 0.8,
    },
    {
      observation: 'Edge dead zones — balls near the outer edges are not captured',
      suggestedModification:
        'Mount mecanum or compliant vectoring wheels on the outer edges of the front roller to funnel objects inward toward the center.',
      severity: 'medium',
      confidence: 0.72,
    },
    {
      observation: 'Inconsistent grip on the balls',
      suggestedModification:
        'Swap the rigid flaps for 2-inch or 3-inch compliant wheels or star wheels, which conform better to the surface of the balls.',
      severity: 'medium',
      confidence: 0.7,
    },
    {
      observation: 'Roller plows the objects forward rather than intaking them',
      suggestedModification:
        'Gear the roller so its surface speed is 1.5–2× the maximum forward driving speed of your drivetrain.',
      severity: 'high',
      confidence: 0.68,
    },
    {
      observation: 'Internal snagging as balls transition into the robot',
      suggestedModification:
        'Install a smooth, angled polycarbonate ramp directly behind the front roller for a low-friction transition into the robot.',
      severity: 'low',
      confidence: 0.65,
    },
  ],
  measurements: [
    {
      label: 'Game elements intaked',
      value: 9,
      unit: 'balls',
      detail: 'Clip 1: 2, Clip 2: 3, Clip 3: 2, Clip 4: 2',
      confidence: 0.6,
    },
  ],
};

/** The JSON a Method 2 (TwelveLabs Pegasus) pass would return — video-native, uses audio too. */
export const mockMethod2Json = {
  summary:
    'Pegasus read the full clip (visual + audio): the intake grabs center-fed balls well but the motor bogs down audibly on edge feeds, and two balls are batted back out.',
  suggestions: [
    {
      observation:
        'At 0:03 and 0:06 the roller contacts the ball too low and bats it back out instead of pulling it in',
      suggestedModification:
        'Lower the front roller axis so the intake surface strikes the ball just above its equator, driving it down and back into the chassis.',
      severity: 'high',
      confidence: 0.77,
    },
    {
      observation:
        'Audible motor bog-down when a ball enters near the outer edge — the roller stalls before the ball is captured',
      suggestedModification:
        'Add compliant vectoring wheels at the outer edges to funnel edge balls toward center, and gear the roller for ~1.5–2× drivetrain speed so it does not stall.',
      severity: 'medium',
      confidence: 0.7,
    },
    {
      observation: 'Grip is inconsistent — balls slip on the rigid flaps during the hand-off at 0:05',
      suggestedModification:
        'Replace the rigid flaps with 2–3 inch compliant/star wheels for a more forgiving grip through the transition.',
      severity: 'medium',
      confidence: 0.68,
    },
  ],
  measurements: [
    {
      label: 'Game elements intaked',
      value: 7,
      unit: 'balls',
      detail: 'Pegasus: 9 attempts, 7 captured, 2 batted out (0:03, 0:06)',
      confidence: 0.64,
    },
  ],
};

/** The JSON a Method 3 (Robotics-ER) pass would return — spatial-reasoning flavored. */
export const mockMethod3Json = {
  summary:
    'Spatial reasoning shows the contact point between roller and ball sits below the ball center, so the normal force vector pushes elements away rather than under the robot.',
  suggestions: [
    {
      observation:
        'Contact point between roller and ball is below the ball centroid, so the force vector points outward/up (batting the ball away)',
      suggestedModification:
        'Raise the contact line above the ball equator: drop the roller axle ~1–2 cm or increase roller diameter so the tangent contact lands on the upper hemisphere.',
      severity: 'high',
      confidence: 0.74,
    },
    {
      observation: 'Ball trajectories converge to center; outer ~20% of the intake width is unused',
      suggestedModification:
        'Add angled guide rails (≈15°) at both outer edges to widen the effective capture zone toward the mechanism center.',
      severity: 'medium',
      confidence: 0.66,
    },
    {
      observation: 'Roller angular velocity appears comparable to drivetrain approach speed, causing stall/plow at contact',
      suggestedModification:
        'Increase roller surface speed to ~1.5–2× drivetrain speed so the tangential velocity clears the ball before the robot overruns it.',
      severity: 'high',
      confidence: 0.62,
    },
  ],
  measurements: [
    {
      label: 'Game elements intaked',
      value: 8,
      unit: 'balls',
      detail: 'Robotics-ER counted 8 successful captures; 1 marginal near a cut',
      confidence: 0.5,
    },
  ],
};
