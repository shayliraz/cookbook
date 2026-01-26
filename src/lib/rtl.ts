// RTL (Right-to-Left) language detection and utilities

// Hebrew Unicode range: \u0590-\u05FF
// Arabic Unicode range: \u0600-\u06FF
const RTL_REGEX = /[\u0590-\u05FF\u0600-\u06FF]/;

/**
 * Detects if text contains RTL characters (Hebrew/Arabic)
 */
export function containsRTL(text: string): boolean {
  return RTL_REGEX.test(text);
}

/**
 * Detects if text is primarily RTL
 * Returns true if more than 30% of alphabetic characters are RTL
 */
export function isPrimarilyRTL(text: string): boolean {
  if (!text) return false;

  const rtlChars = (text.match(/[\u0590-\u05FF\u0600-\u06FF]/g) || []).length;
  const ltrChars = (text.match(/[a-zA-Z]/g) || []).length;

  if (rtlChars + ltrChars === 0) return false;

  return rtlChars / (rtlChars + ltrChars) > 0.3;
}

/**
 * Returns the appropriate text direction for content
 */
export function getTextDirection(text: string): 'rtl' | 'ltr' | 'auto' {
  if (!text) return 'auto';

  // Check the first significant character
  const firstChar = text.trim().charAt(0);
  if (RTL_REGEX.test(firstChar)) {
    return 'rtl';
  }

  // If text contains RTL but doesn't start with it, use auto
  if (containsRTL(text)) {
    return 'auto';
  }

  return 'ltr';
}

/**
 * Returns CSS class for text direction
 */
export function getDirectionClass(text: string): string {
  const direction = getTextDirection(text);

  switch (direction) {
    case 'rtl':
      return 'text-right dir-rtl';
    case 'auto':
      return 'dir-auto';
    default:
      return '';
  }
}

/**
 * Wraps text in a span with appropriate direction if needed
 */
export function wrapWithDirection(text: string): { text: string; dir: 'rtl' | 'ltr' | 'auto' } {
  return {
    text,
    dir: getTextDirection(text),
  };
}
