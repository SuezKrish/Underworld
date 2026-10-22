import { useState } from 'react';
export function FateChoice({ a, busy, act }: {
    a: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [modes, setModes] = useState<string[]>([]), [amounts, setAmounts] = useState<Record<string, number>>({}), total = Object.values(amounts).reduce((n, v) => n + v, 0);
    const submit = (extra: any) => act({ type: 'effect-choice', choiceId: a.id, ...extra });
    if (a.kind === 'fate-modes')
        return <><div className='effect-options'>{a.cards.map((o: any) => <label key={o.id}><input type='checkbox' aria-label={`命运无常选择 ${o.name}`} checked={modes.includes(o.id)} disabled={busy} onChange={e => setModes(e.target.checked ? [...modes, o.id] : modes.filter(id => id !== o.id))}/>{o.name}</label>)}</div><button className='primary' disabled={busy || !modes.length} onClick={() => submit({ modes })}>锁定执行项目</button></>;
    if (a.kind === 'fate-influence')
        return <><p>选择移除两个本方势力标志 · 已选{total}/2</p><div className='effect-options'>{a.cards.map((o: any) => <label className='influence-choice-row' key={o.id}><span>{o.name}</span><input type='number' aria-label={`${o.name}移除数量`} min={0} max={Math.min(2, o.count)} step={1} value={amounts[o.id] ?? 0} disabled={busy} onChange={e => { const n = Number(e.target.value); setAmounts({ ...amounts, [o.id]: Number.isSafeInteger(n) ? Math.max(0, Math.min(2, o.count, n)) : 0 }); }}/></label>)}</div><button className='primary' disabled={busy || total !== 2} onClick={() => submit({ allocations: Object.entries(amounts).filter(([, amount]) => amount > 0).map(([id, amount]) => ({ id, amount })) })}>锁定移除位置</button></>;
    return <div className='effect-options'>{a.cards.map((c: any) => <button className='secondary' key={c.id} disabled={busy} title={c.text} onClick={() => submit({ cardId: c.id })}>{a.kind === 'fate-sacrifice' ? '牺牲' : a.kind === 'fate-asset' ? '横置变资产' : '置于手中'} · {c.name}</button>)}</div>;
}
