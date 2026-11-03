import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DATA } from "../config.mjs";

const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates");

// GSM-7 basic set: staying inside it keeps an SMS segment at 160 chars (70 otherwise).
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const SMS_MAX_CHARS = 320;

/** Replace {{name}} with DATA[name]; unknown placeholders are an error, not a silent blank. */
export function fill(text, data = DATA) {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (_, name) => {
    if (!(name in data)) throw new Error(`Unknown placeholder {{${name}}}`);
    return data[name];
  });
}

const load = (file) => readFileSync(path.join(TEMPLATES_DIR, file), "utf8").replace(/\r\n/g, "\n");

export function sms() {
  const text = fill(load("sms.txt")).trim();
  if (text.length > SMS_MAX_CHARS) {
    throw new Error(`SMS is ${text.length} characters (max ${SMS_MAX_CHARS})`);
  }
  const nonGsm = [...text].filter((c) => !GSM7.includes(c));
  if (nonGsm.length) {
    throw new Error(`SMS has non GSM-7 characters: ${[...new Set(nonGsm)].join(" ")}`);
  }
  return { text, length: text.length, segments: text.length <= 160 ? 1 : Math.ceil(text.length / 153) };
}

/**
 * "Header: value" lines up to the first blank line, then the body as paragraphs.
 * The last paragraph is the footer.
 */
export function email(file) {
  const raw = fill(load(file));
  const [head, ...rest] = raw.split(/\n\n/);
  const headers = Object.fromEntries(
    head.split("\n").map((line) => {
      const i = line.indexOf(":");
      return [line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()];
    }),
  );
  const paragraphs = rest.join("\n\n").trim().split(/\n\n+/).map((p) => p.trim());
  return { subject: headers.subject, preheader: headers.preheader, paragraphs };
}

/** A paragraph made only of "Label: value" lines is shown as a summary table. */
export const asRows = (paragraph) => {
  const lines = paragraph.split("\n");
  const rows = lines.map((line) => line.match(/^([A-Za-z][A-Za-z -]{0,24}):\s+(.+)$/));
  return rows.every(Boolean) ? rows.map((m) => [m[1], m[2]]) : null;
};
