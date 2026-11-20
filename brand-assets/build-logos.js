// Builds web-ready Flyverax logo SVGs from the brand originals.
// usage: node build-logos.js <repoRoot>
const fs = require("fs");
const path = require("path");

const root = process.argv[2];
const orig = (f) => fs.readFileSync(path.join(root, "brand-assets/original", f), "utf8");
const out = (f, s) => fs.writeFileSync(path.join(root, "brand-assets/web", f), s.trim() + "\n");

const PORTAL_NAVY = "#0F2757";
const X_BLUE = "#239FE7"; // solid X colour used by the inverse logo

const paths = (svg) => svg.match(/<path [^>]*\/>/g);
const defs = (svg) => (svg.match(/<defs>[\s\S]*<\/defs>/) || [""])[0];

// --- Inverse (white) artwork -------------------------------------------------
const invFull = orig("Flyverax Primary Logo - Inverse.svg");
const invPaths = paths(invFull);
const invIcon = invPaths.slice(0, 5); // icon mark, y 455.376..1273.1
const invWord = invPaths.slice(5, 12) // FLYVERA letters
  .concat(invPaths[12].replace(/ id="[^"]*"/, "").replace("/>", ` fill="${X_BLUE}"/>`)); // X

// --- Primary (colour) artwork ------------------------------------------------
const priFull = orig("Flyverax Primary Logo.svg");
const priPaths = paths(priFull.replace(/<defs>[\s\S]*<\/defs>/, ""));
const priIcon = priPaths.slice(0, 5); // y 455.235..1272.95
const priWord = priPaths.slice(5, 13);
const priDefs = defs(priFull);

// Geometry (source units). Both files share x 349.004..1650 for icon + wordmark.
const X0 = 349.004, W = 1650 - X0;
const ICON_H = 817.72;
const WORD_Y0 = 1433.1, WORD_H = 1544.23 - WORD_Y0;

// Horizontal lockup: icon left, wordmark right, wordmark height = 33% of icon.
const S = (0.33 * ICON_H) / WORD_H;
const GAP = 240;
const WORD_X = W + GAP;
const WORD_TOP = (ICON_H - WORD_H * S) / 2;
const LOCK_W = Math.ceil(WORD_X + W * S);
const LOCK_H = Math.ceil(ICON_H);

function lockup(iconPaths, iconY0, wordPaths, extraDefs) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${((40 * LOCK_W) / LOCK_H).toFixed(1)}" height="40" viewBox="0 0 ${LOCK_W} ${LOCK_H}" fill="none">
<g transform="translate(${-X0} ${-iconY0})">
${iconPaths.join("\n")}
</g>
<g transform="translate(${WORD_X.toFixed(2)} ${WORD_TOP.toFixed(2)}) scale(${S.toFixed(5)}) translate(${-X0} ${-WORD_Y0})">
${wordPaths.join("\n")}
</g>
${extraDefs}
</svg>`;
}

// Square icon: centre the mark (x 349..1650) in a square box.
function squareIcon(iconPaths, iconY0, extraDefs, bg) {
  const side = 1460; // mark is 1301 wide; ~6% padding each side
  const x0 = (X0 + W / 2 - side / 2).toFixed(2);
  const cy = iconY0 + ICON_H / 2;
  const y0 = (cy - side / 2).toFixed(2);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="${x0} ${y0} ${side} ${side}" fill="none">
${bg || ""}
${iconPaths.join("\n")}
${extraDefs}
</svg>`;
}

// App icon (favicon / PWA): white mark on portal navy rounded square.
function appIcon(rounded) {
  const iconOnly = paths(orig("Flyverax Primary Logo Only - Inverse.svg")); // centred at 1000,1000
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 2000 2000" fill="none">
<rect width="2000" height="2000"${rounded ? ' rx="440"' : ""} fill="${PORTAL_NAVY}"/>
<g transform="translate(1000 1000) scale(1.3) translate(-1000 -1000)">
${iconOnly.join("\n")}
</g>
</svg>`;
}

out("flyverax-logo-horizontal-inverse.svg", lockup(invIcon, 455.376, invWord, ""));
out("flyverax-logo-horizontal.svg", lockup(priIcon, 455.235, priWord, priDefs));
out("flyverax-icon-inverse.svg", squareIcon(invIcon, 455.376, ""));
out("flyverax-icon.svg", squareIcon(priIcon, 455.235, priDefs));
out("flyverax-app-icon.svg", appIcon(true));
out("flyverax-app-icon-square.svg", appIcon(false));

console.log({ LOCK_W, LOCK_H, ratio: (LOCK_W / LOCK_H).toFixed(3), S: S.toFixed(4) });
