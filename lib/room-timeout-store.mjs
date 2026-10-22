import { deserializeRoomState, serializeRoomState } from '../engine/room-storage.mjs';
import { expireIdleRoom } from '../engine/room-timeout.mjs';
import { currentRoomSettings, ROOM_SETTINGS_ID } from './room-settings-store.mjs';
// The revision comparison makes expiration race safely with a player's action.
export async function expireStoredRoom(db, row, now = Date.now()) {
    const state = deserializeRoomState(row.state);
    state.createdAt ??= row.created_at;
    const policy = await currentRoomSettings(db);
    if (!expireIdleRoom(state, now, policy.settings.idleTimeoutMinutes))
        return { ...row, roomState: state };
    const serialized = serializeRoomState(state);
    // A concurrent cancellation or longer deadline must also win against cleanup.
    const result = await db.prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE code=? AND revision=? AND COALESCE((SELECT revision FROM card_pool_settings WHERE id=?),0)=?').bind(serialized, row.code, row.revision, ROOM_SETTINGS_ID, policy.revision).run();
    return result.meta.changes ? { ...row, state: serialized, revision: row.revision + 1, roomState: state } : db.prepare('SELECT * FROM rooms WHERE code=?').bind(row.code).first();
}
export async function expireInactiveRooms(db, now = Date.now()) {
    const policy = await currentRoomSettings(db), minutes = policy.settings.idleTimeoutMinutes;
    if (minutes === null)
        return;
    // Load one full state at a time; finished rooms never match again.
    const rows = await db.prepare("SELECT code FROM rooms WHERE json_extract(state,'$.status')='playing' AND COALESCE(json_extract(state,'$.lastActivityAt'),json_extract(state,'$.logs[#-1].at'),created_at)<=? ORDER BY created_at LIMIT 100").bind(now - minutes * 60 * 1000).all();
    for (const candidate of rows.results) {
        const row = await db.prepare('SELECT * FROM rooms WHERE code=?').bind(candidate.code).first();
        if (row)
            await expireStoredRoom(db, row, now);
    }
}
