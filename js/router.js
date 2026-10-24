// Jednoduchý router nad #hash + spodní navigace.
import * as V from './views.js';
import { h, icon } from './ui.js';

const ROUTES = [
  [/^#?\/?(home)?$/, V.home, 'home'],
  [/^#\/learn$/, V.learn, 'learn'],
  [/^#\/unit\/([\w-]+)$/, V.unit, 'learn'],
  [/^#\/grammar\/([\w-]+)$/, V.grammar, 'learn'],
  [/^#\/verbs$/, V.verbs, 'learn'],
  [/^#\/practice$/, V.practice, 'practice'],
  [/^#\/talk$/, V.talk, 'practice'],
  [/^#\/progress(?:\/(\w+))?$/, V.progress, 'progress'],
  [/^#\/words$/, V.words, 'progress'],
  [/^#\/settings$/, V.settings, 'settings'],
];

const TABS = [
  ['home', '#/', 'home', 'Dnes'],
  ['learn', '#/learn', 'book', 'Lekce'],
  ['practice', '#/practice', 'target', 'Procvičit'],
  ['progress', '#/progress', 'chart', 'Pokrok'],
];

let tabbar;
let navCount = 0;

// Zda lze použít history.back() a zůstat v aplikaci
export const canGoBack = () => navCount > 0;

function render(keepScroll) {
  const hash = location.hash || '#/';
  let match = null, fn = V.home, tab = 'home';
  for (const [re, f, t] of ROUTES) {
    match = hash.match(re);
    if (match) { fn = f; tab = t; break; }
  }
  const y = window.scrollY;
  const view = document.getElementById('view');
  const params = match ? match.slice(1).filter((x) => x !== undefined && x !== 'home') : [];
  view.replaceChildren(fn(...params));
  view.dataset.tab = tab;
  tabbar.querySelectorAll('a').forEach((a) => {
    const on = a.dataset.tab === tab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, keepScroll ? y : 0);
}

export const rerender = () => render(true);
export const go = (hash) => { if (location.hash === hash) render(false); else location.hash = hash; };

export function startRouter() {
  tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Hlavní navigace' },
    TABS.map(([id, href, ic, label]) => h('a', { href, 'data-tab': id }, h('span', { class: 'tab-icon' }, icon(ic, 26)), h('span', { class: 'tab-label' }, label))));
  document.getElementById('app').append(tabbar);
  window.addEventListener('hashchange', () => { navCount++; render(false); });
  render(false);
}
