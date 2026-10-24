import { hasCardType } from './card-types.mjs';
const roles = (v, p) => v.players[p].play.filter(c => !c.faceDown && hasCardType(c, 'character'));
const level = p => { const m = p.effectiveMarkers ?? p.markers; return (m?.hidden ?? 0) - (m?.exposed ?? 0); };
// A player chooses the wound recipient. Evaluate the least damaging legal
// choice, not the best enemy body, and include our own wounded casualties.
export function woundVictimCost(v, c, h) {
    if (c.woundsPrevented)
        return 0;
    const health = (c.effectiveDefense ?? c.defense ?? 1) - (c.damage ?? 0);
    if (health <= 1 && !h.keyword(c, '永恒'))
        return h.value(c) * 2 + 8;
    return h.value(c) / Math.max(1, health) + (c.wounds ? 0 : 2);
}
export function tormentVictimCost(v, c, h) {
    const wound = woundVictimCost(v, c, h);
    if (c.woundsPrevented || h.keyword(c, '永恒'))
        return wound;
    const p = v.seat, q = 1 - p, own = v.players[p], foe = v.players[q];
    const ownBest = Math.max(0, ...own.hand.map(x => h.hiddenStrength(x, v)));
    const enemyBest = Math.max(0, ...foe.hand.map(x => h.hiddenStrength(x, v)));
    const guaranteed = !!v.hardInfo && own.hand.length > 0 && (ownBest > enemyBest || ownBest === enemyBest && v.turn.firstPlayer === p);
    const gap = level(foe) - level(own);
    const couldSweep = guaranteed ? gap - 1 > 0 : gap + 1 > 0;
    return couldSweep ? Math.max(wound, h.value(c) * 1.5 + 2) : wound;
}
export function tormentUtility(v, card, h) {
    const p = v.seat, q = 1 - p, own = v.players[p], foe = v.players[q], ours = roles(v, p), theirs = roles(v, q);
    const points = c => h.hiddenStrength(c, v);
    const hand = own.hand.filter(c => c.id !== card.id), ourBest = Math.max(0, ...hand.map(points));
    const known = !!v.hardInfo, enemyBest = known ? Math.max(0, ...foe.hand.map(points)) : foe.handCount ? 5 : 0;
    const win = hand.length > 0 && (ourBest > enemyBest || ourBest === enemyBest && v.turn.firstPlayer === p);
    // Gaining one hidden or giving one exposed improves the level difference
    // by one. Losing may instead reduce it by one.
    const gap = level(own) - level(foe), canSweep = gap > 1 || gap >= 0 && win;
    const vulnerable = c => !h.keyword(c, '永恒') && !c.cannotBeDestroyed;
    const wounded = xs => xs.filter(c => (c.wounds ?? 0) > 0 && vulnerable(c)).reduce((n, c) => n + h.value(c), 0);
    const least = theirs.length ? Math.min(...theirs.map(c => {
        if (!vulnerable(c) || c.woundsPrevented)
            return 0;
        const lethal = (c.effectiveDefense ?? c.defense ?? 1) - (c.damage ?? 0) <= 1;
        return lethal || canSweep ? h.value(c) : tormentVictimCost(v, c, h) * 0.3;
    })) : 0;
    const sweep = canSweep ? wounded(theirs) - wounded(ours) : 0;
    const secrecy = win ? (level(own) <= 0 ? 8 : 3) : 0;
    // Already wounded victims are counted in the sweep, not twice.
    const newVictim = theirs.some(c => (c.wounds ?? 0) > 0) ? 0 : least;
    return (canSweep ? sweep + newVictim : least) * 2 + secrecy;
}
