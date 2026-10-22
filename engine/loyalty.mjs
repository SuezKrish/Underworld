import { loyaltyAssets, societyPlan } from './environment-definitions.mjs';
import { coreArea } from './shoggoth-rules.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
const domains = { 心: '心灵', 圣: '神圣', 星: '星辰', 死: '死亡', 血: '鲜血' };
const colors = a => a.factionColors ?? [(a.faction ?? '中立').split('·')[0]];
function matches(s, p, a, symbol, card) {
    if (symbol === '核')
        return !!coreArea(s, p);
    ;
    return domains[symbol] ? a.magicDomains?.includes(domains[symbol]) : colors(a).includes(symbol);
}
export function loyaltyReplacementSources(s, p, card) {
    if (!card?.unique || !hasCardType(card, 'character'))
        return [];
    return s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && printedRulesCard(s, id)?.automation?.static === 'rasputin-loyalty');
}
export function loyaltyMet(s, p, loyalty, card) {
    if (card && s.players[p].ignoreLoyalty)
        return true;
    const assets = loyaltyAssets(s, p), requirements = Object.entries(loyalty ?? {}).filter(([symbol]) => !(symbol === '紫' && card?.owner === p && societyPlan(s, p).ignorePurpleLoyalty));
    if (requirements.every(([symbol, n]) => symbol === '核' ? !!coreArea(s, p) : assets.filter(a => matches(s, p, a, symbol, card)).length >= n))
        return true;
    if (!loyaltyReplacementSources(s, p, card).length)
        return false;
    // Normal loyalty may use the same multicolor asset in different checks. The
    // optional replacement instead assigns each asset to exactly one symbol.
    const symbols = requirements.flatMap(([symbol, n]) => Array(n).fill(symbol));
    if (symbols.length > assets.length)
        return false;
    const candidates = symbols.map(symbol => assets.flatMap((a, i) => matches(s, p, a, symbol, card) || colors(a).some(c => ['绿', '红', '紫'].includes(c)) ? [i] : []));
    const assigned = new Map();
    const assign = (index, seen) => {
        for (const asset of candidates[index]) {
            if (seen.has(asset))
                continue;
            seen.add(asset);
            if (!assigned.has(asset) || assign(assigned.get(asset), seen)) {
                assigned.set(asset, index);
                return true;
            }
        }
        return false;
    };
    return candidates.every((_, i) => assign(i, new Set()));
}
