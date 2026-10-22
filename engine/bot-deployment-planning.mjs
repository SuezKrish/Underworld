import { greenEmployeeSetup } from './green-black-tactics.mjs';
import { hasCardType } from './card-types.mjs';
const domains = { 心: '心灵', 圣: '神圣', 星: '星辰', 死: '死亡', 血: '鲜血' };
const isAsset = c => !c.nonAssetNow;
function sourceCount(v, symbol) { const m = v.players[v.seat]; return domains[symbol] ? m.loyalty?.domains?.[domains[symbol]] ?? 0 : m.loyalty?.factions?.[symbol] ?? 0; }
function supplies(c, symbol) { return domains[symbol] ? c.magicDomains?.includes(domains[symbol]) : (c.factionColors ?? [c.faction?.split('·')[0]]).includes(symbol); }
function missingLoyalty(v, c) {
    const m = v.players[v.seat];
    if (m.ignoreLoyalty)
        return 0;
    const needs = Object.entries(c.loyalty ?? {}).filter(([k]) => k !== '核' && !(k === '紫' && v.societies?.[v.seat]?.plan?.ignorePurpleLoyalty));
    return Math.max(0, ...needs.map(([k, n]) => n - sourceCount(v, k)), needs.filter(([k]) => !domains[k]).reduce((n, [k, need]) => n + Math.max(0, need - sourceCount(v, k)), 0));
}
function refillCount(plan) {
    if (!plan)
        return 0;
    return (['draw', 'bottom-to-hand'].includes(plan.effect) ? plan.count ?? 1 : 0) + (plan.steps ?? []).reduce((n, x) => n + refillCount(x), 0);
}
function imminentRefill(v, h) {
    let n = (v.flow?.stack ?? []).filter(a => a.controller === v.seat).reduce((n, a) => n + (a.responseEffect?.handGain ?? refillCount(a.plan)), 0);
    for (let d = 0; d < v.districts.length; d++)
        if (v.districts[d] && h.contestPending(v, d, 'investigation') && h.total(v, v.seat, d, 'investigation') > h.total(v, 1 - v.seat, d, 'investigation'))
            n++;
    return Math.min(n, Math.max(0, (v.players[v.seat].deckCount ?? 50) - h.drawReserve(v)));
}
function refillAbility(v, c, h) {
    if (refillCount(c.automation?.reveal) > 0)
        return true;
    return (c.automation?.actions ?? (c.automation?.action ? [c.automation.action] : [])).some(a => refillCount(a) > 0 || a.effect === 'search-filtered' && a.filter?.name && h.libraryHasName(v, a.filter.name));
}
// A concealed card can no longer be an asset or a hand resource. Evaluate this
// before deck-specific scores, including high-priority engine deployments.
// Future normal draws are not assumed to solve mana, loyalty or a thin hand.
export function secretDeploymentAssessment(v, c, d, h, { ambush = false } = {}) {
    if (!hasCardType(c, 'character') || !v.districts[d])
        return { allowed: false, penalty: 0, wait: Infinity };
    const m = v.players[v.seat], remaining = m.hand.filter(x => x.id !== c.id), assets = remaining.filter(isAsset), entry = h.secretDeploymentPrice(v, d), available = h.pool(v), a = c.automation ?? {};
    if (entry > available || m.actionsUsed.secret || m.secretDeploymentBlocked || c.publicNow)
        return { allowed: false, penalty: 0, wait: Infinity };
    const price = v.deploymentRevealCosts?.[c.id] ?? v.revealCosts?.[c.id] ?? h.cost(c), loyaltyWait = missingLoyalty(v, c);
    let wait = a.noPaidReveal ? Infinity : Math.max(loyaltyWait, price <= available - entry && h.loyalty(v, c) ? 0 : Math.max(1, price - m.assets.length));
    const society = v.societies?.[v.seat], mother = society?.actions?.find(a => a.ops?.some(o => o.kind === 'mother-play'));
    if (mother && h.loyalty(v, c))
        wait = Math.min(wait, Math.max(mother.used ? 1 : 0, h.cost(c) - (society.counters?.revival ?? 0)));
    const r = v.districts[d], ours = h.total(v, v.seat, d, 'influence'), theirs = h.total(v, 1 - v.seat, d, 'influence');
    const net = (r.influence[v.seat] ?? 0) + ours + 1 - theirs - (r.influence[1 - v.seat] ?? 0);
    const winningClaim = h.contestPending(v, d, 'influence') && net >= r.threshold && net - 1 < r.threshold && (m.score ?? 0) + Math.max(0, (r.points ?? 0) - (r.destroyed ?? 0)) >= (m.victoryThreshold ?? 8);
    if (winningClaim)
        return { allowed: true, penalty: 0, wait, revealBenefit: !!a.reveal };
    // A claim before the card can reveal sends the investment to the bottom.
    if (wait > 0 && h.contestPending(v, d, 'influence') && Math.abs(net) >= r.threshold)
        return { allowed: false, penalty: 0, wait };
    const thin = m.hand.length <= 3, refill = imminentRefill(v, h), canAsset = isAsset(c);
    const neededSource = canAsset && !m.ignoreLoyalty && remaining.some(x => Object.entries(x.loyalty ?? {}).some(([k, n]) => k !== '核' && !(k === '紫' && v.societies?.[v.seat]?.plan?.ignorePurpleLoyalty) && sourceCount(v, k) < n && supplies(c, k) && !assets.some(y => y.id !== x.id && supplies(y, k))));
    const assetReserve = m.assets.length < 5 ? Math.max(1, Math.min(2, wait + Number(!m.actionsUsed.asset))) : 0;
    const assetRisk = canAsset && (neededSource || assets.length < assetReserve);
    // Even a full opening hand should not commit a five-mana card four turns
    // early. Stage it near its actual reveal turn instead.
    if (wait > 2 || wait >= 2 && (thin || assets.length < 2))
        return { allowed: false, penalty: 0, wait };
    if (wait > 0 && thin && neededSource || wait > 0 && m.hand.length <= 2 && assetRisk && refill < 2)
        return { allowed: false, penalty: 0, wait };
    const up = h.faceUp(v, c), revealBenefit = !!a.reveal || h.keyword(up, '袭击') || h.keyword(up, '创伤袭击'), danger = h.lethalBattleRisk(v, up, d);
    const entryTiming = v.turn.firstPlayer === v.seat && a.entry?.operation === 'hidden-start' && wait === 0;
    const hiddenValue = greenEmployeeSetup(v, c, h, d) || revealBenefit || ambush || entryTiming || danger || c.concealedOnlyNow || h.keyword(up, '声望') && Object.values(up.effectiveIcons ?? up.icons ?? {}).every(n => !n);
    const normalPrice = v.castingCosts?.[c.id] ?? h.cost(c), canPlay = !c.concealedOnlyNow && h.loyalty(v, c) && normalPrice <= available;
    // Bodies and continuous effects gain nothing from an unnecessary extra
    // payment and delayed activation when safe face-up play is already possible.
    if (canPlay && !hiddenValue)
        return { allowed: false, penalty: 0, wait, revealBenefit };
    if (thin && !hiddenValue && wait > 0 || m.hand.length === 1 && assetRisk && !hiddenValue && !refillAbility(v, c, h))
        return { allowed: false, penalty: 0, wait, revealBenefit };
    const penalty = wait * 12 + (thin ? Math.max(0, 4 - m.hand.length) * 6 : 0) + (assetRisk ? wait ? 18 : 6 : 0) + (!hiddenValue ? 12 : 0) - Math.min(12, refill * 4);
    return { allowed: true, penalty: Math.max(0, penalty), wait, revealBenefit };
}
