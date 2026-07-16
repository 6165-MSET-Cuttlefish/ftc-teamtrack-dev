/**
 * Prompts for the qualitative "Suggestions for Improvement" layer.
 *
 * The output contract is the same across methods so `compare` can line the
 * results up. We ask for strict JSON matching the shape below and parse it
 * defensively (see gemini.ts `extractJson`).
 */
import type { TrackingSummary } from './types.ts';

/** The JSON contract we ask every analysis model to emit. */
export const RESPONSE_CONTRACT = `Respond with ONLY a JSON object (no markdown fences, no prose) of this exact shape:
{
  "summary": string,                     // one or two sentences on the mechanism overall
  "suggestions": [                       // the "Suggestions for Improvement" table
    {
      "observation": string,             // what you SEE in the video (Observation / Issue)
      "suggestedModification": string,   // a concrete mechanical change (Suggested Modification)
      "severity": "low" | "medium" | "high",
      "confidence": number               // 0..1, how sure you are this issue is real
    }
  ],
  "measurements": [                      // quantitative reads, when you can make them
    {
      "label": string,                   // e.g. "Game elements intaked"
      "value": number | string,
      "unit": string,                    // "" if none
      "detail": string,                  // e.g. per-clip breakdown, "" if none
      "confidence": number               // 0..1
    }
  ]
}`;

const ROLE = `You are a veteran FIRST Tech Challenge (FTC) mechanical mentor reviewing video of ONE robot mechanism (intake, shooter, arm, drivetrain, etc.). Your job is to give the build team concrete, buildable improvements — the kind you'd sketch on a whiteboard: roller material, compliance, gearing, geometry, mounting, spacing. Avoid generic advice ("test more", "iterate"); every suggestion must name a physical change to the robot.`;

/** Method 1 qualitative pass: video + the tracking JSON from Video Intelligence. */
export function buildMethod1Prompt(tracking: TrackingSummary | null): string {
  const trackingBlock = tracking
    ? `\n\nAn object-tracking pass (Google Cloud Video Intelligence, OBJECT_TRACKING) already ran on this clip. Use it as ground-truth measurement — reason over these concrete numbers, don't just eyeball the pixels:\n\`\`\`json\n${JSON.stringify(tracking, null, 2)}\n\`\`\``
    : '';
  return `${ROLE}

Analyze the attached robot video. Identify what the mechanism does well and, more importantly, where it fails — dropped/batted game elements, dead zones, inconsistent grip, jams, plowing, snagging. For each problem, give the specific mechanical fix.${trackingBlock}

Also report quantitative measurements you can support from the video and tracking data (e.g. how many game elements were successfully intaked, cycle time, drops).

${RESPONSE_CONTRACT}`;
}

/**
 * Method 2 pass: TwelveLabs Pegasus. A video-native generative model that both
 * understands and describes the clip in one pass — no separate tracking layer,
 * and no Gemini. This is the fully self-contained, free-tier-friendly path.
 */
export function buildMethod2Prompt(): string {
  return `${ROLE}

Analyze the attached robot video. Identify what the mechanism does well and, more importantly, where it fails — dropped/batted game elements, dead zones, inconsistent grip, jams, plowing, snagging. For each problem, give the specific mechanical fix. Use the audio and visuals; note the timestamps where problems happen.

Also report quantitative measurements you can support from the video (e.g. how many game elements were successfully intaked, per-clip if the video has cuts).

${RESPONSE_CONTRACT}`;
}

/**
 * Method 3 pass: Gemini Robotics-ER. This model is built for spatial/physical
 * reasoning, so we lean on it to reason about geometry and contact directly
 * from the pixels (no separate tracking JSON).
 */
export function buildMethod3Prompt(): string {
  return `${ROLE}

You are Gemini Robotics-ER, with strong spatial and physical reasoning. Analyze the attached robot video by reasoning about geometry, contact points, forces, and timing: where does the mechanism make/break contact with game elements, where is grip lost, where does motion stall or objects get plowed or snagged? Turn that physical reasoning into concrete mechanical fixes.

Report quantitative measurements you can support (e.g. number of game elements intaked, per-clip if the video has cuts).

${RESPONSE_CONTRACT}`;
}
