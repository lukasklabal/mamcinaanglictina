// Průběh lekce / testu: zobrazuje cvičení jedno po druhém, vyhodnocuje a ukládá pokrok.
import { state, save, recordAnswer, addXP, dayRec, markSeen } from './state.js';
import { checkBadges } from './achievements.js';
import { speak, stopSpeaking, speakSequence, canListen, listen, speechMatch, normalize } from './speech.js';
import { h, icon, speakBtn, sfx, vibrate, confirmSheet, confetti, shuffle, pick } from './ui.js';

const PRAISE = ['Výborně!', 'Skvělé!', 'Přesně tak!', 'Paráda!', 'Bezvadné!', 'Správně!', 'Perfektní!', 'Jen tak dál!'];
const COMFORT = ['Skoro!', 'Nevadí, zapamatujeme si to.', 'Chybami se učíme.', 'To nic, příště to vyjde.'];

let S = null;

export const isSessionOpen = () => !!S;
export function closeSession() { if (S) S.close(); }

export function startSession(cfg) {
  const root = h('div', { class: `session mode-${cfg.mode || 'lesson'}`, role: 'dialog', 'aria-label': cfg.title });
  const fill = h('div', { class: 's-progress-fill' });
  const xpBadge = h('div', { class: 's-xp' }, '⭐ 0');
  const body = h('div', { class: 's-body' });
  const foot = h('div', { class: 's-foot' });
  const closeBtn = h('button', { class: 'icon-btn', 'aria-label': 'Ukončit', onclick: () => askClose() }, icon('x', 26));
  root.append(h('div', { class: 's-top' }, closeBtn, h('div', { class: 's-progress' }, fill), xpBadge), body, foot);
  document.body.append(root);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => root.classList.add('show'));

  S = {
    cfg, root, body, foot, fill, xpBadge,
    mode: cfg.mode || 'lesson',
    queue: (cfg.steps || []).slice(),
    i: 0, xp: 0, ok: 0, bad: 0, firstOk: 0, firstTotal: 0,
    mistakes: [], start: Date.now(), skipSpeak: false, srFailed: false, goalMet: false, finished: false,
    timeLeft: cfg.timeLimit || 0,
    close: () => teardown(),
  };
  history.pushState({ session: true }, '');
  if (S.mode === 'speed') startTimer();
  render();
}

function teardown(fromPop = false) {
  if (!S) return;
  const { root, cfg, timer } = S;
  clearInterval(timer);
  stopSpeaking();
  S = null;
  root.classList.remove('show');
  setTimeout(() => root.remove(), 250);
  document.body.classList.remove('no-scroll');
  if (!fromPop && history.state?.session) history.back();
  cfg.onClose?.();
}

// Systémové tlačítko Zpět zavře lekci
window.addEventListener('popstate', () => { if (S) teardown(true); });

async function askClose() {
  if (!S) return;
  if (S.finished || (S.ok + S.bad === 0 && S.i === 0)) { teardown(); return; }
  const leave = await confirmSheet({
    title: 'Ukončit lekci?',
    text: 'Body, které jste už získala, vám zůstanou. Lekce se ale nezapočítá jako dokončená.',
    ok: 'Ukončit', cancel: 'Pokračovat v lekci',
  });
  if (leave) { finishStats(true); teardown(); }
}

function startTimer() {
  const total = S.cfg.timeLimit;
  const endAt = Date.now() + total * 1000;
  S.timer = setInterval(() => {
    if (!S) return;
    S.timeLeft = (endAt - Date.now()) / 1000;
    S.fill.style.width = `${Math.max(0, (S.timeLeft / total) * 100)}%`;
    S.fill.classList.toggle('warn', S.timeLeft < 10);
    if (S.timeLeft <= 0) { clearInterval(S.timer); finish(); }
  }, 100);
}

function updateTop() {
  if (S.mode !== 'speed') {
    const total = S.queue.length;
    S.fill.style.width = `${total ? (S.i / total) * 100 : 0}%`;
  }
  S.xpBadge.textContent = `⭐ ${S.xp}`;
}

function setFoot(...nodes) {
  S.foot.className = 's-foot';
  S.foot.replaceChildren(...nodes.filter(Boolean));
}

