'use client';
import { useCallback, useEffect, useState } from 'react';
import { EffectPreviewSurface, EffectPreviewLegend, AbilityContextSurface } from './card-information';
import { effectDraftTargets, effectDraftCosts } from '../engine/effect-preview.mjs';
import { TargetAction } from './automation-ui';
import { defaultTriggerEnabled, toggleTriggerEnabled } from '../engine/trigger-selection.mjs';
import { hasCardType } from '../engine/card-types.mjs';
export function TriggerRound({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const r = room.triggerRound;
    return r ? <TriggerRoundChoice key={`${r.id}:${r.controller}`} room={room} r={r} busy={busy} act={act}/> : null;
}
function TriggerRoundChoice({ room, r, busy, act }: {
    room: any;
    r: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [drafts, setDrafts] = useState<Record<string, any>>({}), [order, setOrder] = useState<string[]>(r.abilities.map((a: any) => a.id));
    const [enabled, setEnabled] = useState<Record<string, boolean>>(() => defaultTriggerEnabled(r.abilities));
    const update = useCallback((id: string, next: any) => setDrafts(prev => JSON.stringify(prev[id]) === JSON.stringify(next) ? prev : { ...prev, [id]: next }), []);
    if (r.controller !== room.seat)
        return <section className='choice-panel trigger-round-panel'><h3>第 {r.number} 触发轮</h3><p>等待 {room.seats[r.controller].name} 批量选择并排列本方 {r.counts[r.controller]} 条触发。</p></section>;
    const accepted = order.filter(id => { const a = r.abilities.find((a: any) => a.id === id); return a.pending || enabled[id] && !a.unavailable; });
    const valid = r.abilities.every((a: any) => a.pending || a.unavailable || !enabled[a.id] || drafts[a.id]?.valid);
    const toggleAll = (fire: boolean) => setEnabled(defaultTriggerEnabled(r.abilities, fire));
    const shift = (id: string, delta: number) => {
        const i = order.indexOf(id), j = i + delta;
        if (j < 0 || j >= order.length)
            return;
        const next = [...order];
        [next[i], next[j]] = [next[j], next[i]];
        setOrder(next);
    };
    const decisions = r.abilities.filter((a: any) => !a.pending).map((a: any) => enabled[a.id] && !a.unavailable ? drafts[a.id]?.command : { triggerId: a.id, fire: false });
    return <section className='choice-panel trigger-round-panel' aria-label='批量触发选择'><h3>第 {r.number} 触发轮 · 本方 {r.abilities.length} 条</h3><p>从上到下入栈：先入栈，后结算。本轮发动引起的新触发在下一轮处理。费用和次数按入栈顺序检查，无法支付或已达次数上限的能力不发动。</p><EffectPreviewLegend /><div className='trigger-round-tools'><button className='secondary' disabled={busy} onClick={() => toggleAll(true)}>全部发动（可选）</button><button className='quiet' disabled={busy} onClick={() => toggleAll(false)}>全部不发动（可选）</button></div><div className='trigger-round-list'>{order.map((id, i) => { const a = r.abilities.find((a: any) => a.id === id); return <AbilityContextSurface key={id} abilityId={a.id}><EffectPreviewSurface className='trigger-round-row' sourceId={a.cardId ?? a.sourceId} targetIds={effectDraftTargets(drafts[id]?.command ?? a)} costIds={enabled[id] ? effectDraftCosts(drafts[id]?.command) : []} autoActivate={i === 0}><div className='trigger-round-row-heading'><label><input type='checkbox' aria-label={`发动 ${a.displayName ?? '触发能力'}`} checked={a.pending || enabled[id] && !a.unavailable} disabled={busy || a.pending || a.mandatory || a.unavailable} onChange={e => setEnabled(toggleTriggerEnabled(r.abilities, enabled, id, e.target.checked))}/><strong>{a.displayName ?? '触发能力'}</strong></label>{a.plan?.sharedOncePerRound && <small>同名角色每回合合计一次</small>}<span>{a.mandatory ? '强制触发' : a.pending ? '已发动' : '可选触发'}</span></div>{a.unavailable ? <p>当前无合法发动方式。</p> : a.pending ? <p>{a.prepaid ? '已支付费用，必须入栈；选择本轮入栈位置。' : '已发动，选择本轮入栈位置。'}</p> : enabled[id] && <TriggerDraft a={a} room={room} busy={busy} update={update}/>}<div className='trigger-round-order'><span>{accepted.includes(id) ? `第 ${accepted.indexOf(id) + 1} 个入栈 · 第 ${accepted.length - accepted.indexOf(id)} 个结算` : '不发动'}</span><button className='quiet' aria-label={`提前入栈 ${a.displayName ?? '触发能力'}`} disabled={busy || i === 0} onClick={() => shift(id, -1)}>↑</button><button className='quiet' aria-label={`延后入栈 ${a.displayName ?? '触发能力'}`} disabled={busy || i === order.length - 1} onClick={() => shift(id, 1)}>↓</button></div></EffectPreviewSurface></AbilityContextSurface>; })}</div><div className='trigger-round-submit'><button className='primary' disabled={busy || !valid} onClick={() => act({ type: 'trigger-round', roundId: r.id, decisions, abilityIds: accepted })}>确认本轮 · 发动 {accepted.length} 条</button>{!valid && <small>请完成已勾选能力的目标及费用选择。</small>}</div></section>;
}
function TriggerDraft({ a, room, busy, update }: {
    a: any;
    room: any;
    busy: boolean;
    update: (id: string, next: any) => void;
}) {
    const onDraft = useCallback((next: any) => update(a.id, next), [a.id, update]);
    if (a.kind === 'auto-ability')
        return <TargetAction card={room.players.flatMap((p: any) => p.play).find((c: any) => c.id === a.cardId) ?? { id: a.cardId, name: a.displayName }} plan={a.plan} options={room.abilityTargets?.[a.id] ?? []} room={room} trigger={a} disabled={busy} act={() => { }} onDraft={onDraft}/>;
    return <SimpleTriggerDraft a={a} room={room} busy={busy} onDraft={onDraft}/>;
}
function SimpleTriggerDraft({ a, room, busy, onDraft }: {
    a: any;
    room: any;
    busy: boolean;
    onDraft: (next: any) => void;
}) {
    const env = room.environmentTriggers?.find((x: any) => x.id === a.id), abyss = room.abyssTriggers?.find((x: any) => x.id === a.id);
    const [target, setTarget] = useState(''), [domain, setDomain] = useState(abyss?.domains?.[0] ?? '');
    const rumor = a.effect?.kind === 'seal-from-graveyard';
    const options = env?.targetOptions ?? (rumor ? room.players.flatMap((p: any) => p.play).filter((c: any) => !c.faceDown && hasCardType(c, 'character') && (c.controller === room.seat || !c.barrierNow)) : []);
    const needsTarget = rumor || env?.requiresTarget, valid = (!needsTarget || options.some((c: any) => c.id === target)) && (!abyss || abyss.domains.includes(domain)) && ((room.players[room.seat].costPool ?? 0) + room.players[room.seat].assets.filter((x: any) => !x.tapped).length >= (env?.cost ?? 0));
    const command = { type: env ? 'environment-trigger' : abyss ? 'abyss-trigger' : 'trigger-choice', triggerId: a.id, fire: true, targetIds: needsTarget ? [target] : [], ...(rumor ? { targetId: target } : {}), ...(abyss ? { domain } : {}) };
    const key = JSON.stringify({ command, valid: !busy && valid });
    useEffect(() => onDraft(JSON.parse(key)), [key, onDraft]);
    return <>{env?.cost > 0 && <p>发动费用 {env.cost}</p>}{needsTarget && <label>目标<select aria-label={`${a.displayName ?? '触发能力'}目标`} value={target} disabled={busy} onChange={e => setTarget(e.target.value)}><option value=''>选择目标</option>{options.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}{abyss && <label>魔法领域<select aria-label='深渊之序发动领域' value={domain} disabled={busy} onChange={e => setDomain(e.target.value)}>{abyss.domains.map((d: string) => <option key={d} value={d}>{d}</option>)}</select></label>}</>;
}
