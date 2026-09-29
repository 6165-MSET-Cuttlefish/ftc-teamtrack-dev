import DOMPurify from 'dompurify';

/**
 * Sanitize untrusted HTML for safe rendering via dangerouslySetInnerHTML.
 *
 * Allows basic rich-text formatting (bold, italic, lists, highlights)
 * while stripping scripts, event handlers, and other XSS vectors.
 *
 * `class` and `style` are deliberately not allowed: shared notes are shown to
 * people who didn't write them, and with the app's utility classes (or inline
 * CSS) a note could position itself over the whole page and impersonate it.
 */
export const sanitizeHtml = (dirty: string): string =>
  DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'span',
      'ul', 'ol', 'li', 'font', 'mark',
    ],
    ALLOWED_ATTR: ['color'],
  });
