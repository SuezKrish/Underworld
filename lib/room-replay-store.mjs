import { packReplayFrames } from '../engine/replay.mjs';
const create = 'CREATE TABLE IF NOT EXISTS room_replays (code TEXT NOT NULL, revision INTEGER NOT NULL, part INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(code,revision,part))';
export async function ensureReplayTable(db) { await db.prepare(create).run(); }
// An atomic batch ties every replay part to the successful room CAS. A failed
// CAS inserts nothing; changes() propagates that result through the batch.
export async function updateRoomWithReplay(db, row, state, frames) {
    await ensureReplayTable(db);
    const chunk = packReplayFrames(frames), text = chunk ? JSON.stringify(chunk) : '', parts = [];
    const chars = Array.from(text);
    for (let i = 0; i < chars.length; i += 150000)
        parts.push(chars.slice(i, i + 150000).join(''));
    const sql = [db.prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE code=? AND revision=?').bind(state, row.code, row.revision), ...parts.map((text, i) => db.prepare('INSERT INTO room_replays(code,revision,part,document) SELECT ?,?,?,? WHERE changes()=1').bind(row.code, row.revision + 1, i, text))];
    const results = await db.batch(sql);
    return results[0];
}
export async function readRoomReplay(db, code) {
    await ensureReplayTable(db);
    const rows = await db.prepare('SELECT revision,part,document FROM room_replays WHERE code=? ORDER BY revision,part').bind(code).all();
    const groups = new Map();
    for (const row of rows.results ?? [])
        groups.set(row.revision, (groups.get(row.revision) ?? '') + row.document);
    return { version: 1, chunks: [...groups.values()].map(text => JSON.parse(text)) };
}
export async function deleteRoomReplay(db, code) { await ensureReplayTable(db); await db.prepare('DELETE FROM room_replays WHERE code=?').bind(code).run(); }
