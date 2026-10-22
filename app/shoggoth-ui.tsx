'use client';
import { CharacterEntryDistrict, randomCharacterEntry } from './character-entry-district';
import { adjacentDistricts } from '../engine/task-districts.mjs';
import { useState } from 'react';
import { CardContextSurface } from './card-information';
import { Rich } from './rich-text';
import { MagicDomainIcons } from './magic-domain-icons';
import { CardMarkers } from './card-markers';
type Props = {
    room: any;
    busy: boolean;
    act: (command: any) => void;
};
function CoreCast({ room, busy, act, card, area }: Props & {
    card: any;
    area: any;
}) {
    const [district, setDistrict] = useState(0), [honorRest, setHonorRest] = useState(0), mine = room.players[room.seat], rest = area.counters?.rest ?? 0;
    const honors = Math.min(rest, Math.floor((mine.honor ?? 0) / 2)), chosen = Math.min(honorRest, honors), cost = card.cost + (rest - chosen) * 2, available = (mine.costPool ?? 0) + mine.assets.filter((c: any) => !c.tapped).length;
    const setupDisabled = busy || room.status !== 'playing', random = randomCharacterEntry(card);
    const disabled = setupDisabled || !room.turn?.standardAllowed || room.flow.stepOwner !== room.seat || room.flow.priority !== room.seat || room.flow.locked || room.pendingChoiceCount || room.effectChoice || room.ruleChoice || room.manualRequest || room.hidden || room.battle || room.damageChoice || room.flow.stack.length > 0 || available < cost || !random && !room.districts[district];
    return <div className='core-cast'><CharacterEntryDistrict card={card} room={room} district={district} setDistrict={setDistrict} label='核心进场地区' disabled={setupDisabled}/>{rest > 0 && <label>用名誉支付的休整标志<select aria-label='名誉支付休整标志数量' disabled={setupDisabled} value={chosen} onChange={e => setHonorRest(Number(e.target.value))}>{Array.from({ length: honors + 1 }, (_, i) => <option key={i} value={i}>{i}个 · {i * 2}名誉点</option>)}</select></label>}<button className='primary' disabled={!!disabled} onClick={() => act({ type: 'play', cardId: card.id, district: random ? undefined : district, honorRest: chosen })}>打出核心 · {cost}费用{chosen > 0 ? `＋${chosen * 2}名誉` : ''}</button></div>;
}
export function CorePanel({ room, busy, act }: Props) {
    if (!room.players?.some((p: any) => p.coreArea))
        return null;
    return <details className='zone-details' open><summary>核心区</summary>{room.players.map((pl: any, p: number) => pl.coreArea && <section key={p} className='rail-section'><CardContextSurface inline cardId={pl.coreArea.id}><strong>{room.seats[p].name} · 核心区</strong></CardContextSurface>{p === room.seat && <label><input type='checkbox' aria-label='取消询问非选定核心角色回核心区' checked={pl.coreArea.skipAdditionalCoreReturn !== false} disabled={busy || room.status !== 'playing'} onChange={e => act({ type: 'shoggoth-return-preference', skip: e.target.checked })}/>取消询问非选定核心角色回核心区</label>}<p>休整 {pl.coreArea.counters?.rest ?? 0} · 名誉 {pl.honor ?? 0}</p><CardMarkers card={pl.coreArea}/>{pl.coreArea.cards.map((card: any) => <div key={card.id}><CardContextSurface inline cardId={card.id}><strong><Rich name text={card.displayName ?? card.name}/></strong></CardContextSurface><MagicDomainIcons domains={card.magicDomains}/>{p === room.seat && card.castAllowed && <CoreCast room={room} busy={busy} act={act} card={card} area={pl.coreArea}/>}</div>)}{!pl.coreArea.cards.length && <span>空</span>}</section>)}</details>;
}
export function ShoggothChoice({ a, room, busy, act }: {
    a: any;
} & Props) {
    const [mode, setMode] = useState(a.corePlan?.modes?.[0]?.id ?? ''), [target, setTarget] = useState(''), [ids, setIds] = useState<string[]>([]), [time, setTime] = useState<Record<string, number>>({}), [district, setDistrict] = useState(-1);
    const send = (c: any) => act({ type: 'effect-choice', choiceId: a.id, ...c });
    if (a.kind === 'shoggoth-pay-honor')
        return <div className='reward-row'><button className='primary' disabled={busy || (room.players[room.seat].honor ?? 0) < 1} onClick={() => send({ pay: true })}>支付1名誉并抓牌</button><button className='secondary' disabled={busy} onClick={() => send({ pay: false })}>不支付</button></div>;
    if (a.kind === 'shoggoth-research-zombies')
        return <><div className='effect-options'>{a.cards.map((c: any) => <label key={c.id}><input type='checkbox' checked={ids.includes(c.id)} disabled={busy} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name}</label>)}</div><button className='primary' disabled={busy} onClick={() => send({ cardIds: ids })}>横置 {ids.length} 张，生成 {ids.length} 个行尸</button></>;
    if (a.kind === 'shoggoth-core-hand')
        return <div className='reward-row'><button className='primary' disabled={busy} onClick={() => send({ cardId: a.cards[0].id })}>核心置于手中</button><button className='secondary' disabled={busy} onClick={() => send({ skip: true })}>不置于手中</button></div>;
    if (a.kind === 'shoggoth-mission-place-core')
        return <div className='reward-row'><button className='primary' disabled={busy} onClick={() => send({ enter: true })}>放置核心于地区一</button><button className='secondary' disabled={busy} onClick={() => send({ enter: false })}>不放置</button></div>;
    if (a.kind === 'shoggoth-time-apparatus')
        return <div className='reward-row'><button className='primary' disabled={busy} onClick={() => send({ enter: true })}>放置进场</button><button className='secondary' disabled={busy} onClick={() => send({ enter: false })}>不放置</button></div>;
    if (a.kind === 'shoggoth-pay-two') {
        const pl = room.players[room.seat], available = (pl.costPool ?? 0) + pl.assets.filter((c: any) => !c.tapped).length;
        return <div className='reward-row'><button className='primary' disabled={busy || available < 2} onClick={() => send({ pay: true })}>支付2</button><button className='secondary' disabled={busy} onClick={() => send({ pay: false })}>不支付</button></div>;
    }
    if (a.kind === 'shoggoth-invoke' || a.kind === 'shoggoth-copy-command') {
        const plan = { ...a.corePlan, ...(a.corePlan?.modeTargets?.[mode] ?? {}) }, opts = (a.cards ?? []).filter((o: any) => !o.modes || o.modes.includes(mode)), legal = opts.some((o: any) => o.id === target) ? target : '';
        return <>{a.corePlan?.modes && <select aria-label='核心能力模式' value={mode} disabled={busy} onChange={e => { setMode(e.target.value); setTarget(''); }}>{a.corePlan.modes.map((m: any) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>}{plan.target !== 'none' && <select aria-label='核心能力目标' value={legal} disabled={busy} onChange={e => setTarget(e.target.value)}><option value=''>选择目标</option>{opts.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}<button className='primary' disabled={busy || plan.target !== 'none' && !legal} onClick={() => send({ mode, targetIds: legal ? [legal] : [] })}>{a.kind === 'shoggoth-copy-command' ? '复制命令进入堆叠' : '核心能力进入堆叠'}{a.remainingCore > 1 ? ` · 还需发动${a.remainingCore - 1}次` : ''}</button>{a.canSkip && <button className='quiet' disabled={busy} onClick={() => send({ skip: true })}>不发动核心能力</button>}</>;
    }
    if (a.kind === 'shoggoth-shield-optional' || a.kind === 'shoggoth-draw-optional' || a.kind === 'shoggoth-scored-core-draw') {
        const shield = a.kind === 'shoggoth-shield-optional';
        return <div className='reward-row'>{[true, false].map(value => <button key={String(value)} className={value ? 'primary' : 'secondary'} disabled={busy} onClick={() => send(shield ? { shield: value } : { draw: value })}>{value ? shield ? '放置护盾' : '抓一张牌' : '跳过'}</button>)}</div>;
    }
    if (a.kind === 'shoggoth-remove-time') {
        const payments = (a.cards ?? []).flatMap((c: any) => time[c.id] > 0 ? [{ cardId: c.id, count: time[c.id] }] : []), n = payments.reduce((n: number, p: any) => n + p.count, 0), valid = payments.every((p: any) => Number.isSafeInteger(p.count) && p.count <= a.cards.find((c: any) => c.id === p.cardId).markers);
        return <>{a.cards.map((c: any) => <label key={c.id}>{c.name} · 时间{c.markers}<input aria-label={`移除时间 ${c.name}`} type='number' min={0} max={Math.min(2, c.markers)} step={1} value={time[c.id] ?? 0} disabled={busy} onChange={e => setTime({ ...time, [c.id]: Number(e.target.value) })}/></label>)}<button className='primary' disabled={busy || n > 2 || !valid} onClick={() => send({ timePayments: payments })}>移除 {n} 个时间标志</button></>;
    }
    if (a.kind === 'shoggoth-grave-return') {
        return <><div className='effect-options'>{a.cards.map((c: any) => <label key={c.id}><input type='checkbox' checked={ids.includes(c.id)} disabled={busy || ids.length >= a.max && !ids.includes(c.id)} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name}</label>)}</div><button className='primary' disabled={busy} onClick={() => send({ cardIds: ids })}>回手 {ids.length} 张</button></>;
    }
    if (a.kind === 'shoggoth-claim-move') {
        return <><select aria-label='移动核心角色' value={target} onChange={e => setTarget(e.target.value)}><option value=''>选择核心</option>{a.cards.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select aria-label='移动相邻地区' value={district} onChange={e => setDistrict(Number(e.target.value))}><option value={-1}>选择相邻地区</option>{room.districts.map((d: any, i: number) => d && adjacentDistricts(room, a.sourceDistrict).includes(i) && <option key={i} value={i}>地区{d.number ?? i + 1} · {d.name}</option>)}</select><button className='primary' disabled={busy || !target || district < 0} onClick={() => send({ cardId: target, district })}>移动</button><button className='quiet' disabled={busy} onClick={() => send({ skip: true })}>跳过</button></>;
    }
    return <><div className='effect-options'>{a.cards.map((c: any) => <button key={c.id} className='secondary' title={c.text} disabled={busy || a.eligibleIds && !a.eligibleIds.includes(c.id)} onClick={() => send({ cardId: c.id })}>{c.name}</button>)}</div>{a.canFail && <button className='quiet' disabled={busy} onClick={() => send({ fail: true })}>未找到，洗牌</button>}{a.canSkip && <button className='quiet' disabled={busy} onClick={() => send({ skip: true })}>不移动</button>}{a.kind === 'shoggoth-genesis' && <button className='quiet' disabled={busy} onClick={() => send({ skip: true })}>不放置角色</button>}</>;
}
