/**
 * The prompt scaffolding for the tuned model.
 *
 * CRITICAL: these strings go into the training JSONL *and* into every inference
 * call. A tuned model is sensitive to the scaffolding it was trained under, so
 * `buildJsonl` and `evaluate` both import from here rather than re-typing the
 * text. Changing either string invalidates an existing tuned model — retune.
 */

/**
 * Phase 1 Option A (the default): the model learns to OBSERVE in FTC
 * vocabulary. The "suggestions for improvement" layer stays in the prompt-based
 * methods that run on top. See PLAN.md Phase 1.
 */
export const SYSTEM_INSTRUCTION =
  'You are an FTC (FIRST Tech Challenge) build-team reviewer. You watch a short clip ' +
  'of one robot mechanism and describe it in precise FTC build vocabulary: mechanism ' +
  'type, roller and wheel types (compliant, vector, surgical tubing, grip, rubber band), ' +
  'whether the intake is full-width, wedge shape and placement, hinged or fixed, and how ' +
  'well it actually performs. Be terse and factual. Describe only what is visible.';

/**
 * The user-side task marker. Kept short and constant — the video carries the
 * signal, this text just marks the task. Must be byte-identical at train and
 * inference time.
 */
export const USER_PROMPT = 'Describe this FTC mechanism.';

/**
 * Few-shot baseline prompt (PLAN.md Phase 2). This is the control condition the
 * tuned model has to beat — not the plain prompt. Examples are captions drawn
 * from the training split only, never the eval split.
 */
export function buildFewShotPrompt(examples: Array<{ caption: string }>): string {
  const shown = examples
    .map((e, i) => `Example ${i + 1}: ${e.caption}`)
    .join('\n');
  return `${SYSTEM_INSTRUCTION}

Here are examples of the exact style and vocabulary to match. Match their length, tone, and terminology:

${shown}

Now describe the attached clip in that same style.`;
}
