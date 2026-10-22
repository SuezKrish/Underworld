import { RETIRED_CARD_IDS } from './card-relations.mjs';
import { offlineCardAllowed, usesOfflineCards } from './card-profile-policy.mjs';
export const defaultPoolSettings = () => ({ disabledCards: [], disabledSets: [], });
export function isPoolAdmin(user, ownerId) { return typeof ownerId === 'string' && !!ownerId.trim() && typeof user?.userId === 'string' && user.userId === ownerId; }
export function normalizePoolSettings(value = {}) {
    const out = defaultPoolSettings();
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw Error('卡牌池启用设置无效');
    for (const key of ['disabledCards', 'disabledSets']) {
        const ids = value[key] ?? [];
        if (!Array.isArray(ids) || ids.length > 2000 || ids.some(x => typeof x !== 'string' || !x.trim() || x.length > 200))
            throw Error('卡牌池启用设置无效');
        out[key] = [...new Set(ids)].sort();
    }
    return out;
}
export function cardAvailability(card, settings = {}) { const cardDisabled = RETIRED_CARD_IDS.has(card.id) || (settings.disabledCards ?? []).includes(card.id), disabledBySets = (card.sets ?? []).map(x => x.name).filter(x => (settings.disabledSets ?? []).includes(x)), profileDisabled = usesOfflineCards(settings) && !offlineCardAllowed(card); return { enabled: !cardDisabled && !disabledBySets.length && !profileDisabled, cardDisabled, disabledBySets, profileDisabled }; }
export function enabledCards(cards, settings) { return cards.filter(c => cardAvailability(c, settings).enabled); }
export function changeAvailability(settings, cards, command) {
    if (typeof command.enabled !== 'boolean')
        throw Error('请明确选择启用或禁用');
    const next = normalizePoolSettings(settings);
    let key, id;
    if (command.type === 'set-card-availability') {
        key = 'disabledCards';
        id = command.cardId;
        if (!cards.some(c => c.id === id))
            throw Error('卡牌不存在');
    }
    else if (command.type === 'set-set-availability') {
        key = 'disabledSets';
        id = command.setName;
        if (!cards.some(c => c.sets.some(s => s.name === id)) && !(command.enabled && next.disabledSets.includes(id)))
            throw Error('扩展不存在');
    }
    else
        throw Error('启用设置操作无效');
    next[key] = command.enabled ? next[key].filter(x => x !== id) : [...new Set([...next[key], id])].sort();
    return next;
}
export function poolSetSummary(cards, settings) { const names = [...new Set([...cards.flatMap(c => c.sets.map(s => s.name)), ...(settings.disabledSets ?? [])])].sort(); return names.map(name => { const rows = cards.filter(c => c.sets.some(s => s.name === name)); return { name, enabled: !settings.disabledSets.includes(name), total: rows.length, enabledCount: enabledCards(rows, settings).length }; }); }
export function requireCurrentPool(room, revision) {
    if (room.status === 'waiting' && (room.cardPoolRevision ?? 0) !== revision)
        throw Error('卡牌池启用设置已更新，请重新创建房间后开始对局');
}
