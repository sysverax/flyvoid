// Shared branding for every generated PDF (invoices, vouchers, ...) so they
// stay visually consistent with each other and with the frontend's own
// navy/Figtree/airplane-icon branding (frontend/*/public/logo.svg).

export const PDF_BRAND = {
  navy: "#0F2757",
  amber: "#F59E0B",
  green: "#059669",
  greenBg: "#ECFDF5",
  greenBorder: "#A7F3D0",
};

export const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap');";

export const FONT_FAMILY = "'Figtree', 'Helvetica Neue', Arial, sans-serif";

// Inline FlyVoid logomark (airplane icon + wordmark), white-on-navy.
// Same mark used by the frontend apps' public/logo.svg.
export const LOGO_SVG = `
  <svg width="150" height="37" viewBox="0 0 150 37" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="3" width="31" height="31" rx="8" fill="white" fill-opacity="0.14"/>
    <g transform="translate(5.9, 8.5) scale(0.833)">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2.5 1.5V22l4-1 4 1v-1.5L13 19v-5.5l8 2.5z" fill="white"/>
    </g>
    <text x="40" y="26" font-family="'Figtree', 'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="0.2" fill="white">FlyVoid</text>
  </svg>
`;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Renders a 1-5 star rating from a category string like "4 STARS" (falls back to plain text if no number is found). */
export function renderStars(category: string): string {
  const match = category.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return `<span class="muted small">${escapeHtml(category)}</span>`;
  }
  const stars = Math.max(0, Math.min(5, Math.round(Number(match[1]))));
  const filled = "&#9733;".repeat(stars);
  const empty = "&#9733;".repeat(5 - stars);
  return `<span class="stars"><span class="stars-filled">${filled}</span><span class="stars-empty">${empty}</span></span>`;
}

/** CSS for the stars rendered by renderStars() - include once per <style> block that uses it. */
export const STARS_CSS = `
  .stars { white-space: nowrap; }
  .stars-filled { color: ${PDF_BRAND.amber}; font-size: 13px; }
  .stars-empty { color: #E5E7EB; font-size: 13px; }
`;
