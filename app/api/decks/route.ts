import { env } from 'cloudflare:workers';
import { json, sameOrigin } from '../rooms/route';
import { normalizeDeck } from '../../../engine/decks.mjs';
import { deckOwner, deckContext, deckPayload } from '../../../lib/deck-store';
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const owner = await deckOwner();
        if (!owner)
            return json({ error: '请先登录后管理卡组' }, 401);
        const ctx = await deckContext(), r = await env.DB!.prepare('SELECT * FROM decks WHERE owner_id=? ORDER BY updated_at DESC').bind(owner).all<any>();
        return json({ decks: r.results.map(row => deckPayload(row, ctx)) });
    }
    catch {
        return json({ error: '暂时无法读取卡组' }, 503);
    }
}
export async function POST(request: Request) {
    try {
        sameOrigin(request);
        const owner = await deckOwner();
        if (!owner)
            return json({ error: '请先登录后保存卡组' }, 401);
        if (Number(request.headers.get('content-length')) > 100000)
            return json({ error: '卡组文件过大' }, 413);
        const body = await request.json() as any, deck = normalizeDeck(body), ctx = await deckContext(), id = crypto.randomUUID(), now = Date.now(), document = JSON.stringify(deck);
        await env.DB!.prepare('INSERT INTO decks (id,owner_id,document,revision,created_at,updated_at) VALUES (?,?,?,0,?,?)').bind(id, owner, document, now, now).run();
        return json({ deck: deckPayload({ id, document, revision: 0, created_at: now, updated_at: now }, ctx) }, 201);
    }
    catch (e) {
        return json({ error: e instanceof Error ? e.message : '保存失败' }, 400);
    }
}
