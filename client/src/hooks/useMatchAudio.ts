/**
 * The match sound, match-audio.mp3: one Full Game (see `matchAudioTime`) of
 * FIRST's own sounds from FTC Live 8.0.0-beta.3, the BIOBUZZ scoring
 * system, each at the time FTC Live plays it. By their cue in the manual's
 * Table 9-1:
 *
 *   File s  Full Game clock  Table 9-1 cue                    FTC Live sound
 *    1.000  3-2-1            (the app's 3-2-1 before AUTO)    3-2-1.flac
 *    4.000  2:30             MATCH start: Cavalry Charge      charge.flac
 *   34.000  2:00             AUTO ends: Buzzer x3             endauto.flac
 *   36.000  pickup 0:06      AUTO to TELEOP Transition:       controllers.flac
 *                              "Drivers, pick up your
 *   39.000  pickup 0:03        controllers, 3-2-1"            3-2-1.flac
 *   42.000  2:00             TELEOP begins: 3 Bells           firebell.flac
 *  102.000  1:00             FLOWER Ownership Unlocked [TBD]  windchimes.flac
 *  142.000  0:20             Final 20 seconds: Train Whistle  whistle.flac
 *  162.000  0:00             MATCH end: 3-second Buzzer       endmatch.flac
 *
 * The manual still has [TBD] for the 1:00 sound as of TU03 (2026-10-01);
 * the wind chimes are what FTC Live plays there. Re-check when FTC Live
 * 8.0.0 final or a new Team Update ships. Left out: the optional "This MATCH
 * begins in 3, 2, 1, GO" (countdown.flac) and the Foghorn of a MATCH
 * stopped. Built by laying each sound at its file time, at FIRST's level
 * (FTC Live plays each at full volume), with silence between (167.5 s),
 * then ffmpeg libmp3lame mono 64 kb/s.
 *
 * Imported rather than kept in public/, so its URL carries a hash of the
 * file: the times in `matchAudioTime` belong to this track, and a phone that
 * cached an earlier one under the same name would play it against them.
 */

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/contexts';
import { STORAGE_KEYS } from '@/constants';
import {
  clockAudioTime,
  matchAudioStopTime,
  matchAudioTime,
} from '@/lib/matchAudioTime';
import matchAudioUrl from '@/assets/audio/match-audio.mp3';

interface TeamTrackWindow extends Window {
  __teamtrack_match_audio__?: HTMLAudioElement;
  __teamtrack_audio_persist_interval__?: ReturnType<typeof setInterval> | null;
  /** Takes this module's listeners back off the shared element (hot reload) */
  __teamtrack_match_audio_unwire__?: () => void;
}
const ttWindow = window as TeamTrackWindow;

/** Furthest the audio may be from the match clock before it is moved, in seconds */
const MAX_AUDIO_DRIFT = 0.5;
/** Shortest gap between two attempts to re-download a failed track, in ms */
const RELOAD_RETRY_MS = 3000;

const SOUND_UNAVAILABLE_TOAST_ID = 'match-sound-unavailable';

const clearAudioState = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.AUDIO_STATE);
  } catch {
    /* storage unavailable */
  }
};

/**
 * A download that failed leaves the element with nothing to play. (It also
 * leaves it in NETWORK_NO_SOURCE, but so does the moment between setting
 * `src` and the fetch starting, so only the error is a reliable sign.)
 */
const isAudioBroken = (audio: HTMLAudioElement) => audio.error !== null;

let lastReloadAt = 0;

/**
 * The element is created once per visit, so a download that failed (offline
 * or a blip at that moment) would leave every match silent. Fetch the track
 * again instead. Returns true if it did: the element starts over from 0.
 */
const reloadIfBroken = (audio: HTMLAudioElement, force = false): boolean => {
  if (!isAudioBroken(audio)) return false;
  const now = Date.now();
  if (!force && now - lastReloadAt < RELOAD_RETRY_MS) return false;
  lastReloadAt = now;
  audio.load();
  return true;
};

/**
 * Listeners that belong to the element rather than to /active, so they keep
 * working while the match plays on with another page open.
 */
const wireGlobalAudio = (audio: HTMLAudioElement) => {
  ttWindow.__teamtrack_match_audio_unwire__?.();

  const handleOnline = () => {
    reloadIfBroken(audio, true);
  };

  audio.addEventListener('ended', clearAudioState);
  window.addEventListener('online', handleOnline);

  ttWindow.__teamtrack_match_audio_unwire__ = () => {
    audio.removeEventListener('ended', clearAudioState);
    window.removeEventListener('online', handleOnline);
  };
};

let wiredAudio: HTMLAudioElement | null = null;

