// Usage: node build.js [config.json] [output.docx]
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak
} = require('docx');

// ---------- CONFIG (per-airline values) ----------
// Short fields (bolded wherever they appear, e.g. {{feePct}}) vs. long free-text
// fields (printed as normal prose, not bolded - see `longText` below).
const defaults = {
  airline: "[Airline Name]",
  airlineCode: "[XX]",
  feePct: 12,                 // SYSVERAX service fee, % of hotel booking cost
  creditLimit: 10000,         // approved credit limit
  currency: "USD",
  searchRadiusKm: 10,         // default hotel search radius around the airport
  maxSearchRadiusKm: 50,      // search widens in steps up to this cap if the default radius has too few hotels
  version: "v1.0",
  date: "October 2026",
  highlight: true,            // highlight config-driven values (master copy). Set false for the final airline copy.

  // --- Section 4: API integration ---
  apiAuthMethod: "[to be confirmed: API key, OAuth 2.0 client credentials and/or IP allow-listing]",
  apiDeliveryModel: "[confirm whether polling and outbound webhooks to the airline are also supported]",
  apiSandbox: "[confirm availability of a test environment and sample credentials]",

  // --- Section 5: manual portal ---
  bulkUploadSupport: "[confirm whether bulk upload via CSV/Excel is supported]",

  // --- Section 10: security pack ---
  hostingRegion: "[insert]",
  encryptionAtRest: "[insert]",
  certifications: "[insert what is held, or state the roadmap honestly]",
  dpaTerms: "[insert]",
  retentionPeriod: "[insert]",
  breachNotification: "[insert]",

  // --- Section 12: configuration schedule ---
  feeBasis: "[e.g. net hotel rate excluding taxes / including taxes]",
  minTopUp: "[insert]",
  fundDrawdownOrder: "[e.g. wallet first, then credit]",
  cancellationFeeTreatment: "[insert policy]",
  noShowTreatment: "[insert policy]",
  taxOnFee: "[insert]",
  invoicingTerms: "[insert]",
  integrationMode: "[insert]",
  authorisedUsers: "[insert]",

  // --- Section 13: onboarding ---
  pilotApproach: "[insert pilot approach, e.g. manual-first, then API]",
  supportDetails: "[insert support hours, contacts and response targets, including out-of-hours disruption support]",
  onboardingTimeline: "[insert typical timeline]",

  // --- Section 14: FAQ ---
  companyExperience: "[insert a factual description: team background in travel, hotel distribution or airline technology; hotel supplier and distribution partnerships already connected; pilot or phased rollout approach; references where available]"
};
// Fields holding paragraph-length prose rather than a short value - printed
// as normal text (not forced bold) wherever they're used.
const longText = new Set([
  'apiAuthMethod', 'apiDeliveryModel', 'apiSandbox', 'bulkUploadSupport',
  'hostingRegion', 'encryptionAtRest', 'certifications', 'dpaTerms', 'retentionPeriod', 'breachNotification',
  'feeBasis', 'minTopUp', 'fundDrawdownOrder', 'cancellationFeeTreatment', 'noShowTreatment', 'taxOnFee',
  'invoicingTerms', 'integrationMode', 'authorisedUsers',
  'pilotApproach', 'supportDetails', 'onboardingTimeline', 'companyExperience'
]);
const cfg = Object.assign({}, defaults, process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : {});
// Generated docs are build output, not source - they all land in generated_docs/ (git-ignored).
// A relative output argument (with or without a leading "generated_docs/") is
// always resolved to just its filename inside generated_docs/, so a plain
// `node build_airline_doc.js config.json my-copy.docx` can't accidentally
// write into the repo root. Pass an absolute path to opt out of this.
const outArg = process.argv[3];
const OUT = outArg
  ? (path.isAbsolute(outArg) ? outArg : path.join(__dirname, 'generated_docs', path.basename(outArg)))
  : path.join(__dirname, 'generated_docs', 'SYSVERAX_Airline_Platform_Guide.docx');

const f = cfg.feePct / 100, L = cfg.creditLimit;
const money = n => `${cfg.currency} ${Math.round(n).toLocaleString('en-US')}`;
const r50 = x => Math.max(50, Math.round(x / 50) * 50);
const tokens = Object.assign({}, cfg, {
  feePct: `${cfg.feePct}%`, creditLimit: money(L),
  radius: `${cfg.searchRadiusKm} km`, maxRadius: `${cfg.maxSearchRadiusKm} km`
});

