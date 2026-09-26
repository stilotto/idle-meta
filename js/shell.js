// The full-screen "app" you pop into: header, tabs, prestige and gem shop around each game's own views.
import { S, ctxFor, doPrestige, openLoot, buyPack } from './core.js';
import { BY_ID } from './games/index.js';
import * as D from './data.js';
import { fmt, usd, fmtTime, setText, toggle, show, floatText, burst, modal, toast } from './util.js';

let cur = null;
const MODES = [1, 10, 100, 'next', 'max'];

function makeApi(id) {
  return {
    ctx: () => ctxFor(id, Date.now(), true, false),
    mode: () => S.st.buyMode,
    cycleMode: () => { S.st.buyMode = MODES[(MODES.indexOf(S.st.buyMode) + 1) % MODES.length]; },
    tap: (e, text, color) => { S.st.meta.stats.taps++; if (text) floatText(e.clientX, e.clientY, text, color); },
    pop: (e, text, color) => floatText(e.clientX, e.clientY, text, color),
    burst: (e, colors) => burst(e.clientX, e.clientY, colors),
  };
}

export function openGame(id, fromHistory) {
  if (cur) closeGame(true);
  const def = BY_ID[id];
  S.openId = id;
  if (!fromHistory) history.pushState({ game: id }, '');
  const el = document.getElementById('game');
  el.className = 'game theme-' + def.theme;
  el.hidden = false;
  el.innerHTML = `
    <header class="g-head">
      <button class="g-back" data-act="back" aria-label="Back to home">‹</button>
      <div class="g-title"><span class="app-icon xs">${def.art}</span><span><b>${def.name}</b><small>${def.dev}</small></span></div>
      <button class="g-chest" data-act="chest" hidden aria-label="Free chest">🎁</button>
      <button class="g-gems" data-act="shop">💎 <b data-k="gems"></b></button>
    </header>
    <div class="g-mult" data-act="mult"><span data-k="mult"></span><span data-k="boost"></span></div>
    <nav class="g-tabs">${[...def.tabs, ['prestige', def.prestige.noun], ['shop', 'Shop']].map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('')}</nav>
    <div class="g-body"></div>`;
  cur = {
    id, def, el, api: makeApi(id), body: el.querySelector('.g-body'), view: null, tab: null,
    gems: el.querySelector('[data-k="gems"]'), mult: el.querySelector('[data-k="mult"]'),
    boost: el.querySelector('[data-k="boost"]'), chest: el.querySelector('.g-chest'),
  };
  el.onclick = e => {
    const t = e.target.closest('[data-tab]');
    if (t) return showTab(t.dataset.tab);
    const a = e.target.closest('.g-head [data-act], .g-mult[data-act]');
    if (!a) return;
    if (a.dataset.act === 'back') history.back();
    if (a.dataset.act === 'shop') showTab('shop');
    if (a.dataset.act === 'mult') multModal(id);
    if (a.dataset.act === 'chest') {
      const g = S.st.games[id];
      if (g.chestAt > Date.now()) return;
      g.chestAt = Date.now() + 5 * 60e3;
      openLoot(`${def.name} · free chest`, id);
    }
  };
  showTab(def.tabs[0][0]);
  requestAnimationFrame(() => el.classList.add('in'));
}

export function closeGame(instant) {
  if (!cur) return;
  const el = cur.el;
  S.openId = null;
  cur = null;
  el.classList.remove('in');
  const done = () => { if (!cur) { el.hidden = true; el.innerHTML = ''; } };
  if (instant) done(); else setTimeout(done, 250);
}

function showTab(tab) {
  const { def, body, api, id, el } = cur, s = S.st.games[id].s;
  cur.tab = tab;
  el.querySelectorAll('[data-tab]').forEach(b => toggle(b, 'on', b.dataset.tab === tab));
  body.scrollTop = 0;
  body.onclick = null;
  if (tab === 'play') cur.view = def.mountPlay(body, s, api);
  else if (tab === 'up') cur.view = def.mountUp(body, s, api);
  else if (tab === 'prestige') cur.view = mountPrestige(body, id);
  else cur.view = mountShop(body, id);
}

