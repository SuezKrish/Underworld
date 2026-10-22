export const scoreValue = card => card.awardedPoints ?? ((card.points ?? 0) - (card.destroyed ?? 0));
export function scoredCard(s, p, card) { return s.societies?.[p]?.plan?.noScore ? { ...card, awardedPoints: 0 } : card; }
const legacyWulingReduction = c => c.catalogId === 'DQ12' && !c.victoryReductionRecorded ? (c.plan?.victoryReduction ?? 0) : 0;
export function upgradeVictoryReductions(s) {
    for (const player of s.players ?? []) {
        player.permanentVictoryReduction ??= 0;
        for (const c of player.scoreCards ?? []) {
            const n = legacyWulingReduction(c);
            if (n) {
                player.permanentVictoryReduction += n;
                c.victoryReductionRecorded = true;
            }
        }
    }
}
export function recordClaimVictoryReduction(s, p, card) {
    upgradeVictoryReductions(s);
    const n = card.plan?.victoryReductionOnWin ?? (card.catalogId === 'DQ12' ? card.plan?.victoryReduction ?? 0 : 0);
    if (n)
        s.players[p].permanentVictoryReduction += n;
    return n;
}
export function victoryThreshold(s, p) {
    const player = s.players[p], cards = player.scoreCards ?? [];
    return Math.max(0, 8 - (player.permanentVictoryReduction ?? 0) - cards.reduce((n, c) => n + legacyWulingReduction(c) + (c.catalogId !== 'DQ12' ? (c.plan?.victoryReduction ?? 0) : 0), 0));
}