// ---------- worked examples (computed from config) ----------
// The wallet has no separate "used credit" field (see WalletEntity: balance,
// creditLimit, lockedAmount only) - credit drawn shows up as a negative
// wallet balance. Available capacity = balance + creditLimit - lockedAmount.
const ex1 = { H: 5000 }; ex1.fee = ex1.H * f; ex1.T = ex1.H + ex1.fee;
// Example A: wallet balance comfortably positive, a small amount locked by another pending booking.
const exA = { W: 0.4 * L, locked: 0.05 * L };
exA.cap = exA.W + L - exA.locked;
exA.H = r50(0.5 * exA.cap / (1 + f)); exA.fee = exA.H * f; exA.T = exA.H + exA.fee;
// Example B: wallet balance has already gone negative - bookings have drawn into the credit line.
const exB = { W: -0.6 * L, locked: 0 };
exB.cap = exB.W + L - exB.locked;
exB.H = r50((exB.cap + 1000) / (1 + f)); exB.fee = exB.H * f; exB.T = exB.H + exB.fee;

// ---------- helpers ----------
const FONT = 'Calibri', NAVY = '1F3A5F', GREY = '5B6770';
function runs(s, base = {}) {
  return s.split(/(\*\*[^*]+\*\*|\{\{\w+\}\}|\[\[[^\]]+\]\])/).filter(Boolean).flatMap(p => {
    if (p.startsWith('{{')) {
      const key = p.slice(2, -2);
      const text = String(tokens[key]);
      // A value that's still bracket-wrapped (the field's unfilled default)
      // stays flagged yellow even in a final (highlight: false) copy, so an
      // unanswered field can never silently slip into a document sent to an airline.
      const unfilled = /^\[.*\]$/.test(text);
      return [new TextRun({ ...base, text, bold: longText.has(key) ? base.bold : true, highlight: (cfg.highlight || unfilled) ? 'yellow' : undefined })];
    }
    if (p.startsWith('**')) return runs(p.slice(2, -2), { ...base, bold: true });
    if (p.startsWith('[[')) return [new TextRun({ ...base, text: '[' + p.slice(2, -2) + ']', highlight: 'yellow' })];
    return [new TextRun({ ...base, text: p })];
  });
}
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const P = (t, o = {}) => new Paragraph({ spacing: { after: 120 }, ...o, children: runs(t) });
const B = t => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60 }, children: runs(t) });
const Q = t => new Paragraph({ keepNext: true, spacing: { before: 160, after: 40 }, children: runs(t, { bold: true, color: NAVY }) });
const border = { style: BorderStyle.SINGLE, size: 4, color: 'C9D1D9' };
const borders = { top: border, bottom: border, left: border, right: border };
function cell(t, w, o = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: (Array.isArray(t) ? t : [t]).map(x => new Paragraph({
      alignment: o.align, children: runs(x, o.head ? { bold: true, color: 'FFFFFF' } : {})
    }))
  });
}
function tbl(headers, rows, widths, opts = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], { fill: NAVY, head: true })) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], { fill: ri % 2 ? 'F5F7FA' : undefined, align: (opts.right || []).includes(i) ? AlignmentType.RIGHT : undefined })) }))
    ]
  });
}
const gap = () => new Paragraph({ spacing: { after: 100 }, children: [] });
function callout(lines, fill = 'EAF1FB') {
  return new Table({
    width: { size: 9026, type: WidthType.DXA }, columnWidths: [9026],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: 9026, type: WidthType.DXA },
        borders: { top: border, bottom: border, right: border, left: { style: BorderStyle.SINGLE, size: 24, color: NAVY } },
        shading: { fill, type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        children: lines.map(l => new Paragraph({ spacing: { after: 40 }, children: runs(l) }))
      })]
    })]
  });
}
const code = lines => lines.map(l => new Paragraph({
  spacing: { after: 0 }, shading: { fill: 'F3F4F6', type: ShadingType.CLEAR, color: 'auto' },
  children: [new TextRun({ text: l === '' ? ' ' : l, font: 'Consolas', size: 17 })]
}));

// ---------- content ----------
const c = [];

// Cover
c.push(
  new Paragraph({ spacing: { before: 2400, after: 120 }, children: [new TextRun({ text: 'SYSVERAX', bold: true, size: 64, color: NAVY })] }),
  new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: 'Airline Flight Disruption & Hotel Accommodation Platform', size: 34, color: GREY })] }),
  new Paragraph({ spacing: { after: 120 }, border: { top: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 12 } }, children: [new TextRun({ text: 'Platform Guide, Operating Model & Frequently Asked Questions', size: 28, bold: true })] }),
  gap(),
  P('**Prepared for:** {{airline}} ({{airlineCode}})'),
  P('**Prepared by:** SYSVERAX (Pvt) Ltd'),
  P('**Version:** {{version}}   **Date:** {{date}}'),
  P('**Classification:** Confidential. Prepared for the named airline only.'),
  gap(),
  callout([
    '**About this guide.** It explains how the SYSVERAX platform works internally: how disruptions enter the system, how hotels are found and allocated, how bookings are confirmed, and how the airline wallet, credit limit and service fee are controlled. Section 12 lists the commercial parameters specific to {{airline}}, and Section 14 answers the questions airlines most often ask.'
  ]),
  gap(),
  new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: 'Contents', bold: true, size: 26, color: NAVY })] }),
  ...['1. Overview', '2. Platform Architecture', '3. End-to-End Disruption Workflow', '4. Receiving Disruptions: API Integration', '5. Manual Disruption Handling', '6. Airport-Based Hotel Search', '7. Passenger Grouping & Room Allocation', '8. Booking, Vouchers, Amendments & Cancellations', '9. Wallet, Credit Limit & Service Fee', '10. Security & Passenger Privacy', '11. Users, Roles & Permissions', '12. Airline-Specific Configuration Schedule', '13. Onboarding & Implementation', '14. Frequently Asked Questions', '15. Glossary', 'Appendix A. Indicative API Payload', 'Appendix B. Illustrative Hotel Allocation Summary']
    .map(x => new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: x, color: GREY })] })),
  new Paragraph({ children: [new PageBreak()] })
);