function next() {
  if (!S) return;
  S.i++;
  render();
}

function render() {
  if (!S) return;
  stopSpeaking();
  if (S.mode === 'speed' && S.i >= S.queue.length) S.queue.push(S.cfg.generator());
  while (S.i < S.queue.length && S.skipSpeak && S.queue[S.i].type === 'speak') S.i++;
  updateTop();
  if (S.i >= S.queue.length) { finish(); return; }
  const step = S.queue[S.i];
  S.body.scrollTop = 0;
  setFoot();
  const ctx = { answer, next, record, bonus, footer: setFoot, step };
  const view = RENDER[step.type](step, ctx);
  S.body.replaceChildren(h('div', { class: `step step-${step.type}` }, view));
}

// ---------- Vyhodnocení ----------
function record({ correct, skill, itemId, first = true }) {
  recordAnswer({ itemId, correct, skill });
  if (first) { S.firstTotal++; if (correct) S.firstOk++; }
  if (correct) {
    S.ok++;
    gain(S.mode === 'speed' || !first ? 5 : 10, skill);
  } else S.bad++;
  save();
}

function gain(n, skill) {
  S.xp += n;
  const r = addXP(n, skill);
  if (r.goalJustMet) S.goalMet = true;
  updateTop();
}

function bonus(n, skill) { gain(n, skill); save(); }

function answer({ correct, correctText, explain, reveal, speakText, items }) {
  const step = S.queue[S.i];
  const first = !step._retry;
  if (items) {
    items.forEach(([itemId, ok]) => recordAnswer({ itemId, correct: ok, skill: step.skill }));
    S.firstTotal++;
    if (correct) { S.firstOk++; S.ok++; gain(first ? 15 : 8, step.skill); } else S.bad++;
    save();
  } else {
    record({ correct, skill: step.skill, itemId: step.item?.id, first });
  }
  if (step.type === 'speak') state.stats.speaking++;

  if (correct) { sfx.correct(); vibrate(12); } else {
    sfx.wrong(); vibrate([25, 40, 25]);
    const it = step.item;
    S.mistakes.push(it && it.kind !== 'verb'
      ? { en: it.en, cz: it.cz }
      : { en: step.after || step.target || step.text || correctText, cz: it?.cz || step.cz || step.hint || '' });
    if (S.mode !== 'test' && S.mode !== 'speed' && first && step.type !== 'match') {
      S.queue.push({ ...step, _retry: true, options: step.options && shuffle(step.options), tiles: step.tiles && shuffle(step.tiles) });
    }
  }
  if (speakText && S.mode !== 'speed' && (correct || step.type !== 'speak')) speak(speakText);

  if (S.mode === 'speed') {
    setTimeout(next, correct ? 350 : 1100);
    return;
  }
  const panel = h('div', { class: `feedback ${correct ? 'good' : 'bad'}` },
    h('div', { class: 'fb-head' },
      h('span', { class: 'fb-icon' }, icon(correct ? 'check' : 'x', 22)),
      h('strong', null, correct ? pick(PRAISE) : pick(COMFORT))),
    !correct && correctText && h('div', { class: 'fb-answer' }, h('span', { class: 'muted' }, 'Správně je: '), h('b', null, correctText),
      /[a-z]/i.test(correctText) && speakText ? speakBtn(speakText, { size: 'sm', slow: true }) : null),
    reveal && h('div', { class: 'fb-reveal' }, h('span', { class: 'muted' }, 'Zaznělo: '), h('b', null, reveal), speakBtn(reveal, { size: 'sm' })),
    explain && h('div', { class: 'fb-explain' }, explain),
    h('button', { class: `btn btn-block ${correct ? 'btn-success' : 'btn-warn'}`, onclick: next }, 'Pokračovat'));
  S.foot.className = 's-foot has-feedback';
  S.foot.replaceChildren(panel);
  panel.querySelector('button.btn-block').focus({ preventScroll: true });
}

// ---------- Konec lekce ----------
function finishStats(aborted) {
  const sec = Math.min(1800, Math.round((Date.now() - S.start) / 1000));
  const d = dayRec();
  d.sec += sec;
  const hour = new Date().getHours();
  if (S.ok + S.bad > 0) {
    if (hour < 8) state.stats.early = true;
    if (hour >= 21) state.stats.night = true;
  }
  if (!aborted) {
    d.sessions++;
    state.stats.sessions++;
  }
  save();
  return sec;
}

