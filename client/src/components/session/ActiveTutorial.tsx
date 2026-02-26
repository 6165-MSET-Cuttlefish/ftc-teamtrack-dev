import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, useAuth, useSession } from '@/contexts';
import {
  TUTORIAL_RESTART_EVENT,
  TUTORIAL_OPEN_SESSION_SETUP_EVENT,
  TUTORIAL_KEYBOARD_SCORE_EVENT,
  TUTORIAL_GATE_CYCLE_EVENT,
  TUTORIAL_ENDED_EVENT,
  TUTORIAL_METRICS_AUTON_TAB_EVENT,
  TUTORIAL_METRICS_LEAVE_EVENT,
  TUTORIAL_METRICS_SHOT_EDIT_EVENT,
  TUTORIAL_METRICS_MOTIF_EDIT_EVENT,
} from '@/constants/events';

import { STORAGE_KEYS } from '@/constants';
import type { SessionFormData } from '@/types';

const PreviewBox = ({
  children,
  dark,
}: {
  children: React.ReactNode;
  dark: boolean;
}) => (
  <div
    className="rounded-xl p-4 mt-4 mb-1 border"
    style={{
      backgroundColor: dark ? '#232323' : '#f5f5f5',
      borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    }}
  >
    {children}
  </div>
);

const SCORE_SEQUENCE: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
];
const ScoringPreview = ({ dark }: { dark: boolean }) => {
  const borderCol = dark ? 'rgb(var(--team-blue) / 0.4)' : 'rgba(0,0,0,0.15)';
  const circleBorder = dark ? '#fff' : '#000';
  const [seqIdx, setSeqIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setSeqIdx(i => (i + 1) % SCORE_SEQUENCE.length),
      1800
    );
    return () => clearInterval(id);
  }, []);

  const [hRow, hCol] = SCORE_SEQUENCE[seqIdx];

  const cellBorder = (r: number, c: number) => ({
    borderColor: r === hRow && c === hCol ? 'rgb(34,197,94)' : borderCol,
    backgroundColor:
      r === hRow && c === hCol ? 'rgba(34,197,94,0.2)' : 'transparent',
    transition: 'border-color 0.3s, background-color 0.3s',
  });

  return (
    <PreviewBox dark={dark}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-team-blue font-semibold text-sm">Scoring</span>
        <span
          className="text-xs"
          style={{ color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
        >
          AUTON Score: <span className="text-team-blue font-bold">0</span>
        </span>
      </div>
      {[1, 2, 3].map((balls, rowIdx) => (
        <div key={balls} className="flex items-center gap-2 mb-2">
          <span
            className="text-xs w-12 text-center"
            style={{
              color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
            }}
          >
            {balls} {balls === 1 ? 'ball' : 'balls'}
          </span>
          <div
            className="flex-1 flex flex-col items-center justify-center rounded-lg border py-2"
            style={cellBorder(rowIdx, 0)}
          >
            <div className="flex gap-1">
              {Array.from({ length: balls }).map((_, i) => (
                <div
                  key={i}
                  className="w-3.5 h-3.5 rounded-full border-2 border-dashed"
                  style={{ borderColor: circleBorder }}
                />
              ))}
            </div>
            <span
              className="text-[9px] mt-0.5"
              style={{
                color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
              }}
            >
              scored
            </span>
          </div>
          {Array.from({ length: balls }).map((_, idx) => (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center justify-center rounded-lg border py-2"
              style={cellBorder(rowIdx, idx + 1)}
            >
              <div className="flex gap-1">
                {Array.from({ length: idx + 1 }).map((_, j) => (
                  <div
                    key={j}
                    className="w-3.5 h-3.5 rounded-full border-2"
                    style={{ borderColor: circleBorder }}
                  />
                ))}
              </div>
              <span
                className="text-[9px] mt-0.5"
                style={{
                  color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                }}
              >
                scored
              </span>
            </div>
          ))}
        </div>
      ))}
    </PreviewBox>
  );
};

const KeybindsPreview = ({ dark }: { dark: boolean }) => {
  const [step, setStep] = useState(0);
  // 0 = idle, 1 = pressed "2" (attempted), 2 = pressed "1" (made), 3 = pressed Enter, 4 = brief pause
  
  useEffect(() => {
    const durations = [1200, 1400, 1400, 1600, 800];
    const timeout = setTimeout(() => {
      setStep(s => (s + 1) % 5);
    }, durations[step]);
    return () => clearTimeout(timeout);
  }, [step]);

  const accent = dark ? '#a855f7' : '#9333ea';
  const keyInactive = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const keyBorder = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
  const textDim = dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const textMain = dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
  const successGreen = '#22c55e';

  const exampleAttempted = '2';
  const exampleMade = '1';

  const isActive = step >= 1 && step <= 3;
  const attemptedDone = step >= 1;
  const madeDone = step >= 2;
  const confirmed = step >= 3;

  const keyStyle = (active: boolean, highlight: boolean) => ({
    backgroundColor: highlight ? accent : active ? (dark ? 'rgba(168,85,247,0.15)' : 'rgba(147,51,234,0.1)') : keyInactive,
    color: highlight ? '#fff' : active ? accent : textDim,
    border: `1.5px solid ${highlight ? accent : active ? `${accent}40` : keyBorder}`,
    boxShadow: highlight ? `0 0 16px ${accent}44` : 'none',
    transform: highlight ? 'scale(1.08)' : 'scale(1)',
    transition: 'all 0.25s ease',
  });

  return (
    <PreviewBox dark={dark}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-team-blue font-semibold text-sm">Keyboard Shortcut Flow</span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
          backgroundColor: dark ? 'rgba(168,85,247,0.15)' : 'rgba(147,51,234,0.08)',
          color: accent,
        }}>Example: {exampleAttempted} shot, {exampleMade} scored</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: attemptedDone ? accent : textDim }}>Step 1</div>
          <div className="text-[10px]" style={{ color: textDim }}>Balls shot</div>
          <div className="flex gap-1">
            {['1', '2', '3'].map(k => (
              <kbd
                key={k}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-mono font-bold"
                style={keyStyle(attemptedDone, step === 1 && k === exampleAttempted)}
              >{k}</kbd>
            ))}
          </div>
          {attemptedDone && (
            <div className="text-[10px] font-bold transition-opacity duration-300" style={{ color: accent }}>
              Pressed {exampleAttempted}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: madeDone ? accent : textDim }}>Step 2</div>
          <div className="text-[10px]" style={{ color: textDim }}>Balls scored</div>
          <div className="flex gap-1">
            {['0', '1', '2'].map(k => (
              <kbd
                key={k}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-mono font-bold"
                style={keyStyle(madeDone, step === 2 && k === exampleMade)}
              >{k}</kbd>
            ))}
          </div>
          {madeDone && (
            <div className="text-[10px] font-bold transition-opacity duration-300" style={{ color: accent }}>
              Pressed {exampleMade}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: confirmed ? successGreen : textDim }}>Step 3</div>
          <div className="text-[10px]" style={{ color: textDim }}>Confirm</div>
          <kbd
            className="w-full h-8 flex items-center justify-center rounded-lg text-xs font-mono font-bold"
            style={keyStyle(confirmed, step === 3)}
          >Enter</kbd>
          {confirmed && (
            <div className="text-[10px] font-bold transition-opacity duration-300" style={{ color: successGreen }}>
              ✓ Saved!
            </div>
          )}
        </div>
      </div>

      <div
        className="mt-4 rounded-lg px-3 py-2 flex items-center justify-between transition-all duration-300"
        style={{
          backgroundColor: confirmed
            ? (dark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.06)')
            : (dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
          border: `1px solid ${confirmed ? `${successGreen}30` : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}`,
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px]" style={{ color: textDim }}>Result:</span>
          <span className="text-xs font-semibold" style={{ color: isActive ? textMain : textDim }}>
            {attemptedDone ? exampleAttempted : '—'} attempted
          </span>
          <span className="text-[10px]" style={{ color: textDim }}>·</span>
          <span className="text-xs font-semibold" style={{ color: isActive ? textMain : textDim }}>
            {madeDone ? exampleMade : '—'} scored
          </span>
        </div>
        {confirmed && (
          <span className="text-xs font-bold" style={{ color: successGreen }}>✓</span>
        )}
      </div>

      <div className="flex justify-center gap-1.5 mt-3">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-400"
            style={{
              width: step === i ? '16px' : '6px',
              backgroundColor: step === i ? accent : step > i || confirmed ? successGreen : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
            }}
          />
        ))}
      </div>
    </PreviewBox>
  );
};

