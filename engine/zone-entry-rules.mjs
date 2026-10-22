import { deckWasShuffled } from './deck-shuffle-events.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { randomValues } from './random.mjs';
// Shared reincarnation rule, applied only after an actual zone change.
export function reincarnateAfterEntry(s, id, event, group, ctx) {
    if (!['grave-entry', 'headquarters-entry', 'sealed'].includes(event) || !printedRulesCard(s, id)?.automation?.reincarnates || !['graveyard', 'headquarters', 'sealed'].includes(s.locations[id]?.zone))
        return;
    const p = s.cards[id].owner;
    if (!ctx.move(s, id, 'deck'))
        return;
    const a = s.players[p].deck;
    for (let i = a.length - 1; i > 0; i--) {
        const range = i + 1, limit = 0x100000000 - 0x100000000 % range;
        let n;
        do {
            n = randomValues(new Uint32Array(1))[0];
        } while (n >= limit);
        const j = n % range;
        [a[i], a[j]] = [a[j], a[i]];
    }
    deckWasShuffled(a);
    ctx.log(s, s.cards[id].name + '洗回其拥有者的牌库。');
}
