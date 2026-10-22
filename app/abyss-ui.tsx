'use client';
import { searchChoiceDisplay } from '../engine/search-choice-display.mjs';
import { useState } from 'react';
type Props = {
    room: any;
    busy: boolean;
    act: (c: any) => void;
};
function HandAction({ a, room, busy, act }: Props & {
    a: any;
}) {
    const [costCard, setCostCard] = useState(''), [target, setTarget] = useState('');
    const standard = !room.turn || room.turn.standardAllowed && room.flow.stepOwner === room.seat && !room.flow.stack.length;
    const mine = room.players[room.seat], available = (mine.costPool ?? 0) + mine.assets.filter((x: any) => !x.tapped).length;
    const locked = room.status !== 'playing' || room.flow.locked || room.flow.priority !== room.seat || room.pendingChoiceCount > 0 || room.ruleChoice || room.effectChoice || room.abyssChoice || room.hidden || room.battle;
    const summon = false, validCard = a.costCards.some((c: any) => c.id === costCard), validTarget = !summon || a.targets.some((t: any) => t.id === target);
    return <div className='reward-row'><strong>{a.name} · {a.from === 'sealed' ? '封印区' : '手牌'}</strong><span>{a.fast ? '快速' : '标准'}手牌行动 · {a.cost}费用</span><select aria-label={`${a.name}封印费用`} value={costCard} onChange={e => setCostCard(e.target.value)}><option value=''>{summon ? '选择星辰／心灵角色费用' : '选择另一张手牌费用'}</option>{a.costCards.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.zone === 'graveyard' ? ' · 墓地' : c.zone === 'play' ? ' · 场上' : ''} · 拥有者 {c.ownerName}</option>)}</select>{summon && <select aria-label={`${a.name}目标地区`} value={target} onChange={e => setTarget(e.target.value)}><option value=''>选择目标地区</option>{a.targets.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}<button className='primary' disabled={busy || !!locked || !a.fast && !standard || available < a.cost || !validCard || !validTarget} onClick={() => act({ type: 'abyss-hand', cardId: a.id, ...(summon ? { sealCostId: costCard, targetIds: [target] } : { otherHandId: costCard }) })}>支付并发动</button></div>;
}
function FieldAction({ a, room, busy, act }: Props & {
    a: any;
}) {
    const [target, setTarget] = useState('');
    const mine = room.players[room.seat], available = (mine.costPool ?? 0) + mine.assets.filter((x: any) => !x.tapped).length;
    const disabled = busy || room.status !== 'playing' || room.flow.locked || room.flow.priority !== room.seat || room.flow.stepOwner !== room.seat || room.turn && !room.turn.standardAllowed || room.flow.stack.length > 0 || room.pendingChoiceCount > 0 || room.ruleChoice || room.effectChoice || room.abyssChoice || a.used || available < 2;
    return <div className='reward-row'><strong>{a.name} · 场上行动2</strong><select aria-label='狄斯·帕忒尔目标地区' value={target} onChange={e => setTarget(e.target.value)}><option value=''>选择目标地区</option>{a.targets.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select><button className='primary' disabled={!!disabled || !a.targets.some((t: any) => t.id === target)} onClick={() => act({ type: 'abyss-field', cardId: a.id, targetIds: [target] })}>{a.used ? '本回合已发动' : '放置封印角色进场'}</button><small>结算时选择角色；每回合一次。</small></div>;
}
function Choice({ a, room, busy, act }: Props & {
    a: any;
}) {
    a = searchChoiceDisplay(a);
    const [ids, setIds] = useState<string[]>([]);
    const ds = ['星辰', '心灵'];
    const chosen = (a.cards ?? []).filter((c: any) => ids.includes(c.id));
    const valid = chosen.length < 2 || ds.some((d: string) => chosen[0].magicDomains.includes(d) && chosen[1].magicDomains.includes(ds.find(x => x !== d)));
    const send = (fields: any) => act({ type: 'abyss-choice', choiceId: a.id, ...fields });
    const labels: Record<string, string> = { search: '检索副名为深渊兽的牌', release: '选择封印角色放置进场', discard: '可以弃一张牌，再取回星辰／心灵牌', recover: '取回至多一张星辰牌和一张心灵牌', baldek: '选择印刷费用最低的敌方角色', sacrifice: '可以牺牲本方角色，再封印所选敌方角色' };
    return <section className='choice-panel'><h3>{a.name} · {labels[a.mode]}</h3><p>能力正在结算，当前没有快速行动窗口。</p>{a.hostName && <p>原封印位置：{a.hostName}</p>}{a.controller !== room.seat ? <p>等待 {room.seats[a.controller].name} 完成选择。</p> : a.mode === 'recover' ? <><div className='effect-options'>{a.cards.map((c: any) => <label key={c.id}><input type='checkbox' aria-label={`德鲁伊斯取回 ${c.name}`} checked={ids.includes(c.id)} disabled={busy || ids.length >= 2 && !ids.includes(c.id)} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name} · {(c.magicDomains ?? []).join('/')}</label>)}</div><button className='primary' disabled={busy || !valid} onClick={() => send({ cardIds: ids })}>确认取回 {ids.length} 张</button></> : <><div className='effect-options'>{a.cards?.map((c: any) => <button className='secondary' key={c.id} title={c.text} disabled={busy} onClick={() => send({ cardId: c.id })}>{c.name} · 拥有者 {c.ownerName}</button>)}</div>{a.mode === 'search' && <button className='quiet' disabled={busy} onClick={() => send({ fail: true })}>查找失败并洗牌</button>}{a.optional && <button className='quiet' disabled={busy} onClick={() => send({ skip: true })}>不执行</button>}</>}</section>;
}
export function AbyssPanel({ room, busy, act }: Props) {
    const hand = room.abyssHandActions ?? [], field = room.abyssFieldActions ?? [], triggers = room.triggerRound ? [] : room.abyssTriggers ?? [];
    return <>{(hand.length > 0 || field.length > 0 || room.abyssHiddenBonus > 0) && <details className='zone-details' open><summary>深渊兽能力{room.abyssHiddenBonus > 0 ? ` · 本回合隐秘对抗+${room.abyssHiddenBonus}` : ''}</summary>{hand.map((a: any) => <HandAction key={a.id} a={a} room={room} busy={busy} act={act}/>)}{field.map((a: any) => <FieldAction key={a.id} a={a} room={room} busy={busy} act={act}/>)}</details>}{triggers.map((a: any) => <section className='choice-panel' key={a.id}><h3>{a.name} · 是否发动？</h3><p>{a.subjectName}被封印。选择回底并抓牌后，等待下一个快速行动窗口入栈；每种领域每回合一次。</p>{a.domains.map((domain: string) => <button className='primary' key={domain} disabled={busy} onClick={() => act({ type: 'abyss-trigger', triggerId: a.id, fire: true, domain })}>以{domain}牌发动</button>)}<button className='quiet' disabled={busy} onClick={() => act({ type: 'abyss-trigger', triggerId: a.id, fire: false })}>不发动</button>{!a.domains.length && <p>本回合该领域次数已用完。</p>}</section>)}{room.abyssChoice && <Choice key={room.abyssChoice.id} a={room.abyssChoice} room={room} busy={busy} act={act}/>}</>;
}
