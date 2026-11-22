# Flyverax brand assets

## original/
The logo files exactly as delivered by design. Each is a 2000×2000 square with a solid
background (navy `#0C2E5E` for the "Inverse" files, white for the colour ones).
Don't use these directly in the apps. Use the files in `web/`.

| File | Contents |
|---|---|
| `Flyverax Primary Logo.svg/.png` | Colour (gradient) icon + wordmark, on white |
| `Flyverax Primary Logo Only.png` | Colour icon only, on white |
| `Flyverax Primary Logo - Inverse.svg/.png` | White icon + wordmark (blue X), on navy |
| `Flyverax Primary Logo Only - Inverse.svg/.png` | White icon only, on navy |

## web/
Built from the originals: transparent background, trimmed to the artwork. The shapes are the
same; only the background is removed and the layout changed (horizontal lockups).

| File | Use on | Used by |
|---|---|---|
| `flyverax-logo-horizontal-inverse.svg/.png` | Dark/navy backgrounds | Portal sidebars (`frontend/*/public/logo.svg`), PDF header (`LOGO_SVG` in `backend/src/common/pdf/pdf-brand.ts`), landing share image (`landing-site/scripts/brand/`) |
| `flyverax-logo-horizontal.svg/.png` | White/light backgrounds | Landing site header (`landing-site/src/assets/flyverax-logo-horizontal.svg`); emails later |
| `flyverax-logo-stacked.svg` | White/light backgrounds (icon above wordmark, as designed) | Landing site footer (`landing-site/src/assets/flyverax-logo-stacked.svg`), `landing-page/assets/flyverax-logo.png` |
| `flyverax-logo-stacked-inverse.svg` | Dark/navy backgrounds | Not used yet |
| `flyverax-icon-inverse.svg/.png` | Dark/navy backgrounds | Auth page badges (`frontend/*/public/flyverax-mark.svg`) |
| `flyverax-icon.svg/.png` | White/light backgrounds | Not used yet |
| `flyverax-app-icon.svg/.png` | Browser tab / app icon (portal navy `#0F2757`, rounded) | `frontend/*/src/app/icon.svg`, `frontend/*/public/flyverax-icon.svg` |
| `flyverax-app-icon-square.svg`, `apple-icon.png` | iOS home screen (iOS rounds the corners) | `frontend/*/src/app/apple-icon.png` |
| `favicon.ico` | Legacy favicon (16–256px) | `frontend/*/src/app/favicon.ico` |

For HTML emails, use the PNG (`flyverax-logo-horizontal.png`) from a public URL. Gmail and
Outlook block SVG.

## Regenerating
`node brand-assets/build-logos.js .` (from the repo root) rebuilds the `web/*.svg` files from
`original/`. PNG and ICO exports were made with `sharp` (rendered from the SVGs) and Pillow (ICO).
After regenerating, copy the files to the paths in the table above.
