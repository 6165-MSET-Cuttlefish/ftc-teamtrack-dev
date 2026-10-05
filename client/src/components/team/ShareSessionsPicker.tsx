import { CheckSquare, Square } from 'lucide-react';
import type { Session } from '@/types';
import { sessionSummary } from './sessionSummary';

interface ShareSessionsPickerProps {
  /** The user's own sessions the team doesn't have yet (archived ones left out) */
  sessions: Session[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  isDarkMode: boolean;
}

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count !== 1 ? 's' : ''}`;

/**
 * Which of your sessions to share with a team: a "Select all" tick over a
 * divided list, one row per session with its name and a summary line. The
 * one picker for this step, in the team dialog (after creating or joining a
 * team, or "Share my sessions…") and on the invite page after joining.
 *
 * Rows wrap rather than truncate, and a summary breaks only between its
 * parts. Three rows always show whole; from four on the list scrolls inside
 * its border, the cut-off row showing there is more.
 */
export const ShareSessionsPicker = ({
  sessions,
  selected,
  onChange,
  isDarkMode,
}: ShareSessionsPickerProps) => {
  const allSelected =
    sessions.length > 0 && sessions.every(session => selected.has(session.id));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const box = (checked: boolean) =>
    checked ? (
      <CheckSquare
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-team-blue"
      />
    ) : (
      <Square
        aria-hidden="true"
        className={`h-4 w-4 shrink-0 ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
      />
    );

  return (
    <div>
      {/* pl-[17px]: the rows' px-4 plus the list's 1px border, so this tick
          sits in the same column as theirs */}
      <button
        type="button"
        role="checkbox"
        aria-checked={allSelected}
        onClick={() =>
          onChange(allSelected ? new Set() : new Set(sessions.map(s => s.id)))
        }
        className={`flex w-full items-center justify-start gap-3 rounded-lg py-2 pl-[17px] pr-4 text-left text-sm font-medium transition-colors [@media(pointer:coarse)]:min-h-11 ${
          isDarkMode
            ? 'text-team-white-60 hover:bg-team-dark-20'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        {box(allSelected)}
        Select all ({plural(sessions.length, 'session')})
      </button>

      <div
        role="group"
        aria-label="Sessions to share"
        className={`mt-1 rounded-xl border divide-y ${
          sessions.length > 3
            ? 'max-h-[11rem] overflow-y-auto'
            : 'overflow-hidden'
        } ${
          isDarkMode
            ? 'border-team-blue-40 divide-team-blue-40'
            : 'border-gray-200 divide-gray-100'
        }`}
      >
        {sessions.map(session => {
          const checked = selected.has(session.id);
          return (
            <button
              key={session.id}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => toggle(session.id)}
              className={`flex w-full items-center justify-start gap-3 px-4 py-2.5 text-left transition-colors ${
                checked
                  ? isDarkMode
                    ? 'bg-team-blue/10'
                    : 'bg-team-blue/5'
                  : isDarkMode
                    ? 'hover:bg-team-dark-20'
                    : 'hover:bg-gray-50'
              }`}
            >
              {box(checked)}
              <span className="min-w-0 flex-1">
                <span
                  className={`block break-words text-sm font-medium ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {session.sessionName || 'Untitled Session'}
                </span>
                <span
                  className={`block text-xs ${
                    isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                  }`}
                >
                  {sessionSummary(session)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
