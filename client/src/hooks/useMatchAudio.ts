import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/contexts';
import { GAME_TIMING, STORAGE_KEYS } from '@/constants';
import { clockAudioTime, TELEOP_AUDIO_OFFSET } from '@/lib/matchAudioTime';

interface TeamTrackWindow extends Window {
  __teamtrack_match_audio__?: HTMLAudioElement;
  __teamtrack_audio_persist_interval__?: ReturnType<typeof setInterval> | null;
  /** Takes this module's listeners back off the shared element (hot reload) */
  __teamtrack_match_audio_unwire__?: () => void;
}
const ttWindow = window as TeamTrackWindow;

/**
 * File time of 1:00 remaining, when BIOBUZZ endgame (and flower scoring)
 * opens. The track is silent there: the manual's "FLOWER Ownership Unlocked"
 * sound is still TBD, so a short chime is synthesized on top. Once the
 * official sound is published, splice it into match-audio.mp3 at this file
 * time and delete the chime. The 0:20 whistle is already in the track.
 */
const ENDGAME_CUE_AUDIO_TIME =
  TELEOP_AUDIO_OFFSET +
  GAME_TIMING.TELEOP_DURATION_SECONDS -
  GAME_TIMING.ENDGAME_REMAINING;
/** How far ahead of the cue the chime is queued, in seconds */
const ENDGAME_CUE_LEAD = 0.5;
/** How late the chime may still play if the cue was not seen coming, in seconds */
const ENDGAME_CUE_GRACE = 1;

/** Furthest the audio may be from the match clock before it is moved, in seconds */
const MAX_AUDIO_DRIFT = 0.5;
/** Shortest gap between two attempts to re-download a failed track, in ms */
const RELOAD_RETRY_MS = 3000;

const SOUND_UNAVAILABLE_TOAST_ID = 'match-sound-unavailable';

let chimeContext: AudioContext | null = null;

const getChimeContext = (): AudioContext | null => {
  if (chimeContext) return chimeContext;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  chimeContext = new Ctor();
  return chimeContext;
};

/** Browsers only allow audio started from a tap, so wake the context then. */
const unlockChime = () => {
  getChimeContext()
    ?.resume()
    .catch(() => {});
};

/** Two rising notes, starting `delay` seconds from now. */
const playEndgameChime = (delay = 0) => {
  const ctx = getChimeContext();
  if (!ctx) return;

  const schedule = (wait: number) => {
    const start = ctx.currentTime + wait;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = start + i * 0.18;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  };

  if (ctx.state === 'running') {
    schedule(delay);
    return;
  }
  // A context that is still locked would hold the notes until some later
  // tap, long after 1:00. Only play if it wakes up in time to be on cue.
  const askedAt = performance.now();
  ctx
    .resume()
    .then(() => {
      const waited = (performance.now() - askedAt) / 1000;
      if (waited <= delay + ENDGAME_CUE_GRACE) {
        schedule(Math.max(0, delay - waited));
      }
    })
    .catch(() => {});
};

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

  // The endgame chime runs off the audio's own clock, once per play-through.
  let chimed = false;
  const handleTimeUpdate = () => {
    const untilCue = ENDGAME_CUE_AUDIO_TIME - audio.currentTime;
    if (untilCue > ENDGAME_CUE_LEAD) {
      chimed = false;
      return;
    }
    if (chimed || audio.paused || untilCue <= -ENDGAME_CUE_GRACE) return;
    chimed = true;
    // Muted means the tutorial is running a practice match.
    if (!audio.muted) playEndgameChime(Math.max(0, untilCue));
  };

  const handleOnline = () => {
    reloadIfBroken(audio, true);
  };

  audio.addEventListener('timeupdate', handleTimeUpdate);
  audio.addEventListener('ended', clearAudioState);
  window.addEventListener('online', handleOnline);
  // A reload mid-match has no Start tap to wake the chime with.
  window.addEventListener('pointerdown', unlockChime, { once: true });
  window.addEventListener('keydown', unlockChime, { once: true });

  ttWindow.__teamtrack_match_audio_unwire__ = () => {
    audio.removeEventListener('timeupdate', handleTimeUpdate);
    audio.removeEventListener('ended', clearAudioState);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('pointerdown', unlockChime);
    window.removeEventListener('keydown', unlockChime);
  };
};

let wiredAudio: HTMLAudioElement | null = null;

const getOrCreateGlobalAudio = (): HTMLAudioElement => {
  if (!ttWindow.__teamtrack_match_audio__) {
    const audio = new Audio();
    // Buffer the whole track up front, so Start never waits on the network.
    audio.preload = 'auto';
    audio.src = '/audio/match-audio.mp3';
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
      const tailDuration = sessionData.matchType === 'Autonomous' ? 3000 : 5000;
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
    window.addEventListener('teamtrack-match-started', unlockChime);
    return () =>
      window.removeEventListener('teamtrack-match-started', unlockChime);
  }, []);

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
