'use client';
import { useState } from 'react';
import { OrderRows } from './round-ui';
import { PredictionObserver } from './prediction-observer';
export function RealityChoice({ a, busy, act }: {
    a: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [ids, setIds] = useState<string[]>([]), [top, setTop] = useState<string[]>(a.cards?.map((c: any) => c.id) ?? []), [bottom, setBottom] = useState<string[]>([]), [observerBottom, setObserverBottom] = useState(false);
    const submit = (data: any) => act({ type: 'effect-choice', choiceId: a.id, ...data });
    if (a.kind === 'reality-crow-predict')
        return <><PredictionObserver a={a} busy={busy} act={act} bottom={observerBottom} setBottom={setObserverBottom}/><div className='order-columns'><div><h4>牌库顶</h4><OrderRows ids={top} cards={a.cards} setIds={setTop} moveOther={id => { setTop(top.filter(x => x !== id)); setBottom([...bottom, id]); }} otherLabel='置底'/></div><div><h4>牌库底</h4><OrderRows ids={bottom} cards={a.cards} setIds={setBottom} moveOther={id => { setBottom(bottom.filter(x => x !== id)); setTop([...top, id]); }} otherLabel='置顶'/></div></div><button className='primary' disabled={busy} onClick={() => submit({ top, bottom, observerBottom })}>完成预测并展示顶牌</button></>;
    if (a.kind === 'reality-fate-search')
        return <><p>选择至多三张不同名命运牌，封印于本方秘社。已选{ids.length}/3。</p><div className='effect-options'>{a.cards?.map((c: any) => <label key={c.id}><input type='checkbox' aria-label={`泰达提斯检索 ${c.name} ${c.id}`} checked={ids.includes(c.id)} disabled={busy || !ids.includes(c.id) && (ids.length >= 3 || ids.some(id => a.cards.find((x: any) => x.id === id)?.name === c.name))} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name}</label>)}</div><button className='primary' disabled={busy} onClick={() => submit({ cardIds: ids })}>确认封印 {ids.length} 张</button></>;
    return <><div className='effect-options'>{a.cards?.map((c: any) => <button className='secondary' disabled={busy} key={c.id} title={c.text} onClick={() => submit({ cardId: c.id })}>{c.name}</button>)}</div>{a.canSkip && <button className='quiet' disabled={busy} onClick={() => submit({ skip: true })}>{a.kind === 'reality-crow-discard' ? '不弃牌，展示牌入墓' : '放弃可选处理'}</button>}</>;
}
