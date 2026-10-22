import {passPriorityLabel} from '../engine/pass-label.mjs';
'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, GripHorizontal, RotateCcw } from 'lucide-react';
import { AutoPassControls } from './asset-ui';
type Point = {
    x: number;
    y: number;
};
const positionKey = 'hidden-world-priority-position';
export function PriorityWindow({ room, busy, locked, act }: {
    room: any;
    busy: boolean;
    locked: boolean;
    act: (c: any) => Promise<void>;
}) {
    const panel = useRef<HTMLElement>(null), drag = useRef<{
        pointer: number;
        start: Point;
        origin: Point;
    } | null>(null), positionRef = useRef<Point | null>(null);
    const [position, setPosition] = useState<Point | null>(null), [dragging, setDragging] = useState(false);
    const myPriority = room.flow.priority === room.seat;
    const claimResume = room.turn?.claimResume, claimWindow = ['claim-before', 'claim-after'].includes(room.turn?.step);
    function place(point: Point) {
        const rect = panel.current?.getBoundingClientRect();
        if (!rect)
            return;
        const next = { x: Math.max(8, Math.min(point.x, window.innerWidth - rect.width - 8)), y: Math.max(8, Math.min(point.y, window.innerHeight - rect.height - 8)) };
        positionRef.current = next;
        setPosition(next);
        return next;
    }
    function save() {
        if (positionRef.current)
            try {
                localStorage.setItem(positionKey, JSON.stringify(positionRef.current));
            }
            catch { }
    }
    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(positionKey) ?? 'null');
            if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y))
                place(stored);
        }
        catch { }
        const fit = () => {
            if (positionRef.current)
                place(positionRef.current);
        };
        window.addEventListener('resize', fit);
        const observer = new ResizeObserver(fit);
        if (panel.current)
            observer.observe(panel.current);
        return () => { window.removeEventListener('resize', fit); observer.disconnect(); };
    }, []);
    function finish(e: React.PointerEvent<HTMLButtonElement>) {
        if (drag.current?.pointer !== e.pointerId)
            return;
        drag.current = null;
        setDragging(false);
        save();
        if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
    }
    return <aside ref={panel} aria-label='优先权操作窗口' className={`priority-window ${dragging ? 'dragging' : ''}`} style={position ? { position: 'fixed', left: position.x, top: position.y, right: 'auto', bottom: 'auto', width: 'min(260px, calc(100vw - 16px))' } : undefined}>
  <div className='priority-title'>
   <button className='priority-drag-handle' aria-label='拖动优先权窗口' title='拖动窗口；方向键调整位置' onPointerDown={e => {
            if (e.button !== 0)
                return;
            const rect = panel.current!.getBoundingClientRect();
            drag.current = { pointer: e.pointerId, start: { x: e.clientX, y: e.clientY }, origin: { x: rect.left, y: rect.top } };
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            e.preventDefault();
        }} onPointerMove={e => {
            const d = drag.current;
            if (d?.pointer === e.pointerId)
                place({ x: d.origin.x + e.clientX - d.start.x, y: d.origin.y + e.clientY - d.start.y });
        }} onPointerUp={finish} onPointerCancel={finish} onKeyDown={e => {
            const delta: Record<string, Point> = { ArrowLeft: { x: -10, y: 0 }, ArrowRight: { x: 10, y: 0 }, ArrowUp: { x: 0, y: -10 }, ArrowDown: { x: 0, y: 10 } }, d = delta[e.key];
            if (!d)
                return;
            e.preventDefault();
            const rect = panel.current!.getBoundingClientRect();
            place({ x: rect.left + d.x, y: rect.top + d.y });
            save();
        }}><GripHorizontal size={17}/><span>优先权</span></button>
   <button className='quiet' aria-label='重置优先权窗口位置' title='重置位置' onClick={() => {
            positionRef.current = null;
            setPosition(null);
            try {
                localStorage.removeItem(positionKey);
            }
            catch { }
        }}><RotateCcw size={14}/></button>
  </div>
  <div className='priority-body'><div className='turn-indicator'><span className={myPriority ? 'live-dot' : 'idle-dot'}/>{room.status === 'finished' ? '对局结束' : locked ? '请完成当前步骤的选择' : myPriority ? '轮到你行动' : '等待对方行动'}</div>
   {claimWindow && claimResume && <p className='claim-resume-note'>地区赢取{room.turn.step === 'claim-before' ? '前' : '后'}快速行动窗口。双方让过并完成结算后，返回{claimResume.stepLabel}。</p>}
   <button className='primary wide' disabled={busy || room.status !== 'playing' || !myPriority || locked || room.pendingChoiceCount > 0} onClick={() => act({ type: 'pass' })}>{passPriorityLabel(room)}<ArrowRight size={15}/></button>
   <AutoPassControls room={room} busy={busy} act={act}/>
  </div>
 </aside>;
}
