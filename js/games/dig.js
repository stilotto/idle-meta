// Just Keep Digging: a self-aware digging game. Deeper ground is harder but pays more.
import { fmt, costOf, stepMult, nextStep, buyN, modeLabel, setText, toggle, show, pick, restartAnim } from '../util.js';
import { upgradeList, revealCount, simulate } from './common.js';
import { ART } from '../art.js';

const CREW = [
  { id: 'intern', name: 'Intern with a Spoon', icon: '🥄', cost: 8, pow: 0.25, quip: 'Unpaid. Enthusiastic.' },
  { id: 'prosp', name: 'Retired Prospector', icon: '⛏️', cost: 110, pow: 1.8, quip: 'Has stories. So many stories.' },
  { id: 'jack', name: 'Jackhammer Janice', icon: '🔨', cost: 1.3e3, pow: 12, quip: 'Loud. Effective. Loud.' },
  { id: 'moles', name: 'Mole Union Local 12', icon: '🐹', cost: 1.6e4, pow: 80, quip: "Technically hamsters. Don't tell them." },
  { id: 'excav', name: 'Slightly Used Excavator', icon: '🚜', cost: 2.1e5, pow: 520, quip: 'Previous owner: "a guy."' },
  { id: 'borer', name: 'Tunnel Borer Named Gary', icon: '🐛', cost: 2.9e6, pow: 3.6e3, quip: 'Gary does not stop. Gary cannot stop.' },
  { id: 'plasma', name: 'Refurbished Plasma Drill', icon: '☄️', cost: 4.1e7, pow: 2.5e4, quip: 'Warranty void if used.' },
  { id: 'laser', name: 'Suspiciously Large Laser', icon: '🔦', cost: 6e8, pow: 1.8e5, quip: 'Suspiciously large.' },
  { id: 'mech', name: 'Mech-Mole 9000', icon: '🤖', cost: 9e9, pow: 1.3e6, quip: 'Achieved sentience. Chose digging.' },
  { id: 'hole', name: 'Tiny Black Hole (Leased)', icon: '🕳️', cost: 1.4e11, pow: 1e7, quip: 'Please return in original condition.' },
];
const G = 1.085;

// name, ore, rock colour, ore colour
const LAYERS = [
  ['Topsoil', 'Bottle Caps', '#7a5230', '#e8d2a0'],
  ['Clay', 'Pottery Shards', '#9c5a3c', '#f0b48a'],
  ['Limestone', 'Fossils', '#a89a80', '#fff6de'],
  ['Coal Seam', 'Coal', '#3a3433', '#0c0b0b'],
  ['Granite', 'Iron Ore', '#6e6a70', '#d9774f'],
  ['Slate', 'Silver', '#48525e', '#e8eef5'],
  ['Quartz Vein', 'Gold', '#8f8577', '#ffd23f'],
  ['Obsidian', 'Gemstones', '#231c2e', '#54f0c8'],
  ['Magma Rind', 'Fire Opals', '#6b1e12', '#ff8a3d'],
  ['Crystal Caverns', 'Star Crystals', '#243a6b', '#9fd8ff'],
  ['Ancient City', 'Lost Tech', '#4a4038', '#7dffb0'],
  ['The Weird Part', 'Suspicious Goo', '#3b1f4a', '#d36bff'],
  ['The Core (Probably)', 'Core Samples', '#8a2a0a', '#ffe066'],
];
const layerAt = i => (i < LAYERS.length ? LAYERS[i] : [`Deep Layer ${i + 1}`, 'Existential Dread', ...LAYERS[i % LAYERS.length].slice(2)]);
const PER = 100, PX = 3, SKY = 70;

const QUIPS = [
  'You are digging a hole. It is going well.',
  'The moles have formed a union. They want dental.',
  'Geologists hate this one weird trick: digging.',
  'Tip: down is the direction we are going.',
  'Loading tip: there is no loading. Only digging.',
  'Somewhere, a hole is being filled. Not on our watch.',
  'Rate us 5 stars or the intern gets it. (The spoon, we mean.)',
  'This layer is 40% rock and 60% vibes.',
  'Fun fact: this hole has no purpose. Keep going.',
  'Our lawyers say the hole is "structurally a hole."',
  'Achievement unlocked: reading this.',
  'Please do not tell the Earth about this.',
];

