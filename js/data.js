// Meta-game rules: research, gear, trophies, and the formulas that tie games to the player.
import { GAMES } from './games/index.js';

export const has = (st, id) => !!st.meta.research[id];
export const installed = st => GAMES.filter(g => st.games[g.id]?.installed);

export const BRANCHES = [
  { name: 'Focus', color: '#4fd1ff' },
  { name: 'Hustle', color: '#3ddc84' },
  { name: 'Idle', color: '#c38bff' },
  { name: 'Luck', color: '#ffcc4d' },
  { name: 'Auto', color: '#ff8a5c' },
];

export const RESEARCH = [
  { id: 'f1', br: 0, t: 0, icon: '🧘', name: 'Deep Breaths', desc: '+20 max Focus.', cost: 1 },
  { id: 'f2', br: 0, t: 1, req: ['f1'], icon: '🔀', name: 'Multitasking', desc: 'Juggling penalty drops from 12% to 7% per extra game.', cost: 2 },
  { id: 'f3', br: 0, t: 2, req: ['f2'], icon: '🌊', name: 'Flow State', desc: 'Focus hits harder: the speed curve steepens (0.8 → 0.9).', cost: 3 },
  { id: 'f4', br: 0, t: 3, req: ['f3'], icon: '🖥️', name: 'Second Monitor', desc: '+40 max Focus.', cost: 5 },
  { id: 'f5', br: 0, t: 4, req: ['f4'], icon: '🎯', name: 'Hyperfocus', desc: 'The game with the most Focus gets ×1.5 more from it.', cost: 8 },
  { id: 'h1', br: 1, t: 0, icon: '🙋', name: 'Ask for a Raise', desc: 'Paychecks +50%.', cost: 1 },
  { id: 'h2', br: 1, t: 1, req: ['h1'], icon: '✂️', name: 'Coupon Clipper', desc: '+25% gems for every dollar spent.', cost: 2 },
  { id: 'h3', br: 1, t: 2, req: ['h2'], icon: '💼', name: 'Side Hustle', desc: 'Payday every 90s instead of 120s.', cost: 3 },
  { id: 'h4', br: 1, t: 3, req: ['h3'], icon: '🐳', name: 'Whale Watching', desc: 'Gem shop prices −25% in every game.', cost: 5 },
  { id: 'h5', br: 1, t: 4, req: ['h4'], icon: '📈', name: 'Promotion', desc: 'Paychecks ×2.', cost: 8 },
  { id: 'i1', br: 2, t: 0, icon: '🔔', name: 'Notifications On', desc: '+2h max offline time.', cost: 1 },
  { id: 'i2', br: 2, t: 1, req: ['i1'], icon: '☁️', name: 'Cloud Save', desc: 'Offline efficiency +25%.', cost: 2 },
  { id: 'i3', br: 2, t: 2, req: ['i2'], icon: '🤖', name: 'Auto-Clicker', desc: 'Every game gets 2 free taps per second, even offline.', cost: 3 },
  { id: 'i4', br: 2, t: 3, req: ['i3'], icon: '😴', name: 'Sleep Schedule', desc: '+6h max offline time.', cost: 5 },
  { id: 'i5', br: 2, t: 4, req: ['i4'], icon: '🔄', name: 'Background Refresh', desc: 'Offline efficiency +25%.', cost: 8 },
  { id: 'l1', br: 3, t: 0, icon: '📣', name: 'Push Alerts', desc: 'Loot drops arrive 30% more often.', cost: 1 },
  { id: 'l2', br: 3, t: 1, req: ['l1'], icon: '🎲', name: 'Lucky Streak', desc: 'Better odds of Rare, Epic and Legendary drops.', cost: 2 },
  { id: 'l3', br: 3, t: 2, req: ['l2'], icon: '⏱️', name: 'Speedrunner', desc: 'Every prestige pays +25% more.', cost: 3 },
  { id: 'l4', br: 3, t: 3, req: ['l3'], icon: '📚', name: 'Completionist', desc: '+50% XP from everything.', cost: 5 },
  { id: 'l5', br: 3, t: 4, req: ['l4'], icon: '✨', name: 'Golden Touch', desc: 'Legendary odds ×2 and every loot reward ×2.', cost: 8 },
  { id: 'a1', br: 4, t: 0, icon: '🧠', name: 'Smart Buying', desc: 'Autopilots play smarter: +25% skill.', cost: 1 },
  { id: 'a2', br: 4, t: 1, req: ['a1'], icon: '🛒', name: 'Upgrade Hunter', desc: 'Autopilots also buy one-time upgrades.', cost: 2 },
  { id: 'a3', br: 4, t: 2, req: ['a2'], icon: '📜', name: 'Scripted Prestige', desc: 'Unlocks auto-prestige on each game card.', cost: 3 },
  { id: 'a4', br: 4, t: 3, req: ['a3'], icon: '⏺️', name: 'Macro Recorder', desc: 'Autopilots act twice as often.', cost: 5 },
  { id: 'a5', br: 4, t: 4, req: ['a4'], icon: '🦾', name: 'Bot Farm', desc: 'Autopilots always play at 100% skill.', cost: 8 },
  { id: 'cap', br: 2, t: 5, req: ['f5', 'h5', 'i5', 'l5', 'a5'], icon: '🌳', name: 'Touch Grass', desc: 'Perspective, at last. Every game ×2, forever.', cost: 20 },
];
export const canResearch = (st, r) => !has(st, r.id) && (r.req || []).every(q => has(st, q));

