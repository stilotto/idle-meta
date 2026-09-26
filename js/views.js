// The phone's own tabs: Home, Budget, Research, Gear, Trophies.
import { S, wipe } from './core.js';
import { GAMES, BY_ID, SOON } from './games/index.js';
import * as D from './data.js';
import { fmt, usd, fmtTime, setText, toggle, show, fill, burst, modal } from './util.js';

const GREET = ['Just one more tap.', 'Your games missed you.', 'Numbers are going up.', 'Have you tried turning it off and prestiging?', 'Remember to blink.', 'The grind respects you.'];

export function mountHome(root, openGame) {
  const st = S.st, ids = D.installed(st).map(d => d.id);
  const hr = new Date().getHours();
  root.innerHTML = `
    <section class="hello">
      <h1>${hr < 5 ? 'Up late' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'}, gamer</h1>
      <p>${GREET[Math.floor(Math.random() * GREET.length)]} <span class="streak">🔥 ${st.meta.streak.n}-day streak</span></p>
    </section>
    <section class="cards">${GAMES.map(def => (st.games[def.id] ? cardHTML(def) : lockedHTML(def))).join('')}</section>
    <section>
      <div class="sec-h">Coming soon to the App Store</div>
      <div class="soon">${SOON.map(x => `<div class="soon-card"><span class="app-icon sm">${x.art}</span><b>${x.name}</b><small>${x.genre}</small></div>`).join('')}</div>
    </section>`;
  root.onclick = e => { const c = e.target.closest('[data-open]'); if (c) openGame(c.dataset.open); };
  const cards = ids.map(id => {
    const el = root.querySelector(`[data-open="${id}"]`), k = n => el.querySelector(`[data-k="${n}"]`);
    return { id, def: BY_ID[id], el, stat: k('stat'), sub: k('sub'), pc: k('pc'), fx: k('fx'), pay: k('pay'), alert: k('alert'), badge: k('badge'), ready: k('ready'), boost: k('boost') };
  });
  return {
    count: ids.length,
    update() {
      const now = Date.now();
      for (const c of cards) {
        const g = st.games[c.id], ctx = { now, open: false, mult: D.gameMult(st, c.id, now, false), autoTaps: D.autoTaps(st), pm: D.prestigeMult(st) };
        const info = c.def.card(g.s, ctx), gain = c.def.gain(g.s, ctx.pm), b = st.meta.budget[c.id] || 0;
        setText(c.stat, info.stat);
        setText(c.sub, info.sub);
        setText(c.pc, String(g.prestiges));
        setText(c.fx, `${st.meta.alloc[c.id] || 0}% · ×${D.focusMult(st, c.id).toFixed(1)}`);
        setText(c.pay, g.spent || b ? `💳 ${usd(b)}/pay` : '🦸 F2P');
        toggle(c.pay, 'f2p', !g.spent && !b);
        setText(c.alert, info.alert);
        show(c.alert, !!info.alert);
        show(c.ready, gain >= 1);
        if (gain >= 1) setText(c.ready, `${c.def.prestige.icon} +${fmt(gain)} ready`);
        show(c.boost, g.boostUntil > now);
        const n = (g.chestAt <= now ? 1 : 0) + (info.alert ? 1 : 0);
        show(c.badge, n > 0);
        setText(c.badge, String(n));
      }
    },
  };
}

