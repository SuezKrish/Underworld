import { hasAnyCardType } from './card-types.mjs';
export function isRegularPlayerCard(card) { return hasAnyCardType(card, ['character', 'attachment', 'spell', 'task', 'asset']); }
export function printedCostForDisplay(card) {
    return String(card.printedCostText ?? card.printedCost ?? '-').trim() || '-';
}
export function loyaltyForDisplay(card) {
    if (card.loyalty)
        return Object.entries(card.loyalty).map(([symbol, n]) => symbol.repeat(Math.max(0, n))).join('');
    return card.cost?.split('/')[1] ?? '';
}
export function costAndLoyaltyForDisplay(card) {
    const cost = printedCostForDisplay(card), loyalty = loyaltyForDisplay(card);
    return loyalty ? `${cost}/${loyalty}` : cost;
}
