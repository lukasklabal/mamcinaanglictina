// Index veškerého obsahu: položky pro opakování (slovíčka, fráze, slovesa) a lekce témat.
import { UNITS } from './data/units.js';
import { GRAMMAR, IRREGULAR, IRREGULAR_WRONG } from './data/grammar.js';

export { UNITS, GRAMMAR };

export const ITEMS = {};

UNITS.forEach((u, index) => {
  u.index = index;
  u.wordItems = u.words.map(([en, cz, ex, exCz], i) =>
    (ITEMS[`${u.id}:w${i}`] = { id: `${u.id}:w${i}`, kind: 'word', unit: u.id, en, cz, ex, exCz }));
  u.phraseItems = u.phrases.map(([en, cz], i) =>
    (ITEMS[`${u.id}:p${i}`] = { id: `${u.id}:p${i}`, kind: 'phrase', unit: u.id, en, cz }));
});

export const VERBS = IRREGULAR.map(([en, past, pp, cz]) =>
  (ITEMS[`v:${en}`] = { id: `v:${en}`, kind: 'verb', en, past, pp, cz, wrong: IRREGULAR_WRONG[en] || [] }));

export const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u]));
export const GRAMMAR_BY_ID = Object.fromEntries(GRAMMAR.map((g) => [g.id, g]));

export const ALL_WORDS = UNITS.flatMap((u) => u.wordItems);
export const ALL_PHRASES = UNITS.flatMap((u) => u.phraseItems);
export const LEARNABLE = [...ALL_WORDS, ...ALL_PHRASES, ...VERBS];

export const LESSONS = [
  { id: 'words1', title: 'Slovíčka I', desc: 'Prvních 6 slovíček', emoji: '🔤', min: 5 },
  { id: 'words2', title: 'Slovíčka II', desc: 'Dalších 6 slovíček', emoji: '🔠', min: 5 },
  { id: 'phrases', title: 'Užitečné fráze', desc: 'Věty do praxe + gramatický tip', emoji: '💡', min: 6 },
  { id: 'dialogue', title: 'Rozhovor', desc: 'Zahrajte si skutečnou situaci', emoji: '💬', min: 4 },
  { id: 'story', title: 'Příběh', desc: 'Čtení s poslechem', emoji: '📖', min: 4 },
  { id: 'test', title: 'Test tématu', desc: 'Ověřte si, co umíte', emoji: '🏁', min: 4 },
];

export const SKILLS = [
  { id: 'vocab', name: 'Slovní zásoba', emoji: '📚', color: '#6366F1' },
  { id: 'listening', name: 'Poslech', emoji: '🎧', color: '#0EA5E9' },
  { id: 'speaking', name: 'Výslovnost', emoji: '🗣️', color: '#EC4899' },
  { id: 'grammar', name: 'Gramatika', emoji: '🧩', color: '#F59E0B' },
  { id: 'conversation', name: 'Konverzace', emoji: '💬', color: '#10B981' },
  { id: 'reading', name: 'Čtení', emoji: '📖', color: '#A855F7' },
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
