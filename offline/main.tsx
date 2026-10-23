import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import Cards from '../app/cards/page';
import Decks from '../app/decks/page';
import Revisions from '../app/card-revisions/page';
import { BackgroundProvider } from '../app/background-settings';
import { createServiceClient } from './service-client.mjs';
import '../app/globals.css';
import './offline.css';
import '../app/mobile.css';
(window as any).__HIDDEN_WORLD_OFFLINE__ = true;
document.body.classList.add('offline-mode');
if ((window as any).OfflineDevice)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => (window as any).OfflineDevice.copyText(text) } });
async function start() {
    const service = createServiceClient(new Worker(new URL('./service-worker.mjs', import.meta.url), { type: 'module' })), original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
        const request = input instanceof Request ? input : null, url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
        if (url.origin !== location.origin)
            return Response.json({ error: '离线版不连接外部服务' }, { status: 403 });
        if (url.pathname.startsWith('/api/') || url.pathname === '/__local-test-accounts') {
            const body = init?.body ? JSON.parse(String(init.body)) : request && request.method !== 'GET' ? await request.json() : {};
            return service.request(url.pathname + url.search, init?.method ?? request?.method ?? 'GET', body, init?.headers ?? request?.headers ?? {}, init?.signal ?? request?.signal);
        }
        return original(input, init);
    };
    const Page = location.pathname === '/cards' ? Cards : location.pathname === '/decks' ? Decks : location.pathname === '/card-revisions' ? Revisions : Home;
    createRoot(document.getElementById('root')!).render(<BackgroundProvider><Page /></BackgroundProvider>);
}
start().catch(e => { document.getElementById('root')!.textContent = '离线版启动失败：' + e.message; });