// 1
c.push(H1('1. Overview'),
  P('SYSVERAX is a B2B platform that helps airlines arrange hotel accommodation for passengers affected by flight disruptions such as cancellations, long delays and missed connections. It brings the steps that are usually handled by phone, email and spreadsheets into one controlled workflow.'),
  P('The platform covers:'),
  B('Receiving disruption information, automatically by API or manually through the airline portal'),
  B('Managing affected flights, PNRs and passengers'),
  B('Searching hotels around the affected airport and comparing rooms and rates'),
  B('Allocating passengers to hotels and rooms'),
  B('Checking wallet and credit capacity, then confirming the booking'),
  B('Issuing hotel confirmations and vouchers'),
  B('Handling amendments and cancellations'),
  B('Managing airline users, permissions and booking-level financial visibility'),
  P('Automated and manual workflows use the same underlying disruption record, so an airline can switch between them at any time. If an integration is unavailable, operations continue through the portal.', { spacing: { before: 100, after: 120 } })
);

// 2
c.push(H1('2. Platform Architecture'),
  P('SYSVERAX is organised into logical modules. Each has a single responsibility, and each applies the same access and audit controls.'),
  tbl(['Module', 'What it does'], [
    ['Airline Portal', 'Web interface for airline users: dashboard, disruptions, PNRs, hotel search, allocation, bookings, wallet and user management.'],
    ['Integration API', 'Secure API through which the airline system sends disruption and passenger data and receives status, booking and voucher information.'],
    ['Disruption Engine', 'Creates and updates disruption events, links flights, PNRs and passengers, and tracks each disruption through its lifecycle.'],
    ['Passenger & PNR Manager', 'Stores only the passenger data needed for accommodation and derives room and occupancy requirements.'],
    ['Hotel Search & Supplier Layer', 'Resolves the airport location, searches connected hotel suppliers within the configured radius, and normalises availability, room types, meal plans, rates, taxes and cancellation terms.'],
    ['Allocation Engine', 'Automatically assigns passengers and PNR groups to hotels and rooms using AI-assisted allocation and hard business-rule checks (capacity, inventory, one hotel per booking), then shows the completed allocation and cost.'],
    ['Booking Orchestrator', 'Runs the confirmation sequence: validate, check finances, reserve funds, book with the supplier, record the result, issue the voucher.'],
    ['Finance Engine', 'Maintains the wallet and credit ledger, applies the service fee, enforces the credit limit and records every transaction.'],
    ['Identity & Access', 'Authentication, two-factor authentication, role-based permissions, airline-level data separation and audit logging.'],
    ['Notifications & Documents', 'Generates confirmations and vouchers and sends status notifications to authorised users.']
  ], [2400, 6626]),
  gap(),
  P('**Data separation.** Every record (disruption, passenger, booking, transaction, user) belongs to one airline account. A user from one airline cannot see or retrieve another airline\'s data.')
);

// 3
c.push(H1('3. End-to-End Disruption Workflow'),
  tbl(['Step', 'Stage', 'What happens'], [
    ['1', 'Disruption received', 'Created via API from the airline system or entered manually by an authorised user.'],
    ['2', 'Passengers identified', 'Affected PNRs and passengers are attached to the disruption.'],
    ['3', 'Requirements derived', 'Number of rooms, occupancy and nights are determined or entered.'],
    ['4', 'Airport resolved', 'The airport\'s coordinates are identified for the search.'],
    ['5', 'Hotels searched', 'Hotels within the configured radius ({{radius}} by default) are searched across connected suppliers.'],
    ['6', 'Hotels shortlisted', 'The allocation engine automatically evaluates distance, room type, meal plan, rate, taxes and cancellation terms for each passenger group.'],
    ['7', 'Passengers allocated', 'The system (AI-assisted) automatically assigns passengers to hotels and rooms based on occupancy, availability and travel class.'],
    ['8', 'Financial check', 'The system confirms the total payable (hotel cost plus service fee) fits within the available capacity: wallet balance plus credit limit, less any locked amount.'],
    ['9', 'Booking confirmed', 'The booking is placed with the supplier and the result is recorded.'],
    ['10', 'Confirmation & voucher', 'Documents are generated and made available to authorised users.'],
    ['11', 'Amend / cancel', 'Changes or cancellations are processed where the hotel terms permit.'],
    ['12', 'Transaction recorded', 'All financial movements are written to the ledger for reporting and reconciliation.']
  ], [800, 2200, 6026]),
  gap(),
  H2('Disruption status lifecycle'),
  P('Each disruption moves through clear statuses so teams always know where it stands: **Created → Passengers added → Hotels searched → Allocated → Booked → Completed**, with **Amended** and **Cancelled** as possible states for individual bookings.')
);

