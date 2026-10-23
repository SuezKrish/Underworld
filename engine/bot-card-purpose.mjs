import { rumorHosts } from './bot-rumor-planning.mjs';
import { hasCardType } from './card-types.mjs';
import { redPurpleAssetReserve } from './red-purple-bot-policy.mjs';
const mine = v => v.players[v.seat];
const grave = v => [...mine(v).graveyard, ...mine(v).headquarters ?? []];
const domains = { 心: '心灵', 圣: '神圣', 星: '星辰', 死: '死亡', 血: '鲜血' };
const usableAsset = c => !c.nonAssetNow && !c.keywords?.includes('非资产');
const mana = v => (mine(v).costPool ?? 0) + mine(v).assets.filter(c => !c.tapped).length;
// Hand/discard value is not the cost of losing a combo piece permanently to
// the asset zone. All three monsters are fuel; one graveyard payload suffices.
export function assetComboReserve(v, c) {
    if (v.bot?.id !== 'black-purple-criminals')
        return redPurpleAssetReserve(v, c);
    const wanted = c.catalogId === 'CQ31' ? 3 : ['WM060', 'BQ086'].includes(c.catalogId) ? 1 : 0;
    if (!wanted)
        return 0;
    const established = [...grave(v), ...mine(v).play].filter(x => x.id !== c.id && x.catalogId === c.catalogId).length;
    const held = mine(v).hand.filter(x => x.catalogId === c.catalogId).sort((a, b) => a.id.localeCompare(b.id));
    const rank = held.findIndex(x => x.id === c.id);
    return established + Math.max(0, rank) < wanted ? (wanted === 3 ? 140 : 80) : -40;
}
function loyaltyMissing(v, c, asset) {
    const m = mine(v);
    if (m.ignoreLoyalty)
        return 0;
    return Object.entries(c.loyalty ?? {}).reduce((n, [symbol, count]) => {
        if (symbol === '核')
            return n + (m.coreArea ? 0 : count);
        if (symbol === '紫' && v.societies?.[v.seat]?.plan?.ignorePurpleLoyalty && c.owner === v.seat)
            return n;
        const domain = domains[symbol], have = (domain ? m.loyalty?.domains?.[domain] : m.loyalty?.factions?.[symbol]) ?? 0;
        const added = asset && usableAsset(asset) && (domain ? asset.magicDomains?.includes(domain) : asset.faction?.split('·')[0] === symbol) ? 1 : 0;
        return n + Math.max(0, count - have - added);
    }, 0);
}
export function assetLoyaltyBenefit(v, c) {
    // Only retained cards benefit: an asset cannot supply loyalty to itself.
    const m = mine(v), targets = [...m.hand, ...m.play.filter(x => x.faceDown), ...m.coreArea?.cards ?? []];
    let best = 0, others = 0;
    for (const x of targets) {
        if (x.id === c.id || x.castAllowed === false)
            continue;
        const before = loyaltyMissing(v, x), after = loyaltyMissing(v, x, c);
        if (after >= before)
            continue;
        const price = x.faceDown ? v.revealCosts?.[x.id] ?? x.printedCost : v.castingCosts?.[x.id] ?? x.cost ?? x.printedCost;
        const soon = (price ?? 0) <= Math.max(v.round ?? 1, mana(v)) + 1;
        const benefit = after === 0 ? (soon ? 55 : 28) : 12;
        best = Math.max(best, benefit);
        others += 4;
    }
    return best + Math.min(12, Math.max(0, others - 4));
}
export function assetCommitmentPenalty(v, c) {
    const reserve = Math.max(0, assetComboReserve(v, c));
    if (!reserve)
        return 0;
    const unlock = mine(v).hand.some(x => x.id !== c.id && x.castAllowed !== false && loyaltyMissing(v, x, c) === 0 &&
        (v.castingCosts?.[x.id] ?? x.printedCost ?? 0) > mana(v) && (v.castingCosts?.[x.id] ?? x.printedCost ?? 0) <= mana(v) + 1);
    return Math.max(0, reserve - assetLoyaltyBenefit(v, c) - (unlock ? 45 : 0));
}
export function needsAssetMaterial(v, assetValue) {
    const m = mine(v);
    return !m.actionsUsed?.asset && m.assets.length < 8 && !m.hand.filter(usableAsset).some(c => assetValue(v, c) <= 20);
}
export function assetAcquisitionValue(v, c, assetValue, needed = needsAssetMaterial(v, assetValue)) {
    const m = mine(v);
    if (!needed || !usableAsset(c))
        return null;
    const curve = m.assets.length < Math.min(8, v.round ?? 1), loyalty = assetLoyaltyBenefit(v, c);
    if (!curve && !loyalty)
        return null;
    const names = v.bot?.libraryNames;
    const draft = { ...v, players: v.players.map((p, i) => i === v.seat ? { ...p, deckCount: Math.max(0, p.deckCount - 1), hand: [...p.hand, c] } : p),
        ...(names ? { bot: { ...v.bot, libraryNames: { ...names, [c.name]: Math.max(0, (names[c.name] ?? 0) - 1) } } } : {}),
        ...(v.hardInfo ? { hardInfo: { ...v.hardInfo, ownDeck: v.hardInfo.ownDeck.filter(x => x.id !== c.id) } } : {}) };
    // Take an expendable color source when the hand otherwise consists of
    // important pieces, rather than fetch another engine and asset that engine.
    return 65 + assetLoyaltyBenefit(draft, c) - Math.max(0, assetValue(draft, c)) * 0.8;
}
export function activeRumor(v, c) {
    const m = mine(v), hidden = (m.effectiveMarkers ?? m.markers)?.hidden > 0;
    return !!(c.keywords?.includes('传闻') || hidden && c.automation?.conditionalKeywords?.hidden?.includes('传闻'));
}
export function graveyardPurposeValue(v, c, handValue, planning) {
    const m = mine(v);
    if (activeRumor(v, c)) {
        const host = (planning?.rumorHosts ?? rumorHosts(v))[0];
        if (host?.score > 0)
            return 125 + host.recovery * 55 - host.failureRisk * 30 + Number(c.automation?.sealed?.effect === 'draw') * 20;
    }
    if (c.automation?.graveHiddenWin)
        return planning?.hiddenReady ? 155 : 35;
    // Transfer to the graveyard is a loss of access unless an actual recovery
    // plan supplies a use there. Printed cost/death magic alone is not a payoff.
    let value = (planning?.values.get(c.id) ?? 0) - Math.max(0, handValue(v, c));
    if (c.automation?.reincarnates || c.keywords?.includes('转生'))
        value -= 45;
    if (v.bot?.id === 'shoggoth-locking' && c.catalogId === 'BH59')
        value -= 1000;
    if (v.bot?.id === 'yellow-white-spells' && c.catalogId === 'XQ02' &&
        [...m.hand, ...v.hardInfo?.ownDeck ?? []].filter(x => x.catalogId === 'XQ02').length <= 1)
        value -= 200;
    return value;
}
