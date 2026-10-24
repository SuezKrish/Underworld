import { nonDrawEffectBlocked } from './bot-draw-lock-planning.mjs';
import { graveyardPlanning } from './bot-graveyard-uses.mjs';
import { graveyardPurposeValue } from './bot-card-purpose.mjs';
// Use the private order only for informed seats. Scores describe the actual
// cards lost or enabled by milling, rather than a generic graveyard bonus.
// Unknown compound operations do not pretend to have a known result.
export function knownMillOutcome(v, plan, h = {}, targetIds = []) {
    if (!v.hardInfo?.ownDeck)
        return null;
    const mills = a => a && (['mill-self-one', 'mill-player', 'mill-both', 'mill-five-both'].includes(a.effect ?? a.operation) || (a.steps ?? []).some(mills));
    if (!mills(plan))
        return null;
    const baseValue = c => h.value?.(c) ?? (c.printedCost ?? 0), p = v.seat;
    const decks = [[], []];
    decks[p] = [...v.hardInfo.ownDeck];
    decks[1 - p] = [...(v.hardInfo.opponentCanControlLibrary ? v.hardInfo.opponentDeckPool : v.hardInfo.opponentDeck) ?? []];
    if (v.hardInfo.opponentCanControlLibrary)
        for (const x of v.hardInfo.opponentKnownPositions ?? []) {
            const deck = decks[1 - p], i = deck.findIndex(c => c.id === x.card.id);
            if (i >= 0 && x.index < deck.length)
                [deck[i], deck[x.index]] = [deck[x.index], deck[i]];
        }
    const plans = new Map(), scores = new Map();
    function score(c, seat) {
        if (!plans.has(seat)) {
            const sv = seat === p ? v : { ...v, seat, hardInfo: { ownDeck: decks[seat] } };
            plans.set(seat, { view: sv, plan: graveyardPlanning(sv, decks[seat], (_, x) => baseValue(x)) });
        }
        const x = plans.get(seat), key = `${seat}:${c.id}`;
        if (!scores.has(key))
            scores.set(key, graveyardPurposeValue(x.view, c, (_, c) => baseValue(c), x.plan) - (x.plan.loyaltyReserve.has(c.id) ? 60 : 0));
        return scores.get(key);
    }
    let utility = 0, affected = [], uncertain = false;
    function access(seat, n, kind, side = 'top') {
        const deck = decks[seat], flex = seat === p ? v.hardInfo.canControlLibrary : v.hardInfo.opponentCanControlLibrary;
        if (!deck.length)
            return;
        const known = seat === p ? v.hardInfo.libraryKnown ?? {} : Object.fromEntries((v.hardInfo.opponentKnownPositions ?? []).map(x => [x.card.id, true]));
        // Enemy hard decks are unordered pools. Reconstruct only publicly fixed
        // positions, then assume the opponent chooses the best remaining payoff.
        if (flex) {
            const positions = deck.flatMap((c, i) => Object.hasOwn(known, c.id) ? [] : [i]);
            const movable = positions.map(i => deck[i]).sort((a, b) => (kind === 'mill' ? score(b, seat) - score(a, seat) : baseValue(b) - baseValue(a)) || a.id.localeCompare(b.id));
            if (side === 'bottom')
                movable.reverse();
            positions.forEach((at, i) => deck[at] = movable[i]);
        }
        if (kind === 'mill')
            for (const c of deck)
                score(c, seat);
        const cards = side === 'bottom' ? deck.splice(Math.max(0, deck.length - n)) : deck.splice(0, n);
        if (kind === 'mill')
            for (const c of cards) {
                utility += (seat === p ? 1 : -1) * score(c, seat);
                affected.push({ seat, id: c.id });
            }
    }
    function walk(a) {
        if (!a)
            return;
        const e = a.effect ?? a.operation ?? a.kind;
        if (e === 'sequence') {
            for (const child of a.steps ?? [])
                walk(child);
            return;
        }
        const n = Number.isFinite(a.count) ? a.count : 1;
        if (e === 'draw' || e === 'bottom-to-hand') {
            if (e === 'draw' && nonDrawEffectBlocked(v))
                return;
            access(p, n, 'hand', e === 'bottom-to-hand' ? 'bottom' : 'top');
            return;
        }
        if (e === 'mill-self-one') {
            access(p, 1, 'mill');
            return;
        }
        if (e === 'mill-five-both' || e === 'mill-both') {
            for (const seat of [p, 1 - p])
                access(seat, e === 'mill-five-both' ? 5 : 4, 'mill');
            return;
        }
        if (e === 'mill-player') {
            const seat = Number(targetIds[0]?.replace('player:', ''));
            if ([0, 1].includes(seat))
                access(seat, a.count ?? 2, 'mill');
            return;
        }
        if (['shuffle', 'top-select-hand', 'search-filtered', 'predict'].includes(e))
            uncertain = true;
    }
    walk(plan);
    return uncertain || !affected.length ? null : { utility, affected, bonus: Math.max(-32, Math.min(32, utility * 0.2)) };
}
