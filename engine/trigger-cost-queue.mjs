// Capture the event-time price; the cost-payment engine flushes death triggers
// together while all declared sacrifices are still on the battlefield.
export function deferTriggerCost(s, a) {
    if (!s.eventGroup?.startsWith('cost:'))
        return false;
    s.deferredTriggerCosts ??= [];
    s.deferredTriggerCosts.push(structuredClone({ ...a, ...(s.costTriggerParent ? { triggerAfter: s.costTriggerParent } : {}) }));
    return true;
}
export function flushTriggerCosts(s, activate, { force = false, batch = false, activateBatch } = {}) {
    if (s.eventGroup?.startsWith('cost:') && !force || s.flushingTriggerCosts && !force)
        return;
    const previous = s.flushingTriggerCosts;
    s.flushingTriggerCosts = true;
    try {
        while (s.deferredTriggerCosts?.length) {
            const first = s.flow.stepOwner ?? s.turn?.firstPlayer ?? 0;
            const eligible = force ? s.deferredTriggerCosts.filter(a => a.group === s.eventGroup) : s.deferredTriggerCosts;
            if (!eligible.length)
                break;
            const a = eligible.find(a => a.controller === first) ?? eligible[0];
            const selected = batch && a.kind === 'auto-ability' ? eligible.filter(x => x.kind === 'auto-ability' && x.controller === a.controller && x.group === a.group && x.triggerAfter === a.triggerAfter) : [a];
            const ids = new Set(selected.map(a => a.id));
            s.deferredTriggerCosts = s.deferredTriggerCosts.filter(a => !ids.has(a.id));
            if (selected.length > 1 && activateBatch)
                activateBatch(s, selected);
            else
                for (const a of selected)
                    activate(s, a);
        }
        if (!s.deferredTriggerCosts?.length)
            delete s.deferredTriggerCosts;
    }
    finally {
        if (previous)
            s.flushingTriggerCosts = previous;
        else
            delete s.flushingTriggerCosts;
    }
}
