import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { actionClass } from './controls/tones';
import { useSessionCore, useTheme } from '@/contexts';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { CHIP_BASE, CHIP_SIZES, chipTone } from '@/components/ui/tokens';
import {
  ALLIANCE_NAMES,
  MAX_MATCH_LABEL,
  RESULT_NAMES,
  calculateScore,
  describeTournamentMatch,
  ftcScoutEventUrl,
  ftcScoutTeamUrl,
  matchResult,
  type MatchResult,
} from '@/lib';
import { liveMatchType } from '@/lib';
import { formatPoints } from '@/lib/points';
import type { AllianceColor, TournamentMatchInfo } from '@/types';

/** Digits only, at most five: an FTC team number as it is typed */
const digits = (value: string) => value.replace(/\D/g, '').slice(0, 5);

/** A typed score: a whole number, or nothing */
const scoreOf = (value: string): number | undefined => {
  const s = value.replace(/\D/g, '').slice(0, 4);
  return s === '' ? undefined : Number(s);
};

/**
 * The details as they are being typed, without `undefined`s, keeping
 * empty opponent slots in place so the second can be typed before the
 * first. Saving a match tidies them (see `toTournamentInfo`).
 */
const withChange = (
  info: TournamentMatchInfo | undefined,
  changes: Partial<TournamentMatchInfo>
): TournamentMatchInfo | undefined => {
  const next: Record<string, unknown> = { ...info, ...changes };
  for (const key of Object.keys(next)) {
    const v = next[key];
    if (v === undefined || v === '') delete next[key];
  }
  if (
    Array.isArray(next.opponents) &&
    (next.opponents as string[]).every(o => !o)
  ) {
    delete next.opponents;
  }
  return Object.keys(next).length ? (next as TournamentMatchInfo) : undefined;
};

const resultTone = (r: MatchResult) =>
  r === 'W' ? 'success' : r === 'L' ? 'danger' : 'neutral';

/** "Win" / "Loss" / "Tie" as a chip */
export const ResultChip = ({
  result,
  size = 'sm',
}: {
  result: MatchResult;
  size?: 'sm' | 'md';
}) => {
  const { isDarkMode } = useTheme();
  return (
    <span
      className={`${CHIP_BASE} ${CHIP_SIZES[size]} ${chipTone(resultTone(result), isDarkMode)}`}
    >
      {RESULT_NAMES[result]}
    </span>
  );
};

