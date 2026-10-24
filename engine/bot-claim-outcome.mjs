// Public scoring consequences of a claim, including changes to the winning
// threshold. A threshold alone is insufficient: the winner must also lead.
export function claimOutcome(v, seat, region, scores = v.players.map(p => p.score ?? 0)) {
    const noScore = v.societies?.[seat]?.plan?.noScore;
    const points = noScore ? 0 : (region.points ?? 0) - (region.destroyed ?? 0);
    const reduction = region.victoryReductionOnWin || region.victoryReduction || 0;
    const threshold = Math.max(0, (v.players[seat].victoryThreshold ?? 8) - reduction);
    const score = scores[seat] + points;
    return { score, points, threshold, wins: score >= threshold && score > scores[1 - seat] };
}
// Project earlier influence contests in region order. This is a board forecast,
// not a claim lock: responses and intervening battles can still change it.
export function projectedClaimOutcome(v, seat, d, h = {}) {
    const forecast = { ...v, players: v.players.map(p => ({ ...p })) }, scores = v.players.map(p => p.score ?? 0);
    for (let i = 0; i < d; i++) {
        const r = v.districts?.[i];
        if (!r)
            continue;
        let winner = r.pendingWinner;
        if (winner === null || winner === undefined) {
            if (!h.total || !h.contestPending?.(v, i, 'influence'))
                continue;
            const net = (r.influence?.[0] ?? 0) - (r.influence?.[1] ?? 0) + h.total(v, 0, i, 'influence') - h.total(v, 1, i, 'influence');
            if (!net || Math.abs(net) < r.threshold)
                continue;
            winner = net > 0 ? 0 : 1;
        }
        const outcome = claimOutcome(forecast, winner, r, scores);
        scores[winner] = outcome.score;
        forecast.players[winner].victoryThreshold = outcome.threshold;
        if (outcome.wins)
            return { ...claimOutcome(forecast, seat, v.districts[d], scores), wins: false, earlierWinner: winner };
    }
    return claimOutcome(forecast, seat, v.districts[d], scores);
}
