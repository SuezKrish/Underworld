import { hasCardType } from './card-types.mjs';
import { adjacentDistricts } from './task-districts.mjs';
const enabled = v => v.bot?.id === 'green-black-renown';
export function greenOpeningMulligan(v, h) {
    const hand = v.players[v.seat].hand, keep = new Set(), first = code => hand.find(c => c.catalogId === code), retain = c => {
        if (c)
            keep.add(c.id);
    };
    const boxer = first('BH07'), rider = first('JC014'), poet = first('BH09');
    retain(boxer);
    retain(rider);
    if (boxer || rider)
        retain(poet);
    // Keep the new two-mana draw line as a pair; an isolated situational
    // ambusher must not displace the opening Boxer merely by printed value.
    const employee = first('BH12'), host = employee && hand.filter(c => hasCardType(c, 'character') && !c.publicNow && (c.printedCost ?? 0) <= 3).sort((a, b) => Number(b.catalogId === 'LC02') - Number(a.catalogId === 'LC02') || Number(keep.has(a.id)) - Number(keep.has(b.id)) || h.value(a) - h.value(b))[0];
    if (employee && host) {
        retain(employee);
        retain(host);
    }
    for (const color of ['绿', '黑']) {
        const material = hand.filter(c => !keep.has(c.id) && !c.nonAssetNow && c.faction?.startsWith(color)).sort((a, b) => h.value(a) - h.value(b) || a.id.localeCompare(b.id))[0];
        retain(material);
    }
    return [{ type: 'mulligan', cardIds: hand.filter(c => !keep.has(c.id)).map(c => c.id) }];
}
function incomingAmbush(v, role, d, h) {
    if (role.catalogId !== 'LC02' || !role.faceDown || !(v.players[v.seat].loyalty?.factions?.绿 > 0))
        return 0;
    const entries = v.flow.stack.filter(a => a.controller !== v.seat && a.responseEffect?.characterEntry && a.responseEffect.enteringCard);
    let best = 0;
    for (const a of entries) {
        const c = a.responseEffect.enteringCard;
        if ((a.district ?? c.district) !== d || (c.printedCost ?? 0) < 5 || h.keyword(c, '混乱') || v.flow.stack.some(t => t.responseEffect?.terminatesEntries?.includes(a.id)))
            continue;
        const woundKill = (c.defense ?? 1) <= 1 && !h.keyword(c, '屏障') && !h.keyword(c, '永恒');
        best = Math.max(best, 68 + h.value(c) + (woundKill ? 30 : 0));
    }
    return best;
}
// Only legal adjacent destinations are considered. Hidden characters can
// contribute again after their original region's influence contest or escape
// its claim window; the same move can stage Finch before a public entry.
export function nightPatrolMoves(v, role, h, options) {
    if (!enabled(v) || !role?.faceDown || role.cannotMove)
        return [];
    const from = role.district, legal = adjacentDistricts(v, from), p = v.seat;
    const ds = options ? options.map(o => Number(o.id.slice(9))).filter(d => legal.includes(d)) : legal;
    const finished = !h.contestPending(v, from, 'influence');
    const claiming = ['claim-before', 'claim-after'].includes(v.turn?.step) && v.turn.district === from;
    return ds.flatMap(d => {
        const region = v.districts[d];
        if (!region || Number.isInteger(region.pendingWinner))
            return [];
        const ambush = incomingAmbush(v, role, d, h);
        let score = ambush;
        const upcoming = h.contestPending(v, d, 'influence') || claiming && (v.turn.phase === 'action' || v.turn.claimResume?.phase === 'action' || v.turn.phase === 'contest' && d > from);
        if ((finished || claiming) && upcoming) {
            const margin = h.total(v, p, d, 'influence') - h.total(v, 1 - p, d, 'influence'), point = Math.max(0, (region.points ?? 0) - (region.destroyed ?? 0));
            const star = h.icons(v, role, 'influence'), swing = margin <= 0 && margin + star > 0 ? 15 : margin === 0 ? 6 : 0;
            score = Math.max(score, 30 + swing + point * 2 + (claiming ? 14 : 0) + (v.players[p].play.some(c => c.catalogId === 'BH12' && c.attachedTo === role.id) ? 12 : 0) + Math.max(-12, Math.min(12, h.districtScore(v, d, role))));
        }
        if (!score)
            return [];
        return [{ district: d, score }];
    }).sort((a, b) => b.score - a.score || a.district - b.district);
}
export function greenCarmenTactics(v, h, add) {
    if (!enabled(v))
        return;
    const p = v.seat, own = v.players[p], foe = v.players[1 - p], available = h.pool(v), standard = v.turn.standardAllowed && v.flow.stepOwner === p && !v.flow.stack.length;
    const targets = foe.play.filter(c => !c.faceDown && hasCardType(c, 'attachment') && (c.printedCost ?? 0) <= 3 && !h.keyword(c, '永恒') && !c.barrierNow);
    if (!targets.length)
        return;
    const prize = Math.max(...targets.map(h.value)), level = pl => (pl.markers?.hidden ?? 0) - (pl.markers?.exposed ?? 0), extra = level(own) > level(foe) ? 0 : 3;
    for (const c of own.hand.filter(c => c.catalogId === 'CQ24' && c.castAllowed !== false && h.loyalty(v, c)))
        if (standard && (v.castingCosts?.[c.id] ?? h.cost(c)) + extra <= available) {
            for (const d of h.districts(v, h.faceUp(v, c)))
                if (!h.lethalBattleRisk(v, h.faceUp(v, c), d))
                    add({ type: 'play', cardId: c.id, district: d, payOptionalExtra: extra > 0 }, 54 + prize * 2 - extra * 4 + h.districtScore(v, d, h.faceUp(v, c)));
        }
    for (const c of own.play.filter(c => c.catalogId === 'CQ24' && c.faceDown && !c.paidRevealBlocked && h.loyalty(v, c)))
        if ((v.revealCosts?.[c.id] ?? h.cost(c)) + extra <= available && !h.lethalBattleRisk(v, h.faceUp(v, c), c.district))
            add({ type: 'reveal', cardId: c.id, payOptionalExtra: extra > 0 }, 65 + prize * 2 - extra * 4);
}
export function greenEmployeeSetup(v, c, h, d) {
    if (!enabled(v) || !hasCardType(c, 'character') || c.publicNow || v.round > 3 || v.players[v.seat].play.some(x => x.faceDown))
        return false;
    const m = v.players[v.seat], employee = m.hand.find(x => x.catalogId === 'BH12' && x.castAllowed !== false && h.loyalty(v, x)), price = employee ? v.castingCosts?.[employee.id] ?? 1 : Infinity;
    if (!employee || h.pool(v) < price + h.secretDeploymentPrice(v, d) || m.hand.length < 4 || m.deckCount <= h.drawReserve(v) + 2)
        return false;
    return h.contestPending(v, d, 'influence') && h.total(v, v.seat, d, 'influence') + 1 > h.total(v, 1 - v.seat, d, 'influence');
}
export function greenEmployeeScore(v, role, h) {
    if (!enabled(v) || !role?.faceDown || role.tapped || v.players[v.seat].play.some(c => c.catalogId === 'BH12' && c.attachedTo === role.id))
        return null;
    const p = v.seat, d = role.district, m = v.players[p];
    if (m.deckCount <= h.drawReserve(v) + 1 || !h.contestPending(v, d, 'influence'))
        return null;
    const margin = h.total(v, p, d, 'influence') - h.total(v, 1 - p, d, 'influence');
    if (margin <= 0)
        return null;
    return (v.round <= 3 ? 78 : 38) + Math.min(8, margin * 2) + (m.hand.some(c => c.catalogId === 'BQ020') ? 9 : 0);
}
export function greenEmployeeRevealHold(v, role, h) {
    if (!enabled(v) || !role.faceDown || !v.players[v.seat].play.some(c => c.catalogId === 'BH12' && c.attachedTo === role.id && !c.printedTextBlank && !c.abilitiesSuppressed))
        return false;
    const p = v.seat, d = role.district;
    if (v.players[p].deckCount <= h.drawReserve(v))
        return false;
    if (!h.contestPending(v, d, 'influence') || h.total(v, p, d, 'influence') <= h.total(v, 1 - p, d, 'influence'))
        return false;
    if (v.flow.stack.some(a => a.controller !== p && a.targetIds?.some(id => id === role.id || id === `hidden:${role.hiddenHandle}`)))
        return false;
    if (v.turn.step === 'contest-before' && v.turn.district === d && v.turn.kind === 'battle') {
        const before = h.total(v, p, d, 'battle') - h.total(v, 1 - p, d, 'battle'), after = before + h.icons(v, h.faceUp(v, role), 'battle');
        const kills = v.players[1 - p].play.some(c => !c.faceDown && c.district === d && !c.battleDamagePrevented && !h.keyword(c, '永恒') && after >= Math.max(1, (c.effectiveDefense ?? c.defense ?? 1) - (c.damage ?? 0)));
        if (before < 0 && after >= 0 || kills)
            return false;
    }
    return true;
}
