// Obrazovky aplikace.
import { UNITS, UNIT_BY_ID, LESSONS, GRAMMAR, GRAMMAR_BY_ID, VERBS, ALL_WORDS, LEARNABLE, SKILLS, SKILL_BY_ID } from './content.js';
import {
  state, save, dayRec, dayKey, addDays, today, streak, practicedToday, levelInfo, skillLevel, itemStatus,
  learnedCount, dueIds, unitProgress, nextLesson, totalMinutes, replaceState, resetState,
} from './state.js';
import { BADGES } from './achievements.js';
import { h, icon, speakBtn, ring, progressBar, plural, toast, sheet, confirmSheet } from './ui.js';
import { speak, rankedVoices, mainVoice, partnerVoice, qualityLabel, whenVoices, canListen } from './speech.js';
import { applyTheme, toggleTheme, effectiveTheme, isStandalone, isIOS, canPromptInstall, promptInstall } from './platform.js';
import {
  startLesson, startReview, startPractice, startGrammar, startDialogue, startStory, startTest, dailyPlan, exportBackup,
} from './actions.js';
import { go, rerender, canGoBack } from './router.js';

const QUOTES = [
  'Pět minut denně je víc než hodina jednou za týden.',
  'Chyby nejsou selhání – jsou důkazem, že se učíte.',
  'Kolik jazyků znáš, tolikrát jsi člověkem.',
  'Malé krůčky vedou k velkým cílům.',
  'Mluvte nahlas – i když zatím jen se svým telefonem.',
  'Nejlepší čas začít byl včera. Druhý nejlepší je dnes.',
  'Každé slovíčko je jeden krok blíž k rozhovoru bez stresu.',
];

const dayIdx = () => Math.floor(Date.now() / 864e5);

// ---------- Společné prvky ----------
function themeBtn() {
  const dark = effectiveTheme() === 'dark';
  return h('button', {
    class: 'icon-btn', 'aria-label': dark ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim',
    onclick: () => { toggleTheme(); rerender(); },
  }, icon(dark ? 'sun' : 'moon', 22));
}

const settingsBtn = () => h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Nastavení' }, icon('settings', 22));

function streakChip() {
  const st = streak();
  return h('a', { class: `streak-chip ${practicedToday() ? 'on' : ''}`, href: '#/progress', 'aria-label': `Série ${st} dní` }, icon('flame', 18), String(st));
}

function pageHead(title, sub) {
  return h('header', { class: 'page-head' },
    h('div', null, h('h1', null, title), sub && h('p', { class: 'muted' }, sub)),
    h('div', { class: 'top-actions' }, streakChip(), themeBtn(), settingsBtn()));
}

function backHead(title, backTo) {
  return h('header', { class: 'back-head' },
    h('button', { class: 'icon-btn', 'aria-label': 'Zpět', onclick: () => (canGoBack() ? history.back() : go(backTo)) }, icon('left', 26)),
    h('h1', null, title),
    h('div', { class: 'top-actions' }, themeBtn()));
}

const section = (title, ...children) => h('section', { class: 'section' }, title && h('h2', { class: 'section-title' }, title), ...children);
const card = (cls, ...children) => h('div', { class: `card ${cls || ''}` }, ...children);

function statusDot(id) {
  const s = itemStatus(id);
  const label = { new: 'Nové', learning: 'Učím se', known: 'Umím', mastered: 'Mistrovsky' }[s];
  return h('span', { class: `status-pill st-${s}` }, label);
}

