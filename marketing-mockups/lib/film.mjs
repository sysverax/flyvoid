// The full explainer video: a list of shots, each its own page with window.setTime(u)
// in shot-local seconds. Captions replace a voiceover so the video works muted.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND, DATA, FILM } from "../config.mjs";
import { SCENES, DEVICE_SIZE, page, esc, pdfPreview, cameraScript } from "./scenes.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SYSVERAX_LOGO = `data:image/jpeg;base64,${readFileSync(path.join(ROOT, "assets", "sysverax-logo.jpg")).toString("base64")}`;

const PLANE = `<path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2.5 1.5V22l4-1 4 1v-1.5L13 19v-5.5l8 2.5z"/>`;
const planeIcon = (fill) => `<svg viewBox="0 0 24 24" fill="${fill}">${PLANE}</svg>`;
const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;

const DARK_BG = "radial-gradient(90% 80% at 50% 30%,#0E1D3D 0%,#060D1F 100%)";
const u = (n) => `calc(var(--u)*${n})`;

// ── Problem ──────────────────────────────────────────────────────────────────

function departuresBoard({ portrait }) {
  const rows = [
    ["21:10", DATA.flight_number, "New York JFK", "Boarding", 0.7],
    ["21:15", "WA0137", "Lisbon", "On time", 1.25],
    ["21:25", "WA0244", "Berlin", "On time", 1.6],
    ["21:30", "WA0310", "Madrid", "Delayed", 1.0],
    ["21:40", "WA0356", "Rome", "On time", 1.9],
    ["21:50", "WA0412", "Dublin", "Delayed", 2.2],
    ["22:05", "WA0498", "Vienna", "Delayed", null],
  ];
  const tone = (s) => (s === "Delayed" ? "amber" : "green");
  const body = `
  <div class="board" id="board">
    <div class="b-head"><span class="b-icon">${planeIcon(BRAND.cyan)}</span>Departures<span class="b-clock">21:05</span></div>
    <div class="b-row b-cols"><span>Time</span><span>Flight</span><span>Destination</span><span>Status</span></div>
    ${rows
      .map(
        ([time, flight, to, status, at], i) => `
    <div class="b-row ${i === 0 ? "hero" : ""}" ${at != null ? `data-at="${at}"` : ""}>
      <span>${time}</span><span class="fl">${flight}</span><span>${to}</span>
      <span class="st"><span class="face old ${tone(status)}">${status}</span><span class="face new red">Cancelled</span></span>
    </div>`,
      )
      .join("")}
  </div>`;
  const css = `
  body{background:${DARK_BG}}
  .board{position:absolute;left:50%;top:44%;width:${portrait ? 92 : 72}%;transform:translate(-50%,-50%);
    background:#0A1328;border:1px solid #1C2A4A;border-radius:${u(1)};padding:${u(1.3)} ${u(1.5)};
    box-shadow:0 30px 80px -20px rgba(0,0,0,.6);color:#E6ECF7;font-variant-numeric:tabular-nums}
  .b-head{display:flex;align-items:center;gap:${u(0.7)};font-size:${u(1.9)};font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding-bottom:${u(0.8)}}
  .b-icon svg{width:${u(1.8)};height:${u(1.8)};display:block}
  .b-clock{margin-left:auto;font-weight:600;color:#9FB0CF}
  .b-row{display:grid;grid-template-columns:${portrait ? "16% 22% 1fr 32%" : "13% 17% 1fr 26%"};align-items:center;
    padding:${u(0.62)} ${u(0.6)};border-top:1px solid #16233F;font-size:${u(portrait ? 1.45 : 1.3)};font-weight:500;border-radius:${u(0.3)}}
  .b-cols{font-size:${u(0.95)};color:#6F82A8;text-transform:uppercase;letter-spacing:.08em;border-top:none}
  .fl{color:${BRAND.cyan};font-weight:600}
  .st{position:relative;perspective:400px;height:${u(1.9)}}
  .face{position:absolute;left:0;top:0;padding:${u(0.2)} ${u(0.7)};border-radius:${u(0.3)};font-weight:600;backface-visibility:hidden;white-space:nowrap}
  .green{color:#7FD6A6;background:rgba(127,214,166,.10)}
  .amber{color:#F5C76B;background:rgba(245,199,107,.10)}
  .red{color:#FF7A7A;background:rgba(255,107,107,.16)}
  .new{opacity:0}
  .hero.lit{box-shadow:inset ${u(0.25)} 0 0 ${BRAND.cyan};background:rgba(0,174,239,.08)}
  `;
  const script = `
  const rows = [...document.querySelectorAll('.b-row[data-at]')];
  const board = document.getElementById('board');
  const hero = document.querySelector('.hero');
  window.setTime = (t) => {
    board.style.transform = 'translate(-50%,-50%) scale(' + lerp(1, 1.05, prog(t, 0, 4.5)) + ')';
    for (const row of rows) {
      const p = Math.max(0, Math.min(1, (t - Number(row.dataset.at)) / 0.4));
      const oldF = row.querySelector('.old'), newF = row.querySelector('.new');
      oldF.style.opacity = p < .5 ? 1 : 0;
      oldF.style.transform = 'rotateX(' + (p * 180) + 'deg)';
      newF.style.opacity = p < .5 ? 0 : 1;
      newF.style.transform = 'rotateX(' + ((p - 1) * 180) + 'deg)';
    }
    hero.classList.toggle('lit', t > 2.6);
  };`;
  return { css, body, script };
}