function finish() {
  if (!S || S.finished) return;
  S.finished = true;
  clearInterval(S.timer);
  stopSpeaking();
  const perfect = S.bad === 0 && S.firstTotal >= 4;
  if (S.mode !== 'speed') gain(10, null);
  if (perfect && S.mode !== 'speed') { state.stats.perfect++; gain(10, null); }
  const sec = finishStats(false);
  const pct = S.firstTotal ? Math.round((S.firstOk / S.firstTotal) * 100) : 100;
  const result = { pct, ok: S.ok, firstOk: S.firstOk, total: S.firstTotal, xp: S.xp, sec, perfect };
  const extra = S.cfg.onFinish?.(result) || {};
  save();
  const badges = checkBadges();
  sfx.finish();
  if (pct >= 60 || S.mode === 'speed') confetti();
  vibrate([20, 60, 20]);
  S.fill.style.width = '100%';

  const isTest = S.mode === 'test' || S.mode === 'speed';
  const name = state.settings.nameVoc;
  const emoji = perfect ? '🌟' : pct >= 80 ? '🎉' : pct >= 50 ? '👏' : '💪';
  const title = S.mode === 'speed' ? `${S.ok} ${S.ok === 1 ? 'bod' : S.ok < 5 && S.ok > 0 ? 'body' : 'bodů'}!`
    : isTest ? `${pct} %` : perfect ? 'Bez jediné chyby!' : 'Lekce hotová!';
  const sub = extra.message || (pct >= 80 ? `Skvělá práce, ${name}!` : pct >= 50 ? `Dobrá práce, ${name}. Každé opakování se počítá.` : `Nevzdávejte to, ${name}. Opakování je matka moudrosti.`);
  const mm = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  setFoot(h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: () => teardown() }, 'Pokračovat'));
  S.body.replaceChildren(h('div', { class: 'step end' },
    h('div', { class: 'end-emoji' }, emoji),
    h('h2', { class: 'end-title' }, title),
    h('p', { class: 'end-sub' }, sub),
    extra.level && h('div', { class: 'end-level' }, h('span', { class: 'level-code' }, extra.level.code), h('span', null, extra.level.text)),
    h('div', { class: 'end-chips' },
      h('div', { class: 'chip-stat' }, h('b', null, `+${S.xp}`), h('span', null, 'XP')),
      S.mode !== 'speed' && h('div', { class: 'chip-stat' }, h('b', null, `${pct} %`), h('span', null, 'přesnost')),
      h('div', { class: 'chip-stat' }, h('b', null, mm), h('span', null, 'čas'))),
    extra.best && h('p', { class: 'muted center' }, extra.best),
    S.goalMet && h('div', { class: 'end-banner' }, '🎯 Denní cíl splněn! Gratuluji.'),
    (extra.cando || []).map((c) => h('div', { class: 'end-cando' }, h('span', { class: 'cando-check' }, icon('check', 18)), h('div', null, h('small', null, 'Nová dovednost do sbírky'), h('b', null, c)))),
    badges.map((b) => h('div', { class: 'end-badge' }, h('span', { class: 'badge-emoji' }, b.emoji), h('div', null, h('small', null, 'Nový odznak!'), h('b', null, b.name), h('span', { class: 'muted' }, b.desc)))),
    S.mistakes.length > 0 && h('div', { class: 'end-mistakes' },
      h('h4', null, 'Na tohle se ještě podíváme'),
      dedupe(S.mistakes).slice(0, 5).map((m) => h('div', { class: 'mistake' },
        /[a-z]/i.test(m.en) ? speakBtn(m.en, { size: 'sm', slow: false }) : null,
        h('div', null, h('b', null, m.en), m.cz && h('div', { class: 'muted' }, m.cz))))),
  ));
  if (badges.length) setTimeout(() => sfx.badge(), 700);
}

const dedupe = (list) => list.filter((m, i) => list.findIndex((x) => x.en === m.en) === i);