// ---------- DNES ----------
export function home() {
  const s = state.settings;
  const d = dayRec();
  const goal = s.dailyGoal;
  const st = streak();
  const lvl = levelInfo();
  const nl = nextLesson();
  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Dobrou noc' : hour < 10 ? 'Dobré ráno' : hour < 12 ? 'Hezké dopoledne' : hour < 18 ? 'Dobré odpoledne' : 'Dobrý večer';
  const date = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });

  const heroTitle = d.xp >= goal ? 'Cíl splněn! 🎉' : d.xp === 0 ? 'Pojďme na to!' : `Ještě ${goal - d.xp} XP do cíle`;
  const heroSub = st === 0 ? 'Začněte dnes svou sérii učení.'
    : practicedToday() ? `🔥 ${st} ${plural(st, 'den', 'dny', 'dní')} v řadě. Skvělé!`
      : `🔥 Série ${st} ${plural(st, 'den', 'dny', 'dní')} – udržte ji i dnes.`;

  const plan = dailyPlan();
  const planDone = plan.filter((p) => p.done).length;
  const w = ALL_WORDS[(dayIdx() * 7) % ALL_WORDS.length];

  return h('div', { class: 'page home' },
    h('header', { class: 'home-top' },
      h('div', null, h('p', { class: 'home-date' }, date), h('h1', { class: 'home-hello' }, `${greet}, ${s.nameVoc}`, h('span', { class: 'wave' }, '👋'))),
      h('div', { class: 'top-actions' }, streakChip(), themeBtn(), settingsBtn())),

    h('section', { class: 'hero' },
      h('div', { class: 'hero-row' },
        ring(d.xp / goal, { size: 96, stroke: 10, cls: 'ring-light', label: h('div', { class: 'ring-text' }, h('b', null, d.xp), h('small', null, `z ${goal} XP`)) }),
        h('div', { class: 'hero-text' },
          h('div', { class: 'eyebrow light' }, 'Dnešní cíl'),
          h('h2', null, heroTitle),
          h('p', null, heroSub))),
      h('button', { class: 'btn btn-white btn-block btn-lg hero-cta', onclick: () => (nl ? startLesson(nl.unit.id, nl.lesson.id) : startTest('big')) },
        icon('play', 20),
        h('span', { class: 'cta-text' },
          h('b', null, !nl ? 'Velký test' : Object.keys(state.items).length ? 'Pokračovat v učení' : 'Začít první lekci'),
          nl && h('small', null, `${nl.unit.emoji} ${nl.unit.title} · ${nl.lesson.title}`)))),

    section(null, card('plan',
      h('div', { class: 'card-head' }, h('h3', null, 'Dnešní plán'), h('span', { class: 'pill' }, `${planDone}/3`)),
      plan.map((p) => h('button', { class: `plan-row ${p.done ? 'done' : ''}`, onclick: p.run },
        h('span', { class: 'plan-check' }, p.done ? icon('check', 18) : h('span', { class: 'plan-emoji' }, p.emoji)),
        h('span', { class: 'plan-text' }, h('b', null, p.title), h('small', null, p.done ? 'Hotovo – můžete zopakovat' : p.desc)),
        icon('right', 20, 'chev'))),
      planDone === 3 && h('div', { class: 'plan-done' }, '🏆 Celý dnešní plán splněn. Jste jednička!'))),

    section(null, card('wod',
      h('div', { class: 'eyebrow' }, '✨ Slovíčko dne'),
      h('div', { class: 'wod-row' },
        h('div', null, h('div', { class: 'wod-en' }, w.en), h('div', { class: 'wod-cz' }, w.cz)),
        speakBtn(w.en, { size: 'md' })),
      h('div', { class: 'example' },
        h('div', { class: 'example-row' }, speakBtn(w.ex, { size: 'sm', slow: false }), h('span', { class: 'example-en' }, w.ex)),
        h('div', { class: 'example-cz' }, w.exCz)))),

    section(null, h('div', { class: 'tiles-2' },
      h('a', { class: 'mini-tile', href: '#/progress/skills' },
        h('small', null, `Úroveň ${lvl.level}`), h('b', null, lvl.name), progressBar(lvl.pct), h('small', { class: 'muted' }, `${lvl.into} / ${lvl.span} XP`)),
      h('a', { class: 'mini-tile', href: '#/words' },
        h('small', null, 'Naučeno'), h('b', { class: 'big-num' }, learnedCount()), h('small', { class: 'muted' }, 'slovíček a frází')))),

    installCard(),
    h('p', { class: 'quote' }, `„${QUOTES[dayIdx() % QUOTES.length]}“`),
  );
}

function installCard() {
  if (isStandalone() || state.ui.installDismissed) return null;
  const dismiss = h('button', { class: 'icon-btn sm', 'aria-label': 'Skrýt', onclick: () => { state.ui.installDismissed = true; save(); rerender(); } }, icon('x', 18));
  if (isIOS()) {
    return section(null, card('install', dismiss,
      h('h3', null, '📲 Přidejte si aplikaci na plochu'),
      h('p', null, 'V Safari klepněte dole na ', h('b', null, 'Sdílet '), icon('share', 16), ' a pak na ', h('b', null, 'Přidat na plochu'), '. Aplikace pak funguje jako každá jiná – i bez internetu.')));
  }
  if (canPromptInstall()) {
    return section(null, card('install', dismiss,
      h('h3', null, '📲 Nainstalujte si aplikaci'),
      h('p', null, 'Bude na ploše telefonu a poběží i bez internetu.'),
      h('button', { class: 'btn btn-primary', onclick: async () => { if (await promptInstall()) toast('Aplikace se instaluje', { emoji: '📲' }); rerender(); } }, 'Nainstalovat')));
  }
  return null;
}

// ---------- LEKCE ----------
export function learn() {
  const nl = nextLesson();
  return h('div', { class: 'page' },
    pageHead('Lekce', '12 témat ze života a anglické časy'),
    section('Témata',
      h('div', { class: 'unit-list' }, UNITS.map((u, i) => {
        const p = unitProgress(u.id);
        return h('a', { class: `unit-card ${p.complete ? 'complete' : ''}`, href: `#/unit/${u.id}`, style: { '--c': u.color } },
          h('span', { class: 'unit-emoji' }, u.emoji),
          h('span', { class: 'unit-info' },
            h('span', { class: 'unit-num' }, `Téma ${i + 1}`, nl?.unit === u && h('span', { class: 'tag' }, 'Doporučeno')),
            h('b', null, u.title),
            h('small', { class: 'muted' }, u.en),
            progressBar(p.done / p.total, u.color)),
          h('span', { class: 'unit-side' }, p.complete ? h('span', { class: 'done-badge' }, icon('check', 18)) : h('small', null, `${p.done}/${p.total}`)));
      }))),
    section('Gramatika – anglické časy',
      h('p', { class: 'muted section-sub' }, 'Krátké a srozumitelné vysvětlení s procvičením.'),
      h('div', { class: 'grammar-list' },
        GRAMMAR.map((g) => h('a', { class: 'grammar-card', href: `#/grammar/${g.id}`, style: { '--c': g.color } },
          h('span', { class: 'g-emoji' }, g.emoji),
          h('span', { class: 'g-info' }, h('b', null, g.title), h('small', { class: 'muted' }, g.en)),
          state.stats.grammar[g.id] ? h('span', { class: 'done-badge sm' }, icon('check', 14)) : icon('right', 20, 'chev'))),
        h('a', { class: 'grammar-card', href: '#/verbs', style: { '--c': '#64748B' } },
          h('span', { class: 'g-emoji' }, '🧠'),
          h('span', { class: 'g-info' }, h('b', null, 'Nepravidelná slovesa'), h('small', { class: 'muted' }, `${VERBS.length} nejčastějších sloves`)),
          icon('right', 20, 'chev')))),
  );
}