function stranded({ portrait }) {
  const [cols, rows] = portrait ? [10, 14] : [18, 7];
  const people = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = (c - (cols - 1) / 2) / (cols / 2);
      const dy = (r - (rows - 1) / 2) / (rows / 2);
      const d = Math.min(1, Math.hypot(dx, dy) / 1.2);
      const jitter = ((r * 31 + c * 17) % 10) / 40;
      people.push(`<span class="pp" data-at="${(0.15 + d * 1.7 + jitter).toFixed(2)}"><svg viewBox="0 0 20 28"><circle cx="10" cy="6" r="5"/><path d="M1 27c0-7 4-12 9-12s9 5 9 12z"/></svg></span>`);
    }
  }
  const css = `
  body{background:${DARK_BG}}
  .crowd{position:absolute;left:50%;top:${portrait ? 43 : 42}%;width:${portrait ? 82 : 80}%;transform:translate(-50%,-50%);
    display:grid;grid-template-columns:repeat(${cols},1fr);gap:${u(portrait ? 1.2 : 0.9)} 0;justify-items:center}
  .pp svg{width:${u(portrait ? 2.6 : 2.2)};height:auto;fill:#4A5F8D;display:block}
  .pp:nth-child(7n+3) svg{fill:#6C83B5}
  `;
  const script = `
  const pp = [...document.querySelectorAll('.pp')];
  const crowd = document.querySelector('.crowd');
  window.setTime = (t) => {
    crowd.style.transform = 'translate(-50%,-50%) scale(' + lerp(1.05, 1, prog(t, 0, 4)) + ')';
    for (const el of pp) {
      const o = prog(t, Number(el.dataset.at), 0.5);
      el.style.opacity = o;
      el.style.transform = 'translateY(' + ((1 - o) * 8) + 'px)';
    }
  };`;
  return { css, body: `<div class="crowd">${people.join("")}</div>`, script };
}

