// Declared sacrifice costs, shared by price calculation and its UI preview.
// Sacrifices during resolution are deliberately excluded.
export function sacrificePaymentIds(plan, c = {}, sourceId = plan.sourceId ?? c.cardId) {
    return [...new Set([
            ...(plan.sacrificeSelf ? [sourceId] : []),
            ...(plan.sacrificeCharacter ? [c.sacrificeId] : []),
            ...(plan.sacrificeCharacters ? c.sacrificeIds ?? [] : []),
            ...(plan.sacrificeCost ? c.costIds ?? [] : []),
            ...(plan.sacrificeAttached || plan.sacrificeAssetOrPlan ? [c.costCardId] : []),
            ...(plan.sacrificeAsset ? [c.assetId] : [])
        ].filter(Boolean))];
}
export function unstableViewDiscount(room, plan, c) {
    const ids = sacrificePaymentIds(plan, c), cards = room?.players?.flatMap(p => p.play ?? []) ?? [];
    return cards.filter(x => false).length;
}
export function unstableViewAllowance(room, plan, source) {
    const cards = room?.players?.[room.seat]?.play ?? [], eligible = cards.filter(x => false);
    const self = plan.sacrificeSelf && eligible.some(x => x.id === source.id) ? 1 : 0;
    return self + Math.min(eligible.filter(x => !self || x.id !== source.id).length, (plan.sacrificeCharacter ? 1 : 0) + (plan.sacrificeCharacters?.count ?? 0) + (plan.sacrificeCost?.count ?? 0));
}
