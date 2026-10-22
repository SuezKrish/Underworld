import { societyShuffleCosts } from './continuing-cost-rules.mjs';
import { unstableSacrificeDiscount } from './entropy-effects.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { hasCardType } from './card-types.mjs';
import { effectiveSubtypes, sacrificeCostBlocked } from './derived.mjs';
import { RuleError } from './core.mjs';
const front = (s, id) => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown;
export function deathSocietyCondition(s, p) { return s.societies?.[p]?.name === '颂亡者' || s.players[p].play.filter(id => front(s, id) && hasCardType(printedRulesCard(s, id), 'character') && printedRulesCard(s, id).unique && effectiveMagicDomains(s, id).includes('死亡')).length >= 2; }
export function funeralSubtypes(s, id) { const c = s.cards[id]; return c && hasCardType(c, 'character') && effectiveMagicDomains(s, id).includes('死亡') && deathSocietyCondition(s, c.owner) && s.players[c.owner].play.some(source => false) ? ['不死生物'] : []; }
export function ghoulEndCondition(s, p, plan) { return s.graveCharacterLeftRounds?.[p] === s.round || s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId && s.players[p].play.some(id => front(s, id) && hasCardType(printedRulesCard(s, id), 'attachment') && s.locations[id].district === plan.sourceDistrict && printedRulesCard(s, id).subtitle === '圣甲虫产业'); }
export function deathCharacterCostOptions(s, p, id, method) {
    const card = printedRulesCard(s, id), groups = [];
    if (card?.automation?.bloodSacrificeDiscount)
        groups.push({ kind: 'sacrifice', reduction: card.automation.bloodSacrificeDiscount, cards: s.players[p].play.filter(x => front(s, x) && hasCardType(s.cards[x], 'attachment') && printedRulesCard(s, x).name === '鲜血' && !sacrificeCostBlocked(s, x)) });
    if (card?.automation?.societyShuffleCastCost)
        groups.push({ kind: 'shuffle-seal', reduction: 0, required: 1, cards: societyShuffleCosts(s, p, card.automation.societyShuffleCastCost.name) });
    if (card?.automation?.sacrificeCastDiscount)
        groups.push({ kind: 'sacrifice', reduction: card.automation.sacrificeCastDiscount, cards: s.players[p].play.filter(x => front(s, x) && hasCardType(s.cards[x], 'character') && !sacrificeCostBlocked(s, x)) });
    ;
    if (method === 'reveal' && card && hasCardType(card, 'character') && effectiveSubtypes(s, id).includes('不死生物') && s.players[card.owner]?.play.some(source => false))
        groups.push({ kind: 'sacrifice', reduction: 2, cards: s.players[p].play.filter(x => front(s, x) && hasCardType(s.cards[x], 'character') && !hasCardType(s.cards[x], 'token') && !sacrificeCostBlocked(s, x)) });
    if (!groups.length)
        return null;
    return { ...(card?.automation?.bloodSacrificeDiscount ? { costLabel: '牺牲任意数量本方鲜血附属，每张减少2费用。' } : {}), required: groups.filter(g => g.required).map(g => ({ kind: g.kind, count: g.required, ids: g.cards })), kind: groups.length === 1 ? groups[0].kind : 'combined', reduction: groups.length === 1 ? groups[0].reduction : 0, cards: [...new Set(groups.flatMap(g => g.cards))], payments: Object.fromEntries(groups.flatMap(g => g.cards.map(id => [id, { kind: g.kind, reduction: groups.filter(x => x.kind === g.kind && x.cards.includes(id)).reduce((n, x) => n + x.reduction, 0) + (g.kind === 'sacrifice' ? unstableSacrificeDiscount(s, [id]) : 0) }]))) };
}
export function prepareDeathCharacterCost(s, p, id, method, ids = []) {
    const options = deathCharacterCostOptions(s, p, id, method);
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || !ids.every(id => options?.cards.includes(id)))
        throw new RuleError('请选择可支付的不同额外费用牌');
    for (const r of options?.required ?? [])
        if (ids.filter(x => r.ids.includes(x)).length !== r.count)
            throw new RuleError('请选择规定数量的精神锚点洗回拥有者牌库作为额外费用');
    return { ids, payments: ids.map(id => ({ id, ...options.payments[id] })), reduction: ids.reduce((n, id) => n + options.payments[id].reduction, 0) };
}
