import { hasCardType } from './card-types.mjs';
import { matchesCardNameFilter } from './card-names.mjs';
// Evaluate executable plans, never card names or descriptive/FAQ text. Enemy
// hand identities are available only when the caller supplies the hard view.
const sourceExits = new Set(['conceal-source', 'blink-source', 'source-blink', 'return-source-hand']);
const sourceExitOperations = new Set(['self-conceal', 'conceal-source-rest', 'hugo-return']);
const targetExits = new Set(['conceal', 'blink', 'bounce', 'return-hand', 'shuffle-owner', 'bottom-owner', 'bottom', 'seal', 'destroy']);
const targetExitOperations = new Set(['blink', 'professor-return']);
const keyword = (c, k, h) => h.keyword?.(c, k) ?? c.keywordStates?.find(x => x.keyword === k)?.present ?? c.keywords?.includes(k) ?? false;
const mana = p => (p.costPool ?? 0) + (p.assets ?? []).filter(a => !a.tapped).length;
function matches(c, f = {}) {
    return (!f.any || f.any.some(x => matches(c, x))) && (!f.all || f.all.every(x => matches(c, x))) && (!f.type || hasCardType(c, f.type)) && (!f.typesAny || f.typesAny.some(t => hasCardType(c, t))) &&
        (!f.faction || c.faction?.split('·')[0] === f.faction) && (!f.magic || (c.effectiveMagicDomains ?? c.magicDomains)?.includes(f.magic)) &&
        (!f.requireSubtype || c.subtypes?.includes(f.requireSubtype)) && (!f.subtypesAny || f.subtypesAny.some(t => c.subtypes?.includes(t))) &&
        (!f.excludeSubtype || !c.subtypes?.includes(f.excludeSubtype)) && (!f.unique || !!c.unique) && matchesCardNameFilter(c, f) &&
        (f.minCost === undefined || c.printedCost >= f.minCost) && (f.maxCost === undefined || c.printedCost <= f.maxCost);
}
function sacrificeOptions(v, source, plan, h) {
    const f = plan.sacrificeCharacters ?? {}, p = v.players[source.controller], types = f.types ?? ['character'];
    return [...p.play, ...p.assets ?? []].filter(c => !c.faceDown && !keyword(c, '永恒', h) && (!f.otherOnly || c.id !== source.id) && types.some(t => t === 'asset' ? p.assets?.some(x => x.id === c.id) : hasCardType(c, t)) && matches(c, f.filter));
}
function targetsHost(plan, source, host) {
    const t = plan.target;
    if (!t || t === 'none')
        return false;
    if (!['character', 'own-character', 'own-filtered-character', 'filtered-character', 'district-character', 'district-other-character', 'own-other-district-character', 'district-filtered-character'].includes(t))
        return false;
    if (t.startsWith('own-') && source.controller !== host.controller)
        return false;
    if ((t.includes('other') || plan.otherTarget) && source.id === host.id)
        return false;
    if (t.includes('district') && source.district !== host.district)
        return false;
    if (source.controller !== host.controller && host.barrierNow)
        return false;
    return matches(host, plan.filterTarget ?? plan.filter);
}
function leavesHost(v, plan, source, host, h) {
    if (!plan)
        return false;
    if (source.id === host.id && (plan.sacrificeSelf || plan.concealSelfCost || plan.scoreSelfCost || sourceExits.has(plan.effect) || sourceExitOperations.has(plan.operation)))
        return true;
    if (source.controller === host.controller && (plan.sacrificeCharacter || plan.sacrificeCharacters) && sacrificeOptions(v, source, plan, h).some(c => c.id === host.id))
        return true;
    if ((targetExits.has(plan.effect) || targetExitOperations.has(plan.operation)) && targetsHost(plan, source, host))
        return true;
    return (plan.steps ?? []).some(p => leavesHost(v, { ...p, target: p.target ?? plan.target }, source, host, h)) || (plan.ops ?? []).some(p => leavesHost(v, p, source, host, h));
}
function paymentConfidence(v, source, plan, h) {
    const p = v.players[source.controller], cards = p.play.filter(c => !c.faceDown), amount = Number(plan.cost) || 0;
    if (plan.used || amount > mana(p) || plan.tap && (source.tapped || source.cannotTap) || plan.honorCost > (p.honor ?? 0))
        return 0;
    if ((plan.sacrificeSelf || plan.concealSelfCost || plan.scoreSelfCost) && keyword(source, '永恒', h))
        return 0;
    if (plan.sourceTimeCost > (source.markers ?? 0) || plan.sourceProgressCost > (source.counters?.progress ?? 0))
        return 0;
    if (plan.societyMarkerCost && !(p.markers?.[plan.societyMarkerCost] > 0))
        return 0;
    if (plan.counterCost) {
        const f = plan.counterCost, n = f.timeMarkers ? source.markers ?? 0 : source.counters?.[f.key] ?? 0;
        if (n < (f.min ?? 1))
            return 0;
    }
    const timeCards = source.controller === v.seat && v.timeCostCards ? v.timeCostCards : [...cards, ...p.assets ?? [], v.societies?.[source.controller] ?? {}];
    if (plan.timeCostX && timeCards.filter(c => !plan.timeCostTypes || plan.timeCostTypes.some(t => hasCardType(c, t))).reduce((n, c) => n + (c.markers ?? 0), 0) < (plan.timeCost ?? 1))
        return 0;
    if (plan.societyShuffleCost && !(v.sealed ?? []).some(c => c.hostId === `society:${source.controller}` && !c.faceDown && matches(c, plan.societyShuffleCost)))
        return 0;
    if (plan.sealedBottomCost && !(v.sealed ?? []).some(c => c.hostId === source.id && matches(c, plan.sealedBottomCost.filter)))
        return 0;
    if (plan.sacrificeAsset && !p.assets?.length)
        return 0;
    if (plan.sacrificeAttached && !cards.some(c => c.attachedTo && hasCardType(c, 'attachment') && !keyword(c, '永恒', h)))
        return 0;
    if (plan.sacrificeCharacter && !cards.some(c => hasCardType(c, 'character') && !keyword(c, '永恒', h)))
        return 0;
    if (plan.sacrificeCharacters && sacrificeOptions(v, source, plan, h).length < (plan.sacrificeCharacters.count ?? 1))
        return 0;
    if (plan.target === 'own-hidden' && !p.play.some(c => c.faceDown))
        return 0;
    if (plan.tapCharacters && cards.filter(c => hasCardType(c, 'character') && !c.tapped && !c.cannotTap && matches(c, plan.tapCharacters.filter)).length < (plan.tapCharacters.count ?? 1))
        return 0;
    let confidence = 1;
    if (plan.discardCost) {
        const count = p.handCount ?? p.hand?.length ?? 0;
        if (count < plan.discardCost)
            return 0;
        if ((p.hand ?? []).length === count) {
            if (p.hand.filter(c => matches(c, plan.discardFilter)).length < plan.discardCost)
                return 0;
        }
        else if (plan.discardFilter)
            confidence *= 0.45;
    }
    // Paying several resources to dodge a rumor is possible but less likely
    // than sacrificing a disposable source or returning it for no mana.
    return confidence * (amount >= 3 ? 0.72 : plan.discardCost || plan.honorCost ? 0.82 : 0.95);
}
export function rumorEscape(v, host, h = {}) {
    if (keyword(host, '永恒', h))
        return { risk: 0, cost: 0 };
    const player = v.players[host.controller];
    let best = { risk: 0, cost: 0 };
    for (const candidate of [...player.play, ...player.assets ?? []]) {
        const source = candidate.id === host.id ? host : candidate;
        if (source.faceDown || source.printedTextBlank || source.abilitiesSuppressed)
            continue;
        for (const action of source.availableActions ?? []) {
            if (action.timing !== 'fast')
                continue;
            const modes = action.modeTargets ? Object.values(action.modeTargets).map(p => ({ ...action, ...p, modeTargets: null })) : [action];
            for (const plan of modes) {
                if (!leavesHost(v, plan, source, host, h))
                    continue;
                const confidence = paymentConfidence(v, source, plan, h);
                if (confidence > best.risk)
                    best = { risk: confidence, cost: (Number(plan.cost) || 0) + (plan.discardCost ?? 0) + (plan.honorCost ?? 0) * 0.5, sourceId: source.id };
            }
        }
    }
    return best;
}
export function rumorHostAssessment(v, host, h = {}) {
    const own = host.controller === v.seat, escape = rumorEscape(v, host, h), eternal = keyword(host, '永恒', h), region = v.districts?.[host.district];
    let recovery = 0, reason = 'later';
    const pending = (v.flow?.stack ?? []).some(a => {
        const target = a.targetIds?.includes(host.id) || a.targets?.some(t => t.cardId === host.id), e = a.responseEffect ?? {};
        return e.sourceDeparture && (e.sourceDepartureId ?? a.cardId) === host.id || target && (e.removesTargets || e.damage && !host.battleDamagePrevented && (e.damageAmount ?? 0) >= (host.effectiveDefense ?? host.defense ?? 1) - (host.damage ?? 0));
    });
    if (!eternal && pending) {
        recovery = 1;
        reason = 'queued-departure';
    }
    if (!eternal && region && (region.pendingWinner !== null && region.pendingWinner !== undefined)) {
        recovery = 1;
        reason = 'locked-claim';
    }
    if (!eternal && !host.battleDamagePrevented && h.contestPending?.(v, host.district, 'battle')) {
        const loss = (h.total?.(v, 1 - host.controller, host.district, 'battle') ?? 0) - (h.total?.(v, host.controller, host.district, 'battle') ?? 0);
        if (loss > 0 && loss >= (host.effectiveDefense ?? host.defense ?? 1) - (host.damage ?? 0) && recovery < 0.75) {
            recovery = 0.75;
            reason = 'battle';
        }
    }
    if (!eternal && region && h.contestPending?.(v, host.district, 'influence')) {
        for (const p of [0, 1])
            if ((region.influence?.[p] ?? 0) + (h.total?.(v, p, host.district, 'influence') ?? 0) - (h.total?.(v, 1 - p, host.district, 'influence') ?? 0) >= (region.threshold ?? Infinity) && recovery < 0.7) {
                recovery = 0.7;
                reason = 'claim';
            }
    }
    if (own && escape.risk > 0 && recovery < 0.65) {
        recovery = 0.65;
        reason = 'controlled-departure';
    }
    // A seal on a stable friendly host is safe but may lock away a needed
    // rumor. An opponent's payable response can invalidate it before sealing.
    const failureRisk = own ? 0 : escape.risk;
    const score = 20 + (own ? 10 : 0) + recovery * 42 - failureRisk * 95 - (own && reason === 'controlled-departure' ? escape.cost * 3 : 0);
    return { score, recovery, failureRisk, reason, escape };
}
export function rumorHosts(v, h = {}, bonus = () => 0) {
    return v.players.flatMap(p => p.play).filter(c => !c.faceDown && hasCardType(c, 'character') && (c.controller === v.seat || !c.barrierNow)).map(c => ({ card: c, ...rumorHostAssessment(v, c, h) })).map(x => ({ ...x, score: x.score + bonus(x.card, x) })).sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));
}
export function rumorTriggerChoices(v, a, h = {}, bonus) {
    const base = { type: 'trigger-choice', triggerId: a.id }, hosts = rumorHosts(v, h, bonus);
    return hosts.filter(x => x.score > 0).map(x => ({ ...base, fire: true, targetId: x.card.id })).concat({ ...base, fire: false });
}
