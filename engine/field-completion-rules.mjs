import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { scoreValue } from './scoring.mjs';
export function battleDamageRecipient(s, id) {
    const l = s.locations[id];
    if (l?.zone !== 'play' || l.faceDown)
        return false;
    return hasCardType(s.cards[id], 'character') || !!printedRulesCard(s, id)?.automation?.battleDamageable;
}
export function taskForceBonusActive(s, id, c = printedRulesCard(s, id)) {
    const l = s.locations[id];
    if (l?.zone !== 'play' || l.faceDown || c?.automation?.static !== 'execution-task-force')
        return false;
    const p = controllerOf(s, id), name = s.societies?.[p]?.name ?? s.deckSelections?.[p]?.society?.name;
    const score = q => (s.players[q].scoreCards ?? []).reduce((n, c) => n + scoreValue(c), 0);
    return name === 'S．P．T．执行部' || score(p) < score(1 - p);
}
