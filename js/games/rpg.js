// Ember & Oath: a serious dark-fantasy idle RPG. Party DPS clears stages; bosses every 5.
import { fmt, costOf, stepMult, nextStep, buyN, modeLabel, setText, toggle, fill, show, restartAnim } from '../util.js';
import { upgradeList, revealCount, simulate, pickBuy, buysPer } from './common.js';
import { ART } from '../art.js';

const HEROES = [
  { id: 'squire', name: 'Wren the Squire', icon: '🛡️', cost: 10, dps: 1 },
  { id: 'archer', name: 'Ilse Longbow', icon: '🏹', cost: 120, dps: 6 },
  { id: 'mage', name: 'Corvin, Hedge Mage', icon: '🔮', cost: 1.4e3, dps: 36 },
  { id: 'sword', name: 'Brakka Sellsword', icon: '🪓', cost: 1.8e4, dps: 220 },
  { id: 'cleric', name: 'Sister Maud of Ash', icon: '🕯️', cost: 2.4e5, dps: 1.4e3 },
  { id: 'knight', name: 'Ser Aldric', icon: '⚔️', cost: 3.3e6, dps: 9e3 },
  { id: 'storm', name: 'Yssa Stormcaller', icon: '🌩️', cost: 4.6e7, dps: 6e4 },
  { id: 'dragoon', name: 'Kael the Dragoon', icon: '🐉', cost: 6.5e8, dps: 4e5 },
  { id: 'oath', name: 'The Oathbreaker', icon: '🗡️', cost: 9.5e9, dps: 2.8e6 },
  { id: 'ember', name: 'The Last Ember', icon: '🔥', cost: 1.4e11, dps: 2e7 },
];
const G = 1.075, BLADE = 5, BG = 1.09;

const REGIONS = [
  { name: 'Ashen Fields', mons: [['🐀', 'Cinder Rat'], ['🐺', 'Ashen Wolf'], ['🦅', 'Carrion Hawk']], boss: ['🐗', 'The Scorched Boar'] },
  { name: 'Hollow Crypt', mons: [['💀', 'Restless Bones'], ['🦇', 'Crypt Bat'], ['🕷️', 'Tomb Spider']], boss: ['🧛', 'Lord of the Hollow'] },
  { name: 'Blightwood', mons: [['🍄', 'Sporeling'], ['🐍', 'Thornviper'], ['🐛', 'Rot Grub']], boss: ['🌳', 'The Weeping Elm'] },
  { name: 'Drowned Keep', mons: [['🦀', 'Keep Crab'], ['🐙', 'Moat Horror'], ['🧟', 'Drowned Guard']], boss: ['🦑', 'The Tidewarden'] },
  { name: 'Cinder Peaks', mons: [['🦂', 'Magma Scorpion'], ['🔥', 'Living Flame'], ['🦎', 'Drakeling']], boss: ['🐉', 'Vastrix the Unburnt'] },
  { name: 'The Pale Throne', mons: [['👻', 'Pale Wisp'], ['🗿', 'Oathstone Sentinel'], ['👁️', 'The Watching Eye']], boss: ['👑', 'The Hollow King'] },
];
const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII'];

const UPGRADES = [];
HEROES.forEach(h => ['Sworn Oath', 'Blooded Steel', 'Legend Unbound'].forEach((t, k) =>
  UPGRADES.push({ id: h.id + k, name: `${t}`, icon: h.icon, target: h.id, x: 2, cost: h.cost * 300 * 120 ** k, desc: `${h.name} deals ×2 damage` })));
[0, 1, 2, 3, 4].forEach(k =>
  UPGRADES.push({ id: 'banner' + k, name: `War Banner${ROMAN[k] || ' ' + (k + 1)}`, icon: '🚩', target: 'all', x: 2, cost: 2e4 * 1000 ** k, desc: 'The whole party deals ×2 damage' }));
[0, 1, 2].forEach(k =>
  UPGRADES.push({ id: 'echo' + k, name: `Echoing Blade${ROMAN[k]}`, icon: '✨', target: 'echo', x: 0, cost: 5e3 * 1e4 ** k, desc: 'Your taps also deal +3% of party DPS' }));
