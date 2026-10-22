'use client';
import { useState } from 'react';
export function GreenBlackChoice({ a, busy, act, room }: {
    a: any;
    busy: boolean;
    act: (c: any) => void;
    room: any;
}) {
    const [selected, setSelected] = useState<string[]>([]);
    if (a.kind === 'green-swords-search')
        return <><p>选择 {selected.length}/3 张</p><div className='effect-options'>{a.cards?.map((c: any) => <label key={c.id}><input type='checkbox' checked={selected.includes(c.id)} disabled={busy || selected.length >= 3 && !selected.includes(c.id)} aria-label={`双剑封印 ${c.name} ${c.id}`} onChange={e => setSelected(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))}/><span>{c.name} · {c.zone === 'hand' ? '手牌' : c.zone === 'deck' ? '牌库' : c.zone === 'headquarters' ? '集团总部' : '墓地'}</span></label>)}</div><button className='primary' disabled={busy} onClick={() => act({ type: 'effect-choice', choiceId: a.id, cardIds: selected })}>封印并洗牌</button></>;
    const funds = (room.players[room.seat].costPool ?? 0) + room.players[room.seat].assets.filter((c: any) => !c.tapped).length;
    return <><div className='effect-options'>{a.cards?.map((c: any) => <button className='secondary' key={c.id} disabled={busy || (c.id === 'pay' || a.kind === 'green-fire-target') && funds < 2} onClick={() => act({ type: 'effect-choice', choiceId: a.id, cardId: c.id })}>{c.name}</button>)}</div>{a.canSkip && <button className='quiet' disabled={busy} onClick={() => act({ type: 'effect-choice', choiceId: a.id, skip: true })}>不支付</button>}</>;
}
