# SYSVERAX Airline Platform Guide — generator

`build_airline_doc.js` generates the **SYSVERAX Airline Platform Guide**, a Word
document (`.docx`) that explains how the platform works to an airline client
— architecture, the end-to-end disruption/hotel-allocation workflow, wallet
and credit limit mechanics, security, roles, onboarding, and an FAQ. It's
used for airline onboarding and commercial conversations, not for end users
of the app.

The script is a static content generator: all the text lives inside
`build_airline_doc.js` as plain strings, and a handful of values (airline
name, service fee %, credit limit, etc.) are injected from a config file.
Running it produces one `.docx` file — nothing else is read or written.

## Setup (one-time)

The script depends on the [`docx`](https://www.npmjs.com/package/docx) npm
package, which isn't installed by default (there's no `package.json` in this
folder):

```
cd airline-docs
npm install docx
```

## Running it

```
node build_airline_doc.js [config.json] [output.docx]
```

Both arguments are optional.

- **`config.json`** — path to a config file (see below). If omitted, the
  script uses its built-in placeholder defaults (`[Airline Name]`, `[XX]`,
  etc.) with `highlight: true` — useful as a "master copy" to see at a
  glance which values are config-driven.
- **`output.docx`** — where to write the generated file. If omitted, it
  defaults to `generated_docs/SYSVERAX_Airline_Platform_Guide.docx` (created
  automatically if the folder doesn't exist yet).

### Example: generate a real, airline-specific copy

```
node build_airline_doc.js example_airline_config.json generated_docs/SYSVERAX_SurinamAirways.docx
```

## Input: the config file

A JSON file overriding any of these fields. Every field is optional — a
field left out of your config file falls back to the default shown, which
for most of the commercial/operational fields is itself a bracketed
placeholder like `"[insert]"` (see **Unfilled fields**, below).

**Core**

| Field | Default | Meaning |
|---|---|---|
| `airline` | `"[Airline Name]"` | Airline's display name |
| `airlineCode` | `"[XX]"` | Airline's IATA/code |
| `feePct` | `12` | SYSVERAX service fee, as % of hotel booking cost |
| `creditLimit` | `10000` | Approved credit limit |
| `currency` | `"USD"` | Wallet/billing currency |
| `searchRadiusKm` | `10` | Default hotel search radius around the airport |
| `maxSearchRadiusKm` | `50` | Cap the search widens to if the default radius has too few rooms |
| `version` | `"v1.0"` | Document version shown on the cover page |
| `date` | `"October 2026"` | Document date shown on the cover page |
| `highlight` | `true` | See below |

**API integration** (Section 4)

| Field | Meaning |
|---|---|
| `apiAuthMethod` | Authentication method (API key, OAuth 2.0, IP allow-listing, ...) |
| `apiDeliveryModel` | Whether polling and/or outbound webhooks are supported alongside the airline-pushes model |
| `apiSandbox` | Sandbox/test environment availability |

**Manual portal** (Section 5)

| Field | Meaning |
|---|---|
| `bulkUploadSupport` | Whether bulk CSV/Excel upload of PNRs and passengers is supported |

**Security pack** (Section 10, also reused in the FAQ)

| Field | Meaning |
|---|---|
| `hostingRegion` | Hosting provider and region |
| `encryptionAtRest` | Encryption at rest |
| `certifications` | Certifications/independent audits held (ISO 27001, SOC 2, pen test, ...) |
| `dpaTerms` | Data protection terms / DPA |
| `retentionPeriod` | Passenger data retention and deletion periods |
| `breachNotification` | Breach notification process and timelines |

**Configuration schedule** (Section 12)

| Field | Meaning |
|---|---|
| `feeBasis` | What the service fee percentage is applied to |
| `minTopUp` | Smallest permitted wallet top-up |
| `fundDrawdownOrder` | Order wallet and credit are drawn down in |
| `cancellationFeeTreatment` | How the service fee is treated on amendment/cancellation |
| `noShowTreatment` | How hotel no-show charges and the fee are handled |
| `taxOnFee` | VAT/other tax treatment of the service fee |
| `invoicingTerms` | Invoice frequency, payment terms, settlement method |
| `integrationMode` | API, manual portal, or both |
| `authorisedUsers` | Number of users and roles agreed |

**Onboarding** (Section 13, also reused in the FAQ)

| Field | Meaning |
|---|---|
| `pilotApproach` | Pilot/go-live approach |
| `supportDetails` | Support hours, contacts and response targets |
| `onboardingTimeline` | Typical onboarding timeline |

**FAQ**

| Field | Meaning |
|---|---|
| `companyExperience` | SYSVERAX's track record, team background and supplier partnerships |

`example_airline_config.json` is a complete working example (Surinam
Airways) with every field above filled in — copy it and edit the values to
generate a copy for a different airline.

### `highlight`

When `true`, every config-driven value in the document is yellow-highlighted
(as long as it's been filled in — see below), so it's easy to spot what's
specific to one airline — useful for a reviewed "master" copy. Set it to
`false` (as the example config does) for the final copy you'd actually send
to an airline, so it reads as a normal document.

### Unfilled fields

Any field you don't set in your config keeps its built-in default, which
for the commercial/operational fields above is a bracketed placeholder like
`"[insert]"` or `"[insert policy]"`. A value in that `[bracketed]` shape is
**always** yellow-highlighted in the output, regardless of the `highlight`
setting — so an unanswered field can never silently slip into a document
you send to an airline. Before sending a generated copy, search it for
`[square brackets]` and fill in anything still flagged.

## Output

A single `.docx` file, written to `generated_docs/` by default (git-ignored
— generated output isn't committed) or to whatever path you pass as the
second argument.