export const GEAR = [
  { id: 'chair', icon: '🪑', name: 'Gaming Chair', desc: '+10 max Focus', base: 30, g: 1.6, max: 20 },
  { id: 'drinks', icon: '🥤', name: 'Energy Drinks', desc: '+10% speed in every game', base: 40, g: 1.55, max: 40 },
  { id: 'phone', icon: '📱', name: 'Newer Phone', desc: '+1h max offline time', base: 45, g: 1.7, max: 12 },
  { id: 'charger', icon: '🔌', name: 'Fast Charger', desc: '+5% offline efficiency', base: 50, g: 1.8, max: 6 },
  { id: 'charm', icon: '🧿', name: 'Lucky Charm', desc: '+10% loot drop rate', base: 60, g: 1.8, max: 10 },
];
export const gearCost = (st, it) => Math.ceil(it.base * it.g ** (st.meta.gear[it.id] || 0));

// ---- Focus: the attention budget ----
export const dayOf = st => { const d = st.meta.day; return { work: d.work, game: d.game, sleep: 24 - d.work - d.game }; };
export const focusCap = st => (dayOf(st).game / 8) * (100 + (has(st, 'f1') ? 20 : 0) + (has(st, 'f4') ? 40 : 0) + 10 * (st.meta.gear.chair || 0));
export const switchPenalty = st => (has(st, 'f2') ? 0.07 : 0.12);
export const effFocus = st => focusCap(st) * Math.max(0.4, 1 - switchPenalty(st) * Math.max(0, installed(st).length - 1));
export const focusPts = (st, id) => (effFocus(st) * (st.meta.alloc[id] || 0)) / 100;
export const allocTotal = st => installed(st).reduce((a, g) => a + (st.meta.alloc[g.id] || 0), 0);
function topFocus(st) {
  let best = null, v = 0;
  for (const g of installed(st)) { const a = st.meta.alloc[g.id] || 0; if (a > v) { v = a; best = g.id; } }
  return best;
}
export function focusMult(st, id) {
  let x = (focusPts(st, id) / 20) ** (has(st, 'f3') ? 0.9 : 0.8);
  if (has(st, 'f5') && topFocus(st) === id) x *= 1.5;
  return 1 + x;
}

export function multParts(st, id, now, open) {
  const m = st.meta, g = st.games[id], parts = [['⚡ Focus', focusMult(st, id)]];
  if (m.gear.drinks) parts.push(['🥤 Energy drinks', 1 + 0.1 * m.gear.drinks]);
  if (g.starter) parts.push(['🎒 Starter pack', 2]);
  if (g.vip) parts.push(['👑 Premium pass', 3]);
  if (g.boostUntil > now) parts.push(['🚀 Boost', 2]);
  if (m.relics) parts.push(['🏺 Lucky relics', 1 + 0.05 * m.relics]);
  const a = Object.keys(m.ach).length;
  if (a) parts.push(['🏆 Trophies', 1 + 0.02 * a]);
  if (has(st, 'cap')) parts.push(['🌳 Touch grass', 2]);
  const sm = sanityMult(st);
  if (sm !== 1) parts.push([sm > 1 ? '😌 Well rested' : '😵 Burnt out', sm]);
  if (eventOn(st, 'focus', id) && (m.alloc[id] || 0) >= 40) parts.push(['🎪 Live event', 3]);
  if (open) parts.push(['👀 Playing now', 2]);
  return parts;
}
export const gameMult = (st, id, now, open) => multParts(st, id, now, open).reduce((a, [, v]) => a * v, 1);

