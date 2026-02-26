import { useState } from 'react';
import { useTheme } from '@/contexts';
import { APP_CONFIG } from '@/constants';
import { DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Monitor } from 'lucide-react';

const MOBILE_BREAKPOINT = 768;

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSmallScreen = window.innerWidth < MOBILE_BREAKPOINT;
  return isMobileUA || isSmallScreen;
};

export const MobileWarning = () => {
  const { isDarkMode } = useTheme();
  const [open, setOpen] = useState(() => isMobileDevice());

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <DialogContent
        className={`${isDarkMode ? 'bg-[#1a1a2e] border border-team-blue-20 text-white' : 'bg-white text-gray-900'}`}
      >
        <div className="flex flex-col items-center text-center px-6 py-8 gap-5">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isDarkMode ? 'bg-team-blue/10' : 'bg-team-blue/5'
            }`}
          >
            <Monitor className="h-8 w-8 text-team-blue" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold">Mobile Support Coming Soon</h2>
            <p
              className={`text-sm leading-relaxed ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              {APP_CONFIG.name} currently doesn't support mobile devices, but mobile support will be added soon. For now, please use a computer for the best experience.
            </p>
          </div>

          <Button
            onClick={() => setOpen(false)}
            className={`w-full bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </div>
  );
};
