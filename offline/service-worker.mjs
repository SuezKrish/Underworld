import { OfflineService } from './service.mjs';
import { deviceStorage } from './storage.mjs';
import xml from '../data/Card.xml?raw';
const ready = deviceStorage().then(store => new OfflineService(xml, store));
// Report initialization failures to the request that needs the service.
ready.catch(() => { });
self.addEventListener('message', async ({ data }) => {
    try {
        const service = await ready, response = await service.request(data.path, data.method, data.body, data.headers);
        self.postMessage({ id: data.id, status: response.status, headers: [...response.headers], body: await response.text() });
    }
    catch (error) {
        self.postMessage({ id: data.id, error: error.message ?? '离线操作失败' });
    }
});