export function unit(id) {
  const u = UNIT_BY_ID[id];
  if (!u) return notFound();
  const p = unitProgress(id);
  const rec = state.units[id];
  const nl = nextLesson();
  return h('div', { class: 'page unit-page', style: { '--c': u.color } },
    backHead(u.title, '#/learn'),
    h('section', { class: 'unit-hero' },
      h('span', { class: 'unit-hero-emoji' }, u.emoji),
      h('div', null,
        h('div', { class: 'eyebrow' }, `Téma ${u.index + 1} · ${u.en}`),
        h('h2', null, u.title),
        h('div', { class: 'unit-hero-prog' }, progressBar(p.done / p.total, u.color), h('small', null, `${p.done} z ${p.total} lekcí`)))),

    section(null, card('cando-card',
      h('h3', null, 'Po tomto tématu budete umět'),
      u.canDo.map((c) => h('div', { class: `cando-row ${state.cando[c] ? 'got' : ''}` },
        h('span', { class: 'cando-check' }, icon(state.cando[c] ? 'check' : 'star', 16)), c)))),

    section('Lekce', h('div', { class: 'lesson-list' }, LESSONS.map((l) => {
      const done = rec?.done[l.id];
      const isNext = nl?.unit === u && nl.lesson === l;
      return h('button', { class: `lesson-row ${done ? 'done' : ''} ${isNext ? 'next' : ''}`, onclick: () => startLesson(id, l.id) },
        h('span', { class: 'lesson-emoji' }, l.emoji),
        h('span', { class: 'lesson-text' }, h('b', null, l.title), h('small', null, l.id === 'test' && rec?.testBest ? `Nejlepší výsledek: ${rec.testBest} %` : l.desc)),
        h('span', { class: 'lesson-side' },
          done ? h('span', { class: 'done-badge' }, icon('check', 18)) : isNext ? h('span', { class: 'tag' }, 'Další') : h('small', { class: 'muted' }, `~${l.min} min`)));
    }))),

    section(null, card('tip-card',
      h('div', { class: 'eyebrow' }, '🧩 Gramatický tip'),
      h('h3', null, u.tip.title),
      h('p', null, u.tip.text),
      u.tip.examples.map(([en, cz]) => h('div', { class: 'example' },
        h('div', { class: 'example-row' }, speakBtn(en, { size: 'sm', slow: false }), h('span', { class: 'example-en' }, en)),
        h('div', { class: 'example-cz' }, cz))))),

    section('Slovníček tématu',
      card('vocab-list',
        u.wordItems.map((w) => h('div', { class: 'vocab-row' }, speakBtn(w.en, { size: 'sm', slow: false }),
          h('div', { class: 'vocab-text' }, h('b', null, w.en), h('span', { class: 'muted' }, w.cz)), statusDot(w.id))),
        h('div', { class: 'vocab-sep' }, 'Fráze'),
        u.phraseItems.map((w) => h('div', { class: 'vocab-row' }, speakBtn(w.en, { size: 'sm', slow: false }),
          h('div', { class: 'vocab-text' }, h('b', null, w.en), h('span', { class: 'muted' }, w.cz)), statusDot(w.id))))),
  );
}

export function grammar(id) {
  const g = GRAMMAR_BY_ID[id];
  if (!g) return notFound();
  return h('div', { class: 'page grammar-page', style: { '--c': g.color } },
    backHead(g.title, '#/learn'),
    h('section', { class: 'unit-hero' },
      h('span', { class: 'unit-hero-emoji' }, g.emoji),
      h('div', null, h('div', { class: 'eyebrow' }, g.en), h('h2', null, g.title))),
    section(null, card('', h('h3', null, 'Kdy se používá'), h('p', null, g.when))),
    section(null, card('', h('h3', null, 'Jak se tvoří'),
      h('div', { class: 'formula' }, g.formula.map(([a, b]) => h('div', { class: 'formula-row' }, h('span', null, a), h('b', null, b)))))),
    section(null, card('', h('h3', null, 'Typická slova'),
      h('div', { class: 'chips' }, g.signals.split(', ').map((s) => h('span', { class: 'chip' }, s))))),
    section(null, card('', h('h3', null, 'Příklady'),
      g.examples.map(([en, cz]) => h('div', { class: 'example' },
        h('div', { class: 'example-row' }, speakBtn(en, { size: 'sm' }), h('span', { class: 'example-en' }, en)),
        h('div', { class: 'example-cz' }, cz))))),
    h('div', { class: 'sticky-cta' }, h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: () => startGrammar(id) }, 'Procvičit – 10 cvičení')),
  );
}

export function verbs() {
  return h('div', { class: 'page' },
    backHead('Nepravidelná slovesa', '#/learn'),
    section(null, h('p', { class: 'muted' }, 'Tři tvary: základní · minulý čas · příčestí. Klepněte na reproduktor a poslechněte si všechny tři.')),
    section(null, card('verb-list', VERBS.map((v) => h('div', { class: 'verb-row' },
      speakBtn(`${v.en}, ${v.past.split(' / ')[0]}, ${v.pp}`, { size: 'sm', slow: true }),
      h('div', { class: 'verb-forms' }, h('b', null, v.en), h('span', { class: 'sep' }, '·'), h('span', null, v.past), h('span', { class: 'sep' }, '·'), h('span', null, v.pp)),
      h('small', { class: 'muted verb-cz' }, v.cz))))),
    h('div', { class: 'sticky-cta' }, h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: () => startPractice('verbs') }, 'Procvičit slovesa')),
  );
}

