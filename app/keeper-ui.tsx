'use client';
import { CharacterEntryDistrict, randomCharacterEntry } from './character-entry-district';
import { useState } from 'react';
import { TargetAction } from './automation-ui';
import { Rich } from './rich-text';
export function KeeperChoice({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const a = room.keeperChoice;
    if (!a)
        return null;
    return <section className='choice-panel'><h3>{a.sourceName} · 死亡持续能力</h3>
  <p>封印牌已全部公开。可以打出其中一张，忽略全部费用但仍需满足忠诚；X与额外费用选择数量为0，可选额外费用视为已支付。未打出的牌回各自拥有者手中。</p>
  <p>当前没有快速响应窗口。所打出的牌进入堆叠，下一个快速行动窗口才允许响应。</p>
  <div className='effect-options'>{a.cards.map((c: any) => <details key={c.id}><summary><Rich name text={c.displayName ?? c.name}/> · 拥有者：{c.ownerName}</summary><p>{c.text}</p></details>)}</div>
  {a.controller === room.seat ? <KeeperDecision key={a.id} room={room} a={a} busy={busy} act={act}/> : <p>等待 {room.seats[a.controller].name} 完成选择。</p>}
 </section>;
}
function KeeperDecision({ room, a, busy, act }: {
    room: any;
    a: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [selected, setSelected] = useState(''), [district, setDistrict] = useState(0), card = a.cards.find((c: any) => c.id === selected);
    const choose = (c: any) => act({ ...c, type: 'keeper-choice', choiceId: a.id, skip: false });
    return <><select aria-label='守秘人免费打出的牌' value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setDistrict(a.cards.find((c: any) => c.id === e.target.value)?.allowedDistricts?.[0] ?? 0); }}><option value=''>选择一张展示牌</option>{a.cards.map((c: any) => <option key={c.id} value={c.id} disabled={!c.castAllowed}>{c.name}{!c.castAllowed ? ` · ${c.castReason}` : ''}</option>)}</select>
  {card?.castAllowed && (card.freeCastPlan ? <div className='reward-row'><TargetAction key={card.id} room={{ ...room, castingCosts: { ...room.castingCosts, [card.id]: 0 } }} card={card} plan={card.freeCastPlan} options={card.targetOptions ?? []} disabled={busy} act={choose}/></div> : <div className='reward-row'><CharacterEntryDistrict card={card} room={room} district={district} setDistrict={setDistrict} disabled={busy} label='守秘人打出角色的地区'/><button className='primary' disabled={busy || (randomCharacterEntry(card) ? !card.allowedDistricts?.length : !card.allowedDistricts?.includes(district))} onClick={() => choose({ cardId: card.id, district: randomCharacterEntry(card) ? undefined : district })}>免费打出 · X为0</button></div>)}
  {card && !card.castAllowed && <p>{card.castReason}</p>}
  <button className='secondary' disabled={busy} onClick={() => act({ type: 'keeper-choice', choiceId: a.id, skip: true })}>不打出，全部回手</button>
 </>;
}
