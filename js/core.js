// Game state, the meta economy (XP, paydays, loot, prestige) and offline catch-up.
import * as D from './data.js';
import { GAMES, BY_ID } from './games/index.js';
import { CRATE } from './art.js';
import { toast, modal, takeQueued, countQueued, burst, fmt, usd, fmtTime, rand, pick, restartAnim, clamp } from './util.js';

export const S = { st: null, openId: null, hold: null, onInstall: null, onOpenGame: null };
const KEY = 'idle-hands-save-v1';

// ---- save / load ----
function merge(def, saved) {
  if (saved === undefined) return def;
  if (def && typeof def === 'object' && !Array.isArray(def) && saved && typeof saved === 'object') {
    const out = { ...saved };
    for (const k of Object.keys(def)) out[k] = merge(def[k], saved[k]);
    return out;
  }
  return saved;
}
export function load() {
  let st = null;
  try { st = JSON.parse(localStorage.getItem(KEY)); } catch (e) { st = null; }
  if (st && st.meta) {
    st = merge(D.newState(), st);
    for (const def of GAMES) {
      const g = st.games[def.id];
      if (g) st.games[def.id] = { ...D.newGame(def), ...g, s: merge(def.init(), g.s) };
    }
    S.st = st;
    return false;
  }
  S.st = D.newState();
  install('farm', true);
  return true;
}
export function save() {
  S.st.lastSeen = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S.st)); } catch (e) { /* storage full or blocked */ }
}
export function wipe() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  S.st = null;
  location.reload();
}

// ---- per-game context handed to game code ----
export function ctxFor(id, now, open, quiet) {
  const st = S.st;
  return {
    now, open, quiet,
    mult: D.gameMult(st, id, now, open),
    autoTaps: D.autoTaps(st),
    pm: D.prestigeMult(st),
    emit: (xp, msg) => { if (xp) addXP(xp, id, quiet); if (msg && !quiet) toast(msg); },
    addGems: n => { st.games[id].gems += n; },
  };
}

export function install(id, silent) {
  const st = S.st, def = BY_ID[id];
  st.games[id] = D.newGame(def);
  const ids = D.installed(st).map(g => g.id);
  const each = Math.floor(100 / ids.length);
  ids.forEach((g, i) => { st.meta.alloc[g] = each + (i === 0 ? 100 - each * ids.length : 0); });
  if (!silent) S.onInstall?.(id);
}

function later(fn) { if (S.hold) S.hold.push(fn); else fn(); }

// ---- XP & levels ----
export function addXP(n, id, quiet) {
  const m = S.st.meta;
  m.xp += n * D.xpMult(S.st, id);
  while (m.xp >= D.xpNeed(m.level)) { m.xp -= D.xpNeed(m.level); levelUp(quiet); }
}
function levelUp() {
  const st = S.st, m = st.meta;
  m.level++;
  const ins = m.level % 5 === 0 ? 3 : 1;
  m.insight += ins;
  const unlocked = GAMES.filter(g => g.unlock <= m.level && !st.games[g.id]);
  unlocked.forEach(g => install(g.id));
  const level = m.level;
  later(() => modal((card, close) => {
    card.classList.add('levelup');
    card.innerHTML = `
      <div class="lv-rays"></div>
      <div class="lv-kicker">Level up!</div>
      <div class="lv-num">${level}</div>
      <div class="lv-rewards">
        <div><span>💡</span><b>+${ins} Insight</b><small>spend it in Research</small></div>
        <div><span>🎁</span><b>Level-up crate</b><small>open it next</small></div>
        ${unlocked.map(g => `<div class="new-game"><span class="app-icon xs">${g.art}</span><b>New game: ${g.name}</b><small>${g.genre} by ${g.dev}</small></div>`).join('')}
      </div>
      <button class="big-btn" data-go>${unlocked.length ? 'Nice! Open the crate' : 'Open the crate'}</button>`;
    card.querySelector('[data-go]').onclick = close;
    const b = card.getBoundingClientRect();
    burst(b.left + b.width / 2, b.top + 90, ['#c38bff', '#ffd84d', '#6fe3ff', '#fff'], 36);
  }, { sticky: true, onClose: () => openLoot(`Level ${level} crate`, null, level % 5 === 0 ? 1 : 0) }));
}