const getOrCreateGlobalAudio = (): HTMLAudioElement => {
  if (!ttWindow.__teamtrack_match_audio__) {
    const audio = new Audio();
    // Buffer the whole track up front, so Start never waits on the network.
    audio.preload = 'auto';
    audio.src = matchAudioUrl;
    audio.volume = 0.8;
    ttWindow.__teamtrack_match_audio__ = audio;
  }
  const audio = ttWindow.__teamtrack_match_audio__;
  if (wiredAudio !== audio) {
    wiredAudio = audio;
    wireGlobalAudio(audio);
  }
  reloadIfBroken(audio);
  return audio;
};

let soundToastShown = false;

/** Start playback, and say so (once) if the track can't be played. */
const playMatchAudio = (audio: HTMLAudioElement) => {
  audio.play().then(
    () => {
      soundToastShown = false;
    },
    (error: unknown) => {
      const name = error instanceof DOMException ? error.name : '';
      // AbortError: a pause or seek got in first. NotAllowedError: the
      // browser wants a tap first (a reload mid-match); the next tick retries.
      if (name === 'AbortError' || name === 'NotAllowedError') return;
      if (soundToastShown) return;
      soundToastShown = true;
      toast.error('Match sound unavailable', {
        id: SOUND_UNAVAILABLE_TOAST_ID,
      });
    }
  );
};

/** True if playback can move to `time` without waiting on the network. */
const isBuffered = (audio: HTMLAudioElement, time: number) => {
  for (let i = 0; i < audio.buffered.length; i++) {
    if (audio.buffered.start(i) <= time && time < audio.buffered.end(i)) {
      return true;
    }
  }
  return false;
};

let globalPersistRefCount = 0;

const clearPersistInterval = () => {
  if (ttWindow.__teamtrack_audio_persist_interval__) {
    clearInterval(ttWindow.__teamtrack_audio_persist_interval__);
    ttWindow.__teamtrack_audio_persist_interval__ = null;
  }
};

const startGlobalAudioPersistence = () => {
  globalPersistRefCount++;
  if (ttWindow.__teamtrack_audio_persist_interval__) {
    return;
  }

  const audio = getOrCreateGlobalAudio();

  ttWindow.__teamtrack_audio_persist_interval__ = setInterval(() => {
    if (audio.paused) {
      // Kept alive past /active only for as long as the match played on.
      if (globalPersistRefCount === 0) clearPersistInterval();
      return;
    }
    try {
      sessionStorage.setItem(
        STORAGE_KEYS.AUDIO_STATE,
        JSON.stringify({
          isPlaying: true,
          currentTime: audio.currentTime,
          lastUpdated: Date.now(),
        })
      );
    } catch {
      /* storage unavailable */
    }
  }, 500);
};

const stopGlobalAudioPersistence = () => {
  globalPersistRefCount = Math.max(0, globalPersistRefCount - 1);
  // A match keeps playing after /active is left, so keep storing its place.
  if (globalPersistRefCount === 0 && getOrCreateGlobalAudio().paused) {
    clearPersistInterval();
  }
};

interface MatchAudioState {
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
}