// ---------- PROCVIČOVÁNÍ ----------
function weakestSkill() {
  return [...SKILLS].sort((a, b) => state.skills[a.id] - state.skills[b.id])[0];
}

function runForSkill(id) {
  if (id === 'vocab') return startReview();
  if (id === 'listening') return startPractice('listening');
  if (id === 'speaking') return startPractice('speaking');
  if (id === 'grammar') return chooseGrammar();
  if (id === 'conversation') return startDialogue(pickUnit().id);
  return startStory(pickUnit().id);
}

// Téma pro rozhovor/příběh: poslední rozpracované, jinak první
const pickUnit = () => nextLesson()?.unit || UNITS[dayIdx() % UNITS.length];

function chooseGrammar() {
  const close = sheet(h('div', { class: 'sheet-body' },
    h('h3', { class: 'sheet-title' }, 'Který čas procvičíme?'),
    h('div', { class: 'stack' }, GRAMMAR.map((g) => h('button', { class: 'choice-row', onclick: () => { close(); startGrammar(g.id); } },
      h('span', { class: 'g-emoji', style: { '--c': g.color } }, g.emoji), h('span', null, h('b', null, g.title), h('small', { class: 'muted' }, g.en)))),
      h('button', { class: 'choice-row', onclick: () => { close(); startTest('tenses'); } },
        h('span', { class: 'g-emoji' }, '🎯'), h('span', null, h('b', null, 'Všechny časy dohromady'), h('small', { class: 'muted' }, 'Test časů – 15 otázek')))),
  ));
}

export function practice() {
  const due = dueIds().length;
  const weak = weakestSkill();
  const best = (type) => state.tests.filter((t) => t.type === type).reduce((m, t) => Math.max(m, t.pct), 0);
  const tile = (emoji, title, sub, onclick, badge) => h('button', { class: 'p-tile', onclick },
    badge ? h('span', { class: 'p-badge' }, badge) : null,
    h('span', { class: 'p-emoji' }, emoji), h('b', null, title), h('small', null, sub));
  const testRow = (emoji, title, sub, meta, onclick) => h('button', { class: 'test-row', onclick },
    h('span', { class: 'lesson-emoji' }, emoji),
    h('span', { class: 'lesson-text' }, h('b', null, title), h('small', null, sub)),
    meta ? h('span', { class: 'test-meta' }, meta) : icon('right', 20, 'chev'));

  return h('div', { class: 'page' },
    pageHead('Procvičování', 'Trénujte, co už znáte, a otestujte se'),
    section(null, card('reco',
      h('div', { class: 'reco-emoji' }, weak.emoji),
      h('div', { class: 'reco-text' }, h('small', null, 'Doporučuji dnes posílit'), h('b', null, weak.name)),
      h('button', { class: 'btn btn-primary btn-sm', onclick: () => runForSkill(weak.id) }, 'Začít'))),
    section('Trénink', h('div', { class: 'p-grid' },
      tile('🔁', 'Opakování', due ? `${due} ${plural(due, 'položka čeká', 'položky čekají', 'položek čeká')}` : 'Upevněte paměť', () => startReview(), due || null),
      tile('🎧', 'Poslech', 'Rozumím, co slyším', () => startPractice('listening')),
      tile('🗣️', 'Výslovnost', canListen ? 'Mluvte do telefonu' : 'Opakujte nahlas', () => startPractice('speaking')),
      tile('🧱', 'Skládání vět', 'Slovosled hravě', () => startPractice('builder')),
      tile('🧩', 'Dvojice', 'Spojte překlady', () => startPractice('pairs')),
      tile('⏱️', 'Gramatika', 'Anglické časy', chooseGrammar),
      tile('💬', 'Rozhovory', 'a krátké příběhy', () => go('#/talk')),
      tile('🧠', 'Slovesa', 'go – went – gone', () => startPractice('verbs')))),
    section('Testy', h('div', { class: 'test-list' },
      testRow('⚡', 'Rychlovka', '60 sekund – kolik toho stihnete?', state.stats.speedBest ? `🏆 ${state.stats.speedBest}` : null, () => startTest('speed')),
      testRow('🎯', 'Velký test', '20 otázek ze všech témat + odhad úrovně', best('big') ? `${best('big')} %` : null, () => startTest('big')),
      testRow('⏳', 'Test časů', '15 otázek na všechny časy', best('tenses') ? `${best('tenses')} %` : null, () => startTest('tenses')),
      testRow('🎧', 'Poslechový test', '12 poslechových úloh', best('listening') ? `${best('listening')} %` : null, () => startTest('listening')))),
  );
}

export function talk() {
  return h('div', { class: 'page' },
    backHead('Rozhovory a příběhy', '#/practice'),
    section('Rozhovory', h('p', { class: 'muted section-sub' }, 'Partner mluví, vy vybíráte odpověď. Jako ve skutečnosti.'),
      h('div', { class: 'lesson-list' }, UNITS.map((u) => h('button', { class: 'lesson-row', onclick: () => startDialogue(u.id) },
        h('span', { class: 'lesson-emoji' }, u.emoji),
        h('span', { class: 'lesson-text' }, h('b', null, u.dialogue.title), h('small', null, `S kým: ${u.dialogue.partner} · ${u.title}`)),
        icon('right', 20, 'chev'))))),
    section('Příběhy', h('p', { class: 'muted section-sub' }, 'Krátké čtení s poslechem a otázkami.'),
      h('div', { class: 'lesson-list' }, UNITS.map((u) => h('button', { class: 'lesson-row', onclick: () => startStory(u.id) },
        h('span', { class: 'lesson-emoji' }, '📖'),
        h('span', { class: 'lesson-text' }, h('b', null, u.story.title), h('small', null, `${u.story.lines.length} vět · ${u.title}`)),
        icon('right', 20, 'chev'))))),
  );
}

