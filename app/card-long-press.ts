// A long press opens the existing card menu; swiping remains a scroll gesture.
let users = 0, dispose: (() => void) | undefined;
export function enableCardLongPress() {
    if (users++ === 0) {
        let timer: ReturnType<typeof setTimeout> | undefined, start: {
            x: number;
            y: number;
        } | undefined, suppressClickUntil = 0, suppressedTarget: Element | null = null;
        const cancel = () => {
            if (timer)
                clearTimeout(timer);
            timer = undefined;
            start = undefined;
        };
        const down = (e: PointerEvent) => {
            cancel();
            if (e.pointerType !== 'touch' || !(e.target instanceof Element))
                return;
            const target = e.target.closest('[aria-haspopup="menu"]');
            if (!target)
                return;
            const x = e.clientX, y = e.clientY;
            start = { x, y };
            timer = setTimeout(() => { timer = undefined; start = undefined; suppressClickUntil = Date.now() + 1200; suppressedTarget = target; target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y })); }, 550);
        };
        const move = (e: PointerEvent) => {
            if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12)
                cancel();
        };
        const click = (e: MouseEvent) => {
            if (Date.now() < suppressClickUntil && e.target instanceof Node && suppressedTarget?.contains(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                suppressClickUntil = 0;
                suppressedTarget = null;
            }
        };
        document.addEventListener('pointerdown', down, { passive: true });
        document.addEventListener('pointermove', move, { passive: true });
        document.addEventListener('pointerup', cancel, { passive: true });
        document.addEventListener('pointercancel', cancel, { passive: true });
        document.addEventListener('click', click, true);
        dispose = () => { cancel(); document.removeEventListener('pointerdown', down); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', cancel); document.removeEventListener('pointercancel', cancel); document.removeEventListener('click', click, true); };
    }
    return () => {
        if (--users === 0) {
            dispose?.();
            dispose = undefined;
        }
    };
}
