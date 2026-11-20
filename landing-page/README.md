# Flyverax landing page: source material

The landing page code lives in its own repository, `sysverax/flyverax-demo-launchpad`, included
here as the `landing-site/` submodule. It is a static site hosted on AWS S3 + CloudFront; see
`landing-site/README.md` for running and deploying it.

This folder holds the material it was built from:

| Path | What it is |
|---|---|
| `LOVABLE-PROMPT.md` | The original content brief and prompts (history; the site no longer uses Lovable) |
| `assets/` | Flyverax and Sysverax logos |
| `assets/screenshots/` | Real airline portal screens rendered with fake test data |
| `assets/notifications/` | Passenger SMS/email and airline invoice email images |
| `screenshots/` | Script that renders the portal screenshots (see its README) |

All names, emails, PNRs and hotels in the images are fictional.
The notification images are rendered from `marketing-mockups/`
(`SHOW_CONCEPT_LABEL=false npm run stills` there).