/** A team number, linked to its FTC Scout page */
export const TeamLink = ({ team }: { team: string }) => {
  const url = ftcScoutTeamUrl(team);
  if (!url) return <span>{team}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Team ${team} on FTC Scout`}
      className="inline-flex items-center gap-0.5 font-semibold text-team-blue underline-offset-2 hover:underline"
    >
      {team}
      <ExternalLink aria-hidden className="h-3 w-3" />
      <span className="sr-only"> (opens FTC Scout)</span>
    </a>
  );
};

/** A Tournament's event, linked to its FTC Scout page */
export const EventLink = ({ code }: { code: string | undefined }) => {
  const url = ftcScoutEventUrl(code);
  if (!url || !code) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-team-blue underline-offset-2 hover:underline"
    >
      {code}
      <ExternalLink aria-hidden className="h-3.5 w-3.5" />
      <span className="sr-only"> on FTC Scout</span>
    </a>
  );
};

/**
 * A saved tournament match in one line, for the review pages: its label,
 * alliance, who it was with and against (linked to FTC Scout), and its
 * result once the opposing score is in.
 */
export const TournamentSummary = ({
  info,
  scored,
}: {
  info: TournamentMatchInfo | undefined;
  scored: number;
}) => {
  if (!info) return null;
  const result = matchResult(info, scored);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {info.label && <span className="font-semibold">{info.label}</span>}
      {info.alliance && (
        <span
          className={
            info.alliance === 'red'
              ? 'font-semibold text-red-600 dark:text-red-400'
              : 'font-semibold text-blue-600 dark:text-blue-400'
          }
        >
          {ALLIANCE_NAMES[info.alliance]}
        </span>
      )}
      {info.partner && (
        <span>
          with <TeamLink team={info.partner} />
        </span>
      )}
      {!!info.opponents?.length && (
        <span>
          vs{' '}
          {info.opponents.map((o, i) => (
            <span key={`${o}-${i}`}>
              {i > 0 && ', '}
              <TeamLink team={o} />
            </span>
          ))}
        </span>
      )}
      {result && (
        <span className="inline-flex items-center gap-1">
          <ResultChip result={result} />
          <span className="tabular-nums">
            {formatPoints(info.ourScore ?? scored)}
            {' to '}
            {formatPoints(info.theirScore ?? 0)}
          </span>
        </span>
      )}
    </span>
  );
};

/**
 * The editor for a tournament match's details: its label, alliance colour,
 * partner and opponents, and the official scores once posted. Every part is
 * optional, and none of it changes what the match scores.
 */
export const TournamentDetailsEditor = ({
  info,
  scored,
  onChange,
  disabled = false,
}: {
  info: TournamentMatchInfo | undefined;
  /** What the match scored here, the official score's placeholder */
  scored: number;
  onChange: (info: TournamentMatchInfo | undefined) => void;
  disabled?: boolean;
}) => {
  const { isDarkMode } = useTheme();
  const id = useId();
  const set = (changes: Partial<TournamentMatchInfo>) =>
    onChange(withChange(info, changes));
  const opponents = [info?.opponents?.[0] ?? '', info?.opponents?.[1] ?? ''];
  const result = matchResult(info, scored);

  const input = `h-11 w-full min-w-0 rounded-xl border-2 px-3 text-sm tabular-nums disabled:cursor-not-allowed disabled:opacity-50 ${
    isDarkMode
      ? 'border-team-blue-40 bg-team-dark text-white placeholder:text-team-white-60'
      : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400'
  }`;
  const label = `block text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`;
  const allianceButton = (color: AllianceColor) => {
    const on = info?.alliance === color;
    const tint =
      color === 'red'
        ? on
          ? 'border-red-600 bg-red-600 text-white'
          : isDarkMode
            ? 'border-red-400/60 text-red-300 hover:bg-red-500/10'
            : 'border-red-300 text-red-700 hover:bg-red-50'
        : on
          ? 'border-blue-600 bg-blue-600 text-white'
          : isDarkMode
            ? 'border-blue-400/60 text-blue-300 hover:bg-blue-500/10'
            : 'border-blue-300 text-blue-700 hover:bg-blue-50';
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        disabled={disabled}
        onClick={() => set({ alliance: on ? undefined : color })}
        className={`h-11 min-w-0 flex-1 rounded-xl border-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tint}`}
      >
        {ALLIANCE_NAMES[color]}
      </button>
    );
  };
  const teamField = (
    fieldId: string,
    text: string,
    value: string,
    onValue: (v: string) => void
  ) => {
    const url = ftcScoutTeamUrl(value);
    return (
      <div className="min-w-0 space-y-1">
        <label htmlFor={fieldId} className={label}>
          {text}
        </label>
        <input
          id={fieldId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Team #"
          disabled={disabled}
          value={value}
          onChange={e => onValue(digits(e.target.value))}
          className={input}
        />
        <p className="h-4 text-xs">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-team-blue underline-offset-2 hover:underline"
            >
              FTC Scout
              <ExternalLink aria-hidden className="h-3 w-3" />
              <span className="sr-only"> for team {value}</span>
            </a>
          )}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
        <div className="min-w-0 space-y-1">
          <label htmlFor={`${id}-label`} className={label}>
            Match
          </label>
          <input
            id={`${id}-label`}
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="Q12"
            maxLength={MAX_MATCH_LABEL}
            disabled={disabled}
            value={info?.label ?? ''}
            onChange={e => set({ label: e.target.value.toUpperCase() })}
            className={input}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <span id={`${id}-alliance`} className={label}>
            Alliance
          </span>
          <div
            role="radiogroup"
            aria-labelledby={`${id}-alliance`}
            className="flex gap-2"
          >
            {allianceButton('red')}
            {allianceButton('blue')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {teamField(`${id}-partner`, 'Partner', info?.partner ?? '', v =>
          set({ partner: v })
        )}
        {teamField(`${id}-opp1`, 'Opponent 1', opponents[0], v =>
          set({ opponents: [v, opponents[1]] })
        )}
        {teamField(`${id}-opp2`, 'Opponent 2', opponents[1], v =>
          set({ opponents: [opponents[0], v] })
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-1">
          <label htmlFor={`${id}-ours`} className={label}>
            Our official score
          </label>
          <input
            id={`${id}-ours`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={`${scored} (scored here)`}
            disabled={disabled}
            value={info?.ourScore ?? ''}
            onChange={e => set({ ourScore: scoreOf(e.target.value) })}
            className={input}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <label htmlFor={`${id}-theirs`} className={label}>
            Opponent score
          </label>
          <input
            id={`${id}-theirs`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Posted score"
            disabled={disabled}
            value={info?.theirScore ?? ''}
            onChange={e => set({ theirScore: scoreOf(e.target.value) })}
            className={input}
          />
        </div>
      </div>

      <p className="flex min-h-6 items-center gap-2 text-sm" aria-live="polite">
        {result ? (
          <>
            <ResultChip result={result} size="md" />
            <span className="tabular-nums">
              {formatPoints(info?.ourScore ?? scored)} to{' '}
              {formatPoints(info?.theirScore ?? 0)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            Add the opponent’s score for the result
          </span>
        )}
      </p>
    </div>
  );
};

/**
 * The Tournament match details on /active, for the match in the fields
 * (the one being played, or a saved one open for fixing): one row at the
 * top of the page that says what is set, opened to change it. Save closes
 * it; Cancel puts back what it held when it was opened. What is typed goes
 * into the match as it is typed, so saving the match with it still open
 * loses nothing.
 *
 * It opens by itself when a match ends, for the opponent's posted score.
 */
export const ActiveTournamentDetails = () => {
  const { isDarkMode } = useTheme();
  const {
    sessionData,
    updateSessionData,
    editingMatchId,
    matchActive,
    matchPhase,
    isTutorialActive,
  } = useSessionCore();
  const matches = sessionData.matches ?? [];
  const editing = editingMatchId
    ? matches.find(m => m.id === editingMatchId)
    : undefined;
  const scored = calculateScore({
    ...sessionData,
    matchType: liveMatchType(sessionData, editingMatchId),
  }).total;
  const number = editing ? editing.matchNumber : matches.length + 1;
  const info = sessionData.tournament;
  const panelId = useId();

  const [open, setOpen] = useState(false);
  /** What the details were when the panel was opened, for Cancel */
  const openedWith = useRef<TournamentMatchInfo | undefined>(undefined);
  const infoRef = useRef(info);
  infoRef.current = info;
  const openPanel = useCallback(() => {
    openedWith.current = infoRef.current;
    setOpen(true);
  }, []);

  // Another match in the fields (one saved, or a saved one opened): what
  // was open belonged to the last one, and went with it.
  const fieldsKey = `${editingMatchId ?? 'live'}:${matches.length}`;
  const keyRef = useRef(fieldsKey);
  useEffect(() => {
    if (keyRef.current === fieldsKey) return;
    keyRef.current = fieldsKey;
    setOpen(false);
  }, [fieldsKey]);

  // The buzzer (or End early): open for the opponent's score
  const ended = matchActive && !editing && matchPhase === 'ended';
  const endedRef = useRef(ended);
  useEffect(() => {
    if (ended && !endedRef.current && !isTutorialActive) openPanel();
    endedRef.current = ended;
  }, [ended, isTutorialActive, openPanel]);

  const cancel = () => {
    updateSessionData({ tournament: openedWith.current });
    setOpen(false);
  };

  const result = matchResult(info, scored);
  const summary = [
    describeTournamentMatch(info),
    result
      ? `${RESULT_NAMES[result]} ${info?.ourScore ?? scored} to ${info?.theirScore}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const muted = isDarkMode ? 'text-gray-400' : 'text-gray-600';

  return (
    <section
      aria-label={`Match ${number} details`}
      className={`rounded-2xl border-2 ${
        isDarkMode ? 'border-gray-700 bg-team-dark' : 'border-gray-200 bg-white'
      }`}
    >
      <h2>
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPanel())}
          disabled={isTutorialActive}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full min-w-0 items-center gap-3 px-4 py-2 text-left min-h-11 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={`shrink-0 ${EYEBROW_CLASS}`}>Match details</span>
          {!open && (
            <span
              className={`min-w-0 flex-1 truncate text-sm font-normal ${muted}`}
            >
              {summary || `Match ${number}: add the label, alliances and score`}
            </span>
          )}
          <ChevronDown
            size={20}
            aria-hidden
            className={`ml-auto shrink-0 transition-transform ${
              open ? 'rotate-180' : ''
            } ${muted}`}
          />
        </button>
      </h2>

      <div id={panelId} hidden={!open} className="px-4 pb-4">
        {open && (
          <>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className={`text-sm ${muted}`}>
                Match {number}
                {ended ? ': add the posted scores' : ''}
              </p>
              {sessionData.eventCode && (
                <span className="text-xs">
                  Event <EventLink code={sessionData.eventCode} />
                </span>
              )}
            </div>
            <TournamentDetailsEditor
              info={info}
              scored={scored}
              onChange={tournament => updateSessionData({ tournament })}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancel}
                className={`px-4 min-h-11 rounded-xl text-sm ${actionClass('neutral', isDarkMode)}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`px-5 min-h-11 rounded-xl text-sm ${actionClass('primary', isDarkMode)}`}
              >
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
