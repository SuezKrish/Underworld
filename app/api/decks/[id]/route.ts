import { env } from 'cloudflare:workers';
import { json, sameOrigin } from '../../rooms/route';
import { normalizeDeck } from '../../../../engine/decks.mjs';
import { deckOwner, deckContext, deckPayload, deckRow } from '../../../../lib/deck-store';
export const dynamic = 'force-dynamic';
type Context = {
    params: Promise<{
        id: string;
    }>;
};
export async function GET(request: Request, context: Context) {
    try {
        const owner = await deckOwner();
        if (!owner)
            return json({ error: '请先登录' }, 401);
        const { id } = await context.params, row = await deckRow(id, owner);
        if (!row)
            return json({ error: '卡组不存在' }, 404);
        return json({ deck: deckPayload(row, await deckContext()) });
    }
    catch {
        return json({ error: '暂时无法读取卡组' }, 503);
    }
}
export async function PUT(request: Request, context: Context) {
    try {
        sameOrigin(request);
        const owner = await deckOwner();
        if (!owner)
            return json({ error: '请先登录' }, 401);
        if (Number(request.headers.get('content-length')) > 100000)
            return json({ error: '卡组文件过大' }, 413);
        const { id } = await context.params, row = await deckRow(id, owner);
        if (!row)
            return json({ error: '卡组不存在' }, 404);
        const body = await request.json() as any;
        if (body.revision !== row.revision)
            return json({ error: '卡组已被另一窗口修改，请重新载入' }, 409);
        const document = JSON.stringify(normalizeDeck(body)), now = Date.now(), ctx = await deckContext();
        const r = await env.DB!.prepare('UPDATE decks SET document=?,updated_at=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=?').bind(document, now, id, owner, row.revision).run();
        if (!r.meta.changes)
            return json({ error: '卡组已更新，请重新载入' }, 409);
        return json({ deck: deckPayload({ ...row, document, updated_at: now, revision: row.revision + 1 }, ctx) });
    }
    catch (e) {
        return json({ error: e instanceof Error ? e.message : '保存失败' }, 400);
    }
}
export async function DELETE(request: Request, context: Context) {
    try {
        sameOrigin(request);
        const owner = await deckOwner();
        if (!owner)
            return json({ error: '请先登录' }, 401);
        const { id } = await context.params, row = await deckRow(id, owner);
        if (!row)
            return json({ error: '卡组不存在' }, 404);
        const body = await request.json() as any;
        if (body?.revision !== row.revision)
            return json({ error: '卡组已被另一窗口修改，请重新载入后删除' }, 409);
        const result = await env.DB!.prepare('DELETE FROM decks WHERE id=? AND owner_id=? AND revision=?').bind(id, owner, row.revision).run();
        if (!result.meta.changes)
            return json({ error: '卡组已更新，请重新载入后删除' }, 409);
        return json({ deletedId: id });
    }
    catch (e) {
        return json({ error: e instanceof Error ? e.message : '删除失败' }, 400);
    }
}
