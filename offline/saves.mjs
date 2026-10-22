import { serializeRoomState, deserializeRoomState } from '../engine/room-storage.mjs';
import { getBotProfile } from '../engine/bot-deck.mjs';
export const saveSummary = row => ({ id: row.id, name: row.name, savedAt: row.savedAt, round: row.round, status: row.status, opponent: row.opponent, player: row.player });
export function createSave(row, name) {
    const s = deserializeRoomState(row.state), label = String(name ?? '').trim();
    if (!label || label.length > 80)
        throw Error('存档名称需要1至80个字符');
    return { id: crypto.randomUUID(), format: 'underworld-save', version: 1, name: label, savedAt: Date.now(), round: s.round, status: s.status, opponent: s.seats[1].name, player: s.seats[0].name, state: serializeRoomState(s), createdAt: row.createdAt };
}
export function restoreSave(save, code, token) {
    if (save?.format !== 'underworld-save' || save.version !== 1 || typeof save.state !== 'string')
        throw Error('无法读取此版本的存档');
    const s = deserializeRoomState(save.state);
    if (!s.bot || s.bot.seat !== 1 || !getBotProfile(s.bot.id) || !Array.isArray(s.players) || (s.status !== 'waiting' && s.players.length !== 2) || !s.seats?.[0])
        throw Error('存档不是有效的离线Bot对局');
    // Restore into a new room; loading never overwrites a save or the current game.
    s.seats[0].hash = token;
    s.seats[1].hash = crypto.randomUUID();
    s.recentCommands = [];
    return { id: code, revision: 0, token, state: serializeRoomState(s), createdAt: save.createdAt };
}