const UPGRADES = [];
CREW.forEach(c => ['Hard Hats', 'Overtime Pay', 'Motivational Posters'].forEach((t, k) =>
  UPGRADES.push({ id: c.id + k, name: t, icon: c.icon, target: c.id, x: 2, cost: c.cost * 400 * 150 ** k, desc: `${c.name}: ×2 power` })));
[0, 1, 2, 3, 4].forEach(k =>
  UPGRADES.push({ id: 'sort' + k, name: `Ore Sorter Mk ${k + 1}`, icon: '🧲', target: 'value', x: 2, cost: 2e3 * 900 ** k, desc: 'All ore sells for ×2' }));
[0, 1, 2].forEach(k =>
  UPGRADES.push({ id: 'shovel' + k, name: ['Bigger Shovel', 'Much Bigger Shovel', 'Unreasonable Shovel'][k], icon: '🪏', target: 'tap', x: 3, cost: 500 * 1e4 ** k, desc: 'Your taps dig ×3 harder' }));
UPGRADES.sort((a, b) => a.cost - b.cost);

const LH = Math.log(1.08) / 10, LV = Math.log(1.05) / 10;
const hard = d => Math.exp(LH * d);
const val = d => Math.exp(LV * d);
const rb = s => 1 + 0.1 * s.relics;
const upX = (s, t) => UPGRADES.reduce((x, u) => (s.ups[u.id] && u.target === t ? x * u.x : x), 1);

function crewPow(s, c, ctx) {
  const n = s.crew[c.id] || 0;
  return n ? c.pow * n * stepMult(n) * upX(s, c.id) * upX(s, 'all') * rb(s) * ctx.mult : 0;
}
const power = (s, ctx) => CREW.reduce((a, c) => a + crewPow(s, c, ctx), 0);
const valueMult = s => rb(s) * upX(s, 'value');
const income = (s, ctx) => (power(s, ctx) / hard(s.depth)) * val(s.depth) * valueMult(s);
const tapPow = (s, ctx) => (rb(s) + power(s, ctx) * 0.3) * upX(s, 'tap');
function earn(s, x) { s.cash += x; s.life += x; }

// Exact integration of depth and ore for `pw` power-seconds of digging.
function dig(s, pw, ctx) {
  const d0 = s.depth;
  const d1 = Math.log(Math.exp(LH * d0) + pw * LH) / LH;
  s.depth = d1;
  earn(s, ((Math.exp(LV * d1) - Math.exp(LV * d0)) / LV) * valueMult(s));
  s.runMax = Math.max(s.runMax, d1);
  s.best = Math.max(s.best, d1);
  const c1 = Math.floor(d1 / 50);
  let shown = 0;
  while (s.crate < c1) {
    s.crate++;
    const m = s.crate * 50;
    if (m % PER === 0) {
      const [name, ore] = layerAt(m / PER);
      ctx.emit(8 + 2 * (m / PER), shown++ < 2 ? `⛰️ ${m} m: you hit ${name}. It's full of ${ore}.` : '');
    } else {
      const x = Math.max(income(s, ctx), 1) * 20 + 10;
      earn(s, x);
      ctx.addGems(2);
      ctx.emit(3, shown++ < 2 ? `📦 Buried crate at ${m} m! +${fmt(x)} 💰 +2 💎` : '');
    }
  }
}
const gainOf = (s, pm) => (s.runMax >= 400 ? Math.floor((s.runMax / 400) ** 1.5 * pm) : 0);

