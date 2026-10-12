import { useId, useRef, useState } from 'react';
import { EllipsisVertical, Lock, Pencil, Trash2 } from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { useSessionCore } from '@/contexts';
import { robotCountOf } from '@/lib';
import type { RobotCount, SessionType } from '@/types';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { actionClass, toneText } from './tones';
import { useCompactControls } from './useCompactControls';

/** Long enough for any real name, short enough not to break page layouts */
const MAX_NAME_LENGTH = 80;

const MATCH_TYPES = ['Full Game', 'Autonomous', 'Teleop'] as const;

const SESSION_TYPES: Array<{ value: SessionType; hint: string }> = [
  { value: 'Practice', hint: 'Just your team' },
  { value: 'Scrim', hint: 'Against another alliance, with fouls' },
];

const ROBOT_COUNTS: Array<{ value: RobotCount; label: string }> = [
  { value: 1, label: '1 robot' },
  { value: 2, label: '2 robots' },
];

/** A group's heading in the menu, with the lock while a match runs */
const GroupLabel = ({
  children,
  locked,
}: {
  children: string;
  locked: boolean;
}) => (
  <DropdownMenuLabel
    className={`flex items-center justify-between gap-3 pt-2 ${EYEBROW_CLASS}`}
  >
    {children}
    {locked && (
      <span className="flex items-center gap-1 normal-case tracking-normal font-medium">
        <Lock aria-hidden className="h-3 w-3" />
        Locked during a match
      </span>
    )}
  </DropdownMenuLabel>
);

/**
 * The session's settings and its one destructive action, behind a small
 * "⋮": on a phone at the end of the title row, on a full-size screen at the
 * end of the row of controls. It stays out of the way of scoring: nothing
 * in it is needed to start or play a match (a new session is ready as it
 * is), and it never opens over the fields by itself.
 *
 * - the session's name, which opens a small dialog to rename it;
 * - match type, Practice or Scrim, and how many robots: chosen in place,
 *   applied at once, and held while a match is being played (the match
 *   being played was started as it is);
 * - Discard session, which goes at once with an Undo (see
 *   `handleDiscardSession`).
 */
