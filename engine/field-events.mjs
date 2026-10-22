import { uuid } from './random.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { effectiveSubtypes } from './derived.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
// Observe the event before rule deaths, transformations, or later cost payments.
// Flushing only records triggers; the normal next quick window puts them in stack.
export function recordFieldEvent(s, id, event, details = {}) {
    const l = s.locations[id], card = printedRulesCard(s, id);
    if (l?.zone !== 'play' || l.faceDown || !hasCardType(card, 'character'))
        return;
    const subjectCard = { ...structuredClone(card), controller: controllerOf(s, id), subtypes: effectiveSubtypes(s, id), magicDomains: effectiveMagicDomains(s, id) };
    const sources = s.players.flatMap(p => p.play).filter(source => printedRulesCard(s, source).automation?.watch?.some(w => w.event === event)).map(source => ({ id: source, card: structuredClone(printedRulesCard(s, source)), loc: { ...structuredClone(s.locations[source]), controller: controllerOf(s, source) }, silenced: abilitiesSuppressed(s, source) }));
    s.fieldEvents ??= [];
    s.fieldEvents.push({ id, event, group: s.eventGroup ?? uuid(), loc: { ...structuredClone(l), controller: controllerOf(s, id) }, details: { ...details, subjectCard, sources, sourceSilenced: abilitiesSuppressed(s, id) } });
}
// Player resource events also freeze their observers at the actual mutation.
export function recordPlayerEvent(s, player, event, details = {}) {
    const sources = s.players.flatMap(p => p.play).filter(source => printedRulesCard(s, source).automation?.watch?.some(w => w.event === event)).map(source => ({ id: source, card: structuredClone(printedRulesCard(s, source)), loc: { ...structuredClone(s.locations[source]), controller: controllerOf(s, source) }, silenced: abilitiesSuppressed(s, source) }));
    if (!sources.length)
        return;
    s.fieldEvents ??= [];
    s.fieldEvents.push({ id: null, event, group: s.eventGroup ?? uuid(), loc: { controller: player }, details: { ...details, ...((s.activatingPrepaid ?? s.costTriggerParent) ? { triggerAfter: s.activatingPrepaid ?? s.costTriggerParent } : {}), player, subjectCard: { controller: player, owner: player, subtypes: [] }, sources } });
}
export function canTapCard(s, id) {
    const l = s.locations[id];
    return !!l && !(['play', 'asset'].includes(l.zone) && (s.effects ?? []).some(e => e.kind === 'prevent-tap' && e.targetId === id && e.targetZoneVersion === l.zoneVersion)) && !(l.zone === 'society' ? s.societyStates?.[controllerOf(s, id)]?.tapped : l.zone === 'asset' ? s.players.flatMap(p => p.assets).find(a => a.id === id)?.tapped : l.tapped);
}
export function tapCard(s, id) {
    const l = s.locations[id];
    if (!l)
        return false;
    const asset = l.zone === 'asset' ? s.players.flatMap(p => p.assets).find(a => a.id === id) : null;
    if (!canTapCard(s, id))
        return false;
    l.tapped = true;
    if (l.zone === 'society')
        s.societyStates[controllerOf(s, id)].tapped = true;
    if (asset)
        asset.tapped = true;
    recordFieldEvent(s, id, 'tapped');
    return true;
}
export function flushFieldEvents(s, event) {
    const events = s.fieldEvents ?? [];
    s.fieldEvents = [];
    for (const e of events)
        event?.(s, e.id, e.event, e.loc, e.group, e.details);
}
export function flushPlayerEvents(s, event) {
    const queued = (s.fieldEvents ?? []).filter(e => ['honor-changed', 'exposure-decreased'].includes(e.event));
    if (!queued.length)
        return;
    s.fieldEvents = s.fieldEvents.filter(e => !queued.includes(e));
    for (const e of queued)
        event(s, e.id, e.event, e.loc, e.group, e.details);
}
