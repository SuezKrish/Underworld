import { sealedCount } from './sealed-counts.mjs';
export function secrecyLevel(s, p) { const m = s.players[p].markers; return m.hidden - m.exposed + (s.players[p].play.some(id => false) ? Math.min(3, sealedCount(s, `society:${1 - p}`)) : 0); }
export function effectiveSocietyMarkers(s, p) { const level = secrecyLevel(s, p); return { hidden: Math.max(0, level), exposed: Math.max(0, -level) }; }
