import { DEFAULT_ROOM_TIMEOUT_MINUTES, normalizeRoomSettings } from './room-settings.mjs';
export const ROOM_IDLE_TIMEOUT_MS = DEFAULT_ROOM_TIMEOUT_MINUTES * 60 * 1000;
export function lastRoomActivity(s) {
    return s.lastActivityAt ?? [...(s.logs ?? [])].reverse().find(x => Number.isFinite(x.at))?.at ?? s.createdAt ?? 0;
}
export function touchRoomActivity(s, now = Date.now()) {
    s.lastActivityAt = now;
}
export function expireIdleRoom(s, now = Date.now(), timeoutMinutes = DEFAULT_ROOM_TIMEOUT_MINUTES) {
    const { idleTimeoutMinutes } = normalizeRoomSettings({ idleTimeoutMinutes: timeoutMinutes });
    if (idleTimeoutMinutes === null)
        return false;
    const deadline = lastRoomActivity(s) + idleTimeoutMinutes * 60 * 1000;
    if (s.status !== 'playing' || now < deadline)
        return false;
    s.status = 'finished';
    s.endedAt = deadline;
    s.result = { winner: null, reason: `连续${idleTimeoutMinutes}分钟无操作，自动结束对局`, round: s.round, kind: 'idle-timeout', idleTimeoutMinutes };
    s.flow.locked = true;
    s.undoFrames = [];
    s.keeperQueue = [];
    s.triggerChoices = [];
    s.pendingTriggers = [];
    s.damageQueue = [];
    for (const key of ['keeperContinuation', 'deathContinuation', 'triggerRound', 'deferredTriggerCosts', 'flushingTriggerCosts', 'costTriggerParent', 'effectBattle', 'utopiaQueue'])
        delete s[key];
    for (const key of ['roundChoice', 'effectChoice', 'ruleChoice', 'triggerOrderChoice', 'hidden', 'battle', 'damageChoice', 'manualRequest'])
        s[key] = null;
    s.manualSelections = {};
    s.privateInspections = {};
    if (s.bot) {
        s.bot.pending = false;
        s.bot.undoPaused = true;
    }
    s.logs.push({ id: (s.logs.at(-1)?.id ?? 0) + 1, text: `对局连续${idleTimeoutMinutes}分钟无操作，已自动结束，记录保留。`, at: deadline, round: s.round, phase: 'finished', step: null });
    return true;
}
