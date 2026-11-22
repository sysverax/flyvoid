import { readFileSync } from "node:fs";
import path from "node:path";

// Shared branding for every generated PDF (invoices, vouchers, ...) so they
// stay visually consistent with each other and with the frontend's own
// navy/Figtree branding and Flyverax logo (frontend/*/public/logo.svg).

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

// Inline Flyverax logo (icon mark + FLYVERAX wordmark), white-on-navy, transparent
// background. Generated from brand-assets/web/flyverax-logo-horizontal-inverse.svg,
// the same file the frontend apps ship as public/logo.svg.
export const LOGO_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="150" height="26" viewBox="0 0 4701 818" fill="none">
  <g transform="translate(-349.004 -455.376)">
  <path d="M1447.77 455.376L1650 628.984H1530.42L1385.66 507.485L1323.57 455.376H1447.77Z" fill="white"/>
  <path d="M971.414 855.046L473.156 1273.1H349.008L1323.57 455.376L1385.66 507.485L1033.43 803.011H909.416L971.414 855.046Z" fill-rule="evenodd" clip-rule="evenodd" fill="white"/>
  <path d="M909.416 803.011H1033.43L971.414 855.046L909.416 803.011Z" fill-rule="evenodd" clip-rule="evenodd" fill="white"/>
  <path d="M1033.43 803.011L971.414 855.046L1116.27 976.62H1239.62L1033.61 803.011H1033.43Z" fill-rule="evenodd" clip-rule="evenodd" fill="white"/>
  <path d="M1228.44 1273.1H1104.25L1454.59 976.62L1247.74 803.012H1371.93L1574.17 976.62L1228.44 1273.1Z" fill-rule="evenodd" clip-rule="evenodd" fill="white"/>
  </g>
  <g transform="translate(1541.00 273.94) scale(2.42822) translate(-349.004 -1433.1)">
  <path d="M382.295 1462.85V1477.32H463.512L442.766 1503.86H382.295V1542.46H349.004V1434.86H469.624L448.234 1462.85H382.295Z" fill="white"/>
  <path d="M590.458 1542.46H495.249V1434.86H528.54V1514.47H611.848L590.458 1542.46Z" fill="white"/>
  <path d="M681.142 1542.46H647.851V1506.75L582.234 1434.86H624.853L665.059 1479.09L704.301 1434.86H744.99L681.142 1506.75V1542.46Z" fill="white"/>
  <path d="M941.41 1434.86L872.416 1532.16C866.787 1540.21 859.55 1544.23 851.026 1544.23C842.502 1544.23 835.747 1540.53 829.958 1532.16L762.571 1434.86H802.135L851.83 1508.04L902.49 1434.86H941.41Z" fill="white"/>
  <path d="M1000.89 1462.85V1476.68H1085.96L1066.66 1500.48H1000.89V1514.47H1092.4L1071.17 1542.46H967.595V1434.86H1092.24L1070.68 1462.85H1000.89Z" fill="white"/>
  <path d="M1264.11 1474.11C1264.11 1490.83 1254.62 1503.06 1238.21 1509.33L1270.7 1542.46H1226.8L1199.78 1513.83H1151.05V1542.46H1117.92V1486.97H1213.29C1225.51 1486.97 1230.82 1483.43 1230.82 1475.39C1230.82 1466.71 1225.19 1462.85 1213.13 1462.85H1117.92L1140.11 1434.86H1209.91C1243.68 1434.86 1264.11 1449.5 1264.11 1474.11Z" fill="white"/>
  <path d="M1467.94 1542.46H1342.98L1362.92 1514.47H1409.24L1378.85 1470.57L1327.86 1542.46H1288.94L1357.94 1445.16C1362.6 1438.72 1369.04 1433.1 1379.33 1433.1C1389.3 1433.1 1395.89 1438.4 1400.56 1445.16L1467.94 1542.46Z" fill="white"/>
  <path d="M1647.43 1434.87L1613.49 1465.9C1609.74 1469.34 1606.58 1472.23 1604 1474.59C1601.43 1476.84 1599.23 1478.77 1597.41 1480.38C1595.59 1481.88 1594.03 1483.17 1592.74 1484.24C1591.56 1485.2 1590.49 1486.06 1589.53 1486.81C1590.49 1487.46 1591.56 1488.26 1592.74 1489.22C1593.92 1490.19 1595.48 1491.58 1597.41 1493.41C1599.34 1495.12 1601.75 1497.32 1604.65 1500C1607.54 1502.68 1611.19 1506.06 1615.58 1510.13L1650 1542.46H1603.04L1566.37 1506.92L1528.57 1542.46H1487.24L1522.3 1510.13C1526.38 1506.38 1529.81 1503.27 1532.6 1500.8C1535.38 1498.23 1537.69 1496.14 1539.51 1494.53C1541.33 1492.92 1542.83 1491.64 1544.01 1490.67C1545.3 1489.71 1546.43 1488.85 1547.39 1488.1C1546.43 1487.35 1545.35 1486.54 1544.17 1485.69C1543 1484.72 1541.49 1483.43 1539.67 1481.83C1537.85 1480.11 1535.54 1478.02 1532.76 1475.55C1529.97 1472.98 1526.48 1469.71 1522.3 1465.74L1489.33 1434.87H1535.49L1569.75 1468.32L1604.32 1434.87H1647.43Z" fill="#239FE7"/>
  </g>
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
