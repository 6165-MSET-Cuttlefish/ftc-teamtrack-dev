import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSessionCore } from '@/contexts';
import type { MatchScoringFields } from '@/types';
import { calculateScore } from '@/lib';
import { visibleBand } from './controls/scrollUnderHeader';
import { SectionNote } from './SectionNote';
import { useScoringLocks } from './useScoringLocks';

/** How long the End of Match heading stays lit after the buzzer */
const UNLOCK_PULSE_MS = 1600;
/** Space left around the section when it is scrolled into view, in px */
const UNLOCK_SCROLL_GAP = 8;

/**
 * Setters, locks and lock captions for the robot and end-of-match fields,
 * shared by the phone layout's MatchEntry and the desktop ScoringPad. Also
 * lights the end-of-match fields at the buzzer and brings them into view:
 * `endSectionRef` goes on whatever holds them (its first `h3`, if it has
 * one, is what has to be on screen; otherwise the whole of it).
 */
export const useMatchEntry = () => {
  const {
    sessionData,
    updateSessionData,
    matchActive,
    matchPhase,
    isTutorialActive,
  } = useSessionCore();
  const {
    editing,
    matchType,
    scoring,
    entryKey,
    awaitingStart,
    endOfMatchUnlocked,
    endParkLocked,
    hasAuto,
    hasTeleop,
  } = useScoringLocks();
  const robotsReasonId = useId();
  const endReasonId = useId();

  // One setter per field, each keeping its identity between renders: the
  // rows and fields below are memoized, so changing one field re-renders
  // that one alone.
  const set = useMemo(() => {
    const setter =
      <K extends keyof MatchScoringFields>(field: K) =>
      (value: MatchScoringFields[K]) =>
        updateSessionData({ [field]: value });
    return {
      robot1Leave: setter('robot1Leave'),
      robot1ParkAuto: setter('robot1ParkAuto'),
      robot1ParkTeleop: setter('robot1ParkTeleop'),
      robot2Leave: setter('robot2Leave'),
      robot2ParkAuto: setter('robot2ParkAuto'),
      robot2ParkTeleop: setter('robot2ParkTeleop'),
      flower: setter('flower'),
      flowerBonus: setter('flowerBonus'),
      ballsInHive: setter('ballsInHive'),
      garden: setter('garden'),
    };
  }, [updateSessionData]);

  const breakdown = calculateScore(scoring);

  /**
   * Flower, hive and garden contents are only knowable once play has
   * stopped, so they stay locked while the clock is running. They open at
   * the buzzer, whenever the match is paused (a match that ends early still
   * has to be scored before it is saved) and before a match starts.
   */
  const endDisabled = !endOfMatchUnlocked;

  // A period the match never runs can't be scored, for the whole match.
  // The reasons share the Robots heading's line, so they are kept short
  // enough to fit beside it on a 360px phone.
  const autoDisabledReason = hasAuto ? undefined : 'No AUTO in a Teleop match';
  const parkTeleopDisabledReason = !hasTeleop
    ? 'No end park in an Autonomous match'
    : endParkLocked
      ? 'Unlocks in TELEOP'
      : undefined;
  // Only one of the two can apply to a match, so one note covers both.
  const robotsReason = autoDisabledReason ?? parkTeleopDisabledReason;

  // The buzzer hands the scorer from the live counters to this section:
  // light its heading for a moment, and bring it into view unless its
  // heading is on screen. A heading that is showing is left where it is;
  // one even partly under the header, under the controls pinned there from
  // now on, or past the bottom edge has the section scrolled into view.
  const endSectionRef = useRef<HTMLDivElement>(null);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const lastPhaseRef = useRef(matchPhase);
  useEffect(() => {
    const previousPhase = lastPhaseRef.current;
    lastPhaseRef.current = matchPhase;
    if (matchPhase !== 'ended' || previousPhase === 'ended') return;
    if (!matchActive || editing) return;
    setJustUnlocked(true);

    // The walkthrough moves the page itself.
    const section = endSectionRef.current;
    if (!section || isTutorialActive) return;
    // Between the site header (and, on a full-size screen, the controls
    // pinned under it from now on) and, on a phone, the bar fixed over the
    // bottom of the page.
    const band = visibleBand();
    const { top, bottom } = section.getBoundingClientRect();
    const heading = (
      section.querySelector('h3') ?? section
    ).getBoundingClientRect();
    if (heading.top >= band.top && heading.bottom <= band.bottom) {
      return;
    }
    // The least movement that shows it: from below, only until its last
    // field clears the bottom edge, so the robot rows above it (End park is
    // scored now too) stay on screen where there is room for both. From
    // above, its heading goes just under the band's top edge.
    const toTop = top - band.top - UNLOCK_SCROLL_GAP;
    const toBottom = bottom - band.bottom + UNLOCK_SCROLL_GAP;
    window.scrollBy({
      top: top >= band.top ? Math.min(toTop, toBottom) : toTop,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }, [matchPhase, matchActive, editing, isTutorialActive]);
  useEffect(() => {
    if (!justUnlocked) return;
    const timer = setTimeout(() => setJustUnlocked(false), UNLOCK_PULSE_MS);
    return () => clearTimeout(timer);
  }, [justUnlocked]);

  // One line under the heading in every state of a live match, so the
  // fields below it stay where they are when the section locks and unlocks.
  // It names the next time they open: in a Full Game that is the controller
  // pickup after AUTO, when the clock stops for 8 s.
  const endCaption = endDisabled ? (
    <SectionNote id={endReasonId} icon="locked">
      {matchType === 'Full Game' && matchPhase === 'auton'
        ? 'Unlocks when AUTO ends, or when you pause'
        : 'Unlocks at the buzzer, or when you pause'}
    </SectionNote>
  ) : editing ? undefined : isTutorialActive ? (
    // The walkthrough's match never runs its clock, so the fields are open;
    // say what happens in a real match, as its card does.
    <SectionNote>
      In a match, these unlock at the buzzer or when you pause
    </SectionNote>
  ) : awaitingStart ? (
    <SectionNote>
      Numbers entered before Start are cleared when the match starts.
      {(sessionData.matches?.length ?? 0) > 0 &&
        ' To fix a saved match, tap it in the Match Log.'}
    </SectionNote>
  ) : (
    <SectionNote icon="unlocked">
      {matchPhase === 'ended'
        ? 'Unlocked. Count what is left on the field'
        : matchPhase === 'controller_pickup'
          ? 'Unlocked until TELEOP starts'
          : 'Unlocked while paused'}
    </SectionNote>
  );

  return {
    sessionData,
    set,
    breakdown,
    entryKey,
    endDisabled,
    autoDisabledReason,
    parkTeleopDisabledReason,
    robotsReason,
    robotsReasonId,
    endReasonId,
    endCaption,
    justUnlocked,
    endSectionRef,
  };
};
