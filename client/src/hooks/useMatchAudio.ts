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
  const audioTailTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { matchActive, matchPhase, isTimerRunning, isPreMatchDelay, timer, isTutorialActive, sessionData } = useSession();

  // Compute the expected audio position from the current timer value and phase.
  // Audio timeline: ~0.8s intro | 0.8-3.8s countdown | 3.8-33.8s auton | ~34-42s pickup | 42+s teleop
  const FULL_GAME_AUDIO_OFFSET = 0.8; // seconds into audio where the countdown "Three" begins
  const AUTON_AUDIO_OFFSET = FULL_GAME_AUDIO_OFFSET + 3; // after countdown, autonomous gameplay starts
  const TELEOP_AUDIO_OFFSET = 42; // teleop section of the audio

  const getExpectedAudioTime = () => {
    if (sessionData.matchType === 'Autonomous') {
      // Timer counts 30→0, audio plays from after the countdown
      return AUTON_AUDIO_OFFSET + (30 - timer);
    }
    if (sessionData.matchType === 'Teleop') {
      // Timer counts 120→0, audio plays from 42s
      return TELEOP_AUDIO_OFFSET + (120 - timer);
    }
    // Full Game
    if (matchPhase === 'teleop') {
      return TELEOP_AUDIO_OFFSET + (120 - timer);
    }
    // auton phase: timer counts 153→120
    return FULL_GAME_AUDIO_OFFSET + (153 - timer);
  };

  // Get the audio start position for a fresh match start
  const getAudioStartTime = () => {
    if (sessionData.matchType === 'Autonomous') return AUTON_AUDIO_OFFSET;
    if (sessionData.matchType === 'Teleop') return TELEOP_AUDIO_OFFSET;
    return FULL_GAME_AUDIO_OFFSET; // Full Game starts at the countdown
  };

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

  // Play audio when match starts
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
  }, [matchActive, isTimerRunning, isPreMatchDelay, isTutorialActive, timer]);

  // Pause/resume audio when timer running state changes — re-sync only on resume
  useEffect(() => {
    if (matchActive && audioRef.current) {
      if (isTimerRunning || isPreMatchDelay) {
        if (audioRef.current.paused && timer > 0) {
          // Re-sync audio position to match the timer on resume
          audioRef.current.currentTime = getExpectedAudioTime();
          audioRef.current.play().catch(() => {});
        }
      } else if (timer > 0 && matchPhase !== 'controller_pickup') {
        // Only pause if timer hasn't reached 0 (let end-of-match audio play out)
        audioRef.current.pause();
      }
    }
  }, [isTimerRunning, matchActive, isPreMatchDelay, matchPhase]);

  // Stop and reset audio when match ends
  useEffect(() => {
    // Clear any pending tail timeout on state change
    if (audioTailTimeoutRef.current) {
      clearTimeout(audioTailTimeoutRef.current);
      audioTailTimeoutRef.current = null;
    }

    if (!matchActive) {
      // Match was cancelled/reset — stop immediately
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      hasPlayedRef.current = false;
      clearAudioState();
    } else if (timer === 0 && hasPlayedRef.current) {
      // Timer reached 0 — let the bell finish playing before stopping
      // Autonomous: 3s tail for the end-of-auton bell
      // Teleop / Full Game: 5s tail for the final buzzer
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
