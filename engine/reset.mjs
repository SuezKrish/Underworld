import { canReset } from './derived.mjs';
import { hasCardType } from './card-types.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { controllerOf } from './ownership.mjs';
import { continuousDecision } from './death-costs.mjs';
// Untapping is an immediate action. Choices suspend the current command rather
// than creating a response window; deterministic replay preserves earlier fees.
export function resetCard(s, id, operator = s.resolvingController ?? controllerOf(s, id)) {
    const l = s.locations[id];
    if (l?.zone !== 'play' || !l.tapped || !canReset(s, id))
        return false;
    const p = operator, first = s.flow.stepOwner ?? s.turn?.firstPlayer ?? 0;
    const sources = !l.faceDown && hasCardType(s.cards[id], 'character') ? [first, 1 - first].flatMap(q => s.players[q].play).filter(source => {
        const sl = s.locations[source];
        return sl?.zone === 'play' && !sl.faceDown && controllerOf(s, source) !== p && printedRulesCard(s, source).automation?.static === 'enemy-reset-tax';
    }) : [];
    const sequence = s.resetSequence = (s.resetSequence ?? 0) + 1;
    for (const [i, sourceId] of sources.entries()) {
        const available = (s.players[p].costPool ?? 0) + s.players[p].assets.filter(a => !a.tapped).length;
        const fire = available > 0 && continuousDecision(s, `reset:${sequence}:${id}:${l.zoneVersion}:${sourceId}:${s.locations[sourceId].zoneVersion}`, {
            kind: 'reset-tax', controller: p, sourceId, sourceName: s.cards[sourceId].name, hostName: s.cards[id].name, paid: i, total: sources.length, available
        });
        if (!fire) {
            s.logs.push({ id: (s.logs.at(-1)?.id ?? 0) + 1, round: s.round, text: `${s.seats[p].name}未支付${s.cards[sourceId].name}的1点重置费用；${s.cards[id].name}保持横置。` });
            return false;
        }
        const player = s.players[p];
        if (player.costPool > 0)
            player.costPool--;
        else
            player.assets.find(a => !a.tapped).tapped = true;
        s.logs.push({ id: (s.logs.at(-1)?.id ?? 0) + 1, round: s.round, text: `${s.seats[p].name}为重置${s.cards[id].name}支付1点费用（${s.cards[sourceId].name}）。` });
    }
    l.tapped = false;
    return true;
}
export function resetAssets(s) {
    for (const p of s.players)
        for (const a of p.assets)
            a.tapped = false;
}
