import { controllerOf } from './ownership.mjs';
// Logs are shared by both seats. Never reveal a hidden face merely because
// its instance is available in the authoritative state.
export function publicObjectLabel(s, id) {
    if (id?.startsWith('society:')) {
        const p = Number(id.slice(8));
        return `${s.seats[p]?.name ?? '玩家'}的${s.societies?.[p]?.name ?? '秘社'}`;
    }
    if (id?.startsWith('core-area:'))
        return `${s.seats[Number(id.slice(10))]?.name ?? '玩家'}的核心区`;
    const card = s.cards[id], l = s.locations[id];
    if (!card || !l)
        return '已离场的对象';
    const district = Number.isInteger(l.district) ? `（地区${l.district + 1}）` : '';
    if (l.zone === 'play' && l.faceDown)
        return `${s.seats[controllerOf(s, id)]?.name ?? '玩家'}的暗藏者${district}`;
    if (l.secretPlan)
        return `秘密计划${district}`;
    if (l.zone === 'sealed' && l.faceDown)
        return '背面封印牌';
    if (l.zone === 'hand')
        return `${s.seats[card.owner]?.name ?? '玩家'}手中的牌`;
    if (l.zone === 'deck')
        return `${s.seats[card.owner]?.name ?? '玩家'}牌库中的牌`;
    const zone = { asset: '资产区', graveyard: '墓地', sealed: '封印区', core: '核心区' }[l.zone];
    return `${card.name}${zone ? `（${zone}）` : district}`;
}
export function effectObjectsLog(s, targets = []) {
    const labels = targets.map(t => {
        if (t.kind === 'player')
            return s.seats[t.player]?.name ?? '玩家';
        if (t.kind === 'society')
            return publicObjectLabel(s, `society:${t.player}`);
        if (t.kind === 'district')
            return `地区${t.district + 1} · ${s.districts[t.district]?.name ?? '地区'}`;
        if (t.kind === 'host')
            return t.ref?.kind === 'district' ? `地区${s.districts.findIndex(d => d?.id === t.ref.hostId.slice(14)) + 1}` : publicObjectLabel(s, t.ref?.hostId);
        if (t.kind === 'stack') {
            const a = s.flow.stack.find(a => a.id === t.entryId);
            if (!a)
                return '已离开堆叠的对象';
            return `堆叠中的${s.locations[a.cardId]?.secretPlan ? '秘密计划' : a.displayName ?? s.cards[a.cardId]?.name ?? '能力'}`;
        }
        if (t.kind === 'card')
            return publicObjectLabel(s, t.cardId ?? t.id);
        return null;
    }).filter(Boolean);
    return labels.length ? `，效果对象：${[...new Set(labels)].join('、')}` : '';
}
export function paidCostsLog(s, amount, plan = {}, c = {}) {
    const costs = [], replaced = (c.actionPayments ?? []).reduce((n, x) => n + x.amount, 0);
    const actual = Math.max(0, amount - replaced);
    if (actual)
        costs.push(`支付${actual}点费用`);
    const names = ids => ids.filter(Boolean).map(id => s.cards[id]?.name ?? '卡牌').join('、');
    if (replaced)
        costs.push(`${c.actionPayments.map(x => publicObjectLabel(s, x.cardId)).join('、')}代付${replaced}点（横置）`);
    const sacrificed = [...(plan.sacrificeSelf ? [plan.sourceId ?? c.cardId] : []), ...(plan.sacrificeCharacter ? [c.sacrificeId] : []), ...(plan.sacrificeCharacters ? c.sacrificeIds ?? [] : [])];
    if (sacrificed.length)
        costs.push(`牺牲${names(sacrificed)}`);
    if (plan.discardCost && c.discardIds?.length)
        costs.push(`弃掉${names(c.discardIds)}`);
    if (plan.tap)
        costs.push(`横置${publicObjectLabel(s, plan.sourceId ?? c.cardId)}`);
    if (plan.tapCharacters && c.tapIds?.length)
        costs.push(`横置${c.tapIds.map(id => publicObjectLabel(s, id)).join('、')}`);
    if (plan.honorCost)
        costs.push(`支付${plan.honorCost}名誉点`);
    return costs.join('，');
}
export function paidCostsClause(...args) { const text = paidCostsLog(...args); return text ? `，${text}` : ''; }
