# Flyverax portal screenshots

Marketing screenshots of the real airline portal (`frontend/airline`) rendered
with fake data. No backend or database is used: Playwright answers every request
to `http://api.mock/**` from `fixtures.mjs`. All data is fictional (SkyLine
Airways, placeholder names, `@example.com`, `+1 555 01xx`, invented hotels,
`BOOKING-REF-xxxxxx`).

## Run

```sh
# 1. Start the portal against the fake API base (separate terminal)
cd frontend/airline
NEXT_PUBLIC_API_URL=http://api.mock/api/v1 npx next dev -p 3100

# 2. Capture (first time: npm install)
cd landing-page/screenshots
npm install
node capture.mjs                 # all screens
node capture.mjs 05-allocation   # one screen
```

PNGs are written to `../assets/screenshots/` (1440x900, deviceScaleFactor 2).
`BASE_URL` overrides `http://localhost:3100`. The script reports unhandled API
requests, page errors, and any "undefined"/"NaN"/"Invalid Date"/"FlyVoid" text.
It also hides the Next dev indicator, toasts and closed drawers.

`COPY_CONFIRMATION=1` also copies `marketing-mockups/build/confirmation-preview.png`
to `08-confirmation-pdf.png`. Leave it off until that preview uses a fictional hotel name.

## Files

- `fixtures.mjs`: fake API responses and the request router
- `capture.mjs`: Playwright script, one entry per screen in `SHOTS`
