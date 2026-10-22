const eventName = 'hw-decks-changed';
export function notifyDeckListChanged() {
    window.dispatchEvent(new Event(eventName));
    try {
        localStorage.setItem(eventName, crypto.randomUUID());
    }
    catch { }
}
export function watchDeckList(refresh: () => void) {
    const visibleRefresh = () => {
        if (document.visibilityState === 'visible')
            refresh();
    }, changed = (event: StorageEvent) => {
        if (event.key === eventName)
            visibleRefresh();
    };
    window.addEventListener(eventName, visibleRefresh);
    window.addEventListener('storage', changed);
    window.addEventListener('focus', visibleRefresh);
    document.addEventListener('visibilitychange', visibleRefresh);
    const timer = setInterval(visibleRefresh, 15000);
    return () => { clearInterval(timer); window.removeEventListener(eventName, visibleRefresh); window.removeEventListener('storage', changed); window.removeEventListener('focus', visibleRefresh); document.removeEventListener('visibilitychange', visibleRefresh); };
}
