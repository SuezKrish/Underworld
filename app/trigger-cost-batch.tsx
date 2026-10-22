'use client';
import { useCallback, useState } from 'react';
import { EffectPreviewSurface, EffectPreviewLegend, AbilityContextSurface } from './card-information';
import { effectDraftTargets, effectDraftCosts } from '../engine/effect-preview.mjs';
import { TargetAction } from './automation-ui';
import { defaultTriggerEnabled, toggleTriggerEnabled } from '../engine/trigger-selection.mjs';
import { unstableViewDiscount } from '../engine/sacrifice-payment.mjs';
export function TriggerCostBatch({ a, room, busy, act }: {
    a: any;
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const abilities = a.abilities ?? [], [enabled, setEnabled] = useState<Record<string, boolean>>(() => defaultTriggerEnabled(abilities)), [drafts, setDrafts] = useState<Record<string, any>>({}), [order, setOrder] = useState<string[]>(abilities.map((x: any) => x.id));
    const update = useCallback((id: string, d: any) => setDrafts(prev => JSON.stringify(prev[id]) === JSON.stringify(d) ? prev : { ...prev, [id]: d }), []);
    if (a.controller !== room.seat)
        return <section className='choice-panel'><h3>牺牲触发 · 批量费用</h3><p>等待 {room.seats[a.controller].name} 选择。</p></section>;
    const selected = order.filter(id => enabled[id]), valid = selected.every(id => drafts[id]?.valid), mana = selected.reduce((n, id) => { const x = abilities.find((x: any) => x.id === id), c = drafts[id]?.command ?? {}; return n + Math.max(0, (x.plan.cost ?? 0) + (x.plan.extraCost ? c.extraCost ?? 0 : 0) - unstableViewDiscount(room, x.plan, c)); }, 0);
    const shift = (id: string, delta: number) => {
        const i = order.indexOf(id), j = i + delta;
        if (j < 0 || j >= order.length)
            return;
        const next = [...order];
        [next[i], next[j]] = [next[j], next[i]];
        setOrder(next);
    };
    return <section className='choice-panel trigger-round-panel trigger-cost-batch-panel' aria-label='批量触发费用'><h3>牺牲触发 · {abilities.length}条费用选择</h3><p>待牺牲者仍在场；先选费用，再排列入栈。</p><EffectPreviewLegend /><div className='trigger-round-tools'><button className='quiet' disabled={busy} onClick={() => setEnabled(defaultTriggerEnabled(abilities, false))}>全部不发动（可选）</button></div><div className='trigger-round-list'>{order.map((id, i) => { const x = abilities.find((x: any) => x.id === id); return <AbilityContextSurface key={id} abilityId={x.id}><EffectPreviewSurface className='trigger-round-row' sourceId={x.cardId ?? x.sourceId} targetIds={effectDraftTargets(drafts[id]?.command ?? x)} costIds={enabled[id] ? effectDraftCosts(drafts[id]?.command) : []} autoActivate={i === 0}><div className='trigger-round-row-heading'><label><input type='checkbox' aria-label={`支付 ${x.displayName}的触发费用`} checked={!!enabled[id]} disabled={busy || x.mandatory} onChange={e => setEnabled(toggleTriggerEnabled(abilities, enabled, id, e.target.checked))}/><strong>{x.displayName}</strong></label></div>{enabled[id] && <PaymentDraft a={x} room={room} busy={busy} update={update}/>}<div className='trigger-round-order'><button className='quiet' aria-label={`优先支付 ${x.displayName}`} disabled={busy || i === 0} onClick={() => shift(id, -1)}>↑</button><button className='quiet' aria-label={`延后支付 ${x.displayName}`} disabled={busy || i === order.length - 1} onClick={() => shift(id, 1)}>↓</button></div></EffectPreviewSurface></AbilityContextSurface>; })}</div><div className='trigger-round-submit'><button className='primary' disabled={busy || !valid || mana > a.available} onClick={() => act({ type: 'trigger-cost-batch-choice', choiceId: a.id, decisions: abilities.map((x: any) => enabled[x.id] ? { ...drafts[x.id].command, triggerId: x.id, fire: true } : { triggerId: x.id, fire: false }), abilityIds: selected })}>确认费用 · 发动{selected.length}条</button>{mana > a.available && <p>所选触发的费用合计超出当前可用费用。</p>}</div></section>;
}
function PaymentDraft({ a, room, busy, update }: {
    a: any;
    room: any;
    busy: boolean;
    update: (id: string, d: any) => void;
}) {
    const onDraft = useCallback((d: any) => update(a.id, d), [a.id, update]);
    return <TargetAction room={room} card={room.players.flatMap((p: any) => p.play).find((c: any) => c.id === a.cardId) ?? { id: a.cardId, name: a.displayName }} plan={a.plan} options={room.abilityTargets?.[a.id] ?? a.targetOptions ?? []} trigger={a} disabled={busy} act={() => { }} onDraft={onDraft}/>;
}
