'use client';
import { unstableViewDiscount } from '../engine/sacrifice-payment.mjs';
import { CharacterEntryDistrict, randomCharacterEntry } from './character-entry-district';
import { useState } from 'react';
import { TargetAction, CharacterPlayAction } from './automation-ui';
import { Rich } from './rich-text';
type Props = {
    room: any;
    busy: boolean;
    act: (command: any) => void;
};
function Action({ a, room, busy, act }: Props & {
    a: any;
}) {
    const [target, setTarget] = useState(''), [costIds, setCostIds] = useState<string[]>([]), [mode, setMode] = useState(a.plan.modes?.[0]?.id ?? ''), [district, setDistrict] = useState(0);
    const plan = a.plan, legal = a.targets.some((o: any) => o.id === target) ? target : '', costs = costIds.filter(id => a.costCards.some((o: any) => o.id === id)), required = plan.sealCost?.count ?? plan.tapCost?.count ?? plan.tapAttachments?.count ?? plan.bottomSeals?.count ?? plan.sacrificeCost?.count ?? plan.discardCost?.count ?? 0;
    const mine = room.players[room.seat], available = (mine.costPool ?? 0) + mine.assets.filter((c: any) => !c.tapped).length;
    const payableCost = Math.max(0, a.cost - unstableViewDiscount(room, plan, { cardId: a.id, costIds: costs }));
    const locked = busy || !a.allowed || room.status !== 'playing' || room.flow.locked || room.flow.priority !== room.seat || room.pendingChoiceCount || room.ruleChoice || room.damageChoice || room.manualRequest || room.effectChoice || room.hidden || room.battle || plan.timing !== 'fast' && (!room.turn?.standardAllowed || room.flow.stepOwner !== room.seat || room.flow.stack.length);
    return <article className='rail-section'><strong><Rich name text={a.displayName ?? a.name}/></strong><p>{a.zone === 'asset' ? '资产区' : a.zone === 'hand' ? '手牌' : a.zone === 'sealed' ? '封印区' : '墓地'}{plan.timing === 'fast' ? '快速' : '标准'}行动 · {payableCost}费用{plan.honorCost ? `＋${plan.honorCost}名誉` : ''}{plan.oncePerRound ? ' · 此对象每回合一次' : ''}</p>{plan.minimumTime && <p>场上须有至少{plan.minimumTime}个时间标志。</p>}{plan.prepareOnly && <p>仅准备步骤可发动；先兆展示此牌，仍留在手中。</p>}{plan.target !== 'none' && <select aria-label={`${a.name}能力目标`} value={legal} onChange={e => setTarget(e.target.value)}><option value=''>选择目标</option>{a.targets.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}{plan.districtChoice && <select aria-label={`${a.name}效果进场地区`} value={district} onChange={e => setDistrict(Number(e.target.value))}>{room.districts.map((d: any, i: number) => d && <option key={i} value={i}>地区{i + 1} · {d.name}</option>)}</select>}{plan.modes && <select aria-label={`${a.name}标志类别`} value={mode} onChange={e => setMode(e.target.value)}>{plan.modes.map((m: any) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>}{required > 0 && <div className='effect-options'><p>额外费用：{plan.discardCost ? '弃掉符合条件的手牌' : plan.sacrificeCost ? '牺牲符合条件的本方角色' : plan.bottomSeals ? '选择秘社上的封印牌，按勾选顺序置于各拥有者牌库底' : plan.sealCost ? '从墓地选择牌，与来源牌一起封印于本方秘社' : plan.tapAttachments ? '横置符合条件的本方附属' : '横置符合条件的本方角色'} · 已选{costs.length}/{required}</p>{a.costCards.map((c: any) => <label key={c.id}><input type='checkbox' aria-label={`${a.name}额外费用 ${c.name} ${c.id}`} checked={costs.includes(c.id)} disabled={!!locked || costs.length >= required && !costs.includes(c.id)} onChange={e => setCostIds(e.target.checked ? [...costs, c.id] : costs.filter(id => id !== c.id))}/>{c.name}{c.costWeight > 1 ? ` · 可计作${c.costWeight}张` : ''} · 拥有者：{c.ownerName}{plan.bottomSeals && costs.includes(c.id) && !costs.slice(costs.indexOf(c.id) + 1).some(id => a.costCards.find((x: any) => x.id === id)?.owner === c.owner) && <small className='order-edge-label'>牌库底</small>}</label>)}</div>}<button className='primary' disabled={!!locked || available < payableCost || (costs.length > required || costs.reduce((n, id) => n + (a.costCards.find((c: any) => c.id === id)?.costWeight ?? 1), 0) < required) || plan.target !== 'none' && !legal} onClick={() => act({ type: 'zone-activate', cardId: a.id, actionIndex: a.actionIndex, targetIds: legal ? [legal] : [], costIds: costs, mode, district })}>发动{a.zone === 'asset' ? '资产区' : a.zone === 'hand' ? '手牌' : a.zone === 'sealed' ? '封印区' : '墓地'}能力 · {payableCost}费用</button>{!a.allowed && <p>{a.reason}</p>}</article>;
}
function Cast({ a, room, busy, act }: Props & {
    a: any;
}) {
    const [district, setDistrict] = useState(0), mine = room.players[room.seat], available = (mine.costPool ?? 0) + mine.assets.filter((c: any) => !c.tapped).length, payableCost = a.cost ?? a.printedCost;
    const blocked = busy || room.status !== 'playing' || room.flow.locked || room.flow.priority !== room.seat || room.pendingChoiceCount || room.ruleChoice || room.damageChoice || room.manualRequest || room.effectChoice || room.hidden || room.battle;
    const standardBlocked = !room.turn?.standardAllowed || room.flow.stepOwner !== room.seat || room.flow.stack.length > 0;
    return <article className='rail-section'><strong><Rich name text={a.displayName ?? a.name}/></strong><p>从{a.zone === 'graveyard' ? '墓地' : a.zone === 'asset' ? '资产区' : '封印区'}打出 · {payableCost}费用 · 拥有者：{a.ownerName}</p>{a.attachment || a.spell ? <TargetAction card={a} plan={a.attachment ?? a.spell} options={a.targets} room={{ ...room, castingCosts: { ...room.castingCosts, [a.id]: a.cost } }} act={act} disabled={!!blocked || (a.attachment ?? a.spell).timing !== 'fast' && standardBlocked}/> : <><CharacterEntryDistrict card={a} room={room} district={district} setDistrict={setDistrict} label={`${a.name}打出地区`}/><CharacterPlayAction card={a} room={{ ...room, castingCosts: { ...room.castingCosts, [a.id]: a.cost } }} disabled={!!blocked || !a.fastCast && standardBlocked || !randomCharacterEntry(a) && !room.districts[district]} available={available} district={district} act={act}/></>}</article>;
}
export function ZonePanel({ room, busy, act }: Props) {
    const actions = room.zoneActions ?? [], casts = room.zoneCasts ?? [];
    if (!actions.length && !casts.length)
        return null;
    return <details className='zone-details' open><summary>手牌、资产、墓地与封印区能力 · {actions.length + casts.length}项</summary>{actions.map((a: any) => <Action key={`${a.id}:${a.actionIndex}:${a.zone}`} a={a} room={room} busy={busy} act={act}/>)}{casts.map((a: any) => <Cast key={a.id} a={a} room={room} busy={busy} act={act}/>)}</details>;
}
