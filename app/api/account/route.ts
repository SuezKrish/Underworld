import { getChatGPTUser } from '../../chatgpt-auth';
import { poolAdmin } from '../../../lib/pool-admin';
import { json } from '../rooms/route';
export const dynamic = 'force-dynamic';
export async function GET() {
    const user = await getChatGPTUser();
    if (!user)
        return json({ error: '请先登录' }, 401);
    return json({ userId: user.userId, displayName: user.displayName, canManagePool: await poolAdmin() });
}
