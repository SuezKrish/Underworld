import { captureReplay, packReplayFrames } from '../engine/replay.mjs';
import { parseCatalog } from '../engine/catalog.mjs';
import { auditCatalog } from '../engine/audit.mjs';
import { compileSupported, automationStatus } from '../engine/automation.mjs';
import { compileEnvironment } from '../engine/environment-definitions.mjs';
import { validateDeck, normalizeDeck } from '../engine/decks.mjs';
import { prepareMatchDeck, prepareCodeDeck } from '../engine/match-deck.mjs';
import { BOT_PROFILES, getBotProfile } from '../engine/bot-deck.mjs';
import { botOpeningFirstPlayer } from '../engine/opening-order.mjs';
import { DEFAULT_TRIGGER_TIMING } from '../engine/trigger-timing.mjs';
import { createRoomState, joinSeat, command, viewFor } from '../engine/match.mjs';
import { runBot } from '../engine/bot.mjs';
import { serializeRoomState, deserializeRoomState } from '../engine/room-storage.mjs';
import { roomRecord } from '../engine/match-record.mjs';
import { hasCardType } from '../engine/card-types.mjs';
import { cardRevisionHistory } from '../engine/card-revision-history.mjs';
import { createSave, restoreSave, saveSummary } from './saves.mjs';
import { offlineCardVariant, offlineCompiledVariant, offlineEnvironmentVariant, offlineRevisionHistory } from './catalog-overrides.mjs';
import { offlineCardAllowed } from '../engine/card-profile-policy.mjs';
export { offlineCardAllowed };
const reply = (data, status = 200) => Response.json(data, { status });
const revision = 3;
async function replayRows(store, code) { return (await store.list('replays')).filter(r => r.code === code).sort((a, b) => a.revision - b.revision); }
export function offlineContext(xml) {
    const sourceCards = parseCatalog(xml).cards.filter(offlineCardAllowed), cards = sourceCards.map(offlineCardVariant), compiled = compileSupported(sourceCards).map(offlineCompiledVariant), implemented = new Set(sourceCards.filter(c => automationStatus(c).implemented).map(c => c.id));
    const incomplete = cards.filter(c => !implemented.has(c.id));
    if (incomplete.length)
        throw Error('离线卡池仍有未实现卡牌：' + incomplete.map(c => c.id).join('、'));
    return { sourceCards, cards, compiled, environment: compileEnvironment(sourceCards).map(offlineEnvironmentVariant), implemented, revision, poolRevision: revision };
}
// All persistence is injected: IndexedDB on devices, a memory store in tests.
// The same engine and BOT policies run locally; no API calls leave the device.
export class OfflineService {
    constructor(xml, store) { this.ctx = offlineContext(xml); this.store = store; this.queue = Promise.resolve(); }
    request(path, method = 'GET', body = {}, headers = {}) { const run = () => this.handle(path, method, body, headers).catch(e => reply({ error: e.message ?? '离线操作失败' }, 400)); const job = this.queue.then(run, run); this.queue = job.then(() => { }); return job; }
    deckRecord(row) { const validation = validateDeck(row.deck, this.ctx.cards, this.ctx.implemented); return { id: row.id, revision: row.revision, createdAt: row.createdAt, updatedAt: row.updatedAt, ...validation.deck, validation }; }
    async handle(path, method, body, headers) {
        const url = new URL(path, 'https://offline.underworld.local'), route = url.pathname;
        if (route === '/api/account')
            return reply({ userId: 'offline-local', displayName: '本机玩家' });
        if (route === '/__local-test-accounts')
            return reply({ local: false, profiles: [] });
        if (route === '/api/cards') {
            if (method !== 'GET')
                return reply({ error: '离线卡池不可修改' }, 403);
            const data = auditCatalog(this.ctx.sourceCards, this.ctx.sourceCards);
            data.cards = data.cards.map(offlineCardVariant);
            return reply({ ...data, canManagePool: false, sets: [...new Set(this.ctx.cards.flatMap(c => c.sets.map(s => s.name)))], revision, poolRevision: revision, worldCardCount: this.ctx.cards.filter(c => c.type === '地区').length, metadataSummary: { matchedCards: this.ctx.cards.length, uniqueCards: this.ctx.cards.filter(c => c.unique).length, subtitles: this.ctx.cards.filter(c => c.subtitle).length, flavors: this.ctx.cards.filter(c => c.flavorText).length }, removed: [], offline: true });
        }
        if (route === '/api/card-revisions')
            return reply({ ...offlineRevisionHistory(cardRevisionHistory(this.ctx.cards), this.ctx.cards), catalogRevision: revision });
        if (route === '/api/offline-saves') {
            if (method === 'GET')
                return reply({ saves: (await this.store.list('saves')).sort((a, b) => b.savedAt - a.savedAt).map(saveSummary) });
            if (method !== 'POST')
                return reply({ error: '不支持的操作' }, 405);
            const row = await this.store.get('rooms', body.code);
            if (!row)
                return reply({ error: '当前对局不存在' }, 404);
            if (new Headers(headers).get('authorization') !== `Bearer ${row.token}`)
                return reply({ error: '本机座位凭证无效' }, 403);
            if (body.revision !== row.revision)
                return reply({ error: '对局刚刚更新，请同步后重新存档' }, 409);
            const save = createSave(row, body.name);
            save.replayHistory = (await replayRows(this.store, row.id)).map(r => r.document);
            await this.store.put('saves', save);
            return reply({ save: saveSummary(save) }, 201);
        }
        if (route.startsWith('/api/offline-saves/')) {
            if (method !== 'POST')
                return reply({ error: '不支持的操作' }, 405);
            const save = await this.store.get('saves', route.slice('/api/offline-saves/'.length));
            if (!save)
                return reply({ error: '存档不存在' }, 404);
            const token = crypto.randomUUID(), code = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join(''), row = restoreSave(save, code, token);
            await this.store.put('rooms', row);
            for (const [i, document] of (save.replayHistory ?? []).entries()) {
                const revision = i - save.replayHistory.length;
                await this.store.put('replays', { id: `${code}:${revision}`, code, revision, document });
            }
            const s = deserializeRoomState(row.state);
            return reply({ token, room: viewFor(s, 0, 0, code) }, 201);
        }
        if (route === '/api/decks') {
            if (method === 'GET')
                return reply({ decks: (await this.store.list('decks')).sort((a, b) => b.updatedAt - a.updatedAt).map(r => this.deckRecord(r)) });
            if (method !== 'POST')
                return reply({ error: '不支持的操作' }, 405);
            const deck = normalizeDeck(body), row = { id: crypto.randomUUID(), deck, revision: 0, createdAt: Date.now(), updatedAt: Date.now() };
            if (!offlineCardAllowed({ id: deck.societyId }) || deck.cards.some(c => !this.ctx.cards.some(x => x.id === c.cardId)))
                return reply({ error: '卡组包含当前卡池以外的卡牌' }, 400);
            await this.store.put('decks', row);
            return reply({ deck: this.deckRecord(row) }, 201);
        }
        if (route.startsWith('/api/decks/')) {
            const id = route.slice(11), row = await this.store.get('decks', id);
            if (!row)
                return reply({ error: '卡组不存在' }, 404);
            if (method === 'DELETE') {
                await this.store.delete('decks', id);
                return reply({ deleted: true });
            }
            if (method === 'GET')
                return reply({ deck: this.deckRecord(row) });
            if (method !== 'PUT')
                return reply({ error: '不支持的操作' }, 405);
            if (body.revision !== row.revision)
                return reply({ error: '卡组版本已变化' }, 409);
            const deck = normalizeDeck(body);
            if (!this.ctx.cards.some(c => c.id === deck.societyId) || deck.cards.some(c => !this.ctx.cards.some(x => x.id === c.cardId)))
                return reply({ error: '卡组包含当前卡池以外的卡牌' }, 400);
            Object.assign(row, { deck, revision: row.revision + 1, updatedAt: Date.now() });
            await this.store.put('decks', row);
            return reply({ deck: this.deckRecord(row) });
        }
        if (route === '/api/rooms' && method === 'POST') {
            const profile = getBotProfile(body.opponentBot);
            if (!profile)
                return reply({ error: '离线版仅支持挑战 Bot' }, 400);
            const openingFirstPlayer = botOpeningFirstPlayer(body.botOpeningOrder, 1);
            const name = (typeof body.name === 'string' ? body.name.trim() : '') || '玩家';
            if (name.length > 24)
                return reply({ error: '昵称需要1至24个字符' }, 400);
            if (body.botDifficulty !== undefined && !['normal', 'hard'].includes(body.botDifficulty))
                return reply({ error: 'BOT难度无效' }, 400);
            const difficulty = body.botDifficulty === 'hard' ? 'hard' : 'normal';
            let selection;
            if (body.deckCode)
                selection = prepareCodeDeck(body.deckCode, this.ctx);
            else if (body.deckId) {
                const d = await this.store.get('decks', body.deckId);
                if (!d)
                    return reply({ error: '卡组不存在' }, 404);
                selection = prepareMatchDeck(d.deck, this.ctx);
            }
            else
                selection = prepareMatchDeck(profile.deck, this.ctx);
            const botSelection = prepareMatchDeck(profile.deck, this.ctx), token = crypto.randomUUID(), code = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join('');
            const cards = this.ctx.compiled, reserve = cards.filter(c => c.token), s = createRoomState(name, token, 'automation-play', cards, reserve, this.ctx.environment, DEFAULT_TRIGGER_TIMING);
            s.cardNamePool = this.ctx.cards.map(c => ({ name: c.name, magicDomains: c.magic === '无' ? [] : [c.magic] }));
            s.characterNames = [...new Set(this.ctx.cards.filter(c => hasCardType(c, 'character')).map(c => c.name))];
            s.openingFirstPlayer = openingFirstPlayer;
            s.cardPoolRevision = revision;
            s.worldCardCount = this.ctx.cards.filter(c => c.type === '地区').length;
            s.manualWithoutConsent = body.manualWithoutConsent !== false;
            s.deckRequired = true;
            s.deckSelections = [selection, botSelection];
            s.labSocietyIds = [selection.society.id, botSelection.society.id];
            joinSeat(s, profile.name + (difficulty === 'hard' ? '（困难）' : ''), crypto.randomUUID());
            s.bot = { id: profile.id, seat: 1, difficulty, pending: false, actionKeys: [] };
            runBot(s);
            const row = { id: code, revision: 0, token, state: serializeRoomState(s), createdAt: Date.now() };
            await this.store.put('rooms', row);
            return reply({ token, room: viewFor(s, 0, 0, code) }, 201);
        }
        if (route.startsWith('/api/rooms/')) {
            const code = route.slice(11), row = await this.store.get('rooms', code);
            if (!row)
                return reply({ error: '对局不存在' }, 404);
            if (new Headers(headers).get('authorization') !== `Bearer ${row.token}`)
                return reply({ error: '本机座位凭证无效' }, 403);
            const s = deserializeRoomState(row.state);
            if (method === 'GET') {
                if (url.searchParams.get('record') === '1')
                    return reply({ ...roomRecord(s, code, row.createdAt), ...(s.status === 'finished' ? { replay: { version: 1, chunks: (await replayRows(this.store, code)).map(r => r.document) } } : {}) });
                return reply({ room: viewFor(s, 0, row.revision, code) });
            }
            if (method === 'DELETE') {
                if (s.status !== 'finished')
                    return reply({ error: '请先结束对局' }, 400);
                await this.store.delete('rooms', code);
                for (const r of await replayRows(this.store, code))
                    await this.store.delete('replays', r.id);
                return reply({ deleted: true });
            }
            if (method !== 'POST')
                return reply({ error: '不支持的操作' }, 405);
            if (body.type === 'join')
                return reply({ error: '离线版不支持其他玩家加入' }, 403);
            if (s.recentCommands.includes(body.id))
                return reply({ room: viewFor(s, 0, row.revision, code) });
            if (body.revision !== row.revision)
                return reply({ error: '对局已更新，请重试' }, 409);
            const { frames } = captureReplay(s, () => {
                if (body.type !== 'bot-tick')
                    command(s, 0, body);
                runBot(s);
            });
            s.recentCommands = [...s.recentCommands, body.id].slice(-128);
            row.revision++;
            row.state = serializeRoomState(s);
            await this.store.put('rooms', row);
            const document = packReplayFrames(frames);
            if (document)
                await this.store.put('replays', { id: `${code}:${row.revision}`, code, revision: row.revision, document });
            return reply({ room: viewFor(s, 0, row.revision, code) });
        }
        return reply({ error: '离线版没有此功能' }, 404);
    }
}
export const offlineBots = BOT_PROFILES;
