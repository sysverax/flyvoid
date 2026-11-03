// Narration for the v1 explainer (marketing-mockups/exports/mp4/flyverax-explainer-*.mp4),
// one line per shot, timed to v1's shot list (marketing-mockups/lib/film.mjs).
//   at    when the line starts (video seconds)
//   until the line must be finished by then (sped up slightly if needed)
// The SMS/email line says "Coming soon": those features are not live, so the narration
// must not present them as live (the v1 picture carries the "Concept preview" label).
export const LINES = [
  { id: "departures", at: 0.3, until: 4.7, text: "When a flight is cancelled, hundreds of passengers need a hotel. Tonight." },
  { id: "stranded", at: 4.95, until: 8.4, text: "Passengers are stranded, and airline teams scramble:" },
  { id: "scramble", at: 8.7, until: 12.4, text: "phone calls, spreadsheets, and hotels filling up by the minute." },
  { id: "logo", at: 13.8, until: 15.9, text: "Meet Flyverax." },
  { id: "flow", at: 16.3, until: 23.2, text: "Upload the passenger list. Flyverax groups travellers, searches live hotel rates near the airport, and books the rooms." },
  { id: "notify", at: 23.45, until: 30.4, text: "Coming soon: every passenger gets their hotel confirmation by SMS and email." },
  { id: "rest", at: 30.9, until: 33.5, text: "From disruption to rest." },
  { id: "invoice", at: 33.9, until: 37.7, text: "And the airline gets one invoice per flight." },
  { id: "end", at: 38.1, until: 43.0, text: "Flyverax. Calm in every disruption. Request a demo at flyverax dot com." },
];

// Shot starts in v1 (for the whoosh at each cut) and notification moments (for the ping).
export const CUTS = [4.5, 8.5, 12.5, 16.1, 22.6, 30.6, 33.6, 37.8];
export const PINGS = [23.2, 25.5, 33.8];
export const DURATION = 43.3;
