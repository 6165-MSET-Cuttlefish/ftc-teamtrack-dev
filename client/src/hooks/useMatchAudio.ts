import { useEffect, useRef } from 'react';
import { useSession } from '@/contexts';

export const useMatchAudio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedRef = useRef<boolean>(false);
  const { matchActive, matchPhase, isTimerRunning } = useSession();

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/audio/match-audio.mp3');
      audioRef.current.volume = 0.8;
    }
  }, []);

  // Play audio when match starts (autonomous begins)
  useEffect(() => {
    if (matchActive && isTimerRunning && matchPhase === 'auton') {
      if (!hasPlayedRef.current) {
        hasPlayedRef.current = true;
        audioRef.current?.play().catch((err) => {
          console.log('Audio autoplay blocked or error:', err);
        });
      }
    }
  }, [matchActive, isTimerRunning, matchPhase]);

  // Stop and reset audio when match becomes inactive
  useEffect(() => {
    if (!matchActive) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      hasPlayedRef.current = false;
    }
  }, [matchActive]);

  // Pause/resume audio when timer pauses/resumes
  useEffect(() => {
    if (matchActive && audioRef.current) {
      if (isTimerRunning) {
        audioRef.current.play().catch(() => {
          // Silently fail if autoplay is blocked
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isTimerRunning, matchActive]);

  return audioRef;
};