// ---- money ----
export const salary = st => 25 * (dayOf(st).work / 8) * (has(st, 'h1') ? 1.5 : 1) * (has(st, 'h5') ? 2 : 1);
export const payEvery = st => (has(st, 'h3') ? 90 : 120);
export const gemsPerDollar = st => (has(st, 'h2') ? 12.5 : 10);
export const gemPrice = (st, n, id) => Math.ceil(n * (has(st, 'h4') ? 0.75 : 1) * (eventOn(st, 'sale', id) ? 0.5 : 1));
export const BUDGET_STEPS = [0, 1, 2, 3, 5, 8, 10, 15, 20, 25, 35, 50, 75, 100];
export const PACKS = [[4.99, 50], [9.99, 110], [19.99, 240], [49.99, 650]];

// ---- idle & luck ----
export const offlineCap = st => 7200 + (has(st, 'i1') ? 7200 : 0) + (has(st, 'i4') ? 21600 : 0) + 3600 * (st.meta.gear.phone || 0);
export const offlineEff = st => Math.max(0.2, Math.min(1, 0.5 + 0.04 * (dayOf(st).sleep - 8) + (has(st, 'i2') ? 0.25 : 0) + (has(st, 'i5') ? 0.25 : 0) + 0.05 * (st.meta.gear.charger || 0)));
export const lootEvery = st => 75 / ((has(st, 'l1') ? 1.3 : 1) * (1 + 0.1 * (st.meta.gear.charm || 0)));
export const autoTaps = st => (has(st, 'i3') ? 2 : 0);
export const prestigeMult = st => (has(st, 'l3') ? 1.25 : 1);
export const lootMult = st => (has(st, 'l5') ? 2 : 1);

export const varietyBonus = st => 0.25 * Math.max(0, installed(st).length - 1);
export function xpMult(st, id) {
  let x = (1 + varietyBonus(st)) * (has(st, 'l4') ? 1.5 : 1);
  if (id && st.games[id] && !st.games[id].spent) x *= 1.5;
  if (id && eventOn(st, 'xp', id)) x *= 2;
  return x;
}
// ---- life: sanity ----
// Sanity drifts down when you under-sleep or over-game, and recovers otherwise.
export function sanityRate(st) {
  const d = dayOf(st);
  let r = 0;
  if (d.sleep < 7) r -= (7 - d.sleep) * 0.04;
  if (d.game > 10) r -= (d.game - 10) * 0.03;
  return r < 0 ? r : 0.1 + Math.max(0, d.sleep - 8) * 0.05;
}
export function sanityMult(st) {
  const s = st.meta.sanity;
  return s >= 80 ? 1.1 : s >= 40 ? 1 : 0.4 + s / 66;
}

// ---- autopilot ----
export function autoSkill(st, id) {
  if (has(st, 'a5')) return 1;
  return Math.min(1, 0.15 + focusPts(st, id) / 50 + (has(st, 'a1') ? 0.25 : 0));
}
export const autoEvery = (st, id) => (1 + 9 * (1 - autoSkill(st, id))) / (has(st, 'a4') ? 2 : 1);

// ---- live events ----
export const EVENTS = {
  xp: { icon: '✨', name: 'Double XP weekend', desc: 'All XP from this game ×2', len: 240 },
  focus: { icon: '🎪', name: 'Limited-time event', desc: '×3 speed if it has 40%+ Focus', len: 300 },
  sale: { icon: '🏷️', name: 'Gem sale', desc: 'Its gem shop is 50% off', len: 300 },
};
export const eventOn = (st, type, id) => st.meta.events.some(e => e.type === type && e.id === id && e.until > Date.now());

export const xpNeed = L => Math.floor(30 * 1.6 ** (L - 1));

export const RARITY = [
  { id: 'common', name: 'Common', color: '#b9c3d6', w: 60 },
  { id: 'rare', name: 'Rare', color: '#4fa3ff', w: 28 },
  { id: 'epic', name: 'Epic', color: '#c56bff', w: 10 },
  { id: 'legendary', name: 'Legendary', color: '#ffb627', w: 2 },
];
export function rollRarity(st, floor = 0) {
  const w = RARITY.map(r => r.w);
  if (has(st, 'l2')) { w[0] -= 12; w[1] += 5; w[2] += 5; w[3] += 2; }
  if (has(st, 'l5')) w[3] *= 2;
  for (let i = 0; i < floor; i++) w[i] = 0;
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { if ((r -= w[i]) < 0) return i; }
  return 0;
}

