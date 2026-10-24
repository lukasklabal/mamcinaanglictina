// Start aplikace.
import { state, save, today, addDays } from './state.js';
import { applyTheme } from './platform.js';
import { startRouter } from './router.js';

applyTheme();

// Návrat po pauze (odznak „Vítejte zpět“)
const last = state.stats.lastActive;
if (last && last < addDays(today(), -2)) state.stats.comeback = true;
state.stats.lastActive = today();
save();

// Požádat prohlížeč, aby data nemazal
navigator.storage?.persist?.().catch(() => {});

startRouter();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
  // Nová verze: obnovit stránku (ne při první instalaci ani uprostřed lekce)
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded || document.querySelector('.session')) return;
    reloaded = true;
    location.reload();
  });
}
