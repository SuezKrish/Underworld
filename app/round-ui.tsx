'use client';
import { searchChoiceDisplay } from '../engine/search-choice-display.mjs';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, KeyRound } from 'lucide-react';
type Props = {
    room: any;
    busy: boolean;
    act: (c: Record<string, unknown>) => Promise<void>;
};
const phases = [['start', '开始'], ['action', '行动'], ['contest', '对抗'], ['end', '结束']];
export function RoundOverview({ room }: {
    room: any;
}) {
    const t = room.turn;
    if (!t)
        return <div className="round-overview legacy-note">这是之前的机制测试房间。返回大厅新建房间，即可测试完整回合。</div>;
    const contest = (t.phase === 'contest' || t.extraBattle) && Number.isInteger(t.district) && t.district >= 0 && t.contestLabel;
    const claiming = String(t.step).startsWith('claim-');
    return <div className="round-overview"><div className="round-meta"><b>第 {room.round} 回合</b><span><KeyRound size={13}/>{t.firstPlayer === null ? '等待起始手牌确认' : `${room.seats[t.firstPlayer].name} · 先手`}</span></div><div className="phase-track">{phases.map(([key, name], i) => <span key={key} className={t.phase === key ? 'current' : ''}><small>{i + 1}</small>{name}</span>)}</div>{contest && <div className="current-contest" role="status" aria-label="当前对抗步骤"><strong>地区{t.districtNumber ?? t.district + 1} · {claiming ? '地区赢取' : t.contestLabel}</strong><span>{t.stepLabel}</span></div>}<p>{t.phaseLabel} · {t.stepLabel}</p></div>;
}
function Picker({ cards, selected, toggle }: {
    cards: any[];
    selected: string[];
    toggle: (id: string) => void;
}) {
    return <div className="card-picker">{cards.map(c => <label key={c.id} className={selected.includes(c.id) ? 'picked' : ''}><input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)}/><span>{c.name}<small>费用 {c.printedCost}</small></span></label>)}</div>;
}
export function OrderRows({ ids, cards, setIds, moveOther, otherLabel, unit = "张", disabled = false, edge, edgeId }: {
    ids: string[];
    cards: any[];
    setIds: (ids: string[]) => void;
    moveOther?: (id: string) => void;
    otherLabel?: string;
    unit?: string;
    disabled?: boolean;
    edge?: 'top' | 'bottom';
    edgeId?: string | null;
}) {
    function swap(index: number, delta: number) { const next = [...ids]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; setIds(next); }
    const marked = edgeId === undefined ? (edge === 'bottom' ? ids.at(-1) : ids[0]) : edgeId;
    return <ol className="order-list">{ids.map((id, i) => <li key={id} title={cards.find(c => c.id === id)?.text}><span>{i + 1}. {cards.find(c => c.id === id)?.name ?? '卡牌'}</span><button className="quiet" aria-label={`上移第${i + 1}${unit}`} disabled={disabled || i === 0} onClick={() => swap(i, -1)}><ArrowUp size={13}/></button><button className="quiet" aria-label={`下移第${i + 1}${unit}`} disabled={disabled || i === ids.length - 1} onClick={() => swap(i, 1)}><ArrowDown size={13}/></button>{moveOther && <button className="quiet" onClick={() => moveOther(id)}>{otherLabel}</button>}{edge && id === marked && <small className='order-edge-label'>{edge === 'bottom' ? '牌库底' : '牌库顶'}</small>}</li>)}</ol>;
}
export function RoundDecisions({ room, busy, act }: Props) {
    const t = room.turn, a = searchChoiceDisplay(room.roundChoice), mine = room.players[room.seat];
    const [selected, setSelected] = useState<string[]>([]), [top, setTop] = useState<string[]>(a?.cards?.map((c: any) => c.id) ?? []), [bottom, setBottom] = useState<string[]>([]), [damageReplacement, setDamageReplacement] = useState(''), [damage, setDamage] = useState<Record<string, number>>({}), [wounds, setWounds] = useState<Record<string, number>>({});
    const returnCards = room.players.flatMap((p: any) => p.play).filter((c: any) => c.owner === room.seat).filter((c: any) => c.district === t?.district && (t?.returnCardIds ?? []).includes(c.id)), [order, setOrder] = useState<string[]>(returnCards.map((c: any) => c.id));
    const toggle = (id: string) => setSelected(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
    if (!t)
        return null;
    if (room.status === 'finished')
        return <section className="choice-panel result-panel"><h3>{room.result.winner === null ? '对局结束' : `${room.seats[room.result.winner].name}获胜`}</h3><p>{room.result.reason}。最终分数：{room.players.map((p: any) => p.score).join(' : ')}。</p><p>返回大厅可以创建下一局。</p></section>;
    if (t.step === 'mulligan')
        return <section className="choice-panel"><h3>起始手牌 · 同时再调度</h3><p>双方秘密选择，全部确认后同时执行，再公布调度张数。</p>{room.ownMulliganDone ? <p>已锁定，等待对方确认后更换手牌。</p> : <><Picker cards={mine.hand} selected={selected} toggle={toggle}/><div className="reward-row"><button className="primary" disabled={busy} onClick={() => act({ type: 'mulligan', cardIds: selected })}><Check size={14}/>{selected.length ? `锁定再调度 ${selected.length} 张` : '锁定保留手牌'}</button></div></>}<small>{room.seats.map((s: any, i: number) => `${s.name}：${room.mulliganDone[i] ? '已确认' : '选择中'}`).join(' · ')}</small></section>;
    if (t.step === 'recovery') {
        const n = t.discardRequired[room.seat];
        return <section className="choice-panel"><h3>恢复步骤 · 手牌上限</h3>{n > 0 ? <><p>上限 {mine.handLimit} · 手牌 {mine.handCount} · 需弃 {n} 张</p><Picker cards={mine.hand} selected={selected} toggle={toggle}/><button className="primary" disabled={busy || selected.length !== n} onClick={() => act({ type: 'discard-excess', cardIds: selected })}>弃掉所选 {selected.length} 张</button></> : <p>等待对方弃牌。</p>}</section>;
    }
    if (a?.kind === 'eternal-region')
        return <section className='choice-panel'><h3>永恒 · {a.cardName}</h3>{a.controller !== room.seat ? <p>等待 {room.seats[a.controller].name} 选择去向。</p> : <div className='effect-options'>{a.options.map((o: any) => <button className='secondary' disabled={busy} key={o.id} onClick={() => act({ type: 'eternal-region-move', choiceId: a.id, targetId: o.id })}>{o.name}</button>)}</div>}</section>;
    if (t.step === 'claim-return')
        return <section className="choice-panel"><h3>地区赢取 · 卡牌返回牌库底</h3>{t.returnDone[room.seat] ? <p>你的回底顺序已确认，等待对方完成。</p> : <><p>按从上到下的顺序放入牌库底，标注“牌库底”的牌最后放入；撤回牌仍返回手中。</p><OrderRows ids={order} cards={returnCards} setIds={setOrder} edge='bottom' edgeId={[...order].reverse().find(id => { const c = returnCards.find((c: any) => c.id === id); return c && !c.token && !(c.keywordStates?.find((k: any) => k.keyword === '撤回')?.present ?? c.keywords?.includes('撤回')); }) ?? null}/><button className="primary" disabled={busy} onClick={() => act({ type: 'return-district', cardIds: order })}>确认回底顺序</button></>}</section>;
    if (!a)
        return null;
    if (a.controller !== room.seat)
        return <section className="choice-panel"><h3>{a.kind === 'privilege' ? '先手特权选择' : ['investigation'].includes(a.kind) ? '调查奖励结算' : '战斗伤害分配'}</h3><p>等待 {room.seats[a.controller].name} 完成选择。</p></section>;
    if (a.kind === 'privilege')
        return <section className="choice-panel"><h3>非零图标平局 · 先手标志特权</h3><div className="reward-row"><button className="primary" disabled={busy || mine.assets.filter((x: any) => !x.tapped).length + mine.costPool < 1} onClick={() => act({ type: 'privilege', use: true })}>支付1 · 使用先手特权</button><button className="secondary" disabled={busy} onClick={() => act({ type: 'privilege', use: false })}>保留平局</button></div></section>;
    ;
    if (a.kind === 'investigation')
        return <section className="choice-panel"><h3>调查奖励 · 私人检视</h3><p>检视 {a.count} 张 · 仅你可见</p><div className="order-columns"><div><h4>{a.echoReward ? '放回牌库顶 · 第一张将被封印' : '放回牌库顶 · 第一张最先抓到'}</h4><OrderRows edge='top' ids={top} cards={a.cards} setIds={setTop} moveOther={id => { setTop(top.filter(x => x !== id)); setBottom([...bottom, id]); }} otherLabel="置底"/>{!top.length && <p>无</p>}</div><div><h4>放到牌库底 · 最后一张成为最底牌</h4><OrderRows edge='bottom' ids={bottom} cards={a.cards} setIds={setBottom} moveOther={id => { setBottom(bottom.filter(x => x !== id)); setTop([...top, id]); }} otherLabel="置顶"/>{!bottom.length && <p>无</p>}</div></div><button className="primary" disabled={busy} onClick={() => act({ type: 'investigate', top, bottom })}>{a.echoReward ? '确认顺序并封印顶牌' : '确认顺序并抓1张'}</button></section>;
    if (a.kind === 'damage') {
        const woundSum = Object.values(wounds).reduce((n, v) => n + v, 0), sum = Object.values(damage).reduce((n, v) => n + v, 0) + woundSum, total = (id: string) => (damage[id] ?? 0) + (wounds[id] ?? 0), guards = a.targets.filter((c: any) => c.guardRequirement > 0), guardInvalid = a.targets.some((c: any) => !c.guardRequirement && total(c.id) > 0) && guards.some((c: any) => total(c.id) < c.guardRequirement);
        return <section className="choice-panel"><h3>战斗奖励 · 分配伤害</h3>{a.taskForceAlternative && <div className='effect-options'><strong>执行部特遣组</strong>{a.replacementTargets.length > 0 && <select aria-label='替代战斗伤害所消灭的暗藏者' value={a.replacementTargets.some((t: any) => t.id === damageReplacement) ? damageReplacement : ''} onChange={e => setDamageReplacement(e.target.value)}><option value=''>选择一个暗藏者</option>{a.replacementTargets.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}<button className='secondary' disabled={busy || a.replacementTargets.length > 0 && !a.replacementTargets.some((t: any) => t.id === damageReplacement)} onClick={() => act({ type: 'replace-battle-damage', cardId: a.replacementTargets.length ? damageReplacement : null })}>放弃全部战斗伤害{a.replacementTargets.length ? '，消灭所选暗藏者' : ''}</button></div>}<p>需分配 {a.budget} 点 · 已分配 {sum} 点{a.woundBudget > 0 && ` · 创伤转换 ${woundSum}/${a.woundBudget}`}</p><div className="damage-targets">{a.targets.map((c: any) => <div key={c.id}><span>{c.name}<small>防御 {c.effectiveDefense} · 已受伤害 {c.damage ?? 0}{c.guardRequirement > 0 ? ` · 护卫${c.guardRequirement}` : ''}{c.woundsPrevented ? ' · 防止创伤' : ''}</small></span><label>伤害<input type="number" min="0" max={a.budget} aria-label={`对${c.name}分配伤害`} value={damage[c.id] ?? 0} onChange={e => setDamage({ ...damage, [c.id]: Math.max(0, Number(e.target.value) || 0) })}/></label>{a.woundBudget > 0 && <label>创伤<input type="number" min="0" max={a.woundBudget} aria-label={`对${c.name}分配创伤`} value={wounds[c.id] ?? 0} onChange={e => setWounds({ ...wounds, [c.id]: Math.max(0, Number(e.target.value) || 0) })}/></label>}</div>)}</div><div className="reward-row"><button className="primary" disabled={busy || sum !== (a.targets.length ? a.budget : 0) || woundSum > (a.woundBudget ?? 0) || guardInvalid || ![...Object.values(damage), ...Object.values(wounds)].every(Number.isSafeInteger)} onClick={() => act({ type: 'assign-damage', allocations: a.targets.filter((c: any) => total(c.id) > 0).map((c: any) => ({ cardId: c.id, amount: damage[c.id] ?? 0, wounds: wounds[c.id] ?? 0 })) })}>确认伤害分配</button></div></section>;
    }
    return null;
}
