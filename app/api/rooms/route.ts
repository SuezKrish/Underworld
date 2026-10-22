import { touchRoomActivity } from '../../../engine/room-timeout.mjs';
import { botOpeningFirstPlayer } from '../../../engine/opening-order.mjs';
import { getBotProfile } from '../../../engine/bot-deck.mjs';
import { runBot } from '../../../engine/bot.mjs';
import { hasCardType } from '../../../engine/card-types.mjs';
import { env } from 'cloudflare:workers';
import { normalizeTriggerTiming } from '../../../engine/trigger-timing.mjs';
import { createRoomState, joinSeat, viewFor } from '../../../engine/match.mjs';
import { playCatalog } from '../../../lib/play-catalog';
import { matchDeckSelection } from '../../../lib/deck-store';
import { isInitialSociety } from '../../../engine/decks.mjs';
import { profileCompiledCards } from '../../../engine/play-card-profile.mjs';
import { serializeRoomState } from '../../../engine/room-storage.mjs';
export const dynamic = 'force-dynamic';
export const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function hashToken(token: string) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); }
export function randomToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x => x.toString(16).padStart(2, '0')).join(''); }
export function validateName(name: unknown) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 24)
        throw new Error('昵称需要1至24个字符');
    return name.trim();
}
export function sameOrigin(request: Request) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
        throw new Error('请在平台页面内操作');
}
export async function POST(request: Request) {
    try {
        sameOrigin(request);
        const body = await request.json() as Record<string, any>;
        if (body.manualWithoutConsent !== undefined && typeof body.manualWithoutConsent !== 'boolean')
            throw Error('手动操作确认设置无效');
        const name = validateName(body.name), token = randomToken();
        const botProfile = body.opponentBot === undefined ? null : getBotProfile(body.opponentBot);
        if (body.opponentBot !== undefined && !botProfile)
            throw Error('BOT类型无效');
        const againstBot = !!botProfile;
        if (!againstBot && body.botOpeningOrder !== undefined)
            throw Error('先后手设置仅适用于BOT对局');
        const openingFirstPlayer = againstBot ? botOpeningFirstPlayer(body.botOpeningOrder, 1) : null;
        if (body.botDifficulty !== undefined && !['normal', 'hard'].includes(body.botDifficulty))
            throw Error('BOT难度无效');
        const difficulty = body.botDifficulty === 'hard' ? 'hard' : 'normal';
        const mode = againstBot || ['automation-play', 'constructed-play'].includes(body.mode) ? 'automation-play' : 'round-play';
        if (mode === 'round-play' && (body.deckId || body.deckCode))
            return json({ error: '文字流程测试不使用构筑卡组' }, 400);
        const selection = await matchDeckSelection(againstBot && !body.deckId && !body.deckCode ? { deckCode: botProfile!.deckCode } : body, againstBot || body.mode === 'constructed-play');
        const botSelection = againstBot ? await matchDeckSelection({ deckCode: botProfile!.deckCode }, true) : null;
        const { cards: catalog, allCards, compiled, environment, policy } = await playCatalog();
        if (selection && selection.poolRevision !== policy.revision || botSelection && botSelection.poolRevision !== policy.revision)
            return json({ error: '卡牌池启用设置已更新，请重新选择卡组' }, 409);
        if (body.societyId !== undefined && !catalog.some((c: any) => c.id === body.societyId && isInitialSociety(c)))
            return json({ error: '请选择可作为初始秘社的牌' }, 400);
        const cards = mode === 'automation-play' ? compiled : [];
        if (!selection && body.societyId === 'MSBQ02' && (mode !== 'automation-play' || !compiled.some((c: any) => c.catalogId === body.coreId && c.subtitle === '修格斯' && c.automation?.coreAbility)))
            return json({ error: '修格斯请使用真实卡牌模式，并选择已启用的核心角色' }, 400);
        if (mode === 'automation-play' && !cards.length)
            return json({ error: '当前卡牌池没有通过审核的可自动结算卡牌' }, 400);
        const reserveSources = [...allCards.filter((c: any) => /^TK/.test(c.id) && true)];
        const systemCompiled = profileCompiledCards(reserveSources, policy.settings);
        const reserve = reserveSources.map((c: any) => ({ catalogId: c.id, name: c.name, displayName: c.displayName, text: c.text, type: c.typeLine, printedCost: c.token ? 0 : Number(c.printedCost), faction: c.faction, magicDomains: c.magic === '无' ? [] : [c.magic], subtitle: c.subtitle, flavorText: c.flavorText, automated: !!cards.find((x: any) => x.catalogId === c.id), ...(compiled.find((x: any) => x.catalogId === c.id) ?? systemCompiled.find((x: any) => x.catalogId === c.id)) }));
        const state: any = createRoomState(name, await hashToken(token), mode, cards, reserve, environment, normalizeTriggerTiming(body.triggerTiming));
        state.openingFirstPlayer = openingFirstPlayer;
        const initial = catalog.find((c: any) => c.id === 'MSJC09' && isInitialSociety(c)) ?? catalog.find(isInitialSociety);
        if (!initial)
            return json({ error: '当前卡牌池没有启用的初始秘社' }, 400);
        touchRoomActivity(state);
        state.labCoreIds = [typeof body.coreId === 'string' ? body.coreId : null, null];
        state.labSocietyIds = [typeof body.societyId === 'string' ? body.societyId : initial.id, initial.id];
        state.cardNamePool = catalog.map((c: any) => ({ name: c.name, magicDomains: c.magic === '无' ? [] : [c.magic] }));
        state.characterNames = [...new Set(catalog.filter((c: any) => hasCardType(c, 'character')).map((c: any) => c.name))];
        state.cardPoolRevision = policy.revision;
        state.worldCardCount = catalog.filter((c: any) => c.type === '地区').length;
        if (state.worldCardCount < 3)
            return json({ error: '新建对局需要至少启用3张地区牌' }, 400);
        state.manualWithoutConsent = body.manualWithoutConsent === true || !!botSelection && body.manualWithoutConsent !== false;
        state.deckRequired = body.mode === 'constructed-play';
        if (selection) {
            state.deckSelections = [selection, null];
        }
        if (botSelection) {
            state.deckRequired = true;
            state.deckSelections[1] = botSelection;
            joinSeat(state, botProfile!.name + (difficulty === 'hard' ? '（困难）' : ''), await hashToken(randomToken()));
            state.bot = { id: botProfile!.id, seat: 1, difficulty, pending: false, actionKeys: [] };
            runBot(state);
        }
        for (let i = 0; i < 3; i++) {
            const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            const code = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(x => alphabet[x % 32]).join('');
            const result = await env.DB!.prepare('INSERT OR IGNORE INTO rooms (code,state,revision,created_at) VALUES (?,?,0,?)').bind(code, serializeRoomState(state), Date.now()).run();
            if (result.meta.changes)
                return json({ token, room: viewFor(state, 0, 0, code) }, 201);
        }
        return json({ error: '房间创建繁忙，请重试' }, 503);
    }
    catch (e) {
        console.error('Room creation failed', e instanceof Error ? e.message : 'unknown');
        return json({ error: e instanceof Error ? e.message : '暂时无法创建房间' }, 400);
    }
}