// ---- money ----
function spend(id, dollars, gems) {
  const st = S.st, g = st.games[id];
  g.gems += Math.round(gems);
  g.spent = Math.round((g.spent + dollars) * 100) / 100;
  st.meta.stats.spent = Math.round((st.meta.stats.spent + dollars) * 100) / 100;
}
const cents = n => Math.round(n * 100) / 100;
export function payday(quiet) {
  const st = S.st, m = st.meta, pay = D.salary(st);
  m.wallet = cents(m.wallet + pay);
  m.stats.paydays++;
  let spent = 0;
  const declined = [];
  for (const def of D.installed(st)) {
    const b = m.budget[def.id] || 0;
    if (!b) continue;
    if (m.wallet >= b) { m.wallet = cents(m.wallet - b); spend(def.id, b, b * D.gemsPerDollar(st)); spent += b; }
    else declined.push(def.name);
  }
  if (!quiet) toast(`💵 <b>Payday!</b> +${usd(pay)}${spent ? ` · ${usd(spent)} went to gems` : ''}${declined.length ? `<br>💳 Card declined: ${declined.join(', ')}` : ''}`, 'money');
  return { pay, spent };
}
export function buyPack(id, price, gems) {
  const m = S.st.meta;
  if (m.wallet < price) return false;
  m.wallet = cents(m.wallet - price);
  spend(id, price, gems * (D.has(S.st, 'h2') ? 1.25 : 1));
  return true;
}

// ---- loot ----
const TABLE = [
  [['burst', 180], ['gems', 8], ['cash', 3]],
  [['burst', 900], ['gems', 30], ['cash', 10], ['xp', 0.3]],
  [['warp', 1800], ['gems', 100], ['insight', 2], ['boost', 900]],
  [['warp', 7200], ['insight', 5], ['gems', 300]],
];
export function rollLoot(targetId, floor = 0) {
  const st = S.st, r = D.rollRarity(st, floor), LM = D.lootMult(st);
  const id = targetId || pick(D.installed(st)).id, def = BY_ID[id], g = st.games[id];
  const [type, amt] = pick(TABLE[r]);
  return {
    rarity: r,
    apply() {
      const m = st.meta, now = Date.now(), out = [];
      const ctx = ctxFor(id, now, false, true);
      const add = (icon, key, n, text) => out.push({ icon, key, n, text });
      if (type === 'burst') add(def.cur.icon, 'cur' + id, def.grant(g.s, amt * LM, ctx), n => `+${fmt(n)} ${def.cur.name} in ${def.name}`);
      if (type === 'gems') { g.gems += amt * LM; add('💎', 'gems' + id, amt * LM, n => `+${fmt(n)} gems for ${def.name}`); }
      if (type === 'cash') { m.wallet = cents(m.wallet + amt * LM); add('💵', 'cash', amt * LM, n => `+${usd(n)} found in old jackets`); }
      if (type === 'xp') { const x = D.xpNeed(m.level) * amt * LM; add('✨', 'xp', x, n => `+${fmt(n)} XP`); later(() => addXP(x / D.xpMult(st, null))); }
      if (type === 'warp') { const x = def.warp(g.s, amt * LM, ctx); add('⏩', 'warp' + id, amt * LM, n => `${fmtTime(n)} of time warp in ${def.name}`); add(def.cur.icon, 'cur' + id, x, n => `+${fmt(n)} ${def.cur.name} in ${def.name}`); }
      if (type === 'insight') { m.insight += amt * LM; add('💡', 'insight', amt * LM, n => `+${fmt(n)} Insight`); }
      if (type === 'boost') { g.boostUntil = Math.max(now, g.boostUntil) + amt * 1000 * LM; add('🚀', 'boost' + id, amt * LM, n => `2× speed in ${def.name} for ${fmtTime(n)}`); }
      if (r === 3) { m.relics++; m.stats.legend++; add('🏺', 'relic', 1, n => `${n > 1 ? n + ' lucky relics' : 'Lucky relic'}: +${5 * n}% speed in every game, forever`); }
      m.stats.loot++;
      return out;
    },
  };
}