export function shellUpdate() {
  if (!cur) return;
  const g = S.st.games[cur.id], now = Date.now();
  setText(cur.gems, fmt(g.gems));
  setText(cur.mult, `×${fmt(D.gameMult(S.st, cur.id, now, true))} speed`);
  setText(cur.boost, g.boostUntil > now ? ` · 🚀 ${fmtTime((g.boostUntil - now) / 1000)}` : '');
  show(cur.chest, g.chestAt <= now);
  cur.view?.update();
}

function multModal(id) {
  const now = Date.now(), parts = D.multParts(S.st, id, now, true);
  modal((card, close) => {
    card.innerHTML = `<h2>Why so fast?</h2><div class="mult-list">${parts.map(([n, v]) => `<div><span>${n}</span><b>×${v < 10 ? v.toFixed(2) : fmt(v)}</b></div>`).join('')}
      <div class="tot"><span>Total</span><b>×${fmt(D.gameMult(S.st, id, now, true))}</b></div></div>
      <p class="muted small">Change Focus on the Budget tab back home. Gem boosts are in the Shop.</p><button class="big-btn">Got it</button>`;
    card.querySelector('.big-btn').onclick = close;
  });
}

function mountPrestige(body, id) {
  const def = BY_ID[id], g = S.st.games[id], P = def.prestige;
  body.innerHTML = `
    <div class="prest">
      <div class="prest-emblem">${P.icon}</div>
      <h2>${P.verb}</h2>
      <p class="muted">${P.blurb}</p>
      <div class="prest-grid">
        <div><small>${P.cur}</small><b data-k="own"></b></div>
        <div><small>Bonus</small><b data-k="bonus"></b></div>
        <div><small>${P.noun}</small><b data-k="count"></b></div>
        <div class="hl"><small>Gain now</small><b data-k="gain"></b></div>
      </div>
      <p class="prest-need" data-k="need"></p>
      <button class="big-btn" data-act="prestige"></button>
      <p class="muted small">Resets this game's progress but keeps your ${P.cur}. Every ${P.one} also earns 💡 Insight for your Research tree.</p>
    </div>`;
  const K = n => body.querySelector(`[data-k="${n}"]`);
  const btn = body.querySelector('[data-act="prestige"]');
  let armed = 0;
  body.onclick = e => {
    if (!e.target.closest('[data-act="prestige"]')) return;
    if (def.gain(g.s, D.prestigeMult(S.st)) < 1) return;
    if (Date.now() - armed > 4000) { armed = Date.now(); return; }
    armed = 0;
    doPrestige(id);
    showTab(def.tabs[0][0]);
  };
  return {
    update() {
      const pm = D.prestigeMult(S.st), gain = def.gain(g.s, pm), ok = gain >= 1;
      setText(K('own'), `${fmt(def.owned(g.s))} ${P.icon}`);
      setText(K('bonus'), def.bonus(g.s));
      setText(K('count'), String(g.prestiges));
      setText(K('gain'), `+${fmt(gain)} ${P.icon}`);
      setText(K('need'), def.need(g.s, pm));
      toggle(btn, 'off', !ok);
      toggle(btn, 'armed', ok && Date.now() - armed < 4000);
      setText(btn, !ok ? 'Not yet' : Date.now() - armed < 4000 ? 'Tap again to confirm' : `${P.verb} (+${fmt(gain)} ${P.icon})`);
    },
  };
}

