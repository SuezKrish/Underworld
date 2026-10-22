import { captureReplay } from '../../../../engine/replay.mjs';
import { updateRoomWithReplay, readRoomReplay, deleteRoomReplay } from '../../../../lib/room-replay-store.mjs';
import { touchRoomActivity } from '../../../../engine/room-timeout.mjs';
import { roomRecord } from '../../../../engine/match-record.mjs';
import { expireStoredRoom } from '../../../../lib/room-timeout-store.mjs';
import { runBot } from '../../../../engine/bot.mjs';
import { env } from 'cloudflare:workers';
import { command, joinSeat, viewFor } from '../../../../engine/match.mjs';
import { serializeRoomState, deserializeRoomState } from '../../../../engine/room-storage.mjs';
import { RuleError } from '../../../../engine/core.mjs';
import { currentPoolSettings } from '../../../../lib/pool-settings-store';
import { requireCurrentPool } from '../../../../engine/card-pool.mjs';
import { matchDeckSelection } from '../../../../lib/deck-store';
import { hashToken, json, randomToken, sameOrigin, validateName } from '../route';
export const dynamic = 'force-dynamic';
type Context = {
    params: Promise<{
        code: string;
    }>;
};
async function getRow(code: string) {
    if (!/^[A-Z2-9]{8}$/.test(code))
        return null;
    const row = await env.DB!.prepare('SELECT * FROM rooms WHERE code=?').bind(code).first<{
        code: string;
        state: string;
        revision: number;
        created_at: number;
    }>();
    return row ? expireStoredRoom(env.DB!, row) : null;
}
async function actor(request: Request, state: any) {
    const h = request.headers.get('authorization');
    if (!h?.startsWith('Bearer ') || h.length !== 71)
        return -1;
    const hash = await hashToken(h.slice(7));
    return state.seats.findIndex((seat: any) => seat?.hash === hash);
}
export async function GET(request: Request, context: Context) {
    try {
        const { code } = await context.params, row = await getRow(code);
        if (!row)
            return json({ error: '房间不存在' }, 404);
        const state = row.roomState ?? deserializeRoomState(row.state), p = await actor(request, state);
        if (p < 0)
            return json({ error: '座位凭证无效，请通过邀请码加入房间' }, 403);
        if (new URL(request.url).searchParams.get('record') === '1')
            return json({ ...roomRecord(state, code, state.createdAt ?? row.created_at), ...(state.status === 'finished' ? { replay: await readRoomReplay(env.DB!, code) } : {}) });
        const view = viewFor(state, p, row.revision, code);
        return json({ room: { ...view, logs: view.logs.slice(-200) } });
    }
    catch {
        return json({ error: '暂时无法读取房间' }, 503);
    }
}
export async function DELETE(request: Request, context: Context) {
    try {
        sameOrigin(request);
        const { code } = await context.params, row = await getRow(code);
        if (!row)
            return json({ error: '房间或记录已删除' }, 404);
        const state = row.roomState ?? deserializeRoomState(row.state), p = await actor(request, state);
        if (p < 0)
            return json({ error: '座位凭证无效' }, 403);
        if (p !== 0)
            return json({ error: '仅房间创建者可以删除整场记录' }, 403);
        if (state.manualRequest)
            return json({ error: '请先完成或取消待确认操作，再删除记录' }, 400);
        if (state.status !== 'finished')
            return json({ error: '请先结束房间，再删除记录' }, 400);
        const body = await request.json() as any;
        if (body.revision !== row.revision)
            return json({ error: '记录版本已更新，请同步后重试' }, 409);
        const result = await env.DB!.prepare('DELETE FROM rooms WHERE code=? AND revision=?').bind(code, row.revision).run();
        if (result.meta.changes) {
            await deleteRoomReplay(env.DB!, code);
            return json({ deleted: true });
        }
        return json({ error: '记录版本已更新，请同步后重试' }, 409);
    }
    catch {
        return json({ error: '删除失败，请重试' }, 400);
    }
}
export async function POST(request: Request, context: Context) {
    try {
        sameOrigin(request);
        const { code } = await context.params, body = await request.json() as Record<string, any>;
        if (body.type === 'join') {
            const name = validateName(body.name), token = randomToken(), hash = await hashToken(token);
            const selection = await matchDeckSelection(body);
            for (let i = 0; i < 3; i++) {
                const row = await getRow(code);
                if (!row)
                    return json({ error: '房间不存在' }, 404);
                const state = row.roomState ?? deserializeRoomState(row.state), policy = await currentPoolSettings();
                requireCurrentPool(state, policy.revision, policy.settings);
                if (selection && selection.poolRevision !== policy.revision)
                    return json({ error: '卡牌池启用设置已更新，请重新选择卡组' }, 409);
                if (state.deckRequired && !selection)
                    return json({ error: '本房间使用构筑卡组，请导入卡组代码或选择已保存卡组' }, 400);
                if (selection && state.mode !== 'automation-play')
                    return json({ error: '文字测试房间不能使用真实构筑卡组' }, 400);
                joinSeat(state, name, hash);
                if (body.societyId !== undefined && !state.environmentCatalog?.some((c: any) => c.catalogId === body.societyId && c.initialSelectable))
                    return json({ error: '请选择本房间资料中可作为初始秘社的牌' }, 400);
                if (typeof body.societyId === 'string') {
                    state.labSocietyIds ??= ['MSJC09', 'MSJC09'];
                    state.labSocietyIds[1] = body.societyId;
                }
                if (selection) {
                    state.deckSelections ??= [null, null];
                    state.deckSelections[1] = selection;
                }
                touchRoomActivity(state);
                const result = await env.DB!.prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE code=? AND revision=?').bind(serializeRoomState(state), code, row.revision).run();
                if (result.meta.changes)
                    return json({ token, room: viewFor(state, 1, row.revision + 1, code) });
            }
            return json({ error: '座位已发生变化，请重试' }, 409);
        }
        const row = await getRow(code);
        if (!row)
            return json({ error: '房间不存在' }, 404);
        const state = row.roomState ?? deserializeRoomState(row.state), p = await actor(request, state);
        if (p < 0)
            return json({ error: '座位凭证无效' }, 403);
        if (state.result?.kind === 'idle-timeout')
            return json({ error: state.result.reason ?? '对局已因超时无操作而结束', room: viewFor(state, p, row.revision, code) }, 410);
        if (typeof body.id !== 'string' || body.id.length > 80 || !body.id.length)
            return json({ error: '操作编号无效' }, 400);
        if (state.recentCommands.includes(body.id))
            return json({ room: viewFor(state, p, row.revision, code) });
        if (body.revision !== row.revision)
            return json({ error: '房间刚刚更新，请同步后重试' }, 409);
        if (['trigger-choice', 'trigger-order', 'environment-trigger', 'abyss-trigger'].includes(body.type))
            return json({ error: '触发界面已更新，请刷新页面后批量确认本轮触发' }, 400);
        if (body.type === 'ready' && state.status === 'waiting' && !state.seats[p]?.ready) {
            const policy = await currentPoolSettings();
            requireCurrentPool(state, policy.revision, policy.settings);
        }
        let noChange = false;
        const { frames } = captureReplay(state, () => {
            if (body.type === 'bot-tick') {
                if (!state.bot || p === state.bot.seat)
                    return json({ error: '当前房间没有可驱动的BOT' }, 400);
                const result = runBot(state);
                if (!result.actions && !result.blocked) {
                    noChange = true;
                    return;
                }
            }
            else {
                command(state, p, body);
                runBot(state);
            }
        });
        if (noChange)
            return json({ room: viewFor(state, p, row.revision, code) });
        if (body.type !== 'bot-tick')
            touchRoomActivity(state);
        state.recentCommands = [...state.recentCommands, body.id].slice(-128);
        const result = await updateRoomWithReplay(env.DB!, row, serializeRoomState(state), frames);
        if (!result.meta.changes)
            return json({ error: '另一个操作已先完成，请同步后重试' }, 409);
        return json({ room: viewFor(state, p, row.revision + 1, code) });
    }
    catch (e) {
        if (e instanceof RuleError)
            return json({ error: e.message }, 400);
        console.error('Room action failed', e instanceof Error ? e.message : 'unknown');
        return json({ error: e instanceof Error ? e.message : '操作失败，请稍后重试' }, 400);
    }
}
