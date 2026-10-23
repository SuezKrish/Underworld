// The renderer only transports requests. Rules, Bot decisions and IndexedDB
// stay in the dedicated worker, including while an API request is pending.
export function createServiceClient(worker) {
    let sequence = 0, closed = false, failure = null;
    const pending = new Map();
    function fail(error) { failure = error; for (const job of pending.values())
        job.reject(error); pending.clear(); }
    worker.addEventListener('error', () => fail(Error('离线计算服务启动失败，请重新打开应用')));
    worker.addEventListener('messageerror', () => fail(Error('离线计算服务通信失败，请重新打开应用')));
    worker.addEventListener('message', ({ data }) => {
        const job = pending.get(data.id);
        if (!job)
            return;
        pending.delete(data.id);
        job.cleanup();
        if (data.error)
            job.reject(Error(data.error));
        else
            job.resolve(new Response(data.body, { status: data.status, headers: data.headers }));
    });
    return {
        request(path, method = 'GET', body = {}, headers = {}, signal) {
            if (closed || failure)
                return Promise.reject(failure ?? Error('离线计算服务已关闭'));
            if (signal?.aborted)
                return Promise.reject(signal.reason ?? new DOMException('请求已取消', 'AbortError'));
            return new Promise((resolve, reject) => {
                const id = ++sequence, abort = () => { pending.delete(id); reject(signal.reason ?? new DOMException('请求已取消', 'AbortError')); };
                const cleanup = () => signal?.removeEventListener('abort', abort);
                pending.set(id, { resolve, reject: error => { cleanup(); reject(error); }, cleanup });
                signal?.addEventListener('abort', abort, { once: true });
                try {
                    worker.postMessage({ id, path, method, body, headers: [...new Headers(headers)] });
                }
                catch (error) {
                    pending.delete(id);
                    cleanup();
                    reject(error);
                }
            });
        },
        close() { closed = true; fail(Error('离线计算服务已关闭')); worker.terminate(); },
    };
}
