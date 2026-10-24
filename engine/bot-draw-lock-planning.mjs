import { responseFilter } from './response-effect-semantics.mjs';
// Draw prohibition excludes transfers such as bottom-to-hand. Evaluate the
// remaining need for cards, not the nominal number of draw effects alone.
const count = p => !p ? 0 : (p.effect === 'draw' ? (p.count ?? 1) : 0) + (p.steps ?? []).reduce((n, x) => n + count(x), 0);
export function nonDrawLockValue(v, candidate) {
    if (nonDrawLockActive(v))
        return 0;
    const p = v.seat;
    const profile = seat => {
        const x = v.players[seat], hand = x.handCount ?? x.hand.length, limit = x.handLimit ?? 7;
        const need = hand <= 2 ? 1.5 : hand < limit - 1 ? 1 : 0.25;
        let draws = 0, transfers = 0;
        const budget = (x.costPool ?? 0) + (x.assets ?? []).filter(a => !a.tapped).length;
        const library = seat === p ? v.hardInfo?.ownDeck : v.hardInfo?.opponentCanControlLibrary ? v.hardInfo.opponentDeckPool : v.hardInfo?.opponentDeck;
        // Known library cards are possibilities bounded by the draw chain and mana,
        // never assumed to all enter hand. Hidden ordinary-seat libraries stay hidden.
        const cost = c => Math.max(0, (seat === p ? v.castingCosts?.[c.id] : v.hardInfo?.opponentCastingCosts?.[c.id]) ?? c.printedCost ?? 0);
        const repeatCount = w => {
            if (w.event !== 'cast' || !w.own || w.limitPerRound || w.oncePerRound || w.cost || w.tap)
                return 1;
            const matches = c => c.castAllowed !== false && responseFilter(c, w.filter);
            let mana = budget, casts = 0;
            for (const c of [...(x.hand ?? [])].filter(matches).sort((a, b) => cost(a) - cost(b)))
                if (cost(c) <= mana && casts < 4) {
                    mana -= cost(c);
                    casts++;
                }
            if (casts && count(w) > 0)
                for (const c of [...(library ?? [])].filter(matches).sort((a, b) => cost(a) - cost(b)))
                    if (cost(c) <= mana && casts < 4) {
                        mana -= cost(c);
                        casts++;
                    }
            const nextTurn = (library ?? []).some(c => matches(c) && cost(c) <= (x.assets?.length ?? 0)) ? 2 : 1;
            return Math.min(6, Math.max(1, casts) + nextTurn);
        };
        for (const c of x.play.filter(c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed)) {
            for (const a of [...c.automation?.watch ?? [], c.automation?.action, ...c.automation?.actions ?? []].filter(Boolean)) {
                draws += count(a) * repeatCount(a);
                if (a.effect === 'bottom-to-hand')
                    transfers += a.count ?? 1;
            }
        }
        // Investigation is another recurring hand refill even with no printed
        // draw ability. Count a win as one card, not one card for every eye icon.
        for (let d = 0; d < (v.districts ?? []).length; d++)
            if (v.districts[d]) {
                const eyes = p => (v.players[p].play ?? []).filter(c => c.district === d && !c.faceDown && !c.tapped).reduce((n, c) => n + (c.effectiveIcons?.investigation ?? ((c.icons?.investigation ?? 0) + (v.turn?.firstPlayer === p ? (c.temporaryIcons?.investigation ?? 0) : 0))), 0);
                const own = eyes(seat), foe = eyes(1 - seat);
                if (own > foe || own > 0 && own === foe && v.turn?.firstPlayer === seat)
                    draws++;
            }
        // Known held draw spells represent available refills; hidden hands do not.
        for (const c of x.hand ?? [])
            draws += count(c.spell) * 0.5;
        return { need, draws: Math.min(6, draws), transfers, hand, limit };
    };
    const own = profile(p), enemy = profile(1 - p);
    const ownCost = own.draws * own.need * (own.transfers ? 0.5 : 1);
    const enemyLoss = enemy.draws * enemy.need;
    let value = (enemyLoss - ownCost) * 6 + (own.hand >= own.limit - 1 && enemy.hand <= 3 ? 15 : 0);
    // Protection matters only for an already valuable lock. It never turns a
    // symmetric harmful lock into a benefit, and does not imply uncounterability.
    if (value > 0 && candidate) {
        const barrier = candidate.keywordStates?.find(k => k.keyword === '屏障')?.present ?? candidate.keywords?.includes('屏障') ?? candidate.automation?.keywords?.includes('屏障');
        const defense = candidate.effectiveDefense ?? candidate.defense ?? 0;
        value *= 1 + (barrier ? 0.25 : 0) + (defense >= 4 ? 0.15 : 0);
    }
    return value;
}
export const nonDrawLockActive = v => v.players.some(p => p.play.some(c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed && c.automation?.static === 'block-non-draw'));
export const nonDrawEffectBlocked = v => v.turn?.step !== 'draw' && nonDrawLockActive(v);
export function onlyDrawEffect(plan) {
    if (!plan || plan.operation || plan.ops?.length || plan.drawBefore || plan.drawAfter)
        return false;
    if (plan.effect === 'sequence')
        return !!plan.steps?.length && plan.steps.every(onlyDrawEffect);
    return ['draw', 'draw-to-four'].includes(plan.effect) && !plan.steps?.length;
}
export function blockedDrawInvestment(v, c) {
    if (!nonDrawEffectBlocked(v) || !c)
        return 0;
    const a = c.automation ?? {};
    const repeat = [...a.watch ?? [], ...a.actions ?? [], a.action, a.prepare, a.end].filter(Boolean).reduce((n, p) => n + count(p), 0);
    const once = count(c.spell ?? a.entry ?? c.attachment?.entry);
    return Math.min(48, repeat * 24 + once * 10);
}