function scramble({ portrait }) {
  const bar = (w) => `<span class="bar" style="width:${w}%"></span>`;
  const css = `
  body{background:${DARK_BG}}
  .cards{position:absolute;left:50%;top:${portrait ? 44 : 43}%;transform:translate(-50%,-50%) scale(${portrait ? 1 : 1.3});display:flex;
    flex-direction:${portrait ? "column" : "row"};gap:${u(portrait ? 1.6 : 2)};width:${portrait ? 80 : 66}%}
  .card{flex:1;background:#0F1C38;border:1px solid #22335A;border-radius:${u(1)};padding:${u(1.3)} ${u(1.4)};color:#E6ECF7;
    box-shadow:0 24px 60px -24px rgba(0,0,0,.7)}
  .c-title{font-size:${u(1.35)};font-weight:700;margin-bottom:${u(0.9)};display:flex;align-items:center;gap:${u(0.6)}}
  .c-title svg{width:${u(1.5)};height:${u(1.5)}}
  .line{display:flex;justify-content:space-between;font-size:${u(1.1)};padding:${u(0.45)} 0;border-top:1px solid #1C2A4A}
  .amber{color:#F5C76B}.red{color:#FF7A7A}
  .grid{display:grid;grid-template-columns:1fr 1.4fr .8fr;gap:${u(0.45)} ${u(0.6)};align-items:center}
  .grid .h{font-size:${u(0.85)};color:#6F82A8;text-transform:uppercase;letter-spacing:.08em}
  .bar{display:block;height:${u(0.55)};border-radius:${u(0.3)};background:#2A3B63}
  .q{color:#FF7A7A;font-weight:700;font-size:${u(1.05)};text-align:center;background:rgba(255,107,107,.12);border-radius:${u(0.25)}}
  .big{font-size:${u(4.2)};font-weight:700;color:#FF7A7A;line-height:1}
  .meter{height:${u(0.7)};border-radius:${u(0.4)};background:#1C2A4A;margin:${u(0.9)} 0 ${u(0.6)};overflow:hidden}
  .meter span{display:block;height:100%;background:linear-gradient(90deg,#FF7A7A,#F5C76B)}
  .muted{color:#8C9DC0;font-size:${u(1.05)}}
  `;
  const phone = `<svg viewBox="0 0 24 24" fill="none" stroke="${BRAND.cyan}" stroke-width="2" stroke-linejoin="round"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/></svg>`;
  const sheet = `<svg viewBox="0 0 24 24" fill="none" stroke="${BRAND.cyan}" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>`;
  const bed = `<svg viewBox="0 0 24 24" fill="none" stroke="${BRAND.cyan}" stroke-width="2" stroke-linecap="round"><path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/></svg>`;
  const body = `
  <div class="cards">
    <div class="card" data-at="0.1">
      <div class="c-title">${phone}Calling hotels</div>
      <div class="line" data-at="0.6"><span>Hotel 1</span><span class="amber">No answer</span></div>
      <div class="line" data-at="1.1"><span>Hotel 2</span><span class="red">Fully booked</span></div>
      <div class="line" data-at="1.6"><span>Hotel 3</span><span class="amber">Call back later</span></div>
    </div>
    <div class="card" data-at="0.4">
      <div class="c-title">${sheet}Passenger spreadsheet</div>
      <div class="grid">
        <span class="h">PNR</span><span class="h">Passenger</span><span class="h">Hotel</span>
        ${[70, 85, 60, 78].map((w, i) => `${bar(w)}${bar(90 - i * 7)}<span class="q">?</span>`).join("")}
      </div>
    </div>
    <div class="card" data-at="0.7">
      <div class="c-title">${bed}Rooms left nearby</div>
      <div class="big" id="rooms">38</div>
      <div class="meter"><span id="meter" style="width:100%"></span></div>
      <div class="muted" id="clock">21:12</div>
    </div>
  </div>`;
  const script = `
  const cards = [...document.querySelectorAll('.card')];
  const lines = [...document.querySelectorAll('.line')];
  const rooms = document.getElementById('rooms'), meter = document.getElementById('meter'), clock = document.getElementById('clock');
  window.setTime = (t) => {
    cards.forEach((c, i) => {
      const o = prog(t, Number(c.dataset.at), 0.6);
      c.style.opacity = o;
      c.style.transform = 'translateY(' + ((1 - o) * 18 + Math.sin(t * 0.9 + i * 1.7) * 4) + 'px)';
    });
    for (const l of lines) l.style.opacity = prog(t, Number(l.dataset.at), 0.4);
    const p = prog(t, 0.6, 3.2);
    const left = Math.round(lerp(38, 4, p));
    rooms.textContent = left;
    meter.style.width = (left / 38 * 100) + '%';
    const m = 12 + Math.round(35 * p);
    clock.textContent = '21:' + String(m).padStart(2, '0');
  };`;
  return { css, body, script };
}

// ── Turn ─────────────────────────────────────────────────────────────────────

const LOGO_CSS = `
  .logo{display:flex;align-items:center;gap:${u(1.4)}}
  .logo-icon{width:${u(6.2)};height:${u(6.2)};border-radius:${u(1.5)};display:flex;align-items:center;justify-content:center;
    background:linear-gradient(145deg,${BRAND.navy},#13306B);box-shadow:0 18px 40px -16px rgba(11,27,63,.6)}
  .logo-icon svg{width:62%;height:62%}
  .logo-word{font-size:${u(6)};font-weight:700;color:${BRAND.navy};letter-spacing:-.01em}
`;
const logo = () =>
  `<div class="logo"><div class="logo-icon" id="l-icon">${planeIcon("#fff")}</div><div class="logo-word" id="l-word">Flyverax</div></div>`;

