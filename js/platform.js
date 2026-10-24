// Motiv (světlý / tmavý), velikost písma a instalace PWA.
import { state, save } from './state.js';

const media = matchMedia('(prefers-color-scheme: dark)');

export const effectiveTheme = () =>
  (state.settings.theme === 'auto' ? (media.matches ? 'dark' : 'light') : state.settings.theme);

export function applyTheme() {
  const t = effectiveTheme();
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#121120' : '#F6F5FB');
  document.documentElement.style.setProperty('--fs', state.settings.fontScale);
}

export function toggleTheme() {
  state.settings.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
  save();
  applyTheme();
}

media.addEventListener?.('change', () => { if (state.settings.theme === 'auto') applyTheme(); });

// ---------- Instalace ----------
let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const canPromptInstall = () => !!deferred;

export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const r = await deferred.userChoice;
  deferred = null;
  return r.outcome === 'accepted';
}