function cardHTML(def) {
  const P = def.prestige;
  return `
    <button class="gcard theme-${def.theme}" data-open="${def.id}">
      <span class="app-icon">${def.art}<i class="badge" data-k="badge" hidden></i></span>
      <span class="gc-mid">
        <span class="gc-name">${def.name}</span>
        <span class="gc-dev">${def.dev} · ${def.genre}</span>
        <span class="gc-stat" data-k="stat"></span>
        <span class="gc-sub" data-k="sub"></span>
        <span class="chips">
          <span class="chip">${P.icon} <b data-k="pc"></b> ${P.noun}</span>
          <span class="chip focus">⚡ <b data-k="fx"></b></span>
          <span class="chip" data-k="pay"></span>
          <span class="chip boost" data-k="boost" hidden>🚀 Boosted</span>
          <span class="chip ready" data-k="ready" hidden></span>
        </span>
        <span class="gc-alert" data-k="alert" hidden></span>
      </span>
      <span class="gc-go" aria-hidden="true">▶</span>
    </button>`;
}
function lockedHTML(def) {
  return `
    <div class="gcard locked">
      <span class="app-icon">${def.art}<span class="lock">🔒</span></span>
      <span class="gc-mid">
        <span class="gc-name">${def.name}</span>
        <span class="gc-dev">${def.dev} · ${def.genre}</span>
        <span class="gc-sub">Unlocks at level ${def.unlock}</span>
      </span>
    </div>`;
}

// ---------------- Budget ----------------
export function mountBudget(root) {
  const st = S.st, m = st.meta, defs = D.installed(st);
  root.innerHTML = `
    <section class="panel">
      <div class="panel-h"><span>⚡ Focus</span><small>how much attention each game gets</small></div>
      <div class="sum3">
        <div><small>Max Focus</small><b data-k="cap"></b></div>
        <div><small>Juggling</small><b data-k="pen"></b></div>
        <div><small>Usable</small><b data-k="eff"></b></div>
      </div>
      <div class="alloc-bar">${defs.map(d => `<i class="theme-${d.theme}" data-seg="${d.id}"></i>`).join('')}</div>
      ${defs.map(d => `
        <div class="alloc" data-id="${d.id}">
          <span class="app-icon xs">${d.art}</span>
          <div class="alloc-mid">
            <div class="alloc-top"><b>${d.name}</b><span><em data-k="pct"></em> · <strong data-k="x"></strong></span></div>
            <input type="range" min="0" max="100" step="5" value="${m.alloc[d.id] || 0}" aria-label="Focus for ${d.name}">
          </div>
        </div>`).join('')}
      <div class="row-btns"><button class="ghost" data-act="even">Split evenly</button><span class="muted small" data-k="free"></span></div>
      <p class="note">More Focus makes a game faster, with diminishing returns. Every extra game costs some Focus to juggle, but adds <b>+25% XP</b> from variety. Games with 0 Focus still idle at ×1.</p>
    </section>

    <section class="panel">
      <div class="panel-h"><span>💵 Wallet</span><small>your day job pays the bills</small></div>
      <div class="sum3">
        <div><small>Wallet</small><b data-k="wallet"></b></div>
        <div><small>Paycheck</small><b data-k="salary"></b></div>
        <div><small>Next payday</small><b data-k="next"></b></div>
      </div>
      <div class="bar money"><i data-k="paybar"></i></div>
      ${defs.map(d => `
        <div class="spend" data-id="${d.id}">
          <span class="app-icon xs">${d.art}</span>
          <div class="alloc-mid"><b>${d.name}</b><small data-k="info"></small></div>
          <div class="stepper"><button data-step="-1" aria-label="Spend less">−</button><b data-k="amt"></b><button data-step="1" aria-label="Spend more">+</button></div>
        </div>`).join('')}
      <p class="note">Each payday your budget buys that game gems (${D.gemsPerDollar(st)} 💎 per $1). Gems buy boosts, time warps and permanent packs. Games you never pay for give <b>+50% XP</b>. That's F2P pride.</p>
      <div class="sum-line"><span>Lifetime real-money spend</span><b data-k="spent"></b></div>
    </section>

    <section class="panel">
      <div class="panel-h"><span>✨ XP bonuses</span></div>
      <div class="sum-line"><span>🎮 Variety (${defs.length} game${defs.length > 1 ? 's' : ''})</span><b>+${Math.round(D.varietyBonus(st) * 100)}%</b></div>
      ${defs.map(d => `<div class="sum-line"><span>${d.name}</span><b data-xp="${d.id}"></b></div>`).join('')}
    </section>`;

  const K = n => root.querySelector(`[data-k="${n}"]`);
  root.oninput = e => {
    const r = e.target.closest('input[type=range]');
    if (!r) return;
    const id = r.closest('[data-id]').dataset.id;
    const others = D.allocTotal(st) - (m.alloc[id] || 0);
    m.alloc[id] = Math.min(+r.value, 100 - others);
    r.value = m.alloc[id];
  };
  root.onclick = e => {
    const s = e.target.closest('[data-step]');
    if (s) {
      const id = s.closest('[data-id]').dataset.id, B = D.BUDGET_STEPS;
      let i = B.indexOf(m.budget[id] || 0);
      if (i < 0) i = 0;
      m.budget[id] = B[Math.max(0, Math.min(B.length - 1, i + +s.dataset.step))];
    }
    if (e.target.closest('[data-act="even"]')) {
      const each = Math.floor(100 / defs.length);
      defs.forEach((d, i) => { m.alloc[d.id] = each + (i === 0 ? 100 - each * defs.length : 0); });
      root.querySelectorAll('input[type=range]').forEach(r => { r.value = m.alloc[r.closest('[data-id]').dataset.id]; });
    }
  };
  return {
    update() {
      setText(K('cap'), fmt(D.focusCap(st)));
      setText(K('pen'), defs.length > 1 ? `−${Math.round((1 - D.effFocus(st) / D.focusCap(st)) * 100)}%` : 'none');
      setText(K('eff'), fmt(D.effFocus(st)));
      const free = 100 - D.allocTotal(st);
      setText(K('free'), free > 0 ? `${free}% unassigned` : 'All Focus assigned');
      for (const d of defs) {
        const row = root.querySelector(`.alloc[data-id="${d.id}"]`);
        setText(row.querySelector('[data-k="pct"]'), `${m.alloc[d.id] || 0}%`);
        setText(row.querySelector('[data-k="x"]'), `×${D.focusMult(st, d.id).toFixed(2)}`);
        root.querySelector(`[data-seg="${d.id}"]`).style.flexGrow = m.alloc[d.id] || 0;
        const sp = root.querySelector(`.spend[data-id="${d.id}"]`), g = st.games[d.id], b = m.budget[d.id] || 0;
        setText(sp.querySelector('[data-k="amt"]'), usd(b));
        setText(sp.querySelector('[data-k="info"]'), b ? `→ ${fmt(b * D.gemsPerDollar(st))} 💎 per payday · spent ${usd(g.spent)}` : g.spent ? `Paused · spent ${usd(g.spent)}` : '🦸 Free-to-play');
        setText(root.querySelector(`[data-xp="${d.id}"]`), g.spent ? '—' : '🦸 F2P +50%');
      }
      setText(K('wallet'), usd(m.wallet));
      setText(K('salary'), usd(D.salary(st)));
      setText(K('next'), fmtTime(D.payEvery(st) - m.payT));
      fill(K('paybar'), m.payT / D.payEvery(st));
      setText(K('spent'), usd(m.stats.spent));
    },
  };
}

