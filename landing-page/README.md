# Flyverax landing page: source material

The landing page itself is built in Lovable and lives in its own repository,
`sysverax/flyverax-demo-launchpad`, included here as the `landing-site/` submodule.
This folder holds what was used to build it:

| Path | What it is |
|---|---|
| `LOVABLE-PROMPT.md` | The Lovable master prompt and follow-up prompts |
| `assets/` | Flyverax and Sysverax logos |
| `assets/screenshots/` | Real airline portal screens rendered with fake test data |
| `assets/notifications/` | Passenger SMS/email and airline invoice email images |
| `screenshots/` | Script that renders the portal screenshots (see its README) |

All names, emails, PNRs and hotels in the images are fictional.
The notification images are rendered from `marketing-mockups/`
(`SHOW_CONCEPT_LABEL=false npm run stills` there).
