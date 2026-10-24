// Skládání cvičení do lekcí, opakování, tréninků a testů.
import { UNITS, UNIT_BY_ID, GRAMMAR, GRAMMAR_BY_ID, ITEMS, ALL_WORDS, ALL_PHRASES, VERBS } from './content.js';
import { state, dueIds } from './state.js';
import { shuffle, sample, pick } from './ui.js';

// ---------- Výběr chybných možností ----------
function distractors(item, field, n = 3) {
  const same = item.unit ? UNIT_BY_ID[item.unit][item.kind === 'phrase' ? 'phraseItems' : 'wordItems'] : [];
  const global = item.kind === 'phrase' ? ALL_PHRASES : item.kind === 'verb' ? VERBS : ALL_WORDS;
  const seen = new Set([item[field].toLowerCase()]);
  const out = [];
  for (const c of [...shuffle(same), ...shuffle(global)]) {
    const v = c[field];
    if (!seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); }
    if (out.length >= n) break;
  }
  return out;
}

const opts = (correct, wrong) => shuffle([correct, ...wrong]);

// ---------- Jednotlivá cvičení ----------
export const intro = (item) => ({ type: 'intro', item });

export const mcEnCz = (item) => ({
  type: 'mc', item, skill: 'vocab',
  instruction: 'Co to znamená?',
  prompt: item.en, promptLang: 'en', audio: item.en,
  options: opts(item.cz, distractors(item, 'cz')), correct: item.cz,
});

export const mcCzEn = (item) => ({
  type: 'mc', item, skill: 'vocab',
  instruction: 'Jak se to řekne anglicky?',
  prompt: item.cz, promptLang: 'cz',
  options: opts(item.en, distractors(item, 'en')), correct: item.en, optionLang: 'en',
  after: item.en,
});

export const listenWord = (item) => ({
  type: 'mc', item, skill: 'listening',
  instruction: 'Poslechněte si a vyberte, co zaznělo',
  audio: item.en, hideText: true,
  options: opts(item.en, distractors(item, 'en')), correct: item.en, optionLang: 'en',
});

export const listenMeaning = (item) => ({
  type: 'mc', item, skill: 'listening',
  instruction: 'Poslechněte si. Co to znamená?',
  audio: item.en, hideText: true, reveal: item.en,
  options: opts(item.cz, distractors(item, 'cz')), correct: item.cz,
});

export function build(src, { audioOnly = false, skill } = {}) {
  const words = src.en.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
  const extra = [];
  if (words.length <= 6) {
    const pool = [...ALL_PHRASES, ...GRAMMAR.flatMap((g) => g.sentences.map(([en]) => ({ en })))]
      .flatMap((p) => p.en.replace(/[.,!?]/g, '').split(/\s+/))
      .filter((w) => w.length > 2 && !words.some((x) => x.toLowerCase() === w.toLowerCase()));
    extra.push(...sample(pool, words.length <= 3 ? 1 : 2).map((w) => w.toLowerCase()));
  }
  return {
    type: 'build', item: src.id ? src : null, skill: skill || (audioOnly ? 'listening' : 'grammar'),
    target: src.en, cz: src.cz, audioOnly,
    tiles: shuffle([...words, ...extra]),
  };
}

export const speakStep = (src) => ({ type: 'speak', item: src.id ? src : null, skill: 'speaking', text: src.en, cz: src.cz });

export const match = (items) => ({ type: 'match', skill: 'vocab', items: items.slice(0, 6) });

export function gap([sentence, options, cz]) {
  return {
    type: 'mc', skill: 'grammar', gap: true,
    instruction: 'Doplňte správný tvar',
    prompt: sentence, promptLang: 'en', hint: cz,
    options: shuffle(options), correct: options[0], optionLang: 'en',
    after: sentence.replace(/_{2,}/, options[0]),
  };
}

export function whichTense(sentence, topicId, cz) {
  const right = GRAMMAR_BY_ID[topicId];
  const wrong = sample(GRAMMAR.filter((g) => g.id !== topicId), 2);
  return {
    type: 'mc', skill: 'grammar',
    instruction: 'Který čas je v této větě?',
    prompt: sentence, promptLang: 'en', audio: sentence, hint: cz,
    options: shuffle([right, ...wrong].map((g) => `${g.title} (${g.en})`)), correct: `${right.title} (${right.en})`,
  };
}

const firstForm = (s) => s.split(' / ')[0];

export function verbPast(v) {
  return {
    type: 'mc', item: v, skill: 'grammar',
    instruction: `Jaký je minulý čas slovesa „${v.en}“ (${v.cz})?`,
    prompt: v.en, promptLang: 'en', audio: v.en,
    options: shuffle([v.past, ...v.wrong.slice(0, 2)]), correct: v.past, optionLang: 'en',
    after: `${v.en}, ${firstForm(v.past)}, ${v.pp}`,
  };
}

