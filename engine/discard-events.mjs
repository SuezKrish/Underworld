import { uuid } from './random.mjs';
// One event per actual discard instruction, including additional costs and
// hand-limit discards. Graveyard-entry abilities still observe each card.
export function discardMany(s, ids, move, event, extra = {}) {
    const previous = s.discardBatch, batch = { cards: [], group: s.eventGroup ?? uuid(), requestedIds: [...ids] };
    s.discardBatch = batch;
    try {
        for (const id of ids)
            move(s, id, 'graveyard', extra);
    }
    finally {
        s.discardBatch = previous;
    }
    flushDiscardBatch(s, batch, event);
    if (!previous)
        delete s.discardBatch;
}
export function flushDiscardBatch(s, batch, event) {
    for (const player of [0, 1]) {
        const cards = batch.cards.filter(c => c.player === player);
        if (cards.length) {
            const c = cards[0];
            event(s, c.id, 'discard', c.loc, batch.group, { player, count: cards.length });
        }
    }
}
