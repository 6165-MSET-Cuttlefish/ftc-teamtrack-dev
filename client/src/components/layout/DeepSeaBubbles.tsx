import { useTheme } from '@/contexts';

/**
 * Animated floating bubbles for the Deep Sea theme.
 * Renders a fixed overlay of rising bubbles using pure CSS animations.
 * Only visible when deepsea theme is active.
 */
export const DeepSeaBubbles = () => {
  const { isDeepSeaMode } = useTheme();

  if (!isDeepSeaMode) return null;

  const bubbles = [
    { size: 6,  left: 5,  delay: 0,    duration: 14, opacity: 0.25 },
    { size: 10, left: 12, delay: 2,    duration: 16, opacity: 0.18 },
    { size: 4,  left: 20, delay: 4.5,  duration: 12, opacity: 0.3 },
    { size: 8,  left: 30, delay: 1,    duration: 18, opacity: 0.15 },
    { size: 5,  left: 40, delay: 6,    duration: 13, opacity: 0.22 },
    { size: 12, left: 50, delay: 3,    duration: 20, opacity: 0.12 },
    { size: 7,  left: 58, delay: 7.5,  duration: 15, opacity: 0.2 },
    { size: 3,  left: 65, delay: 0.5,  duration: 11, opacity: 0.35 },
    { size: 9,  left: 75, delay: 5,    duration: 17, opacity: 0.16 },
    { size: 5,  left: 82, delay: 8,    duration: 14, opacity: 0.24 },
    { size: 11, left: 90, delay: 2.5,  duration: 19, opacity: 0.13 },
    { size: 4,  left: 95, delay: 9,    duration: 12, opacity: 0.28 },
    { size: 6,  left: 35, delay: 10,   duration: 16, opacity: 0.19 },
    { size: 8,  left: 48, delay: 11.5, duration: 15, opacity: 0.17 },
    { size: 3,  left: 72, delay: 4,    duration: 10, opacity: 0.32 },
  ];

  return (
    <div className="deepsea-bubbles" aria-hidden="true">
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="deepsea-bubble"
          style={{
            width: `${b.size}px`,
            height: `${b.size}px`,
            left: `${b.left}%`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
            opacity: b.opacity,
          }}
        />
      ))}
    </div>
  );
};
