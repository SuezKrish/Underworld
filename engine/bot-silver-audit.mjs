// Evaluation evidence only. This observes resolved commands and cannot alter
// either player's policy, private information or game state.
export function auditSilverTransitions(before, after, command, metrics) {
    for (let p = 0; p < 2; p++)
        for (const id of before.players[p]?.play ?? []) {
            if (before.cards[id]?.catalogId !== 'XG01' || before.locations[id].faceDown)
                continue;
            const old = before.locations[id], loc = after.locations[id], kept = loc?.zone === 'play' && !loc.faceDown && after.players[p].play.includes(id);
            if (kept && loc.zoneVersion === old.zoneVersion)
                continue;
            const top = command.type === 'pass' ? before.flow.stack.at(-1) : null;
            const cause = kept ? 'blink' : loc?.zone === 'play' && !loc.faceDown ? 'control-change' : command.type === 'return-district' ? 'region-return' :
                command.type === 'assign-damage' ? 'combat-damage' : loc?.faceDown ? 'concealed' : loc?.zone === 'hand' ? 'returned-to-hand' : loc?.zone ?? 'removed';
            const cards = before.players[p].hand.map(cid => before.cards[cid]);
            (metrics[p].silverTransitions ??= []).push({ round: before.round, phase: before.turn?.phase, window: before.turn?.step, contest: before.turn?.kind,
                silverId: id, district: old.district, cause, command: command.type, source: before.cards[top?.cardId]?.catalogId, sourceController: top?.controller,
                destination: loc?.zone, controller: loc?.controller, remainingEngines: after.players[p].play.filter(cid => after.cards[cid]?.catalogId === 'XG01' && !after.locations[cid].faceDown).length,
                pool: before.players[p].costPool, untappedAssets: before.players[p].assets.filter(a => !a.tapped).length,
                heldResponses: cards.filter(c => ['JZ05', 'JC078', 'XQ04', 'WM008', 'JC006'].includes(c.catalogId)).map(c => c.catalogId),
                logs: after.logs.slice(before.logs.length).map(l => l.text) });
        }
}