function mountShop(body, id) {
  const st = S.st, def = BY_ID[id], g = st.games[id];
  const items = [
    { id: 'boost', icon: '🚀', name: '2× Speed · 10 min', desc: 'Stacks, and keeps running while you are away.', price: 40 },
    { id: 'warp', icon: '⏩', name: 'Time Warp · 1 hour', desc: 'Get an hour of progress right now.', price: 120 },
    { id: 'starter', icon: '🎒', name: 'Starter Pack', desc: 'Permanent ×2 speed in this game.', price: 300, once: true },
    { id: 'vip', icon: '👑', name: 'Premium Pass', desc: 'Permanent ×3 speed in this game.', price: 1500, once: true },
  ];
  body.innerHTML = `
    <div class="gem-card"><div class="gem-big">💎 <b data-k="gems"></b></div><small>Gems only work in ${def.name}</small></div>
    <div class="sec-h">Spend gems</div>
    <div class="list">${items.map(it => `
      <div class="row" data-i="${it.id}">
        <div class="row-icon">${it.icon}</div>
        <div class="row-mid"><div class="row-name">${it.name}</div><div class="row-sub">${it.desc}</div></div>
        <button class="buy gem" data-buy="${it.id}"><b>💎 ${D.gemPrice(st, it.price)}</b></button>
      </div>`).join('')}</div>
    <div class="sec-h">Get gems <small>paid from your real-life wallet</small></div>
    <div class="packs">${D.PACKS.map(([p, n], i) => `<button class="pack" data-pack="${i}"><span>${'💎'.repeat(i + 1)}</span><b>${fmt(n * (D.has(st, 'h2') ? 1.25 : 1))} gems</b><em>${usd(p)}</em>${i === 3 ? '<i>Best value!</i>' : ''}</button>`).join('')}</div>
    <p class="muted small center" data-k="f2p"></p>`;
  const gemsEl = body.querySelector('[data-k="gems"]'), f2p = body.querySelector('[data-k="f2p"]');
  body.onclick = e => {
    const b = e.target.closest('[data-buy]'), pk = e.target.closest('[data-pack]');
    if (b) {
      const it = items.find(x => x.id === b.dataset.buy), price = D.gemPrice(st, it.price);
      if (g.gems < price || (it.once && g[it.id])) return;
      g.gems -= price;
      const now = Date.now();
      if (it.id === 'boost') g.boostUntil = Math.max(now, g.boostUntil) + 600e3;
      if (it.id === 'warp') { const x = def.warp(g.s, 3600, ctxFor(id, now, false, true)); toast(`⏩ Warped an hour ahead: +${fmt(x)} ${def.cur.icon}`); }
      if (it.once) g[it.id] = true;
      burst(e.clientX, e.clientY, ['#6fe3ff', '#c38bff', '#fff']);
    }
    if (pk) {
      const [price, n] = D.PACKS[+pk.dataset.pack];
      modal((card, close) => {
        card.classList.add('purchase');
        card.innerHTML = `
          <div class="pay-app"><span class="app-icon xs">${def.art}</span><span><b>${def.name}</b><small>${def.dev}</small></span></div>
          <h2>${fmt(n * (D.has(st, 'h2') ? 1.25 : 1))} 💎 gems</h2>
          <div class="pay-row"><span>Price</span><b>${usd(price)}</b></div>
          <div class="pay-row"><span>Wallet</span><b>${usd(st.meta.wallet)}</b></div>
          ${!g.spent ? '<p class="warn">This ends your F2P run in this game: no more +50% XP from it.</p>' : ''}
          ${st.meta.wallet < price ? '<p class="warn">Not enough money in your wallet. Wait for payday.</p>' : ''}
          <div class="pay-btns"><button class="ghost" data-x>Cancel</button><button class="big-btn" data-ok ${st.meta.wallet < price ? 'disabled' : ''}>Buy</button></div>`;
        card.querySelector('[data-x]').onclick = close;
        card.querySelector('[data-ok]').onclick = ev => {
          if (buyPack(id, price, n)) { burst(ev.clientX, ev.clientY, ['#6fe3ff', '#fff'], 24); toast(`💎 Purchase complete. Thank you for your support!`); }
          close();
        };
      });
    }
  };
  const btns = items.map(it => ({ it, el: body.querySelector(`[data-buy="${it.id}"]`) }));
  return {
    update() {
      setText(gemsEl, fmt(g.gems));
      for (const { it, el } of btns) {
        const owned = it.once && g[it.id];
        toggle(el, 'off', owned || g.gems < D.gemPrice(st, it.price));
        if (owned) setText(el, 'Owned ✓');
      }
      const b = st.meta.budget[id] || 0;
      setText(f2p, g.spent ? `Lifetime spent here: ${usd(g.spent)}${b ? ` · auto-budget ${usd(b)} per payday` : ''}` : `🦸 F2P so far: +50% XP from this game. ${b ? `Auto-budget: ${usd(b)} per payday.` : 'Set an auto-budget on the Budget tab.'}`);
    },
  };
}
