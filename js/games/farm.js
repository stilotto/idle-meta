// Sunnyside Acres: a cozy farming tycoon. Fields run on cycles; farmhands automate them.
import { fmt, costOf, stepMult, nextStep, buyN, modeLabel, setText, toggle, fill, show, rand } from '../util.js';
import { upgradeList, revealCount, pickBuy, buysPer } from './common.js';
import { ART } from '../art.js';

const FIELDS = [
  { id: 'carrot', name: 'Carrot Patch', icon: '🥕', cost: 4, g: 1.07, time: 1, pay: 1, hand: 250 },
  { id: 'coop', name: 'Chicken Coop', icon: '🐔', cost: 60, g: 1.15, time: 2, pay: 40, hand: 5e3 },
  { id: 'corn', name: 'Cornfield', icon: '🌽', cost: 720, g: 1.14, time: 4, pay: 360, hand: 4e4 },
  { id: 'apple', name: 'Apple Orchard', icon: '🍎', cost: 8.6e3, g: 1.13, time: 8, pay: 2.9e3, hand: 4e5 },
  { id: 'dairy', name: 'Dairy Barn', icon: '🐄', cost: 1.04e5, g: 1.12, time: 15, pay: 3.2e4, hand: 8e6 },
  { id: 'pumpkin', name: 'Pumpkin Patch', icon: '🎃', cost: 1.25e6, g: 1.11, time: 30, pay: 1.9e5, hand: 1e8 },
  { id: 'grape', name: 'Hillside Vineyard', icon: '🍇', cost: 1.5e7, g: 1.1, time: 60, pay: 1.2e6, hand: 1.5e9 },
  { id: 'bee', name: 'Bee Meadow', icon: '🐝', cost: 1.8e8, g: 1.09, time: 120, pay: 7e6, hand: 2e10 },
  { id: 'sun', name: 'Sunflower Glasshouse', icon: '🌻', cost: 2.2e9, g: 1.08, time: 240, pay: 4.2e7, hand: 2.5e11 },
  { id: 'estate', name: 'Sunnyside Estate', icon: '🏡', cost: 2.6e10, g: 1.07, time: 480, pay: 3.9e8, hand: 3e12 },
];

const UPGRADES = [];
FIELDS.forEach(f => ['Rich Compost', 'Drip Irrigation', 'Heirloom Stock'].forEach((t, k) =>
  UPGRADES.push({ id: f.id + k, name: t, icon: f.icon, target: f.id, x: 3, cost: f.cost * 1500 * 60 ** k, desc: `${f.name} profit ×3` })));
[0, 1, 2, 3, 4].forEach(k =>
  UPGRADES.push({ id: 'alm' + k, name: `Farmers' Almanac, Vol. ${k + 1}`, icon: '📖', target: 'all', x: 3, cost: 5e6 * 800 ** k, desc: 'Every field profit ×3' }));
UPGRADES.sort((a, b) => a.cost - b.cost);

function upMult(s, id) {
  let x = 1;
  for (const u of UPGRADES) if (s.ups[u.id] && (u.target === id || u.target === 'all')) x *= u.x;
  return x;
}
function profit(s, f, ctx) {
  const n = s.owned[f.id] || 0;
  return f.pay * n * stepMult(n) * upMult(s, f.id) * (1 + 0.1 * s.ribbons) * ctx.mult * (s.frenzy > ctx.now ? 5 : 1);
}
function rateOf(s, ctx, managedOnly) {
  let r = 0;
  for (const f of FIELDS) {
    if (!s.owned[f.id] || (managedOnly && !s.hands[f.id])) continue;
    r += profit(s, f, ctx) / f.time;
  }
  return r;
}
function earn(s, x) { s.coins += x; s.life += x; }
function buyField(s, f, n, ctx) {
  const had = s.owned[f.id] || 0, c = costOf(f.cost, f.g, had, n);
  if (s.coins < c) return 0;
  s.coins -= c;
  s.owned[f.id] = had + n;
  const steps = Math.round(Math.log2(stepMult(had + n) / stepMult(had)));
  if (!had) ctx.emit(6, `${f.icon} New field: ${f.name}!`);
  if (steps) ctx.emit(4 * steps, `${f.icon} ${f.name} milestone! Profit ×${2 ** steps}`);
  return steps ? 2 : 1;
}
function hire(s, f, ctx) {
  if (s.coins < f.hand || s.hands[f.id]) return false;
  s.coins -= f.hand;
  s.hands[f.id] = true;
  ctx.emit(8, `👒 A farmhand now runs the ${f.name}`);
  return true;
}
function buyUp(s, u, ctx) {
  if (s.coins < u.cost || s.ups[u.id]) return false;
  s.coins -= u.cost;
  s.ups[u.id] = true;
  ctx.emit(3, `${u.icon} ${u.name}: ${u.desc}`);
  return true;
}
const potential = (s, pm) => Math.floor(Math.sqrt(s.life / 3e9) * pm);