// ---------- Vykreslení jednotlivých cvičení ----------
const autoplay = (text, opts) => { if (state.settings.autoPlay && text) speak(text, opts); };

function renderIntro(step, ctx) {
  const it = step.item;
  markSeen(it.id);
  save();
  autoplay(it.en);
  ctx.footer(h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: ctx.next }, 'Pokračovat'));
  return h('div', { class: 'card intro-card' },
    h('div', { class: 'eyebrow' }, it.kind === 'phrase' ? '✨ Nová fráze' : '✨ Nové slovíčko'),
    h('div', { class: 'intro-en' }, it.en),
    speakBtn(it.en, { size: 'lg' }),
    h('div', { class: 'intro-cz' }, it.cz),
    it.ex && h('div', { class: 'example' },
      h('div', { class: 'example-row' }, speakBtn(it.ex, { size: 'sm', slow: false }), h('span', { class: 'example-en' }, it.ex)),
      h('div', { class: 'example-cz' }, it.exCz)));
}

function renderMC(step, ctx) {
  const wrap = h('div', { class: 'mc' });
  wrap.append(h('div', { class: 'instruction' }, step.instruction));
  if (step.hideText) {
    wrap.append(h('div', { class: 'listen-hero' }, bigPlay(step.audio), h('button', { class: 'btn btn-ghost btn-sm', onclick: () => speak(step.audio, { slow: true }) }, '🐢 Pomalu')));
    autoplay(step.audio);
  } else {
    const promptEl = h('div', { class: `prompt ${step.promptLang === 'en' ? 'en' : 'cz'} ${step.prompt.length > 40 ? 'long' : ''}` });
    if (step.gap) {
      const [a, b] = step.prompt.split(/_{2,}/);
      promptEl.append(a, h('span', { class: 'blank' }, ' '), b);
    } else promptEl.append(step.prompt);
    const row = h('div', { class: 'prompt-row' }, promptEl, step.audio && speakBtn(step.audio, { size: 'md' }));
    wrap.append(row);
    if (step.hint) wrap.append(h('div', { class: 'hint' }, step.hint));
    if (step.audio && step.promptLang === 'en') autoplay(step.audio);
  }
  const list = h('div', { class: 'options' });
  let done = false;
  step.options.forEach((o, idx) => {
    const b = h('button', { class: `option ${step.optionLang === 'en' ? 'en' : ''}`, onclick: () => {
      if (done) return;
      done = true;
      const ok = o === step.correct;
      list.querySelectorAll('.option').forEach((x) => {
        x.disabled = true;
        if (x.dataset.v === step.correct) x.classList.add('is-right');
      });
      if (!ok) b.classList.add('is-wrong');
      const blank = wrap.querySelector('.blank');
      if (blank) { blank.textContent = step.correct; blank.classList.add(ok ? 'ok' : 'fix'); }
      ctx.answer({
        correct: ok, correctText: step.correct, reveal: step.reveal,
        explain: step.gap ? null : step.hint,
        speakText: step.after || (step.optionLang === 'en' ? step.correct : step.audio),
      });
    } }, h('span', { class: 'opt-key' }, String(idx + 1)), h('span', { class: 'opt-text' }, o));
    b.dataset.v = o;
    list.append(b);
  });
  wrap.append(list);
  return wrap;
}

function bigPlay(text, partner = false) {
  const b = h('button', { class: 'big-play', 'aria-label': 'Přehrát znovu', onclick: () => {
    b.classList.add('playing');
    speak(text, { partner, onend: () => b.classList.remove('playing') });
  } }, icon('volume', 44));
  return b;
}