const MetricsPreview = ({ dark }: { dark: boolean }) => {
  const borderCol = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textDim = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const cardBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const accent = 'rgb(var(--team-blue))';

  const SLIDE_COUNT = 4;
  const [activeSlide, setActiveSlide] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isAnimating, setIsAnimating] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goToSlide = useCallback((idx: number) => {
    if (isAnimating || idx === activeSlide) return;
    setDirection(idx > activeSlide ? 'right' : 'left');
    setIsAnimating(true);
    setActiveSlide(idx);
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => setIsAnimating(false), 400);
  }, [isAnimating, activeSlide]);

  useEffect(() => {
    autoTimerRef.current = setTimeout(() => {
      const next = (activeSlide + 1) % SLIDE_COUNT;
      setDirection('right');
      setIsAnimating(true);
      setActiveSlide(next);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      animTimerRef.current = setTimeout(() => setIsAnimating(false), 400);
    }, 3500);
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [activeSlide]);

  const slideLabels = ['Autonomous', 'Shot Editing', 'Teleop', 'Endgame'];

  const Checkbox = ({ checked }: { checked: boolean }) => (
    <div
      className="w-4 h-4 rounded flex items-center justify-center transition-all duration-300"
      style={{
        backgroundColor: checked ? accent : 'transparent',
        border: `2px solid ${checked ? accent : (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)')}`,
      }}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4l3 3 5-6" stroke={dark ? '#000' : '#fff'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );

  const SegmentedButtons = ({ options, selected }: { options: string[]; selected: number }) => (
    <div className="flex gap-0 rounded overflow-hidden" style={{ border: `1px solid ${borderCol}` }}>
      {options.map((val, vi) => (
        <div
          key={val}
          className="px-2 py-1 text-[10px] font-medium transition-all duration-300"
          style={{
            backgroundColor: vi === selected ? accent : (dark ? '#1a1a1a' : '#f5f5f5'),
            color: vi === selected ? (dark ? '#000' : '#fff') : textDim,
          }}
        >
          {val}
        </div>
      ))}
    </div>
  );

  const slides = [
    // Slide 0: Autonomous — Leave + Motif
    <div key="auton" className="rounded-lg p-3 flex flex-col gap-2.5" style={{ backgroundColor: cardBg, border: `1px solid ${borderCol}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Autonomous</div>
      <label className="flex items-center gap-2 cursor-default select-none">
        <Checkbox checked={true} />
        <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)' }}>
          Robot left starting zone
        </span>
        <span className="text-xs font-bold ml-auto" style={{ color: accent }}>+3 pts</span>
      </label>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>Auton Motif</span>
        <div className="flex gap-1">
          {[true, true, false].map((on, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all duration-300"
              style={{
                backgroundColor: on ? (dark ? 'rgba(168,85,247,0.3)' : 'rgba(147,51,234,0.15)') : 'transparent',
                border: `1.5px solid ${on ? '#a855f7' : (dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)')}`,
                color: on ? '#a855f7' : textDim,
              }}
            >M</div>
          ))}
        </div>
        <span className="text-xs font-bold" style={{ color: accent }}>+4 pts</span>
      </div>
    </div>,

    // Slide 1: Shot Editing table
    <div key="shots" className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: cardBg, border: `1px solid ${borderCol}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Shot Log — Editable</div>
      <div className="rounded overflow-hidden" style={{ border: `1px solid ${borderCol}` }}>
        <div className="grid grid-cols-5 text-[9px] font-semibold" style={{ color: textDim, backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
          <div className="px-2 py-1.5 text-center">#</div>
          <div className="px-2 py-1.5 text-center">Att</div>
          <div className="px-2 py-1.5 text-center">Cls</div>
          <div className="px-2 py-1.5 text-center">Ovfl</div>
          <div className="px-2 py-1.5 text-center">Pts</div>
        </div>
        {[
          { n: 1, att: 2, cls: 1, ovfl: 1, pts: 4 },
          { n: 2, att: 3, cls: 2, ovfl: 0, pts: 6 },
          { n: 3, att: 1, cls: 1, ovfl: 0, pts: 3 },
        ].map((row, ri) => (
          <div
            key={ri}
            className="grid grid-cols-5 text-[10px] transition-all duration-300"
            style={{
              borderTop: `1px solid ${borderCol}`,
              color: dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.75)',
              backgroundColor: ri === 1 ? (dark ? 'rgba(var(--team-blue) / 0.08)' : 'rgba(var(--team-blue) / 0.05)') : 'transparent',
            }}
          >
            <div className="px-2 py-1.5 text-center font-medium" style={{ color: textDim }}>{row.n}</div>
            <div className="px-2 py-1.5 text-center font-semibold">{row.att}</div>
            <div className="px-2 py-1.5 text-center font-semibold">{row.cls}</div>
            <div className="px-2 py-1.5 text-center font-semibold">{row.ovfl}</div>
            <div className="px-2 py-1.5 text-center font-bold" style={{ color: accent }}>{row.pts}</div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-center" style={{ color: textDim }}>Tap any value to edit it</div>
    </div>,

    // Slide 2: Teleop — shots + motif summary
    <div key="teleop" className="rounded-lg p-3 flex flex-col gap-2.5" style={{ backgroundColor: cardBg, border: `1px solid ${borderCol}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Teleop</div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>Shots Scored</span>
        <span className="text-sm font-bold" style={{ color: accent }}>5 classified · 2 overflow</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>Teleop Motif</span>
        <div className="flex gap-1">
          {(['purple', false, true] as (boolean | string)[]).map((on, i) => {
            const isPurple = on === 'purple';
            const isOn = !!on;
            const ballColor = isPurple ? '#a855f7' : '#22c55e';
            const bgOn = isPurple
              ? (dark ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.12)')
              : (dark ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.12)');
            return (
            <div
              key={i}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all duration-300"
              style={{
                backgroundColor: isOn ? bgOn : 'transparent',
                border: `1.5px solid ${isOn ? ballColor : (dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)')}`,
                color: isOn ? ballColor : textDim,
              }}
            >M</div>
            );
          })}
        </div>
      </div>
      <div className="rounded-lg px-3 py-2 flex items-center justify-between" style={{ backgroundColor: dark ? 'rgba(var(--team-blue) / 0.08)' : 'rgba(var(--team-blue) / 0.05)', border: `1px solid rgba(var(--team-blue) / 0.15)` }}>
        <span className="text-[10px] font-medium" style={{ color: textDim }}>Teleop Score</span>
        <span className="text-sm font-bold" style={{ color: accent }}>21 pts</span>
      </div>
    </div>,

    // Slide 3: Endgame — Parking
    <div key="endgame" className="rounded-lg p-3 flex flex-col gap-2.5" style={{ backgroundColor: cardBg, border: `1px solid ${borderCol}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Endgame</div>
      {(['Robot 1', 'Robot 2'] as const).map(robot => (
        <div key={robot} className="flex items-center justify-between gap-2">
          <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)' }}>{robot}</span>
          <SegmentedButtons
            options={['None', 'Partial', 'Full']}
            selected={robot === 'Robot 1' ? 2 : 1}
          />
          <span className="text-xs font-bold" style={{ color: accent }}>
            {robot === 'Robot 1' ? '10' : '5'} pts
          </span>
        </div>
      ))}
      <div
        className="rounded-lg px-3 py-2 flex items-center justify-between"
        style={{
          backgroundColor: dark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.05)',
          border: '1px solid rgba(34,197,94,0.2)',
        }}
      >
        <span className="text-[10px] font-medium" style={{ color: textDim }}>Both full park bonus</span>
        <span className="text-xs font-bold" style={{ color: '#22c55e' }}>+30 pts</span>
      </div>
    </div>,
  ];

  return (
    <PreviewBox dark={dark}>
      {/* Slide container with overflow hidden for slide animation */}
      <div className="relative overflow-hidden" style={{ minHeight: 130 }}>
        <div
          key={activeSlide}
          style={{
            animation: `ttSlide${direction === 'right' ? 'Right' : 'Left'} 0.4s ease-out forwards`,
          }}
        >
          {slides[activeSlide]}
        </div>
      </div>

      {/* Dot navigation */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {slideLabels.map((label, i) => (
          <button
            key={i}
            onClick={() => goToSlide(i)}
            className="group flex flex-col items-center gap-1 transition-all"
            title={label}
          >
            <div
              className="rounded-full transition-all duration-300"
              style={{
                width: i === activeSlide ? 18 : 7,
                height: 7,
                backgroundColor: i === activeSlide
                  ? accent
                  : (dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
              }}
            />
            <span
              className="text-[8px] font-medium transition-opacity duration-300"
              style={{
                color: i === activeSlide ? accent : textDim,
                opacity: i === activeSlide ? 1 : 0,
              }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </PreviewBox>
  );
};

const GatePreview = ({ dark }: { dark: boolean }) => {
  const [released, setReleased] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReleased(!released), 1600);
    return () => clearTimeout(t);
  }, [released]);

  const GATE_CAPACITY = 9;
  const ballsInGate = 6;
  const ballsKept = 2;
  const ballsRemaining = released ? ballsKept : ballsInGate;

  return (
    <PreviewBox dark={dark}>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-team-blue font-semibold text-sm">Gate Mechanic</div>
        <span className="text-xs font-bold text-white bg-blue-500/40 px-1.5 py-0.5 rounded">
          G
        </span>
      </div>
      <div className="flex items-center justify-center gap-3 -mx-4 px-4 py-2">
        {Array.from({ length: GATE_CAPACITY }).map((_, i) => (
          <div
            key={i}
            className="w-6 h-6 rounded-full border-2 transition-all duration-500"
            style={{
              backgroundColor:
                i < ballsRemaining
                  ? i % 2 === 0
                    ? dark
                      ? '#a855f7'
                      : '#c084fc'
                    : dark
                      ? '#10b981'
                      : '#34d399'
                  : dark
                    ? '#374151'
                    : '#e5e7eb',
              borderColor:
                i < ballsRemaining
                  ? i % 2 === 0
                    ? dark
                      ? '#9333ea'
                      : '#a855f7'
                    : dark
                      ? '#059669'
                      : '#10b981'
                  : dark
                    ? '#4b5563'
                    : '#d1d5db',
              transform: released && i >= ballsKept && i < ballsInGate ? 'scale(0) translateY(20px)' : 'scale(1) translateY(0)',
              opacity: released && i >= ballsKept && i < ballsInGate ? 0 : 1,
            }}
          />
        ))}
      </div>
      <div
        className="text-xs mt-3 text-center"
        style={{
          color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
        }}
      >
        {released ? `Released 4, keeping ${ballsKept}` : `Holding ${ballsInGate} balls`}
      </div>
    </PreviewBox>
  );
};

const MotifSnapshot = ({ dark }: { dark: boolean }) => {
  const { sessionData } = useSession();
  const pattern = sessionData.motifPattern ?? ['empty', 'empty', 'empty'];
  const allSet = pattern.every(c => c !== 'empty');

  const slotColor = (color: string) => {
    if (color === 'purple') return dark ? '#a855f7' : '#9333ea';
    if (color === 'green') return dark ? '#22c55e' : '#16a34a';
    return dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  };

  return (
    <div
      className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-3"
      style={{
        backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      <span className="text-xs font-medium opacity-50 shrink-0" style={{ color: dark ? '#fff' : '#000' }}>
        Your motif
      </span>
      <div className="flex gap-2">
        {pattern.map((color, i) => (
          <div
            key={i}
            className="w-5 h-5 rounded-full border-2 transition-colors duration-300"
            style={{
              backgroundColor: slotColor(color),
              borderColor: color === 'empty'
                ? (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)')
                : slotColor(color),
              opacity: color === 'empty' ? 0.4 : 1,
            }}
          />
        ))}
      </div>
      <span
        className="text-xs font-semibold ml-auto"
        style={{ color: allSet ? '#22c55e' : (dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)') }}
      >
        {allSet ? '✓ Set' : 'Not set'}
      </span>
    </div>
  );
};

interface StepDef {
  title: string;
  body: string | React.ReactNode;
  target: string | null;
  preview: ((dark: boolean) => React.ReactNode) | null;
  /** Prompt shown when the user should interact with the real page element */
  pageAction?: string;
  /** Watch a sessionData/context field for automatic task completion */
  watchKey?: 'sessionName' | 'notes' | 'motifPattern' | 'matchActive' | 'shots' | 'motifScore';
  /** Listen for a custom DOM event for task completion (e.g. keyboard score, gate toggle) */
  watchEvent?: string;
  /** How many times the watchEvent must fire before completing (default: 1) */
  watchEventCount?: number;
}

const STEPS: StepDef[] = [
  {
    title: 'Welcome to TeamTrack!',
    body: (
      <div className="space-y-2">
        <div>TeamTrack helps you track scoring during FTC matches in real time. This quick walkthrough will show you how to record shots, use the gate, and review your stats.</div>
        <div className="text-xs opacity-60">You can restart this tutorial anytime from the (?) button in the header.</div>
      </div>
    ) as React.ReactNode,
    target: null,
    preview: null,
  },
  {
    title: 'Scoring Grid',
    body: (
      <div className="space-y-2">
        <div>Tap cells to record each shot attempt. Each row represents how many balls were shot at once, and each column tracks how many of those went in.</div>
        <div className="text-xs opacity-50">Inspired by <a href="https://heronscout.me/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">Heron Scout</a>.</div>
      </div>
    ) as React.ReactNode,
    target: 'scoring',
    preview: d => <ScoringPreview dark={d} />,
    pageAction: 'Tap to record 3 shots on the grid above',
    watchKey: 'shots',
  },
  {
    title: 'Keyboard Scoring',
    body: (
      <div className="space-y-2">
        <div>For faster scoring, use keyboard shortcuts: press a number key (1–3) for how many balls were shot, then another number (0–3) for how many scored, then Enter to confirm.</div>
        <div className="text-xs opacity-50">Inspired by <a href="https://heronscout.me/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">Heron Scout</a>.</div>
      </div>
    ) as React.ReactNode,
    target: 'scoring',
    preview: d => <KeybindsPreview dark={d} />,
    pageAction: 'Record a shot using the keyboard shortcuts above',
    watchEvent: TUTORIAL_KEYBOARD_SCORE_EVENT,
  },
  {
    title: 'Gate Mechanic',
    body: 'The gate holds balls before release. Click "Open Gate" then confirm how many to keep, or use the shortcut: press G, enter a number, then Enter.',
    target: 'gate',
    preview: d => <GatePreview dark={d} />,
    pageAction: 'Open and close the gate at least 2 times',
    watchEvent: TUTORIAL_GATE_CYCLE_EVENT,
    watchEventCount: 2,
  },
  {
    title: 'Motif Scoring',
    body: 'After the match ends, the M buttons appear next to balls in the gate. Tap an M button to mark a motif match — each one adds 2 points to your score.',
    target: 'gate',
    preview: d => <MotifSnapshot dark={d} />,
    pageAction: 'Tap at least one M button above to score a motif',
    watchKey: 'motifScore',
  },
  {
    title: 'Scoring Metrics',
    body: 'Use the Autonomous, Teleop, and Endgame tabs to review and adjust your match data. You can toggle leave status, edit shot values, and change motif scores at any time before saving.',
    target: 'metrics',
    preview: d => <MetricsPreview dark={d} />,
    pageAction: 'Complete all 3 tasks in the panel above',
  },
  {
    title: "You're Ready!",
    body: (
      <div className="space-y-2">
        <div>You now know how to track shots, use the gate, score motifs, and review your metrics.</div>
        <div>Hit "Get Started" to begin your first match. After the match ends, you can save or edit your session from the Analysis page.</div>
      </div>
    ) as React.ReactNode,
    target: null,
    preview: null,
  },
];

const ORIGINAL_STYLES_KEY = '__tt_original_styles__';

function liftElement(el: HTMLElement, _breathing = false, darkMode = true) {
  (el as unknown as Record<string, unknown>)[ORIGINAL_STYLES_KEY] = {
    position: el.style.position,
    zIndex: el.style.zIndex,
    borderRadius: el.style.borderRadius,
    boxShadow: el.style.boxShadow,
    animation: el.style.animation,
    backgroundColor: el.style.backgroundColor,
    pointerEvents: el.style.pointerEvents,
    border: el.style.border,
  };
  el.style.position = 'relative';
  el.style.zIndex = '9999';
  el.style.borderRadius = '16px';
  el.style.pointerEvents = 'auto';
  // In light mode, force a solid white background so the element is fully
  // opaque against the dark backdrop overlay (same effect dark mode gets for free
  // from its natural dark background colors).
  if (!darkMode) {
    el.style.backgroundColor = '#ffffff';
  }
  // Always apply a static blue border (don't pulse the containers)
  // Only the clickable elements inside (M buttons, shot numbers, leave text) pulse
  el.style.border = `2px solid rgb(var(--team-blue) / 0.4)`;
  el.style.boxShadow = 'none';
}

function dropElement(el: HTMLElement) {
  el.classList.remove('tt-breathe');
  const orig = (el as unknown as Record<string, unknown>)[
    ORIGINAL_STYLES_KEY
  ] as Record<string, string> | undefined;
  if (orig) {
    el.style.position = orig.position ?? '';
    el.style.zIndex = orig.zIndex ?? '';
    el.style.borderRadius = orig.borderRadius ?? '';
    el.style.boxShadow = orig.boxShadow ?? '';
    el.style.animation = orig.animation ?? '';
    el.style.backgroundColor = orig.backgroundColor ?? '';
    el.style.pointerEvents = orig.pointerEvents ?? '';
    el.style.border = orig.border ?? '';
    delete (el as unknown as Record<string, unknown>)[ORIGINAL_STYLES_KEY];
  }
}

export const ActiveTutorial = () => {
  const { isDarkMode } = useTheme();
  const { user, isGuest, guestId, loading } = useAuth();
  const {
    sessionData, matchActive, setMatchActive, setMatchPhase, setIsTimerRunning,
    resetSession, updateSessionData, replaceSessionData, setIsTutorialActive,
    timer, setTimer, matchPhase, isTimerRunning, hasStarted, setHasStarted,
    sessionTimer, setSessionTimer, hasTransitionedToTeleop, setHasTransitionedToTeleop,
    showTeleopTransition, setShowTeleopTransition, phaseTimer, setPhaseTimer,
  } = useSession();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [tutorialEventCount, setTutorialEventCount] = useState(0);
  const [motifStepInitialized, setMotifStepInitialized] = useState(false);
  // bitmask: bit 0 = leave done, bit 1 = shot edited, bit 2 = motif toggled
  const [metricsTasksMask, setMetricsTasksMask] = useState(0);
  /** true when the user has already completed the tutorial once — all tasks are pre-skippable */
  const [isReplay, setIsReplay] = useState(false);
  const prevElRef = useRef<HTMLElement | null>(null);

  // Snapshot of session state saved before the tutorial starts (if there was an active session)
  const preTutorialSnapshotRef = useRef<{
    sessionData: typeof sessionData;
    matchActive: boolean;
    matchPhase: typeof matchPhase;
    timer: number;
    isTimerRunning: boolean;
    hasStarted: boolean;
    sessionTimer: number;
    hasTransitionedToTeleop: boolean;
    showTeleopTransition: boolean;
    phaseTimer: number;
  } | null>(null);

  // Generate a stable tutorial key for both logged-in users and guests
  const getTutorialKey = useCallback(() => {
    if (user?.uid) return `${STORAGE_KEYS.TUTORIAL_SEEN}-${user.uid}`;
    if (guestId) return `${STORAGE_KEYS.TUTORIAL_SEEN}-guest-${guestId}`;
    return STORAGE_KEYS.TUTORIAL_SEEN;
  }, [user, guestId]);

  useEffect(() => {
    const shouldStart = sessionStorage.getItem(STORAGE_KEYS.START_TUTORIAL);
    if (shouldStart) {
      sessionStorage.removeItem(STORAGE_KEYS.START_TUTORIAL);
      const t = setTimeout(() => {
        setStep(0);
        setVisible(true);
      }, 500);
      return () => clearTimeout(t);
    }
  }, []); // only on mount — independent of user loading

  // Snapshot session state when tutorial becomes visible so we can restore it on dismiss
  useEffect(() => {
    if (!visible) return;
    preTutorialSnapshotRef.current = {
      sessionData: JSON.parse(JSON.stringify(sessionData)),
      matchActive,
      matchPhase,
      timer,
      isTimerRunning,
      hasStarted,
      sessionTimer,
      hasTransitionedToTeleop,
      showTeleopTransition,
      phaseTimer,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]); // Only when visibility changes, not on every state update

  useEffect(() => {
    // Wait until auth has resolved (not still loading)
    if (loading) return;
    // Must have some identity (logged-in user OR guest)
    if (!user && !isGuest) return;
    const tutorialKey = getTutorialKey();
    const seen = localStorage.getItem(tutorialKey);
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    }
  }, [loading, user, isGuest, getTutorialKey]);

  useEffect(() => {
    if (!visible) return;
    const tutorialKey = getTutorialKey();
    const seen = localStorage.getItem(tutorialKey);
    setIsReplay(!!seen);
  }, [visible, getTutorialKey]);

  // When replaying, auto-complete any page task so the user can click Next freely
  useEffect(() => {
    if (!visible || !isReplay) return;
    const current = STEPS[step];
    if (current?.pageAction) {
      setTaskCompleted(true);
      // Also fill the metrics checklist so all items show as done
      setMetricsTasksMask(0b111);
    }
  }, [visible, step, isReplay]);

  // Activate match at the Scoring Grid step so the scoring grid becomes editable
  useEffect(() => {
    if (!visible) return;
    const SCORING_GRID_STEP_INDEX = STEPS.findIndex(s => s.title === 'Scoring Grid');
    if (step >= SCORING_GRID_STEP_INDEX && !matchActive) {
      setMatchActive(true);
      // Set initial phase and timer state for scoring to work
      if (sessionData.matchType === 'Teleop') {
        setMatchPhase('teleop');
      } else {
        setMatchPhase('auton');
      }
    }
  }, [visible, step, matchActive, sessionData.matchType, setMatchActive, setMatchPhase]);

  // Sync tutorial visible state with isTutorialActive to prevent audio playback
  useEffect(() => {
    setIsTutorialActive(visible);
  }, [visible, setIsTutorialActive]);

  useEffect(() => {
    const handle = () => {
      setStep(0);
      setVisible(true);
    };
    window.addEventListener(TUTORIAL_RESTART_EVENT, handle);
    return () => window.removeEventListener(TUTORIAL_RESTART_EVENT, handle);
  }, []);

  // Watch real sessionData/context for page-level task completion
  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    if (!current?.watchKey || taskCompleted) return;

    const key = current.watchKey;
    if (key === 'sessionName' && sessionData.sessionName?.trim()) {
      setTaskCompleted(true);
    }
    if (key === 'notes' && sessionData.notes?.trim()) {
      setTaskCompleted(true);
    }
    if (key === 'motifPattern') {
      const pattern = sessionData.motifPattern ?? [];
      if (pattern.length === 3 && pattern.every(s => s !== 'empty')) {
        setTaskCompleted(true);
      }
    }
    if (key === 'matchActive' && matchActive) {
      setTaskCompleted(true);
    }
    if (key === 'shots') {
      const total =
        (sessionData.autonShots?.length ?? 0) +
        (sessionData.teleopShots?.length ?? 0);
      if (total >= 3) setTaskCompleted(true);
    }
    if (key === 'motifScore') {
      if ((sessionData.autonMotif ?? 0) > 0 || (sessionData.teleMotif ?? 0) > 0) {
        setTaskCompleted(true);
      }
    }
  }, [
    visible,
    step,
    taskCompleted,
    sessionData.sessionName,
    sessionData.notes,
    sessionData.motifPattern,
    sessionData.autonShots,
    sessionData.teleopShots,
    sessionData.autonMotif,
    sessionData.teleMotif,
    matchActive,
  ]);

  // Broadcast current step to dependent components (like SessionSetup)
  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    window.dispatchEvent(new CustomEvent('teamtrack-tutorial-step-changed', {
      detail: { step, target: current?.target, taskCompleted, stepTitle: current?.title }
    }));
  }, [visible, step, taskCompleted]);

  // When reaching the Gate step, set up 9 balls for the user to interact with
  const GATE_STEP_INDEX = STEPS.findIndex(s => s.title === 'Gate Mechanic');
  const [gateStepInitialized, setGateStepInitialized] = useState(false);
  useEffect(() => {
    if (!visible || step !== GATE_STEP_INDEX) {
      setGateStepInitialized(false);
      return;
    }
    if (gateStepInitialized) return; // Only run once per step entry
    
    setGateStepInitialized(true);
    const GATE_CAPACITY = 9;
    // Set gateBallCount to 9 for gate tutorial step
    if ((sessionData.gateBallCount ?? 0) !== GATE_CAPACITY) {
      updateSessionData({ gateBallCount: GATE_CAPACITY });
    }
    // Reset match phase from 'ended' if returning from the Motif step,
    // otherwise the normal showMotifButtons logic in GateVisual stays true
    // and M buttons persist on the Gate step.
    if (matchPhase === 'ended') {
      if (sessionData.matchType === 'Teleop') {
        setMatchPhase('teleop');
      } else {
        setMatchPhase('auton');
      }
    }
  }, [visible, step, GATE_STEP_INDEX, sessionData.gateBallCount, sessionData.matchType, matchPhase, gateStepInitialized, updateSessionData, setMatchPhase]);

  // When on the motif scoring step, force match state to 'ended' so real M buttons appear
  const MOTIF_STEP_INDEX = STEPS.findIndex(s => s.watchKey === 'motifScore');
  useEffect(() => {
    if (!visible || step !== MOTIF_STEP_INDEX) {
      setMotifStepInitialized(false);
      return;
    }
    if (motifStepInitialized) return; // Only run once per step entry
    
    setMotifStepInitialized(true);
    
    // Ensure motif pattern is set and gate has balls so M buttons are visible
    const currentPattern = sessionData.motifPattern ?? ['empty', 'empty', 'empty'];
    const noneSet = currentPattern.every(c => c === 'empty');
    const updates: Partial<SessionFormData> = {};
    
    if (noneSet) {
      updates.motifPattern = ['purple', 'green', 'purple'];
    }
    if ((sessionData.gateBallCount ?? 0) < 3) {
      updates.gateBallCount = 3;
    }
    // Close the gate if left open from the Gate step — motif buttons require
    // the gate to be closed in the 'ended' phase, and the disabled logic also
    // depends on this.
    if (sessionData.gateAddBackMode) {
      updates.gateAddBackMode = false;
      updates.gateAddBackCount = 0;
    }
    
    if (Object.keys(updates).length > 0) {
      updateSessionData(updates);
    }
    
    setMatchActive(true);
    setMatchPhase('ended');
    setIsTimerRunning(false);
  }, [visible, step, MOTIF_STEP_INDEX, sessionData.motifPattern, sessionData.gateBallCount, sessionData.gateAddBackMode, motifStepInitialized, setMatchActive, setMatchPhase, setIsTimerRunning, updateSessionData]);

  const METRICS_STEP_INDEX = STEPS.findIndex(s => s.title === 'Scoring Metrics');
  useEffect(() => {
    if (!visible || step !== METRICS_STEP_INDEX) return;
    window.dispatchEvent(new CustomEvent(TUTORIAL_METRICS_AUTON_TAB_EVENT));
  }, [visible, step, METRICS_STEP_INDEX]);

  // Listen for the 3 sub-tasks on the Scoring Metrics step
  useEffect(() => {
    if (!visible || step !== METRICS_STEP_INDEX || taskCompleted) return;
    const makeHandler = (bit: number) => () => {
      setMetricsTasksMask(prev => {
        const next = prev | bit;
        if ((next & 0b111) === 0b111) setTaskCompleted(true);
        return next;
      });
    };
    const leaveHandler = makeHandler(0b001);
    const shotHandler  = makeHandler(0b010);
    const motifHandler = makeHandler(0b100);
    window.addEventListener(TUTORIAL_METRICS_LEAVE_EVENT, leaveHandler);
    window.addEventListener(TUTORIAL_METRICS_SHOT_EDIT_EVENT, shotHandler);
    window.addEventListener(TUTORIAL_METRICS_MOTIF_EDIT_EVENT, motifHandler);
    return () => {
      window.removeEventListener(TUTORIAL_METRICS_LEAVE_EVENT, leaveHandler);
      window.removeEventListener(TUTORIAL_METRICS_SHOT_EDIT_EVENT, shotHandler);
      window.removeEventListener(TUTORIAL_METRICS_MOTIF_EDIT_EVENT, motifHandler);
    };
  }, [visible, step, taskCompleted, METRICS_STEP_INDEX]);

  useEffect(() => {
    setTutorialEventCount(0);
    setMetricsTasksMask(0);
  }, [step]);

  // Listen for custom DOM events — supports counted requirements (watchEventCount)
  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    if (!current?.watchEvent || taskCompleted) return;

    const required = current.watchEventCount ?? 1;
    const handler = () => {
      setTutorialEventCount(prev => {
        const next = prev + 1;
        if (next >= required) setTaskCompleted(true);
        return next;
      });
    };

    window.addEventListener(current.watchEvent, handler);
    return () => window.removeEventListener(current.watchEvent!, handler);
  }, [visible, step, taskCompleted]);

  // Remove lift from previous element + apply to new one
  const applyHighlight = useCallback((targetAttr: string | null, breathing = false, dark = isDarkMode) => {
    // Drop previous
    if (prevElRef.current) {
      dropElement(prevElRef.current);
      prevElRef.current = null;
    }
    if (!targetAttr) return;

    // Special handling: if targeting session-setup and it's not in DOM,
    // send event to open it
    if (targetAttr === 'session-setup') {
      const el = document.querySelector<HTMLElement>(
        `[data-tutorial="${targetAttr}"]`
      );
      if (!el) {
        // Panel is closed, emit event to open it
        window.dispatchEvent(
          new CustomEvent(TUTORIAL_OPEN_SESSION_SETUP_EVENT)
        );
        // Re-query after a small delay to give React time to render
        setTimeout(() => {
          const newEl = document.querySelector<HTMLElement>(
            `[data-tutorial="${targetAttr}"]`
          );
          if (newEl) {
            liftElement(newEl, breathing, dark);
            prevElRef.current = newEl;
            const rect = newEl.getBoundingClientRect();
            const viewH = window.innerHeight;
            if (rect.top < 80 || rect.bottom > viewH - 80) {
              newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 50);
        return;
      }
    }

    const el = document.querySelector<HTMLElement>(
      `[data-tutorial="${targetAttr}"]`
    );
    if (!el) return;

    liftElement(el, breathing, dark);
    prevElRef.current = el;

    const rect = el.getBoundingClientRect();
    const viewH = window.innerHeight;
    if (rect.top < 80 || rect.bottom > viewH - 80) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isDarkMode]);

  const clearHighlight = useCallback(() => {
    if (prevElRef.current) {
      dropElement(prevElRef.current);
      prevElRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    const hasPageTask = !!current?.pageAction;
    applyHighlight(current?.target ?? null, hasPageTask, isDarkMode);
  }, [visible, step, applyHighlight, isDarkMode]);

  useEffect(() => {
    if (!visible) clearHighlight();
    return () => clearHighlight();
  }, [visible, clearHighlight]);

  const dismiss = useCallback(() => {
    setVisible(false);
    clearHighlight();
    setIsTutorialActive(false);

    // Restore session state from the pre-tutorial snapshot
    const snapshot = preTutorialSnapshotRef.current;
    if (snapshot) {
      // Full replacement of session data (not a merge) to ensure tutorial-only
      // properties like motifPattern/gateBallCount don't leak through
      replaceSessionData(snapshot.sessionData);
      // Restore match state
      setMatchActive(snapshot.matchActive);
      setMatchPhase(snapshot.matchPhase);
      setTimer(snapshot.timer);
      setIsTimerRunning(snapshot.isTimerRunning);
      setHasStarted(snapshot.hasStarted);
      setSessionTimer(snapshot.sessionTimer);
      setHasTransitionedToTeleop(snapshot.hasTransitionedToTeleop);
      setShowTeleopTransition(snapshot.showTeleopTransition);
      setPhaseTimer(snapshot.phaseTimer);
      preTutorialSnapshotRef.current = null;
    } else {
      // Fallback: no snapshot available (shouldn't happen normally)
      resetSession();
    }

    // Notify other components (e.g. clear keybind popup)
    window.dispatchEvent(new Event(TUTORIAL_ENDED_EVENT));
    // Scroll back to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Mark tutorial as seen for this user/guest
    const tutorialKey = getTutorialKey();
    localStorage.setItem(tutorialKey, 'true');
  }, [getTutorialKey, clearHighlight, resetSession, replaceSessionData, setIsTutorialActive, setMatchActive, setMatchPhase, setTimer, setIsTimerRunning, setHasStarted, setSessionTimer, setHasTransitionedToTeleop, setShowTeleopTransition, setPhaseTimer]);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) dismiss();
    else {
      setTaskCompleted(false);
      setStep(s => s + 1);
    }
  }, [step, dismiss]);

  const prev = useCallback(() => {
    if (step > 0) {
      setTaskCompleted(false);
      setStep(s => s - 1);
    }
  }, [step]);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      const currentStep = STEPS[step];
      const hasPageTask = !!currentStep?.pageAction && !taskCompleted;

      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        dismiss();
      }
      if (e.key === 'ArrowRight') {
        e.stopPropagation();
        e.preventDefault();
        next();
      }
      if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [visible, next, prev, dismiss, step, taskCompleted]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const hasTarget = !!current.target;

  const teamBlue = 'rgb(var(--team-blue))';
  // Light mode: stronger border opacity so it's visible against white background
  const teamBlue50 = isDarkMode ? 'rgb(var(--team-blue) / 0.5)' : 'rgb(var(--team-blue) / 0.75)';
  const teamBlue80 = 'rgb(var(--team-blue) / 0.8)';
  const bg = isDarkMode ? '#191919' : '#ffffff';
  const text = isDarkMode ? '#ffffff' : '#111111';
  const subtext = isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';

  const hasPageTask = !!current.pageAction;
  const taskPending = hasPageTask && !taskCompleted;

  return createPortal(
    <>
      <style>{`
        @keyframes ttCardIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ttCardCenter {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes ttCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes ttBreathe {
          0%, 100% {
            box-shadow: 0 0 0 4px rgb(var(--team-blue) / 0.35),
                        0 0 40px rgb(var(--team-blue) / 0.12);
          }
          50% {
            box-shadow: 0 0 0 6px rgb(var(--team-blue) / 0.55),
                        0 0 70px rgb(var(--team-blue) / 0.25);
          }
        }
        /* Stronger variant for light mode where team-blue is a muted #537788 */
        @keyframes ttBreatheLight {
          0%, 100% {
            box-shadow: 0 0 0 3px rgb(var(--team-blue) / 0.75),
                        0 0 28px rgb(var(--team-blue) / 0.22);
          }
          50% {
            box-shadow: 0 0 0 5px rgb(var(--team-blue) / 0.95),
                        0 0 48px rgb(var(--team-blue) / 0.35);
          }
        }
        .tt-card-slide { animation: ttCardIn 0.3s ease-out forwards; }
        .tt-card-center { animation: ttCardCenter 0.25s ease-out forwards; }
        .tt-breathe { animation: ttBreathe 2s ease-in-out infinite; }
        .tt-breathe[data-tt-dark="0"] { animation: ttBreatheLight 2s ease-in-out infinite; }
        @keyframes ttSlideRight {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes ttSlideLeft {
          from { opacity: 0; transform: translateX(-60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[9997]"
        style={{
          backgroundColor: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          pointerEvents: 'none',
        }}
      />

      <div
        key={step}
        className={
          hasTarget
            ? 'fixed z-[10000] tt-card-slide'
            : 'fixed z-[10000] tt-card-center'
        }
        style={
          hasTarget
            ? {
                bottom: 24,
                right: 24,
                width: 'min(400px, calc(100vw - 48px))',
                maxHeight: '80vh',
                overflowY: 'auto',
                backgroundColor: bg,
                border: `2px solid ${teamBlue50}`,
                color: text,
                borderRadius: 20,
                padding: '22px 22px 18px',
              }
            : {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(420px, 90vw)',
                maxHeight: '85vh',
                overflowY: 'auto',
                backgroundColor: bg,
                border: `2px solid ${teamBlue50}`,
                color: text,
                borderRadius: 20,
                padding: '24px 24px 20px',
              }
        }
        onClick={e => e.stopPropagation()}
      >
        <div
          className="absolute top-0 left-0 h-1 rounded-tl-[20px] transition-all duration-300"
          style={{
            width: `${((step + 1) / STEPS.length) * 100}%`,
            background: `linear-gradient(90deg, ${teamBlue80}, ${teamBlue})`,
            borderTopRightRadius: isLast ? 20 : 0,
          }}
        />

        <div
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: teamBlue }}
        >
          {step + 1} / {STEPS.length}
        </div>

        <h3 className="text-lg font-bold mb-1.5" style={{ color: teamBlue }}>
          {current.title}
        </h3>

        <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: subtext }}>
          {current.body}
        </div>

        {current.preview && current.preview(isDarkMode)}

        {hasPageTask && step === METRICS_STEP_INDEX ? (
          <div className="mt-4 flex flex-col gap-2">
            {[
              { label: 'Toggle the Autonomous Leave checkbox', bit: 0b001 },
              { label: 'Edit a shot value in the shots list',  bit: 0b010 },
              { label: 'Toggle a Motif button (M)',            bit: 0b100 },
            ].map(({ label, bit }) => {
              const done = !!(metricsTasksMask & bit);
              return (
                <div
                  key={bit}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-300"
                  style={{
                    backgroundColor: done
                      ? isDarkMode ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)'
                      : isDarkMode ? 'rgba(var(--team-blue) / 0.1)' : 'rgba(var(--team-blue) / 0.08)',
                    border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : 'rgb(var(--team-blue) / 0.25)'}`,
                  }}
                >
                  {done ? (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'rgba(34,197,94,0.2)' }}
                    >
                      <span className="text-green-500 text-xs font-bold">✓</span>
                    </div>
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                      style={{ borderColor: teamBlue, opacity: 0.5 }}
                    />
                  )}
                  <span
                    className="text-xs font-medium"
                    style={{ color: done ? (isDarkMode ? 'rgba(34,197,94,0.9)' : 'rgba(34,197,94,1)') : teamBlue }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
            {taskCompleted && (
              <button
                onClick={() => {
                  setTaskCompleted(false);
                  setMetricsTasksMask(0);
                }}
                className="text-xs font-medium mt-1 self-start opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: teamBlue }}
              >
                ↻ Try Again
              </button>
            )}
          </div>
        ) : hasPageTask ? (
          <div
            className="flex items-center gap-2 mt-4 px-3 py-2.5 rounded-xl transition-all duration-300"
            style={{
              backgroundColor: taskCompleted
                ? isDarkMode
                  ? 'rgba(34,197,94,0.1)'
                  : 'rgba(34,197,94,0.08)'
                : isDarkMode
                  ? 'rgba(var(--team-blue) / 0.1)'
                  : 'rgba(var(--team-blue) / 0.08)',
              border: `1px solid ${
                taskCompleted
                  ? 'rgba(34,197,94,0.3)'
                  : 'rgb(var(--team-blue) / 0.25)'
              }`,
            }}
          >
            {taskCompleted && (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(34,197,94,0.2)' }}
              >
                <span className="text-green-500 text-xs font-bold">✓</span>
              </div>
            )}
            <span
              className="text-xs font-medium"
              style={{
                color: taskCompleted
                  ? isDarkMode
                    ? 'rgba(34,197,94,0.9)'
                    : 'rgba(34,197,94,1)'
                  : teamBlue,
              }}
            >
              {taskCompleted
                ? 'Done! Click Next to continue '
                : current.watchEventCount && current.watchEventCount > 1
                  ? `${current.pageAction} (${Math.min(tutorialEventCount, current.watchEventCount)}/${current.watchEventCount})`
                  : current.watchKey === 'shots'
                    ? (() => {
                        const n = (sessionData.autonShots?.length ?? 0) + (sessionData.teleopShots?.length ?? 0);
                        return `${current.pageAction} (${Math.min(n, 3)}/3)`;
                      })()
                    : current.pageAction}
            </span>
            {taskCompleted && (
              <button
                onClick={() => {
                  setTaskCompleted(false);
                  setTutorialEventCount(0);
                  // Reset sessionData for watchKey-based steps so the watcher
                  // doesn't immediately re-complete the task
                  const watchKey = current.watchKey;
                  if (watchKey === 'shots') {
                    updateSessionData({ autonShots: [], teleopShots: [] });
                  } else if (watchKey === 'motifScore') {
                    updateSessionData({ autonMotif: 0, teleMotif: 0 });
                  }
                }}
                className="ml-auto text-xs font-medium opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                style={{ color: teamBlue }}
              >
                ↻ Try Again
              </button>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between mt-5">
          <button
            onClick={dismiss}
            className="text-xs font-medium uppercase tracking-wide opacity-45 hover:opacity-100 transition-opacity"
            style={{ color: text }}
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={prev}
                className="px-4 py-2 text-sm font-semibold rounded-xl transition-colors"
                style={{
                  border: `1px solid ${teamBlue50}`,
                  color: teamBlue,
                  backgroundColor: 'transparent',
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                next();
              }}
              className="px-5 py-2 text-sm font-bold rounded-xl transition-all duration-200"
              style={{
                backgroundColor: teamBlue,
                color: isDarkMode ? '#000' : '#fff',
              }}
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
