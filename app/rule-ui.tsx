'use client';
import { useEffect, useState } from 'react';
import { Rich } from './rich-text';
export function RuleSacrifice({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [ids, setIds] = useState<string[]>([]), a = room.ruleChoice;
    useEffect(() => setIds([]), [a?.id]);
    if (!a)
        return null;
    return <section className="choice-panel"><h3>规则性动作 · {a.kind === 'unique' ? `独有角色「${a.identity}」` : a.kind === 'path' ? '道途限制' : '领袖限制'}</h3><p>进场触发已经完成发动选择。请选择牺牲 {a.count} 张牌，直到只操控一个；此动作不进入堆叠，期间没有响应窗口。</p>{a.controller !== room.seat ? <p>等待 {room.seats[a.controller].name} 选择牺牲。</p> : <><div className="effect-options">{a.cards.map((c: any) => <label key={c.id}><input type="checkbox" checked={ids.includes(c.id)} disabled={busy || ids.length >= a.count && !ids.includes(c.id)} aria-label={`规则牺牲 ${c.name} ${c.id}`} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/><Rich name text={c.displayName ?? c.name}/> · {a.kind === 'path' ? '结附于本方秘社' : `地区${c.district + 1}`} · 拥有者 {c.ownerName}</label>)}</div><p>已选择 {ids.length}/{a.count}</p><button className="primary" disabled={busy || ids.length !== a.count} onClick={() => act({ type: 'rule-sacrifice', choiceId: a.id, cardIds: ids })}>确认规则性牺牲</button></>}</section>;
}
