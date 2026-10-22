import { effectiveMagicDomains } from './magic-domains.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { RuleError } from './core.mjs';
export function revealHandCostOptions(s, p, id) {
    return printedRulesCard(s, id)?.automation?.revealHandDiscount ? s.players[p].hand.filter(x => x !== id) : [];
}
export function revealHandCostReduction(s, p, id, ids = []) {
    const allowed = revealHandCostOptions(s, p, id);
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || !ids.every(x => allowed.includes(x)))
        throw new RuleError('展示费用只能选择自己手中的不同其他卡牌');
    return ids.filter(x => (printedRulesCard(s, id).automation.revealHandDiscount !== 'holy-only' && s.cards[x].faction?.split('·')[0] === '白') || effectiveMagicDomains(s, x).includes('神圣')).length;
}
