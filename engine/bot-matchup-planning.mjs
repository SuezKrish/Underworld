import { nonDrawLockValue, nonDrawEffectBlocked } from './bot-draw-lock-planning.mjs';
import { projectedClaimOutcome } from './bot-claim-outcome.mjs';
import { hasCardType } from './card-types.mjs';
import { cardCapabilities, cardPlans, immediateDraws } from './bot-card-analysis.mjs';
import { graveyardPlanUses, pendingGraveyardUse } from './bot-graveyard-uses.mjs';
import { responseFilter } from './response-effect-semantics.mjs';
import { matchupPriorData } from './bot-matchup-priors.mjs';
const threatCache = new WeakMap();
const kinds = ['battle', 'investigation', 'influence'], cache = new WeakMap(), optionsCache = new WeakMap();
const mana = p => (p.costPool ?? 0) + (p.assets ?? []).filter(a => !a.tapped).length;
const colors = c => c?.factionColors ?? String(c?.faction ?? '').split('·')[0].split('').filter(c => '黄绿蓝红灰白黑紫'.includes(c));
const pendingEntryIds = v => new Set((v.flow?.stack ?? []).flatMap(a => a.responseEffect?.enteringCard ? [a.cardId, a.sourceId, a.responseEffect.enteringCard.id].filter(Boolean) : []));
const live = c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed;
const kw = (c, k) => c.keywordStates?.find(x => x.keyword === k)?.present ?? c.keywords?.includes(k);
const printed = (c, k, first) => Number(c.icons?.[k] ?? 0) + (first ? Number(c.temporaryIcons?.[k] ?? 0) : 0);
export function opponentColors(v) {
    const q = 1 - v.seat, counts = {};
    for (const c of colors(v.societies?.[q]))
        counts[c] = (counts[c] ?? 0) + 1;
    for (const a of v.players[q].assets ?? [])
        for (const c of colors(a))
            counts[c] = (counts[c] ?? 0) + 1;
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), sum = ranked.reduce((n, [, x]) => n + x, 0);
    return { main: ranked.filter(([, n]) => n === ranked[0]?.[1]).map(([c]) => c), secondary: ranked.filter(([, n]) => n < ranked[0]?.[1]).map(([c]) => c), shares: Object.fromEntries(ranked.map(([c, n]) => [c, n / sum])) };
}
function loyaltyReady(v, c, q) {
    const p = v.players[q], domains = { 心: '心灵', 圣: '神圣', 星: '星辰', 死: '死亡', 血: '鲜血' };
    if (p.ignoreLoyalty)
        return true;
    return Object.entries(c.loyalty ?? {}).every(([k, n]) => {
        if (k === '核')
            return !!p.coreArea;
        if (k === '紫' && v.societies?.[q]?.plan?.ignorePurpleLoyalty)
            return true;
        return ((domains[k] ? p.loyalty?.domains?.[domains[k]] : p.loyalty?.factions?.[k]) ?? 0) >= n;
    });
}
const standardAhead = (v, q) => v.turn?.phase === 'action' && (v.flow?.stepOwner === q || v.turn.firstPlayer !== q && v.turn.step === 'first-action');
function castReachable(v, c, q) {
    const plan = c.spell ?? c.attachment;
    if (plan?.actionPhaseOnly && v.turn?.phase !== 'action')
        return false;
    return plan?.timing === 'fast' ? v.turn?.phase !== 'setup' : standardAhead(v, q);
}
// These rows are refreshed for each new decision view, including after shuffle.
// Potential draws are bounded by the current mana budget, not the whole deck.
export function knownOpponentOptions(v) {
    if (optionsCache.has(v))
        return optionsCache.get(v);
    if (!v.hardInfo)
        return [];
    const q = 1 - v.seat, p = v.players[q], budget = mana(p), hand = p.hand ?? [], rows = [];
    let drawCost = 0, top = 0, bottom = 0;
    const watchers = p.play.filter(live).flatMap(c => (c.automation?.watch ?? []).filter(w => ['cast', 'entry'].includes(w.event) && w.own && ['draw', 'bottom-to-hand'].includes(w.effect)));
    for (const c of [...hand].sort((a, b) => (a.printedCost ?? 0) - (b.printedCost ?? 0))) {
        const cost = v.hardInfo.opponentCastingCosts?.[c.id] ?? c.printedCost ?? 0;
        rows.push({ card: c, origin: 'hand', cost, confidence: 1, available: cost <= budget && c.castAllowed !== false && loyaltyReady(v, c, q) && castReachable(v, c, q) });
        const draws = immediateDraws(c, ['cast', 'entry'], nonDrawEffectBlocked(v)), matching = watchers.filter(w => (w.event === 'cast' || hasCardType(c, 'character')) && responseFilter(c, w.filter) && (!w.subjectKeyword || kw(c, w.subjectKeyword))), extra = matching.filter(w => w.effect === 'draw' && !nonDrawEffectBlocked(v)).reduce((n, w) => n + (w.count ?? 1), 0), bottomExtra = matching.filter(w => w.effect === 'bottom-to-hand').reduce((n, w) => n + (w.count ?? 1), 0), draw = draws.top + draws.bottom + extra + bottomExtra;
        if (draw && cost + drawCost <= budget && loyaltyReady(v, c, q) && c.castAllowed !== false && castReachable(v, c, q)) {
            drawCost += cost;
            bottom += draws.bottom + bottomExtra;
            top += draws.top + extra;
        }
    }
    if (v.turn?.phase === 'start' && v.turn.step !== 'draw')
        top++;
    for (const c of p.play ?? [])
        if (c.faceDown && c.hardKnown && !pendingEntryIds(v).has(c.id) && !pendingEntryIds(v).has(c.hardObjectId)) {
            const cost = v.hardInfo.opponentRevealCosts?.[c.id] ?? c.printedCost ?? 0;
            rows.push({ card: c, origin: 'hidden', cost, confidence: 1, available: cost <= budget && !c.paidRevealBlocked && loyaltyReady(v, c, q) });
        }
    // Available face-up draw actions can expose a few
    // more cards. Never count an action whose source cannot pay its tap cost.
    for (const c of p.play.filter(live))
        for (const a of c.availableActions ?? []) {
            if (a.used || a.tap && (c.tapped || c.cannotTap) || (a.cost ?? 0) + drawCost > budget)
                continue;
            if (['draw', 'bottom-to-hand'].includes(a.effect) && !(a.effect === 'draw' && nonDrawEffectBlocked(v))) {
                drawCost += a.cost ?? 0;
                if (a.effect === 'bottom-to-hand')
                    bottom += a.count ?? 1;
                else
                    top += a.count ?? 1;
            }
        }
    // Queued triggered acquisitions include bottom-to-hand without treating them
    // as draw events in the rules engine.
    for (const a of v.flow?.stack ?? [])
        if (a.controller === q) {
            const d = immediateDraws({ spell: a.plan }, ['cast', 'entry'], nonDrawEffectBlocked(v));
            top += d.top;
            bottom += d.bottom;
        }
    const deck = v.hardInfo.opponentDeck ?? [], seen = new Set(rows.map(r => r.card.id));
    const flex = v.hardInfo.opponentCanControlLibrary;
    const fixed = v.hardInfo.opponentKnownPositions ?? [], pool = v.hardInfo.opponentDeckPool ?? [];
    const reached = new Set([...Array(Math.min(5, top, pool.length)).keys(), ...Array.from({ length: Math.min(3, bottom, pool.length) }, (_, i) => pool.length - 1 - i)]);
    const fixedReached = fixed.filter(x => reached.has(x.index)), freeSlots = Math.max(0, reached.size - fixedReached.length);
    const groups = flex ? [['known', fixedReached.map(x => x.card)], ['flexible', freeSlots ? pool.filter(c => !fixed.some(x => x.card.id === c.id)) : []]] : [['top', deck.slice(0, Math.min(5, top))], ['bottom', bottom ? deck.slice(-Math.min(3, bottom)) : []]];
    for (const [origin, cards] of groups)
        for (const c of cards) {
            if (seen.has(c.id))
                continue;
            seen.add(c.id);
            const cost = c.printedCost ?? 0;
            rows.push({ card: c, origin, cost, confidence: 0.55, drawCost, ...(origin === 'flexible' ? { acquisitionLimit: freeSlots } : {}), available: cost <= Math.max(0, budget - drawCost) && loyaltyReady(v, c, q) && castReachable(v, c, q) });
        }
    optionsCache.set(v, rows);
    return rows;
}
function rawForecast(v, h) {
    const q = 1 - v.seat, foe = v.players[q], first = v.turn?.firstPlayer === q;
    const districts = (v.districts ?? []).map((r, d) => r ? { district: d, current: Object.fromEntries(kinds.map(k => [k, h.total(v, q, d, k)])), projected: Object.fromEntries(kinds.map(k => [k, h.total(v, q, d, k)])), incoming: [] } : null);
    const prior = Object.fromEntries(kinds.map(k => [k, 1]));
    for (const [color, share] of Object.entries(opponentColors(v).shares)) {
        const row = matchupPriorData.colors[color];
        if (row)
            for (const k of kinds)
                prior[k] += share * ((row.weights[k] ?? 1) - 1);
    }
    if (v.hardInfo) {
        let budget = mana(foe);
        const candidates = knownOpponentOptions(v).filter(x => x.available && hasCardType(x.card, 'character'));
        const usable = candidates.filter(x => x.origin === 'hidden' || standardAhead(v, q));
        usable.sort((a, b) => kinds.reduce((n, k) => n + printed(b.card, k, first), 0) / (1 + b.cost) - kinds.reduce((n, k) => n + printed(a.card, k, first), 0) / (1 + a.cost));
        let drawPaid = false, flexUsed = 0;
        for (const x of usable.slice(0, 5)) {
            if (x.origin === 'flexible' && flexUsed >= x.acquisitionLimit)
                continue;
            const accessCost = !drawPaid ? (x.drawCost ?? 0) : 0;
            if (x.cost + accessCost > budget || kw(x.card, '迟缓') && x.origin !== 'hidden' || x.origin === 'hidden' && x.card.tapped)
                continue;
            const options = x.origin === 'hidden' ? districts.filter(r => r?.district === x.card.district) : districts.filter(Boolean);
            const score = r => kinds.reduce((n, k) => n + Math.min(printed(x.card, k, first), Math.max(0, h.total(v, v.seat, r.district, k) + 1 - r.projected[k])), 0);
            options.sort((a, b) => score(b) - score(a) || a.district - b.district);
            const d = options[0];
            if (!d)
                continue;
            if (x.origin === 'flexible')
                flexUsed++;
            budget -= x.cost + accessCost;
            if (x.drawCost)
                drawPaid = true;
            d.incoming.push({ id: x.card.id, origin: x.origin, confidence: x.confidence });
            for (const k of kinds)
                d.projected[k] += x.confidence * (printed(x.card, k, first) - (x.origin === 'hidden' ? h.icons(v, x.card, k) : 0));
        }
        for (const a of v.flow?.stack ?? [])
            if (a.controller === q && a.responseEffect?.enteringCard && Number.isInteger(a.district)) {
                const d = districts[a.district], c = a.responseEffect.enteringCard;
                if (d && !kw(c, '迟缓'))
                    for (const k of kinds)
                        d.projected[k] += printed(c, k, first);
            }
    }
    for (const d of districts.filter(Boolean)) {
        d.need = Object.fromEntries(kinds.map(k => [k, Math.max(0, d.projected[k] + 1 - h.total(v, v.seat, d.district, k))]));
        d.weights = Object.fromEntries(kinds.map(k => [k, v.hardInfo ? Math.min(1.8, 0.85 + d.projected[k] * 0.15) : prior[k]]));
    }
    return districts;
}
export function districtIconForecast(v, h) {
    if (!cache.has(v))
        cache.set(v, rawForecast(v, h));
    return cache.get(v);
}
export function matchupDistrictBonus(v, c, d, h) {
    const f = districtIconForecast(v, h)[d];
    if (!f || c.faceDown)
        return 0;
    let gain = 0;
    for (const k of kinds) {
        if (!h.contestPending(v, d, k))
            continue;
        const n = h.icons(v, { ...c, controller: v.seat }, k), need = f.need[k];
        // Only the marginal useful icons count. Investigation loses value when the
        // expected end-of-round hand is full or the library is close to exhaustion.
        const useful = Math.min(n, need), resource = k === 'investigation' ? (v.players[v.seat].deckCount <= 8 ? 0 : v.players[v.seat].hand.length >= (v.players[v.seat].handLimit ?? 7) ? 0.3 : 0.8) : 1;
        gain += resource * (useful * f.weights[k] * 1.8 + (need > 0 && n >= need ? 2 : 0));
    }
    return Math.min(14, gain);
}
export function graveInterruptionThreat(v, h) {
    if (threatCache.has(v))
        return threatCache.get(v);
    const q = 1 - v.seat, p = v.players[q], grave = p.graveyard ?? [];
    if (!grave.length)
        return { score: 0 };
    const foeView = { ...v, seat: q }, sources = [...knownOpponentOptions(v).filter(x => x.available), ...p.play.filter(live).map(c => ({ card: c, origin: 'field', confidence: 1, cost: 0 }))];
    let best = { score: 0 };
    for (const x of sources) {
        const c = x.card;
        if (c.printedTextBlank || c.abilitiesSuppressed)
            continue;
        for (const { plan, event } of cardPlans(c)) {
            if (x.origin === 'field' && ['entry', 'reveal', 'death', 'cast'].includes(event))
                continue;
            if (x.origin !== 'field' && ['death', 'prepare', 'end', 'watch'].includes(event))
                continue;
            if (plan.tap && (c.tapped || c.cannotTap) || plan.used || (plan.cost ?? 0) + (x.origin === 'field' ? 0 : x.cost ?? 0) + (x.drawCost ?? 0) > mana(p))
                continue;
            for (const use of graveyardPlanUses(plan, foeView)) {
                if (use.enemy || use.kind === 'recycle')
                    continue;
                for (const target of grave.filter(c => responseFilter(c, use.filter))) {
                    const cap = cardCapabilities(target), score = x.confidence * ((use.kind === 'enter' ? 16 : 8) + Math.min(12, h.value(target)) + (cap.draw + cap.removal) * 4);
                    if (score > best.score)
                        best = { score, sourceId: c.id, targetId: target.id, origin: x.origin };
                }
            }
        }
    }
    for (const c of grave) {
        if (pendingGraveyardUse(v, c.id, q))
            best = { score: Math.max(best.score, 60), targetId: c.id, origin: 'stack' };
    }
    threatCache.set(v, best);
    return best;
}
export function matchupHandBonus(v, c, h) {
    let score = 0;
    const caps = cardCapabilities(c), m = v.players[v.seat];
    if (c.automation?.static === 'block-non-draw') {
        const soc = v.societies?.[v.seat], counter = soc?.actions?.find(a => a.id === 'revival-counter');
        const revival = (soc?.counters?.revival ?? 0) + Number(!!counter && !counter.used && !soc.tapped);
        const budget = Math.max((m.costPool ?? 0) + (m.assets ?? []).filter(a => !a.tapped).length + (m.actionsUsed?.asset ? 0 : 1), (m.assets?.length ?? 0) + (m.actionsUsed?.asset ? 0 : 1), revival);
        if ((v.castingCosts?.[c.id] ?? c.printedCost ?? 0) <= budget + 1)
            score += Math.max(0, nonDrawLockValue(v, c)) * 0.5;
    }
    if (hasCardType(c, 'character'))
        score += Math.max(0, ...(v.districts ?? []).map((d, i) => d ? matchupDistrictBonus(v, c, i, h) : 0)) * 0.55;
    if (hasCardType(c, 'character'))
        for (const [d, r] of (v.districts ?? []).entries()) {
            if (!r || !h.contestPending(v, d, 'influence'))
                continue;
            const own = h.total(v, v.seat, d, 'influence'), foe = h.total(v, 1 - v.seat, d, 'influence'), gain = h.icons(v, { ...c, controller: v.seat }, 'influence');
            const net = (r.influence?.[v.seat] ?? 0) - (r.influence?.[1 - v.seat] ?? 0) + own - foe;
            if (net <= -r.threshold && net + gain > -r.threshold && projectedClaimOutcome(v, 1 - v.seat, d, h).wins)
                score = Math.max(score, 70);
            if (net < r.threshold && net + gain >= r.threshold && projectedClaimOutcome(v, v.seat, d, h).wins)
                score = Math.max(score, 80);
        }
    if (c.spell?.timing === 'fast' && c.spell.effect === 'grave-bottom-draw') {
        const threat = graveInterruptionThreat(v, h), held = m.hand.filter(x => x.id !== c.id && x.spell?.effect === 'grave-bottom-draw');
        score += Math.min(38, threat.score) * (held.length ? 0.3 : 1);
    }
    // The general capability layer also applies to cards outside preset decks.
    // Bounded bonuses supplement rather than overwrite specialized combo plans.
    if (caps.draw && (!nonDrawEffectBlocked(v) || caps.bottomDraw) && m.hand.length <= 3 && m.deckCount > 10)
        score += 3;
    const threats = opponentCapabilityForecast(v);
    if (caps.protection && threats.removal > 0)
        score += Math.min(7, threats.removal * 3);
    if (caps.removal) {
        const engines = v.players[1 - v.seat].play.filter(live).map(cardCapabilities);
        score += Math.min(6, engines.reduce((n, x) => n + x.draw + x.discount + x.grave, 0));
    }
    if (caps.discard && threats.protection > 0)
        score += Math.min(4, threats.protection * 2);
    if (caps.discard && (v.players[1 - v.seat].handCount ?? 0) > 0)
        score += 2;
    return score;
}
const capabilityCache = new WeakMap();
// A capability is evidence of a possible threat, not proof that a particular
// target is legal. Existing target/response evaluators still decide execution.
export function opponentCapabilityForecast(v) {
    if (capabilityCache.has(v))
        return capabilityCache.get(v);
    const out = { draw: 0, removal: 0, protection: 0, discount: 0, grave: 0, discard: 0 }, alternatives = [];
    for (const x of knownOpponentOptions(v).filter(x => x.available)) {
        const cap = cardCapabilities(x.card), confidence = x.confidence * (cap.heuristic ? 0.5 : 1);
        if (x.origin === 'flexible') {
            alternatives.push({ cap, confidence, limit: x.acquisitionLimit });
            continue;
        }
        for (const k of Object.keys(out))
            out[k] += Math.min(3, cap[k]) * confidence;
    }
    for (const k of Object.keys(out))
        out[k] += alternatives.map(x => Math.min(3, x.cap[k]) * x.confidence).sort((a, b) => b - a).slice(0, alternatives[0]?.limit ?? 0).reduce((n, x) => n + x, 0);
    capabilityCache.set(v, out);
    return out;
}
