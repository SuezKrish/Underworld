'use client';
import { CharacterEntryDistrict } from './character-entry-district';
import { useState } from 'react';
import { EffectPreviewSurface } from './card-information';
import { TargetAction, CharacterPlayAction } from './automation-ui';
export function DiscardDeckChoice({ a, room, busy, act }: {
    a: any;
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [mode, setMode] = useState('grave'), [number, setNumber] = useState(0), [greater, setGreater] = useState(false), [district, setDistrict] = useState(0);
    const [ids, setIds] = useState<string[]>([]);
    const choose = (c: any) => act({ ...c, type: 'effect-choice', choiceId: a.id });
    if (a.kind === 'discard-deck-phoenix')
        return <><div className='effect-options'>{a.cards?.map((c: any) => <label key={c.id}><input type='checkbox' aria-label={'菲尼克斯检视 ' + c.name} checked={ids.includes(c.id)} disabled={busy || !a.eligibleIds?.includes(c.id)} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name}</label>)}</div><button className='primary' disabled={busy} onClick={() => choose({ cardIds: ids })}>展示所选牌并加入手中</button></>;
    if (a.kind === 'discard-deck-drink-multiple')
        return <><div className='effect-options'>{a.cards?.map((c: any) => <label key={c.id}><input type='checkbox' aria-label={'饮血选择 ' + c.name} checked={ids.includes(c.id)} disabled={busy || ids.length >= a.max && !ids.includes(c.id)} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name}</label>)}</div><button className='primary' disabled={busy} onClick={() => choose({ cardIds: ids })}>确认饮血（{ids.length}/{a.max}）</button></>;
    if (a.kind === 'discard-deck-multiple')
        return <><p>先选择{a.count}张待弃牌，再一并展示并处理替代。</p><div className='effect-options'>{a.cards?.map((c: any) => <label key={c.id}><input type='checkbox' aria-label={'待弃牌 ' + c.name} checked={ids.includes(c.id)} disabled={busy || ids.length >= a.count && !ids.includes(c.id)} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name}</label>)}</div><button className='primary' disabled={busy || ids.length !== a.count} onClick={() => choose({ cardIds: ids })}>确认全部待弃牌</button></>;
    if (a.kind === 'discard-deck-time-number')
        return <><label>数字（0至{a.maxNumber}）<input type='number' aria-label='时空紊乱数字' min={0} max={a.maxNumber} step={1} value={number} onChange={e => setNumber(Number(e.target.value))}/></label>{a.canChooseGreater && <label><input type='checkbox' aria-label='改为大于该数字' checked={greater} onChange={e => setGreater(e.target.checked)}/>改为选择费用大于该数字的牌</label>}<button className='primary' disabled={busy || !Number.isSafeInteger(number) || number < 0 || number > a.maxNumber} onClick={() => choose({ number, greater })}>公布数字</button></>;
    if (['discard-deck-cast', 'batch-spells-cast'].includes(a.kind)) {
        const card = a.cards?.[0], available = room.players[room.seat].assets.filter((c: any) => !c.tapped).length + (room.players[room.seat].costPool ?? 0), plan = card?.spell ?? card?.attachment;
        return <><p>仅这一次机会。仍支付全部费用并满足忠诚；进入堆叠后，等本能力结算结束才开放响应窗口。</p>{card?.castAllowed ? (plan ? <TargetAction key={card.id} card={card} plan={{ ...plan, timing: 'fast' }} room={room} options={room.spellTargets?.[card.id] ?? []} disabled={busy} act={choose}/> : <><CharacterEntryDistrict card={card} room={room} district={district} setDistrict={setDistrict} label='线人墓地打出地区'/><CharacterPlayAction card={card} room={room} available={available} district={district} disabled={busy} act={choose}/></>) : <p>{card?.castReason}</p>}<button className='secondary' disabled={busy} onClick={() => choose({ skip: true })}>放弃本次打出机会</button></>;
    }
    if (a.kind === 'discard-deck-inspect')
        return <><div className='effect-options'>{a.cards?.map((c: any) => <details key={c.id}><summary>{c.name}</summary><p>{c.text}</p></details>)}</div><button className='primary' disabled={busy} onClick={() => choose({ confirm: true })}>结束私人检视</button></>;
    return <>{a.kind === 'discard-deck-plan-top' && <select aria-label='计划归来展示牌去向' value={mode} onChange={e => setMode(e.target.value)}><option value='grave'>选中的牌进入墓地</option><option value='seal'>选中的牌封印在本方秘社</option></select>}<div className='effect-options'>{a.cards?.map((c: any) => <EffectPreviewSurface key={c.id} costIds={a.kind === 'discard-deck-protection' ? [c.id] : []}><button className='secondary' title={c.text} disabled={busy} onClick={() => choose({ cardId: c.id, mode })}>{c.name}</button></EffectPreviewSurface>)}</div>{a.canSkip && <button className='quiet' disabled={busy} onClick={() => choose({ skip: true })}>跳过可选操作</button>}</>;
}