// 4
c.push(H1('4. Receiving Disruptions: API Integration'),
  P('The integration is designed to let {{airline}}\'s system push disruption information to SYSVERAX as soon as a disruption is declared. The exact specification is agreed with the airline\'s technical team during onboarding.'),
  H2('Data the airline can send'),
  B('Flight number, flight date, departure and arrival airports, scheduled times'),
  B('Disruption type and number of affected passengers'),
  B('PNR references and the passenger details needed for accommodation'),
  B('Room and occupancy requirements, and any special requirements'),
  H2('Data SYSVERAX returns'),
  B('Disruption status and hotel availability'),
  B('Allocation and booking status, confirmation and voucher information'),
  B('Amendment and cancellation status'),
  B('Financial information where applicable (booking amount, fee, wallet and credit position)'),
  H2('Technical design points'),
  B('**Transport:** HTTPS/TLS with JSON payloads.'),
  B('**Authentication:** {{apiAuthMethod}}.'),
  B('**Delivery model:** the airline pushes events to SYSVERAX. {{apiDeliveryModel}}'),
  B('**Idempotency:** each disruption carries an airline reference so a resent message updates the existing event rather than creating a duplicate.'),
  B('**Updates:** later messages can add passengers or change requirements on an existing disruption.'),
  B('**Sandbox:** {{apiSandbox}} for the airline\'s technical team.'),
  P('An indicative payload is shown in Appendix A.', { spacing: { before: 100, after: 120 } }),
  callout(['**If the airline has no API available yet,** disruptions can be started manually in the portal (Section 5) while the integration is built. Nothing needs to change in how bookings are confirmed.'])
);

// 5
c.push(H1('5. Manual Disruption Handling'),
  P('Authorised airline users can run the entire process through the portal when no integration exists, when it is temporarily unavailable, or when a disruption needs correcting or extending.'),
  tbl(['Capability', 'Detail'], [
    ['Create disruption', 'Enter flight details, airport, disruption type and date.'],
    ['Add PNRs and passengers', 'Add or edit one by one. {{bulkUploadSupport}}'],
    ['Define requirements', 'Rooms, occupancy, nights and special requirements.'],
    ['Allocate hotels', 'Trigger the automatic hotel search and allocation (evaluating distance, room type, meal plan, rate, taxes and cancellation terms), then review the completed booking and cost.'],
    ['Documents', 'Open or download confirmations and vouchers.'],
    ['Change or cancel', 'Amend or cancel bookings where permitted by hotel terms and user permissions.']
  ], [2600, 6426]),
  gap(),
  P('Hotel allocation itself is automatic, so there is no manual hotel-by-hotel approval step. The permission model (Section 11) still lets {{airline}} separate duties operationally, for example one team manages disruptions and passengers while another handles payment and publishing.')
);

// 6
c.push(H1('6. Airport-Based Hotel Search'),
  P('When a disruption is created, SYSVERAX identifies the airport\'s geographical coordinates and searches connected hotel suppliers for properties within a configurable radius. The default for {{airline}} is **{{radius}}**.'),
  P('If the default radius does not return enough hotel rooms to cover every passenger group, the search automatically widens in steps and searches again, repeating until enough rooms are found or the radius reaches a maximum of **{{maxRadius}}** for {{airline}} - the search will not go beyond that distance.'),
  P('The allocation engine automatically evaluates:'),
  B('Distance from the airport'),
  B('Room availability, room type and occupancy'),
  B('Meal plan'),
  B('Rate, applicable taxes and charges'),
  B('Cancellation conditions'),
  B('Supplier source'),
  P('Availability and rates are supplier-provided and change in real time. Rates are re-confirmed with the supplier automatically at booking. If a rate has changed or a room is no longer available, no funds are committed for that booking and the allocation engine looks for an alternative automatically where possible.', { spacing: { before: 100, after: 120 } })
);

// 7
c.push(H1('7. Passenger Grouping & Room Allocation'),
  P('Disruptions often involve many PNRs with different party sizes. SYSVERAX is built to handle that in one event; for example, a single flight with 15 PNRs and 30+ passengers across several hotels.'),
  P('The allocation engine automatically takes into account:'),
  B('Passengers per PNR and PNR grouping'),
  B('Adults and children where applicable'),
  B('Room requirements, number of rooms and occupancy'),
  B('Hotel availability, rate and location'),
  P('Once the booking is made, the airline sees the full allocation and cost: hotel cost, service fee and total payable. A worked illustration is in Appendix B.', { spacing: { before: 100, after: 120 } })
);

