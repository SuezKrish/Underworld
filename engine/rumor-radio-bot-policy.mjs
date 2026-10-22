import { hasCardType } from './card-types.mjs';
export const radioBot = v => v.bot?.id === 'rumor-radio';
const mine = v => v.players[v.seat];
const field = v => mine(v).play.filter(c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed);
const phase = v => field(v).find(c => c.catalogId === 'WM004');
const shepherd = v => field(v).find(c => c.catalogId === 'WM066');
const station = v => field(v).find(c => c.catalogId === 'WM095');
const key = c => ['WM004', 'WM066'].includes(c.catalogId);
const copies = (v, id) => mine(v).play.some(c => c.catalogId === id) || mine(v).hand.some(c => c.catalogId === id);
const payloads = (v, h) => mine(v).hand.filter(c => h.keyword(c, '传闻'));
const sealed = (v, id) => (v.sealed ?? []).filter(c => c.hostId === id);
const pendingReturns = (v, c) => v.flow.stack.filter(a => a.controller === v.seat && a.cardId === c.id && a.actionIndex === 1 && a.sourceZoneVersion === c.zoneVersion);
const pendingBlink = (v, c) => v.flow.stack.some(a => a.controller === v.seat && a.cardId === c.id && a.actionIndex === 0 && a.sourceZoneVersion === c.zoneVersion);
function paymentScore(v, c, h) {
    let n = c.catalogId === 'XQ41' ? 60 : c.catalogId === 'WM089' ? 45 : c.catalogId === 'WM095' ? 20 : c.catalogId === 'WM069' ? 12 : 25 - h.handValue(v, c);
    if (c.catalogId === 'WM066' && !shepherd(v))
        n -= 100;
    if (c.catalogId === 'CQ32' && !mine(v).markers.hidden)
        n -= 20;
    return n;
}
export function radioHandBonus(v, c) {
    if (!radioBot(v))
        return 0;
    return c.catalogId === 'WM004' && !mine(v).play.some(x => x.catalogId === 'WM004') ? 40 : c.catalogId === 'WM066' && !mine(v).play.some(x => x.catalogId === 'WM066') ? 38 : c.catalogId === 'WM095' && !station(v) ? 30 : c.catalogId === 'XQ41' ? 10 : c.catalogId === 'WM089' ? 4 : 0;
}
export function radioAssetBonus(v, c) {
    if (!radioBot(v))
        return 0;
    const color = c.faction?.split('·')[0], have = mine(v).loyalty?.factions ?? {}, need = { 紫: 2, 黄: 1, 黑: 1 };
    let n = (have[color] ?? 0) < (need[color] ?? 0) ? -45 : 0;
    if (key(c) && !mine(v).play.some(x => x.catalogId === c.catalogId) && mine(v).hand.filter(x => x.catalogId === c.catalogId).length === 1)
        n += 75;
    if (c.catalogId === 'WM095' && !station(v) && mine(v).hand.filter(x => x.catalogId === 'WM095').length === 1)
        n += 60;
    return n;
}
export function radioPreferHidden(v, c) { return radioBot(v) && key(c); }
export function radioDeployAllowed(v, c) { return !radioBot(v) || !key(c) || !mine(v).play.some(x => x.catalogId === c.catalogId); }
export function radioDistrictBonus(v, d, c) {
    if (!radioBot(v))
        return 0;
    if (key(c) && c.faceDown) {
        const danger = v.players[1 - v.seat].play.filter(x => x.district === d && !x.tapped).reduce((n, x) => n + (x.faceDown ? 1 : (x.effectiveIcons?.influence ?? 0)), 0) + (v.districts[d]?.influence[1 - v.seat] ?? 0);
        return (d === 0 ? 28 : d === 1 ? 10 : 0) - danger * 12;
    }
    return 0;
}
function ready(v, h) { return !!shepherd(v) && !!station(v) && !!phase(v) && payloads(v, h).length > 0; }
export function radioReserve(v) {
    if (!radioBot(v) || !station(v) || !['action', 'start'].includes(v.turn.phase))
        return 0;
    const hidden = mine(v).play.find(c => c.catalogId === 'WM004' && c.faceDown);
    return hidden && v.round >= 3 && mine(v).play.some(c => c.catalogId === 'WM066') ? (v.revealCosts?.[hidden.id] ?? 4) : 0;
}
export function radioGoals(v, h) {
    if (v.turn.phase !== 'contest' || v.turn.firstPlayer !== v.seat)
        return [];
    return v.districts.flatMap((d, i) => d && h.contestPending(v, i, 'influence') ? [{ district: i, need: Math.max(0, d.threshold - (d.influence[v.seat] ?? 0) + (d.influence[1 - v.seat] ?? 0) + h.total(v, 1 - v.seat, i, 'influence') - h.total(v, v.seat, i, 'influence')) }] : []);
}
function tokenDistricts(v, h, opts) { const goals = radioGoals(v, h); return h.sorted(opts, o => { const d = Number(o.id.slice(9)), g = goals.find(x => x.district === d); return (g?.need > 0 ? 100 + g.need * 3 + (v.districts[d]?.points ?? 0) : 0) - d * 0.1; }); }
export function radioReveal(v, c, h) {
    if (!radioBot(v) || !key(c))
        return undefined;
    if (c.tapped)
        return null;
    const cost = v.revealCosts?.[c.id] ?? h.cost(c), available = h.pool(v);
    if (v.turn.phase === 'end' && v.turn.firstPlayer !== v.seat && station(v) && copies(v, c.catalogId === 'WM004' ? 'WM066' : 'WM004'))
        return c.catalogId === 'WM004' ? 105 : 85;
    if (v.turn.phase !== 'contest' || v.turn.firstPlayer !== v.seat || !station(v) || !payloads(v, h).length)
        return null;
    const other = c.catalogId === 'WM004' ? shepherd(v) : phase(v), hiddenOther = mine(v).play.find(x => x.catalogId === (c.catalogId === 'WM004' ? 'WM066' : 'WM004') && x.faceDown);
    if (!other && !hiddenOther)
        return null;
    if (available < cost + (other ? 0 : (v.revealCosts?.[hiddenOther.id] ?? h.cost(hiddenOther))) + 2)
        return null;
    if (h.lethalBattleRisk(v, h.faceUp(v, c), c.district))
        return null;
    return c.catalogId === 'WM004' ? 95 : 92;
}
export function radioMulligan(v, h) {
    if (!radioBot(v))
        return null;
    const hand = mine(v).hand, keep = new Set();
    for (const id of ['WM004', 'WM066', 'WM095']) {
        const c = hand.find(c => c.catalogId === id);
        if (c)
            keep.add(c.id);
    }
    for (const color of ['紫', '黄', '黑']) {
        const c = h.sorted(hand.filter(c => !c.nonAssetNow && !keep.has(c.id) && c.faction?.startsWith(color)), c => h.handValue(v, c), false)[0];
        if (c)
            keep.add(c.id);
    }
    return [{ type: 'mulligan', cardIds: hand.filter(c => !keep.has(c.id)).map(c => c.id) }];
}
export function radioTrigger(v, a, h) {
    if (!radioBot(v))
        return null;
    const base = { type: 'trigger-choice', triggerId: a.id };
    if (a.effect?.kind === 'seal-from-graveyard') {
        const anchor = phase(v);
        if (anchor)
            return [{ ...base, fire: true, targetId: anchor.id }, { ...base, fire: false }];
    }
    if (a.plan?.operation === 'calamity-blank') {
        const host = h.lookup(v, a.plan.eventHost?.hostId);
        if (host?.controller === v.seat)
            return [{ ...base, fire: false }];
    }
    if (a.plan?.effect === 'spawn-token' && a.plan.catalogId === 'TK005') {
        const opts = v.abilityTargets?.[a.id] ?? [];
        return [...tokenDistricts(v, h, opts).map(o => ({ ...base, fire: true, targetIds: [o.id] })), { ...base, fire: false }];
    }
    if (a.plan?.operation === 'hidden-start' && mine(v).markers.hidden > 0)
        return [{ ...base, fire: false }];
    if (a.plan?.effect === 'draw' && a.cardId && (v.sealed ?? []).some(c => c.id === a.cardId && c.catalogId === 'XQ41'))
        return [{ ...base, fire: mine(v).deckCount > 0, targetIds: [] }];
    return null;
}
export function radioChoice(v, a, h) {
    if (!radioBot(v))
        return null;
    const base = { type: 'effect-choice', choiceId: a.id }, cards = a.cards ?? [];
    if (a.kind === 'discard-deck-rigoletto')
        return h.sorted(cards, c => (c.subtypes?.includes('梦魇') ? 40 : 0) - h.handValue(v, c)).map(c => ({ ...base, cardId: c.id }));
    if (a.kind === 'search' && a.hostName?.includes('幻境之茧')) {
        const candidates = cards.filter(c => c.catalogId === 'XQ41' || c.catalogId !== 'WM066' || shepherd(v));
        return h.sorted(candidates, c => c.catalogId === 'XQ41' ? 50 : 0).map(c => ({ ...base, cardId: c.id })).concat(a.canFail ? [{ ...base, fail: true }] : []);
    }
    if (a.kind === 'search' && cards.some(c => hasCardType(c, 'character')))
        return h.sorted(cards, c => h.handValue(v, c)).map(c => ({ ...base, cardId: c.id })).concat(a.canFail ? [{ ...base, fail: true }] : []);
    return null;
}
export function radioHiddenScore(v, c, h) {
    if (!radioBot(v))
        return undefined;
    const strength = h.hiddenStrength(c, v);
    return strength * (mine(v).markers.hidden ? 1 : 3.5) - h.handValue(v, c) * (mine(v).markers.hidden ? 2 : 0.8);
}
export function radioTactics(v, h, add) {
    if (!radioBot(v))
        return;
    const p = v.seat, available = h.pool(v), standard = v.turn.standardAllowed && v.flow.stepOwner === p && !v.flow.stack.length, goals = radioGoals(v, h), need = goals.reduce((n, g) => n + g.need, 0), anchor = phase(v);
    if (anchor) {
        const actions = anchor.availableActions ?? [], returns = pendingReturns(v, anchor), blinking = pendingBlink(v, anchor), cards = h.sorted(payloads(v, h), c => paymentScore(v, c, h));
        const top = v.flow.stack.at(-1), aboveReturn = top && !(top.cardId === anchor.id && top.actionIndex === 1 && top.sourceZoneVersion === anchor.zoneVersion);
        const recycle = returns.length && !aboveReturn && sealed(v, anchor.id).length > 0 && (!cards.length || need === 0);
        if (actions[0] && !blinking && available >= 2 && (recycle || v.flow.stack.some(a => a.controller !== p && a.targetIds?.includes(anchor.id))))
            add({ type: 'activate', cardId: anchor.id, actionIndex: 0, targetIds: [] }, 160);
        if (actions[1] && ready(v, h) && need > 0 && available >= 2 && !blinking && !aboveReturn && cards.length)
            add({ type: 'activate', cardId: anchor.id, actionIndex: 1, targetIds: [], discardIds: [cards[0].id] }, 145);
    }
    for (const c of mine(v).hand) {
        if (c.castAllowed === false || !h.loyalty(v, c) || h.duplicate(v, c))
            continue;
        const plan = c.spell ?? c.attachment;
        if (!plan || plan.timing !== 'fast' && !standard)
            continue;
        const price = v.castingCosts?.[c.id] ?? h.cost(c);
        if (price > available)
            continue;
        const base = { type: 'play', cardId: c.id }, opts = v.spellTargets?.[c.id] ?? [];
        if (c.catalogId === 'WM095' && standard && !station(v))
            add({ ...base, targetIds: [`society:${p}`] }, 85);
        if (c.catalogId === 'WM063' && standard && !field(v).some(x => x.catalogId === 'WM063') && available - radioReserve(v) >= price)
            add({ ...base, targetIds: [`society:${p}`] }, 25);
        if (['BQ091', 'XG28'].includes(c.catalogId) && standard && available - radioReserve(v) >= price)
            for (const o of opts)
                add({ ...base, targetIds: [o.id] }, 16 + h.districtScore(v, Number(o.id.slice(9)), c));
        if (c.catalogId === 'JZ55' && (v.turn.phase === 'contest' || !radioReserve(v) || v.flow.stack.some(a => a.controller !== p && a.targetIds?.some(id => key(h.lookup(v, id) ?? {})))))
            for (const o of opts) {
                const x = h.lookup(v, o.id);
                if (x?.controller === 1 - p && !h.targetedByUs(v, o.id))
                    add({ ...base, targetIds: [o.id] }, 28 + h.value(x));
            }
    }
    if (standard)
        for (const c of field(v))
            for (const [i, a] of (c.availableActions ?? []).entries()) {
                if (a.used || a.tap && c.tapped || available < (a.cost ?? 0))
                    continue;
                const base = { type: 'activate', cardId: c.id, actionIndex: i, targetIds: [] }, opts = v.abilityTargets?.[`${c.id}:${i}`] ?? [];
                if (c.catalogId === 'XG28' && available - radioReserve(v) >= 2) {
                    const stamp = `radio-retrieve:${v.round}:${v.turn.priorityStepKey}:${c.id}`;
                    if (v.bot.actionKeys?.includes(stamp))
                        continue;
                    for (const o of h.orderedTargets(v, opts, true)) {
                        const x = h.lookup(v, o.id);
                        add({ ...base, targetIds: [o.id] }, 25 + h.handValue(v, x), stamp);
                    }
                }
                if (c.catalogId === 'WM063' && i === 0 && !ready(v, h) && mine(v).deckCount > h.drawReserve(v) && available - radioReserve(v) >= 2) {
                    const card = h.sorted(mine(v).hand.filter(x => hasCardType(x, 'spell')), x => h.handValue(v, x), false)[0];
                    if (card)
                        add({ ...base, discardIds: [card.id] }, 20);
                }
            }
}
