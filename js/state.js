// Uložený stav aplikace (localStorage), body, úrovně, série a opakování v intervalech.
import { ITEMS, UNITS, LESSONS } from './content.js';

const KEY = 'lenka-english-v1';
// Po kolika dnech se položka vrací k opakování podle „krabičky“ (0–6)
const INTERVALS = [0, 1, 2, 4, 8, 16, 35];

function defaults() {
  return {
    v: 1,
    created: Date.now(),
    settings: {
      name: 'Lenka',
      nameVoc: 'Lenko',
      theme: 'auto',
      fontScale: 1,
      accent: 'en-GB',
      voiceURI: '',
      partnerVoiceURI: '',
      rate: 0.92,
      autoPlay: true,
      sounds: true,
      haptics: true,
      dailyGoal: 50,
    },
    xp: 0,
    daily: {},
    skills: { vocab: 0, listening: 0, speaking: 0, grammar: 0, conversation: 0, reading: 0 },
    items: {},
    units: {},
    tests: [],
    badges: {},
    cando: {},
    stats: {
      answers: 0, correct: 0, bySkill: {}, sessions: 0, perfect: 0,
      dialogues: 0, stories: 0, speaking: 0, listeningCorrect: 0, irregularCorrect: 0,
      speedBest: 0, bigTestBest: 0, grammar: {}, bestStreak: 0, goalDays: 0,
      early: false, night: false, comeback: false, lastActive: null,
    },
    ui: { installDismissed: false },
  };
}

function merge(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  for (const k of Object.keys(saved)) {
    const b = base[k], s = saved[k];
    base[k] = b && typeof b === 'object' && !Array.isArray(b) && s && typeof s === 'object' && !Array.isArray(s)
      ? merge(b, s) : s;
  }
  return base;
}

function load() {
  try {
    return merge(defaults(), JSON.parse(localStorage.getItem(KEY) || 'null'));
  } catch {
    return defaults();
  }
}

export let state = load();

const listeners = new Set();
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* plné úložiště */ }
  listeners.forEach((fn) => fn());
}

export function replaceState(data) {
  state = merge(defaults(), data);
  save();
}

export function resetState() {
  const keepSettings = state.settings;
  state = defaults();
  state.settings = keepSettings;
  save();
}

// ---------- Dny ----------
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}
export const today = () => dayKey();

export function dayRec(key = today()) {
  return (state.daily[key] ||= { xp: 0, sec: 0, correct: 0, wrong: 0, sessions: 0, done: {} });
}

export function streak() {
  let key = today();
  if (!(state.daily[key]?.xp > 0)) key = addDays(key, -1);
  let n = 0;
  while (state.daily[key]?.xp > 0) { n++; key = addDays(key, -1); }
  return n;
}
export const practicedToday = () => (state.daily[today()]?.xp || 0) > 0;

// ---------- Body a úrovně ----------
const LEVEL_NAMES = [
  'Začátečnice', 'Zvědavá žačka', 'Odvážná studentka', 'Objevitelka slov', 'Cestovatelka',
  'Konverzátorka', 'Znalkyně frází', 'Sebevědomá mluvčí', 'Světoběžnice', 'Angličtinářka',
];
const levelNeed = (l) => 50 * (l - 1) * l;

export function levelInfo(xp = state.xp) {
  let l = 1;
  while (xp >= levelNeed(l + 1)) l++;
  const cur = levelNeed(l), next = levelNeed(l + 1);
  const name = l >= 15 ? 'Mistryně angličtiny' : LEVEL_NAMES[Math.min(l, LEVEL_NAMES.length) - 1];
  return { level: l, name, cur, next, into: xp - cur, span: next - cur, pct: (xp - cur) / (next - cur) };
}

const SKILL_STEPS = [0, 40, 100, 200, 350, 550, 800, 1100, 1500, 2000];
export function skillLevel(xp) {
  let l = 1;
  while (l < SKILL_STEPS.length && xp >= SKILL_STEPS[l]) l++;
  if (l >= SKILL_STEPS.length) return { level: 10, pct: 1, max: true };
  const lo = SKILL_STEPS[l - 1], hi = SKILL_STEPS[l];
  return { level: l, pct: (xp - lo) / (hi - lo), toNext: hi - xp };
}

export function addXP(n, skill) {
  const d = dayRec();
  const before = d.xp;
  state.xp += n;
  d.xp += n;
  if (skill && skill in state.skills) state.skills[skill] += n;
  const goal = state.settings.dailyGoal;
  if (before < goal && d.xp >= goal) {
    d.goalMet = true;
    state.stats.goalDays++;
    return { goalJustMet: true };
  }
  return {};
}

// ---------- Opakování (SRS) ----------
export function markSeen(id) {
  if (!state.items[id]) state.items[id] = { box: 1, due: addDays(today(), 1), c: 0, w: 0, seen: today() };
}

export function recordAnswer({ itemId, correct, skill }) {
  const s = state.stats, d = dayRec();
  s.answers++;
  if (correct) { s.correct++; d.correct++; } else d.wrong++;
  if (skill) {
    const b = (s.bySkill[skill] ||= { c: 0, w: 0 });
    correct ? b.c++ : b.w++;
    if (skill === 'listening' && correct) s.listeningCorrect++;
  }
  if (itemId && ITEMS[itemId]) {
    if (itemId.startsWith('v:') && correct) s.irregularCorrect++;
    const t = today();
    const r = (state.items[itemId] ||= { box: 0, due: t, c: 0, w: 0, seen: t });
    if (correct) {
      r.c++;
      if (r.up !== t) { r.box = Math.min(6, r.box + 1); r.up = t; }
      r.due = addDays(t, INTERVALS[r.box]);
    } else {
      r.w++;
      r.box = 1;
      r.up = t;
      r.due = t;
    }
  }
}

export function itemStatus(id) {
  const r = state.items[id];
  if (!r) return 'new';
  if (r.box >= 5) return 'mastered';
  if (r.box >= 2) return 'known';
  return 'learning';
}

export const learnedCount = () => Object.values(state.items).filter((r) => r.box >= 2).length;

export function dueIds() {
  const t = today();
  return Object.entries(state.items)
    .filter(([id, r]) => ITEMS[id] && r.due <= t)
    .sort((a, b) => (a[1].due === b[1].due ? a[1].box - b[1].box : a[1].due < b[1].due ? -1 : 1))
    .map(([id]) => id);
}

// ---------- Lekce a testy ----------
export const unitRec = (id) => (state.units[id] ||= { done: {}, testBest: 0 });

export function unitProgress(unitId) {
  const r = state.units[unitId];
  const done = r ? LESSONS.filter((l) => r.done[l.id]).length : 0;
  return { done, total: LESSONS.length, complete: done === LESSONS.length };
}

export function nextLesson() {
  for (const u of UNITS) {
    const r = state.units[u.id];
    const l = LESSONS.find((l) => !r?.done[l.id]);
    if (l) return { unit: u, lesson: l };
  }
  return null;
}

export const completedUnits = () => UNITS.filter((u) => unitProgress(u.id).complete).length;

export function saveTest(type, pct, extra = {}) {
  state.tests.unshift({ type, pct, date: Date.now(), ...extra });
  state.tests = state.tests.slice(0, 60);
}

export function totalMinutes() {
  return Math.round(Object.values(state.daily).reduce((a, d) => a + (d.sec || 0), 0) / 60);
}
