'use client';
import { useRef, useEffect, useState, useId } from 'react';
import { X } from 'lucide-react';
import { OrderRows } from './round-ui';
import { CardSummary } from './card-information';
import { ThemePortal } from './background-settings';
const zones: Record<string, string> = { hand: '手牌', play: '场上', asset: '资产区', deck: '牌库', graveyard: '墓地', headquarters: '集团总部', sealed: '封印区' };
const titles: Record<string, string> = { 'to-asset': '置于资产区', seal: '封印', 'put-face-up': '正面放置进场', 'put-face-down': '以暗藏者状态放置进场', 'deck-top': '置于牌库顶', 'deck-bottom': '置于牌库底', 'to-hand': '置于手中', 'to-graveyard': '置于墓地', 'flip-character': '翻面角色／暗藏者', 'add-influence-counter': '放置本方势力标志' };
function Modal({ title, label, close, children }: {
    title: React.ReactNode;
    label: string;
    close: () => void;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLElement>(null), closeRef = useRef(close), titleId = useId();
    closeRef.current = close;
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
        const keys = (e: KeyboardEvent) => {
            if (document.querySelector('.card-context-menu,.card-information-scrim'))
                return;
            if (e.key === 'Escape') {
                e.preventDefault();
                closeRef.current();
            }
            else if (e.key === 'Tab') {
                const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]') ?? []), first = items[0], last = items.at(-1);
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
                else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener('keydown', keys);
        return () => {
            document.removeEventListener('keydown', keys);
            if (previous?.isConnected)
                previous.focus();
        };
    }, []);
    return <ThemePortal><div className='modal-scrim command-window-scrim' onClick={e => {
            if (e.target === e.currentTarget)
                close();
        }}><section ref={ref} className='rules-modal asset-modal command-modal' role='dialog' aria-label={label} aria-modal='true' aria-labelledby={titleId}><button className='icon close' aria-label='关闭区域检视' onClick={close}><X size={20}/></button><h2 id={titleId}>{title}</h2>{children}</section></div></ThemePortal>;
}
function Cards({ cards, selected, select, take, grave, consent = false, busy = false, ordered = false }: {
    cards: any[];
    selected?: string[];
    select?: (id: string) => void;
    take?: (c: any) => void;
    grave?: (c: any) => void;
    consent?: boolean;
    busy?: boolean;
    ordered?: boolean;
}) {
    return <div className='asset-card-grid'>{cards.map((c, i) => <CardSummary key={c.id} card={c} className={`asset-card ${selected?.includes(c.id) ? 'manual-selected' : ''}`}>
 {ordered && <small className='inspection-position'>第{i + 1}张</small>}{c.zone && <small>{zones[c.zone]}{c.district !== undefined ? ` · 地区${c.district + 1}` : ''}</small>}
 {select && <label><input type='checkbox' aria-label={`选择 ${c.name}`} checked={selected?.includes(c.id) ?? false} disabled={busy} onChange={() => select(c.id)}/>选择</label>}
 {(take || grave) && <div className='reward-row'>{take && <button className='secondary' disabled={busy} onClick={() => take(c)}>{consent ? '申请置于手中' : '置于手中'}</button>}{grave && <button className='secondary' disabled={busy} onClick={() => grave(c)}>{consent ? '申请置于墓地' : '置于墓地'}</button>}</div>}
 </CardSummary>)}</div>;
}
export function ManualApproval({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => Promise<void>;
}) {
    const r = room.manualRequest;
    if (!r)
        return null;
    return <div className='command-approval' role='status'><strong>{room.seats[r.requester].name}申请：{r.label}</strong><p>{r.zone === 'top' ? '牌库顶' : r.zone === 'bottom' ? '牌库底' : r.zone === 'deck' ? '整个牌库（有序）' : ''}{r.quantity ? `${r.zone ? ' · ' : ''}${r.quantity}` : ''}{r.districtName ? ` · 地区${r.district + 1} ${r.districtName}` : ''}{r.undoLabel ? ` · ${r.undoLabel}` : ''}</p>
 {!!r.selection?.length && <details><summary>查看所选卡牌</summary>{r.selection.map((c: any, i: number) => <p key={i}>{c.name} · {zones[c.zone]}{c.district !== null ? ` · 地区${c.district + 1}` : ''}</p>)}</details>}
 {r.requester === room.seat ? <button className='secondary' disabled={busy} onClick={() => act({ type: 'manual-cancel', requestId: r.id })}>取消申请</button> : <div className='reward-row'><button className='primary' disabled={busy} onClick={() => act({ type: 'manual-confirm', requestId: r.id, accept: true })}>同意并执行</button><button className='secondary' disabled={busy} onClick={() => act({ type: 'manual-confirm', requestId: r.id, accept: false })}>拒绝申请</button></div>}</div>;
}
function Selection({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => Promise<void>;
}) {
    const pick = room.manualSelection, [ids, setIds] = useState<string[]>([]), [destinations, setDestinations] = useState<Record<string, string>>({});
    const selected = ids.filter(id => (pick.cards ?? []).some((c: any) => c.id === id));
    return <Modal title={<>{pick.commandText} · {titles[pick.operation]}</>} label='指令选牌' close={() => void act({ type: 'manual-selection-cancel', selectionId: pick.id })}>{pick.options ? <div className='effect-options'>{pick.options.map((o: any) => <button className='secondary' key={o.id} disabled={busy} onClick={() => act({ type: 'manual-selection-submit', selectionId: pick.id, district: o.district })}>{o.name} · {pick.count}个</button>)}</div> : <Cards cards={pick.cards} selected={selected} select={id => setIds(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])} busy={busy}/>}{pick.placements && pick.operation !== 'to-asset' && selected.map(id => <label key={id}>{pick.cards.find((c: any) => c.id === id)?.name} · {pick.operation === 'seal' ? '封印宿主' : '放置位置'}<select aria-label={`放置位置 ${pick.cards.find((c: any) => c.id === id)?.name}`} value={destinations[id] ?? ''} disabled={busy} onChange={e => setDestinations({ ...destinations, [id]: e.target.value })}><option value=''>选择位置</option>{(pick.placements[id] ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>)}{!pick.options && !pick.cards.length && <p>没有可选择的卡牌。</p>}{!pick.options && <button className='primary wide' disabled={busy || !selected.length || pick.placements && pick.operation !== 'to-asset' && selected.some(id => !pick.placements[id]?.some((o: any) => o.id === destinations[id]))} onClick={() => act({ type: 'manual-selection-submit', selectionId: pick.id, cardIds: selected, destinations })}>{room.manualWithoutConsent ? '执行' : '申请'}{titles[pick.operation]} · {selected.length}张</button>}</Modal>;
}
function Inspection({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => Promise<void>;
}) {
    const a = room.inspection, [order, setOrder] = useState<string[]>(a.cards.map((c: any) => c.id)), sortable = ['top', 'bottom'].includes(a.zone), title = a.zone === 'top' ? '检视牌库顶' : a.zone === 'bottom' ? '检视牌库底' : a.ordered ? '检视牌库（有序）' : '检视牌库（按扩展、编号）';
    const changing = busy || !!room.manualRequest || room.status !== 'playing' || room.flow.locked || room.effectChoice || room.ruleChoice || room.hidden || room.roundChoice || room.pendingChoiceCount;
    return <Modal title={title} label='检视自己的牌库' close={() => void act({ type: 'cancel-inspection' })}><p>{a.count}张</p>{sortable && <><OrderRows edge={a.zone === 'bottom' ? 'bottom' : 'top'} ids={order} cards={a.cards} setIds={setOrder}/><button className='primary' disabled={changing || order.length < 2} onClick={() => act({ type: 'manual-request', operation: 'reorder-inspection', inspectionId: a.id, cardIds: order })}>{room.manualWithoutConsent ? '保存顺序' : '申请保存顺序'}</button></>}<Cards cards={a.cards} ordered={a.ordered} busy={!!changing} consent={!room.manualWithoutConsent} take={c => void act({ type: 'manual-request', operation: 'to-hand', cardIds: [c.id] })} grave={c => void act({ type: 'manual-request', operation: 'to-graveyard', cardIds: [c.id] })}/>{room.manualRequest?.requester === room.seat && <p role='status'>申请已发送，等待对手同意。</p>}</Modal>;
}
export function CommandWindows({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => Promise<void>;
}) { return <>{room.manualSelection ? <Selection key={room.manualSelection.id} room={room} busy={busy} act={act}/> : room.inspection && <Inspection key={room.inspection.id} room={room} busy={busy} act={act}/>}</>; }
export function PublicGraveyard({ room, player }: {
    room: any;
    player: number;
}) {
    const [open, setOpen] = useState(false), pl = room.players[player];
    return <><button className='zone-view-button' aria-label={`查看${player === room.seat ? '本方' : '对方'}墓地`} onClick={() => setOpen(true)}>查看</button>{open && <Modal title={`${room.seats[player].name}的墓地`} label='公共墓地' close={() => setOpen(false)}><p>{pl.graveyard.length}张</p><Cards cards={pl.graveyard}/>{!pl.graveyard.length && <p>墓地为空。</p>}{(pl.headquartersActive || pl.headquarters?.length > 0) && <><h3>集团总部 · {pl.headquarters?.length ?? 0}张</h3><Cards cards={pl.headquarters ?? []}/></>}</Modal>}</>;
}
export function PublicSealedZone({ room, player }: {
    room: any;
    player: number;
}) {
    const [open, setOpen] = useState(false), cards = (room.sealed ?? []).filter((c: any) => c.owner === player);
    return <span>封印 <b>{cards.length}</b> <button className='zone-view-button' aria-label={`查看${player === room.seat ? '本方' : '对方'}封印区`} onClick={() => setOpen(true)}>查看</button>{open && <Modal title={`${room.seats[player].name}的封印区`} label='公共封印区' close={() => setOpen(false)}><p>{cards.length}张</p><div className='asset-card-grid'>{cards.map((c: any) => <CardSummary key={c.id} card={c}><p>封印在：{c.hostName}</p>{c.faceDown && <small>背面封印</small>}</CardSummary>)}</div>{!cards.length && <p>封印区为空。</p>}</Modal>}</span>;
}
