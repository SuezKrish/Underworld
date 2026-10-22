import { controllerOf } from './ownership.mjs';
import { liveSealHost } from './sealing.mjs';
import { triggerDisplayName } from './trigger-display.mjs';
import { stackEntryLabel } from './stack-display.mjs';
// Match UI identities, not target legality. A barrier or a changed condition
// cannot remove a declared target while responses are still being played.
function publicCardId(s, id, viewer, version, faceDown) {
    const l = s.locations[id];
    if (!l || version !== undefined && l.zoneVersion !== version || faceDown !== undefined && !!l.faceDown !== faceDown)
        return null;
    if (l.zone === 'play' && l.faceDown && controllerOf(s, id) !== viewer)
        return `hidden:${l.hiddenHandle}`;
    if (l.zone === 'sealed' && l.faceDown && s.cards[id]?.owner !== viewer)
        return `sealed:${l.hiddenHandle ?? id}`;
    if (l.zone === 'hand' && !s.players[viewer]?.hand.includes(id) || l.zone === 'deck')
        return null;
    return id;
}
function publicTargetId(s, t, viewer) {
    if (t.kind === 'stack')
        return s.flow.stack.some(a => a.id === t.entryId) ? `stack:${t.entryId}` : null;
    if (t.kind === 'host') {
        if (!liveSealHost(s, t.ref))
            return null;
        return t.ref.kind === 'district' ? t.ref.hostId.slice(14) : t.ref.kind === 'society' ? t.ref.hostId : publicCardId(s, t.ref.hostId, viewer);
    }
    if (t.kind === 'society')
        return `society:${t.player}`;
    if (t.kind === 'player')
        return `player:${t.player}`;
    if (t.kind === 'district') {
        const id = t.cardId ?? t.id;
        return s.districts[t.district]?.id === id ? id : null;
    }
    if (t.kind === 'card')
        return publicCardId(s, t.cardId ?? t.id, viewer, t.zoneVersion ?? t.version, t.faceDown);
    return null;
}
export function currentTargetingView(s, viewer) {
    const byObject = {};
    const entries = [...(s.flow?.stack ?? []).map((a, i) => ({ a, status: 'stack', position: s.flow.stack.length - i })),
        ...(s.pendingTriggers ?? []).map(a => ({ a, status: 'pending' }))];
    for (const { a, status, position } of entries) {
        if (a.plan?.nonTargeted)
            continue;
        // Legacy rumor triggers store their declared target directly. Other effect
        // targetId fields also describe self-effects and must not be inferred here.
        const targets = a.targets ?? (a.effect?.kind === 'seal-from-graveyard' && a.targetId ?
            [{ kind: 'card', cardId: a.targetId, zoneVersion: a.targetZoneVersion }] : []);
        const sourceId = a.cardId ?? a.sourceId, l = s.locations[sourceId];
        let name = a.displayName ?? triggerDisplayName(s, a);
        if (l?.secretPlan && controllerOf(s, sourceId) !== viewer)
            name = '秘密计划';
        else if (l?.zone === 'play' && l.faceDown && controllerOf(s, sourceId) !== viewer) {
            const actualName = s.cards[sourceId]?.name;
            name = actualName ? name.replaceAll(actualName, '暗藏者') : '暗藏者';
        }
        const source = { id: `stack:${a.id}`, name: stackEntryLabel({ ...a, displayName: name, cardType: s.cards[sourceId]?.type }), controller: a.controller, controllerName: s.seats[a.controller]?.name ?? '', status, ...(position ? { position } : {}), kind: a.kind };
        for (const id of new Set(targets.map(t => publicTargetId(s, t, viewer)).filter(Boolean))) {
            byObject[id] ??= [];
            if (!byObject[id].some(x => x.id === source.id))
                byObject[id].push(source);
        }
    }
    return byObject;
}
