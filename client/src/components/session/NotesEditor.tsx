import { useTheme } from '@/contexts';
import { useRef, useCallback, useEffect, type RefObject } from 'react';
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
import { FIELD_BORDER } from '@/components/ui/input';

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

/**
 * The rich-text box session notes are written in: a toolbar (bold, italic,
 * highlight, lists) over the text, in one border that lights up while
 * either has focus. The scoring page's Session Notes and the Analysis
 * page's notes card both write in it.
 *
 * The text is uncontrolled (React re-rendering it would lose the caret).
 * `html` is pushed in when the box first shows, whenever `resetKey` changes,
 * and when it changes from outside while the box isn't being typed in;
 * every change made in the box goes out through `onChange`.
 */
export const NotesEditor = ({
  html,
  onChange,
  resetKey,
  labelledBy,
  editorRef: outerRef,
}: {
  /** The notes, as stored HTML */
  html: string;
  onChange: (html: string) => void;
  /** A new value starts the box over from `html`, typing or not */
  resetKey?: unknown;
  /** The id of the element that names the text box */
  labelledBy: string;
  /** The editable element, for a caller that puts the caret in it */
  editorRef?: RefObject<HTMLDivElement | null>;
}) => {
  const { isDarkMode } = useTheme();
  const ownRef = useRef<HTMLDivElement>(null);
  const editorRef = outerRef ?? ownRef;
  /** The `resetKey` the box last started over for */
  const shownKeyRef = useRef<{ key: unknown } | null>(null);
  /** Where the caret or selection last was in the editor */
  const savedRangeRef = useRef<Range | null>(null);
  /** A highlight chosen in the menu, applied once the menu has closed */
  const pendingHighlightRef = useRef<string | null>(null);

  // Notes that change from outside the box are pushed in by hand: the
  // stored notes on arrival, and '' when the session is cancelled or reset,
  // otherwise the old text stays on screen and is saved into the next
  // session. While the user is typing, the box is the newer of the two;
  // leave it.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const isNew = !shownKeyRef.current || shownKeyRef.current.key !== resetKey;
    shownKeyRef.current = { key: resetKey };
    if (editor.innerHTML === html) return;
    if (!isNew && document.activeElement === editor) return;
    editor.innerHTML = html;
  }, [html, resetKey, editorRef]);

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
  }, [editorRef]);

  const handleEditorChange = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange, editorRef]);

  const applyFormat = useCallback(
    (command: string, value?: string) => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
      handleEditorChange();
    },
    [handleEditorChange, editorRef]
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
  }, [editorRef]);

  const iconTone = isDarkMode
    ? 'text-white hover:bg-white/10'
    : 'text-gray-900 hover:bg-gray-100';

  return (
    // One box: the toolbar is its top row, the text under it, inside a
    // single border that lights up while either has focus. Outlined as a
    // field is, the rule under the toolbar in the same colour, and focused
    // as one too: the accent border with the solid ring Input draws.
    <div
      className={`overflow-hidden rounded-xl border-2 ${FIELD_BORDER} transition-colors focus-within:border-team-blue focus-within:ring-2 focus-within:ring-team-blue ${
        isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'
      }`}
    >
      <div
        role="toolbar"
        aria-label="Text formatting"
        className={`flex flex-nowrap items-center gap-1 border-b ${FIELD_BORDER} px-1 py-1`}
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

        <div aria-hidden className="mx-1 h-6 w-px shrink-0 bg-team-blue-40" />

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
        aria-labelledby={labelledBy}
        className={`px-4 py-3 text-base font-normal leading-6 focus:outline-none min-h-[120px] max-h-[400px] overflow-y-auto [&_ul]:ml-6 [&_ul]:list-disc [&_ol]:ml-6 [&_ol]:list-decimal [&_li]:mb-1 ${
          isDarkMode
            ? 'text-white [&_mark]:bg-yellow-500/40'
            : 'text-black [&_mark]:bg-yellow-200'
        }`}
      />
    </div>
  );
};
