// Exports the animated clips to exports/mp4/ at 30 fps, 16:9 and 9:16, no audio.
// Each frame is a screenshot at an exact time, piped into ffmpeg, so motion is smooth and repeatable.
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import ffmpegPath from "ffmpeg-static";
import { buildPage } from "../lib/scenes.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "exports", "mp4");
const FPS = 30;

const FORMATS = { "16x9": [1920, 1080], "9x16": [1080, 1920] };

// A clip is a list of [scene, from, to] shots; times are clip seconds.
const CLIPS = {
  "phone-notification": [
    ["lock-sms", 0, 3.5],
    ["lock-email", 3.5, 6],
  ],
  "airline-invoice": [["invoice", 0, 5]],
};

// In 9:16 the whole laptop is too small to read, so frame the inbox list while the
// email arrives, then pan slowly to the reading pane as it opens (laptop x-coordinates).
const CAMERAS = {
  "airline-invoice-9x16": [
    { t: 0, x: 560, zoom: 1.9 },
    { t: 2.6, x: 560, zoom: 1.9 },
    { t: 3.8, x: 1010, zoom: 1.9 },
  ],
};

function ffmpeg(file, [width, height]) {
  const proc = spawn(ffmpegPath, [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-vf", `scale=${width}:${height}`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-an",
    file,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolve, reject) =>
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))),
  );
  return { stdin: proc.stdin, done };
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [clip, shots] of Object.entries(CLIPS)) {
  for (const [format, size] of Object.entries(FORMATS)) {
    const [width, height] = size;
    const file = path.join(OUT, `${clip}-${format}.mp4`);
    const encoder = ffmpeg(file, size);
    const page = await browser.newPage({ viewport: { width, height } });
    for (const [scene, from, to] of shots) {
      // Phones fill more of the tall frame; the laptop needs width.
      const camera = CAMERAS[`${clip}-${format}`] ?? null;
      await page.setContent(buildPage(scene, width, height, format === "9x16" ? 0.9 : 0.86, camera), {
        waitUntil: "load",
      });
      const frames = Math.round((to - from) * FPS);
      for (let i = 0; i < frames; i++) {
        await page.evaluate((t) => window.setTime(t), from + i / FPS);
        const png = await page.screenshot({ type: "png" });
        if (!encoder.stdin.write(png)) await new Promise((r) => encoder.stdin.once("drain", r));
      }
    }
    encoder.stdin.end();
    await encoder.done;
    await page.close();
    console.log(`  exports/mp4/${path.basename(file)}`);
  }
}
await browser.close();
