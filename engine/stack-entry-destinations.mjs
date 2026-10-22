import { cardHasKeyword } from './derived.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
// Display-only destinations. Choosing where to play/reveal a character does
// not target the district and must not produce targeting events or counters.
export function stackEntryDestinations(s) {
    const districts = {};
    for (const a of s.flow?.stack ?? []) {
        if (!['play-character', 'reveal-character'].includes(a.kind))
            continue;
        const c = printedRulesCard(s, a.cardId), l = s.locations[a.cardId];
        if (!hasCardType(c, 'character') || !l)
            continue;
        if (a.kind === 'play-character' && l.zone !== 'stack')
            continue;
        if (a.kind === 'reveal-character' && (l.zone !== 'play' || !l.faceDown || l.zoneVersion !== a.sourceZoneVersion))
            continue;
        // Chaos selects its district only during entry, even when the submitted
        // command contained a district or only one district is currently legal.
        if (cardHasKeyword(s, a.cardId, '混乱'))
            continue;
        const index = a.kind === 'reveal-character' ? l.district : a.district, d = s.districts?.[index];
        if (!Number.isInteger(index) || !d)
            continue;
        (districts[d.id] ??= []).push({ entryId: a.id, cardId: a.cardId, name: a.displayName ?? c.name, kind: a.kind });
    }
    return districts;
}
