'use client';
import { useState } from 'react';
export function useGraveCast(room: any, card: any) { const sealed = !!room?.sealedCastingMethods?.[card.id], methods = (sealed ? room.sealedCastingMethods[card.id] : room?.graveCastingMethods?.[card.id]) ?? [], [requested, setMethod] = useState(''), method = methods.find((m: any) => m.id === requested) ?? methods[0]; return { methods, method, setMethod, sealed }; }
export function GraveCastMethod({ card, choice, disabled }: {
    card: any;
    choice: any;
    disabled: boolean;
}) {
    if (!choice.methods.length)
        return null;
    return <label>{choice.sealed ? '封印区' : '墓地'}打出方式<select aria-label={`${card.name}${choice.sealed ? '封印区' : '墓地'}打出方式`} value={choice.method.id} disabled={disabled} onChange={e => choice.setMethod(e.target.value)}>{choice.methods.map((m: any) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>;
}
export function HadesCosts({ options, ids, setIds, disabled }: {
    options: any[];
    ids: string[];
    setIds: (x: string[]) => void;
    disabled: boolean;
}) {
    if (!options)
        return null;
    return <fieldset className='effect-options'><legend>哈迪斯额外费用 · 选择两张墓地牌置底</legend>{options.map(c => <label key={c.id}><input type='checkbox' aria-label={`哈迪斯费用 ${c.name} ${c.id}`} checked={ids.includes(c.id)} disabled={disabled || ids.length >= 2 && !ids.includes(c.id)} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name}</label>)}</fieldset>;
}
export function GrayCosts({ plan, room, disabled, progress, setProgress, costCardId, setCostCardId }: {
    plan: any;
    room: any;
    disabled: boolean;
    progress: Record<string, number>;
    setProgress: (x: Record<string, number>) => void;
    costCardId: string;
    setCostCardId: (x: string) => void;
}) { return <>{plan.progressCost && <fieldset className='effect-options'><legend>移除{plan.progressCost}个推进标志作为费用</legend>{room.progressCostCards?.map((c: any) => <label key={c.id}>{c.name} · 推进{c.progress}<input type='number' aria-label={`推进费用 ${c.name} ${c.id}`} min={0} max={c.progress} value={progress[c.id] ?? 0} disabled={disabled} onChange={e => setProgress({ ...progress, [c.id]: Number(e.target.value) })}/></label>)}</fieldset>}{plan.sourceProgressCost && <span>额外费用：移除来源牌{plan.sourceProgressCost}个推进标志</span>}{plan.sacrificeAssetOrPlan && <select aria-label='资产或秘密计划牺牲费用' value={costCardId} onChange={e => setCostCardId(e.target.value)}><option value=''>选择牺牲的资产或秘密计划</option>{room.planSacrificeCards?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</>; }
export function GrayChoice({ a, room, busy, act }: {
    a: any;
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [text, setText] = useState(''), [number, setNumber] = useState(0), [damage, setDamage] = useState<Record<string, number>>({});
    const submit = (extra: any) => act({ type: 'effect-choice', choiceId: a.id, ...extra }), available = room.players[room.seat].costPool + room.players[room.seat].assets.filter((c: any) => !c.tapped).length;
    if (a.kind === 'gray-subtype')
        return <><input aria-label='远古宿敌角色类别' maxLength={40} value={text} onChange={e => setText(e.target.value)}/><button className='primary' disabled={busy || !text.trim()} onClick={() => submit({ subtype: text })}>确认类别</button></>;
    if (a.kind === 'gray-number')
        return <><input type='number' aria-label='禁令印刷费用' min={0} max={1000} value={number} onChange={e => setNumber(Number(e.target.value))}/><button className='primary' disabled={busy || !Number.isSafeInteger(number) || number < 0 || number > 1000} onClick={() => submit({ number })}>确认印刷费用</button></>;
    if (a.kind === 'gray-pay' || a.kind === 'gray-tax')
        return <div className='reward-row'><button className='primary' disabled={busy || available < a.amount} onClick={() => submit({ pay: true })}>支付{a.amount}{a.kind === 'gray-pay' ? '并抓一张' : '，保留效果'}</button><button className='secondary' disabled={busy} onClick={() => submit({ pay: false })}>{a.kind === 'gray-tax' ? (a.cannotTerminate ? '不支付，保留效果' : '不支付，终止整个效果') : '不支付'}</button></div>;
    if (a.kind === 'gray-urban-reveal')
        return <div className='reward-row'><button className='primary' disabled={busy} onClick={() => submit({ mode: 'lock' })}>放置一个锁定标志</button><button className='secondary' disabled={busy} onClick={() => submit({ mode: 'damage' })}>造成1伤害</button></div>;
    if (a.kind === 'gray-damage') {
        const allocation = (a.cards ?? []).map((c: any) => ({ cardId: c.id, amount: damage[c.id] ?? 0 })), total = allocation.reduce((n: number, c: any) => n + c.amount, 0);
        return <>{a.cards?.map((c: any) => <label key={c.id}>{c.name}<input type='number' aria-label={`都市更新伤害 ${c.name} ${c.id}`} min={0} max={a.max} value={damage[c.id] ?? 0} onChange={e => setDamage({ ...damage, [c.id]: Number(e.target.value) })}/></label>)}<button className='primary' disabled={busy || total > a.max || allocation.some((x: any) => !Number.isSafeInteger(x.amount) || x.amount < 0)} onClick={() => submit({ damage: allocation })}>确认分配 · {total}/{a.max}</button></>;
    }
    return <><div className='effect-options'>{a.cards?.map((c: any) => <button className='secondary' key={c.id} disabled={busy} title={c.text} onClick={() => submit({ cardId: c.id })}>{c.name}</button>)}</div>{a.canFail && <button className='quiet' disabled={busy} onClick={() => submit({ fail: true })}>未找到，洗牌并继续</button>}</>;
}
