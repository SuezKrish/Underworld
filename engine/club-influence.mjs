import { controllerOf } from './ownership.mjs';
import { lockRegionWinner, lockRegionWinners } from './region-claims.mjs';
import { districtAttachmentVersionValid, districtNumber } from './task-districts.mjs';
import { influenceDecision } from './death-costs.mjs';
// district.influence is the aggregate used by effects and scoring. The cache
// records each club's contribution so its physical counters move with the card.
function clubs(s) {
    return Object.fromEntries(Object.entries(s.locations ?? {}).flatMap(([id, l]) => {
        const d = s.districts?.[l.district];
        return l.zone === 'play' && l.clubInfluence && d && l.attachedTo === `district-host:${d.id}` && districtAttachmentVersionValid(d, l.hostVersion) ? [[id, { districtId: d.id, counts: [...l.clubInfluence] }]] : [];
    }));
}
function sources(s, district, p, region, contributions) {
    const d = s.districts[district];
    return [
        ...(region > 0 ? [{ id: `district:${district}`, count: region, name: `地区${districtNumber(s, district)} · ${d.name}` }] : []),
        ...Object.entries(contributions).filter(([, c]) => c.districtId === d.id && c.counts[p] > 0).map(([id, c]) => ({ id: `club:${id}`, count: c.counts[p], name: `${s.cards[id].name} · 地区${districtNumber(s, district)}` }))
    ];
}
function allocation(s, district, kind, requests) {
    const automatic = {}, playerChoices = [];
    for (const { controller, options, count } of requests) {
        const total = options.reduce((n, o) => n + o.count, 0);
        if (!count)
            continue;
        if (count === total)
            automatic[controller] = options.map(o => ({ id: o.id, amount: o.count }));
        else if (options.length === 1)
            automatic[controller] = [{ id: options[0].id, amount: count }];
        else
            playerChoices.push({ controller, options, count });
    }
    // Both sides commit before either allocation is applied. No response window
    // is opened, and the opponent's selected locations stay private until then.
    if (!playerChoices.length)
        return automatic;
    const answer = influenceDecision(s, { kind, sourceName: s.districts[district].name, district, districtNumber: districtNumber(s, district), districtCardId: s.districts[district].id, playerChoices, committed: {} });
    for (const own of playerChoices) {
        const text = `${s.seats[own.controller].name}选择移除势力：${answer[own.controller].map(x => `${own.options.find(o => o.id === x.id).name} ${x.amount}个`).join('、')}。`;
        s.logs.push({ id: (s.logs.at(-1)?.id ?? 0) + 1, round: s.round, text });
    }
    return { ...automatic, ...answer };
}
function consume(region, contributions, p, allocations) {
    for (const { id, amount } of allocations ?? []) {
        if (id.startsWith('club:'))
            contributions[id.slice(5)].counts[p] -= amount;
        else
            region[p] -= amount;
    }
}
// Only active removals by cards or abilities qualify. Aggregate counts include
// every club in the region; cancellation and club departures do not qualify.
function factoryAfterRemoval(s, district, counts) {
    const d = s.districts[district];
    if (!d || s.turn?.phase === 'contest')
        return;
    const gains = s.players.flatMap(pl => pl.play).flatMap(id => { const l = s.locations[id], p = controllerOf(s, id); return []; });
    for (const { p, count } of gains)
        placeRegionInfluence(s, district, p, count);
}
function removed(s, p) { s.influenceRemovedRound ??= {}; s.influenceRemovedRound[p] = s.round; }
export function settleClubInfluence(s) {
    if (!s.clubInfluenceContributions) {
        lockRegionWinners(s);
        return;
    }
    const before = s.clubInfluenceContributions, next = clubs(s), settled = [];
    for (const [district, d] of (s.districts ?? []).entries()) {
        if (!d)
            continue;
        const region = [...d.influence];
        for (const old of Object.values(before))
            if (old.districtId === d.id)
                for (const p of [0, 1])
                    region[p] -= old.counts[p];
        // Old saved games may contain a total-only removal. Reconcile its deficit
        // without giving the region negative counters or creating enemy counters.
        for (const p of [0, 1])
            if (region[p] < 0) {
                const options = sources(s, district, p, 0, next), n = Math.min(-region[p], options.reduce((n, o) => n + o.count, 0));
                region[p] = 0;
                const pick = allocation(s, district, 'influence-removal', [{ controller: p, options, count: n }]);
                consume(region, next, p, pick[p]);
                if (n)
                    removed(s, p);
            }
        const totals = region.map((n, p) => n + Object.values(next).filter(c => c.districtId === d.id).reduce((n, c) => n + c.counts[p], 0)), count = Math.min(...totals);
        if (count > 0) {
            const pick = allocation(s, district, 'influence-cancellation', [0, 1].map(controller => ({ controller, count, options: sources(s, district, controller, region[controller], next) })));
            for (const p of [0, 1]) {
                consume(region, next, p, pick[p]);
                removed(s, p);
            }
        }
        settled.push([d, region.map((n, p) => n + Object.values(next).filter(c => c.districtId === d.id).reduce((n, c) => n + c.counts[p], 0))]);
    }
    for (const [d, counts] of settled) {
        d.influence = counts;
        lockRegionWinner(d);
    }
    for (const [id, c] of Object.entries(next))
        s.locations[id].clubInfluence = [...c.counts];
    if (Object.keys(next).length)
        s.clubInfluenceContributions = next;
    else
        delete s.clubInfluenceContributions;
}
export function placeRegionInfluence(s, district, p, n = 1) {
    settleClubInfluence(s);
    const d = s.districts[district];
    if (!d)
        return false;
    d.influence[p] += n;
    if (s.clubInfluenceContributions)
        settleClubInfluence(s);
    else {
        const count = Math.min(...d.influence);
        for (const who of [0, 1]) {
            d.influence[who] -= count;
            if (count)
                removed(s, who);
        }
    }
    lockRegionWinner(d);
    return true;
}
export function placeClubInfluence(s, id, p, n = 1) {
    const l = s.locations[id];
    if (l?.zone !== 'play' || l.faceDown)
        return false;
    settleClubInfluence(s);
    s.clubInfluenceContributions ??= {};
    l.clubInfluence ??= [0, 0];
    l.clubInfluence[p] += n;
    settleClubInfluence(s);
    return true;
}
export function regionInfluence(s, district) {
    const d = s.districts[district];
    if (!d)
        return [0, 0];
    const n = [...d.influence];
    for (const c of Object.values(s.clubInfluenceContributions ?? {}))
        if (c.districtId === d.id)
            for (const p of [0, 1])
                n[p] -= c.counts[p];
    return n;
}
export function influenceRemovalOptions(s, p) {
    settleClubInfluence(s);
    return (s.districts ?? []).flatMap((d, district) => !d ? [] : sources(s, district, p, regionInfluence(s, district)[p], s.clubInfluenceContributions ?? {}).map(o => ({ ...o, district, districtCardId: d.id, name: `${o.name}（${o.count}势力）` })));
}
export function removeSelectedInfluence(s, p, option) {
    const selected = influenceRemovalOptions(s, p).find(o => o.id === option);
    if (!selected)
        return false;
    if (option.startsWith('club:'))
        s.locations[option.slice(5)].clubInfluence[p]--;
    else
        s.districts[selected.district].influence[p]--;
    settleClubInfluence(s);
    removed(s, p);
    factoryAfterRemoval(s, selected.district, p === 0 ? [1, 0] : [0, 1]);
    return true;
}
export function removeRegionInfluence(s, district, p, n = Infinity) {
    settleClubInfluence(s);
    const d = s.districts[district];
    if (!d)
        return false;
    const count = Math.min(d.influence[p], n);
    if (!count)
        return false;
    const region = regionInfluence(s, district), next = clubs(s), options = sources(s, district, p, region[p], next), pick = allocation(s, district, 'influence-removal', [{ controller: p, options, count }]);
    consume(region, next, p, pick[p]);
    for (const [id, c] of Object.entries(next))
        s.locations[id].clubInfluence = [...c.counts];
    d.influence[p] -= count;
    if (Object.keys(next).length)
        s.clubInfluenceContributions = next;
    else
        delete s.clubInfluenceContributions;
    removed(s, p);
    factoryAfterRemoval(s, district, p === 0 ? [count, 0] : [0, count]);
    return true;
}
export function clearDistrictInfluence(s, district) {
    for (const p of [0, 1])
        removeRegionInfluence(s, district, p);
}
export function swapRegionInfluence(s, district, p) {
    settleClubInfluence(s);
    const d = s.districts[district];
    if (!d)
        return;
    const count = d.influence[1 - p];
    if (!count)
        return;
    removeRegionInfluence(s, district, 1 - p, count);
    placeRegionInfluence(s, district, p, count);
}
