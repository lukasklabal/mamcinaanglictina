// Hlas: vybírá nejpřirozenější anglický hlas v zařízení (Premium/Enhanced/Siri/Google/Natural)
// a rozpoznávání řeči pro cvičení výslovnosti.
import { state } from './state.js';

const synth = window.speechSynthesis;
export const canSpeak = !!synth;

let voices = [];
const readyFns = [];

const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|zarvox|trinoids|whisper|jester|organ|superstar|ralph|fred|junior|kathy|princess|grandma|grandpa|eddy|flo\b|reed|rocko|sandy|shelley|good news|hysterical|deranged|pipe|novelty/i;
const MALE = /daniel|alex\b|tom\b|oliver|arthur|aaron|rishi|gordon|guy\b|ryan|thomas|\bmale|christopher|eric|brian|matthew|justin|joey|george|william|james|evan|nathan|lee\b|david|mark\b|liam|fred|male/i;

function voiceScore(v, accent) {
  const lang = (v.lang || '').replace('_', '-').toLowerCase();
  if (!lang.startsWith('en')) return -1;
  const id = `${v.name} ${v.voiceURI}`;
  if (NOVELTY.test(v.name) || /eloquence/i.test(id)) return -1;
  let s = 0;
  if (/premium|prémiov/i.test(id)) s += 130;
  else if (/enhanced|vylepšen/i.test(id)) s += 100;
  if (/siri/i.test(id)) s += 85;
  if (/neural|natural/i.test(id)) s += 95;
  if (/online/i.test(id)) s += 20;
  if (/google/i.test(id)) s += 70;
  if (/compact/i.test(id)) s -= 15;
  if (/^(Samantha|Ava|Allison|Susan|Zoe|Serena|Kate|Daniel|Karen|Moira|Tessa|Evan|Nathan|Tom|Oliver|Arthur|Martha|Catherine|Stephanie|Jamie|Evie|Sonia|Libby|Aria|Jenny|Emma|Ryan)/i.test(v.name)) s += 25;
  if (accent !== 'any' && lang === accent.toLowerCase()) s += 35;
  else if (lang === 'en-gb' || lang === 'en-us') s += 12;
  else if (lang.startsWith('en-in') || lang.startsWith('en-za')) s -= 5;
  return s;
}

function loadVoices() {
  const list = synth ? synth.getVoices() : [];
  if (list.length) {
    voices = list;
    readyFns.splice(0).forEach((f) => f());
  }
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
  // Některé prohlížeče (iOS) události neposílají spolehlivě
  let tries = 0;
  const t = setInterval(() => { loadVoices(); if (voices.length || ++tries > 20) clearInterval(t); }, 250);
}

export const whenVoices = () => new Promise((res) => (voices.length ? res() : readyFns.push(res)));

