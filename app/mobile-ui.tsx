'use client';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { ArrowRight, Layers3, Menu, MessageSquare, SlidersHorizontal, X } from 'lucide-react';
export function ResponsiveNavigation({ children }: {
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false), id = useId(), ref = useRef<HTMLElement>(null);
    useEffect(() => {
        if (!open)
            return;
        const dismiss = (e: PointerEvent) => {
            if (!ref.current?.contains(e.target as Node))
                setOpen(false);
        }, escape = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
    }, [open]);
    return <nav className={`responsive-navigation${open ? ' navigation-open' : ''}`} ref={ref} aria-label='主导航'><button className='secondary mobile-menu-toggle' aria-label={open ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{open ? <X size={18}/> : <Menu size={18}/>}<span>菜单</span></button><div id={id} className='topnav' onClick={e => {
            if ((e.target as Element).closest('a'))
                setOpen(false);
        }}>{children}</div></nav>;
}
export type MobilePanel = 'actions' | 'stack' | 'log' | null;
function choiceKey(room: any) {
    if (!room || room.status !== 'playing')
        return '';
    const mine = (a: any) => a && (a.controller === undefined || a.controller === room.seat) ? a.id ?? a.kind ?? 'choice' : '';
    const t = room.turn, step = t?.step;
    return [mine(room.deathCostChoice), mine(room.triggerRound), mine(room.triggerOrderChoice), mine(room.environmentChoice), mine(room.ruleChoice), mine(room.roundChoice), mine(room.keeperChoice), mine(room.damageChoice), mine(room.effectChoice), mine(room.hidden), ...(room.triggerChoices ?? []).map(mine), step === 'mulligan' && !room.ownMulliganDone ? 'mulligan' : null, step === 'recovery' && t.discardRequired?.[room.seat] > 0 ? `recovery:${room.round}` : null, step === 'claim-return' && !t.returnDone?.[room.seat] ? `return:${t.district}:${room.round}` : null].filter(Boolean).join('|');
}
export function useMobileBattlePanel(room: any, selected: string | null) {
    const [panel, setPanel] = useState<MobilePanel>(null), key = choiceKey(room), previous = useRef('');
    useEffect(() => {
        if (key)
            setPanel('actions');
        else if (previous.current)
            setPanel(null);
        previous.current = key;
    }, [key]);
    useEffect(() => {
        if (selected)
            setPanel('actions');
    }, [selected]);
    useEffect(() => {
        if (room?.manualRequest?.id)
            setPanel('log');
    }, [room?.manualRequest?.id]);
    useEffect(() => { setPanel(null); }, [room?.code]);
    // Initial choices must also open when a saved game is restored.
    useEffect(() => {
        if (key)
            setPanel('actions');
    }, [room?.code]);
    useEffect(() => {
        if (!panel)
            return;
        const escape = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setPanel(null);
        };
        document.addEventListener('keydown', escape);
        return () => document.removeEventListener('keydown', escape);
    }, [panel]);
    return { panel, setPanel, needsChoice: !!key };
}
export function MobilePanelHeading({ title, close }: {
    title: string;
    close: () => void;
}) { return <div className='mobile-panel-heading'><strong>{title}</strong><button className='quiet' aria-label={`收起${title}`} onClick={close}><X size={20}/></button></div>; }
export function MobileBattleDock({ room, panel, setPanel, needsChoice, busy, locked, act }: {
    room: any;
    panel: MobilePanel;
    setPanel: (p: MobilePanel) => void;
    needsChoice: boolean;
    busy: boolean;
    locked: boolean;
    act: (c: any) => Promise<void>;
}) {
    const end = room.turn?.standardAllowed && room.flow.stepOwner === room.seat && !room.flow.stack.length && !room.turn.actionClosed, pass = `让过一次优先权${end ? '（结束标准行动）' : ''}`;
    return <nav className='mobile-battle-dock' aria-label='对局快捷操作'><button aria-pressed={panel === 'actions'} onClick={() => setPanel(panel === 'actions' ? null : 'actions')}><SlidersHorizontal size={18}/><span>操作{needsChoice && <b className='mobile-choice-dot' aria-label='有待完成的选择'/>}</span></button><button aria-pressed={panel === 'stack'} onClick={() => setPanel(panel === 'stack' ? null : 'stack')}><Layers3 size={18}/><span>堆叠 {room.flow.stack.length}</span></button><button aria-pressed={panel === 'log'} onClick={() => setPanel(panel === 'log' ? null : 'log')}><MessageSquare size={18}/><span>日志</span></button><button className='primary mobile-pass' aria-label={pass} disabled={busy || room.status !== 'playing' || room.flow.priority !== room.seat || locked || room.pendingChoiceCount > 0} onClick={() => act({ type: 'pass' })}><span>让过一次优先权{end && <small>（结束标准行动）</small>}</span><ArrowRight size={16}/></button></nav>;
}
export function DistrictNavigation({ room, containerRef }: {
    room: any;
    containerRef: RefObject<HTMLDivElement | null>;
}) {
    const [active, setActive] = useState(0), ids = (room.districts ?? []).map((d: any) => d?.id ?? '').join('|');
    function go(i: number) {
        const container = containerRef.current, el = container?.querySelector<HTMLElement>(`[data-district-index="${i}"]`);
        if (container && el) {
            const left = el.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
            container.scrollTo({ left: left - 8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
            setActive(i);
        }
    }
    useEffect(() => {
        const container = containerRef.current;
        if (!container)
            return;
        const update = () => {
            const left = container.getBoundingClientRect().left;
            let distance = Infinity, index = 0;
            container.querySelectorAll<HTMLElement>('[data-district-index]').forEach(el => {
                const d = Math.abs(el.getBoundingClientRect().left - left);
                if (d < distance) {
                    distance = d;
                    index = Number(el.dataset.districtIndex);
                }
            });
            setActive(index);
        };
        container.addEventListener('scroll', update, { passive: true });
        update();
        return () => container.removeEventListener('scroll', update);
    }, [ids]);
    useEffect(() => {
        if (room.turn?.phase === 'contest' && Number.isInteger(room.turn?.district))
            go(room.turn.district);
    }, [room.turn?.phase, room.turn?.district]);
    return <nav className={`district-navigation mobile-district-navigation${room.districts?.filter(Boolean).length > 3 ? ' has-extra-districts' : ''}`} aria-label='地区导航'>{room.districts?.map((d: any, i: number) => d && <button key={d.id} className={active === i ? 'current' : ''} aria-current={active === i ? 'location' : undefined} aria-label={`前往地区${d.number ?? i + 1} · ${d.name}`} onClick={() => go(i)}><strong>地区{d.number ?? i + 1}{room.turn?.phase === 'contest' && room.turn?.district === i && <span className='live-dot'/>}</strong><span>{d.name}</span><small>{d.influence?.[room.seat] ?? 0} : {d.influence?.[1 - room.seat] ?? 0}</small></button>)}</nav>;
}
