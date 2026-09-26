// Every game the phone knows about. Add a module here to add a game.
import farm from './farm.js';
import rpg from './rpg.js';
import dig from './dig.js';
import { ART } from '../art.js';

export const GAMES = [farm, rpg, dig];
export const BY_ID = Object.fromEntries(GAMES.map(g => [g.id, g]));

export const SOON = [
  { name: 'Starfall Dominion', genre: 'Space conquest', art: ART.space },
  { name: 'Deepcore Mining Co.', genre: 'Mining tycoon', art: ART.mine },
  { name: 'Glorious Output', genre: 'Generator chain', art: ART.chain },
];
