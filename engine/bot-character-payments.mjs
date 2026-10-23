import { hasCardType } from './card-types.mjs';
import { recurringEngine } from './bot-resource-planning.mjs';
// Optional sacrifice discounts exchange an existing board for a new body.
// Use the engine's public legal payment list and reevaluate the board after
// paying. A recurring engine is not disposable mana.
export function characterSacrificePlays(v, c, h, budget) {
    const options = v.characterCosts?.[c.id], price = v.castingCosts?.[c.id] ?? c.printedCost ?? 0;
    if (!c.automation?.sacrificeCastDiscount || !options || options.required?.length || price <= budget)
        return [];
    const p = v.seat, loss = x => Math.max(0, h.value(x) + (x.token ? 0 : 3) - (x.tapped ? 2 : 0));
    const candidates = (options.cards ?? []).filter(x => options.payments?.[x.id]?.kind === 'sacrifice' && hasCardType(x, 'character') &&
        !x.faceDown && !recurringEngine(x) && !h.keyword(x, '永恒') && !v.players[p].play.some(a => a.attachedTo === x.id))
        .sort((a, b) => loss(a) / options.payments[a.id].reduction - loss(b) / options.payments[b.id].reduction || a.id.localeCompare(b.id));
    let reduction = 0;
    const paid = [];
    for (const x of candidates) {
        if (reduction >= price - budget)
            break;
        paid.push(x);
        reduction += options.payments[x.id].reduction;
    }
    if (reduction < price - budget)
        return [];
    const sacrificeLoss = paid.reduce((n, x) => n + loss(x), 0);
    if (sacrificeLoss >= h.value(c) + 2)
        return [];
    const ids = new Set(paid.map(x => x.id)), draft = { ...v, players: v.players.map((m, i) => i === p ? { ...m, play: m.play.filter(x => !ids.has(x.id)) } : m) };
    const up = h.faceUp(v, c), out = [];
    for (const d of h.districts(draft, up)) {
        if (h.lethalBattleRisk(draft, up, d))
            continue;
        const after = { ...draft, players: draft.players.map((m, i) => i === p ? { ...m, play: [...m.play, { ...up, district: d }] } : m) };
        let spoilsContest = false;
        for (const [i, r] of v.districts.entries())
            if (r)
                for (const kind of ['battle', 'influence']) {
                    if (!h.contestPending(v, i, kind))
                        continue;
                    const before = h.total(v, p, i, kind) - h.total(v, 1 - p, i, kind), next = h.total(after, p, i, kind) - h.total(after, 1 - p, i, kind);
                    if (before > 0 && next <= 0)
                        spoilsContest = true;
                    if (kind === 'influence' && r.influence[p] + before - r.influence[1 - p] >= r.threshold && r.influence[p] + next - r.influence[1 - p] < r.threshold)
                        spoilsContest = true;
                }
        if (!spoilsContest)
            out.push({ command: { type: 'play', cardId: c.id, district: d, costIds: [...ids] }, score: 22 + h.value(c) + h.districtScore(draft, d, up) - Math.max(0, price - reduction) - sacrificeLoss });
    }
    return out;
}