const game = {
  id: 'farm',
  name: 'Sunnyside Acres',
  dev: 'Barnlight Studio',
  genre: 'Farming tycoon',
  unlock: 1,
  art: ART.farm,
  theme: 'farm',
  tabs: [['play', 'Fields'], ['up', 'Barn']],
  cur: { icon: '🪙', name: 'coins' },
  prestige: {
    noun: 'Festivals', one: 'Festival', verb: 'Hold a Harvest Festival', cur: 'Ribbons', icon: '🎀',
    blurb: 'Invite the whole valley. Everything gets sold, the fields go back to seed, and the judges hand out Ribbons. Each Ribbon makes every field 10% more profitable, forever.',
  },
  drops: ['Your hens left you a present 🥚', 'Free Harvest Crate is ready!', 'Farmer Jo sent you a gift basket', 'Morning dew bonus! Tap to collect'],

  init: () => ({ coins: 0, life: 0, owned: { carrot: 1 }, hands: {}, prog: {}, running: {}, ups: {}, ribbons: 0, frenzy: 0, cloverT: 50 }),
  cash: s => s.coins,

  tick(s, dt, ctx) {
    const auto = ctx.autoTaps > 0;
    for (const f of FIELDS) {
      if (!s.owned[f.id]) continue;
      const managed = !!s.hands[f.id];
      if (!managed && !s.running[f.id]) {
        if (!auto) continue;
        s.running[f.id] = true;
      }
      let p = (s.prog[f.id] || 0) + dt / f.time;
      if (p >= 1) {
        const c = managed ? Math.floor(p) : 1;
        earn(s, profit(s, f, ctx) * c);
        if (managed) p -= c;
        else { p = 0; s.running[f.id] = false; }
      }
      s.prog[f.id] = p;
    }
    if (ctx.open) s.cloverT -= dt;
  },

  autopilot(s, ctx, a) {
    for (const f of FIELDS) if (s.owned[f.id] && !s.hands[f.id]) s.running[f.id] = true;
    for (let k = buysPer(a.q); k > 0; k--) {
      const f = FIELDS.find(x => s.owned[x.id] && !s.hands[x.id] && s.coins >= x.hand);
      if (f) { hire(s, f, ctx); continue; }
      const u = a.ups && UPGRADES.find(x => !s.ups[x.id] && s.coins >= x.cost);
      if (u) { buyUp(s, u, ctx); continue; }
      const reveal = revealCount(FIELDS, x => s.owned[x.id]);
      const opts = FIELDS.slice(0, reveal + 1).map(x => {
        const n = s.owned[x.id] || 0;
        return { x, cost: costOf(x.cost, x.g, n, 1), gain: (x.pay / x.time) * upMult(s, x.id) * ((n + 1) * stepMult(n + 1) - n * stepMult(n)) };
      }).filter(o => o.cost <= s.coins);
      const o = pickBuy(opts, a.q);
      if (!o) break;
      buyField(s, o.x, 1, ctx);
    }
  },
  score: s => Math.log10(1 + rateOf(s, { mult: 1, now: 0 }, false)),
  scoreLabel: 'income',

  grant(s, sec, ctx) { const x = Math.max(rateOf(s, ctx, false), 1) * sec; earn(s, x); return x; },
  warp(s, sec, ctx) { return game.grant(s, sec, ctx); },

  card(s, ctx) {
    const idle = FIELDS.filter(f => s.owned[f.id] && !s.hands[f.id]).length;
    return {
      stat: `🪙 ${fmt(rateOf(s, ctx, true))}/s`,
      sub: `${fmt(s.coins)} coins · ${FIELDS.filter(f => s.owned[f.id]).length} fields`,
      alert: idle && !ctx.autoTaps && !ctx.auto ? `${idle} field${idle > 1 ? 's' : ''} need${idle > 1 ? '' : 's'} a farmhand` : '',
    };
  },

  owned: s => s.ribbons,
  bonus: s => `×${(1 + 0.1 * s.ribbons).toFixed(1)} profit`,
  gain: (s, pm) => Math.max(0, potential(s, pm) - s.ribbons),
  need(s, pm) {
    const next = ((s.ribbons + game.gain(s, pm) + 1) / pm) ** 2 * 3e9;
    return `Next Ribbon at ${fmt(next)} lifetime coins (you have ${fmt(s.life)})`;
  },
  reset(s, pm) {
    const g = game.gain(s, pm);
    Object.assign(s, { coins: 0, owned: { carrot: 1 }, hands: {}, prog: {}, running: {}, ups: {}, frenzy: 0, ribbons: s.ribbons + g });
    return g;
  },

  mountPlay(root, s, api) {
    root.innerHTML = `
      <div class="hud">
        <div><div class="hud-big" data-k="coins"></div><div class="hud-sub" data-k="rate"></div></div>
        <button class="mode" data-act="mode"></button>
      </div>
      <div class="banner" data-k="frenzy" hidden>🌈 Bumper crop! ×5 profit · <b data-k="ft"></b></div>
      <div class="list">${FIELDS.map(f => `
        <div class="row field" data-f="${f.id}">
          <button class="row-icon big" data-act="run" aria-label="Harvest ${f.name}"><span>${f.icon}</span><em data-k="n"></em><i class="hand" data-k="hand">👒</i></button>
          <div class="row-mid">
            <div class="row-name">${f.name}</div>
            <div class="bar"><i data-k="bar"></i><span data-k="pay"></span></div>
            <div class="row-sub" data-k="ms"></div>
          </div>
          <button class="buy" data-act="buy"><small data-k="bn"></small><b data-k="bc"></b></button>
        </div>`).join('')}</div>
      <p class="hint">Tap a crop to harvest it. Hire farmhands in the Barn so crops grow while you're away.</p>
      <button class="clover" data-act="clover" hidden aria-label="Lucky clover">🍀</button>`;
    const K = n => root.querySelector(`[data-k="${n}"]`);
    const coins = K('coins'), rate = K('rate'), fr = K('frenzy'), ft = K('ft');
    const mode = root.querySelector('.mode'), clover = root.querySelector('.clover');
    const rows = FIELDS.map(f => {
      const el = root.querySelector(`[data-f="${f.id}"]`), k = n => el.querySelector(`[data-k="${n}"]`);
      return { f, el, n: k('n'), hand: k('hand'), bar: k('bar'), pay: k('pay'), ms: k('ms'), bn: k('bn'), bc: k('bc'), btn: el.querySelector('.buy'), icon: el.querySelector('.row-icon') };
    });
    let cloverUntil = 0;

    root.onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act, row = b.closest('[data-f]'), f = row && FIELDS.find(x => x.id === row.dataset.f);
      const ctx = api.ctx();
      if (act === 'mode') api.cycleMode();
      else if (act === 'run') {
        if (s.owned[f.id] && !s.running[f.id] && !s.hands[f.id]) { s.running[f.id] = true; api.tap(e, f.icon); }
      } else if (act === 'buy') {
        const n = buyN(api.mode(), f.cost, f.g, s.owned[f.id] || 0, s.coins), r = buyField(s, f, n, ctx);
        if (r === 2) api.burst(e);
        if (r) api.pop(e, '+' + n);
      } else if (act === 'clover') {
        clover.hidden = true;
        s.cloverT = rand(45, 90);
        if (Math.random() < 0.35) { s.frenzy = Date.now() + 20000; ctx.emit(2, '🌈 Bumper crop! ×5 profit for 20 seconds'); }
        else { const x = game.grant(s, 90, ctx); ctx.emit(2, `🍀 Lucky clover! +${fmt(x)} coins`); }
        api.burst(e, ['#7dff9b', '#ffd84d', '#fff']);
      }
    };

    return {
      update() {
        const ctx = api.ctx(), now = ctx.now, m = api.mode();
        setText(coins, '🪙 ' + fmt(s.coins));
        setText(rate, `${fmt(rateOf(s, ctx, true))}/s idle · ${fmt(rateOf(s, ctx, false))}/s if you keep tapping`);
        setText(mode, modeLabel(m));
        show(fr, s.frenzy > now);
        if (s.frenzy > now) setText(ft, Math.ceil((s.frenzy - now) / 1000) + 's');
        const reveal = revealCount(FIELDS, f => s.owned[f.id]);
        rows.forEach((r, i) => {
          const f = r.f, n = s.owned[f.id] || 0;
          show(r.el, i <= reveal);
          if (i > reveal) return;
          toggle(r.el, 'locked', !n);
          setText(r.n, n ? fmt(n) : '');
          show(r.hand, !!s.hands[f.id]);
          toggle(r.icon, 'idle', n && !s.hands[f.id] && !s.running[f.id]);
          fill(r.bar, s.hands[f.id] || s.running[f.id] ? s.prog[f.id] : 0);
          setText(r.pay, n ? `🪙 ${fmt(profit(s, f, ctx))} · ${f.time}s` : `Earns ${fmt(f.pay)} every ${f.time}s`);
          const nx = nextStep(n);
          setText(r.ms, n ? (nx ? `${n}/${nx} → profit ×2` : 'Every milestone reached') : '');
          const k = buyN(m, f.cost, f.g, n, s.coins), c = costOf(f.cost, f.g, n, k);
          setText(r.bn, n ? `Buy ×${k}` : 'Plant');
          setText(r.bc, '🪙 ' + fmt(c));
          toggle(r.btn, 'off', s.coins < c);
        });
        if (clover.hidden && s.cloverT <= 0) {
          clover.hidden = false;
          clover.style.left = rand(12, 78) + '%';
          clover.style.top = rand(30, 70) + '%';
          cloverUntil = now + 8000;
        }
        if (!clover.hidden && now > cloverUntil) { clover.hidden = true; s.cloverT = rand(45, 90); }
      },
    };
  },

  mountUp(root, s, api) {
    root.innerHTML = `<div class="sec-h">Farmhands <small>they keep fields growing while you're away</small></div><div class="list" data-k="hands"></div><div data-k="ups"></div>`;
    const handsEl = root.querySelector('[data-k="hands"]');
    let hrows = [], seen = -1;
    const buildHands = () => {
      const list = FIELDS.filter(f => s.owned[f.id] && !s.hands[f.id]);
      seen = FIELDS.filter(f => s.owned[f.id]).length;
      handsEl.innerHTML = list.length ? list.map(f => `
        <div class="row">
          <div class="row-icon">${f.icon}</div>
          <div class="row-mid"><div class="row-name">Hire a hand: ${f.name}</div><div class="row-sub">Harvests automatically, even offline.</div></div>
          <button class="buy" data-h="${f.id}"><b>🪙 ${fmt(f.hand)}</b></button>
        </div>`).join('') : `<p class="empty">Every field you own has a farmhand. They say hi. 👋</p>`;
      hrows = list.map(f => ({ f, btn: handsEl.querySelector(`[data-h="${f.id}"]`) }));
    };
    handsEl.onclick = e => {
      const b = e.target.closest('[data-h]');
      if (!b) return;
      const f = FIELDS.find(x => x.id === b.dataset.h);
      if (!hire(s, f, api.ctx())) return;
      api.burst(e);
      buildHands();
    };
    buildHands();
    const ul = upgradeList(root.querySelector('[data-k="ups"]'), {
      items: UPGRADES, owned: u => s.ups[u.id], cash: () => s.coins, cur: '🪙',
      onBuy: (u, e) => { if (buyUp(s, u, api.ctx())) api.burst(e); },
    });
    return {
      update() {
        if (FIELDS.filter(f => s.owned[f.id]).length !== seen) buildHands();
        for (const r of hrows) toggle(r.btn, 'off', s.coins < r.f.hand);
        ul.update();
      },
    };
  },
};

export default game;
