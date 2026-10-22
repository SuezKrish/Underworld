import { matchesSpecifiedName } from './card-names.mjs';
import { cageRestricts } from './field-rules.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { controllerOf } from './ownership.mjs';
import { hasCardType } from './card-types.mjs';
import { effectiveSubtypes } from './derived.mjs';
export function participatesInContest(s, id) {
    const l = s.locations[id];
    if (l?.zone !== 'play' || cageRestricts(s, id))
        return false;
    if (!l.tapped)
        return true;
    if (l.faceDown || !hasCardType(s.cards[id], 'character') || !effectiveSubtypes(s, id).includes('阴魂'))
        return false;
    return s.players[controllerOf(s, id)].play.some(source => false);
}
export function participatesInDistrictContest(s, id, district, kind) {
    if (!participatesInContest(s, id))
        return false;
    const l = s.locations[id];
    if (l.district === district)
        return true;
    if (kind !== 'influence' || l.faceDown || printedRulesCard(s, id)?.automation?.static !== 'zhang-influence')
        return false;
    const p = controllerOf(s, id);
    return s.players[p].play.some(other => { const loc = s.locations[other]; return loc?.zone === 'play' && !loc.faceDown && loc.district === district && hasCardType(printedRulesCard(s, other), 'character') && matchesSpecifiedName(printedRulesCard(s, other), '无知路人'); });
}
