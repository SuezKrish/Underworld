import { taskForceBonusActive } from './field-completion-rules.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { shoggothBonuses } from './shoggoth-rules.mjs';
import { firstAbilitiesActive } from './green-black-rules.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { attachmentHostLegal, effectiveSubtypes, cardHasKeyword } from './derived.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { sealedOn } from './sealing.mjs';
export const actionsOf = c => c?.automation?.actions ?? (c?.automation?.action ? [c.automation.action] : []);
export function roundKeywordEffectApplies(s, id, e) { const l = s.locations[id]; return e.kind === 'subtype-keywords' && l?.zone === 'play' && !l.faceDown && hasCardType(printedRulesCard(s, id), 'character') && controllerOf(s, id) === e.controller && (!e.subtype || effectiveSubtypes(s, id).includes(e.subtype)) && !(e.excludeId === id && e.excludeVersion === l.zoneVersion); }
export function matchesDiscount(card, filter = {}) {
    return (!filter.type || hasCardType(card, filter.type)) && (!filter.faction || card.faction?.split('·')[0] === filter.faction) && (!filter.factionGroup || card.faction?.split('·')[1] === filter.factionGroup) && (!filter.subtype || card.subtypes?.includes(filter.subtype)) && (!filter.magic || card.magicDomains?.includes(filter.magic)) && (!filter.anyDomain || !!card.magicDomains?.length) && (!filter.any || filter.any.some(f => matchesDiscount(card, f)));
}
export function eligibleDiscount(s, p, card, method) { return (s.effects ?? []).filter(e => e.kind === 'next-cost-discount' && e.controller === p && (!e.playOnly || method === 'play') && matchesDiscount(card, e.filter)); }
export function discountAppliesToHost(s, e, targets) {
    if (!e.hostSubtitle)
        return true;
    const id = targets?.[0]?.cardId, l = s.locations[id], c = printedRulesCard(s, id);
    return l?.zone === 'play' && !l.faceDown && hasCardType(c, 'character') && c.subtitle === e.hostSubtitle;
}
export function consumeDiscounts(s, p, card, method) {
    const used = eligibleDiscount(s, p, card, method), linked = new Set(used.map(e => e.linkedIconEffectId).filter(Boolean));
    s.effects = (s.effects ?? []).filter(e => !used.includes(e) && !linked.has(e.id));
    if (card.subtitle) {
        s.subtitleCastRounds ??= {};
        s.subtitleCastRounds[p] ??= {};
        s.subtitleCastRounds[p][card.subtitle] = s.round;
    }
    if (card.printedCost >= 6) {
        s.largeCardCastRound ??= {};
        s.largeCardCastRound[p] = s.round;
    }
    if (method === 'play' && card.subtypes?.includes('装备')) {
        s.equipmentPlayed ??= {};
        s.equipmentPlayed[p] = s.round;
    }
}
export function cannotFlip(s, id) {
    if ([].length)
        return true;
    const loc = s.locations[id];
    if (loc?.zone === 'play' && !loc.faceDown && !loc.secretPlan && hasCardType(s.cards[id], 'character') && cardHasKeyword(s, id, '永恒'))
        return true;
    if (s.locations[id]?.zone === 'play' && s.locations[id].faceDown && (s.effects ?? []).some(e => e.kind === 'prevent-hidden-reveal'))
        return true;
    return !!s.locations[id]?.counters?.locked && s.players.flatMap(p => p.play).some(source => s.locations[source]?.zone === 'play' && !s.locations[source].faceDown && printedRulesCard(s, source).automation?.static === 'locked-no-flip');
}
export function lockedInfluenceSuppressed(s, id) { return !!s.locations[id]?.counters?.locked && s.players.flatMap(p => p.play).some(source => s.locations[source]?.zone === 'play' && !s.locations[source].faceDown && printedRulesCard(s, source).automation?.static === 'locked-no-influence'); }
export function batBlocksTransaction(s, id, p) { return Object.entries(s.locations).some(([aid, l]) => l.zone === 'play' && !l.faceDown && l.attachedTo === id && printedRulesCard(s, aid)?.automation?.static === 'bat-spell-protection' && attachmentHostLegal(s, aid) && controllerOf(s, id) !== p); }
export function cannotTarget(s, id, { attachmentPlay = false } = {}) {
    if (!attachmentPlay && s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && Object.entries(s.locations).some(([aid, al]) => false))
        return true;
    return s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && printedRulesCard(s, id).automation?.static === 'untargetable';
}
export function batchStaticIcons(s, id, white, blackOnly = false) {
    const c = printedRulesCard(s, id), l = s.locations[id], p = controllerOf(s, id), out = shoggothBonuses(s, id, white, blackOnly);
    if (l.zone !== 'play' || l.faceDown)
        return out;
    if (c.automation?.static === 'no-enemy-character-icons' && !s.players[1 - p].play.some(x => s.locations[x].district === l.district && !s.locations[x].faceDown && hasCardType(s.cards[x], 'character'))) {
        out.influence = 1;
        if (white || !blackOnly && s.turn.firstPlayer === p)
            out.investigation = 1;
    }
    if (c.automation?.static === 'district-shrine-battle' && attachmentHostLegal(s, id) && s.players.flatMap(pl => pl.play).some(a => s.locations[a]?.zone === 'play' && !s.locations[a].faceDown && s.locations[a].attachedTo === `district-host:${s.districts[l.district]?.id}` && hasCardType(s.cards[a], 'attachment') && effectiveSubtypes(s, a).includes('神社') && attachmentHostLegal(s, a)))
        out.battle = 1;
    if (c.automation?.static === 'blood-bat' && s.players[p].assets.filter(a => a.magicDomains?.includes('鲜血')).length >= 2)
        out.investigation = 1;
    if (c.automation?.static === 'attached-priest-eye' && Object.entries(s.locations).some(([aid, a]) => aid !== id && a.zone === 'play' && !a.faceDown && a.attachedTo === id && a.hostVersion === l.zoneVersion && hasCardType(s.cards[aid], 'attachment') && attachmentHostLegal(s, aid)))
        out.investigation = 1;
    if (c.automation?.static === 'turtle-company' && s.players[p].play.some(x => s.locations[x]?.zone === 'play' && !s.locations[x].faceDown && s.locations[x].district === l.district && hasCardType(printedRulesCard(s, x), 'character') && effectiveSubtypes(s, x).some(t => ['法师', '吸血鬼'].includes(t)))) {
        out.investigation = 1;
        out.influence = 1;
    }
    if (c.automation?.static === 'wolf-pack') {
        const n = s.players[p].play.filter(x => x !== id && s.locations[x]?.zone === 'play' && !s.locations[x].faceDown && s.locations[x].district === l.district && hasCardType(printedRulesCard(s, x), 'character') && effectiveSubtypes(s, x).includes('狼')).length;
        out.influence = n;
        out.defense = n;
    }
    if (c.automation?.static === 'hidden-white-eye' && effectiveSocietyMarkers(s, p).hidden > 0 && (white || !blackOnly && s.turn.firstPlayer === p))
        out.investigation = 1;
    if (c.automation?.static === 'own-influence-white-star' && s.districts[l.district]?.influence[p] > 0 && (white || !blackOnly && s.turn.firstPlayer === p))
        out.influence = 1;
    if (c.automation?.static === 'execution-task-force' && taskForceBonusActive(s, id, c))
        out.defense = (out.defense ?? 0) + 1;
    if (c.automation?.static === 'time-influence')
        out.influence = l.markers ?? 0;
    if (c.automation?.static === 'destroyed-prophet' && s.districts[l.district]?.destroyed)
        out.influence = 2;
    if (c.automation?.static === 'tattoo-bonus') {
        const n = Object.entries(s.locations).filter(([x, a]) => a.zone === 'play' && !a.faceDown && a.attachedTo === id && a.hostVersion === l.zoneVersion && s.cards[x].subtypes?.includes('纹身')).length;
        out.investigation = n;
        out.defense = n;
    }
    if (c.automation?.static === 'weapon-bonus') {
        const n = Object.entries(s.locations).filter(([x, a]) => a.zone === 'play' && !a.faceDown && a.attachedTo === id && a.hostVersion === l.zoneVersion && s.cards[x].subtypes?.includes('武器')).length;
        out.battle = n;
        out.defense = n;
    }
    return out;
}
export function batchSubtypeGrants(s, id) {
    const c = printedRulesCard(s, id), l = s.locations[id], p = controllerOf(s, id), out = [];
    if (l.zone === 'play' && !l.faceDown && c.automation?.static === 'blood-bat' && s.players[p].assets.filter(a => a.magicDomains?.includes('鲜血')).length >= 2)
        out.push('吸血鬼');
    for (const [aid, a] of Object.entries(s.locations))
        if (a.zone === 'play' && !a.faceDown && a.attachedTo === id && a.hostVersion === l.zoneVersion)
            out.push(...(printedRulesCard(s, aid).attachment?.grantSubtypes ?? []));
    return out;
}
export function batchKeyword(s, id, k) {
    const c = printedRulesCard(s, id), l = s.locations[id];
    if (l.zone !== 'play' || l.faceDown)
        return false;
    if (['杀伤1', '撤回'].includes(k) && c.automation?.static === 'execution-task-force' && taskForceBonusActive(s, id, c))
        return true;
    if (k === '声望' && c.automation?.static === 'destroyed-prophet' && s.districts[l.district]?.destroyed)
        return true;
    if (k === '创伤3' && c.automation?.static === 'armed-wound-three' && Object.entries(s.locations).some(([a, al]) => al.zone === 'play' && !al.faceDown && al.attachedTo === id && al.hostVersion === l.zoneVersion && s.cards[a].subtypes?.includes('武器')))
        return true;
    if (k === '屏障')
        for (const [a, al] of Object.entries(s.locations))
            if (al.zone === 'play' && !al.faceDown && al.attachedTo === id && al.hostVersion === l.zoneVersion && s.cards[a].attachment?.firstPlayerBarrier && firstAbilitiesActive(s, controllerOf(s, id)))
                return true;
    return false;
}
export function sourceLive(s, plan) { const l = s.locations[plan.sourceId]; return (l?.zone === 'play' || plan.societySource && l?.zone === 'society') && !l.faceDown && l.zoneVersion === plan.sourceZoneVersion; }
export function sourceDistrictLive(s, plan) { return s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId; }
export function sourceSeals(s, plan) { return sourceLive(s, plan) ? sealedOn(s, plan.sourceId) : []; }

// Leaving and returning creates a different source object.
export function sameSourceObject(s,id,plan){return id===plan.sourceId&&(plan.sourceZoneVersion===undefined||s.locations[id]?.zoneVersion===plan.sourceZoneVersion);}
