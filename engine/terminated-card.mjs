// Terminating an activated/triggered ability never moves its source. A real
// card play or paid reveal moves that same pending card to its owner's grave.
export function settleTerminatedCard(s, a, move) {
    if (!a || a.copied)
        return;
    const l = s.locations[a.cardId];
    if (['play-spell', 'play-character'].includes(a.kind) && l?.zone === 'stack')
        move(s, a.cardId, 'graveyard', { cause: 'termination' });
    else if (a.kind === 'reveal-character' && l?.zone === 'play' && l.faceDown && l.zoneVersion === a.sourceZoneVersion)
        move(s, a.cardId, 'graveyard', { cause: 'termination' });
}