const lineHTML = l => `<div class="loot-line"><span>${l.icon}</span><p>${l.text(l.n)}</p></div>`;

// Open this crate plus every crate still waiting in line, and show one combined summary.
function openAll(card, close, loot) {
  const loots = [loot, ...takeQueued('loot').map(o => o.loot)];
  const sums = new Map(), rar = [0, 0, 0, 0];
  for (const l of loots) {
    rar[l.rarity]++;
    for (const e of l.apply()) {
      const cur = sums.get(e.key);
      if (cur) cur.n += e.n; else sums.set(e.key, { ...e });
    }
  }
  const best = D.RARITY[rar.findLastIndex(n => n > 0)];
  card.style.setProperty('--rar', best.color);
  card.classList.add('opened', 'summary', 'r-' + best.id);
  card.innerHTML = `
    <div class="loot-glow"></div>
    <div class="loot-rar">${loots.length} crate${loots.length > 1 ? 's' : ''} opened</div>
    <div class="rar-row">${rar.map((n, i) => (n ? `<span style="--c:${D.RARITY[i].color}">${n} ${D.RARITY[i].name}</span>` : '')).join('')}</div>
    <div class="loot-lines">${[...sums.values()].map(lineHTML).join('')}</div>
    <button class="big-btn">Sweet</button>`;
  card.querySelector('.big-btn').onclick = close;
  const b = card.getBoundingClientRect();
  burst(b.left + b.width / 2, b.top + 70, [best.color, '#fff', '#ffd84d'], 44);
}

export function openLoot(source, targetId, floor = 0) {
  const loot = rollLoot(targetId, floor), R = D.RARITY[loot.rarity];
  modal((card, close) => {
    const m = S.st.meta, waiting = countQueued('loot');
    card.classList.add('loot');
    card.innerHTML = `
      <div class="loot-src">${source}</div>
      <button class="chest" aria-label="Open crate">${CRATE}</button>
      <div class="loot-hint">${m.openAll ? 'Tap to open everything' : 'Tap the crate to open it'}</div>
      <div class="loot-pips"><i></i><i></i><i></i></div>
      <label class="skip-all"><input type="checkbox" ${m.openAll ? 'checked' : ''}> Skip ahead: open all crates at once${waiting ? ` <b>(${waiting + 1} waiting)</b>` : ''}</label>`;
    const chest = card.querySelector('.chest'), pips = card.querySelectorAll('.loot-pips i');
    card.querySelector('.skip-all input').onchange = e => {
      m.openAll = e.target.checked;
      if (m.openAll) openAll(card, close, loot);
    };
    let taps = 0;
    chest.onclick = () => {
      if (m.openAll) return openAll(card, close, loot);
      taps++;
      pips[taps - 1]?.classList.add('on');
      restartAnim(chest, 'shake');
      if (taps === 2) card.style.setProperty('--rar', R.color), card.classList.add('tease');
      if (taps < 3) return;
      const lines = loot.apply();
      card.classList.add('opened', 'r-' + R.id);
      card.innerHTML = `
        <div class="loot-glow"></div>
        <div class="loot-rar">${R.name}</div>
        <div class="loot-lines">${lines.map(lineHTML).join('')}</div>
        <button class="big-btn">Sweet</button>`;
      card.querySelector('.big-btn').onclick = close;
      const b = card.getBoundingClientRect();
      burst(b.left + b.width / 2, b.top + 70, [R.color, '#fff', '#ffd84d'], loot.rarity >= 2 ? 44 : 20);
    };
  }, { sticky: true, kind: 'loot', loot });
}