// 8
c.push(H1('8. Booking, Vouchers, Amendments & Cancellations'),
  H2('Confirmation sequence'),
  tbl(['#', 'Action'], [
    ['1', 'Validate the allocation and re-check live availability and rate with the supplier.'],
    ['2', 'Calculate hotel cost, service fee and total payable.'],
    ['3', 'Check available capacity (wallet balance plus credit limit, less locked amounts) against the total payable (Section 9).'],
    ['4', 'Reserve (lock) the amount so concurrent bookings cannot overspend it.'],
    ['5', 'Place the booking with the hotel supplier.'],
    ['6', 'On success, record the booking and finalise the financial entry. On failure, release the lock.'],
    ['7', 'Generate the confirmation and voucher.']
  ], [800, 8226]),
  gap(),
  H2('Amendments and cancellations'),
  P('Amendments and cancellations are available to users with the right permissions, subject to each hotel\'s terms. Every change is recorded against the original booking, and the financial effect (including treatment of the service fee) follows the policy in Section 12.'),
  H2('Vouchers'),
  P('Hotel confirmations and vouchers are available to authorised users in the portal and, where integrated, through the API.')
);

// 9
c.push(H1('9. Wallet, Credit Limit & Service Fee'),
  H2('9.1 Airline wallet'),
  P('Each airline has a dedicated wallet. The airline tops it up in advance and bookings draw against it. Balances, pending amounts and transactions are visible in real time.'),
  H2('9.2 Credit limit'),
  P('SYSVERAX may extend an approved credit limit so that bookings can proceed once the prepaid wallet balance is used up. The credit limit for {{airline}} is **{{creditLimit}}**. Once bookings exceed the prepaid balance, the wallet balance itself goes negative by the amount drawn from this credit line - there is no separate "used credit" figure to track elsewhere; the balance is always the single source of truth. It is set per airline and can be changed by agreement.'),
  H2('9.3 Service fee'),
  P('The SYSVERAX service fee is **{{feePct}}** of the applicable hotel booking cost. It is shown on every booking before confirmation.'),
  callout([
    '**Total payable = Hotel booking cost + (Hotel booking cost × {{feePct}})**',
    `Example: ${money(ex1.H)} + ${money(ex1.fee)} = **${money(ex1.T)}**`
  ]),
  gap(),
  H2('9.4 The financial check'),
  P('Before every booking is confirmed, the system calculates:'),
  callout([
    '**Available capacity = Wallet balance + Credit limit − Locked amount**',
    '**A booking is permitted only if Total payable ≤ Available capacity.**'
  ]),
  gap(),
  P('The wallet balance can be positive (prepaid funds not yet used) or negative (credit already drawn against the limit) - either way, the formula above is the same. The fee is included in the total payable, so the check always covers hotel cost plus service fee. Available capacity can never exceed wallet balance plus the approved credit limit.'),
  H2('9.5 Worked examples'),
  P(`These examples use {{airline}}'s configured credit limit ({{creditLimit}}) and service fee ({{feePct}}).`),
  tbl(['Item', 'Example A: approved', 'Example B: declined'], [
    ['Wallet balance', money(exA.W), money(exB.W)],
    ['Approved credit limit', money(L), money(L)],
    ['Locked amount (other pending bookings)', money(exA.locked), money(exB.locked)],
    ['**Available capacity**', `**${money(exA.cap)}**`, `**${money(exB.cap)}**`],
    ['Hotel booking cost', money(exA.H), money(exB.H)],
    ['Service fee ({{feePct}})', money(exA.fee), money(exB.fee)],
    ['**Total payable**', `**${money(exA.T)}**`, `**${money(exB.T)}**`],
    ['**Result**', exA.T <= exA.cap ? '**Permitted**' : '**Not permitted**', exB.T <= exB.cap ? '**Permitted**' : '**Not permitted**']
  ], [3200, 2913, 2913], { right: [1, 2] }),
  gap(),
  P(`In Example B the wallet balance is already negative - ${money(exB.W)} - meaning bookings have drawn that much against the credit limit, leaving only ${money(exB.cap)} of available capacity. The total payable of ${money(exB.T)} exceeds that, so the booking cannot be confirmed until the airline tops up the wallet, pays down the outstanding balance, or obtains an approved increase to the credit limit.`),
  H2('9.6 What the airline can see'),
  B('Wallet balance (which can be negative once credit is drawn), credit limit and locked amounts'),
  B('Top-ups, bookings, fees, refunds, and settlements'),
  B('Booking-level hotel cost, fee and total')
);

