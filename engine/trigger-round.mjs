import { refreshTriggerPrice } from './trigger-timing.mjs';
import { RuleError } from './core.mjs';
import { triggerDisplayName } from './trigger-display.mjs';
import { abilityDescriptionView } from './ability-description.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const waiting = s => s.status !== 'playing' || s.deathContinuation || s.effectChoice || s.damageChoice || s.ruleChoice || s.keeperQueue?.length || s.keeperContinuation || s.hidden || s.manualRequest;
// A round is frozen only when its first controller submits. Reading a room
// must not mutate it, and newly induced triggers must not join this snapshot.
export function currentTriggerRound(s) {
    if (waiting(s) || s.triggerTiming === 'stack' && (s.battle || s.roundChoice || s.effectBattle))
        return null;
    if (s.triggerRound)
        return s.triggerRound;
    let entries = [...s.pendingTriggers.filter(a => !a.triggerRoundNumber), ...s.triggerChoices].filter(a => !a.triggerAfter);
    // Cast triggers precede triggers induced by paying that cast's extra costs.
    // This existing exception is a separate layer, not freely reorderable.
    if (entries.some(a => !a.group?.startsWith('cost:')))
        entries = entries.filter(a => !a.group?.startsWith('cost:'));
    if (!entries.length)
        return null;
    const first = s.flow.stepOwner ?? s.turn?.firstPlayer ?? 0;
    const players = [first, 1 - first].filter(p => entries.some(a => a.controller === p));
    const number = (s.triggerRoundNumber ?? 0) + 1;
    return { id: `trigger-round:${number}:${entries.map(a => a.id).sort().join('|')}`, number, first, players, index: 0,
        stackNow: (!s.flow.locked || !!s.triggerOrderChoice) && !s.battle,
        entries: entries.map(original => { const a = refreshTriggerPrice(s, structuredClone(original)); return { ...a, pending: s.pendingTriggers.some(x => x.id === a.id) }; }) };
}
export function triggerRoundView(s, p) {
    const r = currentTriggerRound(s);
    if (!r)
        return null;
    const controller = r.players[r.index];
    return { id: r.id, number: r.number, orderingOnly: s.triggerTiming === 'event', controller, first: r.first, counts: [0, 1].map(p => r.entries.filter(a => a.controller === p).length),
        abilities: controller === p ? r.entries.filter(a => a.controller === p).map(a => ({ ...a, displayName: triggerDisplayName(s, a), abilityDescription: abilityDescriptionView(s, a, p) })) : [] };
}
export function submitTriggerRound(s, p, c, { execute, resume, log, unavailable, validate }) {
    const current = currentTriggerRound(s);
    need(current && c.roundId === current.id, '触发轮已变化，请重新选择');
    need(current.players[current.index] === p, '请等待行动优先权玩家先确认本轮触发');
    const r = s.triggerRound ??= structuredClone(current), own = r.entries.filter(a => a.controller === p);
    const choices = own.filter(a => !a.pending), decisions = c.decisions, order = c.abilityIds;
    if (s.triggerTiming === 'event' && own.every(a => a.pending))
        need(Array.isArray(decisions) && decisions.length === 0, '提前决定模式的触发轮只能排序，不能改选目标、费用或取消发动');
    need(Array.isArray(decisions) && decisions.length === choices.length && new Set(decisions.map(x => x.triggerId)).size === choices.length && decisions.every(x => choices.some(a => a.id === x.triggerId) && typeof x.fire === 'boolean'), '请为本轮每条触发选择是否发动');
    const byId = new Map(decisions.map(x => [x.triggerId, x]));
    for (const a of choices)
        need(!a.mandatory || byId.get(a.id).fire || unavailable(s, a), '强制触发必须发动');
    const accepted = own.filter(a => a.pending || byId.get(a.id).fire).map(a => a.id);
    need(Array.isArray(order) && order.length === accepted.length && new Set(order).size === order.length && order.every(id => accepted.includes(id)), '请排列本轮所有发动能力的入栈顺序');
    // Reject an invalid draft before paying anything. A draft valid at submission
    // can still become unavailable when an earlier activation consumes its cost.
    for (const a of choices)
        if (byId.get(a.id).fire && !unavailable(s, a))
            validate?.(s, p, byId.get(a.id), a);
    const activated = [];
    // Inner commands reuse card-specific targeting, extra costs and use limits.
    // Resumption is suspended until the entire submitted batch has been applied.
    s.triggerBatchApplying = true;
    delete s.triggerOrderChoice;
    try {
        for (const a of choices)
            if (!byId.get(a.id).fire) {
                if (a.mandatory) {
                    s.triggerChoices = s.triggerChoices.filter(x => x.id !== a.id);
                    log(s, `${a.displayName ?? '强制触发'}没有合法发动方式，移出本轮。`);
                }
                else
                    execute(s, p, { ...byId.get(a.id), id: `${c.id}:skip:${a.id}`, type: a.kind === 'environment-ability' ? 'environment-trigger' : a.kind === 'abyss-ability' ? 'abyss-trigger' : 'trigger-choice' });
            }
        for (const id of order) {
            const a = own.find(a => a.id === id);
            if (a.pending) {
                activated.push(id);
                continue;
            }
            let blocked = unavailable(s, a);
            if (!blocked)
                try {
                    validate?.(s, p, byId.get(id), a);
                }
                catch (e) {
                    if (!(e instanceof RuleError))
                        throw e;
                    blocked = true;
                }
            if (blocked) {
                s.triggerChoices = s.triggerChoices.filter(x => x.id !== id);
                log(s, `${a.displayName ?? '触发能力'}当前无法支付费用、目标失效或已达次数上限，不发动。`);
                continue;
            }
            execute(s, p, { ...byId.get(id), id: `${c.id}:${id}`, type: a.kind === 'environment-ability' ? 'environment-trigger' : a.kind === 'abyss-ability' ? 'abyss-trigger' : 'trigger-choice' });
            activated.push(id);
        }
    }
    finally {
        delete s.triggerBatchApplying;
    }
    const arranged = activated.map(id => s.pendingTriggers.find(a => a.id === id));
    need(arranged.every(Boolean), '本轮待入栈能力已变化');
    s.pendingTriggers = s.pendingTriggers.filter(a => !activated.includes(a.id));
    for (const a of arranged) {
        a.displayName ??= triggerDisplayName(s, a);
        a.orderingComplete = true;
        a.triggerRoundNumber = r.number;
    }
    // Targets were chosen and observed when the paid trigger was activated. Its
    // induced triggers wait for the following round, even if shield status changes.
    for (const child of [...s.pendingTriggers, ...s.triggerChoices])
        if (activated.includes(child.triggerAfter))
            delete child.triggerAfter;
    if (r.stackNow)
        s.flow.stack.push(...arranged);
    else
        s.pendingTriggers.push(...arranged);
    log(s, `${s.seats[p].name}确认第${r.number}触发轮：发动${arranged.length}条，按所选顺序${r.stackNow ? '进入堆叠' : '等待快速行动窗口'}。`);
    r.index++;
    s.flow.passed = [];
    if (r.index === r.players.length) {
        s.triggerRoundNumber = r.number;
        delete s.triggerRound;
        if (r.stackNow)
            s.flow.locked = false;
        resume(s);
    }
}
