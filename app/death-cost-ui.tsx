import {TriggerDraft} from './trigger-round-ui';
import { AbilityContextSurface, EffectPreviewSurface } from './card-information';
'use client';
import { useState, useCallback } from 'react';
import { TriggerCostBatch } from './trigger-cost-batch';
import { TargetAction } from './automation-ui';
export function DeathCostChoice({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const a = room.deathCostChoice;
    if (!a)
        return null;
    ;
    ;
    if (['silence-pay', 'silence-order'].includes(a.kind))
        return <SilenceChoice key={a.id} a={a} room={room} busy={busy} act={act}/>;
    ;
    if (a.kind === 'mage-tap-cost')
        return <MageTapCost key={a.id} a={a} room={room} busy={busy} act={act}/>;
    if (a.kind === 'shoggoth-core-return')
        return <section className='choice-panel'><h3>修格斯的核心区 · 持续能力</h3><p>{a.hostName}</p>{a.controller === room.seat ? <div className='reward-row'><button className='primary' disabled={busy} onClick={() => act({ type: 'continuous-choice', choiceId: a.id, fire: true })}>返回核心区并放置一个休整标志</button><button className='secondary' disabled={busy} onClick={() => act({ type: 'continuous-choice', choiceId: a.id, fire: false })}>不返回核心区</button></div> : <p>等待 {room.seats[a.controller].name} 选择。</p>}</section>;
    ;
    ;
    if (a.kind === 'trigger-cost-batch')
        return <TriggerCostBatch key={a.id} a={a} room={room} busy={busy} act={act}/>;
    if (a.kind === 'trigger-cost')
        return <AbilityContextSurface abilityId={a.ability?.id}><ImmediateTriggerCost key={a.id} a={a} room={room} busy={busy} act={act}/></AbilityContextSurface>;
    if (['well-capture', 'command-post-order', 'grave-continuous-order'].includes(a.kind))
        return <section className='choice-panel'><h3>{a.kind === 'well-capture' ? '枯井 · 选择封印宿主' : a.kind === 'grave-continuous-order' ? '入墓 · 选择先适用的持续能力' : '临时指挥部 · 选择先适用的来源'}</h3>{a.controller === room.seat ? <div className='effect-options'>{a.sources.map((source: any) => <button key={source.id} className='primary' disabled={busy} onClick={() => act({ type: 'continuous-source-choice', choiceId: a.id, sourceId: source.id })}>{source.name}{source.district !== undefined ? ` · 地区${source.district + 1}` : ''}</button>)}</div> : <p>等待 {room.seats[a.controller].name} 选择。</p>}</section>;
    if (a.kind === 'command-post-tax')
        return <section className='choice-panel'><h3>临时指挥部 · 锁定费用</h3><p>{a.hostName} · 已处理 {a.paid}/{a.total} 个来源</p>{a.controller === room.seat ? <div className='reward-row'><button className='primary' disabled={busy || a.available < a.amount} onClick={() => act({ type: 'continuous-choice', choiceId: a.id, fire: true })}>支付{a.amount}</button><button className='secondary' disabled={busy} onClick={() => act({ type: 'continuous-choice', choiceId: a.id, fire: false })}>{a.cannotTerminate ? '不支付，翻面继续' : '不支付，终止翻面'}</button></div> : <p>等待 {room.seats[a.controller].name} 选择。</p>}</section>;
    if (a.kind === 'dragon-blood-seal')
        return <section className='choice-panel'><h3>龙之欢宴 · 鲜血封印</h3><p>{a.hostName}</p>{a.controller === room.seat ? <div className='reward-row'><button className='primary' disabled={busy} onClick={() => act({ type: 'continuous-choice', choiceId: a.id, fire: true })}>封印在龙之欢宴上</button><button className='secondary' disabled={busy} onClick={() => act({ type: 'continuous-choice', choiceId: a.id, fire: false })}>照常置于墓地</button></div> : <p>等待 {room.seats[a.controller].name} 选择。</p>}</section>;
    if (a.kind === 'death-destination')
        return <section className='choice-panel'><h3>{a.sourceName} · 死亡去向</h3>{a.controller === room.seat ? <div className='reward-row'><button className='primary' disabled={busy} onClick={() => act({ type: 'continuous-choice', choiceId: a.id, fire: true })}>改为置于拥有者牌库顶</button><button className='secondary' disabled={busy} onClick={() => act({ type: 'continuous-choice', choiceId: a.id, fire: false })}>{a.fallbackLabel ?? '照常置于墓地'}</button></div> : <p>等待 {room.seats[a.controller].name} 选择。</p>}</section>;
    if (['influence-cancellation', 'influence-removal'].includes(a.kind))
        return <InfluenceChoice key={a.id} a={a} room={room} busy={busy} act={act}/>;
    if (a.kind === 'reset-tax')
        return <section className='choice-panel'><h3>{a.sourceName} · 重置费用</h3><p>重置{a.hostName} · 已支付 {a.paid}/{a.total} 份费用</p>{a.controller === room.seat ? <div className='reward-row'><button className='primary' disabled={busy || a.available < 1} onClick={() => act({ type: 'reset-tax-choice', choiceId: a.id, fire: true })}>支付1</button><button className='secondary' disabled={busy} onClick={() => act({ type: 'reset-tax-choice', choiceId: a.id, fire: false })}>保持横置</button></div> : <p>等待 {room.seats[a.controller].name} 选择。</p>}</section>;
    ;
    if (a.kind === 'draw-replacement')
        return <section className='choice-panel'><h3>抓牌替代 · 选择先适用的效果</h3>{a.controller === room.seat ? <div className='reward-row'><button className='secondary' disabled={busy} onClick={() => act({ type: 'draw-replacement-choice', choiceId: a.id, sourceId: null })}>{a.memoryPending ? '不使用实验室' : `照常抓${a.count}张牌`}</button>{a.sources.map((source: any) => source.cards.length ? source.cards.map((card: any) => <button className='primary' disabled={busy} key={source.id + card.id} onClick={() => act({ type: 'draw-replacement-choice', choiceId: a.id, sourceId: source.id, cardId: card.id })}>略过抓牌 · 取回{card.name}</button>) : <button className='primary' disabled={busy} key={source.id} onClick={() => act({ type: 'draw-replacement-choice', choiceId: a.id, sourceId: source.id, cardId: null })}>略过抓牌 · {source.name}</button>)}</div> : <p>等待 {room.seats[a.controller].name} 选择。</p>}</section>;
    ;
    if (a.kind === 'discard-replacement')
        return <section className='choice-panel'><h3>卡迪纳家族 · 弃牌替代</h3><p>待弃牌已展示。可以支付2，将其中一张改为置于该玩家牌库顶或牌库底；其余照常弃掉。当前没有响应窗口。</p><div className='effect-options'>{a.cards.map((c: any) => <details key={c.id}><summary>{c.name}</summary><p>{c.text}</p></details>)}</div>{a.controller === room.seat ? <div className='reward-row'>{a.cards.flatMap((c: any) => ['top', 'bottom'].map(destination => <button key={c.id + destination} className='primary' disabled={busy} onClick={() => act({ type: 'discard-replacement-choice', choiceId: a.id, cardId: c.id, destination })}>支付2 · {c.name}置{destination === 'top' ? '顶' : '底'}</button>))}<button className='secondary' disabled={busy} onClick={() => act({ type: 'discard-replacement-choice', choiceId: a.id, cardId: null })}>全部照常弃掉</button></div> : <p>等待 {room.seats[a.controller].name} 选择。</p>}</section>;
    return <section className="choice-panel"><h3>{a.sourceName} · 死亡触发费用</h3><p>费用：牺牲{a.sourceName}</p>{a.controller === room.seat ? <div className="reward-row"><button className="primary" disabled={busy} onClick={() => act({ type: 'death-cost-choice', choiceId: a.id, fire: true })}>牺牲{a.sourceName}并发动</button><button className="secondary" disabled={busy} onClick={() => act({ type: 'death-cost-choice', choiceId: a.id, fire: false })}>不发动</button></div> : <p>等待 {room.seats[a.controller].name} 选择。</p>}</section>;
}
function MageTapCost({ a, room, busy, act }: {
    a: any;
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [ids, setIds] = useState<string[]>([]), selected = ids.filter(id => a.cards?.some((c: any) => c.id === id));
    return <EffectPreviewSurface sourceId={a.cardId ?? a.sourceId} costIds={selected} targetIds={[]}><section className='choice-panel'><h3>{a.sourceName} · 横置额外费用</h3>{room.seat === a.controller ? <><div className='effect-options'>{a.cards.map((c: any) => <label key={c.id}><input type='checkbox' checked={selected.includes(c.id)} disabled={busy || selected.length >= a.max && !selected.includes(c.id)} onChange={e => setIds(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))}/>{c.name}</label>)}</div><p>至多选择{a.max}个 · 已选{selected.length}个</p><button className='primary' disabled={busy} onClick={() => act({ type: 'continuous-choice', choiceId: a.id, cardIds: selected })}>确认费用选择</button></> : <p>等待 {room.seats[a.controller].name} 选择。</p>}</section></EffectPreviewSurface>;
}
function InfluenceChoice({ a, room, busy, act }: {
    a: any;
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [amounts, setAmounts] = useState<Record<string, number>>({}), total = Object.values(amounts).reduce((n, v) => n + v, 0), mine = a.controller === room.seat;
    return <section className='choice-panel'><h3>地区{a.districtNumber} · 势力{a.kind === 'influence-cancellation' ? '抵消' : '移除'}</h3><p>{a.sourceName}</p>{mine ? <><p>选择移除{a.count}个本方势力标志 · 已选{total}/{a.count}</p><div className='effect-options'>{a.options.map((o: any) => <label className='influence-choice-row' key={o.id}><span>{o.name} · {o.count}个</span><input aria-label={`${o.name}移除数量`} type='number' min={0} max={o.count} step={1} value={amounts[o.id] ?? 0} disabled={busy} onChange={e => { const n = Number(e.target.value); setAmounts({ ...amounts, [o.id]: Number.isSafeInteger(n) ? Math.max(0, Math.min(o.count, n)) : 0 }); }}/></label>)}</div><button className='primary' disabled={busy || total !== a.count} onClick={() => act({ type: 'influence-choice', choiceId: a.id, allocations: Object.entries(amounts).filter(([, amount]) => amount > 0).map(([id, amount]) => ({ id, amount })) })}>确认移除位置</button><p>双方完成选择后一起移除。</p></> : <p>{a.done ? '已确认。' : ''}等待{a.waitingPlayers.map((p: number) => room.seats[p].name).join('、')}选择移除位置。</p>}</section>;
}
function ImmediateTriggerCost({a,room,busy,act}:{a:any,room:any,busy:boolean,act:(c:any)=>void}){
 const [draft,setDraft]=useState<any>(null),update=useCallback((_id:string,d:any)=>setDraft(d),[]),ability=a.ability;
 return <section className="choice-panel"><h3>{a.sourceName} · 触发确认</h3>{a.controller===room.seat?<><p>现在确认是否发动、费用和目标；触发轮只排列入栈顺序。</p><TriggerDraft a={{...ability,targetOptions:a.targetOptions}} room={room} busy={busy} update={update}/><div className="reward-row"><button className="primary" disabled={busy||!draft?.valid} onClick={()=>act({...draft.command,type:'trigger-cost-choice',choiceId:a.id,fire:true})}>确认费用和目标并发动</button>{!ability.mandatory&&<button className="secondary" disabled={busy} onClick={()=>act({type:'trigger-cost-choice',choiceId:a.id,fire:false})}>不发动</button>}</div></>:<p>等待 {room.seats[a.controller].name} 选择。</p>}</section>;
}
function EnvironmentTriggerCost({ a, room, busy, act }: {
    a: any;
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) { const [target, setTarget] = useState(""); return <section className="choice-panel"><h3>{a.sourceName} · 触发费用</h3>{a.controller === room.seat ? <><select value={target} onChange={e => setTarget(e.target.value)}><option value="">选择目标</option>{a.targetOptions.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select><button className="primary" disabled={busy || a.available < a.ability.cost || a.ability.claimMobileTarget && !target} onClick={() => act({ type: "trigger-cost-choice", choiceId: a.id, fire: true, targetIds: target ? [target] : [] })}>支付{a.ability.cost}并发动</button><button className="secondary" disabled={busy} onClick={() => act({ type: "trigger-cost-choice", choiceId: a.id, fire: false })}>不发动</button></> : <p>等待 {room.seats[a.controller].name} 选择。</p>}</section>; }
function SilenceChoice({ a, room, busy, act }: {
    a: any;
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [ids, setIds] = useState<string[]>(['', '', '']), valid = a.kind === 'silence-pay' && new Set(ids).size === 3 && ids.every((id, i) => a.groups?.[i].cards.some((c: any) => c.id === id));
    return <EffectPreviewSurface sourceId={a.cardId ?? a.sourceId} costIds={a.kind === 'silence-pay' ? ids.filter(Boolean) : []} targetIds={[]}><section className='choice-panel'><h3>缄默 · {a.kind === 'silence-pay' ? '封印方式' : '排列持续能力'}</h3>{a.controller !== room.seat ? <p>等待对手完成选择。</p> : a.kind === 'silence-order' ? <div className='effect-options'>{a.sources.map((s: any, i: number) => <button className='secondary' key={s.id} disabled={busy} onClick={() => act({ type: 'continuous-source-choice', choiceId: a.id, sourceId: s.id })}>{s.name} · 第{i + 1}张</button>)}</div> : <><div className='effect-options'>{a.groups.map((g: any, i: number) => <label key={i}>横置{g.label}<select aria-label={`缄默横置${g.label}`} disabled={busy} value={ids[i]} onChange={e => setIds(ids.map((id, j) => j === i ? e.target.value : id))}><option value=''>选择{g.label}</option>{g.cards.map((c: any) => <option key={c.id} value={c.id} disabled={ids.some((id, j) => j !== i && id === c.id)}>{c.name}</option>)}</select></label>)}</div><div className='reward-row'><button className='primary' disabled={busy || !valid} onClick={() => act({ type: 'continuous-choice', choiceId: a.id, fire: true, cardIds: ids })}>横置三个对象 · 正面封印</button><button className='secondary' disabled={busy} onClick={() => act({ type: 'continuous-choice', choiceId: a.id, fire: false })}>不支付 · 背面封印</button></div></>}</section></EffectPreviewSurface>;
}
