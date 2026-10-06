import { useEffect, useId, useRef, useState } from 'react';
import {
  BODY_TEXT,
  CARD_SURFACE,
  cardShadow,
  cardVars,
  primaryButton,
  quietButton,
} from './cardUi';

/**
 * What a first-time visitor sees before any tour: the page exactly as it is,
 * nothing dimmed, and this one small card saying what TeamTrack is. Only
 * "Take the tour" starts the spotlit steps. It sits where it hides the
 * least: on a phone in place of the match controls at the bottom (the
 * clock and the scoring fields stay in view), on a wide screen in the
 * bottom right corner.
 *
 * It does not hold the page: everything stays usable under and around it.
 */
export const WelcomeCard = ({
  isDarkMode,
  compact,
  short,
  zIndex,
  onStart,
  onSkip,
}: {
  isDarkMode: boolean;
  /** The page's phone layout, with its controls pinned to the bottom */
  compact: boolean;
  /** A screen with no height to spare (a phone on its side): one row */
  short: boolean;
  zIndex: number;
  onStart: () => void;
  onSkip: () => void;
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  /** Height of the phone's match controls, which this stands in for */
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    if (!compact) return;
    const bar = document.querySelector<HTMLElement>(
      '[data-tutorial="controls"]'
    );
    if (!bar) return;
    const measure = () => setBarHeight(bar.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [compact]);

  // Announced to a screen reader as it arrives, unless the visitor is
  // already busy with something on the page.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      cardRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const placement: React.CSSProperties = compact
    ? {
        left: 0,
        right: 0,
        bottom: 0,
        // Never shorter than the controls it stands in for
        minHeight: barHeight,
        padding: short
          ? '10px 16px calc(10px + env(safe-area-inset-bottom))'
          : '16px 16px calc(14px + env(safe-area-inset-bottom))',
        borderLeftWidth: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        boxShadow: isDarkMode
          ? '0 -12px 32px -12px rgba(0,0,0,0.75)'
          : '0 -12px 32px -12px rgba(15,23,42,0.22)',
      }
    : {
        right: 24,
        bottom: 24,
        width: 'min(360px, calc(100vw - 48px))',
        padding: '20px 20px 16px',
        boxShadow: cardShadow(isDarkMode),
      };

  const title = (
    <h2
      id={titleId}
      className={`font-semibold text-balance ${compact ? 'text-base' : 'text-lg'}`}
    >
      Welcome to TeamTrack
    </h2>
  );
  const body = (
    <p
      id={bodyId}
      className={
        short ? 'text-xs leading-snug text-[color:var(--tt-sub)]' : BODY_TEXT
      }
    >
      Score your FTC BIOBUZZ matches live and review them later.
    </p>
  );
  const actions = (
    <div
      className={`flex items-center gap-2 ${short ? 'shrink-0' : 'justify-between mt-3'}`}
    >
      <button type="button" onClick={onSkip} className={quietButton}>
        Skip
      </button>
      <button
        type="button"
        onClick={onStart}
        className={primaryButton(isDarkMode)}
      >
        Take the tour
      </button>
    </div>
  );

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      data-tutorial-card=""
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      tabIndex={-1}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onSkip();
        }
      }}
      className={`tt-welcome fixed outline-none ${CARD_SURFACE} ${
        compact ? 'rounded-t-2xl tt-welcome-sheet' : 'rounded-2xl'
      } ${short ? 'flex items-center gap-4' : ''}`}
      style={{ ...cardVars(isDarkMode), ...placement, zIndex }}
    >
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes ttWelcomeRise {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes ttWelcomeSheet {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
          .tt-welcome { animation: ttWelcomeRise 280ms cubic-bezier(0.22, 1, 0.36, 1) both; }
          .tt-welcome-sheet { animation-name: ttWelcomeSheet; }
        }
      `}</style>
      {short ? (
        <>
          <div className="flex-1 min-w-0">
            {title}
            {body}
          </div>
          {actions}
        </>
      ) : (
        <>
          {title}
          <div className="mt-1">{body}</div>
          {actions}
        </>
      )}
    </div>
  );
};
