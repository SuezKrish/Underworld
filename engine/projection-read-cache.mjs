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
function entryFor(s) {
    let entry = projection.get(s);
    if (!entry) {
        entry = { values: new Map(), layer: 'ordinary' };
        projection.set(s, entry);
    }
    return entry;
}
// Nisos evaluates defense with its own silence temporarily excluded. Those
// results belong to a separate projection layer and must never escape into
// the ordinary text/keyword evaluation, or vice versa.
export function withProjectionDefenseLayer(s, fn) {
    if (!projection)
        return fn();
    const entry = entryFor(s), previous = entry.layer;
    entry.layer = 'defense';
    try {
        return fn();
    }
    finally {
        entry.layer = previous;
    }
}
export function projectionRead(s, key, compute) {
    if (!projection)
        return compute();
    const entry = entryFor(s), layerKey = entry.layer + ':' + key;
    if (entry.values.has(layerKey))
        return entry.values.get(layerKey);
    const value = compute();
    entry.values.set(layerKey, value);
    return value;
}
