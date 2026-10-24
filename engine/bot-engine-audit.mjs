// Evaluation-only observations. This module never supplies information to a
// policy and never changes the room or its random-number stream.
const codes = new Set(['BQ030', 'JC034', 'BQ039', 'BQ031', 'BQ036', 'WM066', 'JZ64', 'JZ66']);
export function createEngineAudit() { return { events: [], samples: [] }; }
export function observeEngineStep(a, b, c, seat, audit) {
    if (!a.players?.[1] || !b.players?.[1])
        return;
    const oldStack = new Set((a.flow?.stack ?? []).map(x => x.id));
    for (const entry of b.flow?.stack ?? [])
        if (!oldStack.has(entry.id) && codes.has(b.cards[entry.cardId]?.catalogId) && entry.kind === 'auto-ability') {
            audit.events.push({ round: a.round, step: a.turn?.step, event: 'enqueued', source: b.cards[entry.cardId].catalogId, sourceId: entry.cardId, controller: entry.controller, trigger: entry.event, entryId: entry.id, eventCardId: entry.plan?.eventCardId, eventSubject: entry.plan?.eventSubject });
        }
    const choice = c.type === 'effect-choice' ? a.effectChoice?.spell : null;
    const top = c.type === 'pass' ? a.flow?.stack?.at(-1) : null;
    const resolved = top && !(b.flow?.stack ?? []).some(x => x.id === top.id) ? top : null;
    const source = choice ?? resolved, code = a.cards[source?.cardId]?.catalogId;
    if (codes.has(code)) {
        const drawn = [0, 1].map(p => b.players[p].hand.filter(id => a.players[p].deck.includes(id)).length);
        const discards = [0, 1].map(p => a.players[p].hand.filter(id => !b.players[p].hand.includes(id)).length);
        const discardChoice = choice && ['discard', 'discard-deck-discard', 'discard-deck-multiple'].includes(a.effectChoice.kind);
        audit.events.push({ round: a.round, step: a.turn?.step, event: choice ? 'choice' : 'resolved', source: code, sourceId: source.cardId, controller: source.controller, entryId: source.id, drawn, discarded: discardChoice ? discards : [0, 0], choice: a.effectChoice?.kind, trigger: source.event, tokens: b.players.flatMap(pl => pl.play).filter(id => b.cards[id]?.catalogId === 'TK005' && a.locations[id]?.zone !== 'play').length });
    }
    for (let p = 0; p < 2; p++)
        for (const id of a.players[p].play ?? []) {
            if (a.cards[id]?.catalogId !== 'BQ030' || a.locations[id].faceDown)
                continue;
            const l = b.locations[id];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === a.locations[id].zoneVersion)
                continue;
            audit.events.push({ round: a.round, step: a.turn?.step, event: 'arbiter-left', controller: p, sourceId: id, destination: l?.zone, damage: a.locations[id].damage ?? 0, district: a.locations[id].district, command: c.type });
        }
    for (const [id, card] of Object.entries(b.cards))
        if (card.catalogId === 'JZ66' && a.locations[id]?.zone !== b.locations[id]?.zone)
            audit.events.push({ event: 'hela-zone', round: b.round, sourceId: id, owner: card.owner, from: a.locations[id]?.zone, to: b.locations[id]?.zone, hostId: b.locations[id]?.hostId });
    const edge = a.round !== b.round || a.turn?.phase !== b.turn?.phase || a.turn?.step !== b.turn?.step;
    if (edge && ['action', 'contest', 'end', 'start'].includes(b.turn?.phase)) {
        audit.samples.push({ round: b.round, phase: b.turn.phase, step: b.turn.step, district: b.turn.district, kind: b.turn.kind, players: b.players.map((pl, p) => ({ hand: pl.hand.length, deck: pl.deck.length, assets: pl.assets.length, mana: (pl.costPool ?? 0) + pl.assets.filter(x => !x.tapped).length, play: pl.play.map(id => ({ id, code: b.cards[id]?.catalogId, d: b.locations[id].district, hidden: !!b.locations[id].faceDown, tapped: !!b.locations[id].tapped, attachedTo: b.locations[id].attachedTo })), handCodes: pl.hand.map(id => b.cards[id]?.catalogId) })) });
    }
}
