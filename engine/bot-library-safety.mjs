const claimRecyclingProfiles = new Set(['black-purple-criminals', 'purple-matriarch']);
export const claimRecyclingBot = v => claimRecyclingProfiles.has(v.bot?.id);
// These engines can consume a library long before their field loses strength.
// Plan several rounds ahead: future investigations can spread when more bodies
// enter, so today's single winning investigation is not a safe upper bound.
// A possible region claim is never credited as cards already in the library.
export function libraryRunway(v, h = {}) {
    const regions = (v.districts ?? []).filter(Boolean).length;
    const pending = (v.districts ?? []).filter((r, d) => r && (h.contestPending ? h.contestPending(v, d, 'investigation') : ['setup', 'start', 'action', 'contest'].includes(v.turn?.phase))).length;
    const perRound = 1 + regions, reserve = 2 + 3 * perRound + pending, deck = v.players[v.seat].deckCount ?? 50;
    return { reserve, perRound, pending, pressure: claimRecyclingBot(v) && deck <= reserve + perRound, urgent: claimRecyclingBot(v) && deck <= reserve };
}
function keyword(c, k, h) { return h.keyword ? h.keyword(c, k) : c.keywordStates?.find(s => s.keyword === k)?.present ?? c.keywords?.includes(k) ?? false; }
// The winning player does not determine who receives the returned cards.
// Tokens disappear, withdrawal goes to hand, and eternal cards stay in play.
// Sealed cards return to hand, rather than refilling the library with the host.
export function districtLibraryReturn(v, d, prospect, h = {}) {
    const cards = v.players.flatMap((p, seat) => (p.play ?? []).filter(c => c.id !== prospect?.id).map(c => ({ c, owner: c.owner ?? seat })));
    if (prospect)
        cards.push({ c: { ...prospect, district: d }, owner: prospect.owner ?? v.seat });
    return cards.filter(({ c, owner }) => owner === v.seat && c.district === d && !c.token && !/^TK\d+$/.test(c.catalogId ?? '') && !c.subtypes?.includes('任务') && !keyword(c, '永恒', h) && !keyword(c, '撤回', h)).length;
}
// Check mandatory draws in their actual order: each region's investigation
// precedes its influence contest. A later refill cannot save an earlier draw.
// This is a public-board forecast, not a claim that intervening effects cannot
// change the outcome. Negative means a presently forced draw would deck us.
export function mandatoryLibraryMargin(v, h) {
    let deck = v.players[v.seat].deckCount ?? 50, margin = deck;
    const scores = v.players.map(p => p.score ?? 0);
    for (const [d, r] of (v.districts ?? []).entries()) {
        if (!r)
            continue;
        if (h.contestPending(v, d, 'investigation') && h.total(v, v.seat, d, 'investigation') > h.total(v, 1 - v.seat, d, 'investigation'))
            margin = Math.min(margin, --deck);
        if (h.contestPending(v, d, 'influence')) {
            const net = r.influence[0] - r.influence[1] + h.total(v, 0, d, 'influence') - h.total(v, 1, d, 'influence');
            if (Math.abs(net) >= r.threshold || r.pendingWinner !== null && r.pendingWinner !== undefined) {
                deck += districtLibraryReturn(v, d, undefined, h);
                const winner = r.pendingWinner ?? (net > 0 ? 0 : 1);
                scores[winner] += Math.max(0, (r.points ?? 0) - (r.destroyed ?? 0));
                if (scores[winner] >= (v.players[winner].victoryThreshold ?? 8) && scores[winner] > scores[1 - winner])
                    return margin;
            }
        }
    }
    return Math.min(margin, deck - 1); // next round's ordinary draw
}
export function investigationRelief(v, c, h) {
    if (!claimRecyclingBot(v) || !c || c.controller !== v.seat || c.tapped || keyword(c, '永恒', h) || (v.players[v.seat].deckCount ?? 50) > 4 || !h.contestPending(v, c.district, 'investigation') || h.icons(v, c, 'investigation') <= 0)
        return 0;
    const before = mandatoryLibraryMargin(v, h);
    if (before >= 0)
        return 0;
    const without = { ...v, players: v.players.map(p => ({ ...p, play: p.play.filter(x => x.id !== c.id) })) }, after = mandatoryLibraryMargin(without, h);
    return after > before ? 200 + Math.min(4, after - before) * 20 : 0;
}
// Prefer a deployment/move that brings a real refill forward. Merely adding
// more cards to an already-secured claim is worth much less than securing one.
export function libraryClaimPlacement(v, d, c, h) {
    if (!libraryRunway(v, h).pressure)
        return 0;
    const r = v.districts[d];
    if (!r || !h.contestPending(v, d, 'influence'))
        return 0;
    if (r.pendingWinner !== null && r.pendingWinner !== undefined || r.influence.some(n => n >= r.threshold))
        return 0;
    const p = v.seat, q = 1 - p, old = v.players[p].play.find(x => x.id === c.id && x.district === d);
    const before = h.total(v, p, d, 'influence') - h.total(v, q, d, 'influence');
    const gain = h.icons(v, { ...c, controller: p }, 'influence') - (old ? h.icons(v, old, 'influence') : 0), after = before + gain;
    const need = r.threshold - (r.influence[p] ?? 0) + (r.influence[q] ?? 0), eta = delta => delta > 0 ? Math.ceil(need / delta) : Infinity;
    const was = eta(before), now = eta(after), returns = districtLibraryReturn(v, d, c, h);
    if (!returns)
        return 0;
    const strength = libraryRunway(v, h).urgent ? 1 : 0.6;
    let score = Math.max(0, gain) * 2;
    if (now <= 1 && was > 1)
        score += 30 + Math.min(8, returns) * 6;
    else if (now <= 2 && was > now)
        score += 16 + Math.min(8, returns) * 3;
    else if (now < was)
        score += 8 + Math.min(8, returns) * 2;
    if (now <= 1 && !old)
        score += 2;
    return score * strength;
}