// 10
c.push(H1('10. Security & Passenger Privacy'),
  P('Passenger and booking information is treated as confidential and is available only to authorised users of the owning airline.'),
  tbl(['Control', 'Description'], [
    ['Encrypted transport', 'All communication uses HTTPS/TLS.'],
    ['Authentication & 2FA', 'Username/password plus two-factor authentication for portal users.'],
    ['Role-based access', 'Permissions are granted by role on a least-privilege basis.'],
    ['Airline data separation', 'Each airline\'s data is isolated to its own account.'],
    ['Secrets management', 'Credentials and API secrets are stored and handled securely.'],
    ['Database & cloud controls', 'Access restrictions on databases and cloud infrastructure.'],
    ['Audit visibility', 'Key actions are logged where applicable.']
  ], [2600, 6426]),
  gap(),
  H2('Data minimisation'),
  P('Only the passenger data needed to arrange accommodation is exchanged. The airline and SYSVERAX agree the exact fields during integration. Passenger details are shared with hotels and suppliers only to the extent required to make and honour the booking.'),
  // // TODO: Please uncomment if needed
  // H2('Items provided in the security pack'),
  // B('Hosting provider and region: {{hostingRegion}}'),
  // B('Encryption at rest: {{encryptionAtRest}}'),
  // B('Certifications or independent audits (for example ISO 27001, SOC 2, penetration test): {{certifications}}'),
  // B('Data protection terms and DPA (for example where GDPR applies): {{dpaTerms}}'),
  // B('Retention and deletion periods: {{retentionPeriod}}'),
  // B('Breach notification process and timelines: {{breachNotification}}')
);

// 11
c.push(H1('11. Users, Roles & Permissions'),
  P('The airline administrator invites users and assigns permissions. Permissions can be set per function: disruption management, passenger management, hotel search, allocation, booking, amendments, cancellations, financial information, wallet management and administration.'),
  P('Typical role setups (fully configurable):'),
  tbl(['Role', 'Typical access'], [
    ['Airline Administrator', 'Manage users and permissions; all operational and financial views.'],
    ['Operations Controller', 'Create disruptions, manage passengers, search, allocate, confirm, amend, cancel.'],
    ['Passenger Services / Support', 'Manage passengers and allocations. No financial or administrative access.'],
    ['Finance', 'Wallet, top-ups, transactions, fees and reports. No passenger editing.'],
    ['Read-only / Auditor', 'View disruptions, bookings and reports only.']
  ], [3000, 6026])
);

// 12
c.push(H1('12. Airline-Specific Configuration Schedule'),
  P('The platform is configured per airline. The values below apply to **{{airline}}**.'),
  tbl(['Parameter', 'Description', 'Value for {{airline}}'], [
    ['Service fee', 'Percentage of hotel booking cost charged by SYSVERAX', '{{feePct}}'],
    ['Fee basis', 'What the percentage is applied to', '{{feeBasis}}'],
    ['Credit limit', 'Maximum approved outstanding credit exposure', '{{creditLimit}}'],
    ['Currency', 'Wallet and billing currency', '{{currency}}'],
    ['Minimum wallet top-up', 'Smallest permitted top-up', '{{minTopUp}}'],
    ['Fund drawdown order', 'Order in which wallet and credit are consumed', '{{fundDrawdownOrder}}'],
    ['Hotel search radius', 'Default distance from the airport', '{{radius}}'],
    ['Maximum hotel search radius', 'Cap the search widens to if the default radius has too few rooms', '{{maxRadius}}'],
    ['Cancellation / amendment fee treatment', 'How the service fee is treated when bookings change or are cancelled', '{{cancellationFeeTreatment}}'],
    ['No-show treatment', 'How hotel no-show charges and the fee are handled', '{{noShowTreatment}}'],
    ['Taxes on the fee', 'VAT or other taxes applicable to the service fee', '{{taxOnFee}}'],
    ['Invoicing & settlement terms', 'Invoice frequency, payment terms, settlement method', '{{invoicingTerms}}'],
    ['Integration mode', 'API, manual portal, or both', '{{integrationMode}}'],
    ['Two-factor authentication', 'Required for portal users', 'Enabled'],
    ['Authorised users', 'Number of users and roles', '{{authorisedUsers}}']
  ], [2500, 3600, 2926]),
  gap(),
  P('Any change to the service fee or credit limit takes effect only after written agreement between SYSVERAX and {{airline}}. It applies to bookings confirmed after the change.')
);

// 13
c.push(H1('13. Onboarding & Implementation'),
  tbl(['Phase', 'Activities'], [
    ['1. Commercial setup', 'Agree the configuration schedule (Section 12), contract and credit approval.'],
    ['2. Account setup', 'Create the airline account, administrator and users; enable 2FA; set the wallet and credit limit.'],
    ['3. Technical integration', 'Agree API specification, authentication and data fields; test in sandbox; security review.'],
    ['4. Training & demo', 'Walk-through of the full workflow with operations, commercial, finance and technical teams.'],
    ['5. Pilot / go-live', '{{pilotApproach}}'],
    ['6. Support', '{{supportDetails}}']
  ], [2400, 6626])
);

