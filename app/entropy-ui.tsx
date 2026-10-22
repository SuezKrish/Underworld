'use client';
import { useState } from 'react';
export function EntropyChoice({ a, busy, act }: {
    a: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [ids, setIds] = useState<string[]>([]), [subject, setSubject] = useState(''), [district, setDistrict] = useState('');
    const cards = a.cards ?? [];
    if (a.targetPair)
        return <><select aria-label='隐秘能力角色目标' value={subject} onChange={e => setSubject(e.target.value)}><option value=''>选择灾难角色</option>{cards.filter((c: any) => c.slot === 'subject').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select aria-label='隐秘能力地区目标' value={district} onChange={e => setDistrict(e.target.value)}><option value=''>选择地区</option>{cards.filter((c: any) => c.slot === 'district').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className='primary' disabled={busy || !subject || !district} onClick={() => act({ type: 'effect-choice', choiceId: a.id, targetIds: [subject, district] })}>确认隐秘目标</button></>;
    if (a.kind === 'entropy-assets')
        return <><p>选择{a.count}张资产牺牲 · 已选{ids.length}</p><div className='effect-options'>{cards.map((c: any) => <label key={c.id}><input type='checkbox' aria-label={'牺牲资产 ' + c.name + ' ' + c.id} checked={ids.includes(c.id)} disabled={busy || ids.length >= a.count && !ids.includes(c.id)} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name}</label>)}</div><button className='primary' disabled={busy || ids.length !== a.count} onClick={() => act({ type: 'effect-choice', choiceId: a.id, cardIds: ids })}>确认牺牲资产</button></>;
    return <><div className='effect-options'>{cards.map((c: any) => <button className='secondary' key={c.id} title={c.text} disabled={busy} onClick={() => act({ type: 'effect-choice', choiceId: a.id, cardId: c.id })}>{c.name}{c.zone ? ` · ${c.zone === 'deck' ? '牌库' : '墓地'}` : ''}</button>)}</div>{a.canSkip && <button className='quiet' disabled={busy} onClick={() => act({ type: 'effect-choice', choiceId: a.id, skip: true })}>不检索</button>}</>;
}
