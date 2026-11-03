import { readFileSync } from "node:fs";
import path from "node:path";

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

// Figtree is embedded from the bundled @fontsource/figtree package, so PDF
// rendering never needs internet access. Google Fonts is only a fallback when
// the package files are missing.
const FIGTREE_WEIGHTS = [400, 500, 600, 700];
const FIGTREE_SUBSETS: Array<{ subset: string; unicodeRange: string }> = [
  {
    subset: "latin",
    unicodeRange:
      "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  },
  {
    subset: "latin-ext",
    unicodeRange:
      "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
  },
];

function localFigtreeFontFaces(): string | null {
  try {
    const dir = path.join(
      path.dirname(require.resolve("@fontsource/figtree/package.json")),
      "files",
    );
    return FIGTREE_SUBSETS.flatMap(({ subset, unicodeRange }) =>
      FIGTREE_WEIGHTS.map((weight) => {
        const font = readFileSync(
          path.join(dir, `figtree-${subset}-${weight}-normal.woff2`),
        ).toString("base64");
        return `@font-face { font-family: 'Figtree'; font-style: normal; font-weight: ${weight}; font-display: block; src: url(data:font/woff2;base64,${font}) format('woff2'); unicode-range: ${unicodeRange}; }`;
      }),
    ).join("\n");
  } catch {
    return null;
  }
}

export const FONT_IMPORT =
  localFigtreeFontFaces() ??
  "@import url('https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap');";

export const FONT_FAMILY = "'Figtree', 'Helvetica Neue', Arial, sans-serif";

// Inline Flyverax logo (icon mark + wordmark), white-on-navy.
// Same artwork as the frontend apps' public/logo.svg.
export const LOGO_SVG = `
  <svg width="150" height="37" viewBox="0 0 150 37" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="3" width="31" height="31" rx="7.4" fill="white" fill-opacity="0.14"/>
    <g transform="translate(0,3) scale(0.03875) translate(-112,-112)"><g transform="translate(512.00,512.00) scale(1.1674) translate(126.93,0.00)" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="2.57" stroke-linejoin="round"><path d="M0.00,0.00 L-196.38,-118.00 L-285.70,-118.00 L-89.31,0.00 L-285.70,118.00 L-196.38,118.00Z"/><path d="M-190.00,0.00 L-283.20,-56.00 L-372.51,-56.00 L-279.31,0.00 L-372.51,56.00 L-283.20,56.00Z"/><path d="M-279.3137852148764,-20.7 L104,-20.7 C134,-20.7 150,-12.42 150,0 C150,12.42 134,20.7 104,20.7 L-279.3137852148764,20.7 Z"/></g></g>
    <text x="40" y="26" font-family="'Figtree', 'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="0.2" fill="white">Flyverax</text>
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