// ---------- POKROK ----------
export function progress(tab = 'overview') {
  const tabs = [['overview', 'Přehled'], ['skills', 'Dovednosti'], ['collection', 'Sbírka']];
  const body = tab === 'skills' ? skillsTab() : tab === 'collection' ? collectionTab() : overviewTab();
  return h('div', { class: 'page' },
    pageHead('Váš pokrok'),
    h('nav', { class: 'segmented', role: 'tablist' }, tabs.map(([id, label]) =>
      h('a', { href: `#/progress/${id}`, class: id === tab ? 'on' : '', role: 'tab', 'aria-selected': String(id === tab) }, label))),
    body);
}

function overviewTab() {
  const st = streak();
  const counts = { new: 0, learning: 0, known: 0, mastered: 0 };
  [...ALL_WORDS, ...UNITS.flatMap((u) => u.phraseItems), ...VERBS].forEach((it) => counts[itemStatus(it.id)]++);
  const totalItems = Object.values(counts).reduce((a, b) => a + b, 0);
  const s = state.stats;
  const acc = s.answers ? Math.round((s.correct / s.answers) * 100) : 0;

  // Posledních 7 dní
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const maxXp = Math.max(state.settings.dailyGoal, ...days.map((k) => state.daily[k]?.xp || 0));
  const dnames = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  const goalPct = (state.settings.dailyGoal / maxXp) * 100;
  const week = h('div', { class: 'week-chart' },
    h('div', { class: 'goal-line', style: { bottom: `calc(${goalPct}% * 0.82 + 28px)` } }, h('span', null, 'cíl')),
    days.map((k) => {
      const xp = state.daily[k]?.xp || 0;
      const [y, m, d] = k.split('-').map(Number);
      const wd = new Date(y, m - 1, d).getDay();
      return h('div', { class: `wk-col ${k === today() ? 'today' : ''}` },
        h('span', { class: 'wk-val' }, xp || ''),
        h('div', { class: 'wk-track' }, h('div', { class: `wk-bar ${xp >= state.settings.dailyGoal ? 'met' : ''}`, style: { height: `${(xp / maxXp) * 100}%` } })),
        h('span', { class: 'wk-day' }, dnames[wd]));
    }));
  const weekXp = days.reduce((a, k) => a + (state.daily[k]?.xp || 0), 0);

  // Kalendář (15 týdnů)
  const weeks = 15;
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const start = addDays(today(), -mondayOffset - (weeks - 1) * 7);
  const cells = ['Po', '', 'St', '', 'Pá', '', 'Ne'].map((x) => h('span', { class: 'hm-day' }, x));
  for (let i = 0; i < weeks * 7; i++) {
    const k = addDays(start, i);
    const xp = state.daily[k]?.xp || 0;
    const lvl = k > today() ? 'future' : xp === 0 ? 0 : xp < 20 ? 1 : xp < 50 ? 2 : xp < 100 ? 3 : 4;
    cells.push(h('span', { class: `hm l${lvl}`, title: `${k}: ${xp} XP` }));
  }
  const activeDays = Object.values(state.daily).filter((d) => d.xp > 0).length;

  const tests = state.tests.slice(0, 6);
  const testNames = { unit: 'Test tématu', big: 'Velký test', tenses: 'Test časů', listening: 'Poslechový test', speed: 'Rychlovka' };

  return h('div', { class: 'tab-body' },
    section(null, h('div', { class: 'stat-grid' },
      statTile('🔥', st, plural(st, 'den v řadě', 'dny v řadě', 'dní v řadě'), `Nejdelší: ${Math.max(s.bestStreak, st)}`),
      statTile('⭐', state.xp.toLocaleString('cs-CZ'), 'XP celkem', `Tento týden: ${weekXp}`),
      statTile('📚', learnedCount(), 'naučeno', `z ${totalItems} položek`),
      statTile('⏱️', totalMinutes(), 'minut učení', `${activeDays} ${plural(activeDays, 'den', 'dny', 'dní')} s učením`))),
    section(null, card('', h('div', { class: 'card-head' }, h('h3', null, 'Posledních 7 dní'), h('span', { class: 'pill' }, `${weekXp} XP`)), week)),
    section(null, card('', h('div', { class: 'card-head' }, h('h3', null, 'Kalendář učení'), h('small', { class: 'muted' }, '15 týdnů')),
      h('div', { class: 'heatmap', style: { '--weeks': weeks } }, cells),
      h('div', { class: 'hm-legend' }, h('small', { class: 'muted' }, 'méně'), [0, 1, 2, 3, 4].map((l) => h('span', { class: `hm l${l}` })), h('small', { class: 'muted' }, 'více')))),
    section(null, card('', h('h3', null, 'Slovíčka a fráze'),
      h('div', { class: 'stack-bar' }, ['mastered', 'known', 'learning', 'new'].map((k) => h('span', { class: `sb st-${k}`, style: { flexGrow: counts[k] } }))),
      h('div', { class: 'legend' },
        [['mastered', 'Mistrovsky'], ['known', 'Umím'], ['learning', 'Učím se'], ['new', 'Nové']].map(([k, l]) =>
          h('span', { class: 'legend-item' }, h('i', { class: `dot st-${k}` }), `${l}: `, h('b', null, counts[k])))),
      h('a', { class: 'link-row', href: '#/words' }, 'Zobrazit moje slovíčka', icon('right', 18)))),
    section(null, card('', h('div', { class: 'card-head' }, h('h3', null, 'Úspěšnost odpovědí'), h('span', { class: 'pill' }, `${s.answers} odpovědí`)),
      h('div', { class: 'acc-row' }, ring(acc / 100, { size: 76, stroke: 9, label: h('b', null, `${acc} %`) }),
        h('p', { class: 'muted' }, s.answers === 0 ? 'Zatím žádné odpovědi. Začněte první lekcí!'
          : acc >= 85 ? 'Výborná přesnost! Můžete si troufnout na těžší úkoly.'
            : acc >= 65 ? 'Solidní výsledek. Opakování z vás udělá jedničku.'
              : 'Nevadí, chybami se učíme. Pomůže pravidelné opakování.')))),
    section(null, card('', h('h3', null, 'Výsledky testů'),
      tests.length ? tests.map((t) => h('div', { class: 'test-hist' },
        h('span', null, h('b', null, testNames[t.type] || 'Test'), t.unit && h('small', { class: 'muted' }, ` · ${UNIT_BY_ID[t.unit]?.title || ''}`)),
        h('span', { class: 'muted' }, new Date(t.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })),
        h('b', { class: 'test-score' }, t.type === 'speed' ? `${t.pct} b.` : `${t.pct} %`)))
        : h('p', { class: 'muted' }, 'Zatím jste nedělala žádný test. Zkuste Rychlovku nebo Velký test v sekci Procvičit.'))),
  );
}

