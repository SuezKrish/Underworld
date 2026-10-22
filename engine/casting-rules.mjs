import { sealedResolutionPermit } from './sealed-resolution-cast.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { shoggothAllowsCast } from './shoggoth-rules.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
import { planCastingAllowed } from './plan-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { fateSealedPermission } from './reality-rules.mjs';
import { sealedOn } from './sealing.mjs';
import { attachmentHostLegal, effectiveSubtypes } from './derived.mjs';
import { controllerOf } from './ownership.mjs';
export function societyAllowsCast(s, p, card) { return shoggothAllowsCast(s, p, card) && planCastingAllowed(s, p, card) && (!s.societies?.[p]?.plan?.disasterOnly || (card.subtypes ?? []).includes('灾难')); }
export function lotusHasSeal(s, id, name) {
    return sealedOn(s, id).some(cardId => matchesSpecifiedName(s.cards[cardId], name) && s.locations[cardId].hostVersion === (s.locations[id]?.fieldVersion ?? s.locations[id]?.zoneVersion));
}
export function lotusFreeCast(s, p, card) {
    if (s.resolutionCasting?.ignoreCosts && s.resolutionCasting.player === p && s.resolutionCasting.cardId === card.id)
        return true;
    if (!(card.subtypes ?? []).some(t => ['法术', '阴'].includes(t)))
        return false;
    return s.players[p].play.some(id => { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && controllerOf(s, id) === p && printedRulesCard(s, id).automation?.static === 'lotus-free-cast' && lotusHasSeal(s, id, '江莲'); });
}
export function waiveCastingCosts(original) {
    const plan = { ...original, chosenX: 0, extraPaid: 0, paidTime: 0, paidAssetCost: 0, sacrificedCount: 0, waivedOptionalExtraCosts: true, waivedCostX: !!original?.costX };
    // Waiving costs never performs payment actions or emits payment events.
    for (const key of ['sacrificeCharacter', 'sacrificeCharacters', 'tapCharacters', 'discardCost', 'sacrificeAsset', 'removeTimeCost', 'timeCostX', 'counterCost', 'scoreSelfCost', 'abandonScoreCost', 'alternativeCost', 'extraCost', 'costX'])
        delete plan[key];
    return plan;
}
export function equipmentFastCastSources(s, p, card) { return hasCardType(card, 'attachment') && effectiveSubtypes(s, card.id).some(t => ['装备', '武器'].includes(t)) ? s.players[p].play.filter(id => { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && controllerOf(s, id) === p && printedRulesCard(s, id).automation?.static === 'equipment-fast-cast' && attachmentHostLegal(s, id); }) : []; }
export function contingencySources(s, p, card) {
    if (!hasCardType(card, 'spell') || !effectiveSubtypes(s, card.id).includes('法术'))
        return [];
    return s.players[p].play.filter(id => { const l = s.locations[id]; return false; });
}
export function contingencyCastSource(s, p, card) {
    const native = card.spell ?? card.attachment;
    if (native?.timing === 'fast' || equipmentFastCastSources(s, p, card).length || fateSealedPermission(s, p, card.id) || sealedResolutionPermit(s, p, card.id) || s.resolutionCasting?.fastCast && s.resolutionCasting.cardId === card.id && s.resolutionCasting.player === p)
        return null;
    if (s.turn?.standardAllowed && s.flow.stepOwner === p && !s.flow.stack.length)
        return null;
    // Saved states expose standardAllowed through the round view, not on turn.
    if (s.turn?.phase === 'action' && !s.turn.actionClosed && ['first-action', 'second-action'].includes(s.turn.step) && s.flow.stepOwner === p && !s.flow.stack.length)
        return null;
    return contingencySources(s, p, card)[0] ?? null;
}
export function consumeContingencyCast(s, plan) {
    if (plan.contingencySource) {
        s.contingencyCastUses ??= {};
        s.contingencyCastUses[`${plan.contingencySource}:${plan.contingencyVersion}`] = s.round;
    }
}
export function effectiveCastPlan(s, p, card) { card = printedRulesCard(s, card.id) ?? card; const original = card.spell ?? card.attachment, plan = lotusFreeCast(s, p, card) ? waiveCastingCosts(original) : original, contingency = contingencyCastSource(s, p, card); return { ...plan, ...(plan?.gunfireNegotiation ? { modes: effectiveSocietyMarkers(s, 1 - p).exposed >= 2 ? [{ id: 'both', label: '两项全选' }] : [{ id: 'destroy', label: '消灭至多两个暗藏者' }, { id: 'police', label: '生成两个警察' }] } : {}), ...(equipmentFastCastSources(s, p, card).length || fateSealedPermission(s, p, card.id) || sealedResolutionPermit(s, p, card.id) || contingency || s.resolutionCasting?.fastCast && s.resolutionCasting.cardId === card.id && s.resolutionCasting.player === p ? { timing: 'fast' } : {}), ...(contingency ? { contingencyChoices: contingencySources(s, p, card).map(id => ({ id, name: s.cards[id].name, version: s.locations[id].zoneVersion })), contingencyExtraCost: 1, contingencySource: contingency, contingencyVersion: s.locations[contingency].zoneVersion } : {}), transaction: hasCardType(card, 'spell'), attachmentPlay: hasCardType(card, 'attachment') && !hasCardType(card, 'spell') }; }
