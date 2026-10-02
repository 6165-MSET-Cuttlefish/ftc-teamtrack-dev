import DOMPurify from 'dompurify';

/** Colour values a highlight may use: hex, rgb()/rgba(), or a colour name. */
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR =
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i;
const NAMED_COLOR = /^[a-z]{3,24}$/i;
/** Letters-only values that aren't a colour of their own — nothing to keep. */
const NOT_A_HIGHLIGHT = new Set([
  'transparent',
  'inherit',
  'initial',
  'unset',
  'revert',
  'currentcolor',
]);

/**
 * Reduce an inline style to the one thing the notes editor writes: a
 * highlight (`background-color`). Returns '' when there is none worth
 * keeping, and never lets any other declaration through.
 */
const highlightStyle = (style: string): string => {
  for (const declaration of style.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator === -1) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    if (property !== 'background-color') continue;
    const value = declaration.slice(separator + 1).trim();
    const isColor =
      HEX_COLOR.test(value) ||
      RGB_COLOR.test(value) ||
      (NAMED_COLOR.test(value) && !NOT_A_HIGHLIGHT.has(value.toLowerCase()));
    return isColor ? `background-color: ${value};` : '';
  }
  return '';
};

// A private instance, so the hook below can't affect any other DOMPurify use.
const purifier = DOMPurify(window);

purifier.addHook('uponSanitizeAttribute', (_node, attribute) => {
  if (attribute.attrName !== 'style') return;
  const style = highlightStyle(attribute.attrValue);
  if (style) {
    attribute.attrValue = style;
  } else {
    attribute.keepAttr = false;
  }
});

/**
 * Sanitize untrusted HTML for safe rendering via dangerouslySetInnerHTML.
 *
 * Allows basic rich-text formatting (bold, italic, lists, highlights)
 * while stripping scripts, event handlers, and other XSS vectors.
 *
 * Shared notes are shown to people who didn't write them, so nothing that
 * lets a note style itself from outside is allowed: no `class`, and no
 * `data-*` or `aria-*` attributes either, because the app's own stylesheets
 * (Tailwind utilities, the toast library's `[data-sonner-toaster]` rules)
 * would let a note position itself over the whole page and impersonate it.
 * `style` survives only as a single highlight colour (see `highlightStyle`).
 */
export const sanitizeHtml = (dirty: string): string =>
  purifier.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'span',
      'ul', 'ol', 'li', 'font', 'mark',
    ],
    ALLOWED_ATTR: ['color', 'style'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
