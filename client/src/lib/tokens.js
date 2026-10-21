// Reads a design token (CSS custom property from styles/tokens.css) for code that draws on a canvas.
export function cssVar(name, fallback = '') {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
