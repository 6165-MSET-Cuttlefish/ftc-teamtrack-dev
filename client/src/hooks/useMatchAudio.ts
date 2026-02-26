import { useCallback, useEffect, useRef } from 'react';
import { useSession } from '@/contexts';
import { STORAGE_KEYS } from '@/constants';

interface TeamTrackWindow extends Window {
  __teamtrack_match_audio__?: HTMLAudioElement;
  __teamtrack_audio_persist_interval__?: ReturnType<typeof setInterval> | null;
}
const ttWindow = window as TeamTrackWindow;

const getOrCreateGlobalAudio = (): HTMLAudioElement => {
  if (!ttWindow.__teamtrack_match_audio__) {
    const audio = new Audio('/audio/match-audio.mp3');
    audio.volume = 0.8;
    ttWindow.__teamtrack_match_audio__ = audio;
  }
  return ttWindow.__teamtrack_match_audio__;
};

let globalPersistRefCount = 0;

const startGlobalAudioPersistence = () => {
  globalPersistRefCount++;
  if (ttWindow.__teamtrack_audio_persist_interval__) {
    return;
  }

  const audio = getOrCreateGlobalAudio();

  ttWindow.__teamtrack_audio_persist_interval__ = setInterval(() => {
    if (audio && !audio.paused) {
      try {
        sessionStorage.setItem(
          STORAGE_KEYS.AUDIO_STATE,
          JSON.stringify({
            isPlaying: true,
            currentTime: audio.currentTime,
            lastUpdated: Date.now(),
          })
        );
      } catch { /* storage unavailable */ }
    }
  }, 500);
};

const stopGlobalAudioPersistence = () => {
  globalPersistRefCount = Math.max(0, globalPersistRefCount - 1);
  if (globalPersistRefCount === 0 && ttWindow.__teamtrack_audio_persist_interval__) {
    clearInterval(ttWindow.__teamtrack_audio_persist_interval__);
    ttWindow.__teamtrack_audio_persist_interval__ = null;
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

const clearAudioState = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.AUDIO_STATE);
  } catch { /* storage unavailable */ }
};

const FULL_GAME_AUDIO_OFFSET = 0.8;
const AUTON_AUDIO_OFFSET = FULL_GAME_AUDIO_OFFSET + 3;
const TELEOP_AUDIO_OFFSET = 42;

export const useMatchAudio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedRef = useRef<boolean>(false);
  const audioTailTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { matchActive, matchPhase, isTimerRunning, isPreMatchDelay, timer, isTutorialActive, sessionData } = useSession();

  const getExpectedAudioTime = useCallback(() => {
    if (sessionData.matchType === 'Autonomous') {
      return AUTON_AUDIO_OFFSET + (30 - timer);
    }
    if (sessionData.matchType === 'Teleop') {
      return TELEOP_AUDIO_OFFSET + (120 - timer);
    }
    if (matchPhase === 'teleop') {
      return TELEOP_AUDIO_OFFSET + (120 - timer);
    }
    return FULL_GAME_AUDIO_OFFSET + (153 - timer);
  }, [sessionData.matchType, matchPhase, timer]);

  const getAudioStartTime = useCallback(() => {
    if (sessionData.matchType === 'Autonomous') return AUTON_AUDIO_OFFSET;
    if (sessionData.matchType === 'Teleop') return TELEOP_AUDIO_OFFSET;
    return FULL_GAME_AUDIO_OFFSET;
  }, [sessionData.matchType]);

  useEffect(() => {
    audioRef.current = getOrCreateGlobalAudio();
    startGlobalAudioPersistence();

    const savedState = getAudioState();
    if (savedState && audioRef.current && savedState.isPlaying) {
      const timeSinceSave = Date.now() - savedState.lastUpdated;
      if (timeSinceSave < 10000) {
        if (audioRef.current.paused) {
          audioRef.current.currentTime = Math.max(0, savedState.currentTime + timeSinceSave / 1000);
          audioRef.current.play().catch(() => {});
        }
        hasPlayedRef.current = true;
      }
    }

    return () => {
      stopGlobalAudioPersistence();
    };
  }, []);

  useEffect(() => {
    if (matchActive && (isTimerRunning || isPreMatchDelay) && timer > 0 && audioRef.current) {
      if (!hasPlayedRef.current) {
        hasPlayedRef.current = true;
        audioRef.current.currentTime = getAudioStartTime();
        audioRef.current.muted = isTutorialActive;
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.muted = isTutorialActive;
      }
    }
  }, [matchActive, isTimerRunning, isPreMatchDelay, isTutorialActive, timer, getAudioStartTime]);

  useEffect(() => {
    if (matchActive && audioRef.current) {
      if (isTimerRunning || isPreMatchDelay) {
        if (audioRef.current.paused && timer > 0) {
          audioRef.current.currentTime = getExpectedAudioTime();
          audioRef.current.play().catch(() => {});
        }
      } else if (timer > 0 && matchPhase !== 'controller_pickup') {
        audioRef.current.pause();
      }
    }
  }, [isTimerRunning, matchActive, isPreMatchDelay, matchPhase, timer, getExpectedAudioTime]);

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
    } else if (timer === 0 && hasPlayedRef.current) {
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
    const audio = audioRef.current;
    if (!audio) return;

    const handleAudioEnd = () => {
      hasPlayedRef.current = false;
      clearAudioState();
    };

    audio.addEventListener('ended', handleAudioEnd);

    return () => {
      audio.removeEventListener('ended', handleAudioEnd);
    };
  }, []);

  return audioRef;
};
