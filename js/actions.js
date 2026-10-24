// Spouštění lekcí, tréninků a testů + co se má po jejich dokončení uložit.
import { UNIT_BY_ID, LESSONS, GRAMMAR_BY_ID, GRAMMAR } from './content.js';
import { state, save, unitRec, dayRec, saveTest, nextLesson, dueIds } from './state.js';
import { startSession } from './session.js';
import * as G from './generators.js';
import { rerender } from './router.js';

const markPlan = (plan, value = true) => { if (plan) dayRec().done[plan] = value; };

export function startLesson(unitId, lessonId) {
  const u = UNIT_BY_ID[unitId];
  const lesson = LESSONS.find((l) => l.id === lessonId);
  startSession({
    title: `${u.title} – ${lesson.title}`,
    mode: lessonId === 'test' ? 'test' : 'lesson',
    steps: G.buildLesson(unitId, lessonId),
    onClose: rerender,
    onFinish: (r) => {
      const rec = unitRec(unitId);
      if (lessonId === 'test') {
        saveTest('unit', r.pct, { unit: unitId });
        const prevBest = rec.testBest;
        rec.testBest = Math.max(rec.testBest, r.pct);
        if (r.pct >= 70) {
          rec.done.test = true;
          markPlan('lesson', `${u.title}: ${lesson.title}`);
          const fresh = u.canDo.filter((c) => !state.cando[c]);
          fresh.forEach((c) => { state.cando[c] = Date.now(); });
          return { cando: fresh, message: 'Test splněn! Téma máte zvládnuté.', best: prevBest ? `Váš předchozí nejlepší výsledek: ${prevBest} %` : null };
        }
        return { message: 'Na splnění testu je potřeba 70 %. Zopakujte si lekce a zkuste to znovu – zvládnete to!' };
      }
      rec.done[lessonId] = true;
      markPlan('lesson', `${u.title}: ${lesson.title}`);
      return {};
    },
  });
}

export function startReview(plan = 'review') {
  const { steps, weak } = G.buildReview();
  startSession({
    title: 'Opakování',
    mode: 'practice',
    steps,
    onClose: rerender,
    onFinish: () => { markPlan(plan); return weak ? { message: 'Procvičily jsme slovíčka, která vám dělají největší potíže.' } : {}; },
  });
}

export function startPractice(mode, plan) {
  const titles = { listening: 'Poslech', speaking: 'Výslovnost', builder: 'Skládání vět', pairs: 'Dvojice', verbs: 'Nepravidelná slovesa' };
  startSession({
    title: titles[mode],
    mode: 'practice',
    steps: G.buildPractice(mode),
    onClose: rerender,
    onFinish: () => { markPlan(plan); return {}; },
  });
}

export function startGrammar(topicId, plan) {
  const g = GRAMMAR_BY_ID[topicId];
  startSession({
    title: g.title,
    mode: 'practice',
    steps: G.buildGrammar(topicId),
    onClose: rerender,
    onFinish: () => { state.stats.grammar[topicId] = true; markPlan(plan); return {}; },
  });
}

export function startDialogue(unitId, plan) {
  startSession({
    title: 'Rozhovor',
    mode: 'practice',
    steps: G.buildLesson(unitId, 'dialogue'),
    onClose: rerender,
    onFinish: () => { markPlan(plan); return {}; },
  });
}

export function startStory(unitId, plan) {
  startSession({
    title: 'Příběh',
    mode: 'practice',
    steps: G.buildLesson(unitId, 'story'),
    onClose: rerender,
    onFinish: () => { markPlan(plan); return {}; },
  });
}

