// Headquarters is a distinct, public zone. Only its owner's printed graveyard
// references include both zones; opposing cards and public districts keep the grave.
export function referenceOwner(s, source) {
    return Number.isInteger(source) ? source : s.cards[source]?.owner ?? s.societies?.findIndex(c => c?.id === source);
}
const references = new WeakMap();
// Synchronous scope only; no transient reference is persisted in room state.
export function withGraveReference(s, source, fn) {
    const before = references.get(s), had = references.has(s);
    references.set(s, source);
    try {
        return fn();
    }
    finally {
        if (had)
            references.set(s, before);
        else
            references.delete(s);
    }
}
function current(s, fallback) { return references.has(s) ? references.get(s) : fallback; }
export function graveReferenceSource(s, fallback) { return current(s, fallback); }
export function graveZone(s, p, source = current(s, p)) { return s.players[p]?.headquartersActive && referenceOwner(s, source) === p ? 'headquarters' : 'graveyard'; }
export function graveZones(s, p, source = current(s, p)) { return graveZone(s, p, source) === 'headquarters' ? ['graveyard', 'headquarters'] : ['graveyard']; }
export function graveCards(s, p, source = current(s, p)) { return graveZones(s, p, source).flatMap(zone => s.players[p]?.[zone] ?? []); }
export function inGrave(s, id, source = current(s, s.cards[id]?.owner)) { const p = s.cards[id]?.owner; return p !== undefined && graveZones(s, p, source).includes(s.locations[id]?.zone); }
export function isGraveZone(s, zone) { const source = current(s, null), p = referenceOwner(s, source); return graveZones(s, p, source).includes(zone); }
export function graveEventName(s, event, details, source) {
    if (event === 'headquarters-entry' || event === 'headquarters-leave')
        return s.players[details.player]?.headquartersActive && referenceOwner(s, source) === details.player ? event.replace('headquarters', 'grave') : null;
    return event;
}
