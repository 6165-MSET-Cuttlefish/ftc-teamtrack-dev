/**
 * Plain text from session notes, which are stored as the editor's HTML.
 *
 * Kept apart from the CSV export so that the session store and the sign-out
 * question (both in the app's entry chunk) can test notes for text without
 * pulling the whole export into it.
 */

/** Elements that start and end on a line of their own. */
const BLOCK_ELEMENTS =
  'p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, pre, tr';

/**
 * The text of an HTML fragment (session notes are stored as the editor's
 * HTML): tags removed, one line per paragraph or line break, list items as
 * `- ` bullets. Nothing in the fragment is run or loaded.
 */
export const htmlToText = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('script, style').forEach(el => el.remove());
  doc.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  doc.querySelectorAll('li').forEach(el => el.prepend('- '));
  doc.querySelectorAll(BLOCK_ELEMENTS).forEach(el => {
    el.prepend('\n');
    el.append('\n');
  });

  return (doc.body.textContent ?? '')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
};
