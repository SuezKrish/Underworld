// Winning is fixed when net influence first reaches the threshold. The latch
// belongs to this region object, not its index or its current counter count.
export function regionWinner(d) {
    if (!d)
        return null;
    if (d.pendingWinner === 0 || d.pendingWinner === 1)
        return d.pendingWinner;
    const reached = d.influence?.findIndex(n => n >= d.threshold) ?? -1;
    return reached < 0 ? null : reached;
}
export function lockRegionWinner(d, forcedWinner) {
    if (!d)
        return null;
    const winner = regionWinner(d) ?? forcedWinner ?? null;
    if (winner === 0 || winner === 1)
        d.pendingWinner = winner;
    return winner;
}
export function lockRegionWinners(s) {
    for (const d of s.districts ?? [])
        lockRegionWinner(d);
}
