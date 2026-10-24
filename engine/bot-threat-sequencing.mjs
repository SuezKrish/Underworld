import { knownOpponentOptions } from './bot-matchup-planning.mjs';
import { cardCapabilities, immediateDraws } from './bot-card-analysis.mjs';
import { responseFilter, selectedEffectPlans, counterEffects, removalEffects, fieldResponseRules } from './response-effect-semantics.mjs';
import { hasCardType } from './card-types.mjs';
import { nonDrawLockValue, nonDrawEffectBlocked } from './bot-draw-lock-planning.mjs';
const funds = p => (p.costPool ?? 0) + (p.assets ?? []).filter(a => !a.tapped).length;
const keyword = (c, k) => c?.keywordStates?.find(x => x.keyword === k)?.present ?? c?.keywords?.includes(k) ?? c?.automation?.keywords?.includes(k);
const live = c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed;
const cache = new WeakMap(), decisions = new WeakMap();
export const sequencingDecision = command => decisions.get(command);
// Use projected legal views, never underlying match state or a preset deck list.
// Unknown extra costs are not treated as a guaranteed response.
export function sequencingResponses(v) {
    if (cache.has(v))
        return cache.get(v);
    const q = 1 - v.seat, p = v.players[q], rows = [], seen = new Set();
    function add(card, plan, cost, confidence, origin, key) {
        if (!plan || plan.timing !== 'fast' || plan.used || plan.actionPhaseOnly && v.turn?.phase !== 'action' || plan.tap && (card.tapped || card.cannotTap))
            return;
        if (cost > funds(p) || plan.discardCost > (p.handCount ?? p.hand?.length ?? 0) || plan.sacrificeCost || plan.sacrificeSelf || plan.extraCosts?.length)
            return;
        for (const effect of selectedEffectPlans(plan)) {
            if (!counterEffects.has(effect.effect) && !removalEffects.has(effect.effect))
                continue;
            const id = `${key}:${effect.effect}`;
            if (seen.has(id))
                continue;
            seen.add(id);
            rows.push({ id, key, card, plan: effect, root: plan, cost, confidence, origin, expendable: origin !== 'field' || !!plan.tap || !!plan.oncePerRound });
        }
    }
    for (const x of knownOpponentOptions(v).filter(x => x.available && x.origin !== 'hidden'))
        add(x.card, x.card.spell, x.cost + (x.drawCost ?? 0), x.confidence, x.origin, x.card.id);
    for (const c of (p.play ?? []).filter(live))
        for (const [i, a] of (c.availableActions ?? c.automation?.actions ?? (c.automation?.action ? [c.automation.action] : [])).entries())
            add(c, a, a.cost ?? 0, 1, 'field', `${c.id}:${i}`);
    cache.set(v, rows);
    return rows;
}
// The defending Bot must not automatically spend its only counter on every
// character. Known stronger follow-ups are relevant, but never justify taking
// an immediately lethal or already-targeted removal effect.
export function reserveCounterForFollowUp(v, entry, answer, h) {
    const current = entry.responseEffect?.enteringCard, q = 1 - v.seat;
    if (!v.hardInfo || !current || v.turn?.phase !== 'action' || v.flow?.stepOwner !== q)
        return false;
    const r = entry.responseEffect ?? {};
    if (r.damage || r.removesTargets || r.handDiscards?.length || (entry.targetIds ?? []).some(id => h.lookup(v, id)?.controller === v.seat))
        return false;
    const own = v.players[v.seat], enemy = v.players[q], soc = v.societies?.[q];
    const flipped = { ...v, seat: q, hardInfo: { ownDeck: v.hardInfo.opponentDeck ?? [], opponentDeck: v.hardInfo.ownDeck ?? [], opponentCanControlLibrary: false } };
    const now = commitmentValue(flipped, current, h), price = v.castingCosts?.[answer.id] ?? answer.printedCost ?? 0;
    const free = soc?.actions?.some(a => a.id === 'revival-play' && !a.used);
    const loyalty = c => enemy.ignoreLoyalty || Object.entries(c.loyalty ?? {}).every(([k, n]) => k === '紫' && soc?.plan?.ignorePurpleLoyalty || (({ 心: '心灵', 血: '鲜血', 星: '星辰', 死: '死亡', 圣: '神圣' }[k] ? enemy.loyalty?.domains?.[{ 心: '心灵', 血: '鲜血', 星: '星辰', 死: '死亡', 圣: '神圣' }[k]] : enemy.loyalty?.factions?.[k]) ?? 0) >= n);
    const future = knownOpponentOptions(v).filter(x => x.origin === 'hand' && x.card.castAllowed !== false && loyalty(x.card) && (x.available || free && (x.card.printedCost ?? 0) <= (soc.counters?.revival ?? 0)) && x.card.id !== current.id)
        .filter(x => responseLoss(flipped, { card: x.card, command: {}, isCard: true, value: 1, plan: x.card.spell }, { card: answer, root: answer.spell, plan: answer.spell }, h) > 0)
        .sort((a, b) => commitmentValue(flipped, b.card, h) - commitmentValue(flipped, a.card, h))[0];
    if (!future || commitmentValue(flipped, future.card, h) < now * 1.5 + 8)
        return false;
    // A second usable counter can cover the follow-up; do not reserve both.
    if (own.hand.some(c => c.id !== answer.id && c.castAllowed !== false && (!h.loyalty || h.loyalty(v, c)) && counterEffects.has(c.spell?.effect) && (v.castingCosts?.[c.id] ?? c.printedCost ?? 0) <= funds(own) - price && responseLoss(flipped, { card: future.card, command: {}, isCard: true, value: 1, plan: future.card.spell }, { card: c, root: c.spell, plan: c.spell }, h) > 0))
        return false;
    const d = current.district ?? entry.district, region = v.districts?.[d];
    if (region && h.total) {
        const gain = (current.icons?.influence ?? 0) + (v.turn.firstPlayer === q ? (current.temporaryIcons?.influence ?? 0) : 0);
        const net = (region.influence?.[q] ?? 0) - (region.influence?.[v.seat] ?? 0) + h.total(v, q, d, 'influence') + gain - h.total(v, v.seat, d, 'influence');
        if (net >= region.threshold)
            return false;
    }
    return true;
}
export function commitmentValue(v, c, h, command = {}) {
    const cap = cardCapabilities(c), m = v.players[v.seat], cards = m.hand.length, refill = cards <= 3 ? 4 : cards < (m.handLimit ?? 7) ? 2 : 0.5;
    let value = Math.max(0, h.value(c));
    if (hasCardType(c, 'character') || hasCardType(c, 'attachment'))
        value += cap.draw * refill + cap.discount * 5 + cap.grave * 4 + cap.protection * 3;
    if (c.automation?.static === 'block-non-draw')
        value += Math.max(0, nonDrawLockValue(v, c));
    const targets = (command.targetIds ?? []).map(id => h.lookup(v, id)).filter(Boolean);
    if (c.spell && targets.length)
        value += targets.reduce((n, t) => n + (t.controller !== v.seat && cap.removal ? Math.max(0, h.value(t)) : 0), 0);
    return Math.max(1, value);
}
function counterable(v, d) {
    if (!d.isCard || d.card.cannotBeTerminated || d.card.automation?.cannotTerminate || d.plan?.cannotTerminate || d.plan?.cannotRespond || d.plan?.noResponse || keyword(d.card, '不能被响应'))
        return false;
    return !(v.players[v.seat].play ?? []).filter(live).some(c => fieldResponseRules(c).some(r => r.kind === 'cannot-terminate'));
}
// Amount of the candidate's payoff that an answer can actually take away.
// Removing an ability's source does not erase an already-stacked ability.
export function responseLoss(v, d, r, h) {
    const c = d.card, a = r.plan, kind = a.effect, target = a.target ?? r.root.target ?? '';
    if (counterEffects.has(kind)) {
        if (!counterable(v, d))
            return 0;
        if (target === 'stack-spell' && !c.spell || kind === 'counter-ability' && d.isCard || target === 'stack-character' && !hasCardType(c, 'character'))
            return 0;
        if (!responseFilter(c, a.filter ?? r.root.filter))
            return 0;
        return d.value;
    }
    if (!d.isCard || !hasCardType(c, 'character') && !hasCardType(c, 'attachment'))
        return 0;
    if (d.plan?.cannotRespond || d.plan?.noResponse || keyword(c, '不能被响应'))
        return 0;
    // Non-targeted sacrifice ignores barrier, but the victim still chooses.
    if (kind === 'sacrifice-character') {
        if (!hasCardType(c, 'character'))
            return 0;
        if ((v.players[v.seat].play ?? []).some(t => live(t) && hasCardType(t, 'character') && h.value(t) < h.value(c)))
            return 0;
    }
    else {
        if (keyword(c, '屏障') || c.barrierNow || keyword(c, '永恒'))
            return 0;
        if (target.includes('character') && !hasCardType(c, 'character') || target.includes('attachment') && !hasCardType(c, 'attachment'))
            return 0;
        if (target === 'battle-icon-character' && !((c.effectiveIcons?.battle ?? c.icons?.battle ?? 0) + (c.temporaryIcons?.battle ?? 0)))
            return 0;
        if (!/character|attachment|card|permanent/.test(target))
            return 0;
        if (!responseFilter(c, a.filter ?? r.root.filter))
            return 0;
        const f = a.filter ?? r.root.filter ?? {};
        if (f.subtypeOrNonhuman && !c.subtypes?.includes(f.subtypeOrNonhuman) && c.subtypes?.includes('人类'))
            return 0;
        if (target === 'tapped-character' && !c.tapped && !c.entersTapped && !keyword(c, '迟缓'))
            return 0;
        if (target === 'unique-character' && !c.unique || target === 'human-character' && !c.subtypes?.includes('人类') || target === 'nonhuman-character' && c.subtypes?.includes('人类'))
            return 0;
        if (r.root.excludeAngel && c.subtypes?.includes('天使'))
            return 0;
        if (target === 'district-character' && r.card.district !== d.command.district)
            return 0;
        if (a.sameDistrict && r.card.district !== d.command.district)
            return 0;
    }
    if (['damage', 'wound'].includes(kind) && Number(a.amount ?? a.count ?? 1) < (c.effectiveDefense ?? c.defense ?? 1) - (c.damage ?? 0) - (c.wounds ?? 0))
        return 0;
    if (kind === 'destroy-if-sealed' && !(v.sealed ?? []).some(x => x.hostId === c.id))
        return 0;
    const immediate = immediateDraws(c, ['entry', 'reveal'], nonDrawEffectBlocked(v));
    // An entry trigger survives removal. Returning a card also retains its card value.
    return Math.max(0, d.value - (immediate.top + immediate.bottom) * 3 - (['return-hand', 'bounce'].includes(kind) ? 4 : 0));
}
function describe(v, row, h) {
    const command = row.command;
    if (command.type === 'society-action') {
        const d = h.freeProspect?.(v, command, h);
        return d ? { ...d, value: commitmentValue(v, d.card, h, d.command) } : null;
    }
    const c = h.lookup(v, command.cardId);
    if (!c)
        return null;
    let plan, cost, isCard = false;
    if (['play', 'reveal'].includes(command.type)) {
        isCard = true;
        plan = c.spell ?? c.attachment;
        cost = (command.type === 'reveal' ? v.revealCosts : v.castingCosts)?.[c.id] ?? c.printedCost ?? 0;
        cost = Math.max(0, cost - (command.revealIds?.length ?? 0) - (command.tapIds?.length ?? 0) - (command.costIds ?? []).reduce((n, id) => n + (v.characterCosts?.[c.id]?.payments?.[id]?.reduction ?? 0), 0));
    }
    else if (command.type === 'activate') {
        plan = (c.availableActions ?? c.automation?.actions ?? [c.automation?.action])?.[command.actionIndex ?? 0];
        cost = plan?.cost ?? 0;
    }
    else
        return null;
    const paidObjects = [...new Set([...(command.costIds ?? []), ...(command.discardIds ?? [])])].map(id => h.lookup(v, id)).filter(Boolean);
    const materialLoss = paidObjects.reduce((n, x) => n + Math.max(0, h.value(x)) * 0.6, 0);
    return { card: c, command, plan, cost, isCard, value: Math.max(0, commitmentValue(v, c, h, command) - materialLoss), resourceKey: command.type === 'activate' ? `${c.id}:${command.actionIndex ?? 0}` : c.id };
}
function retentionValue(v, d, h) {
    const board = p => (v.players[p].play ?? []).filter(live).reduce((n, c) => n + Math.max(0, h.value(c)), 0);
    const deficit = Math.max(0, board(1 - v.seat) - board(v.seat));
    // Waiting under an established enemy engine/board costs tempo. A card kept
    // safely in hand is not a benefit if that delay concedes the game.
    return Math.max(0, d.value * 0.28 - (v.turn.firstPlayer === v.seat ? 5 : 8) - deficit * 0.45);
}
function outcome(v, d, responses, h, budget, spentKey) {
    let utility = d.value - d.cost * 2, answer = null;
    for (const r of responses) {
        if (r.cost > budget || r.key === spentKey && r.expendable)
            continue;
        const loss = responseLoss(v, d, r, h);
        if (!loss)
            continue;
        // Spending an answer is itself a resource gain, but never guarantees bait.
        const exchange = r.cost * 1.6 + (r.origin === 'field' ? 1 : 3);
        const after = d.value - d.cost * 2 - r.confidence * Math.max(0, loss - exchange);
        if (after < utility) {
            utility = after;
            answer = r;
        }
    }
    return { utility, answer };
}
// Bounded two-action lookahead. The opponent may answer the first threat OR
// decline and save the answer for the core. Choose the worse of those branches.
// Run only at an empty proactive window: urgent responses keep their own logic.
export function sequenceThreats(v, choices, h) {
    if (v.turn?.phase !== 'action' || !v.turn.standardAllowed || v.flow?.stepOwner !== v.seat || v.flow?.stack?.length || !choices.length)
        return choices;
    const responses = sequencingResponses(v);
    if (!responses.length)
        return choices;
    const available = funds(v.players[v.seat]), enemyFunds = funds(v.players[1 - v.seat]);
    const ranked = [...choices].sort((a, b) => b.score - a.score), top = ranked[0];
    // Never displace required asset building, setup, or a tactical save.
    const core = describe(v, top, h);
    if (!core)
        return choices;
    const current = outcome(v, core, responses, h, enemyFunds);
    if (!current.answer)
        return choices;
    let chosen = null, best = current.utility, decision = 'direct', audit = { direct: current.utility };
    const seen = new Set();
    for (const row of ranked.slice(1, 32)) {
        const alt = describe(v, row, h);
        if (!alt || alt.card.id === core.card.id || seen.has(alt.resourceKey) || alt.resourceKey === core.resourceKey)
            continue;
        seen.add(alt.resourceKey);
        if (alt.cost + core.cost > available || alt.freeKey && alt.freeKey === core.freeKey || alt.value - alt.cost * 2 < 3)
            continue;
        // A sacrifice/discard could consume the follow-up; do not assume it survives.
        if ((row.command.costIds ?? []).includes(core.card.id) || (row.command.discardIds ?? []).includes(core.card.id))
            continue;
        const held = retentionValue(v, core, h);
        const ignored = alt.value - alt.cost * 2 + Math.max(current.utility, held);
        let worst = ignored, answered = false;
        for (const r of responses) {
            if (r.cost > enemyFunds || !responseLoss(v, alt, r, h))
                continue;
            answered = true;
            const immediate = alt.value - alt.cost * 2 - r.confidence * Math.max(0, responseLoss(v, alt, r, h) - (r.cost * 1.6 + (r.origin === 'field' ? 1 : 3)));
            const follow = outcome(v, core, responses, h, enemyFunds - r.cost, r.key).utility;
            worst = Math.min(worst, immediate + follow);
        }
        if (!answered)
            continue;
        // Only the ordering improvement counts; normal expansion value alone must
        // not always delay every core until all possible fillers have been played.
        const reverse = current.utility + outcome(v, alt, responses, h, enemyFunds - (current.answer?.cost ?? 0), current.answer?.key).utility;
        // A small option value breaks otherwise equal orders: after a useful
        // threat resolves, we may still retain the unique core. It is bounded and
        // is not a probability that the opponent will waste their answer.
        const optionValue = Math.min(3, Math.max(0, core.value - alt.value) * 0.08);
        const advantage = worst - reverse + optionValue;
        if (advantage > 2 && worst > best + 2) {
            chosen = row;
            best = worst;
            decision = 'other-threat-first';
            audit = { direct: current.utility, firstThenCore: worst, coreThenFirst: reverse, optionValue, followUpId: core.card.id };
        }
    }
    // Retention is a separate option, not synonymous with passing forever.
    // Keep a unique high-impact engine only when paying now loses more than the
    // bounded value of waiting. A free trade into an expensive answer often wins.
    const duplicate = v.players[v.seat].hand.some(c => c.id !== core.card.id && c.catalogId === core.card.catalogId);
    const hold = retentionValue(v, core, h);
    if (!chosen && !duplicate && hold > 0 && hold > current.utility + 3) {
        const safe = ranked.find(row => { const d = describe(v, row, h); return d && d.card.id !== core.card.id && outcome(v, d, responses, h, enemyFunds).utility > 3; });
        chosen = safe ?? { command: { type: 'pass' }, score: 0 };
        decision = 'retain-core';
        audit = { direct: current.utility, hold, heldId: core.card.id };
    }
    const detail = { decision, ...audit, core: core.card.catalogId, coreId: core.card.id, coreValue: core.value, cost: core.cost, answer: current.answer.card.catalogId, answerCost: current.answer.cost };
    if (!chosen) {
        decisions.set(top.command, detail);
        return choices;
    }
    decisions.set(chosen.command, detail);
    const result = choices.map(x => ({ ...x })), index = result.findIndex(x => x.command === chosen.command);
    const promoted = { ...chosen, score: top.score + 1, sequenceDecision: { decision, ...audit } };
    if (index < 0)
        result.push(promoted);
    else
        result[index] = promoted;
    return result;
}
