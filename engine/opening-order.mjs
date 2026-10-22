import { RuleError } from './core.mjs';
import { randomValues } from './random.mjs';
// Room-creation preference only. Resolve player/Bot relative to the Bot seat;
// do not alter normal round-to-round initiative changes.
export function botOpeningFirstPlayer(order = 'random', botSeat = 1) {
    if (!['random', 'player', 'bot'].includes(order))
        throw new RuleError('BOT先后手设置无效');
    if (![0, 1].includes(botSeat))
        throw new RuleError('BOT座位无效');
    return order === 'random' ? null : order === 'bot' ? botSeat : 1 - botSeat;
}
export function chooseOpeningFirstPlayer(state) {
    const fixed = state.openingFirstPlayer;
    if (fixed === 0 || fixed === 1)
        return fixed;
    if (fixed !== null && fixed !== undefined)
        throw new RuleError('首回合先手设置无效');
    // 2 divides 2^32 exactly, so parity introduces no modulo bias.
    return randomValues(new Uint32Array(1))[0] % 2;
}
