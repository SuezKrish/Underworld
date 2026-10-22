import { printedRulesCard } from './printed-rules.mjs';
import { controllerOf } from './ownership.mjs';
import { hasCardType } from './card-types.mjs';
// Destruction immunity protects the same field object. It does not prevent
// sacrifice, return-to-hand, sealing, or an invalid attachment's rule departure.
export function destructionImmune(s, id) { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && ((s.effects ?? []).some(e => e.kind === 'prevent-destruction' && (e.targetId === id && e.targetZoneVersion === l.zoneVersion || e.allOwnRoles && e.controller === controllerOf(s, id) && hasCardType(s.cards[id], 'character')))); }
