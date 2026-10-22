export async function deviceStorage() {
    const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open('hidden-world-offline-v1', 3);
        r.onupgradeneeded = () => {
            for (const name of ['rooms', 'decks', 'saves', 'replays'])
                if (!r.result.objectStoreNames.contains(name))
                    r.result.createObjectStore(name, { keyPath: 'id' });
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
    function request(name, mode, action) { return new Promise((resolve, reject) => { const tx = db.transaction(name, mode), req = action(tx.objectStore(name)); let result; req.onsuccess = () => { result = req.result; }; tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? Error('本机存储已取消')); }); }
    return { get: (n, id) => request(n, 'readonly', s => s.get(id)), list: n => request(n, 'readonly', s => s.getAll()), put: (n, row) => request(n, 'readwrite', s => s.put(row)), delete: (n, id) => request(n, 'readwrite', s => s.delete(id)) };
}
