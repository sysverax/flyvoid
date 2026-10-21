import type { DropdownOption } from "@/src/components/ui/Dropdown";

// Every IANA timezone the browser knows, e.g. "Asia/Colombo". The backend
// uses the stored value for date ranges, so it must be a real IANA name.
function listTimeZones(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  const zones = intl.supportedValuesOf?.("timeZone") ?? [];
  // Some engines leave "UTC" out of the list.
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

/** Current offset from UTC in minutes (east positive), DST included. */
function offsetMinutes(timeZone: string, now: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0; // "GMT" alone means +00:00
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const mins = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${mins}`;
}

/**
 * Timezone dropdown options, sorted by current offset then name:
 * value "America/New_York", label "(UTC-04:00) America/New York".
 */
export const TIMEZONE_OPTIONS: DropdownOption[] = (() => {
  const now = new Date();
  return listTimeZones()
    .map((zone) => ({ zone, offset: offsetMinutes(zone, now) }))
    .sort((a, b) => a.offset - b.offset || a.zone.localeCompare(b.zone))
    .map(({ zone, offset }) => ({
      value: zone,
      label: `(${formatOffset(offset)}) ${zone.replace(/_/g, " ")}`,
    }));
})();

export const DEFAULT_TIMEZONE = "UTC";

/**
 * Options for editing a saved value. A value that isn't an IANA name (older
 * records saved as "UTC+5:30" or "EST") is kept as a visible extra option,
 * so the form doesn't silently show a different timezone.
 */
export function timezoneOptionsWith(current?: string | null): DropdownOption[] {
  if (!current || TIMEZONE_OPTIONS.some((option) => option.value === current)) {
    return TIMEZONE_OPTIONS;
  }
  return [
    { value: current, label: `${current} (invalid, please reselect)` },
    ...TIMEZONE_OPTIONS,
  ];
}
