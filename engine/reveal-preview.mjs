import { effectiveIcons, effectiveDefense } from './rounds.mjs';
import { cardHasKeyword, spiritPreventsDamage, enterTapped } from './derived.mjs';
// Read-only projection of the new face-up object, before entry/reveal triggers.
// It is exposed only to the player who may inspect this hidden card.
export function paidRevealPreview(s, id) {
    const l = s.locations[id];
    const next = { ...s, locations: { ...s.locations, [id]: { ...l, faceDown: false,
                zoneVersion: l.zoneVersion + 1, fieldVersion: (l.fieldVersion ?? l.zoneVersion) + 1,
                counters: {}, markers: 0, wounds: 0, damage: 0 } } };
    return { entersTapped: !!l.tapped || enterTapped(next, id, l.district), icons: effectiveIcons(next, id), defense: effectiveDefense(next, id),
        reputation: cardHasKeyword(next, id, '声望'), battleDamagePrevented: spiritPreventsDamage(next, id) };
}
