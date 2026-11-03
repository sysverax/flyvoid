# Flyverax notification mock-ups

**Concept mock-ups only.** Passenger SMS and email, and the airline invoice email, are
not implemented in Flyverax yet. Everything here is HTML/CSS rendered to images and video.
Nothing is connected to AWS SES, an SMS provider or any other service, and nothing is sent.

Passenger, airline and invoice data is fictional (SkyLine Airways, flight WA0021, Amelia Martin,
`example.com` / `.example` addresses, a 555-01xx phone number). Every notification comes from
the product, **Flyverax** (SMS sender `Flyverax`, email from `notifications@flyverax.com`); the
company is Sysverax (`sysverax.com`). The phone and laptop frames are generic, with no brand
logos or copied OS UI.

## Setup (once)

```sh
cd marketing-mockups
npm install
npx playwright install chromium
```

Playwright, ffmpeg (`ffmpeg-static`) and the font are installed locally in this folder only.

## Export

```sh
npm run build        # everything: PDF preview, PNGs, short clips, full video (about 10 minutes)
npm run stills       # PNGs only
npm run videos       # the two short clips only (about 2-3 minutes)
npm run film         # the full explainer video only (both formats)
npm run film -- 9x16 # the full explainer video, one format
npm run pdf-preview  # only the confirmation PDF thumbnail
```

| Output | What it is |
|---|---|
| `exports/png/01-lock-screen-sms.png` | Lock screen with the SMS notification |
| `exports/png/02-sms-conversation.png` | The SMS in a messages app |
| `exports/png/03a-email-notification.png` | Lock screen with the email notification (SMS below it) |
| `exports/png/03b-email-open.png` | The opened passenger email with the PDF attachment |
| `exports/png/04-airline-invoice-email.png` | The airline's invoice email on a laptop |
| `exports/mp4/phone-notification-{16x9,9x16}.mp4` | 6 s: SMS slides in at 1.5 s, cut at 3.5 s, email slides in at 4 s |
| `exports/mp4/airline-invoice-{16x9,9x16}.mp4` | 5 s: invoice email arrives at 0.8 s, is clicked at 2.8 s, opens at 3 s |
| `exports/mp4/flyverax-explainer-{16x9,9x16}.mp4` | The full 43 s explainer (see below) |
| `exports/png/film/*.png` | One review frame per shot of the full explainer |

PNGs are 2x resolution (phones 2160x2700, laptop 3840x2400). Videos are 30 fps, H.264, no audio.
`exports/` and `build/` are git-ignored; re-run the build to recreate them.

## Change the text

- **Message wording:** edit the files in `templates/`. These are written to become the real
  templates later, so keep them short, factual and free of promises.
  - `sms.txt`: one line. The build fails if it is over 320 characters or uses characters
    outside the basic SMS (GSM-7) set, such as emoji or curly quotes.
  - `passenger-email.txt`, `airline-invoice-email.txt`: `Subject:` and `Preheader:` lines,
    a blank line, then the body. Blank lines separate paragraphs. A paragraph made only of
    `Label: value` lines is shown as a table. The last paragraph is the footer.
- **Values** (names, flight, hotel, dates, invoice figures): edit `DATA` in `config.mjs`.
  Every `{{placeholder}}` in a template must exist in `DATA`, or the build stops with an error.
- **Booking reference:** `SUPPLIER_BOOKING_REFERENCE` in `config.mjs` is the only place it is
  set. Keep it a placeholder (`BOOKING-REF-123456`); do not use a real-looking supplier reference.
- **Senders, clock times, colours:** `SENDERS`, `DEVICE` and `BRAND` in `config.mjs`.
- **Layout and animation timing:** `lib/scenes.mjs` (each scene's `setTime` script) and
  `scripts/render-videos.mjs` (shots and the 9:16 camera move).

## Full explainer video

`lib/film.mjs` defines the timeline in `SHOTS`: one entry per shot with its duration, caption
and animation. Captions replace a voiceover, so the video works with the sound off (LinkedIn
autoplay). There is no audio track; add music or a voiceover in an editor if you want one.

| # | Time | Shot | Caption |
|---|---|---|---|
| 1 | 0.0-4.5 | Departures board flips to "Cancelled" | When a flight is cancelled, hundreds of passengers need a hotel — tonight. |
| 2 | 4.5-8.5 | Crowd of passengers | Hundreds of passengers are stranded. Airline teams scramble — |
| 3 | 8.5-12.5 | Calls, spreadsheet, rooms running out | — phone calls, spreadsheets, and hotels filling up by the minute. |
| 4 | 12.5-16.1 | Light sweep, Flyverax logo, "by Sysverax" | — |
| 5 | 16.1-22.6 | Upload, group, find and book hotels | Upload the passenger list. Flyverax groups travellers, searches live hotel rates near the airport and books the rooms. |
| 6-8 | 22.6-30.6 | SMS, email notification, opened email | Every passenger gets their hotel confirmation by SMS and email. |
| 9 | 30.6-33.6 | Confirmation PDF, "Confirmed" | From disruption to rest. |
| 10 | 33.6-37.8 | Airline invoice email | And the airline gets one invoice per flight. |
| 11 | 37.8-43.3 | End card: logo, tagline, Request a demo, flyverax.com, SysveraX logo | — |

The end card text is in `FILM` in `config.mjs`; the SysveraX logo is `assets/sysverax-logo.jpg`.

## Concept label

Every PNG and MP4 shows a small **"Concept preview"** label in the bottom-right corner, and the
invoice shows "Sample data. Figures are illustrative only." under its table. Both are on by default.

To turn them off, either set `SHOW_CONCEPT_LABEL` to `false` in `config.mjs`, or for one build:

```sh
SHOW_CONCEPT_LABEL=false npm run build              # bash
$env:SHOW_CONCEPT_LABEL='false'; npm run build      # PowerShell
```

Only turn it off once the feature is live and the screens match the real product.

## Confirmation PDF preview

`npm run pdf-preview` renders page 1 of the real confirmation template
(`backend/src/hotel-bookings/templates/hotel-booking-confirmation.template.ts`, imported
read-only) with the fake data above, for the attachment thumbnail in `03b-email-open.png`.
If that file is missing, the email shows a plain PDF icon instead. The backend is not modified.