export function verbMeaning(v) {
  const wrong = sample(VERBS.filter((x) => x !== v), 3).map((x) => x.cz);
  return {
    type: 'mc', item: v, skill: 'vocab',
    instruction: 'Ze kterého slovesa je tento minulý tvar?',
    prompt: v.past, promptLang: 'en', audio: firstForm(v.past),
    options: shuffle([v.cz, ...wrong]), correct: v.cz,
    after: `${v.en}, ${firstForm(v.past)}, ${v.pp}`,
  };
}

export function storyQuestion(story, [q, options]) {
  return {
    type: 'mc', skill: 'reading',
    instruction: `Otázka k příběhu „${story.title}“`,
    prompt: q, promptLang: 'cz',
    options: shuffle(options), correct: options[0],
  };
}

// ---------- Zásobník položek ----------
function seenItems(kinds = ['word', 'phrase']) {
  return Object.keys(state.items).map((id) => ITEMS[id]).filter((it) => it && kinds.includes(it.kind));
}

// Naučené položky; když jich je málo, doplní z prvních témat
function practicePool(kinds = ['word', 'phrase'], min = 10) {
  const pool = seenItems(kinds);
  if (pool.length >= min) return pool;
  const extra = UNITS.flatMap((u) => [
    ...(kinds.includes('word') ? u.wordItems : []),
    ...(kinds.includes('phrase') ? u.phraseItems : []),
  ]).filter((it) => !pool.includes(it));
  return [...pool, ...extra.slice(0, min - pool.length)];
}

function exerciseFor(item, { allowSpeak = true } = {}) {
  if (item.kind === 'verb') return pick([verbPast, verbMeaning])(item);
  const box = state.items[item.id]?.box || 0;
  if (item.kind === 'word') {
    const list = [mcEnCz, mcCzEn, listenWord];
    if (box >= 3) list.push(mcCzEn);
    if (allowSpeak && box >= 2) list.push(speakStep);
    return pick(list)(item);
  }
  const list = [mcCzEn, (i) => build(i), listenMeaning];
  if (box >= 2) list.push((i) => build(i, { audioOnly: true }));
  if (allowSpeak && box >= 2) list.push(speakStep);
  return pick(list)(item);
}

// ---------- Lekce témat ----------
export function buildLesson(unitId, lessonId) {
  const u = UNIT_BY_ID[unitId];
  const steps = [];
  if (lessonId === 'words1' || lessonId === 'words2') {
    const ws = lessonId === 'words1' ? u.wordItems.slice(0, 6) : u.wordItems.slice(6, 12);
    for (let i = 0; i < ws.length; i += 2) {
      steps.push(intro(ws[i]), intro(ws[i + 1]), mcEnCz(ws[i]), mcCzEn(ws[i + 1]));
    }
    steps.push(match(ws));
    sample(ws, 2).forEach((w) => steps.push(listenWord(w)));
    steps.push(speakStep(pick(ws)));
    steps.push(mcCzEn(pick(ws)));
  } else if (lessonId === 'phrases') {
    const ps = u.phraseItems;
    steps.push({ type: 'tip', tip: u.tip });
    steps.push(intro(ps[0]), intro(ps[1]), mcCzEn(ps[0]), build(ps[1]));
    steps.push(intro(ps[2]), intro(ps[3]), listenMeaning(ps[2]), build(ps[3]));
    steps.push(intro(ps[4]), intro(ps[5]), mcCzEn(ps[4]), speakStep(ps[5]));
    steps.push(build(pick(ps), { audioOnly: true }));
  } else if (lessonId === 'dialogue') {
    const bLines = u.dialogue.lines.filter((l) => l[0] === 'B').map(([, en, cz]) => ({ en, cz }));
    steps.push({ type: 'dialogue', unit: u });
    sample(bLines, 2).forEach((l) => steps.push(build(l, { skill: 'conversation' })));
    steps.push(speakStep(pick(bLines)));
  } else if (lessonId === 'story') {
    steps.push({ type: 'read', unit: u });
    u.story.questions.forEach((q) => steps.push(storyQuestion(u.story, q)));
    const line = pick(u.story.lines);
    steps.push(build({ en: line[0], cz: line[1] }, { audioOnly: true }));
  } else if (lessonId === 'test') {
    return buildUnitTest(u);
  }
  return steps;
}

function buildUnitTest(u) {
  const ws = sample(u.wordItems, 6), ps = sample(u.phraseItems, 4);
  return [
    mcEnCz(ws[0]), mcCzEn(ws[1]), listenWord(ws[2]), mcEnCz(ws[3]), mcCzEn(ws[4]),
    listenMeaning(ps[0]), build(ps[1]), mcCzEn(ps[2]), build(ps[3], { audioOnly: true }),
    storyQuestion(u.story, pick(u.story.questions)),
  ];
}

