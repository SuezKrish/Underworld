'use client';
import { SocietyCounters, ShoggothCounter } from './society-summary';
import { searchChoiceDisplay } from '../engine/search-choice-display.mjs';
import { ActionPayments, selectedActionPayments } from './action-payments';
import { useState } from 'react';
import { Rich } from './rich-text';
import { OrderRows } from './round-ui';
import { PredictionObserver } from './prediction-observer';
import { CardContextSurface, EffectPreviewSurface } from './card-information';
function Multi({ label, options, ids, setIds, max, eligibleIds, distinctNames = false }: {
    label: string;
    options: any[];
    ids: string[];
    setIds: (x: string[]) => void;
    max: number;
    eligibleIds?: string[];
    distinctNames?: boolean;
}) { const selectedNames = new Set(options.filter(c => ids.includes(c.id)).map(c => c.name)); return <fieldset className='effect-options'><legend>{label}</legend>{options.map(c => <label key={c.id} title={c.text}><input type='checkbox' aria-label={`${label} ${c.name}`} checked={ids.includes(c.id)} disabled={eligibleIds && !eligibleIds.includes(c.id) || !ids.includes(c.id) && (ids.length >= max || distinctNames && selectedNames.has(c.name))} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/><Rich name text={c.displayName ?? c.name}/>{c.costWeight > 1 && <span> · 可计作{c.costWeight}张</span>}{eligibleIds && <small> · {eligibleIds.includes(c.id) ? '实牌，可选择' : '虚牌，不可选择'}</small>}{c.ownerName && <small> · 拥有者 {c.ownerName}</small>}</label>)}</fieldset>; }
function EnvironmentAction({ room, source, def, district, busy, act }: {
    room: any;
    source: any;
    def: any;
    district?: number;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [target, setTarget] = useState(''), [second, setSecond] = useState(''), [tapSelection, setTap] = useState<string[]>([]), [discardSelection, setDiscard] = useState<string[]>([]), [sealSelection, setSeal] = useState<string[]>([]), [assetSelection, setAsset] = useState('');
    const mine = room.players[room.seat], tap = tapSelection.filter(id => def.tapOptions.some((c: any) => c.id === id)), discard = discardSelection.filter(id => def.discardOptions.some((c: any) => c.id === id)), seal = sealSelection.filter(id => def.sealOptions.some((c: any) => c.id === id)), asset = mine.assets.some((c: any) => c.id === assetSelection) ? assetSelection : '', standard = room.turn?.standardAllowed && room.flow.stepOwner === room.seat && !room.flow.stack.length, locked = busy || room.status !== 'playing' || room.flow.locked || room.effectChoice || room.ruleChoice || room.hidden || room.pendingChoiceCount || room.manualRequest || room.flow.priority !== room.seat || def.timing !== 'fast' && !standard;
    const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number>>({});
    const paymentSources = district === undefined ? (room.actionPaymentSources ?? []).filter((s: any) => !tap.includes(s.id)) : [], actionPayments = selectedActionPayments(paymentSources, paymentAmounts), paymentTotal = actionPayments.reduce((n, x) => n + x.amount, 0);
    const slots = def.target ? (def.secondTarget ? [target, second] : [target]) : [], valid = paymentTotal <= def.cost && !def.used && (!def.tap || !source.tapped) && (!def.target || def.targetOptions.some((x: any) => x.id === target)) && (!def.secondTarget || def.secondTargetOptions.some((x: any) => x.id === second)) && tap.length === (def.tapDistrictCharacter ? 1 : def.tapCharacters?.count ?? 0) && discard.length === (def.discard?.count ?? 0) && seal.length <= (def.sealedCost ?? def.graveSealCost ?? 0) && seal.reduce((n, id) => n + (def.sealOptions.find((c: any) => c.id === id)?.costWeight ?? 1), 0) >= (def.sealedCost ?? def.graveSealCost ?? 0) && (!def.sacrificeAsset || !!asset) && (!def.actionPhaseOnly || room.turn.phase === 'action') && (mine.costPool + mine.assets.filter((a: any) => !a.tapped).length >= def.cost - paymentTotal) && (mine.honor >= (def.honorCost ?? 0)) && (!def.removeMarker || mine.markers[def.removeMarker] > 0) && (!def.requireCounter || source.counters[def.requireCounter] > 0);
    return <EffectPreviewSurface sourceId={source.id} targetIds={slots.filter(Boolean)} costIds={[...tap, ...discard, ...seal, ...(asset ? [asset] : []), ...actionPayments.map(p => p.cardId)]}><details className='zone-details' open><summary>{def.label} · {def.honorCost ? `${def.honorCost}名誉点` : `费用${def.cost}`}{def.tap ? ' · 横置秘社' : ''}{def.used ? ' · 次数已用完' : ''}</summary>{def.target && <select aria-label={`${def.label} 目标`} value={target} onChange={e => setTarget(e.target.value)}><option value=''>选择目标</option>{def.targetOptions.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}{def.secondTarget && <select aria-label={`${def.label} 第二目标`} value={second} onChange={e => setSecond(e.target.value)}><option value=''>选择第二目标</option>{def.secondTargetOptions.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}{!!def.tapOptions.length && <Multi label='横置费用' options={def.tapOptions} ids={tap} setIds={setTap} max={def.tapDistrictCharacter ? 1 : def.tapCharacters.count}/>} {!!def.discardOptions.length && <Multi label='弃牌费用' options={def.discardOptions} ids={discard} setIds={setDiscard} max={def.discard.count}/>} {!!def.sealOptions.length && <Multi label={def.graveSealCost ? '封印费用' : '封印牌回底费用'} options={def.sealOptions} ids={seal} setIds={setSeal} max={def.sealedCost ?? def.graveSealCost}/>} {def.sacrificeAsset && <select aria-label='牺牲资产费用' value={asset} onChange={e => setAsset(e.target.value)}><option value=''>选择牺牲的资产</option>{mine.assets.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}<ActionPayments sources={paymentSources} cost={def.cost} amounts={paymentAmounts} setAmounts={setPaymentAmounts} disabled={!!locked}/><button className='primary' disabled={locked || !valid} onClick={() => { act({ type: district === undefined ? 'society-action' : 'district-action', abilityId: def.id, actionPayments, district, targetIds: slots, tapIds: tap, discardIds: discard, sealIds: seal, assetId: asset }); setTap([]); setDiscard([]); setSeal([]); setAsset(''); setPaymentAmounts({}); }}>支付费用并发动</button></details></EffectPreviewSurface>;
}
function EnvironmentDecision({ a, busy, act }: {
    a: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [ids, setIds] = useState<string[]>([]), [top, setTop] = useState<string[]>(a.cards.map((c: any) => c.id)), [bottom, setBottom] = useState<string[]>([]), [observerBottom, setObserverBottom] = useState(false);
    const submit = (extra: any) => act({ type: 'environment-choice', choiceId: a.id, ...extra });
    const valid = ids.length >= a.min && ids.length <= a.max && (!a.distinctNames || new Set(ids.map(id => a.cards.find((c: any) => c.id === id).name)).size === ids.length);
    if (!a.allowed)
        return <p>{a.done ? '你已锁定选择，等待另一位玩家。' : '等待另一位玩家选择。'}</p>;
    if (a.mode === 'predict')
        return <><PredictionObserver a={a} busy={busy} act={act} bottom={observerBottom} setBottom={setObserverBottom}/><div className='order-columns'><div><h4>牌库顶</h4><OrderRows edge='top' ids={top} cards={a.cards} setIds={setTop} moveOther={id => { setTop(top.filter(x => x !== id)); setBottom([...bottom, id]); }} otherLabel='置底'/></div><div><h4>牌库底</h4><OrderRows edge='bottom' ids={bottom} cards={a.cards} setIds={setBottom} moveOther={id => { setBottom(bottom.filter(x => x !== id)); setTop([...top, id]); }} otherLabel='置顶'/></div></div><button className='primary' disabled={busy} onClick={() => submit({ top, bottom, observerBottom })}>确认顺序</button></>;
    if (a.mode === 'world-claim-preview')
        return <p>请用上方世界牌库检视按钮完成持续能力。</p>;
    if (a.options)
        return <div className='reward-row'>{a.options.map((x: any) => <button className='secondary' key={x.id} disabled={busy} onClick={() => submit({ option: x.id })}>{x.name}</button>)}</div>;
    if (a.mode === 'inspect')
        return <><div className='effect-options'>{a.cards.map((c: any) => <article key={c.id}><h4>{c.name}</h4><p><Rich text={c.text}/></p></article>)}</div><button className='primary' disabled={busy} onClick={() => submit({ confirm: true })}>完成私人检视</button></>;
    return <>{a.simultaneous && <p>双方独立选择，全部锁定后执行。</p>}<p>{a.mode === 'reality-top-three' ? '从检视的三张牌中选择至多一张实牌，其余留在原顺序（可选择不取牌）。' : a.mode === 'setup-secret' ? '选择至多5张不同名梦魇角色；双方各自锁定后统一公布并封印。' : a.mode === 'simultaneous-search' ? '各自秘密检索，双方锁定后同时展示。' : `选择${a.min === a.max ? `恰好${a.max}` : `${a.min}至${a.max}`}张牌。`}{a.private ? ' 这些选项仅你可见。' : ''}</p><Multi label='结算选择' options={a.cards} eligibleIds={a.eligibleIds} distinctNames={a.distinctNames} ids={ids} setIds={setIds} max={a.max}/><button className='primary' disabled={busy || !valid} onClick={() => submit({ cardIds: ids })}>{a.simultaneous || a.mode === 'setup-secret' || a.mode === 'simultaneous-search' ? '锁定选择' : '确认选择'}{ids.length === 0 && a.min === 0 ? '（不选择牌）' : ''}</button></>;
}
export function EnvironmentPanel({ room, busy, act, mode = 'all' }: {
    room: any;
    busy: boolean;
    act: (c: any) => void;
    mode?: 'all' | 'actions' | 'decisions';
}) {
    if (!room.societies)
        return null;
    const a = room.environmentChoice && searchChoiceDisplay({ ...room.environmentChoice, kind: 'environment' });
    return <section className='environment-panel'>{mode !== 'decisions' && <><div className='panel-title'><h3>秘社行动能力与世界牌库</h3><span>世界牌库 · {room.worldDeckCount}张</span></div>{room.societies.map((s: any, i: number) => <details className='zone-details' key={s.id} open={i === room.seat}><summary><CardContextSurface inline cardId={s.id}>{room.seats[i].name} · {s.name}{s.tapped ? ' · 已横置' : ''}</CardContextSurface></summary><p><Rich text={s.text}/></p>{Object.values(s.counters ?? {}).some(v => Number(v) > 0) && <div className='society-counters'><ShoggothCounter society={s}/><SocietyCounters society={s}/></div>}{s.plan?.actions?.some((d: any) => d.honorCost) && <p>名誉点：{room.players[i].honor}</p>}{s.pending.length > 0 && <p className='note'>尚待接入：{s.pending.join('；')}</p>}{s.actions.map((def: any) => <EnvironmentAction key={def.id} source={s} def={def} room={room} busy={busy} act={act}/>)}</details>)}{room.districtActions?.filter((x: any) => x.actions.length).map((x: any) => <details className='zone-details' key={x.district}><summary>地区{x.district + 1} · {x.name}的行动能力</summary>{x.actions.map((def: any) => <EnvironmentAction key={def.id} source={{ tapped: false, counters: {} }} def={def} district={x.district} room={room} busy={busy} act={act}/>)}</details>)}</>}{mode !== 'actions' && <>{room.worldPreview && <div className='choice-panel'><h3>秘社持续能力 · 私人检视世界牌库顶</h3><p>{room.worldPreview.name}</p><p><Rich text={room.worldPreview.text}/></p><button className='secondary' disabled={busy} onClick={() => act({ type: 'world-preview', bottom: false })}>保留在顶</button><button className='primary' disabled={busy} onClick={() => act({ type: 'world-preview', bottom: true })}>置于世界牌库底</button></div>}{room.ownRealityTop && <details className='zone-details'><summary>虚实交界 · 随时检视本方牌库顶七张（仅你可见）</summary><div className='effect-options'>{room.ownRealityTop.map((c: any, i: number) => <details key={c.id}><summary>{i + 1}. {c.name} · {c.isReal ? '实牌' : '虚牌'}</summary><p><Rich text={c.text}/></p></details>)}</div></details>}{a && <div className='choice-panel'><h3>秘社／地区效果 · 结算选择</h3><EnvironmentDecision key={a.id} a={a} busy={busy} act={act}/></div>}{room.lakeClaim && <div className='choice-panel'><h3>亚伯拉罕湖 · 赢取时持续能力</h3>{room.lakeClaim.winner === room.seat ? <><button className='primary' disabled={busy} onClick={() => act({ type: 'lake-claim', shuffle: true })}>洗回所有封印牌</button><button className='secondary' disabled={busy} onClick={() => act({ type: 'lake-claim', shuffle: false })}>不洗回，按规则回手</button></> : <p>等待赢取者选择。</p>}</div>}{!room.triggerRound && room.environmentTriggers?.map((t: any) => <div className='choice-panel' key={t.id}><h3>{t.name} · 触发</h3>{t.controller === room.seat ? <EnvironmentTrigger t={t} room={room} busy={busy} act={act}/> : <p>等待{room.seats[t.controller].name}选择是否发动。</p>}</div>)}</>}</section>;
}
function EnvironmentTrigger({ t, room, busy, act }: {
    t: any;
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) { const [target, setTarget] = useState(''); const mine = room.players[room.seat], locked = busy || !!room.environmentChoice; return <>{t.requiresTarget && <select aria-label={`${t.name} 触发目标`} value={target} onChange={e => setTarget(e.target.value)}><option value=''>选择目标机动角色</option>{t.targetOptions.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}<button className='primary' disabled={locked || t.requiresTarget && !t.targetOptions.some((x: any) => x.id === target) || mine.costPool + mine.assets.filter((a: any) => !a.tapped).length < t.cost} onClick={() => act({ type: 'environment-trigger', triggerId: t.id, fire: true, targetIds: t.requiresTarget ? [target] : [] })}>发动触发能力{t.cost ? ` · 支付${t.cost}费用` : ''}</button><button className='secondary' disabled={locked} onClick={() => act({ type: 'environment-trigger', triggerId: t.id, fire: false })}>不发动</button></>; }
