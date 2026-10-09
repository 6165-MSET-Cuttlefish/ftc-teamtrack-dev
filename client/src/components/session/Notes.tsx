import { useTheme, useSessionCore } from '@/contexts';
import { useState, useRef, useCallback, useId, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { STORAGE_KEYS } from '@/constants';
import { htmlToText } from '@/lib';
import { NotesEditor } from './NotesEditor';

export const Notes = () => {
  const { isDarkMode } = useTheme();
  const { sessionData, updateSessionData, sessionEpoch } = useSessionCore();
  const editorRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const panelId = useId();
  // Closed by default so the scoring page stays short; the choice sticks on
  // this device. The editor stays mounted while closed (it is uncontrolled),
  // only hidden.
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.NOTES_EXPANDED) === '1';
    } catch {
      return false;
    }
  });
  const preview = useMemo(
    () => htmlToText(sessionData.notes ?? ''),
    [sessionData.notes]
  );

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem(STORAGE_KEYS.NOTES_EXPANDED, next ? '1' : '0');
    } catch {
      /* private mode: just this visit */
    }
    if (next) {
      // Opening it is asking to write: put the caret at the end.
      requestAnimationFrame(() => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
    }
  };

  const handleChange = useCallback(
    (notes: string) => updateSessionData({ notes }),
    [updateSessionData]
  );

  return (
    <div className={expanded ? 'space-y-2' : undefined}>
      <h2>
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="group flex w-full min-w-0 items-center gap-3 text-left min-h-11"
        >
          <span className={`shrink-0 ${EYEBROW_CLASS}`}>Session Notes</span>
          {!expanded && (
            <span
              className={`min-w-0 flex-1 truncate text-sm font-normal ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {preview || 'Add a note'}
            </span>
          )}
          <ChevronDown
            size={20}
            aria-hidden
            className={`ml-auto shrink-0 transition-transform ${
              expanded ? 'rotate-180' : ''
            } ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
          />
        </button>
      </h2>

      <div id={panelId} hidden={!expanded} className="w-full">
        <span
          id={labelId}
          // Read out as the editor's name; on screen the heading says it.
          className="sr-only"
        >
          Session notes
        </span>

        {/* A cancelled or reset session starts the box over (its epoch) */}
        <NotesEditor
          html={sessionData.notes ?? ''}
          onChange={handleChange}
          resetKey={sessionEpoch}
          labelledBy={labelId}
          editorRef={editorRef}
        />
      </div>
    </div>
  );
};
