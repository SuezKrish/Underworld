'use client';
import { useState } from 'react';
export function SpellCopyChoice({ a, busy, act }: {
    a: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [selected, setSelected] = useState<Record<number, string>>({});
    const replacements = (a.copySlots ?? []).flatMap((slot: any) => selected[slot.index] ? [{ index: slot.index, targetId: selected[slot.index] }] : []);
    const valid = replacements.every((r: any) => a.copySlots.find((s: any) => s.index === r.index)?.options.some((o: any) => o.id === r.targetId));
    return <><p>{a.copyName} · 保留原来的模式、X及分配数量。</p><div className='effect-options'>{a.copySlots?.map((slot: any) => <label key={slot.index}>{slot.label}<select aria-label={`法术复制目标${slot.index + 1}`} disabled={busy} value={selected[slot.index] ?? ''} onChange={e => setSelected({ ...selected, [slot.index]: e.target.value })}><option value=''>保留原目标</option>{slot.options.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>)}</div><button className='primary' disabled={busy || !valid} onClick={() => act({ type: 'effect-choice', choiceId: a.id, replacements })}>生成复制并进入堆叠</button></>;
}