// 14 FAQ
const qa = [
  ['How are disruptions fed to SYSVERAX automatically?', 'The airline\'s system sends the disruption (flight, airport, disruption type, affected PNRs and passengers, room requirements) to the SYSVERAX API over HTTPS. SYSVERAX creates or updates the disruption event and automatically searches, allocates and books hotels for the affected passengers; there is no manual hotel-by-hotel review or approval step. The airline can then view the completed booking, process payment and publish confirmations to passengers. The specification, authentication method and fields are agreed with the airline\'s technical team.'],
  ['What if our system cannot send data automatically?', 'Authorised users can create and manage disruptions directly in the portal. Manual and API workflows use the same records, so the airline can move between them at any time.'],
  ['How does hotel search work?', 'SYSVERAX takes the coordinates of the disrupted airport and searches connected suppliers within the configured radius ({{radius}} by default). If that radius does not return enough rooms, the search automatically widens in steps, up to a maximum of {{maxRadius}}. Results show distance, room types, meal plans, rates, taxes and cancellation terms.'],
  ['Are the displayed rates guaranteed?', 'Rates and availability come from suppliers and can change. They are re-confirmed automatically at the moment of booking. If a rate has changed or a room is no longer available, no funds are committed for that booking and the system looks for an alternative automatically where possible.'],
  ['How are passengers grouped into rooms?', 'Passengers are managed per PNR with their occupancy requirements. SYSVERAX\'s allocation engine automatically assigns PNRs and passengers to rooms and hotels based on occupancy and hotel availability, and the airline sees the complete allocation and cost once the booking is made.'],
  ['Who can see our passengers\' information?', 'Only authorised users of {{airline}}, according to the permissions assigned by the airline administrator. Data is separated per airline. Access uses authentication and two-factor authentication.'],
  ['What passenger data is shared with hotels?', 'Only what is needed to make and honour the booking. The airline and SYSVERAX agree the exact fields during integration.'],
  // // TODO: Consider adding more detailed security and compliance questions if needed.
  // ['Where is our data hosted and what certifications do you hold?', 'Hosted in {{hostingRegion}}, with {{encryptionAtRest}}. Certifications and audits held: {{certifications}}.'],
  ['How long is passenger data retained?', 'Retention and deletion periods: {{retentionPeriod}} Breach notification process: {{breachNotification}}'],
  ['What is your experience providing this service to airlines?', '{{companyExperience}}'],
  ['How is the {{feePct}} service fee applied?', 'The fee is {{feePct}} of the applicable hotel booking cost. It is calculated per booking and shown before confirmation: hotel cost, service fee, total payable. For example, a hotel cost of ' + money(ex1.H) + ' carries a fee of ' + money(ex1.fee) + ', for a total of ' + money(ex1.T) + '. The fee basis and its treatment on taxes, amendments, cancellations and no-shows are set out in Section 12.'],
  ['Is the service fee included when the credit limit is checked?', 'Yes. The check is made against the total payable (hotel cost plus fee).'],
  ['How does the wallet work?', 'The airline tops up in advance. Confirmed bookings draw against the wallet balance; if a booking exceeds the prepaid balance, the balance goes negative by that amount, drawing on the approved credit limit. The airline can see the balance, credit limit, locked amounts and full transaction history at any time.'],
  ['What is our credit limit and can it change?', 'Your approved credit limit is {{creditLimit}}. It can be reviewed and changed by written agreement. A change applies to bookings confirmed after the change.'],
  ['What happens if a booking would exceed our limit?', 'It is not confirmed. The airline can top up the wallet, settle outstanding credit, or request an increase, and then proceed. No booking is placed with the hotel until the check passes.'],
  ['Can we amend or cancel a booking?', 'Yes, where hotel terms and the user\'s permissions allow. Each change is recorded against the original booking and the financial effect is posted to the ledger.'],
  ['What do we receive after booking?', 'A hotel confirmation and voucher available in the portal and, where integrated, through the API.'],
  ['Can we limit what our staff can do?', 'Yes. The administrator assigns permissions per user, for example allowing support staff to manage passengers and allocations without access to finance or administration.'],
  ['What do you need from us to integrate?', 'A technical contact, the data fields available from your disruption/reservation system, agreement on authentication and security requirements, and test data for the sandbox.'],
  ['How long does onboarding take?', '{{onboardingTimeline}} Manual portal use can begin as soon as the account, users and wallet are set up.'],
  ['What support is available during a disruption?', '{{supportDetails}}'],
  ['What reporting is available?', 'Booking-level hotel cost, fee and total; wallet and credit position; top-ups and settlements; transaction history.']
];
c.push(H1('14. Frequently Asked Questions'));
qa.forEach(([q, a]) => { c.push(Q(q)); c.push(P(a)); });

