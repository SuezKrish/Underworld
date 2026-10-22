import { hasCardType } from './card-types.mjs';
export function secretDeploymentPrice(v, d) { return (v.players[v.seat].secretDeploymentBaseCost ?? 1) + v.players.flatMap(p => p.play).filter(c => !c.faceDown && !c.tapped && c.district === d && c.automation?.static === 'secret-deploy-tax').length; }
// Commit untapped assets, rather than mana which expires at the next step.
// Normal policies use public threats; hard policies can use their private view.
export function responsePlan(v, h) {
    const p = v.seat, mine = v.players[p], foe = v.players[1 - p], phase = v.turn?.phase, first = v.turn?.firstPlayer === p, assets = mine.assets.filter(a => !a.tapped).length, available = h.pool(v);
    const active = ['action', 'contest'].includes(phase), grave = [...mine.graveyard, ...mine.headquarters ?? []], enemies = foe.play.filter(c => !c.faceDown && hasCardType(c, 'character') && !c.barrierNow);
    const enemyMana = (foe.costPool ?? 0) + foe.assets.filter(a => !a.tapped).length;
    const whiteThreat = (foe.loyalty?.factions?.白 ?? 0) > 0 && enemyMana >= 2 && foe.handCount > 0 && (!v.hardInfo || foe.hand.some(c => c.catalogId === 'BQ073'));
    const ambush = [];
    if (active)
        for (const c of [...mine.play.filter(c => c.faceDown), ...mine.hand]) {
            const hidden = mine.play.some(x => x.id === c.id), price = v.revealCosts?.[c.id] ?? h.cost(c), entryCost = hidden ? 0 : Math.min(...v.districts.flatMap((d, i) => d ? [secretDeploymentPrice(v, i)] : []));
            if (c.tapped || c.paidRevealBlocked || c.publicNow || !h.loyalty(v, c) || price > assets || price + entryCost > available || !hidden && (mine.actionsUsed.secret || mine.secretDeploymentBlocked))
                continue;
            if (c.catalogId === 'CQ32') {
                const bid = mine.hand.filter(x => x.id !== c.id).some(x => h.hiddenStrength(x, v) + (x.subtypes?.includes('梦魇') ? 2 : 0) >= 6);
                if (bid && grave.some(x => x.subtypes?.includes('梦魇')) && enemies.some(x => h.contestPending(v, x.district, 'influence')))
                    ambush.push({ id: c.id, cost: price, kind: 'capture', hidden });
            }
            if (c.catalogId === 'BH41' && grave.length && (hidden || first && whiteThreat) && (!hidden || h.contestPending(v, c.district, 'battle')))
                ambush.push({ id: c.id, cost: price, kind: 'battle', hidden });
        }
    const responseIds = new Set(), actionKeys = new Set();
    let responseMana = 0;
    if (phase === 'action' && first && enemyMana > 0) {
        const rows = [];
        for (const c of mine.hand) {
            const plan = c.spell, price = v.castingCosts?.[c.id] ?? h.cost(c);
            if (!plan || plan.timing !== 'fast' || c.castAllowed === false || !h.loyalty(v, c) || price < 1 || price > assets)
                continue;
            const opts = v.spellTargets?.[c.id] ?? [], removal = ['destroy', 'return-hand', 'bounce', 'shuffle-owner', 'damage', 'wound', 'conceal', 'sacrifice-character'].includes(plan.effect), counter = plan.effect === 'terminate', protect = c.catalogId === 'JC078' && h.own(v).some(x => h.value(x) >= 7);
            if (removal && (opts.some(o => enemies.some(x => x.id === o.id && h.value(x) >= 5)) || plan.effect === 'sacrifice-character' && enemies.some(x => h.value(x) >= 5)) || counter && foe.handCount > 0 && h.own(v).length || protect && foe.handCount > 0)
                rows.push({ id: c.id, cost: price, score: counter ? 12 : protect ? 10 : 14 });
        }
        for (const c of h.own(v))
            for (const [i, a] of (c.availableActions ?? []).entries()) {
                if (a.timing !== 'fast' || a.used || a.tap && (c.tapped || c.cannotTap) || !['destroy', 'return-hand', 'damage', 'wound', 'conceal'].includes(a.effect) || (a.cost ?? 0) < 1 || a.cost > assets)
                    continue;
                if ((v.abilityTargets?.[`${c.id}:${i}`] ?? []).some(o => enemies.some(x => x.id === o.id)))
                    rows.push({ id: c.id, key: `${c.id}:${i}`, cost: a.cost, score: 13 });
            }
        const best = rows.sort((a, b) => b.score - a.score || a.cost - b.cost)[0];
        if (best) {
            responseIds.add(best.id);
            if (best.key)
                actionKeys.add(best.key);
            responseMana = best.cost;
        }
    }
    return { ambush, responseIds, actionKeys, responseMana, ambushMana: Math.max(0, ...ambush.map(a => a.cost)) };
}
export function ambushRevealScore(v, c, h, plan = responsePlan(v, h)) {
    const ready = plan.ambush.find(a => a.id === c.id && a.hidden);
    if (!ready)
        return undefined;
    if (v.turn.phase === 'action')
        return null;
    if (v.turn.phase !== 'contest')
        return undefined;
    if (ready.kind === 'capture')
        return 98;
    if (v.turn.district === c.district && v.turn.kind === 'battle' && v.turn.step === 'contest-before' && !h.lethalBattleRisk(v, h.faceUp(v, c), c.district))
        return 76;
    return null;
}