function renderMatch(step, ctx) {
  const items = step.items;
  const wrongIds = new Set();
  let mistakes = 0, matched = 0, sel = null;
  const col = (side) => h('div', { class: 'match-col' }, shuffle(items).map((it) => {
    const b = h('button', { class: `match-tile ${side}`, onclick: () => tap(side, it, b) }, side === 'en' ? it.en : it.cz);
    return b;
  }));
  const tap = (side, it, b) => {
    if (b.classList.contains('done')) return;
    if (side === 'en') speak(it.en);
    if (!sel || sel.side === side) {
      sel?.b.classList.remove('sel');
      sel = { side, it, b };
      b.classList.add('sel');
      sfx.tap();
      return;
    }
    if (sel.it.id === it.id) {
      [sel.b, b].forEach((x) => { x.classList.remove('sel'); x.classList.add('done'); x.disabled = true; });
      matched++;
      vibrate(10);
      sel = null;
      if (matched === items.length) {
        setTimeout(() => ctx.answer({
          correct: mistakes <= 1,
          items: items.map((x) => [x.id, !wrongIds.has(x.id)]),
          explain: mistakes ? `Počet omylů: ${mistakes}` : 'Všechny dvojice napoprvé!',
        }), 250);
      }
    } else {
      mistakes++;
      wrongIds.add(it.id); wrongIds.add(sel.it.id);
      const a = sel.b;
      [a, b].forEach((x) => x.classList.add('bad'));
      sfx.wrong();
      vibrate([20, 30, 20]);
      setTimeout(() => [a, b].forEach((x) => x.classList.remove('bad', 'sel')), 600);
      sel = null;
    }
  };
  return h('div', { class: 'match' },
    h('div', { class: 'instruction' }, 'Spojte dvojice – angličtina a čeština'),
    h('div', { class: 'match-grid' }, col('en'), col('cz')));
}

function renderBuild(step, ctx) {
  const line = h('div', { class: 'build-line' });
  const bank = h('div', { class: 'bank' });
  const checkBtn = h('button', { class: 'btn btn-primary btn-block btn-lg', disabled: true, onclick: check });
  checkBtn.textContent = 'Zkontrolovat';
  const chosen = [];
  const refresh = () => {
    checkBtn.disabled = !chosen.length;
    line.classList.toggle('empty', !chosen.length);
  };
  step.tiles.forEach((w) => {
    const slot = h('span', { class: 'slot' });
    const tile = h('button', { class: 'tile', onclick: () => {
      if (line.classList.contains('locked')) return;
      sfx.tap();
      if (tile.parentElement === line) {
        slot.append(tile);
        chosen.splice(chosen.indexOf(tile), 1);
      } else {
        line.append(tile);
        chosen.push(tile);
      }
      refresh();
    } }, w);
    slot.append(tile);
    bank.append(slot);
  });
  function check() {
    line.classList.add('locked');
    const said = chosen.map((t) => t.textContent).join(' ');
    const ok = normalize(said) === normalize(step.target);
    line.classList.add(ok ? 'ok' : 'bad');
    ctx.answer({ correct: ok, correctText: step.target, explain: step.audioOnly ? step.cz : null, speakText: step.target });
  }
  refresh();
  ctx.footer(checkBtn);
  const head = step.audioOnly
    ? h('div', { class: 'listen-hero' }, bigPlay(step.target), h('button', { class: 'btn btn-ghost btn-sm', onclick: () => speak(step.target, { slow: true }) }, '🐢 Pomalu'))
    : h('div', { class: 'prompt cz' }, step.cz);
  if (step.audioOnly) autoplay(step.target);
  return h('div', { class: 'build' },
    h('div', { class: 'instruction' }, step.audioOnly ? 'Poslechněte si a složte, co zaznělo' : 'Složte větu anglicky'),
    head, line, bank);
}