UPGRADES.sort((a, b) => a.cost - b.cost);

const isBoss = st => st % 5 === 0;
const hpOf = st => Math.ceil(10 * 1.4 ** (st - 1) + 4 * (st - 1)) * (isBoss(st) ? 6 : 1);
const goldOf = st => hpOf(st) * 0.12;
const eb = s => 1 + 0.1 * s.embers;

function heroDps(s, h, ctx) {
  const n = s.heroes[h.id] || 0;
  if (!n) return 0;
  let x = h.dps * n * stepMult(n) * eb(s) * ctx.mult;
  for (const u of UPGRADES) if (s.ups[u.id] && (u.target === h.id || u.target === 'all')) x *= u.x;
  return x;
}
const dps = (s, ctx) => HEROES.reduce((a, h) => a + heroDps(s, h, ctx), 0);
const echo = s => 0.01 + 0.03 * UPGRADES.filter(u => u.target === 'echo' && s.ups[u.id]).length;
const tapDmg = (s, ctx) => (1 + s.blade * 1.5) * 2 ** Math.floor(s.blade / 25) * eb(s) * ctx.mult + echo(s) * dps(s, ctx);

function spawn(s) {
  s.mon++;
  s.gild = !isBoss(s.stage) && Math.random() < 0.03;
  s.hp = hpOf(s.stage) * (s.gild ? 2 : 1);
  s.bossT = 30;
}
function earn(s, x) { s.gold += x; s.life += x; }
function advance(s) {
  s.stage++;
  s.kills = 0;
  s.runMax = Math.max(s.runMax, s.stage);
  s.best = Math.max(s.best, s.stage);
}
function kill(s, ctx) {
  earn(s, goldOf(s.stage) * (s.gild ? 10 : 1) * eb(s) * ctx.mult);
  if (s.gild) ctx.emit(2, '✨ A Gilded Wraith! ×10 gold');
  if (isBoss(s.stage)) {
    ctx.emit(5 + Math.floor(s.stage / 5), `👑 Boss slain! Stage ${s.stage} cleared`);
    advance(s);
  } else if (!s.fail && ++s.kills >= 10) {
    ctx.emit(1 + Math.floor(s.stage / 10));
    advance(s);
  }
  spawn(s);
}
function damage(s, dmg, ctx, guard = 60) {
  while (dmg > 0 && guard-- > 0) {
    if (dmg >= s.hp) { dmg -= s.hp; kill(s, ctx); }
    else { s.hp -= dmg; dmg = 0; }
  }
}
function monInfo(s) {
  const i = Math.floor((s.stage - 1) / 10), r = REGIONS[i % REGIONS.length];
  const region = r.name + (ROMAN[Math.floor(i / REGIONS.length)] ?? ' +');
  if (isBoss(s.stage)) return { region, icon: r.boss[0], name: r.boss[1], boss: true };
  if (s.gild) return { region, icon: '👻', name: 'Gilded Wraith', gild: true };
  const m = r.mons[(s.mon * 7) % r.mons.length];
  return { region, icon: m[0], name: m[1] };
}
function buyBlade(s, n, ctx) {
  const c = costOf(BLADE, BG, s.blade, n);
  if (s.gold < c) return 0;
  s.gold -= c;
  const before = Math.floor(s.blade / 25);
  s.blade += n;
  if (Math.floor(s.blade / 25) > before) ctx.emit(4, '🗡️ Your blade hums. Tap damage ×2');
  return 1;
}
function buyHero(s, h, n, ctx) {
  const had = s.heroes[h.id] || 0, c = costOf(h.cost, G, had, n);
  if (s.gold < c) return 0;
  s.gold -= c;
  s.heroes[h.id] = had + n;
  const steps = Math.round(Math.log2(stepMult(had + n) / stepMult(had)));
  if (!had) ctx.emit(6, `${h.icon} ${h.name} joins your party`);
  if (steps) ctx.emit(4 * steps, `${h.icon} ${h.name} grows stronger. Damage ×${2 ** steps}`);
  return steps ? 2 : 1;
}
function buyUp(s, u, ctx) {
  if (s.gold < u.cost || s.ups[u.id]) return false;
  s.gold -= u.cost;
  s.ups[u.id] = true;
  ctx.emit(3, `${u.icon} ${u.name}: ${u.desc}`);
  return true;
}
const gainOf = (s, pm) => (s.runMax > 30 ? Math.floor(((s.runMax - 20) / 10) ** 1.5 * pm) : 0);

