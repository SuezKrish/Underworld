import { battleDamageRecipient } from './field-completion-rules.mjs';
import { effectiveDefense } from './rounds.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { attachmentHostLegal } from './derived.mjs';
export function woundsPrevented(s, id) {
    return Object.entries(s.locations).some(([aid, l]) => l.zone === 'play' && !l.faceDown && l.attachedTo === id && l.hostVersion === s.locations[id]?.zoneVersion && printedRulesCard(s, aid)?.attachment?.preventWounds && attachmentHostLegal(s, aid));
}
// Creating a new wound is distinct from transferring existing counters.
// Wounds lower defense; they never emit an ordinary damage event.
export function addWounds(s, id, amount, { event, group, details = {}, markerOrigin, damageKind = 'effect' } = {}) {
    const l = s.locations[id];
    if (amount <= 0 || l?.zone !== 'play' || l.faceDown || !(hasCardType(s.cards[id], 'character') || damageKind === 'battle' && battleDamageRecipient(s, id)) || woundsPrevented(s, id))
        return 0;
    const before = effectiveDefense(s, id) - (l.damage ?? 0);
    setCardMarker(s, l, "wounds", null, (l.wounds ?? 0) + amount, { origin: markerOrigin });
    if (before > 0 && effectiveDefense(s, id) - (l.damage ?? 0) <= 0)
        l.lethalChange = { kind: 'wound', damageKind };
    event?.(s, id, 'wounded', l, group, { amount, ...details });
    return amount;
}