export function startTest(type, plan) {
  if (type === 'speed') {
    const prev = state.stats.speedBest;
    startSession({
      title: 'Rychlovka', mode: 'speed', timeLimit: 60, steps: [], generator: G.speedQuestion,
      onClose: rerender,
      onFinish: (r) => {
        saveTest('speed', r.ok, {});
        state.stats.speedBest = Math.max(prev, r.ok);
        markPlan(plan);
        return {
          message: r.ok > prev ? (prev ? `Nový osobní rekord! Předtím ${prev}.` : 'První rekord je na světě!') : `Váš rekord je ${prev}. Zkuste ho překonat!`,
        };
      },
    });
    return;
  }
  const conf = {
    big: { title: 'Velký test', steps: G.buildBigTest() },
    tenses: { title: 'Test časů', steps: G.buildTenseTest() },
    listening: { title: 'Poslechový test', steps: G.buildListeningTest() },
  }[type];
  startSession({
    title: conf.title, mode: 'test', steps: conf.steps,
    onClose: rerender,
    onFinish: (r) => {
      const prev = state.tests.filter((t) => t.type === type).reduce((m, t) => Math.max(m, t.pct), 0);
      saveTest(type, r.pct);
      markPlan(plan);
      if (type === 'tenses') GRAMMAR.forEach((g) => { state.stats.grammar[g.id] = true; });
      if (type === 'big') {
        state.stats.bigTestBest = Math.max(state.stats.bigTestBest, r.pct);
        return { level: G.levelFromPct(r.pct), best: prev ? `Předchozí nejlepší: ${prev} %` : null, message: 'Odhad vaší úrovně podle testu:' };
      }
      return { best: prev ? `Předchozí nejlepší: ${prev} %` : null, message: r.pct >= 80 ? 'Výborný výsledek!' : 'Každý test vám ukáže, co si ještě zopakovat.' };
    },
  });
}

// Denní plán: opakování, nová lekce a bonus podle dne v týdnu
export function dailyPlan() {
  const d = dayRec();
  const due = dueIds().length;
  const nl = nextLesson();
  const dayIdx = Math.floor(Date.now() / 864e5);
  const topic = GRAMMAR[dayIdx % GRAMMAR.length];
  const BONUS = [
    { emoji: '🎧', title: 'Poslech', desc: '10 krátkých poslechů', run: () => startPractice('listening', 'bonus') },
    { emoji: '🗣️', title: 'Výslovnost', desc: 'Řekněte 6 vět nahlas', run: () => startPractice('speaking', 'bonus') },
    { emoji: '🧩', title: `Gramatika: ${topic.title}`, desc: topic.en, run: () => startGrammar(topic.id, 'bonus') },
    { emoji: '⚡', title: 'Rychlovka', desc: '60 sekund, kolik toho dáte?', run: () => startTest('speed', 'bonus') },
    { emoji: '🧠', title: 'Nepravidelná slovesa', desc: 'go – went – gone…', run: () => startPractice('verbs', 'bonus') },
    { emoji: '🧱', title: 'Skládání vět', desc: 'Poskládejte 8 vět', run: () => startPractice('builder', 'bonus') },
  ];
  const bonus = BONUS[dayIdx % BONUS.length];
  return [
    due >= 3
      ? { id: 'review', emoji: '🔁', title: `Opakování (${due})`, desc: 'Slovíčka, která je čas si připomenout', run: () => startReview() }
      : { id: 'review', emoji: '🔗', title: 'Rozcvička: dvojice', desc: 'Spojte slovíčka s překladem', run: () => startPractice('pairs', 'review') },
    nl
      ? { id: 'lesson', emoji: nl.unit.emoji, title: typeof d.done.lesson === 'string' ? d.done.lesson : `${nl.unit.title}: ${nl.lesson.title}`, desc: 'Nová lekce', run: () => startLesson(nl.unit.id, nl.lesson.id) }
      : { id: 'lesson', emoji: '🏆', title: 'Velký test', desc: 'Všechna témata máte hotová!', run: () => startTest('big', 'lesson') },
    { id: 'bonus', ...bonus },
  ].map((x) => ({ ...x, done: !!d.done[x.id] }));
}

export function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `anglictina-zaloha-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  save();
}
