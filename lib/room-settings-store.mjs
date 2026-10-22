import { normalizeRoomSettings, defaultRoomSettings } from '../engine/room-settings.mjs';
// Separate document and revision: changing idle cleanup must not invalidate
// deck selections or waiting rooms' card-pool snapshots.
export const ROOM_SETTINGS_ID = 'room-timeout';
export async function currentRoomSettings(db) {
    const row = await db.prepare('SELECT document,revision,updated_at FROM card_pool_settings WHERE id=?').bind(ROOM_SETTINGS_ID).first();
    return { settings: normalizeRoomSettings(row ? JSON.parse(row.document) : {}), revision: row?.revision ?? 0, updatedAt: row?.updated_at ?? 0 };
}
export async function updateRoomSettings(db, body) {
    if (!body || typeof body !== 'object' || !Object.hasOwn(body, 'idleTimeoutMinutes'))
        throw Error('请明确选择房间超时时限');
    const settings = normalizeRoomSettings(body), current = await currentRoomSettings(db);
    if (body.revision !== current.revision)
        throw Error('房间超时设置已更新，请刷新后重试');
    await db.prepare('INSERT OR IGNORE INTO card_pool_settings (id,document,revision,updated_at) VALUES (?,?,0,0)').bind(ROOM_SETTINGS_ID, JSON.stringify(defaultRoomSettings())).run();
    const now = Date.now(), result = await db.prepare('UPDATE card_pool_settings SET document=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(settings), now, ROOM_SETTINGS_ID, current.revision).run();
    if (!result.meta.changes)
        throw Error('房间超时设置已更新，请刷新后重试');
    return { settings, revision: current.revision + 1, updatedAt: now };
}
