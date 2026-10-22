import { useState } from 'react';
export function ReverberationChoice({ a, busy, act }: {
    a: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [hand, setHand] = useState(a.cards?.[0]?.id ?? ''), [sealed, setSealed] = useState(a.cards?.[1]?.id ?? ''), [ids, setIds] = useState<string[]>([]);
    const submit = (extra: any) => act({ type: 'effect-choice', choiceId: a.id, ...extra });
    if (a.kind === 'reverberation-elder')
        return <>
  <label>置于手中<select aria-label='迷途老者入手牌' value={hand} disabled={busy} onChange={e => setHand(e.target.value)}>{a.cards.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  {a.cards.length > 1 && <label>封印牌<select aria-label='迷途老者封印牌' value={sealed !== hand ? sealed : ''} disabled={busy} onChange={e => setSealed(e.target.value)}><option value=''>选择另一张牌</option>{a.cards.filter((c: any) => c.id !== hand).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
  {a.cards.length > 2 && <p>入墓：{a.cards.filter((c: any) => c.id !== hand && c.id !== sealed).map((c: any) => c.name).join('、')}</p>}
  <button className='primary' disabled={busy || !hand || a.cards.length > 1 && (!sealed || sealed === hand)} onClick={() => submit({ handId: hand, sealId: a.cards.length > 1 ? sealed : undefined })}>确认分配</button>
 </>;
    if (a.kind === 'reverberation-gift')
        return <><p>选择{a.max}张牌封印，其余检视牌随机置于牌库底。</p><div className='effect-options'>{a.cards.map((c: any) => <label key={c.id}><input type='checkbox' aria-label={`烈焰赠礼选择 ${c.name} ${c.id}`} checked={ids.includes(c.id)} disabled={busy || ids.length >= a.max && !ids.includes(c.id)} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name} · {c.printedCostText ?? c.printedCost}</label>)}</div><button className='primary' disabled={busy || ids.length !== a.max} onClick={() => submit({ cardIds: ids })}>确认封印{ids.length}张</button></>;
    return <div className='effect-options'>{a.cards.map((c: any) => <button className='secondary' key={c.id} disabled={busy} onClick={() => submit({ cardId: c.id })}>{c.name}</button>)}</div>;
}
