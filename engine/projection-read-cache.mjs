// Memoize only during a synchronous, read-only view construction. Never share
// derived rules between commands, state mutations or subsequent projections.
let projection = null;
export function withProjectionReads(fn) {
    if (projection)
        return fn();
    projection = new WeakMap();
    try {
        return fn();
    }
    finally {
        projection = null;
    }
}
export function projectionRead(s, key, compute) {
    if (!projection)
        return compute();
    let entry = projection.get(s);
    if (!entry) {
        // Nisos reads a separate, recursive defense layer. Its context must remain
        // uncached, including nested queries made while projecting that layer.
        entry = { values: new Map(), allowed: !s.players.some(p => p.play.some(id => !s.locations[id]?.faceDown && s.cards[id]?.automation?.static === 'nisos-silence')) };
        projection.set(s, entry);
    }
    if (!entry.allowed)
        return compute();
    if (entry.values.has(key))
        return entry.values.get(key);
    const value = compute();
    entry.values.set(key, value);
    return value;
}