export function spawnDrop() {
  const L = document.getElementById('banner-layer');
  if (L.children.length) return;
  const def = pick(D.installed(S.st));
  const el = document.createElement('button');
  el.className = 'drop';
  el.innerHTML = `<span class="app-icon xs">${def.art}</span><span class="drop-txt"><b>${def.name}</b><span>${pick(def.drops)}</span></span><span class="drop-gift">🎁</span><i class="drop-timer"></i>`;
  el.onclick = () => { el.remove(); openLoot(`${def.name} · notification`, def.id); };
  L.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 12000);
}

// ---- prestige ----
export function doPrestige(id, auto, quiet) {
  const st = S.st, def = BY_ID[id], g = st.games[id], P = def.prestige;
  const gain = def.reset(g.s, D.prestigeMult(st));
  if (gain < 1) return;
  g.prestiges++;
  st.meta.stats.prestiges++;
  const ins = 2 + Math.floor(Math.log2(gain + 1));
  st.meta.insight += ins;
  if (auto) {
    addXP(20 + 6 * Math.sqrt(gain), id, quiet);
    if (!quiet) toast(`📜 Auto-${P.one}: ${def.name} +${fmt(gain)} ${P.icon} · +${ins} 💡`);
    return;
  }
  modal((card, close) => {
    card.classList.add('prest-done', 'theme-' + def.theme);
    card.innerHTML = `
      <div class="pd-emblem">${P.icon}</div>
      <div class="lv-kicker">${P.one} #${g.prestiges}</div>
      <h2>+${fmt(gain)} ${P.cur}</h2>
      <p>${def.bonus(g.s)} in ${def.name}</p>
      <div class="lv-rewards"><div><span>💡</span><b>+${ins} Insight</b><small>for your Research tree</small></div></div>
      <button class="big-btn">Start again, stronger</button>`;
    card.querySelector('.big-btn').onclick = close;
    const b = card.getBoundingClientRect();
    burst(b.left + b.width / 2, b.top + 80, ['#ffd84d', '#ff7ac6', '#fff'], 40);
  }, { sticky: true, onClose: () => addXP(20 + 6 * Math.sqrt(gain), id) });
}

// ---- trophies ----
export function checkAch() {
  const st = S.st;
  for (const a of D.ACH) {
    if (st.meta.ach[a.id] || !a.test(st)) continue;
    st.meta.ach[a.id] = Date.now();
    st.meta.insight += a.insight;
    toast(`🏆 <b>${a.name}</b> · +${a.insight} 💡 · +2% all games`, 'ach');
  }
}

// ---- time ----
// One game's slice of time, including its autopilot and auto-prestige.
function gameTick(def, dt, now, quiet) {
  const st = S.st, g = st.games[def.id], open = S.openId === def.id;
  const ctx = ctxFor(def.id, now, open, quiet);
  def.tick(g.s, dt, ctx);
  if (g.auto && !open) {
    g.autoT += dt;
    const every = D.autoEvery(st, def.id);
    if (g.autoT >= every) {
      g.autoT = 0;
      def.autopilot(g.s, ctx, { q: D.autoSkill(st, def.id), ups: D.has(st, 'a2') });
    }
  }
  if (g.autoPrestige && !open && D.has(st, 'a3') && def.gain(g.s, ctx.pm) >= Math.max(1, def.owned(g.s) * 0.5)) doPrestige(def.id, true, quiet);
}

function sample(st) {
  for (const def of D.installed(st)) {
    const g = st.games[def.id];
    g.hist.push(Math.round(def.score(g.s) * 100) / 100);
    if (g.hist.length > 40) g.hist.shift();
  }
}

function spawnEvent(st) {
  const def = pick(D.installed(st)), type = pick(Object.keys(D.EVENTS)), E = D.EVENTS[type];
  st.meta.events.push({ type, id: def.id, until: Date.now() + E.len * 1000 });
  toast(`${E.icon} <b>${def.name}</b>: ${E.name}! ${E.desc}.`, 'ach');
}