function logoReveal() {
  const css = `
  body{background:${DARK_BG}}
  .light{position:absolute;inset:0;background:radial-gradient(120% 90% at 25% 10%,#F7FAFF 0%,#E6EDF8 55%,#DCE5F3 100%)}
  .band{position:absolute;top:-20%;bottom:-20%;width:18%;transform:skewX(-18deg);
    background:linear-gradient(90deg,transparent,rgba(0,174,239,.55),rgba(255,255,255,.9),rgba(0,174,239,.4),transparent);filter:blur(10px)}
  .center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${u(2.6)}}
  .lockup{position:relative}
  .arc{position:absolute;left:-14%;top:-40%;width:128%;height:180%;overflow:visible}
  .by{font-size:${u(1.6)};color:#475467;font-weight:500;letter-spacing:.02em}
  ${LOGO_CSS}`;
  const body = `
  <div class="light" id="light"></div>
  <div class="band" id="band"></div>
  <div class="center">
    <div class="lockup">
      <svg class="arc" viewBox="0 0 100 60" preserveAspectRatio="none">
        <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${BRAND.cyan}"/><stop offset="1" stop-color="${BRAND.blue}"/></linearGradient></defs>
        <ellipse id="arc" cx="50" cy="30" rx="48" ry="22" transform="rotate(-8 50 30)" fill="none" stroke="url(#g)" stroke-width=".7" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" vector-effect="non-scaling-stroke" style="stroke-width:3px"/>
      </svg>
      ${logo()}
    </div>
    <div class="by" id="by">by Sysverax</div>
  </div>`;
  const script = `
  const light = document.getElementById('light'), band = document.getElementById('band');
  const icon = document.getElementById('l-icon'), word = document.getElementById('l-word');
  const by = document.getElementById('by'), arc = document.getElementById('arc');
  window.setTime = (t) => {
    const s = prog(t, 0.1, 1.3);
    const x = lerp(-25, 125, s);
    light.style.clipPath = 'polygon(0 0,' + (x + 8) + '% 0,' + (x - 8) + '% 100%,0 100%)';
    band.style.left = (x - 9) + '%';
    band.style.opacity = s > 0 && s < 1 ? 1 : 0;
    const i = prog(t, 1.1, 0.7);
    icon.style.opacity = i; icon.style.transform = 'scale(' + lerp(.9, 1, i) + ')';
    const w = prog(t, 1.35, 0.7);
    word.style.opacity = w; word.style.transform = 'translateX(' + lerp(-18, 0, w) + 'px)';
    arc.setAttribute('stroke-dashoffset', lerp(100, 34, prog(t, 1.5, 1.4)));
    by.style.opacity = prog(t, 2.0, 0.6);
  };`;
  return { css, body, script };
}

// ── Solution ─────────────────────────────────────────────────────────────────

