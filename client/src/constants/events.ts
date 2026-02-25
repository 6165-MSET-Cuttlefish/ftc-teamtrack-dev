/**
 * Cross-cutting custom event names used for inter-component communication.
 * Centralised here so every producer/consumer references the same constant.
 */


export const TUTORIAL_RESTART_EVENT = 'teamtrack-restart-tutorial';
export const TUTORIAL_OPEN_SESSION_SETUP_EVENT = 'teamtrack-tutorial-open-session-setup';
/** Fired by ScoringMetrics when a shot is confirmed via keyboard (Enter) */
export const TUTORIAL_KEYBOARD_SCORE_EVENT = 'teamtrack-tutorial-keyboard-score';
export const TUTORIAL_GATE_CYCLE_EVENT = 'teamtrack-tutorial-gate-cycle';
export const TUTORIAL_ENDED_EVENT = 'teamtrack-tutorial-ended';
export const TUTORIAL_METRICS_AUTON_TAB_EVENT = 'teamtrack-tutorial-metrics-auton-tab';
export const TUTORIAL_METRICS_LEAVE_EVENT = 'teamtrack-tutorial-metrics-leave';
export const TUTORIAL_METRICS_SHOT_EDIT_EVENT = 'teamtrack-tutorial-metrics-shot-edit';
export const TUTORIAL_METRICS_MOTIF_EDIT_EVENT = 'teamtrack-tutorial-metrics-motif-edit';