// 15
c.push(H1('15. Glossary'),
  tbl(['Term', 'Meaning'], [
    ['PNR', 'Passenger Name Record: the airline booking reference grouping one or more passengers.'],
    ['Disruption', 'An event such as a cancellation, long delay or missed connection requiring accommodation.'],
    ['Wallet', 'The airline\'s balance with SYSVERAX, topped up in advance. It can go negative, up to the approved credit limit, once bookings exceed the prepaid amount.'],
    ['Credit limit', 'The maximum approved outstanding credit exposure for the airline.'],
    ['Locked amount', 'Funds reserved for a booking in progress or pending.'],
    ['Available capacity', 'Wallet balance plus credit limit, less locked amounts.'],
    ['Service fee', 'SYSVERAX\'s percentage of the hotel booking cost.'],
    ['Voucher', 'Document presented to the hotel confirming the accommodation arrangement.'],
    ['2FA', 'Two-factor authentication.'],
    ['DPA', 'Data Processing Agreement.']
  ], [2200, 6826])
);

// Appendix A
c.push(new Paragraph({ children: [new PageBreak()] }),
  H1('Appendix A. Indicative API Payload'),
  P('Illustrative only. The final specification is agreed with the airline\'s technical team.'),
  P('Per PNR, SYSVERAX maps the passenger counts and one lead passenger contact (not a full named roster) - this matches what is actually stored and used for hotel allocation. If children > 0, the number of child ages supplied must equal the children count; adults must be at least 1; the lead passenger\'s name, email and contact number are required. No other passenger details are mapped or stored.'),
  ...code([
    '{',
    '  "airlineReference": "DIS-2026-000123",',
    '  "flight": {',
    '    "number": "XX123",',
    '    "date": "2026-10-04",',
    '    "departureAirport": "AAA",',
    '    "arrivalAirport": "BBB",',
    '    "scheduledDeparture": "2026-10-04T18:30:00Z"',
    '  },',
    '  "disruption": { "type": "CANCELLED", "affectedPassengers": 32 },',
    '  "accommodation": { "airport": "BBB", "nights": 1 },',
    '  "pnrs": [',
    '    {',
    '      "pnr": "ABC123",',
    '      "adults": 2,',
    '      "children": 1,',
    '      "leadPassenger": {',
    '        "title": "MR",',
    '        "firstName": "JOHN",',
    '        "lastName": "SMITH",',
    '        "email": "john.smith@example.com",',
    '        "contact": "+1234567890"',
    '      },',
    '      "childrenAges": [8]',
    '    }',
    '  ]',
    '}'
  ])
);

// Appendix B
const rowsB = [
  { pnr: 'ABC106', adults: 4, children: 0, hotel: 'Hotel A', rooms: '2 Twin', cost: 380 },
  { pnr: 'ABC109', adults: 3, children: 2, hotel: 'Hotel B', rooms: '1 Double + 1 Triple', cost: 396 },
  { pnr: 'ABC113', adults: 3, children: 2, hotel: 'Hotel C', rooms: '1 Double + 1 Triple', cost: 490 },
  { pnr: 'ABC115', adults: 6, children: 0, hotel: 'Hotel C', rooms: '3 Twin', cost: 660 }
];
let sumH = 0;
const bodyB = rowsB.map(r => {
  sumH += r.cost;
  const pax = r.adults + r.children;
  const breakdown = r.children > 0 ? `${r.adults}A + ${r.children}C` : `${r.adults}A`;
  return [r.pnr, `${pax} (${breakdown})`, r.hotel, r.rooms, money(r.cost)];
});
const totalPax = rowsB.reduce((sum, r) => sum + r.adults + r.children, 0);
c.push(H1('Appendix B. Illustrative Hotel Allocation Summary'),
  P(`A hypothetical disruption with ${rowsB.length} PNRs and ${totalPax} passengers. Hotels and rates are illustrative.`),
  tbl(['PNR', 'Pax', 'Hotel', 'Rooms and type', 'Hotel cost'], bodyB, [1700, 1700, 1700, 2800, 1826], { right: [4] }),
  gap(),
  tbl(['Component', 'Amount'], [
    ['Hotel accommodation', money(sumH)],
    ['SYSVERAX service fee ({{feePct}})', money(sumH * f)],
    ['**Total payable**', `**${money(sumH * (1 + f))}**`]
  ], [6000, 3026], { right: [1] }),
  gap(),
  P('The total payable is then checked against the airline\'s available capacity (Section 9.4) before the booking is confirmed.'),
  gap(),
  new Paragraph({ spacing: { before: 300 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'C9D1D9', space: 8 } }, children: [new TextRun({ text: 'SYSVERAX (Pvt) Ltd', bold: true })] }),
  // P('Founder & CEO: Thanushanth Kanagarajah')
);

// ---------- document ----------
const doc = new Document({
  creator: 'SYSVERAX (Pvt) Ltd', title: 'SYSVERAX Airline Platform Guide',
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: NAVY, font: FONT }, paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 0, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, color: '2E5C8A', font: FONT }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1, keepNext: true } }
    ]
  },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1300, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'SYSVERAX  |  Airline Platform Guide', size: 17, color: GREY })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Confidential  |  Page ', size: 17, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 17, color: GREY })] })] }) },
    children: c
  }]
});
Packer.toBuffer(doc).then(b => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, b);
  console.log('wrote', OUT);
});
