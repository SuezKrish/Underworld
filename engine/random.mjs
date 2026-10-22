// Commands are synchronous. A scoped transcript resumes interrupted cost
// choices without rerolling earlier shuffles, selections, or object IDs.
let active = null;
export function withRandomTranscript(tape, fn) {
    const previous = active;
    active = { tape, index: 0 };
    try {
        return fn();
    }
    finally {
        active = previous;
    }
}
function entry(kind, shape, make) {
    if (!active)
        return make();
    const i = active.index++, saved = active.tape[i];
    if (saved) {
        if (saved.kind !== kind || saved.shape !== shape)
            throw Error('随机结算记录不一致');
        return saved.value;
    }
    const value = make();
    active.tape.push({ kind, shape, value });
    return value;
}
export function uuid() { return entry('uuid', '', () => crypto.randomUUID()); }
export function randomValues(array) { const values = entry('values', array.constructor.name + ':' + array.length, () => Array.from(crypto.getRandomValues(array))); array.set(values); return array; }
