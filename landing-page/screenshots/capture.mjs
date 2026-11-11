// Captures marketing screenshots of the real Flyverax airline portal with fake data.
//
// Prerequisite: the airline portal dev server running against a fake API base:
//   cd frontend/airline && NEXT_PUBLIC_API_URL=http://api.mock/api/v1 npx next dev -p 3100
// Then:  node capture.mjs            (BASE_URL env var overrides http://localhost:3100)
//
// Every request to http://api.mock/** is answered from fixtures.mjs.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi, NOW, TIMEZONE, SESSION_USER } from "./fixtures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "../assets/screenshots");
const BASE_URL = process.env.BASE_URL || "http://localhost:3100";
const API_ORIGIN = "http://api.mock";
const CONFIRMATION_PREVIEW = path.resolve(HERE, "../../marketing-mockups/build/confirmation-preview.png");
const ONLY = process.argv.slice(2); // optional: capture only these names, e.g. 01-dashboard

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// Hide the Next.js dev indicator / overlay and toast popups.
const HIDE_CSS = `
  nextjs-portal, [data-nextjs-toast], [data-next-badge-root], #__next-build-watcher { display: none !important; }
  .Toastify { display: none !important; }
  /* Closed off-canvas drawers: their shadow bleeds onto the right edge. */
  .fixed.translate-x-full { visibility: hidden !important; }
  *, *::before, *::after { caret-color: transparent !important; }
`;

const unhandled = new Set();
const problems = [];

async function newContext(browser, state) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    timezoneId: TIMEZONE,
    locale: "en-US",
  });

  await context.addInitScript(
    ({ user, css }) => {
      try {
        sessionStorage.setItem("airline_current_user", JSON.stringify(user));
        sessionStorage.setItem("airline_access_token", "mock-access-token");
      } catch {}
      const inject = () => {
        if (document.getElementById("__shots_css")) return;
        const style = document.createElement("style");
        style.id = "__shots_css";
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inject);
      } else inject();
    },
    { user: SESSION_USER, css: HIDE_CSS },
  );

  await context.route(`${API_ORIGIN}/**`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS, body: "" });
    }
    const url = new URL(req.url());
    const res = handleApi(req.method(), url.pathname, url.searchParams, state);
    if (!res) {
      unhandled.add(`${req.method()} ${url.pathname}${url.search}`);
      return route.fulfill({
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "No fixture" }),
      });
    }
    return route.fulfill({
      status: res.status || 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify(res.body),
    });
  });

  return context;
}

async function newPage(context) {
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(NOW));
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  return page;
}

/** Waits until no spinners/skeletons/loading text are visible. */
async function waitForSettled(page, extraSelector) {
  if (extraSelector) await page.waitForSelector(extraSelector, { timeout: 30000 });
  await page.waitForFunction(
    () => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      };
      const busy = [...document.querySelectorAll(".animate-spin, .animate-pulse")].some(visible);
      const text = document.body?.innerText || "";
      return !busy && !/Loading/i.test(text);
    },
    null,
    { timeout: 30000 },
  );
  await page.evaluate(() => document.fonts?.ready);
  await page.mouse.move(2, 2);
  await page.waitForTimeout(2500); // let chart animations finish
}

/** Checks the rendered text for bad values and the old product name. */
async function audit(page, name) {
  const text = await page.evaluate(() => document.body.innerText);
  for (const bad of ["undefined", "NaN", "Invalid Date", "null"]) {
    if (new RegExp(`\\b${bad}\\b`).test(text)) problems.push(`${name}: page text contains "${bad}"`);
  }
  const fv = text.match(/.{0,40}fly\s?void.{0,40}/gi);
  if (fv) problems.push(`${name}: "FlyVoid" found in UI text: ${fv.join(" | ")}`);
  const fvAttr = await page.evaluate(() =>
    [...document.querySelectorAll("[alt],[title],[aria-label],img[src]")]
      .map((el) => [el.getAttribute("alt"), el.getAttribute("title"), el.getAttribute("aria-label"), el.getAttribute("src")].join(" "))
      .filter((s) => /fly\s?void/i.test(s)),
  );
  if (fvAttr.length) problems.push(`${name}: "FlyVoid" found in attributes: ${fvAttr.join(" | ")}`);
  const title = await page.title();
  if (/fly\s?void/i.test(title)) problems.push(`${name}: "FlyVoid" in document title: ${title}`);
}

/**
 * Marketing clean-up: the landing page does not discuss payments or pricing (that is for the
 * demo call), and passenger notifications are not live yet. Hide, never add or change, the UI
 * that shows them: the wallet balance, the platform fee card and the "Notify passengers" hint.
 */
async function hideForMarketing(page) {
  await page.evaluate(() => {
    const smallest = (re) =>
      [...document.querySelectorAll("body *")].filter(
        (el) => re.test(el.textContent?.trim() ?? "") && ![...el.children].some((c) => re.test(c.textContent?.trim() ?? "")),
      );
    // Wallet balance chip in the top bar: keep its space so the header does not shift.
    for (const label of smallest(/^wallet balance$/i)) {
      const chip = label.closest("button, a, [class*='rounded']") ?? label.parentElement;
      chip.style.visibility = "hidden";
    }
    // Dashboard "Platform Fee Rate" card: remove it and let the other cards fill the row.
    for (const label of smallest(/^platform fee rate$/i)) {
      let card = label;
      while (card.parentElement && !getComputedStyle(card.parentElement).display.includes("grid")) card = card.parentElement;
      const grid = card.parentElement;
      card.style.display = "none";
      if (grid) grid.style.gridTemplateColumns = `repeat(${grid.children.length - 1}, minmax(0, 1fr))`;
    }
    // Wizard step subtitle that suggests passenger notifications are live.
    for (const el of smallest(/^notify passengers$/i)) el.style.visibility = "hidden";
  });
}

