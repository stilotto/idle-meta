# idle-meta: Idle Meta

An idle game about playing idle games. Served by GitHub Pages at
https://stilotto.github.io/idle-meta/ and linked from the stilotto.github.io
home page.

## How it's built

- Plain ES modules, no build step, no dependencies. Open `index.html` via any static server.
- `js/main.js` boot + loop + nav, `js/core.js` state/save/XP/loot/offline,
  `js/data.js` meta rules (research, gear, trophies, formulas),
  `js/shell.js` the in-game overlay (tabs, prestige, gem shop),
  `js/views.js` the phone tabs, `js/games/*.js` one module per game.
- To add a game: write a module with the same shape as `games/farm.js`
  (init, tick, grant, warp, card, gain/need/reset, mountPlay, mountUp) and add it to `games/index.js`.
- Save lives in localStorage key `idle-hands-save-v1`; `core.load()` merges new fields into old saves.
- Must work at phone width and honor prefers-reduced-motion. Google Fonts only.
- Push straight to `main`.