function statTile(emoji, value, label, sub) {
  return h('div', { class: 'stat-tile' }, h('span', { class: 'stat-emoji' }, emoji), h('b', null, value), h('span', null, label), h('small', { class: 'muted' }, sub));
}

function skillsTab() {
  const lvl = levelInfo();
  const weak = weakestSkill();
  return h('div', { class: 'tab-body' },
    section(null, h('div', { class: 'level-card' },
      h('div', { class: 'level-badge' }, h('small', null, 'Úroveň'), h('b', null, lvl.level)),
      h('div', { class: 'level-info' },
        h('b', null, lvl.name),
        progressBar(lvl.pct),
        h('small', null, `${lvl.into} / ${lvl.span} XP do další úrovně`)))),
    section('Dovednosti', card('skills',
      SKILLS.map((sk) => {
        const xp = state.skills[sk.id];
        const sl = skillLevel(xp);
        const b = state.stats.bySkill[sk.id];
        const acc = b && b.c + b.w ? Math.round((b.c / (b.c + b.w)) * 100) : null;
        return h('div', { class: 'skill-row' },
          h('span', { class: 'skill-emoji', style: { '--c': sk.color } }, sk.emoji),
          h('div', { class: 'skill-info' },
            h('div', { class: 'skill-top' }, h('b', null, sk.name), h('span', { class: 'skill-lvl' }, `úr. ${sl.level}${sl.max ? ' · max' : ''}`)),
            progressBar(sl.pct, sk.color),
            h('small', { class: 'muted' }, `${xp} XP${acc != null ? ` · úspěšnost ${acc} %` : ''}${sl.toNext ? ` · do další úrovně ${sl.toNext} XP` : ''}`)));
      }))),
    section(null, card('reco',
      h('div', { class: 'reco-emoji' }, weak.emoji),
      h('div', { class: 'reco-text' }, h('small', null, 'Na čem zapracovat'), h('b', null, weak.name)),
      h('button', { class: 'btn btn-primary btn-sm', onclick: () => runForSkill(weak.id) }, 'Trénovat'))),
    section(null, h('p', { class: 'muted small center' }, 'XP za dovednost získáváte v cvičeních, která ji trénují – např. poslech posiluje 🎧 Poslech.')),
  );
}

function collectionTab() {
  const all = UNITS.flatMap((u) => u.canDo.map((c) => ({ c, u })));
  const got = all.filter((x) => state.cando[x.c]).length;
  const gotBadges = BADGES.filter((b) => state.badges[b.id]).length;
  return h('div', { class: 'tab-body' },
    section(null, h('div', { class: 'tiles-2' },
      h('div', { class: 'mini-tile' }, h('small', null, 'Dovednosti „Umím…“'), h('b', { class: 'big-num' }, `${got}/${all.length}`), progressBar(got / all.length)),
      h('div', { class: 'mini-tile' }, h('small', null, 'Odznaky'), h('b', { class: 'big-num' }, `${gotBadges}/${BADGES.length}`), progressBar(gotBadges / BADGES.length)))),
    section('Odznaky', h('div', { class: 'badge-grid' }, BADGES.map((b) => {
      const has = state.badges[b.id];
      return h('button', { class: `badge ${has ? 'got' : 'locked'}`, onclick: () => toast(has ? `${b.name}: ${b.desc} ✓` : `Jak získat: ${b.desc}`, { emoji: b.emoji }) },
        h('span', { class: 'badge-emoji' }, has ? b.emoji : '🔒'), h('small', null, b.name));
    }))),
    section('Umím…', h('p', { class: 'muted section-sub' }, 'Dovednost získáte splněním testu tématu (alespoň 70 %).'),
      h('div', { class: 'cando-list' }, all.map(({ c, u }) => h('a', { class: `cando-item ${state.cando[c] ? 'got' : ''}`, href: `#/unit/${u.id}`, style: { '--c': u.color } },
        h('span', { class: 'cando-emoji' }, state.cando[c] ? u.emoji : '🔒'), h('span', null, c))))),
    section(null, h('a', { class: 'card link-card', href: '#/words' }, h('span', { class: 'lesson-emoji' }, '📒'),
      h('span', { class: 'lesson-text' }, h('b', null, 'Moje slovíčka'), h('small', null, 'Všechna slovíčka a fráze s výslovností')), icon('right', 20, 'chev'))),
  );
}