function productFlow({ portrait }) {
  const step = (n, title, content) => `
    <div class="step" id="s${n}">
      <div class="s-head"><span class="num">${n}</span>${title}<span class="done" id="d${n}">${CHECK}</span></div>
      <div class="s-body">${content}</div>
    </div>`;
  const upload = `
    <div class="drop">
      <div class="file" id="file"><span class="csv">CSV</span>bookings-${esc(DATA.flight_number)}.csv</div>
      <div class="prog"><span id="pbar"></span></div>
      <div class="ok" id="imported">${esc(DATA.booking_count)} bookings imported</div>
    </div>`;
  const groups = [["Economy", 31], ["Business", 7], ["Families", 4]];
  const group = `
    <div class="groups">${groups
      .map(([name, n], i) => `<div class="g"><span class="g-name">${name}</span><span class="g-bar"><span data-w="${(n / 31) * 100}" data-at="${2.3 + i * 0.25}"></span></span><span class="g-n" data-at="${2.5 + i * 0.25}">${n}</span></div>`)
      .join("")}</div>`;
  const pins = [[22, 30], [74, 26], [30, 74], [70, 70]];
  const map = `
    <div class="map">
      <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">
        <rect width="200" height="120" fill="#EEF2F8"/>
        <path d="M0 40 L200 55 M0 95 L200 80 M60 0 L75 120 M140 0 L125 120 M0 10 L90 120" stroke="#fff" stroke-width="4" fill="none"/>
        <circle id="radius" cx="100" cy="60" r="0" fill="rgba(0,174,239,.10)" stroke="${BRAND.cyan}" stroke-width="1"/>
      </svg>
      <div class="airport">${planeIcon("#fff")}</div>
      ${pins.map(([x, y], i) => `<div class="pin" style="left:${x}%;top:${y}%" data-at="${4.7 + i * 0.18}"><span class="tick" data-at="${5.4 + i * 0.12}">${CHECK}</span></div>`).join("")}
      <div class="tag" id="tag">${esc(DATA.hotel_name)} · Booked</div>
    </div>`;
  const css = `
  .steps{position:absolute;left:50%;top:${portrait ? 42 : 42}%;transform:translate(-50%,-50%) scale(${portrait ? 1 : 1.2});display:flex;
    flex-direction:${portrait ? "column" : "row"};gap:${u(portrait ? 1.4 : 1.8)};width:${portrait ? 84 : 72}%}
  .step{flex:${portrait ? "none" : "1"};background:#fff;border-radius:${u(1)};padding:${u(1.2)} ${u(1.3)};box-shadow:0 20px 50px -24px rgba(11,27,63,.35);
    border:2px solid transparent;display:flex;flex-direction:column;height:${portrait ? u(14.5) : u(18)}}
  .step.active{border-color:${BRAND.blue}}
  .s-head{display:flex;align-items:center;gap:${u(0.7)};font-size:${u(1.35)};font-weight:700;color:${BRAND.navy};margin-bottom:${u(0.9)}}
  .num{width:${u(1.9)};height:${u(1.9)};border-radius:50%;background:${BRAND.navy};color:#fff;font-size:${u(1)};display:flex;align-items:center;justify-content:center}
  .done{margin-left:auto;width:${u(1.7)};height:${u(1.7)};border-radius:50%;background:#12B76A;display:flex;align-items:center;justify-content:center;opacity:0}
  .done svg{width:65%;height:65%}
  .s-body{flex:1;position:relative;min-height:0}
  .drop{height:100%;border:2px dashed #B9C7E3;border-radius:${u(0.7)};background:#F5F8FE;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${u(0.8)}}
  .file{display:flex;align-items:center;gap:${u(0.6)};background:#fff;border:1px solid #E4E7EC;border-radius:${u(0.5)};padding:${u(0.5)} ${u(0.8)};font-size:${u(1)};font-weight:600;color:#344054}
  .csv{background:#12B76A;color:#fff;font-size:${u(0.75)};font-weight:700;border-radius:${u(0.25)};padding:${u(0.15)} ${u(0.35)}}
  .prog{width:70%;height:${u(0.5)};border-radius:${u(0.3)};background:#E4E9F2;overflow:hidden}
  .prog span{display:block;height:100%;width:0;background:linear-gradient(90deg,${BRAND.cyan},${BRAND.blue})}
  .ok{font-size:${u(1.05)};font-weight:600;color:#067647;opacity:0}
  .groups{height:100%;display:flex;flex-direction:column;justify-content:center;gap:${u(portrait ? 0.7 : 1.1)}}
  .g{display:grid;grid-template-columns:${u(6.5)} 1fr ${u(2)};align-items:center;gap:${u(0.7)};font-size:${u(1.1)};color:#344054;font-weight:500}
  .g-bar{height:${u(1)};background:#EEF2F8;border-radius:${u(0.5)};overflow:hidden}
  .g-bar span{display:block;height:100%;width:0;background:${BRAND.blue};border-radius:${u(0.5)}}
  .g:nth-child(2) .g-bar span{background:${BRAND.navy}}
  .g:nth-child(3) .g-bar span{background:${BRAND.cyan}}
  .g-n{font-weight:700;color:${BRAND.navy};text-align:right;opacity:0}
  .map{position:absolute;inset:0;border-radius:${u(0.7)};overflow:hidden}
  .map svg{width:100%;height:100%;display:block}
  .airport{position:absolute;left:50%;top:50%;width:${u(2.2)};height:${u(2.2)};margin:${u(-1.1)} 0 0 ${u(-1.1)};border-radius:50%;background:${BRAND.navy};
    display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 ${u(0.3)} #fff}
  .airport svg{width:60%;height:60%}
  .pin{position:absolute;width:${u(1.5)};height:${u(1.5)};margin:${u(-0.75)} 0 0 ${u(-0.75)};border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${BRAND.blue};opacity:0}
  .tick{position:absolute;inset:0;border-radius:50%;background:#12B76A;display:flex;align-items:center;justify-content:center;transform:rotate(45deg);opacity:0}
  .tick svg{width:70%;height:70%}
  .tag{position:absolute;left:50%;bottom:${u(0.7)};transform:translateX(-50%);background:#fff;border-radius:999px;padding:${u(0.35)} ${u(0.9)};
    font-size:${u(0.95)};font-weight:600;color:#067647;box-shadow:0 6px 16px -6px rgba(11,27,63,.35);white-space:nowrap;opacity:0}
  `;
  const body = `<div class="steps">
    ${step(1, "Upload passenger list", upload)}
    ${step(2, "Group travellers", group)}
    ${step(3, "Find & book hotels", map)}
  </div>`;
  const script = `
  const starts = [0.2, 2.1, 3.9], ends = [2.1, 3.9, 6.0];
  const steps = [1, 2, 3].map((n) => document.getElementById('s' + n));
  const dones = [1, 2, 3].map((n) => document.getElementById('d' + n));
  const file = document.getElementById('file'), pbar = document.getElementById('pbar'), imported = document.getElementById('imported');
  const bars = [...document.querySelectorAll('.g-bar span')], counts = [...document.querySelectorAll('.g-n')];
  const radius = document.getElementById('radius'), pins = [...document.querySelectorAll('.pin')], tag = document.getElementById('tag');
  window.setTime = (t) => {
    steps.forEach((s, i) => {
      s.style.opacity = lerp(.45, 1, prog(t, starts[i] - .2, .4));
      s.classList.toggle('active', t >= starts[i] && t < ends[i]);
      dones[i].style.opacity = prog(t, ends[i] - .1, .35);
    });
    const f = prog(t, 0.3, 0.6);
    file.style.opacity = f; file.style.transform = 'translateY(' + lerp(-24, 0, f) + 'px)';
    pbar.style.width = (prog(t, 0.9, 0.8) * 100) + '%';
    imported.style.opacity = prog(t, 1.7, 0.35);
    bars.forEach((b) => { b.style.width = (Number(b.dataset.w) * prog(t, Number(b.dataset.at), 0.7)) + '%'; });
    counts.forEach((c) => { c.style.opacity = prog(t, Number(c.dataset.at), 0.4); });
    radius.setAttribute('r', lerp(0, 52, prog(t, 4.1, 0.8)));
    pins.forEach((p) => {
      p.style.opacity = prog(t, Number(p.dataset.at), 0.35);
      const tick = p.querySelector('.tick');
      tick.style.opacity = prog(t, Number(tick.dataset.at), 0.3);
    });
    tag.style.opacity = prog(t, 5.6, 0.4);
  };`;
  return { css, body, script };
}

