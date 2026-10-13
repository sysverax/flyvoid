import {
  isISO31661Alpha2,
  ValidateBy,
  ValidationOptions,
} from "class-validator";

/** Reserved codes that belong to an official ISO country. */
const SAME_AS: Record<string, string> = {
  AC: "SH", // Ascension Island → Saint Helena, Ascension and Tristan da Cunha
  TA: "SH", // Tristan da Cunha → Saint Helena, Ascension and Tristan da Cunha
};

/** Kosovo has no official ISO code; XK is the code passports and airlines use. */
const ACCEPTED_NON_ISO = new Set(["XK"]);

/** Common names that differ from the English ISO short name. */
const ALIASES: Record<string, string> = {
  uk: "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  usa: "US",
  "united states of america": "US",
  america: "US",
  uae: "AE",
  "russian federation": "RU",
  "south korea": "KR",
  "korea republic of": "KR",
  "republic of korea": "KR",
  "north korea": "KP",
  "czech republic": "CZ",
  holland: "NL",
  "the netherlands": "NL",
  "ivory coast": "CI",
  "cote divoire": "CI",
  turkey: "TR",
  vatican: "VA",
  "viet nam": "VN",
  "lao pdr": "LA",
  laos: "LA",
  macau: "MO",
  macao: "MO",
  "hong kong": "HK",
  myanmar: "MM",
  palestine: "PS",
  "democratic republic of the congo": "CD",
  "dr congo": "CD",
  "republic of the congo": "CG",
  burma: "MM",
  "east timor": "TL",
  swaziland: "SZ",
  "cape verde": "CV",
  kosovo: "XK",
  "ascension island": "SH",
  ascension: "SH",
  "tristan da cunha": "SH",
};

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/\s+/g, " ")
    .trim();

let codeByName: Map<string, string> | null = null;

function namesIndex(): Map<string, string> {
  if (codeByName) return codeByName;
  const display = new Intl.DisplayNames(["en"], { type: "region" });
  codeByName = new Map(
    Object.entries(ALIASES).map(([name, code]) => [normalize(name), code]),
  );
  for (let a = 65; a <= 90; a += 1) {
    for (let b = 65; b <= 90; b += 1) {
      const code = String.fromCharCode(a, b);
      if (!isISO31661Alpha2(code)) continue;
      const name = display.of(code);
      if (name && name !== code) codeByName.set(normalize(name), code);
    }
  }
  return codeByName;
}

/** Uppercases a 2-letter code and maps AC/TA to SH; null when it isn't a country we accept. */
export function normalizeCountryCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  const mapped = SAME_AS[code] ?? code;
  return isISO31661Alpha2(mapped) || ACCEPTED_NON_ISO.has(mapped)
    ? mapped
    : null;
}

/** Validates a code already passed through normalizeCountryCode. */
export function IsPassportCountry(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: "isPassportCountry",
      validator: {
        validate: (value: unknown) =>
          typeof value === "string" && normalizeCountryCode(value) === value,
        defaultMessage: () => "residency must be a 2-letter country code",
      },
    },
    validationOptions,
  );
}

/**
 * Accepts a 2-letter code ("US"), an English country name ("United States")
 * or both ("United States (US)") and returns the ISO 3166-1 alpha-2 code,
 * or null when it can't be matched exactly.
 */
export function toCountryCode(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  const inParens = /\(([A-Za-z]{2})\)\s*$/.exec(text)?.[1];
  const candidate = inParens ?? text;
  const code = candidate.length === 2 ? normalizeCountryCode(candidate) : null;
  return code ?? namesIndex().get(normalize(text)) ?? null;
}
