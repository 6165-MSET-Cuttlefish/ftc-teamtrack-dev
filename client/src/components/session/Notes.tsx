import { useTheme, useSessionCore } from '@/contexts';
import { useState, useRef, useCallback, useEffect, useId } from 'react';
import { Bold, Italic, Highlighter, List, ListOrdered, ChevronDown } from 'lucide-react';

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', hex: '#FFFF00', bg: 'bg-yellow-200', darkBg: 'bg-yellow-500/40' },
  { name: 'Green', hex: '#00FF00', bg: 'bg-green-200', darkBg: 'bg-green-500/40' },
  { name: 'Pink', hex: '#FF69B4', bg: 'bg-pink-200', darkBg: 'bg-pink-500/40' },
  { name: 'Blue', hex: '#87CEEB', bg: 'bg-blue-200', darkBg: 'bg-blue-500/40' },
  { name: 'Orange', hex: '#FFA500', bg: 'bg-orange-200', darkBg: 'bg-orange-500/40' },
  { name: 'Purple', hex: '#DDA0DD', bg: 'bg-purple-200', darkBg: 'bg-purple-500/40' },
];

/** Toolbar buttons: compact with a mouse, a full 44px target on touch */
const TOOL_BUTTON =
  'p-2 rounded transition-colors inline-flex items-center justify-center [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

export const Notes = () => {
  const { isDarkMode } = useTheme();
  const { sessionData, updateSessionData, sessionEpoch } = useSessionCore();
  const editorRef = useRef<HTMLDivElement>(null);
  const shownEpochRef = useRef<number | null>(null);
  const [highlightDropdownOpen, setHighlightDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setHighlightDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  const applyHighlight = useCallback((color: string) => {
    applyFormat('backColor', color);
    setHighlightDropdownOpen(false);
  }, [applyFormat]);

  const insertBulletList = useCallback(() => {
    document.execCommand('insertUnorderedList', false);
    editorRef.current?.focus();
  }, []);

  const insertNumberedList = useCallback(() => {
    document.execCommand('insertOrderedList', false);
    editorRef.current?.focus();
  }, []);

  const handleEditorChange = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      updateSessionData({ notes: html });
    }
  }, [updateSessionData]);

  const handleInput = useCallback(() => {
    handleEditorChange();
  }, [handleEditorChange]);

  return (
    <div className="space-y-6">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">Session Notes</h2>

      <div className="flex flex-col gap-4 w-full">
        <span
          id={labelId}
          // Read out as the editor's name; on screen the heading says it.
          className="sr-only"
        >
          Performance Notes & Observations
        </span>

        <div
          role="toolbar"
          aria-label="Text formatting"
          className={`flex flex-wrap gap-2 p-3 rounded border-2 ${
            isDarkMode
              ? 'bg-team-dark border-gray-700'
              : 'bg-gray-50 border-gray-300'
          }`}
        >
          <button
            type="button"
            onClick={() => applyFormat('bold')}
            title="Bold (Ctrl+B)"
            aria-label="Bold"
            className={`${TOOL_BUTTON} ${
              isDarkMode
                ? 'hover:bg-gray-700 text-white'
                : 'hover:bg-gray-200 text-black'
            }`}
          >
            <Bold size={18} strokeWidth={2.5} aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => applyFormat('italic')}
            title="Italic (Ctrl+I)"
            aria-label="Italic"
            className={`${TOOL_BUTTON} ${
              isDarkMode
                ? 'hover:bg-gray-700 text-white'
                : 'hover:bg-gray-200 text-black'
            }`}
          >
            <Italic size={18} strokeWidth={2.5} aria-hidden />
          </button>

          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setHighlightDropdownOpen(!highlightDropdownOpen)}
              title="Highlight Color"
              aria-label="Highlight Color"
              aria-haspopup="true"
              aria-expanded={highlightDropdownOpen}
              className={`${TOOL_BUTTON} gap-1 ${
                isDarkMode
                  ? 'hover:bg-gray-700 text-white'
                  : 'hover:bg-gray-200 text-black'
              }`}
            >
              <Highlighter size={18} strokeWidth={2.5} aria-hidden />
              <ChevronDown size={14} aria-hidden />
            </button>

            {highlightDropdownOpen && (
              <div
                className={`absolute top-full left-0 mt-1 rounded border-2 shadow-lg z-50 ${
                  isDarkMode
                    ? 'bg-team-dark border-gray-700'
                    : 'bg-white border-gray-300'
                }`}
              >
                {HIGHLIGHT_COLORS.map(color => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => applyHighlight(color.hex)}
                    title={`Highlight: ${color.name}`}
                    className={`w-full px-4 py-2 [@media(pointer:coarse)]:min-h-11 text-left text-sm font-medium transition-colors flex items-center gap-2 ${
                      isDarkMode
                        ? 'hover:bg-gray-700 text-white border-b last:border-b-0 border-gray-700'
                        : 'hover:bg-gray-100 text-black border-b last:border-b-0 border-gray-200'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border ${color.bg}`}
                      style={{ backgroundColor: color.hex }}
                    />
                    <span>{color.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              document.execCommand('backColor', false, 'transparent');
              editorRef.current?.focus();
              handleEditorChange();
            }}
            title="Remove Highlight"
            aria-label="Remove Highlight"
            className={`${TOOL_BUTTON} ${
              isDarkMode
                ? 'hover:bg-gray-700 text-white'
                : 'hover:bg-gray-200 text-black'
            }`}
          >
            <Highlighter
              size={18}
              strokeWidth={2.5}
              style={{ opacity: 0.5 }}
              aria-hidden
            />
          </button>

          <div
            className={`w-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}
          />

          <button
            type="button"
            onClick={insertBulletList}
            title="Bullet List"
            aria-label="Bullet List"
            className={`${TOOL_BUTTON} ${
              isDarkMode
                ? 'hover:bg-gray-700 text-white'
                : 'hover:bg-gray-200 text-black'
            }`}
          >
            <List size={18} strokeWidth={2.5} aria-hidden />
          </button>

          <button
            type="button"
            onClick={insertNumberedList}
            title="Numbered List"
            aria-label="Numbered List"
            className={`${TOOL_BUTTON} ${
              isDarkMode
                ? 'hover:bg-gray-700 text-white'
                : 'hover:bg-gray-200 text-black'
            }`}
          >
            <ListOrdered size={18} strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleEditorChange}
          onInput={handleInput}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={labelId}
          className={`px-4 py-3 rounded border-2 border-team-blue-40 text-base font-normal leading-6 focus:outline-none focus:border-team-blue focus:ring-1 focus:ring-team-blue min-h-[120px] max-h-[400px] overflow-y-auto [&_ul]:ml-6 [&_ul]:list-disc [&_ol]:ml-6 [&_ol]:list-decimal [&_li]:mb-1 ${
            isDarkMode
              ? 'bg-team-dark text-white [&_mark]:bg-yellow-500/40'
              : 'bg-[#FEFEFE] text-black [&_mark]:bg-yellow-200'
          }`}
        />

        <p
          className={`text-xs ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          Notes save automatically
        </p>
      </div>
    </div>
  );
};
