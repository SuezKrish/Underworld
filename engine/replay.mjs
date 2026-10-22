import { knownInformation } from './match-record.mjs';
import { effectiveIcons, effectiveDefense } from './rounds.mjs';
import { packUndoFrames, unpackUndoFrames } from './undo-history-codec.mjs';
// Capture is request-scoped and never part of authoritative state, undo, or Bot views.
const captures = new WeakMap(), undoHints = new WeakMap();
export function markReplayUndo(s) { undoHints.set(s, true); }
export function transferReplayUndo(from, to) {
    if (undoHints.has(from)) {
        undoHints.delete(from);
        undoHints.set(to, true);
    }
}
const turnKeys = ['phase', 'step', 'firstPlayer', 'district', 'kind', 'extraBattle'];
const zones = ['hand', 'play', 'graveyard', 'headquarters', 'assets', 'aside', 'core', 'scoreCards'];
const pick = (value, keys) => Object.fromEntries(keys.filter(k => value?.[k] !== undefined).map(k => [k, structuredClone(value[k])]));
export function replayProjection(s) {
    const info = knownInformation(s), cards = Object.fromEntries(info.cards.map(c => [c.id, { ...c, ...(c.zone === 'play' ? { effectiveIcons: effectiveIcons(s, c.id), effectiveDefense: effectiveDefense(s, c.id) } : {}) }]));
    return { triggerTiming: s.triggerTiming ?? 'legacy', cursor: s.replayCursor, round: s.round, status: s.status, turn: pick(s.turn, turnKeys), priority: s.flow?.priority, logId: s.logs.at(-1)?.id ?? 0, worldDeckCount: info.worldDeckCount, cards,
        players: info.players.map(p => ({ ...pick(p, ['name', 'markers', 'honor', 'costPool', 'score', 'deckCount']), ...Object.fromEntries(zones.map(z => [z, p[z].map(c => c.id)])), coreAreaId: p.coreArea?.id })),
        societies: info.societies.map(c => c.id), districts: (s.districts ?? []).map(c => c?.id ?? null), sealed: info.sealed.map(c => c.id), stack: info.stack.map(({ card, ...a }) => a) };
}
export function recordReplayStep(s, player = null, command = { type: 'checkpoint' }) {
    const capture = captures.get(s);
    if (!capture || s.players?.length !== 2 || !['playing', 'finished'].includes(s.status))
        return;
    const rewind = undoHints.has(s);
    undoHints.delete(s);
    if (!s.replayCursor || command.type !== 'checkpoint' && !rewind)
        s.replayCursor = crypto.randomUUID();
    const state = replayProjection(s), key = JSON.stringify(state);
    if (key === capture.last && !rewind)
        return;
    capture.last = key;
    capture.frames.push({ state, cursor: s.replayCursor, logId: state.logId, round: state.round, ...(rewind ? { rewindTo: s.replayCursor } : {}), actor: player, action: command.type, at: Date.now() });
}
export function captureReplay(s, action) {
    if (captures.has(s))
        throw Error('重复回放记录器');
    captures.set(s, { frames: [], last: null });
    try {
        recordReplayStep(s);
        const value = action();
        recordReplayStep(s);
        return { value, frames: captures.get(s).frames };
    }
    finally {
        captures.delete(s);
    }
}
export function packReplayFrames(frames) {
    if (!frames.length)
        return null;
    const base = frames.at(-1);
    return { version: 1, base, previous: packUndoFrames(frames.slice(0, -1), base.state) };
}
export function unpackReplayChunk(chunk) {
    if (chunk?.version !== 1 || !chunk.base?.state || !Array.isArray(chunk.previous))
        throw Error('回放片段格式无效');
    return [...unpackUndoFrames(chunk.previous, chunk.base.state), structuredClone(chunk.base)];
}
export const replayLength = chunks => chunks.reduce((n, c) => n + (c.previous?.length ?? 0) + 1, 0);
const cardKeys = ['id', 'catalogId', 'name', 'displayName', 'type', 'subtypes', 'subtitle', 'faction', 'color', 'unique', 'token', 'printedCost', 'printedCostText', 'loyalty', 'magicDomains', 'icons', 'temporaryIcons', 'effectiveIcons', 'defense', 'effectiveDefense', 'text', 'faq', 'flavorText', 'keywords', 'traits', 'points', 'threshold', 'destroyed', 'influence', 'zone', 'controller', 'district', 'faceDown', 'secretPlan', 'tapped', 'counters', 'markers', 'timeMarkers', 'damage', 'wounds', 'attachedTo', 'hostId', 'hostVersion', 'zoneVersion', 'clubInfluence', 'owner', 'ownerName', 'controllerName'];
// Imported records are display data, never executable commands or engine states.
export function safeReplayFrame(raw) {
    if (!raw || !Array.isArray(raw.players) || raw.players.length !== 2 || !raw.cards || typeof raw.cards !== 'object')
        throw Error('回放场面格式无效');
    const cards = Object.fromEntries(Object.entries(raw.cards).filter(([id, c]) => c && typeof c === 'object' && !['deck', 'world-deck'].includes(c.zone) && typeof c.name === 'string').map(([id, c]) => [id, { ...pick(c, cardKeys), id }]));
    const ids = v => Array.isArray(v) ? v.filter(id => typeof id === 'string' && Object.hasOwn(cards, id)) : [];
    return { ...pick(raw, ['triggerTiming', 'cursor', 'round', 'status', 'priority', 'logId', 'worldDeckCount']), turn: pick(raw.turn, turnKeys), cards,
        players: raw.players.map(p => ({ ...pick(p, ['name', 'markers', 'honor', 'costPool', 'score', 'deckCount']), ...Object.fromEntries(zones.map(z => [z, ids(p[z])])), coreAreaId: Object.hasOwn(cards, p.coreAreaId) ? p.coreAreaId : undefined })),
        societies: ids(raw.societies), districts: (raw.districts ?? []).map(id => Object.hasOwn(cards, id) ? id : null), sealed: ids(raw.sealed), stack: (raw.stack ?? []).map(a => ({ ...pick(a, ['id', 'kind', 'controller', 'cardId', 'sourceId', 'displayName', 'abilityLabel']), targets: (a.targets ?? []).map(t => pick(t, ['kind', 'cardId', 'district', 'player', 'entryId'])) })) };
}
export function normalizeReplayRecord(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.logs) || !Array.isArray(data.players) || data.players.length !== 2)
        throw Error('请选择平台导出的对局 JSON 文件');
    if (data.status !== 'finished')
        throw Error('仅支持播放已结束的对局');
    const chunks = data.replay?.chunks ?? [];
    if (!Array.isArray(chunks) || chunks.length > 20000 || chunks.some(c => c?.version !== 1 || !c.base?.state || !Array.isArray(c.previous) || c.previous.length > 1000))
        throw Error('回放数据格式无效');
    const logs = data.logs.filter(l => l && typeof l.text === 'string').map(l => pick(l, ['id', 'text', 'round', 'phase', 'step', 'kind', 'player', 'at']));
    return { format: 'under-world-record', version: 2, code: typeof data.code === 'string' ? data.code : '导入记录', status: 'finished', players: data.players.map(p => ({ name: typeof p?.name === 'string' ? p.name : '玩家' })), ...pick(data, ['createdAt', 'endedAt', 'result', 'rulesVersion', 'triggerTiming', 'complete']), logs, replay: { version: 1, chunks } };
}
// References keep playback memory bounded to the currently decoded chunk.
// Undo cursors remove the abandoned branch and its logs before playback starts.
export function replayTimeline(chunks, logs = []) {
    let entries = [], positions = new Map(), previousLogId = 0, partial = false;
    for (const [chunkIndex, chunk] of chunks.entries()) {
        const records = [...chunk.previous, chunk.base];
        let legacy = null;
        for (const [localIndex, record] of records.entries()) {
            if (record.logId === undefined)
                legacy ??= unpackReplayChunk(chunk);
            const logId = record.logId ?? legacy[localIndex].state.logId ?? 0, cursor = record.cursor ?? `legacy:${chunkIndex}:${localIndex}`;
            const logIds = logs.filter(l => l.id > previousLogId && l.id <= logId).map(l => l.id);
            previousLogId = logId;
            if (record.rewindTo) {
                const at = positions.get(record.rewindTo);
                if (at !== undefined) {
                    entries = entries.slice(0, at + 1);
                    positions = new Map(entries.map((e, i) => [e.cursor, i]));
                    continue;
                }
                entries = [];
                positions = new Map();
                partial = true;
                logIds.length = 0;
            }
            if (entries.at(-1)?.cursor === cursor)
                continue;
            positions.set(cursor, entries.length);
            entries.push({ chunkIndex, localIndex, cursor, logId, logIds });
        }
    }
    return { entries, logIds: new Set(entries.flatMap(e => e.logIds)), partial };
}