const getAudioState = (): MatchAudioState | null => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEYS.AUDIO_STATE);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const useMatchAudio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedRef = useRef<boolean>(false);
  const audioTailTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  /**
   * Where the audio belonged at a moment, read off the match clock to the
   * millisecond. From there it moves on with the page's steady clock, which
   * a change to the device clock between two ticks doesn't move.
   */
  const syncPointRef = useRef<{ audioTime: number; at: number } | null>(null);
  const {
    matchActive,
    matchPhase,
    isTimerRunning,
    isPickupPaused,
    timer,
    phaseTimer,
    isTutorialActive,
    sessionData,
    getMatchClock,
  } = useSession();

  /**
   * The match is under way and its clock counting. The track plays on
   * through controller pickup, so there that is the pickup countdown, which
   * can be paused on its own.
   */
  const counting =
    matchActive &&
    timer > 0 &&
    (matchPhase === 'controller_pickup' ? !isPickupPaused : isTimerRunning);

  /**
   * Where the track belongs now. From the clock's anchors, not the whole
   * seconds on screen: a clock put back by an Undo, or a pickup paused,
   * stands mid-second.
   */
  const getExpectedAudioTime = useCallback(
    () => clockAudioTime(getMatchClock(), sessionData.matchType, Date.now()),
    [getMatchClock, sessionData.matchType]
  );

  /**
   * Pull the audio back onto the match clock if it has wandered: it started
   * before it had buffered, stalled, or was moved from somewhere else. Only
   * ever to a buffered position, so the fix can't itself stall playback.
   */
  const correctDrift = useCallback(() => {
    const audio = audioRef.current;
    const sync = syncPointRef.current;
    if (
      !audio ||
      !sync ||
      audio.paused ||
      audio.seeking ||
      audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
    ) {
      return;
    }
    const expected = sync.audioTime + (performance.now() - sync.at) / 1000;
    if (
      Math.abs(audio.currentTime - expected) > MAX_AUDIO_DRIFT &&
      isBuffered(audio, expected)
    ) {
      audio.currentTime = expected;
    }
  }, []);

  useEffect(() => {
    const audio = getOrCreateGlobalAudio();
    audioRef.current = audio;
    startGlobalAudioPersistence();

    if (!audio.paused) {
      // Still playing from before /active was left: it never lost its place,
      // so it must not be started again from the countdown.
      hasPlayedRef.current = true;
    } else {
      const savedState = getAudioState();
      if (savedState && savedState.isPlaying) {
        const timeSinceSave = Date.now() - savedState.lastUpdated;
        if (timeSinceSave < 10000) {
          audio.currentTime = Math.max(
            0,
            savedState.currentTime + timeSinceSave / 1000
          );
          playMatchAudio(audio);
          hasPlayedRef.current = true;
        }
      }
    }

    // Playback that starts late (still buffering at Start) is behind the
    // clock from its first sound; catch it up as soon as it gets going.
    audio.addEventListener('playing', correctDrift);
    audio.addEventListener('canplay', correctDrift);

    return () => {
      audio.removeEventListener('playing', correctDrift);
      audio.removeEventListener('canplay', correctDrift);
      stopGlobalAudioPersistence();
    };
  }, [correctDrift]);

  // The tutorial's practice match is silent for as long as the tour is up,
  // whatever its clock does: its clock never runs, but End early still cues
  // the buzzer.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = isTutorialActive;
  }, [isTutorialActive]);

  // The track plays while the clock counts, from where the clock is, and
  // stops where it is when the clock stops short of the buzzer (a pause).
  // Run on every tick, so a play the browser refused (a reload mid-match,
  // before any tap) is tried again.
  useEffect(() => {
    const audio = audioRef.current;
    if (!matchActive || !audio) return;
    if (counting) {
      if (audio.paused || isAudioBroken(audio)) {
        // Nothing to resume if the track is broken and can't be refetched yet
        if (isAudioBroken(audio) && !reloadIfBroken(audio)) return;
        // The start of the track for a match that is just starting, and the
        // right place in it for one that is already under way.
        audio.currentTime = getExpectedAudioTime();
        playMatchAudio(audio);
      }
      hasPlayedRef.current = true;
    } else if (timer > 0) {
      audio.pause();
    }
  }, [matchActive, counting, timer, phaseTimer, getExpectedAudioTime]);

  // Once a second, as the clock ticks, check the audio is still with it.
  useEffect(() => {
    if (!counting) {
      syncPointRef.current = null;
      return;
    }
    syncPointRef.current = {
      audioTime: getExpectedAudioTime(),
      at: performance.now(),
    };
    correctDrift();
  }, [counting, timer, phaseTimer, getExpectedAudioTime, correctDrift]);

  useEffect(() => {
    if (audioTailTimeoutRef.current) {
      clearTimeout(audioTailTimeoutRef.current);
      audioTailTimeoutRef.current = null;
    }

    if (!matchActive) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      hasPlayedRef.current = false;
      clearAudioState();
    } else if (
      timer === 0 &&
      // Or the buzzer was cued by a skip to the end, on a match that had
      // not played yet (reloaded while paused)
      (hasPlayedRef.current || audioRef.current?.paused === false)
    ) {
      // The buzzer plays out, then the track stops. Timed off where the
      // track is, not the clock: audio a little ahead of the clock still
      // stops an Autonomous match before the call to pick up the
      // controllers, which follows AUTO's buzzer straight on.
      const matchType = sessionData.matchType;
      const audio = audioRef.current;
      const playingAt =
        audio && !audio.paused
          ? audio.currentTime
          : matchAudioTime(
              matchType,
              matchType === 'Autonomous' ? 'auton' : 'teleop',
              0
            );
      const tailDuration = Math.max(
        0,
        (matchAudioStopTime(matchType) - playingAt) * 1000
      );
      audioTailTimeoutRef.current = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        hasPlayedRef.current = false;
        clearAudioState();
        audioTailTimeoutRef.current = null;
      }, tailDuration);
    }
  }, [matchActive, timer, sessionData.matchType]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleAudioEnd = () => {
      hasPlayedRef.current = false;
    };

    audio.addEventListener('ended', handleAudioEnd);

    return () => {
      audio.removeEventListener('ended', handleAudioEnd);
    };
  }, []);

  return audioRef;
};
