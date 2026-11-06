# Flyverax landing page: Lovable prompts

## Values used in this prompt

The master prompt below is ready to paste as is. These are the values filled in:

| Value | Set to | Change before launch? |
|---|---|---|
| Demo request email | `hai@flyverax.com` | No |
| Public contact email (Flyverax) | `hai@flyverax.com` | No |
| Company contact email (Sysverax) | `hai@sysverax.com` | No |
| Sysverax one-liner | a product-first technology company building secure, scalable and maintainable software and hardware systems | Optional |
| Legal entity | SYSVERAX (PVT) LTD, Sri Lanka | No |
| Inventory figures | **2.6 million+ accommodation options** in **220 countries and territories** | Confirm with your hotel partner account manager (or the API's static-data export) before launch |

Source: the larger hotel partner's own published figure ("over 2.6 million accommodation options in
220 countries and territories"). The two partners are not added together: their supply overlaps, so
a sum would double-count. The wording stays "accommodation options" and "countries and territories"
because that is what the source counts (it includes apartments and villas, not only hotels).
Partners are not named on the page. To change the figures later, edit `hotelCount` and
`countryCount` in `src/config/site.ts` in Lovable.

## Files to attach in Lovable

Attach with the **first** (master) prompt:

| File (in `landing-page/assets/`) | Used for |
|---|---|
| `flyverax-logo.png` | Full logo (icon + FLYVERAX wordmark) for the hero area / footer on white |
| `flyverax-icon.svg` (and `flyverax-icon.png`) | Header logo mark, favicon, app icon, social image |
| `sysverax-logo.png` | "A product of Sysverax" in the footer and the About line |

Attach later, with follow-up prompt 2 and 3:

| File | Notes |
|---|---|
| Portal screenshots (in `assets/screenshots/`, real portal UI with fake test data) | `02-cancelled-flights.png` (hero), `05-allocation.png` (How it works), `04-bookings-import.png`, `06-booking-summary.png`, `08-confirmation-pdf.png` (product tour). Not used: `01-dashboard.png` (its sample totals could read as real statistics) and `03-create-cancelled-flight.png` (spare) |
| Notification images (in `assets/notifications/`, Prompt 5) | `03a-email-notification.png`, `03b-email-open.png`, `04-airline-invoice-email.png`. Spares: `01-lock-screen-sms.png`, `02-sms-conversation.png` |
| Explainer video (when final, with real voice and music) | `flyverax-explainer-16x9.mp4`, a poster frame `flyverax-explainer-poster.jpg`, captions `flyverax-explainer.vtt` |

Nice to have (ask a designer, or ask me): a **white** version of the full logo for dark
backgrounds, and logos as transparent PNG or SVG (the attached PNGs have a white background).

---

## Prompt 1: master prompt (paste all of this, with the three logo files attached)

```text
Build a single-page marketing website for Flyverax, plus a Privacy page, a Terms page and a 404 page.
Read this whole brief before you start. Follow it exactly; do not add content that is not in it.

=====================================================================
1. WHAT FLYVERAX IS
=====================================================================
Flyverax is a B2B web platform for airlines. When a flight is cancelled, the airline's team creates
the cancelled flight in Flyverax and uploads the passenger bookings as a CSV file. Flyverax groups
the passengers (travel class, party size, children, special needs), searches live hotel availability
and rates near the airport through its hotel distribution partners, matches each booking to a
suitable hotel room and books it. Bookings it cannot place are flagged for the airline's team to
review. The team then downloads a hotel confirmation (PDF voucher with booking reference and QR code)
for each booking, and one invoice for the whole flight. Payment terms are discussed on the demo
call, not on this page: do not describe how airlines pay (no wallet, credit or payment-method claims).

Flyverax is a product of Sysverax (a product-first technology company building secure, scalable and maintainable software and hardware systems).

Audience: airline operations control centres, station / airport managers, customer care leads and
finance teams. They are busy, cautious, experienced people. They want proof, clarity and control.

Goal of the page: one action, "Request a demo". Every section leads there.

Tone: calm, precise, dependable. Short sentences. Plain English. No hype words ("revolutionary",
"game-changing", "seamless", "cutting-edge", "AI-powered"), no exclamation marks.

=====================================================================
2. RULES: DO NOT INVENT ANYTHING
=====================================================================
- Use ONLY the copy written in this brief. You may fix grammar, but do not add claims.
- NO customer logos, "trusted by" bars, testimonials, quotes, case studies, star ratings or reviews.
- NO statistics, percentages, time savings, cost savings, ROI figures or awards, except the two
  two inventory figures hotelCount and countryCount from site.ts. Always show them with exactly the
  labels given ("accommodation options", "countries and territories"), never as "hotels" or
  "countries", and never change, round up or add to them.
- NO compliance or security badges or claims (GDPR, SOC 2, ISO 27001, PCI, "bank-grade", "encrypted").
- NO names of hotel partners or hotel brands, and NO real airline names or logos.
- NO pricing, plans or prices.
- NO generated fake product UI, fake dashboards, fake charts or stock "analytics" images. Where a
  product screenshot will go, show a neutral placeholder frame (see section 6) until real
  screenshots are uploaded.
- NO stock photos of people. Use simple line icons and the brand shapes instead.
- Do not add a "Coming soon" or roadmap section, and do not describe any feature that is not in
  this brief.
- Keep every figure and contact detail in ONE config file (src/config/site.ts) so they can be
  changed in one place. If a figure is empty there, hide the element that shows it.

=====================================================================
3. BRAND AND DESIGN SYSTEM
=====================================================================
Logos (attached):
- flyverax-icon.svg: the Flyverax mark (white arrow-plane on a navy rounded square). Use in the
  header next to the word "Flyverax", as the favicon (also generate apple-touch-icon and a 512px PNG),
  and in the social share image.
- flyverax-logo.png: full logo (mark + FLYVERAX wordmark, gradient). Use it large in the footer
  brand block and in the social share image. It has a white background: only place it on white.
- sysverax-logo.png: Sysverax logo. Use small, in the footer "A product of" block. White background:
  only place it on white.
- Never stretch, recolour, crop or add effects to the logos. Keep clear space around them.
- In the header, show the icon (32-36px) followed by the text "Flyverax" in the heading font,
  weight 800, navy. Do not try to redraw the FLYVERAX wordmark in a font.

Colours (define as CSS variables / Tailwind theme tokens):
- navy        #0A1F44  primary: headings, primary buttons, dark sections, icons
- navy-800    #0F2757  hover / secondary dark
- blue        #1766C9  links, focus rings, small highlights
- sky         #38A8F0  accent only: small details, active states, a thin line, never large areas
- logo gradient: linear-gradient(135deg, #0E2A5C 0%, #1766C9 55%, #29ABE8 100%) - use sparingly:
  the hero background glow, one thin underline under the hero headline, the step numbers
- grey-50     #F7F8FA  alternate section background
- grey-100    #F3F4F6  cards on white, inputs
- grey-200    #E5E7EB  borders, dividers
- text        #1F2937  body text
- muted       #6B7280  secondary text
- success     #12B76A  form success only
- error       #D92D20  form errors only
Text and backgrounds must meet WCAG AA contrast (4.5:1 for body text).

Typography:
- Font: Figtree (Google Fonts), weights 400, 500, 600, 700, 800. Fallback: system-ui, sans-serif.
- H1: 56px / 1.08, weight 800, letter-spacing -0.02em (mobile 36px / 1.12)
- H2: 40px / 1.15, weight 800, letter-spacing -0.015em (mobile 28px / 1.2)
- H3: 20px / 1.3, weight 700
- Body: 18px / 1.6 (mobile 16px), weight 400, colour text
- Small / labels: 14px, weight 600; eyebrow labels 13px uppercase, letter-spacing 0.08em, colour blue
- Max line length for paragraphs about 65 characters.

Layout and components:
- Content max width 1200px, side padding 24px (mobile 20px). Section vertical padding 112px desktop,
  72px mobile. 12-column grid on desktop.
- Corner radius: cards 16px, buttons 12px, inputs 10px, badges 999px.
- Shadows: soft and low, e.g. 0 1px 2px rgba(10,31,68,.06), 0 12px 32px -12px rgba(10,31,68,.18).
- Primary button: navy background, white text, 600 weight, 48px tall, hover navy-800.
- Secondary button: white background, navy text, 1px grey-200 border, hover grey-50.
- Icons: lucide-react, 1.75 stroke, navy, inside a 44px rounded square with grey-100 background.
- Cards: white, 1px grey-200 border, 16px radius, 28px padding.
- Motion: calm. Sections and cards fade up 12px over 300ms ease-out when they enter the viewport,
  staggered 60ms. No bouncing, no parallax, no auto-playing carousels, nothing flashing.
  Respect prefers-reduced-motion (no animation at all).
- Visual mood: light, airy, lots of white space, navy and white with a little sky blue. Think of a
  calm airport operations room at night: clear, organised, under control.

=====================================================================
4. PAGE STRUCTURE AND EXACT COPY (home page, in this order)
=====================================================================

--- 4.1 Header (sticky) ---
Left: Flyverax icon + "Flyverax".
Centre/right links (smooth-scroll to sections): How it works | Features | Notifications | Coverage | FAQ
Right: primary button "Request a demo" (scrolls to the demo form).
White background; after scrolling 8px add a bottom border (grey-200) and a light shadow.
Mobile: logo left, "Request a demo" small button + a menu button right; the menu opens a full-width
panel with the links. Close it on link click and on Escape.

--- 4.2 Hero ---
Eyebrow: Hotel accommodation for cancelled flights
H1: Calm in every disruption.
Subheading: When a flight is cancelled, Flyverax finds and books hotel rooms near the airport for
your passengers, from a single passenger list. Your team stays in control, and every passenger gets
their hotel by SMS and email.
Buttons: [Request a demo] (primary, scrolls to form)  [See how it works] (secondary, scrolls to 4.4)
Below the buttons, a quiet line of three items separated by thin dividers (hide any item whose value
is empty in site.ts):
  {hotelCount} accommodation options  |  {countryCount} countries and territories  |  Live rates, booked in one flow
Right side (below on mobile): a clean browser-window frame (light grey top bar with three neutral
grey dots, no real browser branding) containing a product screenshot. Until screenshots are uploaded,
show a placeholder inside the frame: grey-100 background, a small image icon and the text
"Product screenshot". Behind the frame, a very soft blurred glow using the logo gradient at low opacity.

--- 4.3 The problem ---
Eyebrow: The problem
H2: Cancellations don't wait for office hours.
Intro: A cancelled flight can leave hundreds of passengers needing a room tonight. Most airline teams
still handle it by phone and spreadsheet, while nearby hotels fill up.
Three cards (icon, title, text):
1. Icon: phone. Title: Hours on the phone. Text: Calling hotels one by one, while the rooms you were
   promised go to someone else.
2. Icon: sheet / table. Title: Spreadsheets that drift. Text: Passenger lists, room counts and
   confirmations spread across files and inboxes.
3. Icon: clock. Title: Passengers left waiting. Text: Families at the gate, not knowing where they
   will sleep or how to get there.

--- 4.4 How it works (id="how-it-works") ---
Eyebrow: How it works
H2: From cancelled flight to confirmed rooms, in one flow.
Four numbered steps (large step number using the logo gradient, title, text). Desktop: 4 columns
connected by a thin sky line; mobile: vertical list with the line on the left.
1. Title: Create the cancelled flight. Text: Add the flight and upload your bookings as a CSV file.
   Rows with problems are kept aside for you to fix, not lost.
2. Title: Flyverax searches near the airport. Text: Live availability and rates from our hotel
   partners. If nearby hotels are full, the search widens.
3. Title: Rooms are matched and booked. Text: Each booking is matched to a room that fits its travel
   class, party size and needs. Anything that cannot be placed is flagged for your team.
4. Title: Publish, and everyone is told. Text: Each passenger gets their hotel confirmation by SMS
   and email, and your finance team gets one invoice for the whole flight.
Under the steps: a wide browser frame with a screenshot placeholder labelled "Allocation in progress".

--- 4.5 Features (id="features") ---
Eyebrow: Features
H2: Built for the way disruption really works.
Grid of 6 cards (3 columns desktop, 2 tablet, 1 mobile). Icon, title, text:
1. Icon: file-up. Bookings import that forgives mistakes. Upload a CSV with your usual column names.
   Failed rows are kept to fix, and re-uploading the same file skips rows you already have.
2. Icon: users. Rooms that fit the party. Passengers are grouped by travel class, party size and
   children, and special notes such as wheelchair assistance or a baby cot travel with the booking.
3. Icon: map-pin / radar. Live rates near the airport. Real-time availability and prices from our
   hotel partners, with the search radius widened when nearby hotels are full.
4. Icon: flag. Exceptions, not surprises. Any booking without a suitable room is flagged for your
   team to review, instead of silently left out.
5. Icon: qr-code. Confirmation vouchers. A PDF for every booking with the booking reference and a QR
   code to show at hotel check-in, sent to each passenger by SMS and email.
6. Icon: receipt. One invoice per flight. Every booking's hotel, rooms and cost in a single document,
   emailed to your finance team.

--- 4.6 Coverage (id="coverage") ---
Full-width navy (#0A1F44) band, white text, the logo gradient as a very subtle glow in one corner.
Eyebrow (sky): Global coverage
H2 (white): Rooms wherever your network flies.
Text (white at 80% opacity):
  When both figures are set: Through our global hotel distribution partners, Flyverax reaches
  {hotelCount} accommodation options in {countryCount} countries and territories, with live
  availability and rates.
  If they are ever emptied in site.ts: Through our global hotel distribution partners,
  Flyverax gives you access to hotels worldwide, with live availability and rates near the airports
  you fly from.
Two large figures side by side (white, weight 800, 56px), each with a small label under it:
  {hotelCount}  /  accommodation options worldwide
  {countryCount} / countries and territories
(Hide a figure if it is empty in site.ts; with both empty, show three short white text items
instead: "Worldwide hotel inventory", "Live availability and rates", "Search radius that widens
when hotels fill up". Do not add any other figures. Do not name partners.)
Optional decoration: a very faint dotted world map in sky blue at 10-15% opacity. No pins, no routes,
no city labels.

--- 4.7 Notifications (id="notifications") ---
Eyebrow: Notifications
H2: Everyone knows where they are staying.
Intro: When you publish the flight, every passenger gets their hotel by SMS and email, and your
finance team gets one invoice for the whole flight.
Layout: two phone images side by side (stacked on mobile), then one wide laptop image under them.
Show the images as they are (they already have their own soft background): rounded 16px, no extra
frame or overlay, lazy-loaded, width/height set. Each image has a short title and one line under it:
1. Image 03a-email-notification.png. Title: SMS and email for every passenger. Text: The hotel, the
   check-in date and the booking reference, on their phone straight away.
   Alt: "Phone lock screen with a Flyverax email and SMS confirming the hotel for cancelled flight WA0021"
2. Image 03b-email-open.png. Title: The confirmation attached. Text: Each email carries the hotel
   confirmation PDF to show at check-in.
   Alt: "Flyverax confirmation email with hotel details and the hotel-confirmation.pdf attachment"
3. Image 04-airline-invoice-email.png (wide). Title: One invoice per flight, by email. Text: Your
   finance team receives the flight's invoice with every booking listed in the PDF.
   Alt: "Airline finance inbox showing the Flyverax invoice email for flight WA0021"
Until the images are uploaded, show the neutral image placeholder from section 6 in each slot.

--- 4.8 Who it's for ---
Eyebrow: Who it's for
H2: One place for every team involved.
Four compact items (icon + title + one line), 4 columns desktop, 2x2 mobile:
1. Operations control: Start accommodation for a cancelled flight from one screen.
2. Stations and airports: See which hotel every booking is in, near the airport you are working.
3. Customer care: Every passenger gets their hotel by SMS and email, with the confirmation attached.
4. Finance: One invoice per flight, by email, with every booking's hotel, rooms and cost.

--- 4.9 Video (optional section) ---
Only render this section if a video file is configured in site.ts (videoUrl). Until then, do not
show it at all.
Eyebrow: Overview  /  H2: See Flyverax in 45 seconds.
A 16:9 player, rounded 16px, with a poster image, a large play button, native controls, captions
track (VTT) and no autoplay. Lazy-load the video.

--- 4.10 Pricing ---
Small centred section on grey-50.
H2: Pricing that follows your volume.
Text: Every airline's network and disruption patterns are different. Tell us about your operation
and we will put together a proposal.
Button: [Talk to us] (scrolls to the demo form)

--- 4.11 FAQ (id="faq") ---
H2: Questions airlines ask us.
Accordion (one open at a time, keyboard accessible, first item closed):
Q: Which hotels can you book?
A: Flyverax works with global hotel distribution partners, giving access to {hotelCount}
   accommodation options in {countryCount} countries and territories. For each cancelled flight it
   searches hotels near the
   airport and widens the search if nearby hotels are full.
   (If the figures are empty, the first sentence is just: "Flyverax works with global hotel
   distribution partners.")
Q: What do we need to get started?
A: Our team sets up your airline's account. After that, all you need for each cancelled flight is a
   CSV of the affected bookings: PNR, passenger name and contact details, travel class and party size.
   We provide a template.
Q: How do passengers get their hotel details?
A: When you publish the flight, each passenger receives their hotel confirmation by SMS and email,
   with the confirmation PDF attached to the email. Your team can also download every confirmation
   from the portal.
Q: What happens if there is no suitable room?
A: The booking is flagged for your team to review, so nothing is silently left out.
Q: How do we pay?
A: We will walk you through the payment options on the demo call. For every cancelled flight you
   receive one invoice, listing every booking's hotel, rooms and cost.
Q: How is pricing set?
A: Pricing depends on your volume and needs. Request a demo and we will prepare a proposal.
Q: How do you handle passenger data?
A: We ask only for the details needed to book rooms, and access is limited to your team's accounts.
   We are happy to walk your security and data teams through it during the demo.

--- 4.12 Request a demo (id="demo") ---
Two columns on desktop (text left, form right), stacked on mobile. grey-50 background, form in a
white card.
Left:
  Eyebrow: Request a demo
  H2: See Flyverax with your own scenario.
  Text: Tell us a little about your airline. We will show you the full flow, from cancelled flight
  to confirmed rooms, and answer your team's questions.
  Three short checklist lines (check icon in sky):
    A 30-minute walkthrough with our team
    Your questions on data, payments and set-up
    A proposal based on your volume
  A small muted line under the checklist (text only, no logo):
    Flyverax is built by Sysverax, a product-first technology company building secure, scalable and maintainable software and hardware systems.
Right: the form (see section 5).

--- 4.13 Footer ---
White background, top border grey-200.
Column 1: flyverax-logo.png (max-width 180px), one line: Calm in every disruption.
Column 2 "Product": How it works, Features, Notifications, Coverage, FAQ (anchor links).
Column 3 "Company": Request a demo, Contact (hai@flyverax.com as a mailto link), Privacy, Terms.
Column 4 "A product of": sysverax-logo.png (max-width 150px) linking to https://sysverax.com
(new tab, rel="noopener"), and under it the company email hai@sysverax.com as a mailto link
(muted, 14px).
Bottom row (muted, 14px): © 2026 SYSVERAX (PVT) LTD, Sri Lanka.
All rights reserved. (Wrap onto two lines on mobile.)
Mobile: columns stack, logos left-aligned.

=====================================================================
5. DEMO REQUEST FORM AND BACKEND
=====================================================================
Fields (labels above inputs, all with visible labels, not placeholders only):
- Full name (required, 2-100 characters)
- Work email (required, valid email)
- Airline (required, 2-120 characters)
- Your role (required, select): Operations / OCC, Station or airport management, Customer care,
  Finance, IT, Management, Other
- Main hub airport (optional, free text, max 60, hint: "e.g. CDG or Paris Charles de Gaulle")
- Message (optional, textarea, max 1000 characters, with a character counter)
- Consent checkbox (required): I agree that Flyverax may contact me about my request, as described
  in the Privacy Policy. ("Privacy Policy" links to /privacy, opens in the same tab.)
- Hidden honeypot field named "company_website" (visually hidden and aria-hidden, tabindex -1).
  If it is filled in, pretend success but store nothing.
Submit button: "Request a demo" (full width on mobile). While sending: disabled, spinner, text
"Sending...".
Validation: zod + react-hook-form; inline error messages under each field, in error colour, linked
with aria-describedby; focus moves to the first invalid field.
Success state (replace the form inside the card, announce with aria-live="polite"):
  Title: Thank you. We will be in touch.
  Text: "We will reply to <the email they entered> soon." If replyTime is set in site.ts, use
  "We will reply to <email> within <replyTime>." instead. Only add "A copy of your request has been
  sent to your email." when sendConfirmationEmail is true.
Error state: "Something went wrong. Please try again, or email us at hai@flyverax.com."

Backend (use Lovable Cloud / Supabase):
1. Table demo_requests: id (uuid), created_at, full_name, work_email, airline, role, hub_airport,
   message, consent (boolean), consent_text (the exact checkbox text), page_url, user_agent.
   Row Level Security ON: anonymous users may INSERT only; nobody may SELECT, UPDATE or DELETE from
   the client. Only the service role can read.
2. An edge function "submit-demo-request" that validates the input again on the server, applies a
   simple rate limit (max 5 requests per IP per hour), inserts the row, and sends a notification
   email to hai@flyverax.com with all fields (subject: "Demo request: {airline} - {full_name}").
   Use Resend for email (I will add the RESEND_API_KEY secret). Reply-To = the requester's email.
3. Optional, OFF by default (setting in site.ts: sendConfirmationEmail = false): a short
   confirmation email to the requester ("We received your request").
4. The form calls the edge function, never the table directly. Never expose keys in the client.

=====================================================================
6. SCREENSHOT AND IMAGE SLOTS
=====================================================================
Create a reusable <BrowserFrame> component: rounded 14px, white, 1px grey-200 border, soft shadow,
a 36px top bar in grey-100 with three 10px grey (#D1D5DB) dots and an empty address pill. Inside:
an image (object-fit: cover, top aligned) with width/height attributes, lazy-loaded (except the hero),
with descriptive alt text. If no image is set, show the neutral placeholder: grey-100 fill, a lucide
"image" icon in muted grey and a label (e.g. "Product screenshot").
Slots (configure image paths in site.ts):
- hero: "Cancelled flights" (02-cancelled-flights.png)
- howItWorks: "Hotel allocation" (05-allocation.png)
I will upload the real screenshots later. Never fill these slots with generated or fake UI.

=====================================================================
7. PRIVACY, TERMS AND 404 PAGES
=====================================================================
/privacy and /terms: simple readable pages (max width 760px, headings, short paragraphs), using the
same header and footer. At the top of each, a clearly visible amber notice box:
  "Draft for legal review. This page is a placeholder and is not yet legally reviewed."
Privacy outline: who we are (Flyverax is a product of SYSVERAX (PVT) LTD, Sri Lanka, which is
responsible for this website and the data collected through it; contact hai@flyverax.com for this
website, and hai@sysverax.com for the company); what we collect through the demo form (the fields above, page URL, browser user
agent); why (to respond to the request and arrange a demo); legal basis placeholder; how long we keep
it (placeholder); who we share it with (our email provider and hosting provider, as processors);
your rights (access, correction, deletion: contact hai@flyverax.com); cookies (this site uses no
tracking cookies); changes to this policy; last updated date.
Terms outline: website use only (not the Flyverax service agreement); intellectual property;
no warranty for website content; limitation of liability placeholder; governing law placeholder
(the laws of Sri Lanka); contact.
404 page: H1 "Page not found", text "The page you are looking for does not exist.", button
"Back to home".

=====================================================================
8. SEO, SHARING, ACCESSIBILITY, PERFORMANCE
=====================================================================
- <title>: Flyverax - Hotel rooms for passengers when flights are cancelled
- Meta description: Flyverax helps airlines find and book hotel rooms near the airport for passengers
  of a cancelled flight, from a single passenger list. A product of Sysverax.
- Canonical URL https://flyverax.com, lang="en".
- Open Graph and Twitter card: title, description, and a 1200x630 share image (generate it: white
  background, flyverax-logo.png centred, the tagline "Calm in every disruption" below in navy).
- Favicon from flyverax-icon.svg, plus apple-touch-icon 180px and a web manifest (theme colour #0A1F44).
- JSON-LD: Organization (name Sysverax, url https://sysverax.com) and SoftwareApplication (name
  Flyverax, applicationCategory BusinessApplication, operatingSystem Web, publisher Sysverax).
  NO aggregateRating, NO reviews, NO offers/price.
- sitemap.xml (/, /privacy, /terms) and robots.txt allowing all.
- Accessibility: WCAG 2.2 AA. Semantic landmarks (header, main, footer), one H1 per page, logical
  heading order, visible focus rings (2px blue, 2px offset), skip-to-content link, all interactive
  elements keyboard-usable, touch targets at least 44px, alt text on all images.
- Performance: Lighthouse 95+ on mobile. Preload Figtree, images in WebP with width/height set,
  lazy-load below the fold, no heavy libraries. No analytics and no cookies for now (so no cookie
  banner is needed).
- Responsive: check at 360, 390, 768, 1024, 1280 and 1440px. No horizontal scrolling. On mobile,
  the header "Request a demo" button stays visible.

=====================================================================
9. CONFIG FILE
=====================================================================
src/config/site.ts must hold:
  hotelCount = "2.6 million+"   // largest partner's published figure; do not add partners together
  countryCount = "220"          // "countries and territories", same source
  demoEmail = "hai@flyverax.com", contactEmail = "hai@flyverax.com", companyEmail = "hai@sysverax.com",
  sysveraxOneLiner = "a product-first technology company building secure, scalable and maintainable
    software and hardware systems",
  legalEntity = "SYSVERAX (PVT) LTD, Sri Lanka",
  replyTime = "", sendConfirmationEmail = false,
videoUrl = "", videoPoster = "", videoCaptions = "", screenshots { hero: "", howItWorks: "" },
siteUrl = "https://flyverax.com".
Every component reads from this file. Empty values hide their element (or fall back as described).

=====================================================================
10. BEFORE YOU FINISH, CHECK
=====================================================================
- Every section in section 4 exists, in order, with the copy as written.
- No invented figures, testimonials, logos, partner names, prices, badges or fake UI anywhere.
- There is no "Coming soon" or roadmap section or badge anywhere.
- The form validates, stores, emails, shows success and error states, and the honeypot works.
- Lighthouse accessibility and SEO 100 if possible; no console errors; works at 360px wide.
```

---

## Follow-up prompts (one at a time, after the master prompt is built)

**Prompt 2: real screenshots** (attach the PNGs)
```text
I have attached real Flyverax portal screenshots (test data only). Put 02-cancelled-flights.png in the hero
BrowserFrame and 05-allocation.png in the How it works BrowserFrame. Convert them to WebP, keep their
aspect ratio, set width/height, and write specific alt text (e.g. "Flyverax list of cancelled
flights with their hotel allocation status"). Then add a "Product tour" strip under the
Features section: three BrowserFrames side by side (stacked on mobile) using
04-bookings-import.png ("Bookings import with rows to fix"), 06-booking-summary.png ("Booked hotels")
and 08-confirmation-pdf.png ("Hotel confirmation voucher", show it as a document card with a soft shadow
rather than inside a browser frame), each with a one-line caption under it.
Do not crop out important parts of the UI, and do not add any overlays with figures.
```

**Prompt 3: explainer video** (attach the MP4, poster and VTT)
```text
I have attached the explainer video (flyverax-explainer-16x9.mp4), its poster image and captions
(flyverax-explainer.vtt). Set videoUrl, videoPoster and videoCaptions in site.ts so the Video section
appears between Notifications and Who it's for. No autoplay; captions available and off by default;
preload="none". Also add a secondary button "Watch the 45-second overview" in the hero that scrolls to
the video.
```

**Prompt 4: email setup check**
```text
Check the demo form end to end: submit a test request, confirm the row is stored in demo_requests,
the notification email arrives at hai@flyverax.com with Reply-To set to the requester, the rate limit
blocks a 6th request within an hour from the same IP, and the honeypot stores nothing. Show me the
results and fix anything that fails.
```

**Prompt 5: notifications are live** (attach `03a-email-notification.png`, `03b-email-open.png` and
`04-airline-invoice-email.png` from `landing-page/assets/notifications/`)
```text
Passenger SMS, passenger email and the airline invoice email are now live features. Update the site
so nothing calls them "coming soon". Make only these changes, with exactly this copy:

1. Remove the "Coming soon" section completely (its eyebrow, heading, both cards, badges and the
   muted line under them). There must be no "Coming soon", "roadmap" or "not yet available" text or
   badge anywhere on the site.

2. In its place (same position, between Coverage and Who it's for), add a section with
   id="notifications":
   Eyebrow: Notifications
   H2: Everyone knows where they are staying.
   Intro: When you publish the flight, every passenger gets their hotel by SMS and email, and your
   finance team gets one invoice for the whole flight.
   Layout: the two phone images side by side (stacked on mobile), then the wide laptop image under
   them. Use the attached images as they are (they already have their own soft background): convert
   to WebP, rounded 16px, no extra frame, overlay, crop or added text, lazy-loaded, width/height set.
   Under each image a short title and one line:
   a) 03a-email-notification.png. Title: SMS and email for every passenger. Text: The hotel, the
      check-in date and the booking reference, on their phone straight away.
      Alt: "Phone lock screen with a Flyverax email and SMS confirming the hotel for cancelled flight WA0021"
   b) 03b-email-open.png. Title: The confirmation attached. Text: Each email carries the hotel
      confirmation PDF to show at check-in.
      Alt: "Flyverax confirmation email with hotel details and the hotel-confirmation.pdf attachment"
   c) 04-airline-invoice-email.png (full width of the content). Title: One invoice per flight, by
      email. Text: Your finance team receives the flight's invoice with every booking listed in the PDF.
      Alt: "Airline finance inbox showing the Flyverax invoice email for flight WA0021"

3. Header navigation and footer "Product" column: add "Notifications" between Features and Coverage,
   linking to #notifications.

4. Replace these texts exactly:
   - Hero subheading: When a flight is cancelled, Flyverax finds and books hotel rooms near the
     airport for your passengers, from a single passenger list. Your team stays in control, and every
     passenger gets their hotel by SMS and email.
   - How it works, step 4: Title: Publish, and everyone is told. Text: Each passenger gets their hotel
     confirmation by SMS and email, and your finance team gets one invoice for the whole flight.
   - Features card "Confirmation vouchers": A PDF for every booking with the booking reference and a QR
     code to show at hotel check-in, sent to each passenger by SMS and email.
   - Features card "One invoice per flight": Every booking's hotel, rooms and cost in a single
     document, emailed to your finance team.
   - Who it's for, Customer care: Every passenger gets their hotel by SMS and email, with the
     confirmation attached.
   - Who it's for, Finance: One invoice per flight, by email, with every booking's hotel, rooms and cost.
   - FAQ "How do passengers get their hotel details?": When you publish the flight, each passenger
     receives their hotel confirmation by SMS and email, with the confirmation PDF attached to the
     email. Your team can also download every confirmation from the portal.

5. If the explainer video section exists or is added later, place it between Notifications and
   Who it's for.

Do not change anything else. Do not add figures, prices or new claims. Afterwards, list every text
you changed and confirm that searching the site for "coming soon" and "roadmap" finds nothing.
```

**Prompt 6: final polish**
```text
Do a final review at 360px, 768px and 1440px. Fix any overlapping or cramped text, uneven card
heights, inconsistent spacing between sections, and any colour contrast below WCAG AA. Check that
the Notifications images are sharp, not cropped and not stretched on every size. Make sure no text
says or implies anything that is not in the brief (figures, partners, customers, compliance or
prices), and that there is no "Coming soon" or roadmap text anywhere. List every change you made.
```