export function words() {
  let filter = 'all', q = '';
  const list = h('div', { class: 'card vocab-list' });
  const draw = () => {
    const qq = q.trim().toLowerCase();
    const items = LEARNABLE.filter((it) => {
      const st = itemStatus(it.id);
      if (filter === 'learned' && !(st === 'known' || st === 'mastered')) return false;
      if (filter === 'learning' && st !== 'learning') return false;
      if (filter === 'new' && st !== 'new') return false;
      return !qq || it.en.toLowerCase().includes(qq) || it.cz.toLowerCase().includes(qq);
    });
    list.replaceChildren(...(items.length ? items.slice(0, 300).map((it) => h('div', { class: 'vocab-row' },
      speakBtn(it.kind === 'verb' ? `${it.en}, ${it.past.split(' / ')[0]}, ${it.pp}` : it.en, { size: 'sm', slow: false }),
      h('div', { class: 'vocab-text' }, h('b', null, it.kind === 'verb' ? `${it.en} – ${it.past} – ${it.pp}` : it.en), h('span', { class: 'muted' }, it.cz)),
      statusDot(it.id))) : [h('p', { class: 'muted center pad' }, 'Nic jsme nenašli.')]));
  };
  const chips = h('div', { class: 'filter-chips' }, [['all', 'Vše'], ['learned', 'Umím'], ['learning', 'Učím se'], ['new', 'Nové']].map(([id, label]) => {
    const b = h('button', { class: `chip-btn ${id === filter ? 'on' : ''}`, onclick: () => {
      filter = id;
      chips.querySelectorAll('.chip-btn').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    } }, label);
    return b;
  }));
  draw();
  return h('div', { class: 'page' },
    backHead('Moje slovíčka', '#/progress/collection'),
    section(null, h('label', { class: 'search' }, icon('search', 20), h('input', { type: 'search', placeholder: 'Hledat česky nebo anglicky…', oninput: (e) => { q = e.target.value; draw(); } })), chips),
    section(null, list));
}

