import { printedRulesCard } from './printed-rules.mjs';
import { attachmentHostLegal } from './derived.mjs';
// Looking at/predicting cards is distinct from searching a library. This rule
// is checked before revealing search options and again before moving a card.
export function librarySearchBlocked(s) {
    return s.players.flatMap(p => p.play).some(id => {
        const l = s.locations[id], c = printedRulesCard(s, id);
        return l?.zone === 'play' && !l.faceDown && c.automation?.librarySearchBlock &&
            (!c.attachment || attachmentHostLegal(s, id));
    });
}
