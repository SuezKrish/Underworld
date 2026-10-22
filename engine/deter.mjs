import { influenceRemovalOptions } from './club-influence.mjs';
// Older saved rooms could be paused on the former, incorrect deck inspection.
// Preserve the choice ID so the next poll and command agree on the correction.
export function migrateLegacyDeterChoice(s) {
    const x = s.effectChoice;
    if (!['reality-restrain', 'criminal-restrain'].includes(x?.kind))
        return;
    const player = 1 - x.spell.controller, count = x.kind === 'reality-restrain' ? 1 : 2, options = influenceRemovalOptions(s, player);
    s.effectChoice = { ...x, kind: 'batch-deter', controller: player, cardIds: [], options: options.length ? options : [{ id: 'none', name: '没有势力标志，结束遏制' }], remaining: count, legacyDeter: true, choiceLabel: `遏制${count} · 移除本方势力标志` };
}
