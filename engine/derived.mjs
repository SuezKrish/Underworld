import { virtualAttachments } from './cq-rules.mjs';
import { costSacrificeReserved } from './cost-payment.mjs';
import { sealedCount } from './sealed-counts.mjs';
import { statusKeywordSources, markedRoundKeyword, reputationSuppressedSources } from './veiled-status-rules.mjs';
import { firstLargeCastDiscount, firstSubtitleCastDiscount } from './veil-tools-rules.mjs';
import { effectiveIcons } from './rounds.mjs';
import { hiddenSlowSources } from './regional-synergy-rules.mjs';
import { dreamContext } from './continuing-cost-rules.mjs';
import { effectiveSocietyMarkers, secrecyLevel } from './secrecy-counts.mjs';
import { districtAttachmentVersionValid } from './task-districts.mjs';
import { shoggothDiscount, shoggothKeyword, shoggothAuraKeyword, coreRole } from './shoggoth-rules.mjs';
import { firstAbilitiesActive } from './green-black-rules.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
import { graveCards, graveZones, graveReferenceSource, referenceOwner } from './graveyard-rules.mjs';
import { progressive } from './plan-rules.mjs';
import { funeralSubtypes } from './death-deck-rules.mjs';
import { printedRulesCard, allAbilitiesLost } from './printed-rules.mjs';
import { lotusFreeCast, contingencyCastSource } from './casting-rules.mjs';
import { districtTraits } from './district-rules.mjs';
import { abilitiesSuppressed, cageRestricts } from './field-rules.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { hasCardType } from './card-types.mjs';
import { environmentKeywords, societySubtypes } from './environment-definitions.mjs';
import { sealedOn } from './sealing.mjs';
import { controllerOf, transferControl } from './ownership.mjs';
import { actionsOf, eligibleDiscount, discountAppliesToHost, batchSubtypeGrants, batchKeyword, roundKeywordEffectApplies } from './batch-rules.mjs';
export const currentSocietyName = (s, p) => s.societies?.[p]?.name ?? s.deckSelections?.[p]?.society?.name;
const liveField = (s, id) => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown;
export function publicActionAllowed(s, p, id, plan) { return !!plan.publicAction && (!plan.publicHiddenOnly || controllerOf(s, id) === p || effectiveSocietyMarkers(s, p).hidden > 0); }
export function mediatorActive(s, id) { const l = s.locations[id]; return false; }
export function anchorHiddenBonus(s, p) { const n = sealedCount(s, `society:${p}`, sealedOn(s, `society:${p}`).filter(id => matchesSpecifiedName(s.cards[id], '精神锚点'))); return n * s.players[p].play.filter(id => liveField(s, id) && printedRulesCard(s, id).automation?.static === 'anchor-hidden-bonus').length; }
export function undercoverHiddenPenalty(s, p) { return s.players[p].play.filter(id => liveField(s, id) && printedRulesCard(s, id).automation?.static === 'undercover').reduce(n => n - 3, 0); }
export function criminalHiddenBonus(s, p, id) {
    if (!hasCardType(s.cards[id], 'character') || !effectiveSubtypes(s, id).includes('罪犯'))
        return 0;
    const c = s.cards[id], n = (c.icons?.battle ?? 0) + (c.temporaryIcons?.battle ?? 0);
    return s.players[p].play.filter(a => liveField(s, a) && printedRulesCard(s, a).automation?.static === 'cage-hidden-bonus' && attachmentHostLegal(s, a)).length * n;
}
function controlsNamed(s, p, name) { return s.players[p].play.some(id => liveField(s, id) && hasCardType(s.cards[id], 'character') && matchesSpecifiedName(s.cards[id], name)); }
const seleneSubject = (s, id) => liveField(s, id) && ['character', 'attachment'].some(t => hasCardType(printedRulesCard(s, id), t));
export function seleneVeto(s) { return s.players.flatMap(p => p.play).some(id => false); }
export function effectiveActions(s, id) {
    if (abilitiesSuppressed(s, id) || cageRestricts(s, id) || seleneSubject(s, id) && s.locations[id].tapped && seleneVeto(s))
        return [];
    const actions = [...actionsOf(printedRulesCard(s, id))].filter(a => !a.requiresSourceSubtype || effectiveSubtypes(s, id).includes(a.requiresSourceSubtype)).filter(a => s.locations[id]?.faceDown ? !!a.allowHiddenSource : !a.sourceHiddenOnly).map(a => a.operation === 'legislator-state' ? { ...a, modes: a.modes.filter(m => m.id === (s.locations[id]?.tapped ? 'reset' : 'tap')) } : a);
    if (progressive(s, id) && !actions.some(a => false))
        actions.push({ timing: 'standard', cost: 1, target: 'none', effect: 'gray', operation: 'progress', amount: 1, abilityLabel: '推进1' });
    for (let i = 0; i < actions.length; i++)
        ;
    for (let i = 0; i < actions.length; i++)
        ;
    if (!liveField(s, id))
        return actions;
    for (let i = 0; i < actions.length; i++)
        if (actions[i].hostBattleWoundDiscount && attachmentHostLegal(s, id)) {
            const h = s.locations[id].attachedTo;
            actions[i] = { ...actions[i], cost: Math.max(0, actions[i].cost - (s.locations[h].wounds ?? 0) - effectiveIcons(s, h, false, true).battle) };
        }
    for (let i = 0; i < actions.length; i++)
        if (actions[i].criminalActionDiscount) {
            const p = controllerOf(s, id), d = s.locations[id].district, n = s.players[p].play.filter(a => liveField(s, a) && effectiveSubtypes(s, a).includes('罪犯') && (s.locations[a].district === d || s.locations[a].attachedTo === `society:${p}`)).length;
            actions[i] = { ...actions[i], cost: Math.max(0, actions[i].cost - n) };
        }
    for (const [aid, l] of Object.entries(s.locations))
        if (liveField(s, aid) && l.attachedTo === id && attachmentHostLegal(s, aid))
            for (const action of printedRulesCard(s, aid).attachment?.grantActions ?? [])
                actions.push({ ...action, grantedBy: aid, grantedByVersion: l.zoneVersion });
    return actions;
}
export function updateControl(s) {
    // Continuous control links retain their chronological layer when rechecked.
    // Their controller follows the attachment, while the card's owner is immutable.
    for (const [aid, l] of Object.entries(s.locations))
        if (liveField(s, aid) && printedRulesCard(s, aid).attachment?.controlHost && attachmentHostLegal(s, aid)) {
            const host = s.locations[l.attachedTo];
            if (!(s.effects ?? []).some(e => e.kind === 'control' && e.dynamicAttachment && e.sourceId === aid && e.sourceZoneVersion === l.zoneVersion && e.targetId === l.attachedTo && e.targetZoneVersion === host.zoneVersion)) {
                host.baseController = s.cards[l.attachedTo].owner;
                s.effects.push({ kind: 'control', dynamicAttachment: true, sourceId: aid, sourceZoneVersion: l.zoneVersion, targetId: l.attachedTo, targetZoneVersion: host.zoneVersion });
            }
        }
    const memo = new Map();
    function desiredController(id, seen = new Set()) {
        const l = s.locations[id];
        if (memo.has(id))
            return memo.get(id);
        if (l?.zone !== 'play' || seen.has(id) || cardHasKeyword(s, id, '永恒'))
            return controllerOf(s, id);
        const last = (s.effects ?? []).filter(e => e.kind === 'control' && e.targetId === id && e.targetZoneVersion === l.zoneVersion && (!e.sourceId || liveField(s, e.sourceId) && s.locations[e.sourceId].zoneVersion === e.sourceZoneVersion) && (!e.dynamicAttachment || attachmentHostLegal(s, e.sourceId))).at(-1);
        const nextSeen = new Set(seen);
        nextSeen.add(id);
        const p = last?.dynamicAttachment ? desiredController(last.sourceId, nextSeen) : last?.controller ?? l.baseController ?? controllerOf(s, id);
        memo.set(id, p);
        return p;
    }
    for (const id of Object.keys(s.cards))
        if (s.locations[id]?.zone === 'play') {
            const p = desiredController(id);
            if (p !== controllerOf(s, id))
                transferControl(s, id, p);
        }
}
export function takeControl(s, id, p, extra = {}) { const l = s.locations[id]; l.baseController ??= controllerOf(s, id); s.effects.push({ kind: 'control', targetId: id, targetZoneVersion: l.zoneVersion, controller: p, ...extra }); updateControl(s); }
export function effectiveSubtypes(s, id, { skipDomainDependent = false } = {}) {
    const c = printedRulesCard(s, id), l = s.locations[id];
    if (!c || !l)
        return [];
    let types = [...new Set([...(c.subtypes ?? []), ...(skipDomainDependent ? [] : funeralSubtypes(s, id)), ...societySubtypes(s, id), ...batchSubtypeGrants(s, id), ...(l.extraSubtypes ?? []), ...(s.effects ?? []).filter(e => e.kind === 'control' && e.targetId === id && e.targetZoneVersion === l.zoneVersion && e.extraSubtype && (!e.sourceId || liveField(s, e.sourceId) && s.locations[e.sourceId].zoneVersion === e.sourceZoneVersion)).map(e => e.extraSubtype)])];
    if (liveField(s, id))
        for (const [aid, a] of Object.entries(s.locations))
            if (liveField(s, aid) && a.attachedTo === id && a.hostVersion === l.zoneVersion) {
                types.push(...(printedRulesCard(s, aid).attachment?.grantSubtypes ?? []));
                ;
                const conversion = printedRulesCard(s, aid).attachment?.convertSubtype;
                if (conversion && types.includes(conversion.from))
                    types = [...types.filter(t => t !== conversion.from), conversion.to];
            }
    if (liveField(s, id) && hasCardType(c, 'character') && types.includes('人类') && s.players[controllerOf(s, id)].play.some(source => liveField(s, source) && printedRulesCard(s, source).automation?.static === 'human-hosts'))
        types.push('宿主');
    // The estate follows ownership across every zone, including reserve tokens.
    // A continuous change never rewrites the printed types used by 初拥.
    if (hasCardType(c, 'character') && s.players[c.owner]?.play.some(source => liveField(s, source) && printedRulesCard(s, source).automation?.static === 'estate-owned-vampires' && attachmentHostLegal(s, source))) {
        if (types.includes('人类'))
            types = [...types.filter(t => t !== '人类'), '吸血鬼'];
        else if (!types.includes('吸血鬼'))
            types.push('奴仆');
    }
    if (hasCardType(c, 'character'))
        for (const e of s.effects ?? [])
            if (e.kind === 'entropy-subtype' && s.cards[id].subtypes?.includes(e.subtype))
                types = [...types.filter(t => t !== e.subtype), '灾难'];
    return [...new Set(types)];
}
export function convertPrintedIconsToBattle(s, id) {
    if (!liveField(s, id) || !hasCardType(s.cards[id], 'character') || !effectiveSubtypes(s, id).includes('吸血鬼'))
        return false;
    return s.players[controllerOf(s, id)].play.some(source => liveField(s, source) && printedRulesCard(s, source).automation?.static === 'vampire-printed-to-battle' && attachmentHostLegal(s, source));
}
// Old room templates may contain the former compiler's duplicate unconditional
// 非资产 keyword. The explicit 暴露 condition also governs those saved cards.
export function cannotBuildAsset(s, p, c) {
    ;
    return !!(c.token || (c.conditionalKeywords?.exposed?.includes('非资产') ? effectiveSocietyMarkers(s, p).exposed > 0 : c.keywords?.includes('非资产')));
}
export function sacrificeEffectBlocked(s, id) { return cardHasKeyword(s, id, '永恒'); }
export function sacrificeCostBlocked(s, id) { return costSacrificeReserved(s, id) || seleneSubject(s, id) && !s.locations[id].secretPlan && effectiveMagicDomains(s, id).length > 0 && seleneVeto(s) || cardHasKeyword(s, id, '永恒') || Object.entries(s.locations).some(([aid, l]) => false); }
export function cardHasKeyword(s, id, k) { return effectiveKeyword(s, id, k); }
export function enterTapped(s, id, district = s.locations[id]?.district) {
    if (effectiveKeyword(s, id, '迟缓', true))
        return true;
    const p = controllerOf(s, id);
    return s.players.flatMap(pl => pl.play).some(source => (printedRulesCard(s, source).automation?.auras ?? []).some(a => a.grantKeywords?.includes('迟缓') && (!a.own || controllerOf(s, source) === p) && (!a.sameDistrict || s.locations[source].district === district) && s.locations[source].zone === 'play' && !s.locations[source].faceDown && (!a.filter?.type || hasCardType(s.cards[id], a.filter.type)) && (!a.filter?.magic || effectiveMagicDomains(s, id).includes(a.filter.magic))));
}
export function conditionalAttachmentKeywords(s, aid) { const grants = printedRulesCard(s, aid)?.attachment?.conditionalGrantKeywords ?? {}, p = controllerOf(s, aid), markers = effectiveSocietyMarkers(s, p); return [...(markers.hidden > 0 ? grants.hidden ?? [] : []), ...(markers.exposed > 0 ? grants.exposed ?? [] : [])]; }
export function attachmentBonus(s, id) {
    const out = {};
    for (const [aid, l] of Object.entries(s.locations)) {
        if (l.zone !== 'play' || l.faceDown || l.attachedTo !== id || l.hostVersion !== s.locations[id]?.zoneVersion)
            continue;
        ;
        for (const [k, n] of Object.entries(printedRulesCard(s, aid).attachment?.bonus ?? {}))
            out[k] = (out[k] ?? 0) + (n === true ? 1 : n);
        for (const [type, bonus] of Object.entries(printedRulesCard(s, aid).attachment?.hostBonusByType ?? {}))
            if (hasCardType(printedRulesCard(s, id), type))
                for (const [k, n] of Object.entries(bonus))
                    out[k] = (out[k] ?? 0) + n;
        ;
        if (printedRulesCard(s, aid).attachment?.static === 'spine-armor' && attachmentHostLegal(s, aid)) {
            const n = s.players[controllerOf(s, aid)].play.filter(a => { const al = s.locations[a]; return liveField(s, a) && hasCardType(printedRulesCard(s, a), 'attachment') && hasCardType(printedRulesCard(s, al.attachedTo), 'character') && attachmentHostLegal(s, a); }).length;
            for (const k of ['battle', 'influence', 'defense'])
                out[k] = (out[k] ?? 0) + n;
        }
        if (printedRulesCard(s, aid).attachment?.static === 'sixth-sense' && attachmentHostLegal(s, aid)) {
            const k = effectiveSubtypes(s, id).includes('宿主') ? 'investigation' : 'whiteInvestigation';
            out[k] = (out[k] ?? 0) + 1;
        }
    }
    return out;
}
export function barrierBlocked(s, id) {
    if (printedRulesCard(s, id)?.name !== '月华独角兽' && s.players.flatMap(p => p.play).some(source => s.locations[source]?.zone === 'play' && !s.locations[source].faceDown && printedRulesCard(s, source)?.automation?.static === 'deer-no-barrier'))
        return true;
    return (s.effects ?? []).some(e => e.kind === 'barrier-lock' && e.targetId === id && e.targetZoneVersion === s.locations[id]?.zoneVersion);
}
export function whiteIconsConverted(s, id) { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && hasCardType(s.cards[id], 'character') && cardHasKeyword(s, id, '灵体') && s.players.flatMap(p => p.play).some(source => { const sl = s.locations[source]; return sl.zone === 'play' && !sl.faceDown && sl.district === l.district && printedRulesCard(s, source).automation?.static === 'spirit-white-to-black' && attachmentHostLegal(s, source); }); }
export function hasBarrier(s, id) {
    if (allAbilitiesLost(s, id))
        return false;
    if (barrierBlocked(s, id))
        return false;
    const l = s.locations[id], effects = (s.effects ?? []).filter(e => e.targetId === id && e.targetZoneVersion === l?.zoneVersion);
    // A hidden character has no front-face printed abilities. Explicit grants to
    // this hidden object can still apply, and are lost when the object flips.
    if (l?.zone === 'play' && l.faceDown) {
        const layers = effects.filter(e => ['grant-keyword', 'remove-keyword'].includes(e.kind) && e.keyword === '屏障');
        return layers.at(-1)?.kind === 'grant-keyword' || effects.some(e => e.kind === 'barrier');
    }
    return cardHasKeyword(s, id, '屏障') || !!attachmentBonus(s, id).barrier || effects.some(e => e.kind === 'barrier');
}
export function playerHasBarrier(s, p) { return (s.effects ?? []).some(e => e.kind === 'player-barrier' && e.controller === p); }
export function graveyardLocked(s, source = graveReferenceSource(s, null), player = referenceOwner(s, source), zone) { const zones = zone ? [zone] : graveZones(s, player, source); return Object.entries(s.locations).some(([id, l]) => l.zone === 'play' && !l.faceDown && graveZones(s, player, id).some(z => zones.includes(z)) && printedRulesCard(s, id).automation?.static === 'graveyard-lock' && attachmentHostLegal(s, id)); }
export function attachmentHostLegal(s, aid) {
    const a = s.cards[aid], l = s.locations[aid], h = printedRulesCard(s, l?.attachedTo), hl = s.locations[l?.attachedTo];
    if (l?.pendingSecretHost || l?.pendingReattachment)
        return true;
    if (l?.secretPlan)
        return l.zone === 'play' && l.attachedTo === `society:${controllerOf(s, aid)}` && l.hostVersion === (s.societyVersions?.[controllerOf(s, aid)] ?? 0);
    ;
    ;
    if (a.attachment?.target === 'own-society')
        return l.zone === 'play' && l.attachedTo === `society:${controllerOf(s, aid)}` && l.hostVersion === (s.societyVersions?.[controllerOf(s, aid)] ?? 0);
    if (['district', 'city-district'].includes(a.attachment?.target))
        return l.zone === 'play' && districtAttachmentVersionValid(s.districts[l.district], l.hostVersion) && l.attachedTo === `district-host:${l.hostVersion}` && (a.attachment.target !== 'city-district' || districtTraits(s, l.district).includes('城市'));
    if (a.attachment?.target === 'own-hidden')
        return l.zone === 'play' && hl?.zone === 'play' && hl.faceDown && hl.zoneVersion === l.hostVersion && controllerOf(s, aid) === controllerOf(s, l.attachedTo);
    if (a.attachment?.target === 'attachment')
        return l.zone === 'play' && hl?.zone === 'play' && !hl.faceDown && !hl.secretPlan && hl.zoneVersion === l.hostVersion && hasCardType(h, 'attachment');
    if (a.attachment?.target === 'own-character-or-industry' && h && hl?.zone === 'play' && !hl.faceDown && hl.zoneVersion === l.hostVersion && controllerOf(s, aid) === controllerOf(s, l.attachedTo) && hasCardType(h, 'attachment') && h.subtitle === '圣甲虫产业')
        return true;
    if (!h || hl?.zone !== 'play' || hl.faceDown || !hasCardType(h, 'character') || hl.zoneVersion !== l.hostVersion)
        return false;
    const target = a.attachment?.target ?? a.automation?.attachedHostTarget;
    ;
    if (target === 'own-filtered-character' && (controllerOf(s, aid) !== controllerOf(s, l.attachedTo) || a.attachment.filter?.magic && !effectiveMagicDomains(s, l.attachedTo).includes(a.attachment.filter.magic) || a.attachment.filter?.anyDomain && !effectiveMagicDomains(s, l.attachedTo).length))
        return false;
    if (h.noAttachments || h.noEquipment && effectiveSubtypes(s, aid).includes('装备') || h.automation?.allowedAttachmentSubtypes && !effectiveSubtypes(s, aid).some(t => h.automation.allowedAttachmentSubtypes.includes(t)))
        return false;
    const sub = effectiveSubtypes(s, l.attachedTo);
    if (target === 'non-core-character' && coreRole(s, l.attachedTo))
        return false;
    if (target === 'own-human-character' && (!sub.includes('人类') || controllerOf(s, aid) !== controllerOf(s, l.attachedTo)))
        return false;
    if (target === 'city-district')
        return l.zone === 'play' && districtAttachmentVersionValid(s.districts[l.district], l.hostVersion) && districtTraits(s, l.district).includes('城市');
    if (target === 'ghost-or-death-character' && !sub.includes('阴魂') && !effectiveMagicDomains(s, l.attachedTo).includes('死亡'))
        return false;
    if (target === 'blood-or-death-character' && !effectiveMagicDomains(s, l.attachedTo).some(x => ['鲜血', '死亡'].includes(x)))
        return false;
    if (target === 'vampire-character' && !sub.includes('吸血鬼'))
        return false;
    if (target === 'human-or-vampire' && !sub.some(x => ['人类', '吸血鬼'].includes(x)))
        return false;
    if (target === 'printed-human-character' && !h.subtypes?.includes('人类'))
        return false;
    if (['human-character', 'own-society-or-human-character'].includes(target) && !sub.includes('人类'))
        return false;
    if (target === 'magic-character' && !effectiveMagicDomains(s, l.attachedTo).length)
        return false;
    if (['own-character', 'own-character-or-industry'].includes(target) && controllerOf(s, aid) !== controllerOf(s, l.attachedTo))
        return false;
    return true;
}
export function spiritPreventsDamage(s, id) {
    const c = printedRulesCard(s, id), l = s.locations[id];
    if (l?.zone !== 'play' || l.faceDown || !effectiveKeyword(s, id, '灵体'))
        return false;
    const counts = [0, 0];
    for (const [cid, cl] of Object.entries(s.locations))
        if (cl.zone === 'play' && !cl.faceDown && cl.district === l.district)
            counts[controllerOf(s, cid)] += effectiveMagicDomains(s, cid).length;
    const p = controllerOf(s, id);
    return counts[p] > counts[1 - p];
}
export function skipsResetStep(s, id) { const l = s.locations[id]; return l?.zone === 'play' && (l.faceDown || hasCardType(printedRulesCard(s, id), 'character')) && s.players.flatMap(p => p.play).some(source => { const sl = s.locations[source]; return sl?.zone === 'play' && !sl.faceDown && sl.district === l.district && printedRulesCard(s, source).automation?.static === 'district-skip-reset' && attachmentHostLegal(s, source); }); }
export function canReset(s, id) {
    if (!hasCardType(s.cards[id], 'character') || !sealedOn(s, id).length)
        return true;
    return !s.players.flatMap(p => p.play).some(source => s.locations[source]?.zone === 'play' && !s.locations[source].faceDown && controllerOf(s, source) !== controllerOf(s, id) && printedRulesCard(s, source).automation?.static === 'sealed-enemy-no-reset');
}
export function auraApplies(s, source, id, a) {
    const c = printedRulesCard(s, id), l = s.locations[id], sl = s.locations[source], p = controllerOf(s, source);
    if (!c || l?.zone !== 'play' || l.faceDown || sl?.zone !== 'play' || sl.faceDown)
        return false;
    if (a.own && controllerOf(s, id) !== p || a.otherOnly && source === id || a.sameDistrict && sl.district !== l.district)
        return false;
    const f = a.filter ?? {}, sub = effectiveSubtypes(s, id);
    if (f.type && !hasCardType(c, f.type) || f.subtypesAny && !f.subtypesAny.some(t => sub.includes(t)) || f.faction && c.faction?.split('·')[0] !== f.faction || f.keyword && !cardHasKeyword(s, id, f.keyword) || f.magic && !effectiveMagicDomains(s, id).includes(f.magic))
        return false;
    if (f.noPrintedDomain && c.magicDomains?.length || f.chosenSubtype && (!sl.chosenSubtype || !sub.includes(sl.chosenSubtype)))
        return false;
    if (a.condition === 'grave-seven' && graveCards(s, p, source).length < 7)
        return false;
    if (a.condition === 'mind-assets-two' && s.players[p].assets.filter(x => x.magicDomains?.includes('心灵')).length < 2)
        return false;
    if (a.attachmentName || a.attachmentSubtypesAny) {
        if (!Object.entries(s.locations).some(([aid, al]) => al.zone === 'play' && !al.faceDown && al.attachedTo === id && attachmentHostLegal(s, aid) && (a.attachmentName ? matchesSpecifiedName(s.cards[aid], a.attachmentName) : a.attachmentSubtypesAny.some(t => effectiveSubtypes(s, aid).includes(t)))))
            return false;
    }
    return true;
}
// Count each attachment once even when it has several matching subtypes.
// Scored cards that count as attachments contribute to counts, never costs.
export function controlledAttachmentCount(s, p, subtypes) { return s.players[p].play.filter(id => { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && !l.secretPlan && hasCardType(printedRulesCard(s, id), 'attachment') && effectiveSubtypes(s, id).some(t => subtypes.includes(t)); }).length + virtualAttachments(s, p).filter(c => c.subtypes.some(t => subtypes.includes(t))).length; }
export function castingDiscount(s, p, card, method = 'play', targets = []) {
    let reduction = (0) + (method === 'play' ? 0 : 0) + shoggothDiscount(s, p, card, method) + (method === 'play' && card.attachment?.castingDiscountHost && targets.some(t => effectiveSubtypes(s, t.cardId).includes(card.attachment.castingDiscountHost.subtype)) ? card.attachment.castingDiscountHost.amount : 0) + eligibleDiscount(s, p, card, method).filter(e => discountAppliesToHost(s, e, targets)).reduce((n, e) => n + e.amount, 0);
    const controlledDiscount = false;
    if (['play', 'reveal'].includes(method) && controlledDiscount)
        reduction += controlledAttachmentCount(s, p, controlledDiscount.subtypesAny) * controlledDiscount.amount;
    for (const id of s.players[p].play) {
        const l = s.locations[id], a = printedRulesCard(s, id).automation;
        if (l?.zone !== 'play' || l.faceDown)
            continue;
        const discount = a?.castingDiscount;
        if (a?.static === 'dreamwalker-discount' && card.faction?.split('·')[0] === '紫')
            reduction++;
        if (method === 'play' && discount && (!discount.societyName || currentSocietyName(s, p) === discount.societyName) && effectiveSubtypes(s, card.id).includes(discount.subtype) && (!discount.untapped || !l.tapped) && (!discount.chosenMagic || effectiveMagicDomains(s, card.id).includes(l.chosenMagicDomain)) && (!discount.attachmentLegal || attachmentHostLegal(s, id)))
            reduction += discount.amount;
        if (method === 'reveal' && a?.static === 'reveal-discount')
            reduction++;
        if (method === 'reveal' && a?.static === 'vampire-secrecy-reveal-discount' && effectiveSubtypes(s, card.id).includes('吸血鬼'))
            reduction += effectiveSocietyMarkers(s, p).hidden;
        if (method === 'play' && hasCardType(card, 'attachment') && (card.subtypes?.includes('设施') || card.subtitle === '圣甲虫产业') && a?.static === 'industry-casting-discount')
            reduction++;
        if (method === 'play' && card.subtypes?.includes('装备') && s.equipmentPlayed?.[p] !== s.round && a?.static === 'first-equipment-discount')
            reduction++;
    }
    ;
    ;
    if (method === 'reveal' && hasCardType(card, 'character') && effectiveSubtypes(s, card.id).includes('罪犯')) {
        const n = s.players[p].play.filter(id => liveField(s, id) && hasCardType(printedRulesCard(s, id), 'character') && printedRulesCard(s, id).unique && effectiveSubtypes(s, id).includes('罪犯')).length;
        reduction += n * s.players[p].play.filter(id => false).length;
    }
    if (card.automation?.eyeCastingDiscount)
        reduction += s.players[1 - p].play.filter(x => s.locations[x]?.zone === 'play' && !s.locations[x].faceDown && hasCardType(printedRulesCard(s, x), 'character') && effectiveIcons(s, x, true).investigation > 0).length;
    if (method === 'play' && card.spell?.secrecyCostDiscount)
        reduction += effectiveSocietyMarkers(s, p).hidden;
    const destroyedDiscount = (card.spell ?? card.automation)?.destroyedPlayDiscount;
    if (method === 'play' && destroyedDiscount)
        reduction += s.districts.filter(d => d?.destroyed).length * destroyedDiscount;
    if (card.automation?.namedCastingDiscount && controlsNamed(s, p, card.automation.namedCastingDiscount.name))
        reduction += card.automation.namedCastingDiscount.amount;
    if (card.automation?.societySealedDiscount)
        reduction += sealedCount(s, `society:${p}`);
    if (['play', 'reveal'].includes(method) && printedRulesCard(s, card.id)?.automation?.enemyExposureDiscount)
        reduction += effectiveSocietyMarkers(s, 1 - p).exposed * printedRulesCard(s, card.id).automation.enemyExposureDiscount;
    ;
    return reduction + firstLargeCastDiscount(s, p, card) + firstSubtitleCastDiscount(s, p, card);
}
// Select X before reductions; only the final payable total has a minimum of 0.
export function castingCost(s, p, card, method = 'play', targets = [], chosenX = 0, additionalReduction = 0) {
    if (method === 'play' && lotusFreeCast(s, p, card))
        return 0;
    return Math.max(0, card.printedCost + chosenX + (method === 'play' && contingencyCastSource(s, p, card) ? 1 : 0) - castingDiscount(s, p, card, method, targets) - additionalReduction);
}
// Grants to cards an owner possesses also apply in hand, library, graveyard,
// and sealed zones. Their controller may differ from their immutable owner.
export function ownedKeywordSources(s, id, k) {
    const c = s.cards[id], l = s.locations[id];
    if (!c || l?.zone === 'play' && (l.faceDown || l.secretPlan))
        return [];
    return s.players.flatMap(pl => pl.play).filter(source => liveField(s, source) && !s.locations[source].secretPlan && !abilitiesSuppressed(s, source) && controllerOf(s, source) === c.owner && (!hasCardType(s.cards[source], 'attachment') || attachmentHostLegal(s, source)) && (printedRulesCard(s, source).automation?.ownedKeywords ?? []).some(g => g.keyword === k && g.subtypesAny.some(t => effectiveSubtypes(s, id).includes(t))));
}
export function effectiveKeyword(s, id, k, ignoreHiddenSlow = false) {
    ;
    if (allAbilitiesLost(s, id))
        return false;
    if (k === '声望' && reputationSuppressedSources(s, id).length)
        return false;
    if (shoggothKeyword(s, id, k) || shoggothAuraKeyword(s, id, k))
        return true;
    if (k === '迟缓' && printedRulesCard(s, id)?.automation?.static === 'hidden-removes-slow' && effectiveSocietyMarkers(s, controllerOf(s, id)).hidden > 0)
        return false;
    if (k === '屏障' && barrierBlocked(s, id))
        return false;
    const c = printedRulesCard(s, id), l = s.locations[id];
    if (!c || !l)
        return false;
    if (k === '领袖' && l.zone === 'play' && !l.faceDown && hasCardType(c, 'character') && effectiveSubtypes(s, id).includes('仙灵') && sealedOn(s, `society:${controllerOf(s, id)}`).some(sid => false))
        return false;
    if (liveField(s, id) && c.automation?.static === 'titania-king' && controlsNamed(s, controllerOf(s, id), '仙王奥伯龙')) {
        if (k === '领袖')
            return false;
        if (k === '屏障')
            return true;
    }
    const layers = (s.effects ?? []).filter(e => (['grant-keyword', 'remove-keyword'].includes(e.kind) && e.keyword === k && e.targetId === id && e.targetZoneVersion === l.zoneVersion) || (e.keywords?.includes(k) && roundKeywordEffectApplies(s, id, e)));
    if (layers.length)
        return layers.at(-1).kind !== 'remove-keyword';
    ;
    if (statusKeywordSources(s, id, k).length || markedRoundKeyword(s, id, k))
        return true;
    if (!ignoreHiddenSlow && k === '迟缓' && hiddenSlowSources(s, id).length)
        return true;
    if (c.automation?.dreamContextKeywords?.includes(k) && dreamContext(s, id))
        return true;
    const p = controllerOf(s, id), conditional = c.conditionalKeywords ?? {}, districtGranted = l.zone === 'play' && !l.faceDown && (conditional.district ?? []).some(g => g.keyword === k && g.traitsAny.some(t => districtTraits(s, l.district).includes(t)));
    if (c.keywords?.includes(k) && !(k === '非资产' && conditional.exposed?.includes(k)) || environmentKeywords(s, id).includes(k) || ownedKeywordSources(s, id, k).length > 0 || districtGranted || conditional.exposed?.includes(k) && effectiveSocietyMarkers(s, p).exposed > 0 || conditional.hidden?.includes(k) && effectiveSocietyMarkers(s, p).hidden > 0 || conditional.first?.includes(k) && firstAbilitiesActive(s, p))
        return true;
    if (k === '屏障' && (l.zone === 'asset' || l.zone === 'play' && !l.faceDown && hasCardType(c, 'attachment')) && s.players[p].play.some(source => s.locations[source]?.zone === 'play' && !s.locations[source].faceDown && !abilitiesSuppressed(s, source) && printedRulesCard(s, source).automation?.scarabStatic === 'attachment-asset-barrier'))
        return true;
    if (l.zone !== 'play' || l.faceDown)
        return false;
    if (k === '威名' && mediatorActive(s, id))
        return true;
    if (batchKeyword(s, id, k))
        return true;
    for (const [aid, al] of Object.entries(s.locations))
        if (al.zone === 'play' && !al.faceDown && al.attachedTo === id && [...(printedRulesCard(s, aid).attachment?.grantKeywords ?? []), ...conditionalAttachmentKeywords(s, aid)].includes(k) && attachmentHostLegal(s, aid))
            return true;
    for (const source of s.players.flatMap(pl => pl.play))
        for (const a of printedRulesCard(s, source).automation?.auras ?? [])
            if (a.grantKeywords?.includes(k) && auraApplies(s, source, id, a))
                return true;
    if (c.automation?.static === 'guide-conditional-keywords' && hasCardType(c, 'character')) {
        const types = k === '屏障' ? ['人工智能'] : k === '机动' ? ['机械', '魔像'] : [];
        if (types.length && s.players[p].play.some(other => s.locations[other]?.zone === 'play' && !s.locations[other].faceDown && hasCardType(s.cards[other], 'character') && types.some(t => effectiveSubtypes(s, other).includes(t))))
            return true;
    }
    if (k === '屏障' && hasCardType(c, 'character') && effectiveKeyword(s, id, '声望'))
        return s.players[p].play.some(source => s.locations[source]?.zone === 'play' && !s.locations[source].faceDown && printedRulesCard(s, source).automation?.static === 'reputation-defense-barrier');
    return false;
}
export function keywordAmount(s, id, prefix) {
    if (allAbilitiesLost(s, id))
        return 0;
    if (['袭击', '创伤袭击', '护盾', '创伤'].includes(prefix))
        return additiveAssaultAmount(s, id, prefix);
    if (prefix === '杀伤') {
        const l = s.locations[id];
        if (l?.zone !== 'play' || l.faceDown)
            return 0;
        const layers = (s.effects ?? []).filter(e => ['grant-keyword', 'remove-keyword'].includes(e.kind) && e.targetId === id && e.targetZoneVersion === l.zoneVersion && /^杀伤\d+$/.test(e.keyword));
        const base = { ...s, effects: (s.effects ?? []).filter(e => !layers.includes(e)) };
        let n = keywordBaseAmount(base, id, prefix);
        const values = new Map();
        for (const e of layers) {
            if (!values.has(e.keyword))
                values.set(e.keyword, cardHasKeyword(base, id, e.keyword) ? Number(e.keyword.slice(prefix.length)) : 0);
            values.set(e.keyword, e.kind === 'remove-keyword' ? 0 : values.get(e.keyword) + Number(e.keyword.slice(prefix.length)));
        }
        for (const [key, value] of values)
            n += value - (cardHasKeyword(base, id, key) ? Number(key.slice(prefix.length)) : 0);
        return n;
    }
    return keywordBaseAmount(s, id, prefix);
}
function keywordBaseAmount(s, id, prefix) {
    const c = printedRulesCard(s, id), keys = new Set([...environmentKeywords(s, id), ...(c.keywords ?? []), ...(c.conditionalKeywords?.first ?? []), ...(c.conditionalKeywords?.hidden ?? []), ...(c.conditionalKeywords?.exposed ?? []), ...(s.effects ?? []).filter(e => e.kind === 'grant-keyword' && e.targetId === id && e.targetZoneVersion === s.locations[id]?.zoneVersion).map(e => e.keyword)]);
    for (const [a, l] of Object.entries(s.locations))
        if (l.zone === 'play' && !l.faceDown && l.attachedTo === id && attachmentHostLegal(s, a))
            for (const k of [...(printedRulesCard(s, a).attachment?.grantKeywords ?? []), ...conditionalAttachmentKeywords(s, a)])
                keys.add(k);
    for (const source of s.players.flatMap(p => p.play))
        for (const a of printedRulesCard(s, source).automation?.auras ?? [])
            if (auraApplies(s, source, id, a))
                for (const k of a.grantKeywords ?? [])
                    keys.add(k);
    if (prefix === '创伤' && batchKeyword(s, id, '创伤3'))
        keys.add('创伤3');
    if (prefix === '杀伤' && batchKeyword(s, id, '杀伤1'))
        keys.add('杀伤1');
    return [...keys].reduce((n, k) => k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length)) && cardHasKeyword(s, id, k) ? n + Number(k.slice(prefix.length)) : n, 0);
}
// Separate grants of the same numeric assault ability add together. Exact-key
// removal clears earlier grants; later grants can add the ability again.
function additiveAssaultAmount(s, id, prefix) {
    const c = printedRulesCard(s, id), l = s.locations[id];
    if (!c || l?.zone !== 'play' || l.faceDown)
        return 0;
    const values = new Map(), add = k => {
        if (k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length)))
            values.set(k, (values.get(k) ?? 0) + Number(k.slice(prefix.length)));
    };
    for (const k of c.keywords ?? [])
        add(k);
    for (const k of environmentKeywords(s, id))
        add(k);
    if (prefix === '创伤' && batchKeyword(s, id, '创伤3'))
        add('创伤3');
    const conditional = c.conditionalKeywords ?? {}, p = controllerOf(s, id);
    if (firstAbilitiesActive(s, p))
        for (const k of conditional.first ?? [])
            add(k);
    if (effectiveSocietyMarkers(s, p).hidden > 0)
        for (const k of conditional.hidden ?? [])
            add(k);
    if (effectiveSocietyMarkers(s, p).exposed > 0)
        for (const k of conditional.exposed ?? [])
            add(k);
    for (const g of conditional.district ?? [])
        if (g.traitsAny.some(t => districtTraits(s, l.district).includes(t)))
            add(g.keyword);
    for (const [aid, al] of Object.entries(s.locations))
        if (al.zone === 'play' && !al.faceDown && al.attachedTo === id && attachmentHostLegal(s, aid))
            for (const k of [...(printedRulesCard(s, aid).attachment?.grantKeywords ?? []), ...conditionalAttachmentKeywords(s, aid)])
                add(k);
    for (const source of s.players.flatMap(p => p.play))
        for (const a of printedRulesCard(s, source).automation?.auras ?? [])
            if (auraApplies(s, source, id, a))
                for (const k of a.grantKeywords ?? [])
                    add(k);
    for (const e of s.effects ?? [])
        if (e.targetId === id && e.targetZoneVersion === l.zoneVersion) {
            if (e.kind === 'remove-keyword')
                values.set(e.keyword, 0);
            else if (e.kind === 'grant-keyword')
                add(e.keyword);
        }
    return [...values.values()].reduce((n, v) => n + v, 0);
}