// ---- trophies ----
const pre = (st, id) => st.games[id]?.prestiges || 0;
export const ACH = [
  { id: 'tap100', icon: '👆', name: 'Thumb Warm-up', desc: 'Tap 100 times', test: st => st.meta.stats.taps >= 100, insight: 1 },
  { id: 'tap2k', icon: '💪', name: 'Thumb of Steel', desc: 'Tap 2,000 times', test: st => st.meta.stats.taps >= 2000, insight: 2 },
  { id: 'lv5', icon: '⭐', name: 'Getting Into It', desc: 'Reach level 5', test: st => st.meta.level >= 5, insight: 1 },
  { id: 'lv10', icon: '🌟', name: 'Hobbyist', desc: 'Reach level 10', test: st => st.meta.level >= 10, insight: 2 },
  { id: 'lv20', icon: '💫', name: 'Lifestyle', desc: 'Reach level 20', test: st => st.meta.level >= 20, insight: 3 },
  { id: 'three', icon: '🤹', name: 'Juggler', desc: 'Have three games installed', test: st => installed(st).length >= 3, insight: 1 },
  { id: 'loot10', icon: '🎁', name: 'Loot Goblin', desc: 'Open 10 loot drops', test: st => st.meta.stats.loot >= 10, insight: 1 },
  { id: 'loot50', icon: '🗃️', name: 'Hoarder', desc: 'Open 50 loot drops', test: st => st.meta.stats.loot >= 50, insight: 2 },
  { id: 'legend', icon: '🌈', name: 'Legendary!', desc: 'Open a Legendary drop', test: st => st.meta.stats.legend >= 1, insight: 2 },
  { id: 'prest1', icon: '🔁', name: 'New Game+', desc: 'Prestige any game', test: st => st.meta.stats.prestiges >= 1, insight: 1 },
  { id: 'prest3', icon: '♾️', name: 'Reset Enthusiast', desc: 'Prestige all three games', test: st => pre(st, 'farm') && pre(st, 'rpg') && pre(st, 'dig'), insight: 3 },
  { id: 'prest10', icon: '🌀', name: 'Loop Lord', desc: 'Prestige 10 times in total', test: st => st.meta.stats.prestiges >= 10, insight: 3 },
  { id: 'spend1', icon: '💳', name: 'Just This Once', desc: 'Spend real money on a game', test: st => st.meta.stats.spent > 0, insight: 1 },
  { id: 'whale', icon: '🐋', name: 'Whale', desc: 'Spend $250 in total', test: st => st.meta.stats.spent >= 250, insight: 2 },
  { id: 'f2p', icon: '🦸', name: 'Proudly F2P', desc: 'Reach level 12 without spending a cent', test: st => st.meta.level >= 12 && !st.meta.stats.spent, insight: 3 },
  { id: 'farm', icon: '🌽', name: 'Breadbasket', desc: 'Earn 1B coins in Sunnyside Acres', test: st => (st.games.farm?.s.life || 0) >= 1e9, insight: 2 },
  { id: 'rpg', icon: '🐉', name: 'Dragonslayer', desc: 'Reach stage 50 in Ember & Oath', test: st => (st.games.rpg?.s.best || 0) >= 50, insight: 2 },
  { id: 'dig', icon: '🕳️', name: 'A Very Deep Hole', desc: 'Dig to 1,000 m in Just Keep Digging', test: st => (st.games.dig?.s.best || 0) >= 1000, insight: 2 },
  { id: 'away', icon: '🌙', name: 'Touched Some Grass', desc: 'Come back after an hour away', test: st => !!st.meta.stats.away, insight: 1 },
  { id: 'res10', icon: '🧪', name: 'Theorycrafter', desc: 'Complete 10 research nodes', test: st => Object.keys(st.meta.research).length >= 10, insight: 2 },
  { id: 'pay25', icon: '💵', name: 'Nine to Five', desc: 'Collect 25 paychecks', test: st => st.meta.stats.paydays >= 25, insight: 1 },
  { id: 'streak', icon: '📅', name: 'Daily Habit', desc: 'Log in 5 days in a row', test: st => st.meta.streak.n >= 5, insight: 2 },
  { id: 'grass', icon: '🌳', name: 'Enlightened', desc: 'Research Touch Grass', test: st => has(st, 'cap'), insight: 5 },
];

export function newState() {
  return {
    v: 1, lastSeen: Date.now(), buyMode: 1,
    meta: {
      level: 1, xp: 0, insight: 0, wallet: 20, payT: 0, lootT: 30, histT: 0, eventT: 180,
      day: { work: 8, game: 8 }, sanity: 100, events: [],
      alloc: {}, budget: {}, research: {}, gear: {}, ach: {}, relics: 0, streak: { day: '', n: 0 },
      stats: { taps: 0, loot: 0, legend: 0, prestiges: 0, spent: 0, paydays: 0, away: false },
    },
    games: {},
  };
}
export const newGame = def => ({ installed: true, gems: 0, boostUntil: 0, starter: false, vip: false, spent: 0, prestiges: 0, chestAt: Date.now() + 90000, auto: true, autoT: 0, autoPrestige: false, hist: [], s: def.init() });