// ---------- NASTAVENÍ ----------
export function settings() {
  const s = state.settings;
  const set = (k, v, opts = {}) => { s[k] = v; save(); if (opts.theme) applyTheme(); if (opts.rerender) rerender(); };
  const seg = (key, options, opts) => h('div', { class: 'seg' }, options.map(([v, label]) =>
    h('button', { class: s[key] === v ? 'on' : '', onclick: () => set(key, v, { ...opts, rerender: true }) }, label)));
  const toggle = (key, label, sub) => h('label', { class: 'set-row toggle-row' },
    h('span', null, h('b', null, label), sub && h('small', { class: 'muted' }, sub)),
    h('input', { type: 'checkbox', class: 'switch', checked: s[key] ? true : null, onchange: (e) => set(key, e.target.checked) }));

  const voiceSel = h('select', { class: 'select', 'aria-label': 'Hlas' });
  const partnerSel = h('select', { class: 'select', 'aria-label': 'Hlas partnera v rozhovorech' });
  const fillVoices = () => {
    const vs = rankedVoices();
    const opt = (sel, current, auto) => {
      sel.replaceChildren(h('option', { value: '' }, auto), ...vs.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === current ? true : null }, `${v.name} (${v.lang}) – ${qualityLabel(v)}`)));
    };
    opt(voiceSel, s.voiceURI, `Automaticky – ${mainVoice()?.name || 'nejlepší dostupný'}`);
    opt(partnerSel, s.partnerVoiceURI, `Automaticky – ${partnerVoice()?.name || 'jiný hlas'}`);
  };
  voiceSel.addEventListener('change', () => { set('voiceURI', voiceSel.value); fillVoices(); speak('Hello! This is my voice. How do I sound?'); });
  partnerSel.addEventListener('change', () => { set('partnerVoiceURI', partnerSel.value); fillVoices(); speak('Hi there! Nice to meet you.', { partner: true }); });
  whenVoices().then(fillVoices);
  fillVoices();

  const rateLabel = h('b', null, `${Math.round(s.rate * 100)} %`);
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden', onchange: async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || typeof data !== 'object' || !('xp' in data)) throw new Error('bad');
      if (await confirmSheet({ title: 'Obnovit zálohu?', text: 'Současný pokrok bude nahrazen pokrokem ze zálohy.', ok: 'Obnovit' })) {
        replaceState(data);
        applyTheme();
        toast('Záloha obnovena', { emoji: '✅' });
        rerender();
      }
    } catch { toast('Soubor se nepodařilo načíst', { emoji: '⚠️' }); }
  } });

  return h('div', { class: 'page settings' },
    backHead('Nastavení', '#/'),
    section('Profil', card('set-card',
      h('label', { class: 'set-field' }, h('small', null, 'Jméno'), h('input', { class: 'input', value: s.name, onchange: (e) => set('name', e.target.value.trim() || 'Lenka') })),
      h('label', { class: 'set-field' }, h('small', null, 'Oslovení (5. pád)'), h('input', { class: 'input', value: s.nameVoc, onchange: (e) => set('nameVoc', e.target.value.trim() || 'Lenko') })))),
    section('Vzhled', card('set-card',
      h('div', { class: 'set-row col' }, h('b', null, 'Režim zobrazení'), seg('theme', [['light', '☀️ Světlý'], ['dark', '🌙 Tmavý'], ['auto', '⚙️ Podle telefonu']], { theme: true })),
      h('div', { class: 'set-row col' }, h('b', null, 'Velikost písma'), seg('fontScale', [[1, 'Normální'], [1.12, 'Větší'], [1.25, 'Největší']], { theme: true })))),
    section('Hlas a výslovnost', card('set-card',
      h('div', { class: 'set-row col' }, h('b', null, 'Přízvuk'), seg('accent', [['en-GB', '🇬🇧 Britský'], ['en-US', '🇺🇸 Americký']])),
      h('label', { class: 'set-field' }, h('small', null, 'Hlas lektora'), voiceSel),
      h('label', { class: 'set-field' }, h('small', null, 'Hlas partnera v rozhovorech'), partnerSel),
      h('div', { class: 'set-row col' },
        h('div', { class: 'row-between' }, h('b', null, 'Rychlost řeči'), rateLabel),
        h('input', { type: 'range', min: '0.6', max: '1.1', step: '0.02', value: String(s.rate), class: 'range',
          oninput: (e) => { rateLabel.textContent = `${Math.round(e.target.value * 100)} %`; },
          onchange: (e) => { set('rate', Number(e.target.value)); speak('This is how fast I speak now.'); } })),
      h('button', { class: 'btn btn-secondary btn-block', onclick: () => speak('Hello Lenka! I am your English teacher. Let\'s learn something new today.') }, icon('volume', 20), ' Vyzkoušet hlas'),
      h('details', { class: 'voice-help' },
        h('summary', null, '💡 Jak získat nejpřirozenější hlas'),
        h('p', null, h('b', null, 'iPhone: '), 'Nastavení → Zpřístupnění → Předčítaný obsah → Hlasy → Angličtina. Stáhněte hlas s označením ', h('b', null, 'Prémiový'), ' nebo ', h('b', null, 'Vylepšený'), ' (doporučujeme Ava, Zoe nebo Serena). Potom ho zde vyberte.'),
        h('p', null, h('b', null, 'Android: '), 'Nastavení → Usnadnění → Převod textu na řeč → Google → Nainstalovat hlasová data → Angličtina (UK nebo USA) a zvolte hlas ve vysoké kvalitě.'),
        h('p', { class: 'muted' }, 'Aplikace sama vybírá nejkvalitnější hlas, který je v telefonu k dispozici.')))),
    section('Učení', card('set-card',
      h('div', { class: 'set-row col' }, h('b', null, 'Denní cíl'), seg('dailyGoal', [[30, 'Pohodově · 30'], [50, 'Normálně · 50'], [100, 'Naplno · 100']])),
      toggle('autoPlay', 'Automaticky přehrávat výslovnost', 'Anglické věty se přehrají samy'),
      toggle('sounds', 'Zvukové efekty', 'Cinknutí při správné odpovědi'),
      toggle('haptics', 'Vibrace', 'Jemná odezva při odpovědi (Android)'))),
    section('Záloha dat', card('set-card',
      h('p', { class: 'muted small' }, 'Pokrok je uložený jen v tomto telefonu. Občas si udělejte zálohu – hodí se při výměně telefonu.'),
      h('button', { class: 'btn btn-secondary btn-block', onclick: () => { exportBackup(); toast('Záloha stažena', { emoji: '💾' }); } }, icon('download', 20), ' Stáhnout zálohu'),
      h('button', { class: 'btn btn-secondary btn-block', onclick: () => fileInput.click() }, icon('upload', 20), ' Obnovit ze zálohy'),
      fileInput,
      h('button', { class: 'btn btn-ghost-danger btn-block', onclick: async () => {
        if (!(await confirmSheet({ title: 'Smazat veškerý pokrok?', text: 'Přijdete o body, sérii, odznaky i naučená slovíčka. Tuto akci nelze vrátit.', ok: 'Ano, smazat', danger: true }))) return;
        if (!(await confirmSheet({ title: 'Opravdu?', text: 'Poslední potvrzení – pokrok bude nenávratně smazán.', ok: 'Smazat vše', danger: true }))) return;
        resetState();
        toast('Pokrok byl smazán', { emoji: '🗑️' });
        go('#/');
      } }, icon('trash', 20), ' Smazat pokrok'))),
    section('O aplikaci', card('set-card about',
      h('p', null, h('b', null, 'Angličtina pro Lenku'), ' · verze 1.0'),
      h('p', { class: 'muted small' }, 'Funguje i bez internetu. Hlas zajišťuje přímo váš telefon.'),
      !isStandalone() && h('p', { class: 'muted small' }, isIOS() ? 'Tip: V Safari klepněte na Sdílet → Přidat na plochu.' : 'Tip: V menu prohlížeče zvolte „Nainstalovat aplikaci“ nebo „Přidat na plochu“.'))),
  );
}

function notFound() {
  return h('div', { class: 'page' }, backHead('Nenalezeno', '#/'), section(null, h('p', null, 'Tahle stránka neexistuje.'), h('a', { class: 'btn btn-primary', href: '#/' }, 'Domů')));
}
