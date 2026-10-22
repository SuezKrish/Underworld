const sharedKeys = a => [...((a.plan?.sharedOncePerRound || a.plan?.oncePerRound === 1) && a.plan.usageKey ? [`use:${a.plan.usageKey}`] : []), ...(a.plan?.tap ? [`tap:${a.cardId ?? a.plan.sourceId}:${a.plan.sourceZoneVersion ?? ''}`] : [])];
export function defaultTriggerEnabled(abilities, fire = true) {
    const seen = new Set();
    /** @type {Record<string,boolean>} */
    const out = {};
    for (const a of abilities) {
        const keys = sharedKeys(a), yes = a.pending || !a.unavailable && (a.mandatory || fire && !keys.some(key => seen.has(key)));
        out[a.id] = !!yes;
        if (yes)
            for (const key of keys)
                seen.add(key);
    }
    return out;
}
export function toggleTriggerEnabled(abilities, current, id, checked) {
    const next = { ...current, [id]: checked }, keys = sharedKeys(abilities.find(a => a.id === id) ?? {});
    if (checked && keys.length)
        for (const a of abilities)
            if (a.id !== id && !a.pending && !a.mandatory && sharedKeys(a).some(key => keys.includes(key)))
                next[a.id] = false;
    return next;
}
