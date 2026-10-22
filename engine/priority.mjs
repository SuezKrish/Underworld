import { effectiveMagicDomains } from './magic-domains.mjs';
import { identity } from './ownership.mjs';
import { RuleError } from './core.mjs';
const none = () => ({ mode: 'none', stepKey: null });
// A contest is one step across before/reward/after/claim windows. Internal
// window labels must not clear floating costs or expire a step-scoped pass.
export function priorityStepKey(s) {
    const t = s.turn;
    if (t?.claim?.resume?.priorityStepKey)
        return t.claim.resume.priorityStepKey;
    if (!t)
        return `round:${s.round}:lab`;
    return `round:${s.round}:${t.phase}:${t.phase === 'contest' ? (t.step.startsWith('mobility-') ? 'mobility' : `${t.district}:${t.kind}${t.contestIteration ? ':' + t.contestIteration : ''}`) : t.step}`;
}
export function autoPassState(s, p) {
    if (s.status !== 'playing')
        return none();
    const a = s.players[p]?.autoPass;
    if (a?.mode === 'continuous')
        return { mode: 'continuous', stepKey: null };
    if (a?.mode === 'step' && a.stepKey === priorityStepKey(s))
        return { ...a };
    return none();
}
export function resetAutoPassForRound(s) {
    for (const p of s.players)
        p.autoPass = none();
}
export function beginPriorityStep(s, previous) {
    const current = priorityStepKey(s);
    s.priorityStepKey = current;
    if (previous === current)
        return;
    for (const p of s.players) {
        p.costPool = 0;
        if (p.autoPass?.mode === 'step')
            p.autoPass = none();
    }
    if (s.turn?.phase === 'action') {
        const owner = s.turn.step === 'second-action' ? 1 - s.turn.firstPlayer : s.turn.firstPlayer;
        s.players[owner].autoPass = none();
    }
}
export function setAutoPass(s, p, mode, stepKey) {
    if (!['none', 'step', 'continuous'].includes(mode))
        throw new RuleError('让过模式无效');
    if (s.turn?.phase === 'setup' && mode !== 'none')
        throw new RuleError('请先完成起始手牌确认');
    if (mode !== 'none' && stepKey !== priorityStepKey(s))
        throw new RuleError('步骤已切换，请重新选择让过模式');
    const previous = autoPassState(s, p);
    s.players[p].autoPass = { mode, stepKey: mode === 'step' ? priorityStepKey(s) : null };
    // Cancellation withdraws this player's earlier automatic pass. They can
    // respond when the opponent next passes, without stealing current priority.
    if (mode === 'none' && previous.mode !== 'none' && s.flow.passed.includes(p))
        s.flow.passed = [];
}
export function assetLoyalty(assets) {
    const factions = {}, domains = {};
    for (const a of assets) {
        for (const color of new Set(a.factionColors ?? [(a.faction ?? '中立').split('·')[0]]))
            if (['黄', '绿', '蓝', '红', '灰', '白', '黑', '紫'].includes(color))
                factions[color] = (factions[color] ?? 0) + 1;
        for (const d of new Set(a.magicDomains ?? []))
            domains[d] = (domains[d] ?? 0) + 1;
    }
    return { factions, domains };
}
export function assetView(s, a) { const c = s.cards[a.id]; return { ...(c ? (({ owner, controller, ownerName, controllerName }) => ({ owner, controller, ownerName, controllerName }))(identity(s, a.id)) : {}), id: a.id, name: c?.name ?? '测试资产', type: 'asset', originalType: c?.type ?? null, catalogId: c?.catalogId ?? null, subtitle: c?.subtitle ?? '', flavorText: c?.flavorText ?? '', text: c?.text ?? '', printedCost: c?.printedCost ?? null, tapped: a.tapped, faction: a.faction ?? '中立', factionColors: a.factionColors ?? [], magicDomains: effectiveMagicDomains(s, a.id) }; }
