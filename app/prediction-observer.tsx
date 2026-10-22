'use client';
import { Rich } from './rich-text';
export function PredictionObserver({ a, busy, act, bottom, setBottom }: {
    a: any;
    busy: boolean;
    act: (c: any) => void;
    bottom: boolean;
    setBottom: (b: boolean) => void;
}) {
    const o = a.predictionObserver;
    if (!o)
        return null;
    return <div className='choice-panel'><h4>联席会议观察员 · 已放置1个危机标志</h4>{o.empty ? <p>敌方牌库为空。</p> : !o.inspected ? <button className='secondary' disabled={busy} onClick={() => act({ type: 'prediction-inspect', choiceId: a.id })}>检视敌方牌库顶（可选）</button> : <><p><Rich name text={o.card.displayName ?? o.card.name}/></p><p className='rich-preview'><Rich text={o.card.text}/></p><label><input type='checkbox' checked={bottom} disabled={busy} onChange={e => setBottom(e.target.checked)}/>将该牌置于敌方牌库底</label></>}</div>;
}
