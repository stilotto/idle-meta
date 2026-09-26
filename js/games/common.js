// Pieces shared by the individual games.
import { fmt, toggle } from '../util.js';

// Run a game's tick in fixed chunks (time warps, loot).
export function simulate(game, s, sec, ctx, steps = 600) {
  const dt = sec / steps;
  for (let i = 0; i < steps; i++) game.tick(s, dt, ctx);
}

// One-time upgrades: shows the next few unbought, cheapest first.
export function upgradeList(el, { items, owned, cash, cur, onBuy, title = 'Upgrades' }) {
  let rows = [];
  function build() {
    const left = items.filter(u => !owned(u));
    const shown = left.slice(0, 8);
    el.innerHTML = `<div class="sec-h">${title} <small>${items.length - left.length}/${items.length} owned</small></div>
      <div class="list">${shown.length ? shown.map(u => `
        <div class="row up">
          <div class="row-icon">${u.icon}</div>
          <div class="row-mid"><div class="row-name">${u.name}</div><div class="row-sub">${u.desc}</div></div>
          <button class="buy" data-u="${u.id}"><b>${cur} ${fmt(u.cost)}</b></button>
        </div>`).join('') : '<p class="empty">Every upgrade bought. Show-off.</p>'}</div>`;
    rows = shown.map(u => ({ u, btn: el.querySelector(`[data-u="${u.id}"]`) }));
  }
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-u]');
    if (!b) return;
    const u = items.find(x => x.id === b.dataset.u);
    if (u && !owned(u) && cash() >= u.cost) { onBuy(u, e); build(); }
  });
  build();
  return {
    build,
    update() { const c = cash(); for (const r of rows) toggle(r.btn, 'off', c < r.u.cost); },
  };
}

// Show owned rows plus one teaser row for the next locked thing.
export function revealCount(list, owned) {
  let n = 0;
  list.forEach((x, i) => { if (owned(x)) n = i + 1; });
  return n;
}

// Autopilot choice: with probability q take the best value, otherwise an impulse buy.
export function pickBuy(opts, q) {
  if (!opts.length) return null;
  if (Math.random() < q) return opts.reduce((a, b) => (b.gain / b.cost > a.gain / a.cost ? b : a));
  return opts[Math.floor(Math.random() * opts.length)];
}
// How many purchases an autopilot makes per decision.
export const buysPer = q => 1 + Math.floor(q * 6);
