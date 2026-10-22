import { hasCardType } from './card-types.mjs';
// Server-side rules primitives. Not a complete match engine or network service.
export class RuleError extends Error {
}
const need = (condition, message) => {
    if (!condition)
        throw new RuleError(message);
};
const integer = (value, message) => need(Number.isSafeInteger(value) && value >= 0, message);
export function markerEntryAbility(sourceId, marker, count) {
    integer(count, '标志数量必须是非负整数');
    return { kind: 'trigger', mandatory: true, event: 'enter-play', sourceId,
        effect: { kind: 'place-markers', targetId: sourceId, marker, count },
        provenance: 'user-errata-2026-10-04' };
}
// Optional rumor ability: enter the graveyard first, then queue an ability.
// Do not invoke this for death, sacrifice, hand-limit discard, or a replacement
// that prevents the card from entering the graveyard.
export function rumorTrigger(card, event) {
    if (!card.rumor || event.cardId !== card.id || event.to !== 'graveyard' ||
        event.cause !== 'card-or-ability-effect' ||
        !['hand', 'deck'].includes(event.from))
        return null;
    return { kind: 'trigger', mandatory: false, controller: card.owner,
        sourceId: card.id, sourceZoneVersion: event.zoneVersion,
        effect: { kind: 'seal-from-graveyard', cardId: card.id,
            owner: card.owner, sourceZoneVersion: event.zoneVersion } };
}
export function resolveRumorSeal(card, ability, target) {
    need(ability?.effect?.kind === 'seal-from-graveyard', '不是传闻封印能力');
    if (card.id !== ability.effect.cardId || card.zone !== 'graveyard' ||
        card.zoneVersion !== ability.effect.sourceZoneVersion ||
        !target || target.zone !== 'play' || !hasCardType(target, 'character') ||
        target.faceDown || target.targetable === false)
        return { resolved: false };
    return { resolved: true, movement: { cardId: card.id, from: 'graveyard',
            to: 'sealed', hostId: target.id }, event: 'card-sealed' };
}
export function printedCost(cost) {
    if (Number.isSafeInteger(cost) && cost >= 0)
        return cost;
    // Input is an explicitly normalized printed cost, not card text parsing.
    if (cost && typeof cost === 'object' && cost.variable === 'X') {
        integer(cost.constant, '固定印刷费用无效');
        return cost.constant;
    }
    throw new RuleError('印刷费用必须是非负整数或已规范化的X费用');
}
export function oneVersusOneScoreWinner(scores) {
    need(scores.length === 2 && scores.every(Number.isFinite), '需要双方分数');
    if (Math.max(...scores) < 8 || scores[0] === scores[1])
        return null;
    return scores[0] > scores[1] ? 0 : 1;
}
export function societyMarkers(hidden, exposed, addHidden = 0, addExposed = 0) {
    for (const value of [hidden, exposed, addHidden, addExposed])
        integer(value, '标志数无效');
    const net = hidden + addHidden - exposed - addExposed;
    return { hidden: Math.max(0, net), exposed: Math.max(0, -net) };
}
export function handLimit(base, markers) {
    integer(base, '基础手牌上限无效');
    return Math.max(0, base + markers.hidden - markers.exposed);
}
export function newPriority(firstPlayer, stepOwner = firstPlayer) {
    need([0, 1].includes(firstPlayer) && [0, 1].includes(stepOwner), '玩家编号无效');
    return { firstPlayer, stepOwner, priority: stepOwner, passed: [], stack: [], locked: false };
}
export function pushAbility(state, player, ability) {
    need(!state.locked, '当前没有快速行动窗口');
    need(player === state.priority, '当前没有行动权');
    need(ability?.id && !state.stack.some(a => a.id === ability.id), '堆叠条目编号无效');
    return { ...state, passed: [], stack: [...state.stack, structuredClone(ability)] };
}
export function passPriority(state, player) {
    need(!state.locked, '当前没有让过窗口');
    need(player === state.priority, '当前没有行动权');
    const passed = [...state.passed, player];
    if (passed.length < 2)
        return { state: { ...state, priority: 1 - player, passed }, action: 'pass' };
    if (!state.stack.length)
        return { state: { ...state, passed: [] }, action: 'window-complete' };
    // Caller resolves exactly one entry, handles triggers/state-based rules,
    // then opens priority with the correct step owner (second-player exception).
    return { state: { ...state, stack: state.stack.slice(0, -1), passed: [], priority: state.stepOwner },
        action: 'resolve-one', entry: state.stack.at(-1) };
}
// Hidden contest steps 1-6. The orchestrator handles reward choice, step 8,
// then priority. Confirmed ruling: equal corrected cost means no winner.
export function beginHiddenContest(players, currentPriorityPlayer, contestId) {
    need(players.length === 2 && players.every(p => Array.isArray(p.hand) && Array.isArray(p.deck)), '需要双方手牌与牌库');
    need([0, 1].includes(currentPriorityPlayer), '行动优先权玩家无效');
    need(typeof contestId === 'string' && contestId.length > 0, '对抗编号不能为空');
    const copy = structuredClone(players);
    if (copy.some(p => !p.hand.length && !p.deck.length))
        return { skipped: true, players: copy, contest: null };
    // "置于手中" is distinct from draw; an empty deck with a nonempty hand
    // does not itself invoke the ordinary empty-deck draw loss rule.
    for (const p of copy)
        if (p.deck.length)
            p.hand.push(p.deck.shift());
    return { skipped: false, players: copy, contest: { id: contestId,
            step: 2, priorityPlayer: currentPriorityPlayer, fastWindow: false,
            selections: [null, null], revealed: null, stackedAbilities: [] } };
}
export function hiddenSelectionIds(selection) { return selection == null ? [] : Array.isArray(selection) ? selection : [selection]; }
export function selectHiddenCard(contest, players, player, cardId, cardById = {}) {
    need(contest.step === 2 && [0, 1].includes(player), '当前不能选择隐秘对抗牌');
    need(!contest.selections[player], '选择已锁定');
    need(contest.firstSelectionPlayer === undefined || contest.selections[contest.firstSelectionPlayer] || player === contest.firstSelectionPlayer, '须由指定玩家先选择并展示');
    const ids = hiddenSelectionIds(cardId);
    need(ids.length >= 1 && new Set(ids).size === ids.length && ids.every(id => players[player].hand.includes(id)), '只能选择不同的自己的手牌，且至少选择一张');
    need(ids.length === 1 || contest.multiSelections?.[player], '本次只能选择一张手牌');
    if (ids.length > 1)
        need(ids.every(id => cardById[id] && printedCost(cardById[id].printedCost) === printedCost(cardById[ids[0]].printedCost)), '多张展示牌的印刷费用必须相同');
    const next = structuredClone(contest);
    next.selections[player] = ids.length === 1 ? ids[0] : ids;
    return next;
}
export function revealHiddenCards(contest, players, cardById, bonuses = [0, 0], cardBonuses = {}) {
    need(contest.step === 2 && contest.selections.every(Boolean), '双方选择完成后才能同时展示');
    const nextPlayers = structuredClone(players);
    const next = structuredClone(contest);
    const snapshots = [];
    // Both cards leave their hands before any hand-size condition is evaluated.
    for (let player = 0; player < 2; player++) {
        for (const id of hiddenSelectionIds(next.selections[player])) {
            const card = cardById[id];
            need(nextPlayers[player].hand.includes(id) && card && card.owner === player, '展示牌不合法');
            nextPlayers[player].hand.splice(nextPlayers[player].hand.indexOf(id), 1);
        }
    }
    for (let player = 0; player < 2; player++) {
        const selected = hiddenSelectionIds(next.selections[player]), shown = [];
        for (const id of selected) {
            const card = cardById[id];
            const pointAbilities = card.hiddenAbilities?.filter(a => a.kind === 'point-modifier' &&
                (!a.condition || a.condition === 'hand-at-least-four' && nextPlayers[player].hand.length >= 4)) ?? [];
            need(pointAbilities.every(a => Number.isSafeInteger(a.amount)), '点数修正必须先规范化');
            need(Number.isSafeInteger(bonuses[player]), '隐秘对抗持续修正无效');
            // This token tracks the specific set-aside occurrence, not just the card ID.
            const modifier = pointAbilities.reduce((sum, a) => sum + a.amount, cardBonuses[id] ?? 0);
            shown.push({ cardId: id, owner: player, asideToken: selected.length === 1 ? `${next.id}:${player}` : `${next.id}:${player}:${shown.length}`,
                printedCost: printedCost(card.printedCost), modifier, value: printedCost(card.printedCost) + modifier });
        }
        // Equal printed costs contribute once; every displayed card contributes its hidden modifiers.
        const cost = shown[0].printedCost, modifier = shown.reduce((sum, c) => sum + c.modifier, bonuses[player]);
        snapshots.push({ ...shown[0], printedCost: cost, modifier, value: cost + modifier, ...(shown.length > 1 ? { cards: shown } : {}) });
    }
    next.revealed = snapshots;
    next.step = 6;
    // Bottom of the newly added stack segment, before all other hidden abilities.
    next.stackedAbilities = [{ id: `${next.id}:return`, kind: 'rule-return-aside', cards: snapshots.flatMap(c => c.cards ?? [c]), extraHandCounts: snapshots.map(c => (c.cards?.length ?? 1) - 1) }];
    for (const player of [next.priorityPlayer, 1 - next.priorityPlayer]) {
        for (const id of hiddenSelectionIds(next.selections[player])) {
            const card = cardById[id];
            for (const [index, ability] of (card.hiddenAbilities ?? []).entries())
                if (ability.kind !== 'point-modifier') {
                    next.stackedAbilities.push({ ...structuredClone(ability), controller: player,
                        id: ability.id ?? `${next.id}:hidden:${player}:${id}:${index}`, sourceId: card.id, displayName: card.name });
                }
        }
    }
    return { players: nextPlayers, contest: next };
}
export function hiddenComparison(contest) {
    need(contest.step === 6 && contest.revealed?.length === 2, '尚未展示及修正点数');
    const [a, b] = contest.revealed.map(c => c.value);
    return a === b ? { kind: 'tie', values: [a, b] } :
        { kind: 'winner', player: a > b ? 0 : 1, values: [a, b] };
}
// At resolution time, only cards still in their original set-aside occurrence
// go to their owners' library bottoms. Does not execute or schedule resolution.
export function eligibleAsideReturns(returnAbility, locations) {
    need(returnAbility.kind === 'rule-return-aside', '不是展示牌回底规则性能力');
    return returnAbility.cards.filter(c => locations[c.cardId]?.zone === 'aside' &&
        locations[c.cardId]?.asideToken === c.asideToken).map(c => ({ cardId: c.cardId, owner: c.owner }));
}
export function hiddenPublicView(contest, viewer) {
    need([0, 1, null].includes(viewer), '观看者编号无效');
    return { id: contest.id, step: contest.step, fastWindow: false,
        selectionCommitted: contest.selections.map(Boolean),
        ownSelection: viewer === null ? null : contest.selections[viewer],
        revealed: contest.revealed ? structuredClone(contest.revealed) : null };
}