const game = {
  id: 'rpg',
  name: 'Ember & Oath',
  dev: 'Nightjar Interactive',
  genre: 'Idle RPG',
  unlock: 2,
  art: ART.rpg,
  theme: 'rpg',
  tabs: [['play', 'Battle'], ['up', 'Armory']],
  cur: { icon: '🪙', name: 'gold' },
  prestige: {
    noun: 'Ascensions', one: 'Ascension', verb: 'Ascend', cur: 'Embers', icon: '🔥',
    blurb: 'Burn it all down and walk back out of the fire. Your party and gold are lost; the Embers remain. Each Ember grants +10% damage and gold, forever.',
  },
  drops: ['A courier from the Keep brings a chest', 'Your daily tribute has arrived', 'The Oracle foresees loot', 'A fallen knight left you his satchel'],

  init: () => ({ gold: 0, life: 0, stage: 1, kills: 0, hp: 10, mon: 0, gild: false, bossT: 30, fail: 0, runMax: 1, best: 1, blade: 1, heroes: { squire: 1 }, ups: {}, embers: 0 }),
  cash: s => s.gold,

  tick(s, dt, ctx) {
    damage(s, (dps(s, ctx) + (ctx.autoTaps ? tapDmg(s, ctx) * ctx.autoTaps : 0)) * dt, ctx);
    if (isBoss(s.stage)) {
      s.bossT -= dt;
      if (s.bossT <= 0) {
        s.stage--;
        s.kills = 0;
        s.fail = 30;
        spawn(s);
        ctx.emit(0, '💀 The boss overwhelmed your party. Regrouping…');
      }
    } else if (s.fail > 0) {
      s.fail -= dt;
      if (s.fail <= 0) { s.fail = 0; s.stage++; spawn(s); }
    }
  },

  autopilot(s, ctx, a) {
    if (s.fail > 0 && a.q > 0.5) s.fail = Math.min(s.fail, 10);
    for (let k = buysPer(a.q); k > 0; k--) {
      const u = a.ups && UPGRADES.find(x => !s.ups[x.id] && s.gold >= x.cost);
      if (u) { buyUp(s, u, ctx); continue; }
      const reveal = revealCount(HEROES, x => s.heroes[x.id]);
      const opts = HEROES.slice(0, reveal + 1).map(x => {
        const n = s.heroes[x.id] || 0;
        return { x, cost: costOf(x.cost, G, n, 1), gain: x.dps * ((n + 1) * stepMult(n + 1) - n * stepMult(n)) };
      });
      const bc = costOf(BLADE, BG, s.blade, 1);
      if (bc <= s.gold && s.blade < s.stage * 2 && bc * 4 < Math.min(...opts.map(o => o.cost))) { buyBlade(s, 1, ctx); continue; }
      const o = pickBuy(opts.filter(o => o.cost <= s.gold), a.q);
      if (!o) break;
      buyHero(s, o.x, 1, ctx);
    }
  },
  score: s => s.stage,
  scoreLabel: 'stage',

  grant(s, sec, ctx) {
    const kps = Math.min(Math.max(dps(s, ctx) / hpOf(s.stage), 0.5), 20);
    const x = kps * goldOf(s.stage) * eb(s) * ctx.mult * sec;
    earn(s, x);
    return x;
  },
  warp(s, sec, ctx) {
    const before = s.gold;
    simulate(game, s, sec, ctx, Math.min(2000, Math.ceil(sec)));
    return s.gold - before;
  },

  card(s, ctx) {
    return {
      stat: `⚔️ Stage ${s.stage}`,
      sub: `${fmt(dps(s, ctx))} DPS · best stage ${s.best}`,
      alert: s.fail > 0 ? 'Stuck at a boss: strengthen the party' : '',
    };
  },

  owned: s => s.embers,
  bonus: s => `×${eb(s).toFixed(1)} damage & gold`,
  gain: (s, pm) => gainOf(s, pm),
  need(s, pm) {
    if (s.runMax <= 30) return `Reach stage 31 to Ascend (this run: stage ${s.runMax})`;
    let st = s.runMax;
    const g = gainOf(s, pm);
    while (gainOf({ runMax: st }, pm) <= g && st < s.runMax + 500) st++;
    return `Next Ember at stage ${st} (this run: stage ${s.runMax})`;
  },
  reset(s, pm) {
    const g = gainOf(s, pm);
    Object.assign(s, { gold: 0, stage: 1, kills: 0, mon: 0, gild: false, bossT: 30, fail: 0, runMax: 1, blade: 1, heroes: { squire: 1 }, ups: {}, embers: s.embers + g });
    s.hp = hpOf(1);
    return g;
  },

  mountPlay(root, s, api) {
    root.innerHTML = `
      <div class="arena" data-act="hit">
        <div class="ar-top"><span data-k="region"></span><b data-k="stage"></b></div>
        <div class="ar-sub" data-k="kills"></div>
        <div class="ar-mon" data-k="mon"></div>
        <div class="ar-name" data-k="name"></div>
        <div class="bar hp"><i data-k="hp"></i><span data-k="hpt"></span></div>
        <div class="bar timer" data-k="tbar"><i data-k="tfill"></i><span data-k="tt"></span></div>
        <div class="ar-fail" data-k="fail" hidden>Regrouping… <b data-k="failt"></b> <button class="mini" data-act="retry">Fight now</button></div>
        <div class="ar-hint">Tap to strike</div>
      </div>
      <div class="hud slim">
        <span>⚔️ <b data-k="dps"></b>/s</span><span>👆 <b data-k="tap"></b></span><span>🪙 <b data-k="gold"></b></span>
        <button class="mode" data-act="mode"></button>
      </div>
      <div class="list">
        <div class="row" data-h="blade"><div class="row-icon">🗡️</div><div class="row-mid"><div class="row-name">Your Blade <em data-k="lv"></em></div><div class="row-sub" data-k="sub"></div></div><button class="buy" data-act="lvl"><small data-k="bn"></small><b data-k="bc"></b></button></div>
        ${HEROES.map(h => `<div class="row" data-h="${h.id}"><div class="row-icon">${h.icon}</div><div class="row-mid"><div class="row-name">${h.name} <em data-k="lv"></em></div><div class="row-sub" data-k="sub"></div></div><button class="buy" data-act="lvl"><small data-k="bn"></small><b data-k="bc"></b></button></div>`).join('')}
      </div>`;
    const K = n => root.querySelector(`[data-k="${n}"]`);
    const el = Object.fromEntries(['region', 'stage', 'kills', 'mon', 'name', 'hp', 'hpt', 'tbar', 'tfill', 'tt', 'fail', 'failt', 'dps', 'tap', 'gold'].map(k => [k, K(k)]));
    const mode = root.querySelector('.mode');
    const rows = [{ id: 'blade' }, ...HEROES].map(h => {
      const r = root.querySelector(`[data-h="${h.id}"]`), k = n => r.querySelector(`[data-k="${n}"]`);
      return { h, el: r, lv: k('lv'), sub: k('sub'), bn: k('bn'), bc: k('bc'), btn: r.querySelector('.buy') };
    });
    let lastMon = -1;

    root.onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act, ctx = api.ctx();
      if (act === 'mode') api.cycleMode();
      else if (act === 'retry') { if (s.fail > 0) { s.fail = 0; s.stage++; spawn(s); } }
      else if (act === 'hit') {
        const d = tapDmg(s, ctx);
        damage(s, d, ctx, 5);
        api.tap(e, fmt(d), '#ffd27a');
        restartAnim(el.mon, 'hit');
      } else if (act === 'lvl') {
        const id = b.closest('[data-h]').dataset.h;
        if (id === 'blade') {
          const n = buyN(api.mode(), BLADE, BG, s.blade, s.gold);
          if (buyBlade(s, n, ctx)) api.pop(e, '+' + n);
          return;
        }
        const h = HEROES.find(x => x.id === id), n = buyN(api.mode(), h.cost, G, s.heroes[id] || 0, s.gold), r = buyHero(s, h, n, ctx);
        if (r === 2) api.burst(e, ['#ffb454', '#ff5d73', '#fff']);
        if (r) api.pop(e, '+' + n);
      }
    };

    return {
      update() {
        const ctx = api.ctx(), m = api.mode(), info = monInfo(s), boss = isBoss(s.stage);
        if (s.mon !== lastMon) {
          lastMon = s.mon;
          setText(el.mon, info.icon);
          setText(el.name, info.name);
          toggle(el.mon, 'boss', !!info.boss);
          toggle(el.mon, 'gild', !!info.gild);
          restartAnim(el.mon, 'spawn');
        }
        setText(el.region, info.region);
        setText(el.stage, `Stage ${s.stage}`);
        setText(el.kills, boss ? 'BOSS' : s.fail > 0 ? 'Farming for gold' : `${s.kills}/10 slain`);
        const max = hpOf(s.stage) * (s.gild ? 2 : 1);
        fill(el.hp, s.hp / max);
        setText(el.hpt, `${fmt(Math.ceil(s.hp))} / ${fmt(max)}`);
        show(el.tbar, boss);
        if (boss) { fill(el.tfill, s.bossT / 30); setText(el.tt, `${Math.ceil(s.bossT)}s`); }
        show(el.fail, s.fail > 0);
        if (s.fail > 0) setText(el.failt, Math.ceil(s.fail) + 's');
        setText(el.dps, fmt(dps(s, ctx)));
        setText(el.tap, fmt(tapDmg(s, ctx)));
        setText(el.gold, fmt(s.gold));
        setText(mode, modeLabel(m));
        const reveal = revealCount(HEROES, h => s.heroes[h.id]);
        rows.forEach((r, i) => {
          if (r.h.id === 'blade') {
            const n = buyN(m, BLADE, BG, s.blade, s.gold), c = costOf(BLADE, BG, s.blade, n);
            setText(r.lv, `Lv ${s.blade}`);
            setText(r.sub, `${fmt(tapDmg(s, ctx))} per tap · ×2 every 25 levels`);
            setText(r.bn, `Lv +${n}`);
            setText(r.bc, '🪙 ' + fmt(c));
            toggle(r.btn, 'off', s.gold < c);
            return;
          }
          const h = r.h, n = s.heroes[h.id] || 0;
          show(r.el, i - 1 <= reveal);
          toggle(r.el, 'locked', !n);
          const k = buyN(m, h.cost, G, n, s.gold), c = costOf(h.cost, G, n, k), nx = nextStep(n);
          setText(r.lv, n ? `Lv ${n}` : '');
          setText(r.sub, n ? `${fmt(heroDps(s, h, ctx))} DPS${nx ? ` · ×2 at Lv ${nx}` : ''}` : 'Not yet sworn to your cause');
          setText(r.bn, n ? `Lv +${k}` : 'Recruit');
          setText(r.bc, '🪙 ' + fmt(c));
          toggle(r.btn, 'off', s.gold < c);
        });
      },
    };
  },

  mountUp(root, s, api) {
    root.innerHTML = `<div data-k="ups"></div>`;
    const ul = upgradeList(root.firstElementChild, {
      title: 'Armory', items: UPGRADES, owned: u => s.ups[u.id], cash: () => s.gold, cur: '🪙',
      onBuy: (u, e) => { if (buyUp(s, u, api.ctx())) api.burst(e, ['#ffb454', '#fff']); },
    });
    return { update: ul.update };
  },
};

export default game;
