import { uuid } from './random.mjs';
import { RuleError } from './core.mjs';
import { triggerDisplayName } from './trigger-display.mjs';
import { abilityDescriptionView } from './ability-description.mjs';
// Keep the whole event group pending until its controllers have arranged their
// simultaneous triggers. New choices specify stack insertion order.
export function offerTriggerOrder(s) {
    if (s.triggerOrderChoice) {
        s.flow.locked = true;
        return true;
    }
    for (const group of new Set(s.pendingTriggers.map(a => a.group))) {
        const batch = s.pendingTriggers.filter(a => a.group === group && !a.triggerRoundNumber);
        const first = s.turn?.firstPlayer ?? s.flow.stepOwner;
        for (const p of [first, 1 - first]) {
            const own = batch.filter(a => a.controller === p);
            if (own.length < 2 || own.every(a => a.orderingComplete))
                continue;
            s.triggerOrderChoice = { id: uuid(), group, controller: p, order: 'stack', abilityIds: own.map(a => a.id) };
            s.flow.locked = true;
            return true;
        }
    }
    return false;
}
export function arrangeTriggers(s, p, c) {
    const a = s.triggerOrderChoice, ids = c.abilityIds;
    if (!a || a.id !== c.choiceId || a.controller !== p)
        throw new RuleError('没有属于你的触发排序选择');
    if (!Array.isArray(ids) || ids.length !== a.abilityIds.length || new Set(ids).size !== ids.length || !ids.every(id => a.abilityIds.includes(id)))
        throw new RuleError('请为全部本方触发指定一次入栈顺序');
    const entries = new Map(s.pendingTriggers.map(x => [x.id, x]));
    if (!a.abilityIds.every(id => entries.get(id)?.group === a.group && entries.get(id)?.controller === p))
        throw new RuleError('待入栈触发已经变化');
    // Older saved rooms offered resolution order; honor their pending choice.
    const stackOrder = (a.order === 'stack' ? ids : ids.toReversed()).map(id => ({ ...entries.get(id), orderingComplete: true }));
    let i = 0;
    s.pendingTriggers = s.pendingTriggers.map(x => a.abilityIds.includes(x.id) ? stackOrder[i++] : x);
    s.triggerOrderChoice = null;
}
export function triggerOrderView(s) {
    const a = s.triggerOrderChoice;
    return a ? { id: a.id, controller: a.controller, order: a.order ?? 'resolution', abilities: a.abilityIds.map(id => { const x = s.pendingTriggers.find(t => t.id === id); return { id, cardId: x.cardId, name: triggerDisplayName(s, x), abilityDescription: abilityDescriptionView(s, x, a.controller), event: x.event, mandatory: !!x.mandatory }; }) } : null;
}
