import { env } from 'cloudflare:workers';
import { poolAdmin } from '../../../lib/pool-admin';
import { currentRoomSettings, updateRoomSettings } from '../../../lib/room-settings-store.mjs';
import { json, sameOrigin } from '../rooms/route';
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        if (!await poolAdmin())
            return json({ error: '仅管理员可以管理房间超时设置' }, 403);
        return json(await currentRoomSettings(env.DB!));
    }
    catch {
        return json({ error: '暂时无法读取房间超时设置' }, 503);
    }
}
export async function POST(request: Request) {
    try {
        sameOrigin(request);
        if (!await poolAdmin())
            return json({ error: '仅管理员可以修改房间超时设置' }, 403);
        return json(await updateRoomSettings(env.DB!, await request.json()));
    }
    catch (e) {
        const error = e instanceof Error ? e.message : '房间超时设置保存失败';
        return json({ error }, error.includes('已更新') ? 409 : 400);
    }
}
