import { useState } from 'react';
export function FieldSupportTopSpells({ a, busy, act }: {
    a: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [ids, setIds] = useState<string[]>([]);
    return <><p>选择任意数量的法术牌。选中的牌展示并加入手中，其余洗回牌库。</p><div className='effect-options'>{a.cards?.map((c: any) => <label key={c.id}><input type='checkbox' aria-label={`富兰克林选择 ${c.name} ${c.id}`} checked={ids.includes(c.id)} disabled={busy || !a.eligibleIds?.includes(c.id)} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name} · {a.eligibleIds?.includes(c.id) ? '法术' : '不可选择'}</label>)}</div><button className='primary' disabled={busy} onClick={() => act({ type: 'effect-choice', choiceId: a.id, cardIds: ids })}>确认选择 {ids.length} 张，其余洗回牌库</button></>;
}
