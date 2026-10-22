'use client';
import { ShoggothCounter, SocietyCounters } from './society-summary';
export { ShoggothCounter } from './society-summary';
import { useState } from 'react';
import { Eye, LockKeyhole } from 'lucide-react';
export function SocietyStatus({ room }: {
    room: any;
}) {
    return <section className="society-status" aria-label="双方秘社标志">{[room.seat, 1 - room.seat].map(i => { const p = room.players[i]; return <article key={i}><small>{i === room.seat ? '本方秘社' : '对方秘社'} · {room.seats[i].name}</small>{room.deckSelections?.[i] && <><strong>{room.deckSelections[i].society.name}</strong><details><summary>秘社原文与构筑说明</summary><p className='rich-preview'>{room.deckSelections[i].society.text}</p></details></>}<div className="society-marker-row"><ShoggothCounter society={room.societies?.[i]}/><SocietyCounters society={room.societies?.[i]}/><span className="hidden-badge"><Eye size={17}/>【隐秘】<b>{p.markers.hidden}</b></span><span className="exposed-badge">【暴露】<b>{p.markers.exposed}</b></span></div><span>手牌上限 <b>{p.handLimit}</b></span></article>; })}</section>;
}
function HiddenSelection({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => Promise<void>;
}) {
    const h = room.hidden, mine = room.players[room.seat], [ids, setIds] = useState<string[]>([]), cost = mine.hand.find((c: any) => c.id === ids[0])?.printedCost;
    const selected = h.ownSelection ? Array.isArray(h.ownSelection) ? h.ownSelection : [h.ownSelection] : [];
    return <><div className="commit-status">{room.seats.map((s: any, i: number) => <span key={i}>{s.name} · {h.committed[i] ? '已锁定' : '选择中'}</span>)}</div>
 {h.earlyRevealed && <p>提前展示：{room.seats[h.earlyRevealed.player].name} · {h.earlyRevealed.cards.map((c: any) => c.name).join('、')}</p>}
 {selected.length ? <p>已锁定：{selected.map((id: string) => mine.hand.find((c: any) => c.id === id)?.name).join('、')}</p> : <>
 {!h.canSelect && <p>等待对方先选择并展示。</p>}
 <div className="hidden-selection-grid">{mine.hand.map((c: any) => <button className={ids.includes(c.id) ? 'primary' : 'secondary'} key={c.id} disabled={busy || !h.canSelect || h.multiSelection && ids.length > 0 && !ids.includes(c.id) && c.printedCost !== cost} title={c.text} onClick={() => h.multiSelection ? setIds(ids.includes(c.id) ? ids.filter(id => id !== c.id) : [...ids, c.id]) : act({ type: 'select-hidden', cardId: c.id })}><b>{c.name}</b><small>印刷费用 {c.printedCost}</small><span>{h.multiSelection ? ids.includes(c.id) ? '已选择' : '选择' : '选择并锁定'}</span></button>)}</div>
 {h.multiSelection && <button className='primary' disabled={busy || !h.canSelect || !ids.length} onClick={() => act({ type: 'select-hidden', cardIds: ids })}>锁定 {ids.length} 张同费用牌</button>}
 </>}
 </>;
}
export function HiddenContest({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => Promise<void>;
}) {
    const h = room.hidden;
    if (!h)
        return null;
    const awaitingReward = h.step === 7 && h.comparison?.kind === 'winner';
    return <section className="contest-panel hidden-contest-panel" aria-label="隐秘对抗结算"><div className="panel-title"><h3>隐秘对抗 · {h.step === 2 ? '秘密选择' : awaitingReward ? '展示与奖励' : '隐秘能力选择'}</h3><LockKeyhole size={18}/></div>{h.step === 2 ? <HiddenSelection key={h.id ?? h.committed.join(':')} room={room} busy={busy} act={act}/> : <>
 <div className="hidden-reveal-grid">{(h.revealed ?? []).map((x: any) => <article key={x.owner}><small>{room.seats[x.owner].name}的展示牌</small>{(x.cards ?? [x]).map((c: any) => <details key={c.card.id}><summary>{c.card.name}</summary><p className='rich-preview'>{c.card.text}</p></details>)}<p>基础费用 {x.printedCost} · 修正 {x.modifier >= 0 ? '+' : ''}{x.modifier}</p><strong>对抗点数 {x.value}</strong></article>)}</div>
 {awaitingReward ? <><p>{room.seats[h.comparison.player].name}赢得本次隐秘对抗。</p>{h.comparison.player === room.seat ? <div className="reward-row">{h.rewardKind === 'predict' ? <button className='primary' disabled={busy} onClick={() => act({ type: 'hidden-reward', reward: 'predict' })}>预测1</button> : <><button className="primary" disabled={busy} onClick={() => act({ type: 'hidden-reward', reward: 'hidden' })}>本方【隐秘】+1</button><button className="secondary" disabled={busy} onClick={() => act({ type: 'hidden-reward', reward: 'exposed' })}>对方【暴露】+1</button></>}<button className="quiet" disabled={busy} onClick={() => act({ type: 'hidden-reward', reward: 'none' })}>放弃奖励</button></div> : <p>等待胜者选择奖励。</p>}</> : <p role='status'>完成隐秘能力选择后，继续比较对抗点数。</p>}
 </>}</section>;
}