export function step(dt, now) {
  const st = S.st, m = st.meta;
  for (const def of D.installed(st)) gameTick(def, dt, now, false);
  m.sanity = clamp(m.sanity + D.sanityRate(st) * dt, 0, 100);
  m.histT += dt;
  if (m.histT >= 30) { m.histT = 0; sample(st); }
  m.events = m.events.filter(e => e.until > now);
  m.eventT -= dt;
  if (m.eventT <= 0) { m.eventT = rand(240, 420); if (!m.events.length && document.visibilityState === 'visible') spawnEvent(st); }
  m.payT += dt;
  if (m.payT >= D.payEvery(st)) { m.payT -= D.payEvery(st); payday(false); }
  m.lootT -= dt;
  if (m.lootT <= 0) { m.lootT = D.lootEvery(st) * rand(0.6, 1.4); if (document.visibilityState === 'visible') spawnDrop(); }
}

export function catchUp(realSec, full) {
  const st = S.st, m = st.meta, defs = D.installed(st);
  const real = full ? realSec : Math.min(realSec, D.offlineCap(st));
  const eff = full ? 1 : D.offlineEff(st), sim = real * eff;
  const before = {}, gems = {}, lv = m.level, wallet = m.wallet;
  for (const d of defs) { before[d.id] = d.cash(st.games[d.id].s); gems[d.id] = st.games[d.id].gems; }
  S.hold = [];
  const steps = Math.min(20000, Math.max(20, Math.ceil(sim)));
  const dt = sim / steps, t0 = Date.now() - real * 1000;
  for (let i = 0; i < steps; i++) {
    const now = t0 + (i / steps) * real * 1000;
    for (const d of D.installed(st)) gameTick(d, dt, now, true);
  }
  m.sanity = clamp(m.sanity + (full ? D.sanityRate(st) : 0.1) * real, 0, 100);
  sample(st);
  m.payT += real;
  let pays = 0;
  while (m.payT >= D.payEvery(st)) { m.payT -= D.payEvery(st); payday(true); pays++; }
  if (realSec >= 3600) m.stats.away = true;
  const held = S.hold;
  S.hold = null;
  if (!full && realSec > 60) {
    modal((card, close) => {
      card.classList.add('welcome');
      card.innerHTML = `
        <div class="lv-kicker">Welcome back</div>
        <h2>You were away ${fmtTime(realSec)}</h2>
        <p class="muted">Your games kept going at ${Math.round(eff * 100)}% speed${realSec > real ? ` for the first ${fmtTime(real)} (your offline limit)` : ''}.</p>
        <div class="away-list">
          ${D.installed(st).map(d => `<div><span class="app-icon xs">${d.art}</span><b>${d.name}</b>${d.id in before ? '' : '<em>new!</em>'}<em>+${fmt(Math.max(0, d.cash(st.games[d.id].s) - (before[d.id] || 0)))} ${d.cur.icon}</em>${st.games[d.id].gems > (gems[d.id] || 0) ? `<em>+${fmt(st.games[d.id].gems - (gems[d.id] || 0))} 💎</em>` : ''}</div>`).join('')}
          ${pays ? `<div><span class="emo">💵</span><b>${pays} payday${pays > 1 ? 's' : ''}</b><em>${m.wallet >= wallet ? '+' : ''}${usd(m.wallet - wallet)}</em></div>` : ''}
          ${m.level > lv ? `<div><span class="emo">⭐</span><b>Level ${lv} → ${m.level}</b></div>` : ''}
        </div>
        <button class="big-btn">Let's go</button>`;
      card.querySelector('.big-btn').onclick = close;
    });
  }
  held.forEach(fn => fn());
}

export function dailyCheck(first) {
  const m = S.st.meta, today = new Date().toDateString();
  if (m.streak.day === today) return;
  const y = new Date(Date.now() - 864e5).toDateString();
  m.streak.n = m.streak.day === y ? m.streak.n + 1 : 1;
  m.streak.day = today;
  if (!first) openLoot(`Daily login · day ${m.streak.n} 🔥`, null, Math.min(3, Math.floor(m.streak.n / 3)));
}
