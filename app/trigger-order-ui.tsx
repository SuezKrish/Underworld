'use client';
import { useState } from 'react';
import { AbilityContextSurface } from './card-information';
export function TriggerOrder({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const a = room.triggerOrderChoice;
    return a ? <TriggerOrderChoice key={a.id} a={a} room={room} busy={busy} act={act}/> : null;
}
function TriggerOrderChoice({ a, room, busy, act }: {
    a: any;
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [ids, setIds] = useState<string[]>([]);
    const shift = (i: number, n: number) => { const next = [...ids]; [next[i], next[n]] = [next[n], next[i]]; setIds(next); };
    const legacy = a.order === 'resolution', events: Record<string, string> = { entry: '进场触发', attached: '结附触发', death: '死亡触发', prepare: '准备触发', end: '结束触发', 'grave-entry': '入墓触发', seal: '封印触发', targeted: '成为目标触发' };
    const label = (x: any) => `${x.name}${events[x.event] ? ` · ${events[x.event]}` : ''}${x.mandatory ? ' · 强制' : ''}`;
    return <section className="choice-panel"><h3>本方触发{legacy ? '结算' : '入栈'}顺序</h3><p>{legacy ? '按选择顺序结算（此房间的旧排序选择）。' : '先选择的先入栈、后结算；最后选择的最先结算。'}</p>{room.seat !== a.controller ? <p>等待{room.seats[a.controller].name}安排触发顺序。</p> : <><div className="effect-options">{a.abilities.filter((x: any) => !ids.includes(x.id)).map((x: any) => <AbilityContextSurface key={x.id} abilityId={x.id}><button className="secondary" disabled={busy} onClick={() => setIds([...ids, x.id])}>选择第{ids.length + 1}个：{label(x)}</button></AbilityContextSurface>)}</div><ol className="effect-options">{ids.map((id, i) => <li key={id}><AbilityContextSurface abilityId={id}><strong>{label(a.abilities.find((x: any) => x.id === id))}</strong><p>{legacy ? `第${i + 1}个结算` : `第${i + 1}个入栈 · 第${a.abilities.length - i}个结算`}</p><div className="reward-row"><button className="secondary" disabled={busy || i === 0} onClick={() => shift(i, i - 1)}>{legacy ? '提前结算' : '提前入栈'}</button><button className="secondary" disabled={busy || i === ids.length - 1} onClick={() => shift(i, i + 1)}>{legacy ? '延后结算' : '延后入栈'}</button><button className="quiet" disabled={busy} onClick={() => setIds(ids.filter(x => x !== id))}>重新选择</button></div></AbilityContextSurface></li>)}</ol><button className="primary" disabled={busy || ids.length !== a.abilities.length} onClick={() => act({ type: 'trigger-order', choiceId: a.id, abilityIds: ids })}>确认{legacy ? '结算' : '入栈'}顺序</button></>}</section>;
}
