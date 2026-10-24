// Drobné UI pomůcky: tvorba DOM, ikony, zvuky, vibrace, toasty, spodní panely a konfety.
import { state } from './state.js';
import { speak } from './speech.js';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [p, val] of Object.entries(v)) {
          if (val == null) continue;
          if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val;
        }
      }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 20z"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  target: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.5"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  settings: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  play: '<path d="M6 3.5v17a.5.5 0 0 0 .76.43l14-8.5a.5.5 0 0 0 0-.86l-14-8.5A.5.5 0 0 0 6 3.5z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 16v-4M12 8h.01"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
  translate: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
};

export function icon(name, size = 24, cls = '') {
  const span = document.createElement('span');
  span.className = `ic ${cls}`;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || ''}</svg>`;
  return span;
}

// Tlačítko pro přehrání anglického textu (+ volitelně pomalu)
export function speakBtn(text, { size = 'md', slow = true, partner = false, label } = {}) {
  const wrap = h('span', { class: `speak speak-${size}` });
  const play = (isSlow) => (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    btn.classList.add('playing');
    speak(text, { slow: isSlow, partner, onend: () => btn.classList.remove('playing') });
  };
  wrap.append(h('button', { class: 'speak-btn', type: 'button', 'aria-label': label || `Přehrát: ${text}`, onclick: play(false) }, icon('volume', size === 'lg' ? 30 : size === 'sm' ? 18 : 22)));
  if (slow) wrap.append(h('button', { class: 'speak-btn slow', type: 'button', 'aria-label': 'Přehrát pomalu', onclick: play(true) }, '🐢'));
  return wrap;
}

// ---------- Zvuky ----------
let actx;
function tone(freqs, { type = 'sine', dur = 0.12, gap = 0.09, vol = 0.12 } = {}) {
  if (!state.settings.sounds) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t0 = actx.currentTime + 0.01;
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type;
      o.frequency.value = f;
      const s = t0 + i * gap;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(vol, s + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s + dur + 0.2);
      o.connect(g).connect(actx.destination);
      o.start(s);
      o.stop(s + dur + 0.25);
    });
  } catch { /* zvuk není k dispozici */ }
}
export const sfx = {
  correct: () => tone([659.25, 987.77], { dur: 0.1, gap: 0.08 }),
  wrong: () => tone([220, 196], { type: 'triangle', dur: 0.14, gap: 0.12, vol: 0.1 }),
  tap: () => tone([880], { dur: 0.03, vol: 0.04 }),
  finish: () => tone([523.25, 659.25, 783.99, 1046.5], { dur: 0.16, gap: 0.11 }),
  badge: () => tone([783.99, 1046.5, 1318.5], { dur: 0.2, gap: 0.13, vol: 0.1 }),
};

export function vibrate(pattern) {
  if (state.settings.haptics && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* nepodporováno */ }
  }
}

// ---------- Toast ----------
export function toast(text, { emoji = '', ms = 2600 } = {}) {
  const el = h('div', { class: 'toast', role: 'status' }, emoji && h('span', { class: 'toast-emoji' }, emoji), text);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, ms);
}

// ---------- Spodní panel (sheet) ----------
export function sheet(content, { onClose, dismissable = true } = {}) {
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'sheet-grip' }), content);
  const close = () => {
    backdrop.classList.remove('show');
    panel.classList.remove('show');
    setTimeout(() => { backdrop.remove(); panel.remove(); }, 300);
    onClose?.();
  };
  if (dismissable) backdrop.addEventListener('click', close);
  document.body.append(backdrop, panel);
  requestAnimationFrame(() => { backdrop.classList.add('show'); panel.classList.add('show'); });
  return close;
}

export function confirmSheet({ title, text, ok = 'Ano', cancel = 'Zrušit', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const close = sheet(h('div', { class: 'sheet-body' },
      h('h3', { class: 'sheet-title' }, title),
      text && h('p', { class: 'muted' }, text),
      h('div', { class: 'stack' },
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block`, onclick: () => { result = true; close(); } }, ok),
        h('button', { class: 'btn btn-ghost btn-block', onclick: () => close() }, cancel)),
    ), { onClose: () => resolve(result) });
  });
}

// ---------- Konfety ----------
export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = h('canvas', { class: 'confetti' });
  document.body.append(c);
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ['#6D5DFC', '#FF7A59', '#22C55E', '#FACC15', '#38BDF8', '#EC4899'];
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 13 - 4,
    r: Math.random() * 6 + 4,
    rot: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  const start = performance.now();
  (function frame(t) {
    const el = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - el / 2800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    });
    if (el < 2800) requestAnimationFrame(frame); else c.remove();
  })(start);
}

// ---------- Pomůcky ----------
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const sample = (arr, n) => shuffle(arr).slice(0, n);

// Kruhový ukazatel postupu (SVG)
export function ring(pct, { size = 88, stroke = 9, cls = '', label } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  const wrap = h('div', { class: `ring ${cls}`, style: { width: `${size}px`, height: `${size}px` } });
  wrap.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" class="ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  if (label != null) wrap.append(h('div', { class: 'ring-label' }, label));
  return wrap;
}

export function progressBar(pct, color) {
  return h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: { width: `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`, background: color || null } }));
}

export function plural(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
