import { hasCardType } from './card-types.mjs';
import { wheelRecoveryDraw } from './spell-graveyard-planning.mjs';
import { claimRecyclingBot, libraryRunway } from './bot-library-safety.mjs';
import { responseFilter } from './response-effect-semantics.mjs';
// Reserve this round's possible investigations, the next round's districts
// and normal draws. The floor also protects against a small opposing mill.
export function libraryReserve(v, h = {}) {
    if (wheelRecoveryDraw(v))
        return 0;
    const districts = (v.districts ?? []).filter(Boolean).length;
    const pending = (v.districts ?? []).filter((d, i) => d && (h.contestPending ? h.contestPending(v, i, 'investigation') : ['setup', 'start', 'action', 'contest'].includes(v.turn?.phase))).length;
    return Math.max(6, 2 + districts + pending, claimRecyclingBot(v) ? libraryRunway(v, h).reserve : 0);
}
// Forecast cards left after the remaining ordinary actions and visible
// investigation rewards. A full hand now is not necessarily a full hand at
// recovery. Unknown opposing hands and future draws are never inspected.
export function endHandForecast(v, h = {}) {
    const p = v.seat, m = v.players[p], turn = v.turn ?? {}, hand = m.hand ?? [], limit = m.handLimit ?? 7;
    let income = (v.flow?.stack ?? []).filter(a => a.controller === p).reduce((n, a) => n + (a.responseEffect?.handGain ?? drawIncome(a.plan)), 0), spend = 0;
    const actionAhead = ['setup', 'start'].includes(turn.phase) || turn.phase === 'action' && (v.flow?.stepOwner === p || turn.firstPlayer !== p && turn.step === 'first-action');
    if (actionAhead) {
        let mana = (m.costPool ?? 0) + (m.assets ?? []).filter(c => !c.tapped).length;
        const remaining = [...hand];
        const material = remaining.findLastIndex(c => !c.nonAssetNow && !c.keywords?.includes('非资产'));
        if (!m.actionsUsed?.asset && m.assets.length < 8 && material >= 0) {
            spend++;
            remaining.splice(material, 1);
            mana++;
        }
        if (!m.actionsUsed?.secret && !m.secretDeploymentBlocked && mana >= 1) {
            const i = remaining.findIndex(c => hasCardType(c, 'character') && !c.publicNow && !c.keywords?.includes('公开') && !c.automation?.noPaidReveal &&
                (v.deploymentRevealCosts?.[c.id] ?? v.revealCosts?.[c.id] ?? c.printedCost ?? 0) <= Math.max(mana - 1, m.assets.length + 1) &&
                (c.concealedOnlyNow || c.automation?.reveal));
            if (i >= 0) {
                spend++;
                remaining.splice(i, 1);
                mana--;
            }
        }
        const playable = remaining.filter(c => c.castAllowed !== false && !c.concealedOnlyNow && (!h.loyalty || h.loyalty(v, c)) && (!h.duplicate || !h.duplicate(v, c)) &&
            (!(c.spell ?? c.attachment)?.target || ['none', 'own-society'].includes((c.spell ?? c.attachment).target) || !v.spellTargets || v.spellTargets[c.id]?.length))
            .map(c => ({ c, cost: Math.max(0, (v.castingCosts?.[c.id] ?? (Number(c.printedCost) || 0)) - (c.automation?.revealHandDiscount ? remaining.filter(x => x.id !== c.id && (x.faction?.split('·')[1] === '圣贤' || x.magicDomains?.includes('神圣'))).length : 0)) })).sort((a, b) => a.cost - b.cost);
        let casts = 0;
        for (const { c, cost } of playable)
            if (casts < 3 && cost <= mana) {
                mana -= cost;
                spend++;
                income += castRefill(v, c);
                casts++;
            }
    }
    const budget = Math.max(0, (m.deckCount ?? 50) - libraryReserve(v, h));
    if (h.total && h.contestPending)
        for (let d = 0; d < (v.districts ?? []).length; d++)
            if (v.districts[d] && h.contestPending(v, d, 'investigation') && h.total(v, p, d, 'investigation') > h.total(v, 1 - p, d, 'investigation'))
                income++;
    return { hand: hand.length, spend, income: Math.min(income, budget), projected: Math.max(0, hand.length - spend + Math.min(income, budget)), limit };
}
export function resourcePriorities(v, h = {}) {
    const p = v.players[v.seat], forecast = endHandForecast(v, h), reserve = libraryReserve(v, h), critical = (p.deckCount ?? 50) <= reserve;
    const stocked = forecast.projected >= forecast.limit, race = critical || libraryRunway(v, h).pressure || v.round >= 6 && stocked || v.round >= 4 && forecast.projected >= forecast.limit + 2;
    return { ...forecast, reserve, critical, stocked, race, investigation: critical ? -14 : race ? 1 : stocked ? 4 : 12, battle: stocked ? 7 : 0, influence: race ? 12 : stocked ? 6 : 2 };
}
function drawIncome(plan) {
    if (!plan || typeof plan !== 'object')
        return 0;
    return (['draw', 'bottom-to-hand'].includes(plan.effect) ? plan.count ?? 1 : 0) + (plan.steps ?? []).reduce((n, p) => n + drawIncome(p), 0);
}
function castRefill(v, c) {
    const entry = drawIncome(c.spell ?? c.automation?.entry ?? c.attachment?.entry);
    const watches = v.players[v.seat].play.filter(x => !x.faceDown && !x.printedTextBlank && !x.abilitiesSuppressed).flatMap(x => x.automation?.watch ?? []);
    return entry + watches.reduce((n, w) => n + (w.event === 'cast' && w.own && w.effect === 'draw' &&
        responseFilter(c, w.filter) && !w.limitPerRound ? (w.count ?? 1) : 0), 0);
}
// Count cards actually removed from our library, rather than all cards merely
// inspected. Top-select-hand also mills its unchosen cards. Environment modes
// are alternatives; they are evaluated when the mode is selected.
export function libraryUse(a, seat = a.controller) {
    function count(plan) {
        if (!plan || typeof plan !== 'object')
            return 0;
        const player = plan.player, ours = player === undefined || player === 'self' || player === 'winner' || player === seat;
        let n = ['draw', 'bottom-to-hand', 'seal-top', 'seal-search', 'mill-self-one', 'top-select-hand'].includes(plan.effect) ? plan.count ?? 1 : plan.operation === 'liliel-discard' ? 1 : (plan.kind === 'draw' && ours || plan.kind === 'draw-both') ? plan.count ?? 1 : 0;
        for (const child of plan.steps ?? [])
            n += count(child);
        for (const child of plan.ops ?? [])
            n += count(child);
        return n;
    }
    return a.plan ? count(a.plan) : a.ops ? a.ops.reduce((n, p) => n + count(p), 0) : a.responseEffect?.libraryUse ?? 0;
}
export function libraryBudget(v, h = {}) {
    const queued = (v.flow?.stack ?? []).filter(a => a.controller === v.seat).reduce((n, a) => n + libraryUse(a, v.seat), 0);
    return Math.max(0, (v.players[v.seat].deckCount ?? 50) - libraryReserve(v, h) - queued);
}
export function optionalRefillUseful(v, a, h = {}) {
    const plan = a.plan ?? {}, state = resourcePriorities(v, h);
    if (libraryUse(a, v.seat) > libraryBudget(v, h))
        return false;
    if (wheelRecoveryDraw(v))
        return true;
    const onlyRefill = plan.effect === 'draw' || plan.effect === 'bottom-to-hand' || plan.operation === 'liliel-discard';
    return !(onlyRefill && state.race && state.projected > state.limit);
}
function handCount(p) { return p.handCount ?? p.hand?.length ?? 0; }
function cardMarginal(n, limit) { return n <= 2 ? 9 : n <= 4 ? 6 : n <= limit ? 3 : 0.2; }
function handDelta(v, seat, delta) {
    const p = v.players[seat], count = handCount(p), limit = p.handLimit ?? 7;
    let value = 0;
    for (let i = 0; i < Math.abs(delta); i++) {
        if (delta < 0 && i >= count)
            break;
        value += (delta > 0 ? 1 : -1) * cardMarginal(delta > 0 ? count + i + 1 : count - i, limit);
    }
    return value;
}
// Evaluate the two players' public resource changes. A gift to a player with
// one card is substantially more useful than another card above our limit.
export function regionRewardUtility(v, ops, h = {}) {
    const p = v.seat, q = 1 - p;
    function score(o) {
        if (o.kind === 'mode')
            return Math.max(...(o.modes ?? []).map(m => regionRewardUtility(v, m.ops ?? [], h)), 0);
        if (o.kind === 'optional')
            return Math.max(0, regionRewardUtility(v, o.ops ?? [], h));
        if (o.kind === 'draw-both')
            return score({ kind: 'draw', player: p, count: o.count }) + score({ kind: 'draw', player: q, count: o.count });
        if (o.kind === 'simultaneous-search' && o.destination === 'hand')
            return score({ kind: 'search', player: p, destination: 'hand' }) + score({ kind: 'search', player: q, destination: 'hand' });
        if (o.kind === 'search' && o.destination === 'hand')
            return score({ kind: 'draw', player: o.player, count: 1 }) * 1.1;
        if (['draw', 'discard'].includes(o.kind)) {
            const seat = o.player === 'other' ? q : o.player === 'first' ? v.turn.firstPlayer : o.player === 'second' ? 1 - v.turn.firstPlayer : Number.isInteger(o.player) ? o.player : p;
            const n = o.count ?? 1, delta = o.kind === 'draw' ? n : -Math.min(n, handCount(v.players[seat]));
            let utility = handDelta(v, seat, delta);
            if (o.kind === 'draw' && seat === p) {
                const deck = v.players[p].deckCount ?? 50;
                if (deck < n)
                    return -1000;
                if (n > libraryBudget(v, h))
                    utility -= 30;
            }
            return seat === p ? utility : -utility * 0.95;
        }
        // Preserve existing decisions for unrelated region rewards; do not assume
        // that all effects with a choice are card-draw rewards.
        return 3;
    }
    return (ops ?? []).reduce((n, o) => n + score(o), 0);
}
export function regionTriggerUseful(v, a, h = {}) { return !!a.mandatory || !a.ops?.length || regionRewardUtility(v, a.ops, h) > 0.5; }
export function lakeShouldShuffle(v, h = {}) {
    const d = v.districts?.[v.turn.district], cards = (v.sealed ?? []).filter(c => c.hostId === `district-host:${d?.id}`);
    if (!cards.length)
        return true;
    let gain = 0;
    for (const seat of [v.seat, 1 - v.seat]) {
        const owned = cards.filter(c => c.owner === seat);
        let n = handCount(v.players[seat]);
        for (const c of owned) {
            const quality = 0.75 + Math.min(16, (seat === v.seat ? h.handValue?.(v, c) : undefined) ?? h.value?.(c) ?? 4) / 16;
            gain += (seat === v.seat ? 1 : -0.95) * cardMarginal(++n, v.players[seat].handLimit ?? 7) * quality;
        }
    }
    // Replenishing our nearly exhausted library also has concrete value.
    for (const seat of [v.seat, 1 - v.seat])
        if ((v.players[seat].deckCount ?? 50) <= libraryReserve(v, h))
            gain += (seat === v.seat ? -1 : 0.95) * cards.filter(c => c.owner === seat).length * 12;
    return gain <= 0;
}
export function secrecyReward(v, h = {}) {
    const p = v.seat, m = v.players[p], other = v.players[1 - p], markers = m.effectiveMarkers ?? m.markers ?? {}, opponent = other.effectiveMarkers ?? other.markers ?? {}, forecast = endHandForecast(v, h);
    const first = (markers.hidden ?? 0) === 0, profiles = { 'white-anglican': 7, 'yellow-white-spells': 9, 'blue-dragon-feast': 12, 'shoggoth-locking': 7, 'red-monastery': 7, 'purple-matriarch': 9, 'black-purple-criminals': 8 };
    let hidden = 0.6 + (first ? (profiles[v.bot?.id] ?? 0) : v.bot?.id === 'blue-dragon-feast' ? 3 : 0);
    hidden += Math.min(3, Math.max(0, forecast.projected - forecast.limit)) * 6;
    if ((markers.exposed ?? 0) > 0)
        hidden += 4;
    let exposed = 1.5;
    if ((opponent.hidden ?? 0) > 0)
        exposed += 5;
    if (handCount(other) >= (other.handLimit ?? 7))
        exposed += 3;
    ;
    return hidden >= exposed ? 'hidden' : 'exposed';
}
const drawEffects = new Set(['draw', 'search-filtered', 'grave-to-hand', 'top-select-hand']);
function replenishes(plan) {
    if (!plan || typeof plan !== 'object')
        return false;
    if (drawEffects.has(plan.effect) || plan.castingDiscount || plan.revealDiscount)
        return true;
    return Object.values(plan).some(x => Array.isArray(x) ? x.some(replenishes) : x && typeof x === 'object' && replenishes(x));
}
export function recurringEngine(c) {
    if (c.faceDown || c.printedTextBlank || c.abilitiesSuppressed)
        return false;
    const a = c.automation ?? {};
    return !!(a.castingDiscount || a.revealDiscount || replenishes(a.watch) || replenishes(a.actions ?? a.action) ||
        replenishes(a.prepare ?? a.prepareTrigger ?? a.preparation) || replenishes(a.end ?? a.endTrigger) ||
        ['uncounterable-own-effects', 'reputation-defense-barrier', 'vampire-hidden-bonus', 'time-influence'].includes(a.static) ||
        a.scarabStatic === 'attachment-asset-barrier' || a.auras?.some(g => g.own && (Object.values(g.icons ?? {}).some(n => n > 0) || g.defense > 0 || g.grantKeywords?.length)));
}
// An active engine can repay its owner before it threatens our board. Use
// public recurring abilities, rather than printed cost alone, to spend removal
// proactively. A region already due to clear offers little future engine value.
export function removalEngineTempoBonus(v, c, h) {
    if (!c || c.controller === v.seat || !hasCardType(c, 'character') || !recurringEngine(c))
        return 0;
    const r = v.districts?.[c.district], q = 1 - v.seat;
    if (r) {
        if (r.pendingWinner !== null && r.pendingWinner !== undefined || r.influence.some(n => n >= r.threshold))
            return 0;
        const net = r.influence[0] - r.influence[1] + h.total(v, 0, c.district, 'influence') - h.total(v, 1, c.district, 'influence');
        const winner = net > 0 ? 0 : 1, points = Math.max(0, (r.points ?? 0) - (r.destroyed ?? 0));
        if (h.contestPending(v, c.district, 'influence') && Math.abs(net) >= r.threshold &&
            (v.players[winner].score ?? 0) + points < (v.players[winner].victoryThreshold ?? 8))
            return 0;
    }
    const white = (c.effectiveTemporaryIcons ?? c.temporaryIcons)?.investigation ?? 0;
    const eyes = c.effectiveIcons ? Math.max(0, (c.effectiveIcons.investigation ?? 0) - (v.turn.firstPlayer === q && !c.whiteIconsConvertedNow ? white : 0)) : c.icons?.investigation ?? 0;
    const growth = c.automation?.static === 'time-influence' ? 4 : 0;
    const race = Math.max(...v.players.map(p => (p.score ?? 0) / (p.victoryThreshold ?? 8)));
    return (10 + Math.min(8, eyes * 4) + growth) * (race >= 0.75 ? 0.6 : 1);
}
function projectedInfluence(v, c, p, first, reset = false) {
    if (c.tapped && !reset || c.nonBattleParticipationBlocked)
        return 0;
    if (c.faceDown)
        return c.influenceIcons ?? 1;
    const white = (c.effectiveTemporaryIcons ?? c.temporaryIcons)?.influence ?? 0;
    const black = c.effectiveIcons ? Math.max(0, (c.effectiveIcons.influence ?? 0) - (v.turn.firstPlayer === p && !c.whiteIconsConvertedNow ? white : 0)) : c.icons?.influence ?? 0;
    return black + (first === p && !c.whiteIconsConvertedNow ? white : 0);
}
// Estimate only the next two influence contests. Future draws, hidden faces
// and voluntary activations are unknown; neither difficulty invents them.
function influenceTenure(v, c, d, h) {
    const r = v.districts[d], p = v.seat;
    if (r.pendingWinner !== null && r.pendingWinner !== undefined || r.influence.some(n => n >= r.threshold))
        return 0;
    const rows = v.players.map(pl => pl.play.filter(x => x.id !== c.id && x.district === d));
    rows[p] = [...rows[p], c];
    const marks = [...r.influence], current = h.contestPending(v, d, 'influence');
    for (let i = 0; i < 2; i++) {
        const future = !current || i > 0, first = (v.turn.firstPlayer + (current ? i : i + 1)) % 2;
        const stars = rows.map((cards, seat) => cards.reduce((n, x) => n + projectedInfluence(v, x, seat, first, future), 0));
        const net = marks[0] - marks[1] + stars[0] - stars[1];
        marks[0] = Math.max(0, net);
        marks[1] = Math.max(0, -net);
        if (marks.some(n => n >= r.threshold))
            return i + 1;
        const reputation = rows.map(cards => cards.filter(x => !x.faceDown && (future || !x.tapped) && h.keyword(x, '声望')).length);
        if (reputation[0] !== reputation[1]) {
            const leader = reputation[0] > reputation[1] ? 0 : 1;
            marks[leader]++;
            const cancel = Math.min(...marks);
            marks[0] -= cancel;
            marks[1] -= cancel;
        }
        if (marks.some(n => n >= r.threshold))
            return i + 1;
    }
    return 3;
}
export function earlyEngineTenurePenalty(v, c, d, h) {
    if (!c || c.faceDown || !hasCardType(c, 'character') || v.round > 5 || h.keyword(c, '永恒'))
        return 0;
    const p = v.seat, q = 1 - p, mine = v.players[p], foe = v.players[q], r = v.districts[d], up = { ...h.faceUp(v, c), controller: p };
    if (!r)
        return 0;
    const white = (up.effectiveTemporaryIcons ?? up.temporaryIcons)?.investigation ?? 0;
    const eyes = up.effectiveIcons ? Math.max(0, (up.effectiveIcons.investigation ?? 0) - (v.turn.firstPlayer === p && !up.whiteIconsConvertedNow ? white : 0)) : up.icons?.investigation ?? 0;
    const standing = Math.min(24, eyes * 8 + (recurringEngine(up) ? 10 : 0));
    if (!standing)
        return 0;
    const points = Math.max(0, (r.points ?? 0) - (r.destroyed ?? 0));
    if ((mine.score ?? 0) + points >= (mine.victoryThreshold ?? 8) || (foe.score ?? 0) >= (foe.victoryThreshold ?? 8) - 2 || mine.deckCount <= h.drawReserve(v) + 2)
        return 0;
    const life = influenceTenure(v, up, d, h);
    if (life >= 3)
        return 0;
    const risk = region => {
        if (h.lethalBattleRisk(v, up, region))
            return 100;
        if (!h.contestPending(v, region, 'battle'))
            return 0;
        const existing = mine.play.find(x => x.id === c.id && x.district === region && !x.tapped);
        const before = existing ? (existing.effectiveIcons ?? existing.icons)?.battle ?? 0 : 0, after = up.tapped ? 0 : (up.effectiveIcons ?? up.icons)?.battle ?? 0;
        return Math.max(0, h.total(v, q, region, 'battle') - h.total(v, p, region, 'battle') + before - after) / Math.max(1, (up.effectiveDefense ?? up.defense ?? 1) - (up.damage ?? 0));
    };
    const here = risk(d), alternative = v.districts.some((other, i) => other && i !== d && risk(i) <= here + 0.05 && influenceTenure(v, up, i, h) > life);
    if (!alternative)
        return 0;
    // Region rewards and the race for points can justify taking a short stay.
    // Keep this a scoring tradeoff, never a ban on an otherwise safe district.
    const stage = v.round <= 3 ? 1 : v.round === 4 ? 0.6 : 0.3;
    const race = Math.max((mine.score ?? 0) / (mine.victoryThreshold ?? 8), (foe.score ?? 0) / (foe.victoryThreshold ?? 8)) >= 0.5 ? 0.4 : 1;
    return Math.max(0, (3 - life) * standing - (r.hasWinTrigger ? 8 : 0)) * stage * race * (h.keyword(up, '撤回') ? 0.5 : 1);
}
// Recurring district attachments need to survive the next claim to provide
// their upkeep value. Both players' influence can send them to the deck bottom.
export function districtAttachmentTenure(v, c, d, h) {
    const a = c?.attachment;
    if (a?.target !== 'district' || !(a.prepare || a.end || a.watch?.length || a.action || a.actions?.length))
        return 0;
    const r = v.districts?.[d];
    if (!r)
        return -Infinity;
    const marks = r.influence ?? [0, 0], limit = r.threshold ?? 99;
    if (marks.some(n => n >= limit) || r.pendingWinner !== null && r.pendingWinner !== undefined || v.turn.claim?.district === d)
        return -Infinity;
    const delta = h.total(v, 0, d, 'influence') - h.total(v, 1, d, 'influence'), leader = delta >= 0 ? 0 : 1, speed = Math.abs(delta);
    const left = limit - (marks[leader] ?? 0) + (marks[1 - leader] ?? 0), rounds = speed ? Math.max(1, Math.ceil(left / speed)) : 4;
    if (h.contestPending(v, d, 'influence') && speed >= left)
        return -Infinity;
    return -Math.max(0, 4 - rounds) * 10 - Math.max(...marks) / limit * 8 - speed * 2;
}
function engineWeight(v, c, h) {
    if (c.faceDown)
        return 0;
    const eyes = (c.effectiveIcons ?? c.icons ?? {}).investigation ?? 0, engine = recurringEngine(c);
    return eyes || engine ? eyes * 4 + (engine ? 8 : 0) + h.value(c) * 0.3 : 0;
}
// Conceding is useful only when the next influence contest can actually clear
// a substantially better enemy engine. Public cards suffice at both levels.
export function districtConcession(v, d, h) {
    const r = v.districts?.[d], p = v.seat, q = 1 - p;
    if (!r || !h.contestPending(v, d, 'influence'))
        return 0;
    const racing = resourcePriorities(v, h).race;
    const points = Math.max(0, (r.points ?? 0) - (r.destroyed ?? 0));
    if ((v.players[q].score ?? 0) + points >= (v.players[q].victoryThreshold ?? 8) || (v.players[p].score ?? 0) + points >= (v.players[p].victoryThreshold ?? 8))
        return 0;
    const stars = h.total(v, q, d, 'influence') - h.total(v, p, d, 'influence');
    if (stars <= 0 || (r.influence[q] ?? 0) + stars - (r.influence[p] ?? 0) < r.threshold)
        return 0;
    const weight = seat => v.players[seat].play.filter(c => c.district === d).reduce((n, c) => n + engineWeight(v, c, h), 0);
    const lead = weight(q) - weight(p), scoreRisk = points * (racing ? 6 : 4) + Math.max(0, (v.players[q].score ?? 0) - 3) * 2;
    return Math.max(0, Math.min(30, lead - scoreRisk));
}
export function handCommitmentPenalty(v, command, h) {
    const mine = v.players[v.seat], card = mine.hand.find(c => c.id === command.cardId);
    // Concealed deployment has its own reveal horizon and asset-option check,
    // applied even when a deck-specific engine score exceeds this soft penalty.
    if (!card || v.round > 6 || mine.hand.length > 3 || command.type !== 'play')
        return 0;
    if (command.type === 'play' && (recurringEngine(card) || replenishes(card.automation?.entry) || replenishes(card.spell) || replenishes(card.attachment?.entry)))
        return 0;
    // Useful interaction and combo pieces keep their deck-specific priorities.
    if (command.type === 'play' && !hasCardType(card, 'character'))
        return 0;
    if (h.value(card) >= 10)
        return 0;
    const d = command.district;
    if (!v.districts?.[d])
        return 0;
    const up = h.faceUp(v, card), icons = up.effectiveIcons ?? up.icons ?? {};
    const flips = kind => h.contestPending(v, d, kind) && h.total(v, v.seat, d, kind) <= h.total(v, 1 - v.seat, d, kind) && h.total(v, v.seat, d, kind) + (icons[kind] ?? 0) > h.total(v, 1 - v.seat, d, kind);
    const r = v.districts[d], points = Math.max(0, (r.points ?? 0) - (r.destroyed ?? 0));
    if (flips('investigation') || flips('battle') || flips('influence') && (mine.score ?? 0) + points >= (mine.victoryThreshold ?? 8))
        return 0;
    return mine.hand.length === 1 ? 48 : mine.hand.length === 2 ? 38 : 26;
}
export function assetPreservesHand(v, c, h) {
    const mine = v.players[v.seat];
    if (mine.assets.length < 4 || mine.hand.length > 2)
        return false;
    if (mine.play.some(x => x.faceDown && !x.paidRevealBlocked && !x.automation?.noPaidReveal && h.loyalty(v, x) && (v.revealCosts?.[x.id] ?? h.cost(x)) > mine.assets.length && (v.revealCosts?.[x.id] ?? h.cost(x)) <= mine.assets.length + 1))
        return false;
    if (mine.coreArea?.cards.some(x => x.castAllowed && h.loyalty(v, x) && (x.cost ?? h.cost(x)) > mine.assets.length && (x.cost ?? h.cost(x)) <= mine.assets.length + 1))
        return false;
    // A fourth/fifth color source may unlock a held card; a spare asset alone
    // does not justify consuming the final playable card in the early game.
    return !mine.hand.some(x => x.id !== c.id && (v.castingCosts?.[x.id] ?? h.cost(x)) > h.pool(v) && (v.castingCosts?.[x.id] ?? h.cost(x)) <= h.pool(v) + 1 || x.id !== c.id && Object.entries(x.loyalty ?? {}).some(([color, n]) => color === c.faction?.split('·')[0] && (mine.loyalty?.factions?.[color] ?? 0) < n && (mine.loyalty?.factions?.[color] ?? 0) + 1 >= n));
}
