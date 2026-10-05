import { useTheme, useSessionCore } from '@/contexts';
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
} from 'react';
import {
  Bold,
  Italic,
  Highlighter,
  List,
  ListOrdered,
  ChevronDown,
  Eraser,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { STORAGE_KEYS } from '@/constants';
import { htmlToText } from '@/lib';

/**
 * Highlight colours, as applied. Each is a see-through tint of a mid shade,
 * so the text keeps its own colour and stays readable on the light page and
 * on the dark ones (notes are read back in whichever theme the reader has).
 * The menu's swatch is the very colour that goes on the text.
 */
const HIGHLIGHT_COLORS = [
  { name: 'Yellow', css: 'rgba(250, 204, 21, 0.4)' },
  { name: 'Green', css: 'rgba(74, 222, 128, 0.4)' },
  { name: 'Pink', css: 'rgba(244, 114, 182, 0.4)' },
  { name: 'Blue', css: 'rgba(96, 165, 250, 0.4)' },
  { name: 'Orange', css: 'rgba(251, 146, 60, 0.4)' },
  { name: 'Purple', css: 'rgba(192, 132, 252, 0.4)' },
] as const;

/** Toolbar buttons: compact with a mouse, a full 44px target on touch */
const TOOL_BUTTON =
  'p-2 rounded-md transition-colors inline-flex shrink-0 items-center justify-center [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

/** Menu rows, as in the app's other menus: 44px on touch */
const MENU_ITEM =
  'flex items-center gap-2 cursor-pointer [@media(pointer:coarse)]:min-h-11';

export const Notes = () => {
  const { isDarkMode } = useTheme();
  const { sessionData, updateSessionData, sessionEpoch } = useSessionCore();
  const editorRef = useRef<HTMLDivElement>(null);
  const shownEpochRef = useRef<number | null>(null);
  /** Where the caret or selection last was in the editor */
  const savedRangeRef = useRef<Range | null>(null);
  /** A highlight chosen in the menu, applied once the menu has closed */
  const pendingHighlightRef = useRef<string | null>(null);
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

  // The editor is uncontrolled (React re-rendering it would lose the caret),
  // so notes that change from outside it have to be pushed in by hand: the
  // stored notes on arrival, and '' when the session is cancelled or reset —
  // otherwise the old text stays on screen and is saved into the next session.
  // While the user is typing, the editor is the newer of the two; leave it.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const isNewSession = shownEpochRef.current !== sessionEpoch;
    shownEpochRef.current = sessionEpoch;
    const notes = sessionData.notes ?? '';
    if (editor.innerHTML === notes) return;
    if (!isNewSession && document.activeElement === editor) return;
    editor.innerHTML = notes;
  }, [sessionData.notes, sessionEpoch]);

  // A menu takes focus from the editor; remember what was selected there, so
  // the highlight lands on it.
  useEffect(() => {
    const remember = () => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    };
    document.addEventListener('selectionchange', remember);
    return () => document.removeEventListener('selectionchange', remember);
  }, []);

  const handleEditorChange = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      updateSessionData({ notes: html });
    }
  }, [updateSessionData]);

  const applyFormat = useCallback(
    (command: string, value?: string) => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
      handleEditorChange();
    },
    [handleEditorChange]
  );

  /** Back into the editor, with the selection it had before the menu opened */
  const restoreSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = savedRangeRef.current;
    const selection = window.getSelection();
    if (range && selection && editor.contains(range.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  const iconTone = isDarkMode
    ? 'text-white hover:bg-white/10'
    : 'text-gray-900 hover:bg-gray-100';

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
          Performance Notes & Observations
        </span>

        {/*
          One box: the toolbar is its top row, the text under it, inside a
          single border that lights up while either has focus.
        */}
        <div
          className={`overflow-hidden rounded-xl border-2 border-team-blue-40 transition-colors focus-within:border-team-blue ${
            isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'
          }`}
        >
          <div
            role="toolbar"
            aria-label="Text formatting"
            className="flex flex-nowrap items-center gap-1 border-b border-team-blue-40 px-1 py-1"
          >
            <button
              type="button"
              onClick={() => applyFormat('bold')}
              title="Bold (Ctrl+B)"
              aria-label="Bold"
              className={`${TOOL_BUTTON} ${iconTone}`}
            >
              <Bold size={18} strokeWidth={2.5} aria-hidden />
            </button>

            <button
              type="button"
              onClick={() => applyFormat('italic')}
              title="Italic (Ctrl+I)"
              aria-label="Italic"
              className={`${TOOL_BUTTON} ${iconTone}`}
            >
              <Italic size={18} strokeWidth={2.5} aria-hidden />
            </button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Highlight"
                  className={`${TOOL_BUTTON} gap-0.5 ${iconTone}`}
                >
                  <Highlighter size={18} strokeWidth={2.5} aria-hidden />
                  <ChevronDown size={14} aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[160px]"
                // Back to the text (not the button), and only then mark it:
                // the editor has to hold the focus and the selection.
                onCloseAutoFocus={e => {
                  e.preventDefault();
                  restoreSelection();
                  const color = pendingHighlightRef.current;
                  pendingHighlightRef.current = null;
                  if (color !== null) applyFormat('backColor', color);
                }}
              >
                {HIGHLIGHT_COLORS.map(color => (
                  <DropdownMenuItem
                    key={color.name}
                    onSelect={() => {
                      pendingHighlightRef.current = color.css;
                    }}
                    className={MENU_ITEM}
                  >
                    <span
                      aria-hidden
                      className={`h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-inset ${
                        isDarkMode ? 'ring-white/20' : 'ring-black/10'
                      }`}
                      style={{ backgroundColor: color.css }}
                    />
                    {color.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    pendingHighlightRef.current = 'transparent';
                  }}
                  className={MENU_ITEM}
                >
                  <Eraser size={14} aria-hidden className="shrink-0" />
                  No highlight
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div
              aria-hidden
              className="mx-1 h-6 w-px shrink-0 bg-team-blue-40"
            />

            <button
              type="button"
              onClick={() => applyFormat('insertUnorderedList')}
              title="Bullet list"
              aria-label="Bullet list"
              className={`${TOOL_BUTTON} ${iconTone}`}
            >
              <List size={18} strokeWidth={2.5} aria-hidden />
            </button>

            <button
              type="button"
              onClick={() => applyFormat('insertOrderedList')}
              title="Numbered list"
              aria-label="Numbered list"
              className={`${TOOL_BUTTON} ${iconTone}`}
            >
              <ListOrdered size={18} strokeWidth={2.5} aria-hidden />
            </button>
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleEditorChange}
            onInput={handleEditorChange}
            role="textbox"
            aria-multiline="true"
            aria-labelledby={labelId}
            className={`px-4 py-3 text-base font-normal leading-6 focus:outline-none min-h-[120px] max-h-[400px] overflow-y-auto [&_ul]:ml-6 [&_ul]:list-disc [&_ol]:ml-6 [&_ol]:list-decimal [&_li]:mb-1 ${
              isDarkMode
                ? 'text-white [&_mark]:bg-yellow-500/40'
                : 'text-black [&_mark]:bg-yellow-200'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
