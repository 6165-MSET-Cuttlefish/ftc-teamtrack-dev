import DOMPurify from 'dompurify';

/**
 * Sanitize untrusted HTML for safe rendering via dangerouslySetInnerHTML.
 *
 * Allows basic rich-text formatting (bold, italic, lists, highlights)
 * while stripping scripts, event handlers, and other XSS vectors.
 */
export const sanitizeHtml = (dirty: string): string =>
  DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'span',
      'ul', 'ol', 'li', 'font', 'mark',
    ],
    ALLOWED_ATTR: ['color', 'class'],
  });