async function shoot(page, name) {
  await hideForMarketing(page);
  await audit(page, name);
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  saved ${path.relative(process.cwd(), file)}`);
}

const SHOTS = {
  "01-dashboard": async (page) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await waitForSettled(page, "text=Hotel Spend Trend");
    // Switch the period from "Week" to "Year" for several months of data.
    await page.getByRole("button", { name: "Week" }).click();
    await page.getByText("Year", { exact: true }).last().click();
    await page.waitForSelector(".recharts-area-curve", { timeout: 30000 });
    await waitForSettled(page);
  },

  "02-cancelled-flights": async (page) => {
    await page.goto(`${BASE_URL}/cancelled-flight`, { waitUntil: "domcontentloaded" });
    await waitForSettled(page, "text=WA0021");
  },

  "03-create-cancelled-flight": async (page) => {
    // Step 1 of the wizard for a draft flight, so every field is filled in.
    await page.goto(`${BASE_URL}/cancelled-flight/1025/step-1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => [...document.querySelectorAll("input")].some((i) => i.value === "WA0063"),
      null,
      { timeout: 30000 },
    );
    await waitForSettled(page, "text=CDG - Paris Charles de Gaulle Airport");
  },

  "04-bookings-import": async (page, state) => {
    state.imported1024 = false;
    await page.goto(`${BASE_URL}/cancelled-flight/1024/step-2`, { waitUntil: "domcontentloaded" });
    await waitForSettled(page, "text=Bookings & Passengers");
    await page.getByRole("button", { name: "Upload CSV File" }).click();
    const csv = "pnr,firstName,lastName,email,phone,residency,travelClass,adults,children,childAges,specialNotes\n";
    await page.locator('input[type="file"]').setInputFiles({
      name: "WA0244_passenger_manifest.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await waitForSettled(page, "text=Failed Bookings (2)");
    // Show the upload result, the import banner and the failed rows together.
    await page.getByText("Upload complete.", { exact: false }).first().evaluate((el) => {
      const y = el.getBoundingClientRect().top + window.scrollY - 200;
      window.scrollTo(0, y);
    });
    await page.waitForTimeout(400);
  },

  "05-allocation": async (page) => {
    await page.goto(`${BASE_URL}/cancelled-flight/1023/step-4`, { waitUntil: "domcontentloaded" });
    await waitForSettled(page, "text=booking(s) confirmed");
    await page.getByText("Hotel Allocation", { exact: true }).first().evaluate((el) => {
      const y = el.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo(0, y);
    });
    await page.waitForTimeout(400);
  },

  "06-booking-summary": async (page) => {
    await page.goto(`${BASE_URL}/cancelled-flight/1021/step-5`, { waitUntil: "domcontentloaded" });
    await waitForSettled(page, "text=Booked Hotels");
    await page.waitForSelector("text=BOOKING-REF", { state: "attached", timeout: 2000 }).catch(() => {});
    // Frame the booked-hotels table; the cost, fee and discount cards above stay out of view.
    await page.getByText("Booked Hotels", { exact: true }).first().evaluate((el) => {
      const y = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo(0, y);
    });
    await page.waitForTimeout(400);
  },

  "07-wallet": async (page) => {
    await page.goto(`${BASE_URL}/wallet`, { waitUntil: "domcontentloaded" });
    await waitForSettled(page, "text=WTX-");
  },
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [name, run] of Object.entries(SHOTS)) {
      if (ONLY.length && !ONLY.includes(name)) continue;
      console.log(`- ${name}`);
      const state = {};
      const context = await newContext(browser, state);
      const page = await newPage(context);
      try {
        await run(page, state);
        await shoot(page, name);
      } catch (err) {
        problems.push(`${name}: FAILED ${err.message.split("\n")[0]}`);
        await page.screenshot({ path: path.join(OUT_DIR, `${name}.FAILED.png`) }).catch(() => {});
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  // Opt-in (COPY_CONFIRMATION=1): the current preview names a real hotel
  // ("Hotel Bachaumont"), so it must be re-rendered with a fictional hotel first.
  if (process.env.COPY_CONFIRMATION === "1" && (!ONLY.length || ONLY.includes("08-confirmation-pdf"))) {
    if (fs.existsSync(CONFIRMATION_PREVIEW)) {
      fs.copyFileSync(CONFIRMATION_PREVIEW, path.join(OUT_DIR, "08-confirmation-pdf.png"));
      console.log("- 08-confirmation-pdf (copied from marketing-mockups/build)");
    } else {
      console.log("- 08-confirmation-pdf skipped: confirmation-preview.png not found");
    }
  }

  if (unhandled.size) {
    console.log("\nUnhandled API requests (add fixtures):");
    for (const u of unhandled) console.log(`  ${u}`);
  }
  if (problems.length) {
    console.log("\nProblems:");
    for (const p of problems) console.log(`  ${p}`);
    process.exitCode = 1;
  } else {
    console.log("\nAll screenshots captured cleanly.");
  }
}

main();