function renderSpeak(step, ctx) {
  const status = h('div', { class: 'speak-status' });
  const wrap = h('div', { class: 'speak-ex' },
    h('div', { class: 'instruction' }, 'Řekněte nahlas anglicky'),
    h('div', { class: 'prompt-row' }, h('div', { class: 'prompt en' }, step.text), speakBtn(step.text)),
    step.cz && h('div', { class: 'hint' }, step.cz));
  const skip = h('button', { class: 'btn btn-ghost btn-block', onclick: () => { S.skipSpeak = true; ctx.next(); } }, 'Teď nemůžu mluvit');
  if (canListen && !S.srFailed) {
    let attempts = 0;
    const mic = h('button', { class: 'mic-btn', 'aria-label': 'Mluvit', onclick: async () => {
      if (mic.classList.contains('listening')) return;
      mic.classList.add('listening');
      status.textContent = 'Poslouchám… mluvte teď';
      try {
        const alts = await listen();
        mic.classList.remove('listening');
        if (!S || S.queue[S.i] !== step) return;
        attempts++;
        if (!alts.length) {
          status.textContent = 'Nic jsem nezachytila. Klepněte a zkuste to znovu.';
        } else {
          const { score, heard } = speechMatch(step.text, alts);
          if (score >= 0.7) {
            ctx.answer({ correct: true, explain: `Rozpoznáno: „${heard}“` });
            return;
          }
          status.textContent = `Rozpoznáno: „${heard}“. Zkuste to ještě jednou – klidně pomaleji.`;
        }
        if (attempts >= 2) {
          ctx.footer(h('button', { class: 'btn btn-secondary btn-block', onclick: () => ctx.answer({ correct: false, correctText: step.text, explain: 'Nevadí – výslovnost se zlepšuje opakováním.', speakText: step.text }) }, 'Přeskočit tuto větu'), skip);
        }
      } catch (err) {
        S.srFailed = true;
        mic.classList.remove('listening');
        if (S && S.queue[S.i] === step) { S.i--; next(); }
      }
    } }, icon('mic', 40));
    status.textContent = 'Klepněte na mikrofon a mluvte';
    wrap.append(h('div', { class: 'mic-wrap' }, mic), status);
    ctx.footer(skip);
  } else {
    wrap.append(h('p', { class: 'muted center' }, 'Přehrajte si větu, zopakujte ji nahlas a pak klepněte níže.'));
    ctx.footer(h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: () => ctx.answer({ correct: true, explain: 'Pravidelné mluvení nahlas je nejrychlejší cesta k plynulosti.' }) }, '✓ Řekla jsem to nahlas'), skip);
  }
  autoplay(step.text);
  return wrap;
}

function renderTip(step, ctx) {
  const t = step.tip;
  ctx.footer(h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: ctx.next }, 'Rozumím, pokračovat'));
  return h('div', { class: 'card tip-card' },
    h('div', { class: 'eyebrow' }, '🧩 Gramatický tip'),
    h('h3', null, t.title),
    h('p', null, t.text),
    t.examples.map(([en, cz]) => h('div', { class: 'example' },
      h('div', { class: 'example-row' }, speakBtn(en, { size: 'sm', slow: false }), h('span', { class: 'example-en' }, en)),
      h('div', { class: 'example-cz' }, cz))));
}