export function rankedVoices() {
  const accent = state.settings.accent;
  return voices
    .map((v) => ({ v, s: voiceScore(v, accent) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v);
}

export function qualityLabel(v) {
  const id = `${v.name} ${v.voiceURI}`;
  if (/premium|prémiov|neural|natural/i.test(id)) return 'Nejlepší kvalita';
  if (/enhanced|vylepšen|siri|google/i.test(id)) return 'Vysoká kvalita';
  return 'Základní kvalita';
}

export function mainVoice() {
  const ranked = rankedVoices();
  return ranked.find((v) => v.voiceURI === state.settings.voiceURI) || ranked[0] || null;
}

export function partnerVoice() {
  const ranked = rankedVoices();
  const chosen = ranked.find((v) => v.voiceURI === state.settings.partnerVoiceURI);
  if (chosen) return chosen;
  const main = mainVoice();
  if (!main) return null;
  const mainMale = MALE.test(main.name);
  const top = ranked[0] ? voiceScore(ranked[0], state.settings.accent) : 0;
  return ranked.find((v) => v !== main && MALE.test(v.name) !== mainMale && voiceScore(v, state.settings.accent) >= top - 60)
    || ranked.find((v) => v !== main && voiceScore(v, state.settings.accent) >= top - 40)
    || main;
}

const clean = (t) => t.replace(/_{2,}/g, ' … ').replace(/\s\/\s/g, ', ').replace(/\(.*?\)/g, '');

let seq = 0;

export function speak(text, { slow = false, partner = false, onend, rate } = {}) {
  if (!synth || !text) { onend?.(); return; }
  const my = ++seq;
  const u = new SpeechSynthesisUtterance(clean(text));
  const v = partner ? partnerVoice() : mainVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = state.settings.accent === 'en-US' ? 'en-US' : 'en-GB';
  u.rate = rate || (slow ? 0.62 : state.settings.rate);
  u.pitch = 1;
  let ended = false;
  const end = () => { if (ended) return; ended = true; if (my === seq) onend?.(); };
  u.onend = end;
  u.onerror = end;
  // Pojistka, kdyby prohlížeč nevyvolal onend
  const guard = setTimeout(end, 1500 + clean(text).length * 140 / u.rate);
  u.addEventListener('end', () => clearTimeout(guard));
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(() => { if (my === seq) synth.speak(u); }, 60);
  } else {
    synth.speak(u);
  }
}

export function stopSpeaking() {
  seq++;
  synth?.cancel();
}

// Přehraje několik vět za sebou; vrací funkci pro zastavení
export function speakSequence(list, { onItem, onDone } = {}) {
  let i = 0, stopped = false;
  const next = () => {
    if (stopped) return;
    if (i >= list.length) { onDone?.(); return; }
    const it = list[i];
    onItem?.(i);
    i++;
    speak(it.text, { partner: it.partner, onend: () => setTimeout(next, 350) });
  };
  next();
  return () => { stopped = true; stopSpeaking(); };
}

// ---------- Rozpoznávání řeči ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = !!SR;

export function listen({ timeout = 8000 } = {}) {
  stopSpeaking();
  return new Promise((resolve, reject) => {
    let rec;
    try { rec = new SR(); } catch (e) { reject('unsupported'); return; }
    rec.lang = state.settings.accent === 'en-US' ? 'en-US' : 'en-GB';
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.continuous = false;
    let done = false;
    const finish = (fn, val) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { rec.stop(); } catch { /* už neběží */ }
      fn(val);
    };
    rec.onresult = (e) => finish(resolve, Array.from(e.results[0] || []).map((a) => a.transcript));
    rec.onerror = (e) => (e.error === 'no-speech' ? finish(resolve, []) : finish(reject, e.error));
    rec.onend = () => finish(resolve, []);
    const timer = setTimeout(() => finish(resolve, []), timeout);
    try { rec.start(); } catch (e) { finish(reject, 'start-failed'); }
  });
}

const CONTRACTIONS = [
  [/\bi'm\b/g, 'i am'], [/\byou're\b/g, 'you are'], [/\bwe're\b/g, 'we are'], [/\bthey're\b/g, 'they are'],
  [/\bhe's\b/g, 'he is'], [/\bshe's\b/g, 'she is'], [/\bit's\b/g, 'it is'], [/\bthat's\b/g, 'that is'],
  [/\bwhat's\b/g, 'what is'], [/\bthere's\b/g, 'there is'], [/\bi'll\b/g, 'i will'], [/\bwe'll\b/g, 'we will'],
  [/\byou'll\b/g, 'you will'], [/\bi'd\b/g, 'i would'], [/\bdon't\b/g, 'do not'], [/\bdoesn't\b/g, 'does not'],
  [/\bdidn't\b/g, 'did not'], [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'], [/\bwasn't\b/g, 'was not'],
  [/\bcan't\b/g, 'can not'], [/\bcannot\b/g, 'can not'], [/\bwon't\b/g, 'will not'], [/\bi've\b/g, 'i have'],
  [/\bhasn't\b/g, 'has not'], [/\bhaven't\b/g, 'have not'], [/\blet's\b/g, 'let us'],
];
export function normalize(t) {
  let s = t.toLowerCase().replace(/[’‘]/g, "'");
  CONTRACTIONS.forEach(([re, rep]) => { s = s.replace(re, rep); });
  return s.replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Podíl slov cílové věty, která zazněla (0–1)
export function speechMatch(target, alternatives) {
  const want = normalize(target).split(' ').filter(Boolean);
  let best = 0, heard = alternatives[0] || '';
  for (const alt of alternatives) {
    const got = normalize(alt).split(' ');
    const pool = [...got];
    let hit = 0;
    for (const w of want) {
      const i = pool.findIndex((g) => g === w || (w.length > 4 && g.slice(0, 4) === w.slice(0, 4)));
      if (i >= 0) { hit++; pool.splice(i, 1); }
    }
    const score = hit / want.length - Math.max(0, got.length - want.length - 2) * 0.05;
    if (score > best) { best = score; heard = alt; }
  }
  return { score: best, heard };
}