function confirmationDoc({ portrait }) {
  const css = `
  .doc{position:absolute;left:50%;top:${portrait ? 43 : 44}%;width:${portrait ? 62 : 25}%;transform:translate(-50%,-50%)}
  .paper{width:100%;aspect-ratio:794/1123;background:#fff center top/cover no-repeat;border-radius:${u(0.4)};
    box-shadow:0 40px 80px -30px rgba(11,27,63,.45),0 0 0 1px rgba(11,27,63,.06)}
  .badge{position:absolute;right:${u(-1.6)};top:${u(-1.4)};display:flex;align-items:center;gap:${u(0.6)};background:#12B76A;color:#fff;
    font-weight:700;font-size:${u(1.3)};border-radius:999px;padding:${u(0.55)} ${u(1.2)} ${u(0.55)} ${u(0.6)};box-shadow:0 12px 30px -10px rgba(18,183,106,.6)}
  .badge i{width:${u(1.8)};height:${u(1.8)};border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center}
  .badge svg{width:70%;height:70%}
  `;
  const image = pdfPreview ? `background-image:url(${pdfPreview})` : "";
  const body = `<div class="doc" id="doc"><div class="paper" style="${image}"></div><div class="badge" id="badge"><i>${CHECK}</i>Confirmed</div></div>`;
  const script = `
  const doc = document.getElementById('doc'), badge = document.getElementById('badge');
  window.setTime = (t) => {
    const d = prog(t, 0, 0.9);
    doc.style.opacity = d;
    doc.style.transform = 'translate(-50%,-50%) translateY(' + lerp(26, 0, d) + 'px) scale(' + lerp(1, 1.03, prog(t, 0, 3)) + ')';
    const b = prog(t, 0.9, 0.5);
    badge.style.opacity = b; badge.style.transform = 'scale(' + lerp(.92, 1, b) + ')';
  };`;
  return { css, body, script };
}

