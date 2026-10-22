import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
// This changes only location checks made by the resolving district transaction.
// The actual district, attachment host and object identity remain unchanged.
export function inEffectDistrict(s, id, district) {
    const l = s.locations[id];
    if (l?.district !== district)
        return false;
    if (!s.resolvingDistrictTransaction || l.zone !== 'play' || l.faceDown || !hasCardType(printedRulesCard(s, id), 'character'))
        return true;
    return !Object.entries(s.locations).some(([source, sl]) => false);
}
export function canTerminate(s, a) { return a && !a.plan?.cannotTerminate && !s.players[a.controller].play.some(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && printedRulesCard(s, id).automation?.static === 'uncounterable-own-effects'); }
