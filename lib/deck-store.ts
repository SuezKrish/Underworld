import {headers} from 'next/headers';
import {deckStorageOwner} from './deck-owner.mjs';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { playCatalog } from './play-catalog';
import { validateDeck } from '../engine/decks.mjs';
import { prepareMatchDeck, prepareCodeDeck } from '../engine/match-deck.mjs';
export async function deckOwner() { const user = await getChatGPTUser(); return deckStorageOwner(user?.userId, (await headers()).get('host')); }
export async function deckContext() { const { doc, policy, cards, compiled } = await playCatalog(); return { cards, compiled, revision: doc.revision, poolRevision: policy.revision, implemented: new Set(compiled.map((c: any) => c.catalogId)) }; }
export function deckPayload(row: any, ctx: any) { const validation = validateDeck(JSON.parse(row.document), ctx.cards, ctx.implemented); return { id: row.id, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at, ...validation.deck, validation }; }
export async function deckRow(id: string, owner: string) { return env.DB!.prepare('SELECT * FROM decks WHERE id=? AND owner_id=?').bind(id, owner).first<any>(); }
export async function matchDeck(id: unknown, owner: string | null) {
    if (typeof id !== 'string' || !owner)
        throw Error('请先登录并选择已保存卡组');
    const row = await deckRow(id, owner);
    if (!row)
        throw Error('卡组不存在或不属于当前用户');
    return prepareMatchDeck(JSON.parse(row.document), await deckContext(), row.revision);
}
export async function matchDeckSelection(input: {
    deckId?: unknown;
    deckCode?: unknown;
}, required = false) {
    const hasCode = input.deckCode !== undefined && input.deckCode !== null && input.deckCode !== '';
    if (hasCode && input.deckId)
        throw Error('请选择卡组代码或已保存卡组中的一种');
    if (hasCode)
        return prepareCodeDeck(input.deckCode, await deckContext());
    if (input.deckId)
        return matchDeck(input.deckId, await deckOwner());
    if (required)
        throw Error('请导入卡组代码，或登录并选择已保存卡组');
    return null;
}