function endCard({ portrait }) {
  const css = `
  /* Plain white: the SysveraX logo is a JPG on white, so it must sit on pure white. */
  body{background:#fff}
  .end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${u(portrait ? 2.2 : 1.6)};
    padding-bottom:${portrait ? "8%" : "2%"}}
  .tagline{font-size:${u(2.3)};font-weight:500;color:#344054}
  .cta{display:flex;align-items:center;gap:${u(1.4)};flex-direction:${portrait ? "column" : "row"}}
  .btn{background:${BRAND.blue};color:#fff;font-weight:700;font-size:${u(1.6)};border-radius:999px;padding:${u(0.8)} ${u(2)};
    box-shadow:0 14px 30px -12px rgba(10,108,255,.6)}
  .site{font-size:${u(1.7)};font-weight:600;color:${BRAND.navy}}
  .maker{margin-top:${u(portrait ? 3 : 1.6)};display:flex;flex-direction:column;align-items:center;gap:${u(0.2)}}
  .maker span{font-size:${u(1)};color:#667085;letter-spacing:.08em;text-transform:uppercase}
  .maker img{height:${u(portrait ? 8 : 6.5)}}
  ${LOGO_CSS}`;
  const body = `
  <div class="end">
    <div data-at="0.2">${logo()}</div>
    <div class="tagline" data-at="0.7">${esc(FILM.tagline)}</div>
    <div class="cta" data-at="1.2"><span class="btn">${esc(FILM.cta)}</span><span class="site">${esc(FILM.website)}</span></div>
    <div class="maker" data-at="1.8"><span>A product of</span><img src="${SYSVERAX_LOGO}" alt="Sysverax"></div>
  </div>`;
  const script = `
  const parts = [...document.querySelectorAll('.end > [data-at]')];
  window.setTime = (t) => {
    for (const p of parts) {
      const o = prog(t, Number(p.dataset.at), 0.7);
      p.style.opacity = o;
      p.style.transform = 'translateY(' + lerp(16, 0, o) + 'px)';
    }
  };`;
  return { css, body, script };
}

// ── Device shots (reuse the reviewed mock-up screens) ────────────────────────

/** A mock-up scene beside (16:9) or below (9:16) its caption; `offset` maps shot time to scene time. */
function deviceShot(sceneName, { offset = 0, camera } = {}) {
  return ({ width, height, portrait }) => {
    const scene = SCENES[sceneName];
    const [dw, dh] = DEVICE_SIZE[scene.device];
    const area = portrait
      ? { left: 0, top: height * 0.2, w: width, h: height * 0.78 }
      : { left: width * 0.4, top: 0, w: width * 0.58, h: height };
    const scale = Math.min((area.w * 0.92) / dw, (area.h * 0.9) / dh);
    const keys = camera?.[portrait ? "portrait" : "landscape"];
    const body = `
    <div style="position:absolute;left:${area.left}px;top:${area.top}px;width:${area.w}px;height:${area.h}px;display:flex;align-items:center;justify-content:center">
      <div class="fit" style="transform:scale(${scale})">${scene.html()}</div>
    </div>`;
    const script = (scene.script ?? "") + (keys ? cameraScript(keys, scale, dw) : "");
    return { css: scene.css, body, script, offset };
  };
}

// ── Timeline ─────────────────────────────────────────────────────────────────

const NOTIFY = "Every passenger gets their hotel confirmation by SMS and email.";

/**
 * Shots in order. `caption` placement: "bottom" (full-frame shots) or "side" (device shots:
 * left of the device in 16:9, above it in 9:16). `fade` / `captionFade`: [in, out].
 */
