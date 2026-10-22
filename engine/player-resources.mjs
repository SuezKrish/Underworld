import { recordPlayerEvent } from './field-events.mjs';
// Record each real gain/payment separately, including changes within one effect.
export function changeHonor(s, player, amount) {
    if (!amount)
        return s.players[player].honor ?? 0;
    const before = s.players[player].honor ?? 0;
    s.players[player].honor = before + amount;
    recordPlayerEvent(s, player, 'honor-changed', { before, after: before + amount, amount: Math.abs(amount), operation: amount > 0 ? 'gain' : 'pay' });
    return s.players[player].honor;
}
