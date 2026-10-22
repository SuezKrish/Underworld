export const DEFAULT_ROOM_TIMEOUT_MINUTES = 30;
export const ROOM_TIMEOUT_OPTIONS = [15, 30, 60, null];
export const defaultRoomSettings = () => ({ idleTimeoutMinutes: DEFAULT_ROOM_TIMEOUT_MINUTES });
export function normalizeRoomSettings(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw Error('房间超时设置无效');
    const minutes = value.idleTimeoutMinutes === undefined ? DEFAULT_ROOM_TIMEOUT_MINUTES : value.idleTimeoutMinutes;
    if (!ROOM_TIMEOUT_OPTIONS.includes(minutes))
        throw Error('请选择15分钟、30分钟、60分钟或取消');
    return { idleTimeoutMinutes: minutes };
}
