import { nonDrawLockActive } from './bot-draw-lock-planning.mjs';
export function investigationSealValue(v, d) {
    const region = v.districts?.[d];
    if (!region || region.pendingWinner != null)
        return 0;
    if ((v.sealed ?? []).some(c => !c.faceDown && c.hostId === `district-host:${region.id}` && c.automation?.sealedSkipInvestigation))
        return 0;
    if (v.players.some(p => p.play.some(c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed && c.district === d && (c.automation?.static === 'skip-source-investigation' || c.automation?.static === 'untapped-skip-investigation' && !c.tapped))))
        return 0;
    const eyes = p => v.players[p].play.filter(c => c.district === d && !c.faceDown && !c.tapped).reduce((n, c) => n + (c.effectiveIcons?.investigation ?? ((c.icons?.investigation ?? 0) + (v.turn?.firstPlayer === p ? (c.temporaryIcons?.investigation ?? 0) : 0))), 0);
    const p = v.seat, q = 1 - p, a = eyes(p), b = eyes(q);
    if (!a && !b)
        return 0;
    const winner = a === b ? v.turn?.firstPlayer : a > b ? p : q;
    if (winner == null)
        return 0;
    const player = v.players[winner], deck = player.deckCount ?? 50, hand = player.handCount ?? player.hand?.length ?? 0;
    const draw = nonDrawLockActive(v) ? 0 : deck <= 1 ? -100 : hand < (player.handLimit ?? 7) - 1 ? 14 : 5;
    // Skipping investigation also loses the winner's library inspection/order.
    const gain = draw + Math.min(6, Math.abs(a - b) + 1) * 2;
    return winner === q ? gain : -gain;
}
export function graveSealPayoff(v, c) {
    const plan = c.automation?.['grave-entry'];
    if (c.printedTextBlank || c.abilitiesSuppressed || plan?.operation !== 'seal-source-grave' || !c.automation?.sealedSkipInvestigation)
        return 0;
    if (plan.condition === 'purple-assets' && !(v.players[v.seat].loyalty?.factions?.紫 > 0))
        return 0;
    const options = (v.districts ?? []).flatMap((r, d) => r && (plan.target !== 'water-district' || (r.traits ?? r.subtypes ?? []).includes('水域')) ? [investigationSealValue(v, d)] : []);
    return Math.max(0, ...options) * 3;
}