export const SHOTS = [
  { id: "departures", dur: 4.5, build: departuresBoard, dark: true, caption: "When a flight is cancelled, hundreds of passengers need a hotel — tonight." },
  { id: "stranded", dur: 4, build: stranded, dark: true, caption: "Hundreds of passengers are stranded. Airline teams scramble —" },
  { id: "scramble", dur: 4, build: scramble, dark: true, caption: "— phone calls, spreadsheets, and hotels filling up by the minute." },
  // Ends on the light background, so it cuts straight into the (light) product flow.
  { id: "logo", dur: 3.6, build: logoReveal, fade: [true, false] },
  { id: "flow", dur: 6.5, build: productFlow, caption: "Upload the passenger list. Flyverax groups travellers, searches live hotel rates near the airport and books the rooms." },
  { id: "sms", dur: 2.4, build: deviceShot("lock-sms", { offset: 0.9 }), placement: "side", caption: NOTIFY, fade: [true, false], captionFade: [true, false] },
  { id: "email", dur: 3, build: deviceShot("lock-email", { offset: 3.5 }), placement: "side", caption: NOTIFY, fade: [false, true], captionFade: [false, false] },
  { id: "email-open", dur: 2.6, build: deviceShot("email-open"), placement: "side", caption: NOTIFY, captionFade: [false, true] },
  { id: "rest", dur: 3, build: confirmationDoc, caption: "From disruption to rest." },
  {
    id: "invoice", dur: 4.2, placement: "side", caption: "And the airline gets one invoice per flight.",
    build: deviceShot("invoice", {
      offset: 0.6,
      // 16:9 shows the whole laptop; 9:16 frames the list, then pans to the open email.
      camera: {
        portrait: [{ t: 0, x: 560, zoom: 1.9 }, { t: 2.6, x: 560, zoom: 1.9 }, { t: 3.8, x: 1010, zoom: 1.9 }],
      },
    }),
  },
  { id: "end", dur: 5.5, build: endCard, fade: [true, false] },
];

export const FILM_DURATION = SHOTS.reduce((sum, s) => sum + s.dur, 0);

/** Full HTML page for one shot. */
export function buildShotPage(shot, width, height) {
  const portrait = height > width;
  const { css, body, script, offset = 0 } = shot.build({ width, height, portrait });
  const placement = shot.placement ?? "bottom";
  const [fadeIn, fadeOut] = shot.fade ?? [true, true];
  const [capIn, capOut] = shot.captionFade ?? [true, true];
  const capColor = shot.dark ? "#F2F5FA" : BRAND.navy;
  const capCss = `
  .cap{position:absolute;z-index:40;font-weight:600;letter-spacing:-.01em;line-height:1.25;color:${capColor}}
  .cap-bottom{left:${portrait ? 7 : 12}%;right:${portrait ? 7 : 12}%;bottom:${portrait ? 9 : 7}%;text-align:center;font-size:${u(portrait ? 2.6 : 2.1)}}
  .cap-side{${portrait
    ? `left:8%;right:8%;top:7%;text-align:center;font-size:${u(2.8)}`
    : `left:7%;width:32%;top:50%;transform:translateY(-50%);font-size:${u(2.7)}`}}
  `;
  const caption = shot.caption
    ? `<div class="cap cap-${placement}"><div id="cap-in">${esc(shot.caption)}</div></div>`
    : "";
  const filmScript = `
  (() => {
    const inner = window.setTime;
    const shotEl = document.getElementById('shot'), cap = document.getElementById('cap-in');
    const D = ${shot.dur}, F = 0.35;
    window.setTime = (u) => {
      inner(u + ${offset});
      shotEl.style.opacity = ${fadeIn ? "prog(u, 0, F)" : "1"} * ${fadeOut ? "(1 - prog(u, D - F, F))" : "1"};
      if (cap) {
        const ci = ${capIn ? "prog(u, 0.15, 0.6)" : "1"}, co = ${capOut ? "(1 - prog(u, D - F, F))" : "1"};
        cap.style.opacity = ci * co;
        cap.style.transform = 'translateY(' + lerp(14, 0, ci) + 'px)';
      }
    };
  })();`;
  return page({
    width,
    height,
    css: css + capCss,
    body: `<div id="shot" style="position:absolute;inset:0">${body}</div>${caption}`,
    script: script + filmScript,
  });
}
