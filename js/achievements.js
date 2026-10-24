// Odznaky (sbírka) a jejich podmínky.
import { state, streak, learnedCount, completedUnits, save } from './state.js';
import { GRAMMAR } from './content.js';

export const BADGES = [
  { id: 'first', emoji: '🌱', name: 'První krůček', desc: 'Dokončit první lekci', test: (s) => s.sessions >= 1 },
  { id: 'streak3', emoji: '🔥', name: 'Rozehřátá', desc: '3 dny učení v řadě', test: (s) => s.bestStreak >= 3 },
  { id: 'streak7', emoji: '🔥', name: 'Celý týden', desc: '7 dní učení v řadě', test: (s) => s.bestStreak >= 7 },
  { id: 'streak14', emoji: '⚡', name: 'Dva týdny', desc: '14 dní učení v řadě', test: (s) => s.bestStreak >= 14 },
  { id: 'streak30', emoji: '🏆', name: 'Měsíc vytrvalosti', desc: '30 dní učení v řadě', test: (s) => s.bestStreak >= 30 },
  { id: 'words25', emoji: '📗', name: 'Prvních 25', desc: 'Naučit se 25 slovíček a frází', test: () => learnedCount() >= 25 },
  { id: 'words50', emoji: '📘', name: 'Padesátka', desc: 'Naučit se 50 slovíček a frází', test: () => learnedCount() >= 50 },
  { id: 'words100', emoji: '📙', name: 'Stovka', desc: 'Naučit se 100 slovíček a frází', test: () => learnedCount() >= 100 },
  { id: 'words200', emoji: '📚', name: 'Knihovnice', desc: 'Naučit se 200 slovíček a frází', test: () => learnedCount() >= 200 },
  { id: 'perfect', emoji: '💎', name: 'Bez chybičky', desc: 'Lekce úplně bez chyby', test: (s) => s.perfect >= 1 },
  { id: 'perfect10', emoji: '👑', name: 'Perfekcionistka', desc: '10 lekcí bez chyby', test: (s) => s.perfect >= 10 },
  { id: 'xp1000', emoji: '⭐', name: 'Tisícovka', desc: 'Získat 1 000 XP', test: () => state.xp >= 1000 },
  { id: 'xp5000', emoji: '🌟', name: 'Hvězda', desc: 'Získat 5 000 XP', test: () => state.xp >= 5000 },
  { id: 'early', emoji: '🐦', name: 'Ranní ptáče', desc: 'Učit se před 8. hodinou ranní', test: (s) => s.early },
  { id: 'night', emoji: '🦉', name: 'Noční sova', desc: 'Učit se po 21. hodině', test: (s) => s.night },
  { id: 'listener', emoji: '🎧', name: 'Bystré ucho', desc: '50 správných odpovědí v poslechu', test: (s) => s.listeningCorrect >= 50 },
  { id: 'speaker', emoji: '🗣️', name: 'Mluvka', desc: '25 cvičení výslovnosti', test: (s) => s.speaking >= 25 },
  { id: 'chatter', emoji: '💬', name: 'Společnice', desc: 'Zvládnout 5 rozhovorů', test: (s) => s.dialogues >= 5 },
  { id: 'reader', emoji: '📖', name: 'Čtenářka', desc: 'Přečíst 5 příběhů', test: (s) => s.stories >= 5 },
  { id: 'tenses', emoji: '⏱️', name: 'Vládkyně času', desc: 'Procvičit všech 5 časů', test: (s) => GRAMMAR.every((g) => s.grammar[g.id]) },
  { id: 'verbs', emoji: '🧠', name: 'Nepravidelná, ale moje', desc: '50× správně nepravidelné sloveso', test: (s) => s.irregularCorrect >= 50 },
  { id: 'unit1', emoji: '🎓', name: 'První téma', desc: 'Dokončit celé téma', test: () => completedUnits() >= 1 },
  { id: 'unit6', emoji: '🗺️', name: 'Půlka mapy', desc: 'Dokončit 6 témat', test: () => completedUnits() >= 6 },
  { id: 'unit12', emoji: '🏅', name: 'Celá mapa', desc: 'Dokončit všech 12 témat', test: () => completedUnits() >= 12 },
  { id: 'speed15', emoji: '⚡', name: 'Blesková', desc: '15 bodů v Rychlovce', test: (s) => s.speedBest >= 15 },
  { id: 'test80', emoji: '🎯', name: 'Ostrostřelkyně', desc: 'Velký test na 80 % a víc', test: (s) => s.bigTestBest >= 80 },
  { id: 'goal7', emoji: '✅', name: 'Spolehlivá', desc: 'Splnit denní cíl 7×', test: (s) => s.goalDays >= 7 },
  { id: 'comeback', emoji: '🤗', name: 'Vítejte zpět', desc: 'Vrátit se k učení po pauze', test: (s) => s.comeback },
];

// Vrátí nově získané odznaky
export function checkBadges() {
  const s = state.stats;
  s.bestStreak = Math.max(s.bestStreak, streak());
  const fresh = [];
  for (const b of BADGES) {
    if (!state.badges[b.id] && b.test(s)) {
      state.badges[b.id] = Date.now();
      fresh.push(b);
    }
  }
  if (fresh.length) save();
  return fresh;
}
