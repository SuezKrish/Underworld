'use client';
import { useState } from 'react';
export function CardNameChoice({ a, busy, act }: {
    a: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [query, setQuery] = useState(''), [selected, setSelected] = useState('');
    const text = query.trim().normalize('NFKC').toLocaleLowerCase(), options = a.cards ?? [];
    const matches = text ? options.filter((c: any) => c.name.normalize('NFKC').toLocaleLowerCase().includes(text)) : [];
    const chosen = matches.find((c: any) => c.id === selected);
    return <div className='card-name-choice'>
  <label>声明卡牌名称<input autoComplete='off' aria-label='声明卡牌名称搜索' placeholder='输入牌名后显示匹配结果' value={query} onChange={e => { setQuery(e.target.value); setSelected(''); }} disabled={busy}/></label>
  {text && <><small role='status'>{matches.length ? `${matches.length}个匹配名称` : '没有匹配的卡牌名称'}</small><div className='name-matches' aria-label='匹配的卡牌名称'>{matches.map((c: any) => <button key={c.id} className={c.id === selected ? 'primary' : 'secondary'} aria-pressed={c.id === selected} disabled={busy} onClick={() => setSelected(c.id)}>{c.name}</button>)}</div></>}
  <button className='primary' disabled={busy || !chosen} onClick={() => act({ type: 'effect-choice', choiceId: a.id, cardId: chosen.id })}>{chosen ? `确认声明：${chosen.name}` : '确认声明'}</button>
 </div>;
}