const game = {
  id: 'dig',
  name: 'Just Keep Digging',
  dev: 'Shovelware Ltd.',
  genre: 'Digging',
  unlock: 4,
  art: ART.dig,
  theme: 'dig',
  tabs: [['play', 'Hole'], ['up', 'Tools']],
  cur: { icon: '💰', name: 'cash' },
  prestige: {
    noun: 'Collapses', one: 'Collapse', verb: 'Collapse the Tunnel', cur: 'Relics', icon: '🗿',
    blurb: 'Pull the big red lever. The hole caves in, the crew goes home, and you keep whatever weird old things you found down there. Each Relic adds +10% power and ore value. Forever. Probably.',
  },
  drops: ['Someone dropped a crate down the hole', 'FREE STUFF (limited time!!!)', 'The moles found something shiny', 'You have 1 (one) unclaimed crate'],

  init: () => ({ cash: 0, life: 0, depth: 0, runMax: 0, best: 0, crate: 0, crew: {}, ups: {}, relics: 0 }),
  cash: s => s.cash,

  tick(s, dt, ctx) {
    const pw = power(s, ctx) + (ctx.autoTaps ? tapPow(s, ctx) * ctx.autoTaps : 0);
    if (pw > 0) dig(s, pw * dt, ctx);
  },

  grant(s, sec, ctx) { const x = Math.max(income(s, ctx), 1) * sec; earn(s, x); return x; },
  warp(s, sec, ctx) {
    const before = s.cash;
    simulate(game, s, sec, ctx, 200);
    return s.cash - before;
  },

  card(s, ctx) {
    return {
      stat: `⛏️ ${fmt(s.depth)} m`,
      sub: `${layerAt(Math.floor(s.depth / PER))[0]} · 💰 ${fmt(income(s, ctx))}/s`,
      alert: power(s, ctx) ? '' : 'Nobody is digging. Hire a crew!',
    };
  },

  owned: s => s.relics,
  bonus: s => `×${rb(s).toFixed(1)} power & value`,
  gain: (s, pm) => gainOf(s, pm),
  need(s, pm) {
    if (s.runMax < 400) return `Reach 400 m to Collapse (this run: ${fmt(s.runMax)} m)`;
    let d = Math.floor(s.runMax);
    const g = gainOf(s, pm);
    while (gainOf({ runMax: d }, pm) <= g && d < s.runMax + 5000) d += 5;
    return `Next Relic at ${fmt(d)} m (this run: ${fmt(s.runMax)} m)`;
  },
  reset(s, pm) {
    const g = gainOf(s, pm);
    Object.assign(s, { cash: 0, depth: 0, runMax: 0, crate: 0, crew: {}, ups: {}, relics: s.relics + g });
    return g;
  },

  mountPlay(root, s, api) {
    root.innerHTML = `
      <div class="shaft">
        <div class="strip" data-k="strip"></div>
        <div class="drill" data-k="drill"><svg viewBox="0 0 40 52" aria-hidden="true"><rect x="4" y="0" width="32" height="8" rx="3" fill="#2b2b33"/><path d="M2 8 h36 v10 l-18 30 l-18-30z" fill="#ffd23f"/><path d="M8 18 h24 l-12 24z" fill="#c3c8d2"/><path d="M11 23 h18 M14 29 h12 M17 35 h6" stroke="#7d828d" stroke-width="2"/></svg></div>
        <div class="depth"><b data-k="depth"></b><small data-k="layer"></small></div>
      </div>
      <div class="hud slim">
        <span>💰 <b data-k="cash"></b></span><span data-k="speed"></span><span data-k="inc"></span>
        <button class="mode" data-act="mode"></button>
      </div>
      <button class="dig-btn" data-act="dig">DIG</button>
      <p class="quip" data-k="quip"></p>
      <div class="list">${CREW.map(c => `
        <div class="row" data-c="${c.id}">
          <div class="row-icon">${c.icon}<em data-k="n"></em></div>
          <div class="row-mid"><div class="row-name">${c.name}</div><div class="row-sub" data-k="sub"></div></div>
          <button class="buy" data-act="hire"><small data-k="bn"></small><b data-k="bc"></b></button>
        </div>`).join('')}</div>`;
    const K = n => root.querySelector(`[data-k="${n}"]`);
    const el = Object.fromEntries(['strip', 'drill', 'depth', 'layer', 'cash', 'speed', 'inc', 'quip'].map(k => [k, K(k)]));
    const mode = root.querySelector('.mode'), digBtn = root.querySelector('.dig-btn');
    const rows = CREW.map(c => {
      const r = root.querySelector(`[data-c="${c.id}"]`), k = n => r.querySelector(`[data-k="${n}"]`);
      return { c, el: r, n: k('n'), sub: k('sub'), bn: k('bn'), bc: k('bc'), btn: r.querySelector('.buy') };
    });
    let bands = 0, hole = null, quipT = 0;

    function buildStrip(n) {
      bands = n;
      let h = `<div class="sky" style="height:${SKY}px"></div>`;
      for (let i = 0; i < n; i++) {
        const [name, , rock, ore] = layerAt(i);
        h += `<div class="band" style="height:${PER * PX}px;--rock:${rock};--ore:${ore}"><span>${name} · ${i * PER} m</span></div>`;
      }
      el.strip.innerHTML = h + '<div class="hole"></div>';
      hole = el.strip.querySelector('.hole');
    }

    root.onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act, ctx = api.ctx();
      if (act === 'mode') api.cycleMode();
      else if (act === 'dig') {
        const before = s.cash;
        dig(s, tapPow(s, ctx), ctx);
        api.tap(e, '+' + fmt(s.cash - before), '#ffd23f');
        restartAnim(digBtn, 'thump');
        restartAnim(el.drill, 'jolt');
        if (Math.random() < 0.02) {
          const x = game.grant(s, 15, ctx) + 5;
          ctx.emit(2, `💎 Geode! Cracked it open for +${fmt(x)} 💰`);
          api.burst(e, ['#9fd8ff', '#d36bff', '#fff']);
        }
      } else if (act === 'hire') {
        const c = CREW.find(x => x.id === b.closest('[data-c]').dataset.c), had = s.crew[c.id] || 0;
        const n = buyN(api.mode(), c.cost, G, had, s.cash), cost = costOf(c.cost, G, had, n);
        if (s.cash < cost) return;
        s.cash -= cost;
        s.crew[c.id] = had + n;
        const steps = Math.round(Math.log2(stepMult(had + n) / stepMult(had)));
        if (!had) ctx.emit(6, `${c.icon} Hired: ${c.name}. ${c.quip}`);
        if (steps) { ctx.emit(4 * steps, `${c.icon} ${c.name} milestone! Power ×${2 ** steps}`); api.burst(e, ['#ffd23f', '#fff']); }
        api.pop(e, '+' + n);
      }
    };

    return {
      update() {
        const ctx = api.ctx(), m = api.mode(), li = Math.floor(s.depth / PER);
        if (li + 3 > bands) buildStrip(li + 3);
        const shaftH = el.strip.parentElement.clientHeight || 240;
        el.strip.style.transform = `translateY(${shaftH * 0.42 - (SKY + s.depth * PX)}px)`;
        hole.style.height = s.depth * PX + 'px';
        setText(el.depth, fmt(s.depth) + ' m');
        setText(el.layer, `${layerAt(li)[0]} · ${layerAt(li)[1]}`);
        const p = power(s, ctx);
        setText(el.cash, fmt(s.cash));
        const v = p / hard(s.depth);
        setText(el.speed, `⬇️ ${v < 1 ? v.toFixed(v < 0.1 ? 3 : 2) : fmt(v)} m/s`);
        setText(el.inc, `+${fmt(income(s, ctx))}/s`);
        setText(mode, modeLabel(m));
        toggle(el.drill, 'spin', p > 0);
        if ((quipT -= 1) <= 0) { quipT = 60 * 9; setText(el.quip, pick(QUIPS)); }
        const reveal = revealCount(CREW, c => s.crew[c.id]);
        rows.forEach((r, i) => {
          const c = r.c, n = s.crew[c.id] || 0;
          show(r.el, i <= reveal);
          if (i > reveal) return;
          toggle(r.el, 'locked', !n);
          const k = buyN(m, c.cost, G, n, s.cash), cost = costOf(c.cost, G, n, k), nx = nextStep(n);
          setText(r.n, n ? fmt(n) : '');
          setText(r.sub, n ? `${fmt(crewPow(s, c, ctx))} power${nx ? ` · ×2 at ${nx}` : ''}` : c.quip);
          setText(r.bn, n ? `Hire ×${k}` : 'Hire');
          setText(r.bc, '💰 ' + fmt(cost));
          toggle(r.btn, 'off', s.cash < cost);
        });
      },
    };
  },

  mountUp(root, s, api) {
    root.innerHTML = `<div></div>`;
    const ul = upgradeList(root.firstElementChild, {
      title: 'Tools', items: UPGRADES, owned: u => s.ups[u.id], cash: () => s.cash, cur: '💰',
      onBuy: (u, e) => { s.cash -= u.cost; s.ups[u.id] = true; api.ctx().emit(3, `${u.icon} ${u.name}: ${u.desc}`); api.burst(e, ['#ffd23f', '#fff']); },
    });
    return { update: ul.update };
  },
};

export default game;
