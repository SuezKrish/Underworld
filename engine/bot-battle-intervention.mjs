import { hasCardType } from './card-types.mjs';
import { upcomingContest } from './contest-timing.mjs';
const removals = new Set(['destroy', 'destroy-if-sealed', 'bounce', 'return-hand', 'bottom-owner', 'shuffle-owner']);
const returns = new Set(['bounce', 'return-hand']);
const health = c => Math.max(1, (c.effectiveDefense ?? c.defense ?? 1) - (c.damage ?? 0) - (c.wounds ?? 0));
// Compare the enemy's best lethal allocation before and after a quick effect.
// Only public field information is used; a hidden face is not assumed to flip.
function losses(v, d, h) {
    const p = v.seat, budget = Math.max(0, Math.floor(h.total(v, 1 - p, d, 'battle') - h.total(v, p, d, 'battle')));
    if (!budget)
        return 0;
    const victims = v.players[p].play.filter(c => c.district === d && !c.faceDown && hasCardType(c, 'character') && !c.battleDamagePrevented && !h.keyword(c, '永恒'));
    const limit = Math.min(budget, victims.reduce((n, c) => n + health(c), 0)), values = Array(limit + 1).fill(0);
    for (const c of victims) {
        const need = health(c), worth = h.value(c);
        for (let n = limit; n >= need; n--)
            values[n] = Math.max(values[n], values[n - need] + worth);
    }
    return values[limit];
}
export function battleIntervention(v, source, plan, ids, h) {
    const none = { adjustment: 0, urgent: false };
    if (plan?.timing !== 'fast' || plan.actionPhaseOnly || v.flow?.stack?.length || !h.total || !h.value || !h.keyword)
        return none;
    // Unselected additional payment objects cannot be treated as still fighting.
    if (['extraCost', 'tapCharacters', 'sacrificeCharacter', 'sacrificeCharacters', 'sacrificeAttached', 'sacrificeAssetOrPlan'].some(k => plan[k]))
        return none;
    const next = v.turn?.phase === 'contest' && v.turn.step === 'contest-before' ? v.turn : upcomingContest(v);
    if (next?.kind !== 'battle' || ids?.length !== 1)
        return none;
    const target = v.players.flatMap(p => p.play).find(c => c.id === ids[0]);
    if (!target || target.district !== next.district || target.faceDown || !hasCardType(target, 'character'))
        return none;
    const effect = plan.effect, removed = removals.has(effect);
    if (!removed && !['tap', 'damage', 'wound'].includes(effect))
        return none;
    if (removed && h.keyword(target, '永恒') || effect === 'destroy-if-sealed' && !(v.sealed ?? []).some(c => c.hostId === target.id))
        return none;
    const before = losses(v, next.district, h);
    if (!before)
        return none;
    const draft = { ...v, players: v.players.map(p => ({ ...p, play: p.play.map(c => ({ ...c })) })) }, owner = draft.players[target.controller];
    const changed = owner.play.find(c => c.id === target.id);
    let leaves = removed;
    if (effect === 'tap')
        changed.tapped = true;
    if (['damage', 'wound'].includes(effect)) {
        if (effect === 'damage' && target.damagePrevented || effect === 'wound' && target.woundsPrevented)
            return none;
        changed[effect === 'wound' ? 'wounds' : 'damage'] = (changed[effect === 'wound' ? 'wounds' : 'damage'] ?? 0) + (plan.amount ?? plan.count ?? 1);
        leaves = (changed.damage ?? 0) + (changed.wounds ?? 0) >= (changed.effectiveDefense ?? changed.defense ?? 1) && !h.keyword(target, '永恒');
    }
    if (leaves)
        owner.play = owner.play.filter(c => c.id !== target.id);
    // A source tapped/sacrificed as payment can itself change the battle margin.
    if (plan.tap || plan.sacrificeSelf)
        for (const p of draft.players) {
            if (plan.sacrificeSelf)
                p.play = p.play.filter(c => c.id !== source.id);
            else {
                const c = p.play.find(c => c.id === source.id);
                if (c)
                    c.tapped = true;
            }
        }
    const saved = before - losses(draft, next.district, h);
    if (saved <= 0)
        return none;
    // Returning a card preserves it for later deployment. Avoid treating it as
    // permanent removal, whether it belongs to us or to the opponent.
    const returnAdjustment = returns.has(effect) ? (target.controller === v.seat ? 1 : -1) * h.value(target) * 0.65 - (target.controller === v.seat ? (Number(target.printedCost) || 0) * 0.5 : 0) : 0;
    return { adjustment: saved + returnAdjustment, urgent: true };
}
