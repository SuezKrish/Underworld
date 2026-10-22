const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const ownKeys = v => Object.keys(v).filter(k => v[k] !== undefined);
function delta(from, to) {
    const changes = { set: [], remove: [] };
    function visit(a, b, path) {
        if (Object.is(a, b))
            return;
        if (object(a) && object(b)) {
            for (const k of ownKeys(a))
                if (!Object.hasOwn(b, k) || b[k] === undefined)
                    changes.remove.push([...path, k]);
            for (const k of ownKeys(b))
                if (!Object.hasOwn(a, k) || a[k] === undefined)
                    changes.set.push([[...path, k], b[k]]);
                else
                    visit(a[k], b[k], [...path, k]);
        }
        else if (JSON.stringify(a) !== JSON.stringify(b))
            changes.set.push([path, b]);
    }
    visit(from, to, []);
    return changes;
}
function parentAt(state, path) {
    if (!Array.isArray(path) || !path.length || !path.every(k => typeof k === 'string'))
        throw Error('撤销历史路径无效');
    let parent = state;
    for (const k of path.slice(0, -1)) {
        if (!object(parent) || !Object.hasOwn(parent, k))
            throw Error('撤销历史路径不存在');
        parent = parent[k];
    }
    if (!object(parent))
        throw Error('撤销历史对象无效');
    return parent;
}
function apply(base, changes) {
    const state = structuredClone(base);
    for (const path of changes.remove) {
        const parent = parentAt(state, path);
        delete parent[path.at(-1)];
    }
    for (const [path, value] of changes.set) {
        const parent = parentAt(state, path);
        Object.defineProperty(parent, path.at(-1), { value: structuredClone(value), writable: true, enumerable: true, configurable: true });
    }
    return state;
}
// Newest checkpoint is relative to the current room, each older checkpoint
// to the next newer one. Dropping the oldest frame never breaks this chain.
// Engine callers still receive complete snapshots after loading a room.
export function packUndoFrames(frames, base) {
    const packed = Array(frames.length);
    let next = base;
    for (let i = frames.length - 1; i >= 0; i--) {
        const f = frames[i];
        packed[i] = { ...f, state: { __undoDeltaV1: delta(next, f.state) } };
        next = f.state;
    }
    return packed;
}
export function unpackUndoFrames(frames, base) {
    const restored = Array(frames.length);
    let next = base;
    for (let i = frames.length - 1; i >= 0; i--) {
        const f = frames[i], state = f.state?.__undoDeltaV1 ? apply(next, f.state.__undoDeltaV1) : f.state;
        restored[i] = { ...f, state };
        next = state;
    }
    return restored;
}
