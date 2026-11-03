// Adds placeholder narration, a synthesised music bed and sound effects to the v1 explainer.
// All audio is generated locally (Windows text-to-speech, ffmpeg synthesis); replace it with a
// recorded voiceover and a licensed track before publishing.
// Usage: node make.mjs
import { mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LINES, CUTS, PINGS, DURATION } from "./lines.mjs";
// Same mixer as v2: music under the voice and ducked, effects, fades, -14 LUFS.
import { buildSoundtrack } from "../explainer-v2/lib/audio.mjs";
import { ffmpeg, duration, probe, loudness } from "../explainer-v2/lib/ff.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(HERE, "build");
const OUT = path.join(HERE, "exports");
const V1 = path.join(HERE, "..", "marketing-mockups", "exports", "mp4");
const MAX_TEMPO = 1.3;
mkdirSync(path.join(BUILD, "vo"), { recursive: true });
mkdirSync(OUT, { recursive: true });

// ── Narration ────────────────────────────────────────────────────────────────
const placed = [];
for (const line of LINES) {
  const raw = path.join(BUILD, "vo", `${line.id}-raw.wav`);
  const fit = path.join(BUILD, "vo", `${line.id}.wav`);
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(HERE, "tts.ps1"), "-Text", line.text, "-Out", raw]);
  // Trim leading/trailing silence, then speed up only if the line overruns its slot.
  const trimmed = path.join(BUILD, "vo", `${line.id}-trim.wav`);
  await ffmpeg(["-i", raw, "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse", trimmed]);
  const len = duration(trimmed);
  const slot = line.until - line.at;
  const tempo = Math.max(1, len / slot);
  if (tempo > MAX_TEMPO) console.warn(`  ${line.id}: needs ${tempo.toFixed(2)}x to fit; capped at ${MAX_TEMPO}x, it will overrun by ${(len / MAX_TEMPO - slot).toFixed(2)} s`);
  await ffmpeg(["-i", trimmed, "-af", `atempo=${Math.min(tempo, MAX_TEMPO).toFixed(3)},aresample=48000`, "-ac", "1", fit]);
  placed.push({ ...line, file: fit, len: duration(fit), tempo });
}
const voiceover = path.join(BUILD, "voiceover.wav");
await ffmpeg([
  ...placed.flatMap((p) => ["-i", p.file]),
  "-filter_complex",
  `${placed.map((p, i) => `[${i}:a]adelay=${Math.round(p.at * 1000)}:all=1[d${i}]`).join(";")};${placed.map((_, i) => `[d${i}]`).join("")}amix=inputs=${placed.length}:normalize=0,apad=whole_dur=${DURATION},atrim=0:${DURATION}[v]`,
  "-map", "[v]", "-ac", "2", voiceover,
]);

// ── Music: a slow, calm pad (Fmaj7 - C/E - Am7 - G, 6 s each), lightly detuned for width ──
const CHORDS = [
  [174.61, 220.0, 261.63, 329.63],
  [164.81, 196.0, 261.63, 392.0],
  [110.0, 164.81, 196.0, 261.63],
  [98.0, 146.83, 246.94, 293.66],
];
const music = path.join(BUILD, "music.wav");
if (!existsSync(music)) {
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const notes = CHORDS[i % 4];
    const ch = (detune) => notes.map((f, j) => `${j === 0 ? 0.9 : 0.55}*sin(2*PI*${(f * detune).toFixed(3)}*t)`).join("+");
    const file = path.join(BUILD, `chord${i}.wav`);
    await ffmpeg([
      "-f", "lavfi", "-i", `aevalsrc=0.06*(${ch(1)})*(0.85+0.15*sin(2*PI*0.2*t))|0.06*(${ch(1.003)})*(0.85+0.15*sin(2*PI*0.23*t)):s=48000:d=7`,
      "-af", "afade=t=in:d=1.6,afade=t=out:st=4.8:d=2.2", file,
    ]);
    parts.push(file);
  }
  // Overlap the chords by 1 s, soften the top, add a little room.
  const graph = parts.slice(1).reduce((acc, _, i) => `${acc}${i === 0 ? "[0:a]" : `[x${i}]`}[${i + 1}:a]acrossfade=d=1:c1=tri:c2=tri[x${i + 1}];`, "");
  await ffmpeg([...parts.flatMap((p) => ["-i", p]), "-filter_complex", `${graph}[x${parts.length - 1}]lowpass=f=2400,aecho=0.8:0.6:140|290:0.3|0.2[m]`, "-map", "[m]", music]);
}

// ── Effects ──────────────────────────────────────────────────────────────────
const whoosh = path.join(BUILD, "whoosh.wav");
const ping = path.join(BUILD, "ping.wav");
await ffmpeg(["-f", "lavfi", "-i", "anoisesrc=d=0.8:c=pink:a=0.6:r=48000", "-af", "highpass=f=500,lowpass=f=5000,afade=t=in:d=0.45:curve=qsin,afade=t=out:st=0.45:d=0.35", whoosh]);
await ffmpeg(["-f", "lavfi", "-i", "aevalsrc=0.35*(sin(2*PI*1046.5*t)+0.5*sin(2*PI*1568*t))*exp(-7*t):s=48000:d=0.7", ping]);

// ── Mix and mux ──────────────────────────────────────────────────────────────
const timeline = {
  duration: DURATION,
  voiceClips: [{ from: 0, to: DURATION, at: 0 }],
  scenes: [{ start: 0, pings: PINGS }, ...CUTS.map((c) => ({ start: c + 0.15 }))],
};
const soundtrack = path.join(BUILD, "soundtrack.wav");
const mix = await buildSoundtrack(timeline, { voiceover, music, sfx: { ping, whoosh } }, soundtrack);
console.log(`Soundtrack: ${mix.used.join("; ")}; ${mix.lufs} LUFS, peak ${mix.peak} dBFS`);

for (const format of ["16x9", "9x16"]) {
  const video = path.join(V1, `flyverax-explainer-${format}.mp4`);
  const out = path.join(OUT, `flyverax-explainer-v1.1-placeholder-audio-${format}.mp4`);
  await ffmpeg(["-i", video, "-i", soundtrack, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);
  const info = probe(out);
  const a = info.streams.find((s) => s.codec_type === "audio");
  const v = info.streams.find((s) => s.codec_type === "video");
  const { lufs } = await loudness(out);
  console.log(`${path.relative(HERE, out)}: ${v.width}x${v.height}, ${Number(info.format.duration).toFixed(2)} s, audio ${a?.codec_name ?? "MISSING"}, ${lufs} LUFS`);
}
console.log(placed.map((p) => `  ${p.id}: ${p.len.toFixed(2)} s in a ${(p.until - p.at).toFixed(2)} s slot${p.tempo > 1 ? ` (sped up ${p.tempo.toFixed(2)}x)` : ""}`).join("\n"));
