// Exports one PNG per screen to exports/png/.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { buildPage } from "../lib/scenes.mjs";
import { sms } from "../lib/templates.mjs";
import { SHOW_CONCEPT_LABEL } from "../config.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "exports", "png");

// [file, scene, time to freeze at, stage width, stage height]
const STILLS = [
  ["01-lock-screen-sms.png", "lock-sms", 3, 1080, 1350],
  ["02-sms-conversation.png", "sms-chat", 0, 1080, 1350],
  ["03a-email-notification.png", "lock-email", 6, 1080, 1350],
  ["03b-email-open.png", "email-open", 0, 1080, 1350],
  ["04-airline-invoice-email.png", "invoice", 5, 1920, 1200],
];

const { length, segments } = sms();
console.log(`SMS: ${length} characters, ${segments} segment(s). Concept label: ${SHOW_CONCEPT_LABEL ? "on" : "off"}`);

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [file, scene, t, width, height] of STILLS) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.setContent(buildPage(scene, width, height), { waitUntil: "load" });
  await page.evaluate((time) => window.setTime(time), t);
  await page.screenshot({ path: path.join(OUT, file) });
  await page.close();
  console.log(`  exports/png/${file}`);
}
await browser.close();
