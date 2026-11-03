// Exports the full explainer video to exports/mp4/flyverax-explainer-{16x9,9x16}.mp4
// (30 fps, no audio) and one review frame per shot to exports/png/film/.
// Usage: node scripts/render-film.mjs [16x9|9x16]   (both formats when omitted)
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import ffmpegPath from "ffmpeg-static";
import { SHOTS, FILM_DURATION, buildShotPage } from "../lib/film.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MP4 = path.join(ROOT, "exports", "mp4");
const PNG = path.join(ROOT, "exports", "png", "film");
const FPS = 30;
const ALL_FORMATS = { "16x9": [1920, 1080], "9x16": [1080, 1920] };
const only = process.argv[2];
const formats = Object.entries(ALL_FORMATS).filter(([name]) => !only || name === only);

// Review frame for each shot: late enough that its animation has played.
const REVIEW_AT = { departures: 3.6, stranded: 3.2, scramble: 3.2, logo: 3.4, flow: 6.3, sms: 2.2, email: 2.8, "email-open": 2.3, rest: 2.6, invoice: 4.0, end: 5.3 };

mkdirSync(MP4, { recursive: true });
mkdirSync(PNG, { recursive: true });
console.log(`Film: ${SHOTS.length} shots, ${FILM_DURATION.toFixed(1)} s`);

const browser = await chromium.launch();
for (const [format, [width, height]] of formats) {
  const file = path.join(MP4, `flyverax-explainer-${format}.mp4`);
  const proc = spawn(ffmpegPath, [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-an", file,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolve, reject) =>
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))),
  );

  const page = await browser.newPage({ viewport: { width, height } });
  for (const [index, shot] of SHOTS.entries()) {
    await page.setContent(buildShotPage(shot, width, height), { waitUntil: "load" });
    const frames = Math.round(shot.dur * FPS);
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t) => window.setTime(t), i / FPS);
      const png = await page.screenshot({ type: "png" });
      if (!proc.stdin.write(png)) await new Promise((r) => proc.stdin.once("drain", r));
    }
    await page.evaluate((t) => window.setTime(t), REVIEW_AT[shot.id] ?? shot.dur - 0.5);
    await page.screenshot({ path: path.join(PNG, `${format}-${String(index + 1).padStart(2, "0")}-${shot.id}.png`) });
    process.stdout.write(`  ${format} ${shot.id}\n`);
  }
  proc.stdin.end();
  await done;
  await page.close();
  console.log(`  exports/mp4/${path.basename(file)}`);
}
await browser.close();