// ---------------- Research ----------------
export function mountResearch(root) {
  const st = S.st, ROW = 88, H = ROW * 6;
  const pos = r => ({ x: ((r.br + 0.5) / 4) * 100, y: r.t * ROW + 40 });
  const lines = [];
  for (const r of D.RESEARCH) for (const q of r.req || []) {
    const a = pos(D.RESEARCH.find(x => x.id === q)), b = pos(r);
    lines.push(`<line data-l="${q}>${r.id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
  }
  let sel = D.RESEARCH.find(r => D.canResearch(st, r))?.id || 'f1';
  root.innerHTML = `
    <section class="res-head">
      <div><h2>Research</h2><p class="muted small">Gamer knowledge. Earn 💡 Insight from level-ups, prestiges and trophies.</p></div>
      <div class="ins-big">💡 <b data-k="ins"></b></div>
    </section>
    <div class="branches">${D.BRANCHES.map(b => `<span style="--c:${b.color}">${b.name}</span>`).join('')}</div>
    <div class="tree" style="height:${H}px">
      <svg class="tree-lines" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>
      ${D.RESEARCH.map(r => {
        const p = pos(r), c = r.br % 1 ? '#ffffff' : D.BRANCHES[r.br].color;
        return `<button class="rnode${r.id === 'cap' ? ' cap' : ''}" data-r="${r.id}" style="left:${p.x}%;top:${p.y}px;--c:${c}" aria-label="${r.name}"><span>${r.icon}</span><i>${r.cost}</i></button>`;
      }).join('')}
    </div>
    <div class="res-detail" data-k="detail"></div>`;
  const detail = root.querySelector('[data-k="detail"]');
  function renderDetail() {
    const r = D.RESEARCH.find(x => x.id === sel), done = D.has(st, r.id), can = D.canResearch(st, r);
    const need = (r.req || []).filter(q => !D.has(st, q)).map(q => D.RESEARCH.find(x => x.id === q).name);
    detail.innerHTML = `
      <div class="rd-icon" style="--c:${r.br % 1 ? '#fff' : D.BRANCHES[r.br].color}">${r.icon}</div>
      <div class="rd-mid"><b>${r.name}</b><p>${r.desc}</p>${need.length ? `<small>Requires ${need.join(', ')}</small>` : ''}</div>
      <button class="big-btn sm" data-act="buy" ${done || !can ? 'disabled' : ''}>${done ? 'Learned ✓' : `💡 ${r.cost}`}</button>`;
  }
  root.onclick = e => {
    const n = e.target.closest('[data-r]');
    if (n) { sel = n.dataset.r; renderDetail(); return; }
    if (e.target.closest('[data-act="buy"]')) {
      const r = D.RESEARCH.find(x => x.id === sel);
      if (!D.canResearch(st, r) || st.meta.insight < r.cost) return;
      st.meta.insight -= r.cost;
      st.meta.research[r.id] = true;
      const b = root.querySelector(`[data-r="${r.id}"]`).getBoundingClientRect();
      burst(b.left + b.width / 2, b.top + b.height / 2, [D.BRANCHES[Math.floor(r.br)]?.color || '#fff', '#fff'], 28);
      sel = D.RESEARCH.find(x => D.canResearch(st, x))?.id || sel;
      renderDetail();
    }
  };
  renderDetail();
  return {
    update() {
      setText(root.querySelector('[data-k="ins"]'), fmt(st.meta.insight));
      for (const r of D.RESEARCH) {
        const el = root.querySelector(`[data-r="${r.id}"]`), done = D.has(st, r.id), can = D.canResearch(st, r);
        toggle(el, 'done', done);
        toggle(el, 'avail', can);
        toggle(el, 'afford', can && st.meta.insight >= r.cost);
        toggle(el, 'sel', r.id === sel);
      }
      root.querySelectorAll('[data-l]').forEach(l => { const [, b] = l.dataset.l.split('>'); toggle(l, 'lit', D.has(st, l.dataset.l.split('>')[0]) && (D.has(st, b) || D.canResearch(st, D.RESEARCH.find(x => x.id === b)))); });
      const btn = detail.querySelector('button'), r = D.RESEARCH.find(x => x.id === sel);
      if (btn && !D.has(st, sel)) { btn.disabled = !D.canResearch(st, r); toggle(btn, 'off', st.meta.insight < r.cost); }
    },
  };
}

// ---------------- Gear ----------------
export function mountGear(root) {
  const st = S.st, m = st.meta;
  root.innerHTML = `
    <section class="res-head"><div><h2>Gear</h2><p class="muted small">Real-life upgrades for a serious gamer. Paid from your wallet.</p></div><div class="ins-big money">💵 <b data-k="wallet"></b></div></section>
    <div class="list">${D.GEAR.map(it => `
      <div class="row gear" data-g="${it.id}">
        <div class="row-icon">${it.icon}</div>
        <div class="row-mid"><div class="row-name">${it.name} <em data-k="lv"></em></div><div class="row-sub">${it.desc} per level</div><div class="pips" data-k="pips"></div></div>
        <button class="buy money" data-act="buy"><b data-k="cost"></b></button>
      </div>`).join('')}</div>
    <p class="note center">Money spent on gear is money not spent on gems. Choose wisely. Or don't, it's your wallet.</p>`;
  root.onclick = e => {
    const b = e.target.closest('[data-act="buy"]');
    if (!b) return;
    const it = D.GEAR.find(x => x.id === b.closest('[data-g]').dataset.g), lv = m.gear[it.id] || 0, c = D.gearCost(st, it);
    if (lv >= it.max || m.wallet < c) return;
    m.wallet = Math.round((m.wallet - c) * 100) / 100;
    m.gear[it.id] = lv + 1;
    burst(e.clientX, e.clientY, ['#3ddc84', '#fff']);
  };
  return {
    update() {
      setText(root.querySelector('[data-k="wallet"]'), usd(m.wallet));
      for (const it of D.GEAR) {
        const el = root.querySelector(`[data-g="${it.id}"]`), lv = m.gear[it.id] || 0, max = lv >= it.max, c = D.gearCost(st, it);
        setText(el.querySelector('[data-k="lv"]'), `Lv ${lv}/${it.max}`);
        setText(el.querySelector('[data-k="cost"]'), max ? 'Maxed' : usd(c));
        toggle(el.querySelector('.buy'), 'off', max || m.wallet < c);
        const pips = el.querySelector('[data-k="pips"]');
        if (pips.childElementCount !== it.max) pips.innerHTML = '<i></i>'.repeat(it.max);
        [...pips.children].forEach((p, i) => toggle(p, 'on', i < lv));
      }
    },
  };
}

// ---------------- Trophies ----------------
export function mountTrophies(root) {
  const st = S.st, m = st.meta;
  root.innerHTML = `
    <section class="res-head"><div><h2>Trophies</h2><p class="muted small">Each one is worth 💡 Insight and +2% speed in every game.</p></div><div class="ins-big gold">🏆 <b data-k="count"></b></div></section>
    <div class="trophies">${D.ACH.map(a => `<div class="trophy" data-a="${a.id}"><span>${a.icon}</span><b>${a.name}</b><small>${a.desc}</small><i>+${a.insight} 💡</i></div>`).join('')}</div>
    <section class="panel">
      <div class="panel-h"><span>📊 Stats</span></div>
      <div data-k="stats"></div>
    </section>
    <p class="center"><button class="ghost danger" data-act="wipe">Delete save and start over</button></p>`;
  root.onclick = e => {
    if (!e.target.closest('[data-act="wipe"]')) return;
    modal((card, close) => {
      card.innerHTML = `<h2>Start over?</h2><p class="muted">Every game, level, trophy and dollar goes away. This can't be undone.</p><div class="pay-btns"><button class="ghost" data-x>Keep playing</button><button class="big-btn danger" data-ok>Delete everything</button></div>`;
      card.querySelector('[data-x]').onclick = close;
      card.querySelector('[data-ok]').onclick = wipe;
    });
  };
  return {
    update() {
      setText(root.querySelector('[data-k="count"]'), `${Object.keys(m.ach).length}/${D.ACH.length}`);
      D.ACH.forEach(a => toggle(root.querySelector(`[data-a="${a.id}"]`), 'got', !!m.ach[a.id]));
      const s = m.stats, rows = [
        ['Level', m.level], ['Taps', fmt(s.taps)], ['Loot drops opened', s.loot], ['Legendaries', s.legend],
        ['Prestiges', s.prestiges], ['Paychecks', s.paydays], ['Real money spent', usd(s.spent)], ['Login streak', `${m.streak.n} days`],
      ];
      const html = rows.map(([k, v]) => `<div class="sum-line"><span>${k}</span><b>${v}</b></div>`).join('');
      const el = root.querySelector('[data-k="stats"]');
      if (el.innerHTML !== html) el.innerHTML = html;
    },
  };
}
