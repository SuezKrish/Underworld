import { hardDeckShuffled } from './hard-bot-library.mjs';
import { recordPlayerEvent } from './field-events.mjs';
// Commands are synchronous, including interrupted-choice replay. Inspect the
// current deck identity, so shuffling a revealed subset/world deck is distinct
// from an actual player-library shuffle, even when it has zero or one card.
let activeState = null;
export function withDeckShuffleEvents(s, fn) {
    const previous = activeState;
    activeState = s;
    try {
        return fn();
    }
    finally {
        activeState = previous;
    }
}
export function deckWasShuffled(cards) {
    const s = activeState;
    if (!s)
        return;
    const player = s.players.findIndex(p => p.deck === cards);
    if (player >= 0) {
        hardDeckShuffled(s, player);
        recordPlayerEvent(s, player, 'deck-shuffled');
    }
}
