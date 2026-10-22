import { printedRulesCard } from './printed-rules.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { hasCardType } from './card-types.mjs';
import { attachmentHostLegal } from './derived.mjs';
export function paidRevealRestriction(s, p) {
    if (s.turn?.phase === 'action' && s.flow.stepOwner === p)
        return null;
    return s.players[1 - p].play.find(id => { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && printedRulesCard(s, id).automation?.static === 'enemy-paid-reveal-action-only'; }) ?? null;
}
export function magicTargetForbidden(s, id, plan) {
    const l = s.locations[id];
    if (l?.zone !== 'play' || l.faceDown || plan.nonTargeted)
        return false;
    const domains = plan.sourceMagicDomains ?? effectiveMagicDomains(s, plan.sourceId ?? plan.cardId);
    if (!domains?.length)
        return false;
    return Object.entries(s.locations).some(([aid, a]) => a.zone === 'play' && !a.faceDown && a.attachedTo === id && a.hostVersion === l.zoneVersion && hasCardType(printedRulesCard(s, id), 'character') && domains.some(d => printedRulesCard(s, aid).attachment?.protectHostMagic?.includes(d)) && attachmentHostLegal(s, aid));
}
export function firstLargeCastDiscount(s, p, card) {
    if (card.printedCost < 6 || s.largeCardCastRound?.[p] === s.round)
        return 0;
    return 2 * s.players[p].play.filter(id => { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && printedRulesCard(s, id).automation?.static === 'first-large-cast-discount'; }).length;
}
export function firstSubtitleCastDiscount(s, p, card) {
    if (!card.subtitle || s.subtitleCastRounds?.[p]?.[card.subtitle] === s.round)
        return 0;
    return s.players[p].play.reduce((n, id) => {
        const l = s.locations[id], discount = printedRulesCard(s, id).automation?.firstSubtitleCastDiscount;
        return n + (l?.zone === 'play' && !l.faceDown && discount?.subtitle === card.subtitle ? discount.amount : 0);
    }, 0);
}
