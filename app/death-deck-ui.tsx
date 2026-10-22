'use client';
import { useState } from 'react';
import { OrderRows } from './round-ui';
export function DeathDeckChoice({ a, busy, act }: {
    a: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const [ids, setIds] = useState<string[]>([]), cards = a.cards ?? [], selected = ids.filter(id => cards.some((c: any) => c.id === id)), sum = cards.filter((c: any) => selected.includes(c.id)).reduce((n: number, c: any) => n + c.printedCost, 0), upkeep = a.kind === 'death-deck-upkeep';
    if (!upkeep && a.kind !== 'death-deck-azrael-enemies')
        return <><div className='effect-options'>{cards.map((c: any) => <button className='secondary' key={c.id} disabled={busy} title={c.text} onClick={() => act({ type: 'effect-choice', choiceId: a.id, cardId: c.id })}>{c.name} · 印刷费用{c.printedCost}</button>)}</div>{a.canFail && <button className='secondary' disabled={busy} onClick={() => act({ type: 'effect-choice', choiceId: a.id, fail: true })}>未找到，洗牌并完成</button>}</>;
    return <><p>{upkeep ? `选择${a.count}张墓地牌，按列表顺序放到牌库底。` : `选择任意数量敌方角色，印刷费用总和至多${a.maxPrintedCost}。`}已选{selected.length}张{upkeep ? '' : `，费用总和${sum}`}。</p><div className='effect-options'>{cards.map((c: any) => <label key={c.id}><input type='checkbox' aria-label={'结算选择 ' + c.name + ' ' + c.id} checked={selected.includes(c.id)} disabled={busy || upkeep && selected.length >= a.count && !selected.includes(c.id)} onChange={e => setIds(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))}/>{c.name} · 印刷费用{c.printedCost}</label>)}</div>{upkeep && <OrderRows edge='bottom' ids={selected} cards={cards} setIds={setIds}/>}<button className='primary' disabled={busy || (upkeep ? selected.length !== a.count : sum > a.maxPrintedCost)} onClick={() => act({ type: 'effect-choice', choiceId: a.id, cardIds: selected })}>{upkeep ? '确认回底顺序' : '确认消灭'}</button></>;
}
export function DeathCharacterCosts({ options, ids, setIds, disabled }: {
    options: any;
    ids: string[];
    setIds: (ids: string[]) => void;
    disabled: boolean;
}) {
    if (!options)
        return null;
    const selected = ids.filter(id => options.cards.some((c: any) => c.id === id));
    return <div className='effect-options'><p>{options.required?.length ? '额外费用' : '可选额外费用'}：{options.costLabel ?? (options.kind === 'shuffle-seal' ? '将一张封印在本方秘社上的精神锚点洗回其拥有者牌库。' : options.kind === 'bottom' ? '将墓地死亡领域牌置于牌库底，每张减1费用。按选择顺序回底。' : options.kind === 'tap' ? '横置本方网站，每张减1费用。' : options.kind === 'combined' ? '可选择下列额外费用，减费数见各牌。' : `牺牲本方角色，每个减${options.reduction}费用。`)}已选{selected.length}张。</p>{options.cards.map((c: any) => <label key={c.id}><input type='checkbox' aria-label={(options.payments?.[c.id]?.kind === 'shuffle-seal' ? '额外费用 ' : '减费费用 ') + c.name + ' ' + c.id} checked={selected.includes(c.id)} disabled={disabled || !!options.required?.some((r: any) => r.ids.includes(c.id) && selected.filter(id => r.ids.includes(id)).length >= r.count && !selected.includes(c.id))} onChange={e => setIds(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))}/>{c.name} · {options.payments?.[c.id]?.kind === 'shuffle-seal' ? '洗回拥有者牌库' : `${options.payments?.[c.id]?.kind === 'bottom' ? '回底' : options.payments?.[c.id]?.kind === 'tap' ? '横置' : '牺牲'}减${options.payments?.[c.id]?.reduction ?? options.reduction}`}</label>)}</div>;
}
export function CharacterRevealAction({ card, room, disabled, available, act }: {
    card: any;
    room: any;
    disabled: boolean;
    available: number;
    act: (c: any) => void;
}) {
    const [payOptionalExtra, setPayOptionalExtra] = useState(false);
    const [ids, setIds] = useState<string[]>([]), options = room.revealExtraCosts?.[card.id], selected = ids.filter(id => options?.cards.some((c: any) => c.id === id)), cost = Math.max(0, card.printedCost - (room.revealDiscounts?.[card.id] ?? card.printedCost - (room.revealCosts?.[card.id] ?? card.printedCost)) + (payOptionalExtra ? (card.automation?.optionalExtraCost ?? 0) : 0) - selected.reduce((n, id) => n + (options?.payments?.[id]?.reduction ?? 0), 0));
    return <>{card.automation?.optionalExtraCost && <label><input type='checkbox' aria-label='现身时支付卡门可选额外费用' checked={payOptionalExtra} disabled={disabled} onChange={e => setPayOptionalExtra(e.target.checked)}/>额外支付{card.automation.optionalExtraCost}</label>}<DeathCharacterCosts options={options} ids={selected} setIds={setIds} disabled={disabled}/><button className='primary' disabled={disabled || options?.required?.some((r: any) => selected.filter(id => r.ids.includes(id)).length !== r.count) || available < cost} onClick={() => act({ type: 'reveal', cardId: card.id, costIds: selected, payOptionalExtra })}>支付 {cost} · 现身（快速行动）</button></>;
}
export function GraveSealCosts({ plan, options, ids, setIds, disabled }: {
    plan: any;
    options: any[];
    ids: string[];
    setIds: (ids: string[]) => void;
    disabled: boolean;
}) {
    if (!plan.graveSealCost && !plan.graveShuffleCost)
        return null;
    const f = plan.graveSealCost ?? plan.graveShuffleCost;
    return <div className='effect-options'><p>额外费用：{plan.graveShuffleCost ? `将墓地中的${f.count}张猎魔人牌${f.destination === 'bottom' ? '置于牌库底' : '洗回牌库'}` : `封印${f.count}张${f.distinctNames ? '不同名的' : ''}本方墓地角色到本方秘社`}。已选{ids.length}/{f.count}。{f.destination === 'bottom' && '按勾选顺序置底，最后勾选的牌位于牌库最底。'}</p>{options.map((c: any) => <label key={c.id}><input type='checkbox' aria-label={(plan.graveShuffleCost ? f.destination === 'bottom' ? '置底费用 ' : '洗回费用 ' : '封印费用 ') + c.name + ' ' + c.id} checked={ids.includes(c.id)} disabled={disabled || !ids.includes(c.id) && (ids.length >= f.count || f.distinctNames && ids.some(id => options.find(x => x.id === id)?.name === c.name))} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name}</label>)}</div>;
}
