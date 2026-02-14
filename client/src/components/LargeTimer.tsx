import { useSession, useTheme } from '@/contexts';

export const LargeTimer = () => {
  const { timer, formatTime, sessionData, hasTransitionedToTeleOp } = useSession();
  const { isDarkMode } = useTheme();

  const phaseLabel = sessionData.matchType === 'Autonomous'
    ? 'AUTONOMOUS'
    : sessionData.matchType === 'TeleOp'
      ? 'TELEOP'
      : hasTransitionedToTeleOp
        ? 'TELEOP'
        : 'AUTONOMOUS';

  return (
    <div className="w-full">
      <div 
        className={`relative w-full py-16 px-8 rounded-2xl flex flex-col items-center justify-center overflow-hidden ${
          isDarkMode 
            ? 'bg-[#2d351a] border border-white/5' 
            : 'bg-[#4a5d23] shadow-xl'
        }`}
      >
        {/* Background Decorative Element (Optional, matches the clean look) */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        {/* Phase Badge */}
        <div className="absolute top-6 left-8">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
            <span className="text-white text-xs font-bold tracking-[0.2em] uppercase">
              {phaseLabel}
            </span>
          </div>
        </div>

        {/* Timer Display */}
        <div className="text-[140px] sm:text-[160px] md:text-[180px] font-medium leading-none text-white tracking-tight tabular-nums drop-shadow-2xl">
          {formatTime(timer)}
        </div>
      </div>
    </div>
  );
};
