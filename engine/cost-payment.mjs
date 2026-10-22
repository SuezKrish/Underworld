import { withSimultaneousDepartures } from './simultaneous-choice.mjs';
import { RuleError } from './core.mjs';
// A sacrifice is declared first. Every dying object stays on the battlefield
// until this payment's death-trigger costs have been chosen and paid.
export function stageCostSacrifice(s, id, zone, extra) {
    const stage = s.costDepartureStage, l = s.locations[id];
    if (!stage?.collecting || zone !== 'graveyard' || extra.cause !== 'sacrifice' || !['play', 'asset'].includes(l?.zone))
        return false;
    if (stage.moves.some(x => x.id === id))
        throw new RuleError('同一张牌不能重复支付牺牲费用');
    stage.moves.push({ id, zone, extra: structuredClone(extra), from: { zone: l.zone, zoneVersion: l.zoneVersion } });
    return true;
}
export function costSacrificeReserved(s, id) {
    const l = s.locations[id], refs = s.costSacrificeReservations ?? s.deathContinuation?.choice?.reservedRefs ?? [];
    return refs.some(x => x.id === id && x.zoneVersion === l?.zoneVersion);
}
export function withCostPayment(s, ids, apply, { move, prepareDeaths, flush }) {
    const previous = s.costDepartureStage, reserved = s.costSacrificeReservations, prepared = s.preparedCostDeaths;
    const stage = { collecting: true, moves: [], group: s.eventGroup };
    s.costDepartureStage = stage;
    try {
        return withSimultaneousDepartures(s, ids, () => {
            const result = apply();
            stage.collecting = false;
            const refs = stage.moves.map(x => ({ id: x.id, zoneVersion: x.from.zoneVersion }));
            s.costSacrificeReservations = [...(reserved ?? []), ...refs];
            s.preparedCostDeaths = { ...(prepared ?? {}) };
            prepareDeaths(s, stage.moves);
            flush(s, { force: true, batch: true });
            return withSimultaneousDepartures(s, stage.moves.map(x => x.id), () => {
                for (const x of stage.moves) {
                    const l = s.locations[x.id];
                    if (l?.zone !== x.from.zone || l.zoneVersion !== x.from.zoneVersion)
                        throw new RuleError('已声明的牺牲费用牌在支付完成前变更了区域');
                    if (!move(s, x.id, x.zone, x.extra))
                        throw new RuleError('无法支付牺牲费用');
                }
                return result;
            });
        });
    }
    finally {
        if (previous)
            s.costDepartureStage = previous;
        else
            delete s.costDepartureStage;
        if (reserved)
            s.costSacrificeReservations = reserved;
        else
            delete s.costSacrificeReservations;
        if (prepared)
            s.preparedCostDeaths = prepared;
        else
            delete s.preparedCostDeaths;
    }
}
