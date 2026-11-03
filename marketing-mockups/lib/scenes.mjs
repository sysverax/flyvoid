// HTML for every mock-up screen. Each page exposes window.setTime(t) (seconds);
// stills call it once with a fixed time, videos call it for every frame.
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA, SENDERS, DEVICE, BRAND, SHOW_CONCEPT_LABEL } from "../config.mjs";
import { sms, email, asRows } from "./templates.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ── Shared assets ────────────────────────────────────────────────────────────

const fontFaces = (() => {
  const dir = path.join(path.dirname(require.resolve("@fontsource/figtree/package.json")), "files");
  return [400, 500, 600, 700]
    .map((w) => {
      const b64 = readFileSync(path.join(dir, `figtree-latin-${w}-normal.woff2`)).toString("base64");
      return `@font-face{font-family:'Figtree';font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
    })
    .join("\n");
})();

export const pdfPreview = (() => {
  const file = path.join(ROOT, "build", "confirmation-preview.png");
  return existsSync(file) ? `data:image/png;base64,${readFileSync(file).toString("base64")}` : null;
})();

export const ICON = {
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 7 8.5-7"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="#fff"><path d="M3 20 21 12 3 4v6l12 2-12 2z"/></svg>`,
  pdf: `<svg viewBox="0 0 32 40"><path d="M2 2h20l8 8v28H2z" fill="#fff" stroke="#D0D5DD" stroke-width="2"/><path d="M22 2v8h8" fill="none" stroke="#D0D5DD" stroke-width="2"/><rect x="0" y="20" width="24" height="12" rx="2" fill="#D92D20"/><text x="12" y="29.5" text-anchor="middle" font-family="Figtree" font-weight="700" font-size="8" fill="#fff">PDF</text></svg>`,
  cursor: `<svg viewBox="0 0 24 24"><path d="M5 3v17l4.5-4.2 3 6.2 2.8-1.3-3-6.1H19z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
};

const statusBar = (dark) => `
  <div class="status ${dark ? "on-dark" : ""}">
    <span class="st-left">${dark ? "" : DEVICE.emailTime}</span>
    <span class="st-right">
      <svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <svg viewBox="0 0 26 12"><rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".5"/><rect x="2" y="2" width="15" height="8" rx="1.8"/><rect x="23.5" y="4" width="2" height="4" rx="1" opacity=".5"/></svg>
    </span>
  </div>`;

// ── Page shell ───────────────────────────────────────────────────────────────

const BASE_CSS = `
  ${fontFaces}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:var(--w);height:var(--h);overflow:hidden}
  body{font-family:'Figtree',system-ui,sans-serif;-webkit-font-smoothing:antialiased;color:#101828;
    background:radial-gradient(120% 90% at 25% 10%,#F7FAFF 0%,#E6EDF8 55%,#DCE5F3 100%)}
  .stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
  .fit{transform-origin:center center}
  .concept{position:absolute;right:calc(var(--u)*1.6);bottom:calc(var(--u)*1.4);z-index:50;
    font-size:calc(var(--u)*0.95);font-weight:600;letter-spacing:.02em;color:#fff;
    background:rgba(11,27,63,.78);padding:calc(var(--u)*.35) calc(var(--u)*.8);border-radius:999px}

  /* Generic phone: rounded body, thin bezel, camera dot. */
  .phone{position:relative;width:410px;height:864px;border-radius:58px;background:#16181D;padding:10px;
    box-shadow:0 40px 80px -30px rgba(11,27,63,.45),0 0 0 1.5px #2A2E36 inset}
  .phone::before{content:"";position:absolute;right:-3px;top:190px;width:3px;height:74px;border-radius:0 3px 3px 0;background:#2A2E36}
  .screen{position:relative;width:390px;height:844px;border-radius:48px;overflow:hidden;background:#fff}
  .camera{position:absolute;top:16px;left:50%;width:13px;height:13px;margin-left:-6.5px;border-radius:50%;
    background:#0A0B0D;box-shadow:0 0 0 2px #1E2127;z-index:20}
  .status{position:absolute;top:0;left:0;right:0;height:46px;padding:16px 30px 0;display:flex;justify-content:space-between;
    font-size:15px;font-weight:600;color:#101828;z-index:10}
  .status.on-dark{color:#fff}
  .status svg{height:12px;margin-left:6px;fill:currentColor}
  .home-bar{position:absolute;bottom:8px;left:50%;width:134px;height:5px;margin-left:-67px;border-radius:3px;background:#101828;opacity:.85}
  .on-dark-bar{background:#fff;opacity:.7}

  /* Lock screen */
  .lock{position:absolute;inset:0;background:
      radial-gradient(60% 40% at 80% 18%,rgba(0,174,239,.28),transparent 70%),
      radial-gradient(70% 45% at 10% 85%,rgba(10,108,255,.30),transparent 70%),
      linear-gradient(165deg,${BRAND.navy} 0%,#08142E 55%,#050B1A 100%);color:#fff}
  .clock{position:absolute;top:96px;left:0;right:0;text-align:center}
  .clock .time{font-size:84px;font-weight:600;letter-spacing:-1px;line-height:1}
  .clock .date{margin-top:10px;font-size:18px;font-weight:500;opacity:.85}
  .notes{position:absolute;top:268px;left:14px;right:14px}
  .note{position:absolute;left:0;right:0;border-radius:22px;padding:13px 15px 14px;
    background:rgba(255,255,255,.16);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
    border:1px solid rgba(255,255,255,.12);box-shadow:0 14px 34px -12px rgba(0,0,0,.55)}
  .note-head{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:500;opacity:.85}
  .note-head .when{margin-left:auto}
  .app-icon{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center}
  .app-icon svg{width:16px;height:16px}
  .ic-chat{background:linear-gradient(140deg,#2E9BFF,${BRAND.blue})}
  .ic-mail{background:linear-gradient(140deg,${BRAND.cyan},${BRAND.blue})}
  .note-title{margin-top:8px;font-size:16px;font-weight:700}
  .note-line{margin-top:2px;font-size:15px;font-weight:600}
  .note-body{margin-top:3px;font-size:15px;line-height:1.36;opacity:.92}
  .avatar{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;
    color:#fff;font-weight:700;font-size:17px;background:linear-gradient(140deg,${BRAND.navy},${BRAND.blue})}
  .note-body.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
`;

export function page({ width, height, css = "", body, script = "" }) {
  const u = Math.min(width, height) / 54;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  :root{--w:${width}px;--h:${height}px;--u:${u}px}
  ${BASE_CSS}${css}</style></head><body>
  ${body}
  ${SHOW_CONCEPT_LABEL ? `<div class="concept">Concept preview</div>` : ""}
  <script>
  // Own scope: renderers reuse one page, and setContent keeps the previous page's globals.
  (() => {
    const ease =(x) => x <= 0 ? 0 : x >= 1 ? 1 : (x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2);
    const prog = (t, start, dur) => ease((t - start) / dur);
    const lerp = (a, b, p) => a + (b - a) * p;
    window.setTime = () => {};
    ${script}
  })();
  </script></body></html>`;
}

/** Centres a fixed-size device in the stage, scaled to `scale`. */
const fit = (inner, scale) => `<div class="stage"><div class="fit" style="transform:scale(${scale})">${inner}</div></div>`;

const phone = (screen) => `<div class="phone"><div class="screen">${screen}<div class="camera"></div></div></div>`;

// ── Phone scenes ─────────────────────────────────────────────────────────────

const smsText = () => sms().text;
const linkify = (text) =>
  esc(text).replace(/(https?:\/\/\S+)/g, `<span style="color:${BRAND.blue};text-decoration:underline">$1</span>`);

function lockScreen({ withEmail }) {
  const passenger = email("passenger-email.txt");
  // Preview text: the first sentence after the greeting.
  const firstLine = passenger.paragraphs[1];
  return `
  <div class="lock">
    ${statusBar(true)}
    <div class="clock"><div class="time" id="clock">${withEmail ? DEVICE.emailTime : DEVICE.smsTime}</div><div class="date">${DEVICE.dateLabel}</div></div>
    <div class="notes">
      ${withEmail ? `
      <div class="note" id="mail-note">
        <div class="note-head"><span class="app-icon ic-mail">${ICON.mail}</span>Mail<span class="when">now</span></div>
        <div class="note-title">${esc(SENDERS.email.name)}</div>
        <div class="note-line">${esc(passenger.preheader)}</div>
        <div class="note-body clamp">${esc(firstLine)}</div>
      </div>` : ""}
      <div class="note" id="sms-note">
        <div class="note-head"><span class="app-icon ic-chat">${ICON.chat}</span>Messages<span class="when" id="sms-when">now</span></div>
        <div class="note-title">${esc(SENDERS.sms)}</div>
        <div class="note-body">${esc(smsText())}</div>
      </div>
    </div>
    <div class="home-bar on-dark-bar"></div>
  </div>`;
}

const CHAT_CSS = `
  .chat{position:absolute;inset:0;background:#fff;display:flex;flex-direction:column}
  .chat-head{padding:56px 16px 12px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #EEF0F3}
  .chat-head .back{width:26px;height:26px;color:${BRAND.blue}}
  .chat-name{font-size:17px;font-weight:700}
  .chat-sub{font-size:13px;color:#667085}
  .chat-body{flex:1;padding:18px 16px}
  .day{text-align:center;font-size:12.5px;color:#667085;font-weight:500;margin-bottom:14px}
  .bubble{max-width:82%;background:#EEF1F5;border-radius:20px 20px 20px 6px;padding:11px 14px;font-size:16px;line-height:1.4;color:#101828}
  .stamp{margin:6px 0 0 6px;font-size:12px;color:#667085}
  .composer{padding:10px 14px 30px;display:flex;gap:10px;align-items:center;border-top:1px solid #EEF0F3}
  .input{flex:1;height:42px;border-radius:21px;border:1px solid #D0D5DD;padding:0 16px;display:flex;align-items:center;color:#98A2B3;font-size:15px}
  .send{width:40px;height:40px;border-radius:50%;background:#C5CCD8;display:flex;align-items:center;justify-content:center}
  .send svg{width:18px;height:18px}
`;

const chatScreen = () => `
  <div class="chat">
    ${statusBar(false).replace(DEVICE.emailTime, DEVICE.smsTime)}
    <div class="chat-head">
      <span class="back">${ICON.back}</span>
      <div class="avatar">${esc(SENDERS.sms[0])}</div>
      <div><div class="chat-name">${esc(SENDERS.sms)}</div><div class="chat-sub">Text message</div></div>
    </div>
    <div class="chat-body">
      <div class="day">Today ${DEVICE.smsTime}</div>
      <div class="bubble">${linkify(smsText())}</div>
      <div class="stamp">${DEVICE.smsTime}</div>
    </div>
    <div class="composer"><div class="input">Text message</div><div class="send">${ICON.send}</div></div>
    <div class="home-bar"></div>
  </div>`;

const MAIL_PHONE_CSS = `
  .mail{position:absolute;inset:0;background:#fff;padding:52px 0 0}
  .mail-bar{display:flex;align-items:center;padding:6px 14px 8px;color:#344054}
  .mail-bar svg{width:24px;height:24px}
  .mail-bar .sp{flex:1}
  .mail-bar .act{margin-left:18px;width:22px;height:22px}
  .mail-in{padding:4px 20px 0}
  .subject{font-size:20px;font-weight:700;line-height:1.25;letter-spacing:-.2px}
  .from{display:flex;align-items:center;gap:10px;margin:12px 0 14px}
  .from .avatar{width:36px;height:36px;font-size:15px}
  .from-name{font-size:15px;font-weight:700}
  .from-name span{font-weight:500;color:#667085;font-size:13px;margin-left:6px}
  .from-to{font-size:13px;color:#667085}
  .p{font-size:14.5px;line-height:1.45;color:#1D2939;margin-bottom:11px}
  .kv{background:#F5F7FA;border-radius:12px;padding:10px 14px;margin-bottom:11px}
  .kv div{display:flex;justify-content:space-between;font-size:14px;padding:3px 0}
  .kv span:first-child{color:#667085}
  .kv span:last-child{font-weight:600;text-align:right}
  .attach{display:flex;gap:12px;align-items:center;border:1px solid #E4E7EC;border-radius:12px;padding:9px;margin-bottom:12px}
  .thumb{width:62px;height:86px;border-radius:4px;border:1px solid #E4E7EC;background:#fff center top/cover no-repeat;flex:none}
  .thumb.placeholder{display:flex;align-items:center;justify-content:center}
  .chip{display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600}
  .chip svg{width:22px;height:28px}
  .chip-sub{font-size:12.5px;color:#667085;margin-top:3px;font-weight:500}
  .foot{border-top:1px solid #EAECF0;padding-top:10px;font-size:12.5px;color:#667085}
`;

function renderParagraphs(paragraphs, { attachment, smallPrint } = {}) {
  const body = paragraphs.slice(0, -1);
  const footer = paragraphs.at(-1);
  return (
    body
      .map((p) => {
        const rows = asRows(p);
        if (rows) {
          return `<div class="kv">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")}</div>${smallPrint ?? ""}`;
        }
        if (attachment && /attached/i.test(p)) {
          // Make the "attached" sentence stand out, then show the attachment.
          const [first, ...more] = p.split(/(?<=\.)\s+/);
          return `<div class="p"><b>${esc(first)}</b> ${esc(more.join(" "))}</div>${attachment}`;
        }
        return `<div class="p">${esc(p).replace(/\n/g, "<br>")}</div>`;
      })
      .join("") + `<div class="foot">${esc(footer)}</div>`
  );
}

function emailOpenScreen() {
  const mail = email("passenger-email.txt");
  const thumb = pdfPreview
    ? `<div class="thumb" style="background-image:url(${pdfPreview})"></div>`
    : `<div class="thumb placeholder">${ICON.pdf}</div>`;
  const attachment = `
    <div class="attach">${thumb}
      <div><div class="chip">${ICON.pdf}hotel-confirmation.pdf</div><div class="chip-sub">PDF attachment</div></div>
    </div>`;
  return `
  <div class="mail">
    ${statusBar(false)}
    <div class="mail-bar"><span>${ICON.back}</span><span class="sp"></span><span class="act">${ICON.archive}</span><span class="act">${ICON.trash}</span></div>
    <div class="mail-in">
      <div class="subject">${esc(mail.subject)}</div>
      <div class="from">
        <div class="avatar">${esc(SENDERS.email.name[0])}</div>
        <div><div class="from-name">${esc(SENDERS.email.name)}<span>${DEVICE.emailTime}</span></div><div class="from-to">to me</div></div>
      </div>
      ${renderParagraphs(mail.paragraphs, { attachment })}
    </div>
    <div class="home-bar"></div>
  </div>`;
}

// Phone animation: SMS slides in at 1.5s; cut at 3.5s; email slides in at 4s above it.
const PHONE_SCRIPT = `
  const SLIDE = 0.6;
  const sms = document.getElementById('sms-note');
  const mail = document.getElementById('mail-note');
  const gap = 10;
  window.setTime = (t) => {
    if (mail) {
      const p = prog(t, 4.0, SLIDE);
      mail.style.opacity = p;
      mail.style.transform = 'translateY(' + lerp(-26, 0, p) + 'px) scale(' + lerp(.97, 1, p) + ')';
      sms.style.transform = 'translateY(' + lerp(0, mail.offsetHeight + gap, p) + 'px)';
      document.getElementById('sms-when').textContent = '6m ago';
    } else {
      const p = prog(t, 1.5, SLIDE);
      sms.style.opacity = p;
      sms.style.transform = 'translateY(' + lerp(-26, 0, p) + 'px) scale(' + lerp(.97, 1, p) + ')';
    }
  };
`;

// ── Laptop scene ─────────────────────────────────────────────────────────────

const LAPTOP_CSS = `
  .laptop{display:flex;flex-direction:column;align-items:center}
  .lid{width:1308px;height:828px;border-radius:22px 22px 10px 10px;background:#17191E;padding:14px;
    box-shadow:0 0 0 1.5px #2C3038 inset}
  .lid .camera{top:5px;width:7px;height:7px;margin-left:-3.5px}
  .lid{position:relative}
  .display{width:1280px;height:800px;border-radius:6px;overflow:hidden;background:#fff;position:relative}
  .base{width:1460px;height:24px;border-radius:2px 2px 16px 16px;margin-top:-1px;
    background:linear-gradient(#D7DCE3,#B9C0CA 70%,#9AA2AE);box-shadow:0 40px 70px -30px rgba(11,27,63,.5)}
  .base::after{content:"";display:block;width:180px;height:8px;margin:0 auto;border-radius:0 0 8px 8px;background:#A5ADB8}

  .app{display:grid;grid-template-columns:210px 400px 1fr;grid-template-rows:56px 1fr;height:100%;font-size:14px}
  .top{grid-column:1/4;display:flex;align-items:center;gap:16px;padding:0 20px;border-bottom:1px solid #EAECF0;background:#FAFBFC}
  .brandmark{font-weight:700;font-size:15px;width:170px;color:#344054}
  .search{flex:0 0 460px;height:34px;border-radius:8px;background:#EEF1F5;color:#98A2B3;display:flex;align-items:center;padding:0 14px}
  .me{margin-left:auto;color:#667085;font-size:13px}
  .side{padding:16px 12px;border-right:1px solid #EAECF0;background:#FAFBFC}
  .compose{background:${BRAND.blue};color:#fff;font-weight:600;border-radius:10px;padding:10px 14px;margin-bottom:14px;width:max-content}
  .folder{display:flex;justify-content:space-between;padding:8px 12px;border-radius:8px;color:#344054;font-weight:500}
  .folder.on{background:#E7EEFC;color:${BRAND.navy};font-weight:700}
  .list{border-right:1px solid #EAECF0;overflow:hidden}
  .list-h{padding:14px 18px 10px;font-weight:700;font-size:16px}
  .item{position:relative;padding:12px 18px 12px 30px;border-bottom:1px solid #F0F2F5;overflow:hidden}
  .item .r1{display:flex;justify-content:space-between;font-weight:600;color:#344054}
  .item .r1 span:last-child{font-weight:500;color:#667085;font-size:12.5px}
  .item .r2{margin-top:2px;color:#1D2939;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .item .r3{margin-top:2px;color:#667085;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .item.unread .r1,.item.unread .r2{font-weight:700;color:#101828}
  .item .dot{position:absolute;left:13px;top:18px;width:8px;height:8px;border-radius:50%;background:${BRAND.blue}}
  .item.selected{background:#EAF1FE}
  .pane{position:relative;overflow:hidden}
  .empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#98A2B3;font-size:15px}
  .read{position:absolute;inset:0;padding:26px 34px;background:#fff}
  .read .subject{font-size:22px}
  .read .from{margin:14px 0 18px}
  .read .from .avatar{width:40px;height:40px}
  .read .from-name span{font-size:13px}
  .read .p{font-size:14.5px}
  .read .kv{max-width:430px;padding:10px 16px}
  .read .kv div:last-child{border-top:1px solid #D9DEE7;margin-top:4px;padding-top:7px}
  .read .kv div:last-child span{color:#101828;font-weight:700}
  .sample{font-size:11.5px;color:#98A2B3;margin:-6px 0 12px}
  .read .attach{width:max-content;padding:10px 16px 10px 12px}
  .cursor{position:absolute;width:26px;height:26px;z-index:30;pointer-events:none}
`;

function laptopScene() {
  const mail = email("airline-invoice-email.txt");
  const others = [
    ["Crew Planning", "Roster changes, week 48", "Updated roster attached for review.", "18:12"],
    ["Ground Ops CDG", "De-icing schedule update", "Revised slots from tomorrow morning.", "16:40"],
    ["IT Service Desk", "Scheduled maintenance, Nov 28", "The booking tool will be unavailable for 30 minutes.", "11:05"],
    ["Revenue Accounting", "October settlement summary", "Summary of October settlements.", "Yesterday"],
    ["Procurement", "Catering contract renewal", "Draft terms for review.", "Yesterday"],
  ];
  const item = ([from, subj, pre, time], extra = "") =>
    `<div class="item ${extra}"><div class="r1"><span>${esc(from)}</span><span>${esc(time)}</span></div><div class="r2">${esc(subj)}</div><div class="r3">${esc(pre)}</div></div>`;
  const smallPrint = SHOW_CONCEPT_LABEL ? `<div class="sample">Sample data. Figures are illustrative only.</div>` : "";
  const attachment = `<div class="attach"><div class="chip">${ICON.pdf}invoice-${esc(DATA.invoice_number)}.pdf</div></div>`;
  // The attachment sits right under the summary table.
  const body = renderParagraphs(mail.paragraphs, { smallPrint: smallPrint + attachment });

  return `
  <div class="laptop">
    <div class="lid"><div class="camera"></div><div class="display">
      <div class="app">
        <div class="top"><span class="brandmark">Mail</span><span class="search">Search mail</span><span class="me">${esc(SENDERS.airlineContact.address)}</span></div>
        <div class="side">
          <div class="compose">Compose</div>
          <div class="folder on"><span>Inbox</span><span id="count">1</span></div>
          <div class="folder"><span>Starred</span></div>
          <div class="folder"><span>Sent</span></div>
          <div class="folder"><span>Drafts</span></div>
          <div class="folder"><span>Archive</span></div>
        </div>
        <div class="list">
          <div class="list-h">Inbox</div>
          <div id="new-wrap" style="overflow:hidden">
            <div class="item unread" id="new-item"><span class="dot" id="new-dot"></span>
              <div class="r1"><span>${esc(SENDERS.email.name)}</span><span>21:58</span></div>
              <div class="r2">${esc(mail.subject)}</div><div class="r3">${esc(mail.preheader)}</div>
            </div>
          </div>
          ${item(others[0], "unread")}${others.slice(1).map((o) => item(o)).join("")}
        </div>
        <div class="pane">
          <div class="empty" id="empty">No message selected</div>
          <div class="read" id="read">
            <div class="subject">${esc(mail.subject)}</div>
            <div class="from">
              <div class="avatar">${esc(SENDERS.email.name[0])}</div>
              <div><div class="from-name">${esc(SENDERS.email.name)}<span>&lt;${esc(SENDERS.email.address)}&gt; · 21:58</span></div>
              <div class="from-to">to ${esc(SENDERS.airlineContact.address)}</div></div>
            </div>
            ${body}
          </div>
        </div>
      </div>
      <div class="cursor" id="cursor">${ICON.cursor}</div>
    </div></div>
    <div class="base"></div>
  </div>`;
}

// Invoice animation: email arrives at 0.8s, cursor moves 1.6-2.7s, click 2.8s, opens 3.0s.
const LAPTOP_SCRIPT = `
  const wrap = document.getElementById('new-wrap');
  const item = document.getElementById('new-item');
  const read = document.getElementById('read');
  const empty = document.getElementById('empty');
  const cursor = document.getElementById('cursor');
  const dot = document.getElementById('new-dot');
  const count = document.getElementById('count');
  const fullH = item.offsetHeight;
  window.setTime = (t) => {
    const arrive = prog(t, 0.8, 0.7);
    wrap.style.height = (fullH * arrive) + 'px';
    item.style.opacity = arrive;
    item.style.background = t < 2.8
      ? 'rgba(10,108,255,' + (0.10 * arrive * (1 - prog(t, 1.6, 1.0))) + ')'
      : '#EAF1FE';
    count.textContent = arrive > .5 && t < 2.8 ? '2' : '1';

    const move = prog(t, 1.6, 1.1);
    cursor.style.left = lerp(980, 560, move) + 'px';
    cursor.style.top = lerp(560, 150, move) + 'px';
    const press = t > 2.75 && t < 2.95 ? .88 : 1;
    cursor.style.transform = 'scale(' + press + ')';
    const opened = t >= 2.8;
    item.classList.toggle('unread', !opened);
    dot.style.display = opened ? 'none' : '';

    const show = prog(t, 3.0, 0.6);
    read.style.opacity = show;
    read.style.transform = 'translateY(' + lerp(12, 0, show) + 'px)';
    empty.style.opacity = 1 - show;
  };
`;

// ── Public API ───────────────────────────────────────────────────────────────

/** Scenes by name. Phone devices are 410 x 864 CSS px; the laptop is 1460 x 852. */
export const SCENES = {
  "lock-sms": { device: "phone", css: "", html: () => phone(lockScreen({ withEmail: false })), script: PHONE_SCRIPT },
  "lock-email": { device: "phone", css: "", html: () => phone(lockScreen({ withEmail: true })), script: PHONE_SCRIPT },
  "sms-chat": { device: "phone", css: CHAT_CSS, html: () => phone(chatScreen()) },
  "email-open": { device: "phone", css: MAIL_PHONE_CSS, html: () => phone(emailOpenScreen()) },
  "invoice": { device: "laptop", css: MAIL_PHONE_CSS + LAPTOP_CSS, html: laptopScene, script: LAPTOP_SCRIPT },
};

export const DEVICE_SIZE = { phone: [410, 864], laptop: [1460, 852] };

/**
 * Full HTML page for a scene on a `width` x `height` stage, device scaled to `fill` of the stage.
 * `camera` (optional) is a list of { t, x, zoom } keys: at time t, device x-coordinate x is
 * centred and the device is shown `zoom` times larger; moves between keys are eased.
 */
export function buildPage(name, width, height, fill = 0.86, camera = null) {
  const scene = SCENES[name];
  const [dw, dh] = DEVICE_SIZE[scene.device];
  const scale = Math.min((width * fill) / dw, (height * fill) / dh);
  const script = (scene.script ?? "") + (camera ? cameraScript(camera, scale, dw) : "");
  return page({ width, height, css: scene.css, body: fit(scene.html(), scale), script });
}

/** Wraps window.setTime to move the first `.fit` element along the camera keys. */
export function cameraScript(keys, scale, deviceWidth) {
  return `
    (() => {
      const keys = ${JSON.stringify(keys)};
      const fitEl = document.querySelector('.fit');
      const sceneSetTime = window.setTime;
      window.setTime = (t) => {
        sceneSetTime(t);
        let a = keys[0], b = keys[0];
        for (let i = 0; i < keys.length; i++) if (keys[i].t <= t) { a = keys[i]; b = keys[i + 1] ?? keys[i]; }
        const p = b === a ? 1 : prog(t, a.t, b.t - a.t);
        const s = ${scale} * lerp(a.zoom, b.zoom, p);
        const x = lerp(a.x, b.x, p);
        fitEl.style.transform = 'translateX(' + ((${deviceWidth / 2} - x) * s) + 'px) scale(' + s + ')';
      };
    })();`;
}