function renderDialogue(step, ctx) {
  const d = step.unit.dialogue;
  const chat = h('div', { class: 'chat' });
  const choices = h('div', { class: 'choices' });
  let showCz = false, i = 0, stopAll = null;
  const toggle = h('button', { class: 'chip-btn', onclick: () => {
    showCz = !showCz;
    chat.classList.toggle('show-cz', showCz);
    toggle.classList.toggle('on', showCz);
  } }, icon('translate', 18), ' Překlad');

  const bubble = (who, en, cz) => {
    const b = h('div', { class: `bubble ${who === 'A' ? 'them' : 'me'}` },
      h('div', { class: 'bubble-name' }, who === 'A' ? d.partner : state.settings.name),
      h('div', { class: 'bubble-en' }, en),
      h('div', { class: 'bubble-cz' }, cz));
    b.addEventListener('click', () => { b.classList.toggle('open'); speak(en, { partner: who === 'A' }); });
    chat.append(b);
    requestAnimationFrame(() => b.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    return b;
  };

  const typing = () => {
    const t = h('div', { class: 'bubble them typing' }, h('span'), h('span'), h('span'));
    chat.append(t);
    return t;
  };

  const step2 = () => {
    if (!S || S.queue[S.i] !== step) return;
    if (i >= d.lines.length) return done();
    const [who, en, cz] = d.lines[i];
    if (who === 'A') {
      const t = typing();
      setTimeout(() => {
        t.remove();
        bubble('A', en, cz);
        speak(en, { partner: true, onend: () => { i++; setTimeout(step2, 300); } });
      }, i === 0 ? 150 : 550);
    } else {
      const others = d.lines.filter((l, j) => l[0] === 'B' && j !== i).map((l) => l[1]);
      const opts = shuffle([en, ...shuffle(others).slice(0, 2)]);
      let first = true;
      choices.replaceChildren(h('div', { class: 'instruction small' }, 'Vyberte svou odpověď:'),
        ...opts.map((o) => {
          const b = h('button', { class: 'option en reply', onclick: () => {
            if (o === en) {
              if (first) record({ correct: true, skill: 'conversation' });
              choices.replaceChildren();
              bubble('B', en, cz);
              sfx.correct();
              speak(en, { onend: () => { i++; setTimeout(step2, 300); } });
            } else {
              if (first) { record({ correct: false, skill: 'conversation' }); S.mistakes.push({ en, cz }); }
              first = false;
              b.classList.add('is-wrong');
              b.disabled = true;
              sfx.wrong();
              vibrate([20, 30, 20]);
              if (!choices.querySelector('.hint')) choices.append(h('div', { class: 'hint' }, `Nápověda: ${cz}`));
            }
          } }, o);
          return b;
        }));
      requestAnimationFrame(() => choices.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    }
  };

  const done = () => {
    state.stats.dialogues++;
    save();
    const replay = h('button', { class: 'btn btn-secondary btn-block', onclick: () => {
      if (stopAll) { stopAll(); stopAll = null; replay.textContent = '▶ Přehrát celý rozhovor'; return; }
      replay.textContent = '■ Zastavit';
      const bubbles = [...chat.querySelectorAll('.bubble')];
      stopAll = speakSequence(d.lines.map(([who, en]) => ({ text: en, partner: who === 'A' })), {
        onItem: (k) => bubbles.forEach((b, j) => b.classList.toggle('reading', j === k)),
        onDone: () => { stopAll = null; replay.textContent = '▶ Přehrát celý rozhovor'; bubbles.forEach((b) => b.classList.remove('reading')); },
      });
    } }, '▶ Přehrát celý rozhovor');
    choices.replaceChildren(h('div', { class: 'end-banner' }, '💬 Rozhovor zvládnutý!'));
    ctx.footer(replay, h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: () => { stopAll?.(); ctx.next(); } }, 'Pokračovat'));
  };

  setTimeout(step2, 50);
  return h('div', { class: 'dialogue' },
    h('div', { class: 'dialogue-head' },
      h('div', null, h('div', { class: 'eyebrow' }, 'Rozhovor'), h('h3', null, d.title)), toggle),
    h('p', { class: 'muted small' }, 'Klepnutím na bublinu si větu přehrajete a uvidíte překlad.'),
    chat, choices);
}

function renderRead(step, ctx) {
  const st = step.unit.story;
  let stopAll = null;
  const lines = st.lines.map(([en, cz]) => {
    const p = h('div', { class: 'story-line', onclick: () => { p.classList.toggle('open'); speak(en); } },
      h('span', { class: 'story-en' }, en), h('span', { class: 'story-cz' }, cz));
    return p;
  });
  const play = h('button', { class: 'btn btn-secondary', onclick: () => {
    if (stopAll) { stopAll(); stopAll = null; play.textContent = '▶ Přehrát celý příběh'; lines.forEach((l) => l.classList.remove('reading')); return; }
    play.textContent = '■ Zastavit';
    stopAll = speakSequence(st.lines.map(([en]) => ({ text: en })), {
      onItem: (k) => lines.forEach((l, j) => l.classList.toggle('reading', j === k)),
      onDone: () => { stopAll = null; play.textContent = '▶ Přehrát celý příběh'; lines.forEach((l) => l.classList.remove('reading')); },
    });
  } }, '▶ Přehrát celý příběh');
  ctx.footer(h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: () => {
    stopAll?.();
    state.stats.stories++;
    ctx.bonus(5, 'reading');
    ctx.next();
  } }, 'Pokračovat k otázkám'));
  return h('div', { class: 'card story' },
    h('div', { class: 'eyebrow' }, '📖 Příběh'),
    h('h3', null, st.title),
    h('p', { class: 'muted small' }, 'Klepněte na větu – přehraje se a ukáže se překlad.'),
    play,
    h('div', { class: 'story-text' }, lines));
}

const RENDER = {
  intro: renderIntro, mc: renderMC, match: renderMatch, build: renderBuild,
  speak: renderSpeak, tip: renderTip, dialogue: renderDialogue, read: renderRead,
};
