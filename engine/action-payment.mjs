import { RuleError } from './core.mjs';
import { controllerOf } from './ownership.mjs';
import { hasAnyCardType } from './card-types.mjs';
import { printedRulesCard } from './printed-rules.mjs';
export const actionPaymentSources = () => [];
export function ownActionPayment(s, p, id) { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && controllerOf(s, id) === p && hasAnyCardType(printedRulesCard(s, id), ['character', 'attachment']); }
export function payActionFee(s, p, c, ordinary, { pay, additional = 0 } = {}) {
    if (!Array.isArray(c.actionPayments ?? []) || (c.actionPayments ?? []).length)
        throw new RuleError('当前没有可用的费用代付来源');
    pay(s, p, ordinary + additional);
    return 0;
}
