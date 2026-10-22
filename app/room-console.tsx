'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Send, RotateCcw, MoveDiagonal2 } from 'lucide-react';
import { ManualApproval, CommandWindows } from './manual-ui';
import { commandSuggestions } from '../engine/room-commands.mjs';
type Size = {
    width: number;
    height: number;
};
const defaultSize: Size = { width: 300, height: 220 }, sizeKey = 'hidden-world-console-size';
export function RoomConsole({ room, busy, act, onResize, mobileExpanded = false }: {
    room: any;
    busy: boolean;
    act: (c: any) => Promise<void>;
    onResize?: (s: Size) => void;
    mobileExpanded?: boolean;
}) {
    const [open, setOpen] = useState(true), [text, setText] = useState(''), [focused, setFocused] = useState(false), [suggest, setSuggest] = useState(true), [active, setActive] = useState(-1), logRef = useRef<HTMLDivElement>(null), inputRef = useRef<HTMLInputElement>(null);
    const commands = focused && suggest ? commandSuggestions(text).filter(c => !room.bot || room.manualWithoutConsent || c.operation !== 'inspect' || c.zone === 'unordered-deck') : [];
    const [size, setSize] = useState(defaultSize), sizeRef = useRef(defaultSize), drag = useRef<{
        pointer: number;
        x: number;
        y: number;
        size: Size;
        axis: string;
    } | null>(null);
    function fit(next: Size) { const maxWidth = Math.max(260, Math.min(window.innerWidth - 24, window.innerWidth * .48)), maxHeight = Math.max(160, Math.min(window.innerHeight - 130, window.innerHeight * .55)); const fitted = { width: Math.max(Math.min(260, maxWidth), Math.min(next.width, maxWidth)), height: Math.max(160, Math.min(next.height, maxHeight)) }; sizeRef.current = fitted; setSize(fitted); }
    function save() {
        try {
            localStorage.setItem(sizeKey, JSON.stringify(sizeRef.current));
        }
        catch { }
    }
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(sizeKey) ?? 'null');
            fit(saved && Number.isFinite(saved.width) && Number.isFinite(saved.height) ? saved : defaultSize);
        }
        catch {
            fit(defaultSize);
        }
        const resize = () => fit(sizeRef.current);
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);
    useEffect(() => { onResize?.({ ...size, height: open ? size.height : 38 }); }, [size, open, onResize]);
    function handle(axis: string, label: string) {
        return <button className={`console-resize-handle resize-${axis}`} aria-label={label} title={`${label}；方向键调整，双击重置`} onDoubleClick={() => { fit(defaultSize); save(); }} onPointerDown={e => {
                if (e.button !== 0)
                    return;
                e.preventDefault();
                drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, size: sizeRef.current, axis };
                e.currentTarget.setPointerCapture(e.pointerId);
            }} onPointerMove={e => {
                const d = drag.current;
                if (d?.pointer !== e.pointerId)
                    return;
                fit({ width: d.size.width - (d.axis.includes('w') ? e.clientX - d.x : 0), height: d.size.height - (d.axis.includes('n') ? e.clientY - d.y : 0) });
            }} onPointerUp={e => {
                if (drag.current?.pointer !== e.pointerId)
                    return;
                drag.current = null;
                save();
                e.currentTarget.releasePointerCapture(e.pointerId);
            }} onPointerCancel={() => { drag.current = null; save(); }} onKeyDown={e => {
                const delta: Record<string, Size> = { ArrowLeft: { width: 20, height: 0 }, ArrowRight: { width: -20, height: 0 }, ArrowUp: { width: 0, height: 20 }, ArrowDown: { width: 0, height: -20 } };
                if (!delta[e.key])
                    return;
                e.preventDefault();
                fit({ width: sizeRef.current.width + (axis.includes('w') ? delta[e.key].width : 0), height: sizeRef.current.height + (axis.includes('n') ? delta[e.key].height : 0) });
                save();
            }}>{axis === 'nw' && <MoveDiagonal2 size={13}/>}</button>;
    }
    useEffect(() => {
        if (logRef.current)
            logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [room.logs.length, open]);
    useEffect(() => {
        if (room.manualRequest || mobileExpanded)
            setOpen(true);
    }, [room.manualRequest?.id, mobileExpanded]);
    useEffect(() => {
        const last = room.logs.at(-1);
        if (text.trim() && last?.kind === 'message' && last.player === room.seat && last.text === `${room.seats[room.seat].name}：${text.trim()}`)
            setText('');
    }, [room.logs.length]);
    useEffect(() => {
        if (room.commandAcknowledgement?.text === text)
            setText('');
    }, [room.commandAcknowledgement?.id]);
    useEffect(() => {
        if (active >= 0)
            document.getElementById(`room-command-${active}`)?.scrollIntoView({ block: 'nearest' });
    }, [active]);
    function complete(index: number) {
        const c = commands[index];
        if (!c)
            return;
        setText(c.command);
        setActive(-1);
        setSuggest(false);
        inputRef.current?.focus();
    }
    async function send(e: React.FormEvent) {
        e.preventDefault();
        if (!text.trim() || busy)
            return;
        setSuggest(false);
        setActive(-1);
        await act({ type: 'room-message', text });
    }
    return <><CommandWindows room={room} busy={busy} act={act}/><aside className={`room-console ${open ? 'open' : 'closed'}`} style={{ width: size.width, height: open ? size.height : 38 }} aria-label='对局日志与操作窗口'>
 {handle('w', '调整日志窗口宽度')}{open && handle('n', '调整日志窗口高度')}{open && handle('nw', '调整日志窗口大小')}
 <div className='console-title'><span><MessageSquare size={15}/>对局窗口</span><div><button className='quiet' aria-label='重置日志窗口大小' title='重置大小' onClick={() => { fit(defaultSize); save(); }}><RotateCcw size={14}/></button><button className='quiet' aria-label={open ? '收起对局窗口' : '展开对局窗口'} onClick={() => setOpen(!open)}>{open ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}</button></div></div>
 {open && <><div className='console-body'><ManualApproval room={room} busy={busy} act={act}/><div className='event-log' ref={logRef} aria-live='polite'>{room.logs.map((l: any) => <p className={l.kind === 'message' ? 'room-message' : ''} key={l.id}><span>{String(l.id).padStart(2, '0')}</span>{l.text}</p>)}</div></div>
 <form className='console-message-form' onSubmit={send}>{!!commands.length && <div className='command-suggestions' id='room-command-suggestions' role='listbox' aria-label='可用指令'>{commands.map((c, index) => <button type='button' role='option' aria-selected={active === index} id={`room-command-${index}`} key={c.name} onMouseDown={e => e.preventDefault()} onClick={() => complete(index)} className={active === index ? 'selected' : ''}><code>{c.usage}</code><small>{c.meaning}</small></button>)}</div>}<input ref={inputRef} aria-label='房间文字消息' placeholder='消息或 \\ 指令…' autoComplete='off' aria-expanded={!!commands.length} aria-controls={commands.length ? 'room-command-suggestions' : undefined} aria-activedescendant={active >= 0 ? `room-command-${active}` : undefined} maxLength={1000} value={text} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={e => { setText(e.target.value); setActive(-1); setSuggest(true); }} onKeyDown={e => {
                if (!commands.length)
                    return;
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setSuggest(false);
                    setActive(-1);
                }
                else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActive(e.key === 'ArrowDown' ? (active + 1) % commands.length : (active <= 0 ? commands.length - 1 : active - 1));
                }
                else if (e.key === 'Tab' || e.key === 'Enter' && active >= 0) {
                    e.preventDefault();
                    complete(active >= 0 ? active : 0);
                }
            }}/><button className='primary' aria-label='发送消息' disabled={busy || !text.trim()}><Send size={16}/></button></form>
 </>}
 </aside></>;
}
