import { RuleError } from './core.mjs';
export const DEFAULT_TRIGGER_TIMING = 'event';
export const TRIGGER_TIMINGS = [{ id: 'event', name: '提前决定费用和目标', description: '触发时确认是否发动、费用和目标；触发轮只排列入栈顺序。' }, { id: 'stack', name: '入栈时决定费用和目标', description: '进入触发轮时统一确认是否发动、费用、目标和入栈顺序。' }];
export function normalizeTriggerTiming(value) { if (value === undefined || value === null)
    return DEFAULT_TRIGGER_TIMING; if (value !== 'event' && value !== 'stack')
    throw new RuleError('触发规则无效'); return value; }
// Rooms predating this choice keep their recorded mixed timing for replay and
// suspended decisions. Every newly created room has an explicit rule snapshot.
export const earlyTriggerTiming = s => s.triggerTiming === 'event';
export const lateTriggerTiming = s => s.triggerTiming === 'stack';
export function refreshTriggerPrice(s, a) {
    if (!lateTriggerTiming(s) || !a.plan)
        return a;
    const p = a.plan;
    if (p.operation === 'ebeniya-sacrifice')
        p.cost = Math.max(0, 3 - (s.societyStates?.[a.controller]?.counters['失控'] ?? 0));
    return a;
}