// ---------- Opakování ----------
export function buildReview(limit = 12) {
  const ids = dueIds().slice(0, limit);
  let items = ids.map((id) => ITEMS[id]);
  let weak = false;
  if (items.length < 4) {
    // Nic k opakování – procvičíme nejslabší naučené položky
    weak = true;
    const extra = seenItems(['word', 'phrase', 'verb'])
      .filter((it) => !items.includes(it))
      .sort((a, b) => (state.items[a.id].box - state.items[b.id].box) || (state.items[b.id].w - state.items[a.id].w));
    items = [...items, ...extra.slice(0, 8 - items.length)];
  }
  if (!items.length) items = UNITS[0].wordItems.slice(0, 6);
  const steps = shuffle(items).map((it) => exerciseFor(it));
  const words = items.filter((i) => i.kind === 'word');
  if (words.length >= 4) steps.splice(Math.min(4, steps.length), 0, match(sample(words, Math.min(6, words.length))));
  return { steps, weak };
}

// ---------- Trénink ----------
export function buildPractice(mode) {
  if (mode === 'listening') {
    const pool = practicePool(['word', 'phrase'], 12);
    return sample(pool, 10).map((it) => (it.kind === 'word' ? listenWord(it) : pick([listenMeaning, (i) => build(i, { audioOnly: true })])(it)));
  }
  if (mode === 'speaking') {
    const pool = practicePool(['phrase', 'word'], 10);
    return sample(pool, 6).map(speakStep);
  }
  if (mode === 'builder') {
    const phrases = practicePool(['phrase'], 8);
    const sentences = GRAMMAR.flatMap((g) => g.sentences.map(([en, cz]) => ({ en, cz })));
    return [...sample(phrases, 5).map((p) => build(p)), ...sample(sentences, 3).map((s) => build(s))];
  }
  if (mode === 'pairs') {
    const pool = practicePool(['word'], 18);
    return [0, 1, 2].map(() => match(sample(pool, 6)));
  }
  if (mode === 'verbs') {
    return sample(VERBS, 12).map((v, i) => (i % 3 === 2 ? verbMeaning(v) : verbPast(v)));
  }
  return [];
}

export function buildGrammar(topicId) {
  const g = GRAMMAR_BY_ID[topicId];
  const steps = sample(g.exercises, 8).map(gap);
  sample(g.sentences, 2).forEach((s) => steps.splice(((Math.random() * steps.length) | 0) + 1, 0, build({ en: s[0], cz: s[1] })));
  return steps;
}

// ---------- Testy ----------
export function buildBigTest() {
  const words = sample(ALL_WORDS, 12), phrases = sample(ALL_PHRASES, 6);
  const gaps = sample(GRAMMAR.flatMap((g) => g.exercises), 4);
  return shuffle([
    ...words.slice(0, 5).map(mcEnCz), ...words.slice(5, 8).map(mcCzEn), ...words.slice(8, 10).map(listenWord),
    ...phrases.slice(0, 2).map(listenMeaning), ...phrases.slice(2, 4).map((p) => build(p)), ...phrases.slice(4, 6).map(mcCzEn),
    ...gaps.map(gap),
  ]);
}

export function buildTenseTest() {
  const gaps = GRAMMAR.flatMap((g) => sample(g.exercises, 2).map(gap));
  const which = sample(GRAMMAR.flatMap((g) => g.examples.map(([en, cz]) => ({ en, cz, id: g.id }))), 5)
    .map((x) => whichTense(x.en, x.id, x.cz));
  return shuffle([...gaps, ...which]);
}

export function buildListeningTest() {
  const pool = practicePool(['word', 'phrase'], 20);
  return sample(pool, 12).map((it) => (it.kind === 'word' ? listenWord(it) : pick([listenMeaning, (i) => build(i, { audioOnly: true })])(it)));
}

// Rychlovka – nekonečný proud rychlých otázek
export function speedQuestion() {
  const pool = practicePool(['word'], 30);
  const it = pick(pool);
  return Math.random() < 0.5 ? mcEnCz(it) : mcCzEn(it);
}

export function levelFromPct(p) {
  if (p >= 90) return { code: 'A2+', text: 'Výborné! Blížíte se úrovni B1.' };
  if (p >= 75) return { code: 'A2', text: 'Mírně pokročilá – zvládnete běžné situace.' };
  if (p >= 55) return { code: 'A1+', text: 'Pevné základy, jen tak dál!' };
  if (p >= 35) return { code: 'A1', text: 'Dobrý začátek – každý den kousek.' };
  return { code: 'A0', text: 'Začátky bývají těžké. Lekce vám pomohou.' };
}
