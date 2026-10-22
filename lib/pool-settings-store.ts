import { env } from 'cloudflare:workers';
import { normalizePoolSettings, changeAvailability, defaultPoolSettings } from '../engine/card-pool.mjs';
export async function currentPoolSettings() { const row = await env.DB!.prepare('SELECT document,revision,updated_at FROM card_pool_settings WHERE id=?').bind('global').first<any>(); return { settings: normalizePoolSettings(row ? JSON.parse(row.document) : {}), revision: row?.revision ?? 0, updatedAt: row?.updated_at ?? 0 }; }
export async function updatePoolSettings(cards: any[], body: any) {
    const current = await currentPoolSettings();
    if (body.settingsRevision !== current.revision)
        throw Error('卡牌池启用设置已更新，请刷新后重试');
    const settings = changeAvailability(current.settings, cards, body), now = Date.now();
    await env.DB!.prepare('INSERT OR IGNORE INTO card_pool_settings (id,document,revision,updated_at) VALUES (?,?,0,0)').bind('global', JSON.stringify(defaultPoolSettings())).run();
    const r = await env.DB!.prepare('UPDATE card_pool_settings SET document=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(settings), now, 'global', current.revision).run();
    if (!r.meta.changes)
        throw Error('卡牌池启用设置已更新，请刷新后重试');
    return { settings, revision: current.revision + 1, updatedAt: now };
}
