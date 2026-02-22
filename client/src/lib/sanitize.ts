import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows safe formatting tags (bold, italic, lists, highlights)
 * while stripping scripts and dangerous attributes.
 */
export const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li',
      'br', 'p', 'span', 'div', 'mark',
    ],
    ALLOWED_ATTR: ['style', 'class'],
    ALLOW_DATA_ATTR: false,
  });
};
