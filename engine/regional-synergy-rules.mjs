import { printedRulesCard } from './printed-rules.mjs';
import { controllerOf } from './ownership.mjs';
import { hasCardType } from './card-types.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { effectiveSubtypes, attachmentHostLegal } from './derived.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
export function tiagoSources(s, id) {
    const l = s.locations[id], p = controllerOf(s, id);
    const sources = s.players[p].play.filter(source => { const sl = s.locations[source]; return sl?.zone === 'play' && !sl.faceDown && s.cards[source].automation?.static === 'tiago-eyes' && printedRulesCard(s, source).automation?.static === 'tiago-eyes' && !abilitiesSuppressed(s, source); });
    if (!sources.length)
        return [];
    const c = printedRulesCard(s, id);
    if (l?.zone !== 'play' || l.faceDown || !hasCardType(c, 'character') || effectiveSocietyMarkers(s, p).hidden <= 0 || c.faction?.split('·')[0] !== '黑' && !effectiveSubtypes(s, id).includes('罪犯'))
        return [];
    return sources;
}
export function hiddenSlowSources(s, id) {
    const l = s.locations[id];
    if (l?.zone !== 'play' || !l.faceDown)
        return [];
    return s.players.flatMap(p => p.play).filter(source => { const sl = s.locations[source]; return sl?.zone === 'play' && !sl.faceDown && (sl.district === l.district || printedRulesCard(s, source).automation?.hiddenSlow === 'global') && s.cards[source].automation?.hiddenSlow && printedRulesCard(s, source).automation?.hiddenSlow && !abilitiesSuppressed(s, source); });
}
export function regionalHiddenBonus(s, p, id) {
    const c = s.cards[id], subtypes = effectiveSubtypes(s, id);
    return s.players[p].play.reduce((sum, source) => {
        const l = s.locations[source], plan = printedRulesCard(s, source).automation;
        if (l?.zone !== 'play' || l.faceDown || l.secretPlan || !plan?.shownCardBonus || !attachmentHostLegal(s, source))
            return sum;
        const f = plan.shownCardBonus;
        return sum + ((!f.faction || c.faction?.split('·')[0] === f.faction) && (!f.subtypesAny || f.subtypesAny.some(t => subtypes.includes(t))) ? f.amount : 0);
    }, 0);
}
