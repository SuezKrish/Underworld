const normalized = name => String(name ?? '').replace(/\*\*/g, '').normalize('NFC').trim();
export function printedNameIdentity(card) {
    // Same-name faces retain the physical card's bold-name identity.
    const front = card.cardForm?.original;
    const displayName = front?.catalogId && front.name === card.name ? front.displayName : card.displayName;
    const parts = [...(displayName ?? '').matchAll(/\*\*([^*]+)\*\*/g)].map(m => m[1]);
    return normalized(parts.length ? parts.join('') : card.name);
}
export function uniqueIdentity(card) {
    return card.unique === true || card.unique === 1 ? printedNameIdentity(card) : null;
}
// Fixed names written by card effects accept a unique card's bold identity.
// Player-declared names and comparisons between two card names stay exact.
export function matchesSpecifiedName(card, name) {
    if (!card)
        return false;
    const expected = normalized(name);
    return expected !== '' && (normalized(card.name) === expected || printedNameIdentity(card) === expected);
}
// Explicit “名称包含” clauses search the complete printed name instead.
export function matchesCardNameFilter(card, filter = {}) {
    return (!filter.name || matchesSpecifiedName(card, filter.name)) &&
        (!filter.nameIncludes || normalized(card?.name).includes(normalized(filter.nameIncludes)));
}