export const SessionMenu = () => {
  const {
    sessionData,
    isDarkMode,
    loading,
    editingMatchId,
    handleDiscardSession,
    showRenameDialog,
    setShowRenameDialog,
  } = useLiveControls();
  const { updateSessionData, matchActive, isTutorialActive } = useSessionCore();
  const isCompact = useCompactControls();
  /** Rename was chosen: the dialog opens once the menu has closed */
  const renameRef = useRef(false);

  // The match being played was started as these say. The walkthrough's
  // practice match doesn't count: it is put back when the walkthrough
  // closes, settings and all.
  const locked = matchActive && !isTutorialActive;
  const name = sessionData.sessionName?.trim() || 'Untitled session';

  const setSessionType = (value: string) => {
    const type = value as SessionType;
    // Fouls are only counted in a scrim; ones in the fields would otherwise
    // stay on the next match with no counter to clear them. Not the fields
    // of a saved match open for editing: those are that match's.
    updateSessionData(
      type === 'Practice' && !editingMatchId
        ? { sessionType: type, minorPenalties: 0, majorPenalties: 0 }
        : { sessionType: type }
    );
  };

  const setRobotCount = (value: string) => {
    const robotCount = Number(value) as RobotCount;
    // The same for a second robot's LEAVE and PARK
    updateSessionData(
      robotCount === 1 && !editingMatchId
        ? {
            robotCount,
            robot2Leave: false,
            robot2ParkAuto: false,
            robot2ParkTeleop: false,
          }
        : { robotCount }
    );
  };

  return (
    <>
      <DropdownMenu>
        {/* Radix gives the trigger an id, so global.css's 5rem margin for
            anchors would scroll the page when focus comes back to it as
            the menu closes. */}
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onKeyDown={ignoreHeldEnter}
            aria-label="Session menu"
            title="Session menu"
            data-session-menu
            className={`shrink-0 scroll-mt-0 ${
              isCompact ? 'h-11 w-11 rounded-xl' : 'h-12 w-12 rounded-2xl'
            } ${actionClass('neutral', isDarkMode)}`}
          >
            <EllipsisVertical aria-hidden className="h-5 w-5 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-72 max-w-[calc(100vw-2rem)]"
          // The rename dialog opens once the menu has handed focus back to
          // its button, where the dialog then returns it.
          onCloseAutoFocus={() => {
            if (!renameRef.current) return;
            renameRef.current = false;
            setShowRenameDialog(true);
          }}
        >
          <DropdownMenuItem
            disabled={loading}
            onSelect={() => {
              renameRef.current = true;
            }}
            className="gap-2"
          >
            <Pencil aria-hidden className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              Rename
            </span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <GroupLabel locked={locked}>Match type</GroupLabel>
          <DropdownMenuRadioGroup
            value={sessionData.matchType}
            onValueChange={value => updateSessionData({ matchType: value })}
          >
            {MATCH_TYPES.map(type => (
              <DropdownMenuRadioItem
                key={type}
                value={type}
                disabled={locked || loading}
              >
                {type}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <GroupLabel locked={locked}>Session type</GroupLabel>
          <DropdownMenuRadioGroup
            value={sessionData.sessionType}
            onValueChange={setSessionType}
          >
            {SESSION_TYPES.map(type => (
              <DropdownMenuRadioItem
                key={type.value}
                value={type.value}
                disabled={locked || loading}
              >
                <span className="flex flex-col">
                  <span>{type.value}</span>
                  <span className="text-xs text-muted-foreground">
                    {type.hint}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <GroupLabel locked={locked}>Robots</GroupLabel>
          <DropdownMenuRadioGroup
            value={String(robotCountOf(sessionData))}
            onValueChange={setRobotCount}
          >
            {ROBOT_COUNTS.map(count => (
              <DropdownMenuRadioItem
                key={count.value}
                value={String(count.value)}
                disabled={locked || loading}
              >
                {count.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={loading}
            onSelect={handleDiscardSession}
            // Red, also while it has focus (the menu's rows turn neutral)
            className={`gap-2 font-semibold focus:bg-red-500/10 ${
              isDarkMode
                ? 'text-red-400 focus:text-red-400'
                : 'text-red-700 focus:text-red-700'
            }`}
          >
            <Trash2 aria-hidden className="h-4 w-4 shrink-0" />
            Discard session
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showRenameDialog && (
        <RenameSessionDialog onClose={() => setShowRenameDialog(false)} />
      )}
    </>
  );
};

/**
 * Renames the session: one field and Save. The name is the session's from
 * here on (in Sessions, Analysis and share links); the app's own numbered
 * names are only where a session starts.
 */
const RenameSessionDialog = ({ onClose }: { onClose: () => void }) => {
  const { sessionData, isDarkMode } = useLiveControls();
  const { updateSessionData } = useSessionCore();
  const [name, setName] = useState(sessionData.sessionName ?? '');
  const hasName = name.trim().length > 0;
  const nameId = useId();
  const errorId = useId();

  const save = () => {
    if (!hasName) return;
    const typed = name.trim();
    updateSessionData({
      sessionName: typed,
      // Saved unchanged, the app's own name stays the app's
      ...(typed !== sessionData.sessionName?.trim() && {
        sessionNameTyped: true,
      }),
    });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={`max-w-sm border p-6 ${
          isDarkMode
            ? 'bg-team-dark border-team-blue-40'
            : 'bg-white border-gray-200'
        }`}
      >
        <form
          noValidate
          onSubmit={e => {
            e.preventDefault();
            save();
          }}
          className="space-y-4"
        >
          <DialogTitle className={isDarkMode ? 'text-white' : 'text-gray-900'}>
            {sessionData.sessionName?.trim()
              ? 'Rename session'
              : 'Name this session'}
          </DialogTitle>
          <div className="space-y-2">
            <label
              htmlFor={nameId}
              className={`block ${EYEBROW_CLASS} ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Session name
            </label>
            <Input
              id={nameId}
              name="sessionName"
              type="text"
              autoComplete="off"
              data-autofocus
              maxLength={MAX_NAME_LENGTH}
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={e => e.target.select()}
              aria-invalid={!hasName}
              aria-describedby={hasName ? undefined : errorId}
              className={`h-12 px-4 rounded-xl border-2 ${
                isDarkMode ? 'bg-team-dark text-white' : 'bg-white text-black'
              }`}
            />
            {!hasName && (
              <p
                id={errorId}
                role="alert"
                className={`text-xs font-medium ${toneText('red', isDarkMode)}`}
              >
                Give the session a name
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 min-h-11 rounded-xl text-sm ${actionClass('neutral', isDarkMode)}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hasName}
              className={`px-5 min-h-11 rounded-xl text-sm ${actionClass('primary', isDarkMode)}`}
            >
              Save
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
