import { useEffect, useRef } from 'react';
import { useSession } from '@/contexts';

// Global audio instance - ensures only one audio element exists across all component instances
const getOrCreateGlobalAudio = (): HTMLAudioElement => {
  const globalKey = '__teamtrack_match_audio__';
  if (!(globalKey in window)) {
    const audio = new Audio('/audio/match-audio.mp3');
    audio.volume = 0.8;
    (window as any)[globalKey] = audio;
  }
  return (window as any)[globalKey];
};

// Global persistence interval - runs regardless of component mount state
const initializeGlobalAudioPersistence = () => {
  const globalPersistKey = '__teamtrack_audio_persist_interval__';
  const AUDIO_STATE_KEY = 'teamtrack_audio_state';

  // Only initialize once
  if ((window as any)[globalPersistKey]) {
    return;
  }

  const audio = getOrCreateGlobalAudio();

  (window as any)[globalPersistKey] = setInterval(() => {
    // Always save audio state if it's playing, so it persists across navigation
    if (audio && !audio.paused) {
      try {
        sessionStorage.setItem(
          AUDIO_STATE_KEY,
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

// Audio state persistence
const AUDIO_STATE_KEY = 'teamtrack_audio_state';
interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
}

const getAudioState = (): AudioState | null => {
  try {
    const stored = sessionStorage.getItem(AUDIO_STATE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const clearAudioState = () => {
  try {
    sessionStorage.removeItem(AUDIO_STATE_KEY);
  } catch {
    // Silently fail if storage is unavailable
  }
};

export const useMatchAudio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedRef = useRef<boolean>(false);
  const { matchActive, matchPhase, isTimerRunning, isPreMatchDelay, timer, isTutorialActive } = useSession();

  // Initialize global audio element and persistence once
  useEffect(() => {
    audioRef.current = getOrCreateGlobalAudio();
    initializeGlobalAudioPersistence();

    // Restore audio state from storage if available
    const savedState = getAudioState();
    if (savedState && audioRef.current && savedState.isPlaying) {
      // Only restore if the audio was recently playing (within last 10 seconds)
      // This handles the case where user navigates away and back
      const timeSinceSave = Date.now() - savedState.lastUpdated;
      if (timeSinceSave < 10000) {
        // Check if audio is already playing (global instance might still be going)
        if (audioRef.current.paused) {
          // Resume from stored position
          audioRef.current.currentTime = Math.max(0, savedState.currentTime + timeSinceSave / 1000);
          audioRef.current.play().catch(() => {
            console.log('Audio autoplay blocked');
          });
        }
        hasPlayedRef.current = true;
      }
    }
  }, []);

  // Play audio when match starts (any mode: Full Game, Autonomous, or Teleop)
  // Mute audio if tutorial is active (audio plays silently so timer is imperceptible)
  useEffect(() => {
    if (matchActive && (isTimerRunning || isPreMatchDelay) && timer > 0 && audioRef.current) {
      if (!hasPlayedRef.current) {
        hasPlayedRef.current = true;
        // Mute audio during tutorial, unmute during normal play
        audioRef.current.muted = isTutorialActive;
        audioRef.current.play().catch((err) => {
          console.log('Audio autoplay blocked or error:', err);
        });
      } else {
        // Audio is already playing, just update mute state
        audioRef.current.muted = isTutorialActive;
      }
    }
  }, [matchActive, isTimerRunning, isPreMatchDelay, isTutorialActive, timer]);

  // Pause/resume audio when timer pauses/resumes (but keep playing during pre-match delay)
  useEffect(() => {
    if (matchActive && audioRef.current) {
      if ((isTimerRunning || isPreMatchDelay) && timer > 0) {
        audioRef.current.play().catch(() => {
          // Silently fail if autoplay is blocked
        });
      } else if (matchPhase !== 'controller_pickup' && matchPhase !== 'prepare') {
        // Only pause audio during actual user pause, not during phase transitions
        audioRef.current.pause();
      }
    }
  }, [isTimerRunning, matchActive, isPreMatchDelay, matchPhase, timer]);

  // Stop and reset audio when match becomes inactive OR timer reaches 0
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

  // Ensure both audio and timer end together - stop audio when it finishes naturally
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleAudioEnd = () => {
      // When audio naturally ends, also ensure timer is stopped
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
