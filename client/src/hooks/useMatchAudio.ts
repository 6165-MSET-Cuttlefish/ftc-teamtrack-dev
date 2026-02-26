import { useEffect, useRef } from 'react';
import { useSession } from '@/contexts';
import { STORAGE_KEYS } from '@/constants';

// Extend window with our custom properties to avoid `as any` casts
interface TeamTrackWindow extends Window {
  __teamtrack_match_audio__?: HTMLAudioElement;
  __teamtrack_audio_persist_interval__?: ReturnType<typeof setInterval> | null;
}
const ttWindow = window as TeamTrackWindow;

// Global audio instance - shared across all component instances
const getOrCreateGlobalAudio = (): HTMLAudioElement => {
  if (!ttWindow.__teamtrack_match_audio__) {
    const audio = new Audio('/audio/match-audio.mp3');
    audio.volume = 0.8;
    ttWindow.__teamtrack_match_audio__ = audio;
  }
  return ttWindow.__teamtrack_match_audio__;
};

// Ref-counted global persistence interval
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
      } catch {
        // Silently fail if storage is unavailable
      }
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
  } catch {
    // Silently fail if storage is unavailable
  }
};

export const useMatchAudio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedRef = useRef<boolean>(false);
  const { matchActive, matchPhase, isTimerRunning, isPreMatchDelay, timer, isTutorialActive, sessionData } = useSession();

  // Determine if audio should play for this match type
  // Audio only plays for 'Full Game' mode; disabled for 'Autonomous' and 'Teleop' modes
  const shouldPlayAudio = sessionData.matchType === 'Full Game';

  // Initialize global audio element and persistence once
  useEffect(() => {
    audioRef.current = getOrCreateGlobalAudio();
    startGlobalAudioPersistence();

    // Restore audio state from storage if available
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

  // Play audio when match starts (only for Full Game mode)
  useEffect(() => {
    if (shouldPlayAudio && matchActive && (isTimerRunning || isPreMatchDelay) && timer > 0 && audioRef.current) {
      if (!hasPlayedRef.current) {
        hasPlayedRef.current = true;
        audioRef.current.muted = isTutorialActive;
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.muted = isTutorialActive;
      }
    }
  }, [shouldPlayAudio, matchActive, isTimerRunning, isPreMatchDelay, isTutorialActive, timer]);

  // Pause/resume audio when timer state changes (only for Full Game mode)
  useEffect(() => {
    if (shouldPlayAudio && matchActive && audioRef.current) {
      if ((isTimerRunning || isPreMatchDelay) && timer > 0) {
        audioRef.current.play().catch(() => {});
      } else if (matchPhase !== 'controller_pickup') {
        audioRef.current.pause();
      }
    }
  }, [shouldPlayAudio, isTimerRunning, matchActive, isPreMatchDelay, matchPhase, timer]);

  // Stop and reset audio when match ends
  useEffect(() => {
    if (!matchActive || timer === 0) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      hasPlayedRef.current = false;
      clearAudioState();
    }
  }, [matchActive, timer]);

  // Clean up when audio finishes naturally
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
