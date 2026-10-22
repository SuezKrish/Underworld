import { effectiveDefense } from './rounds.mjs';
import { cardHasKeyword } from './derived.mjs';
export const assaultSource = plan => ({ id: plan.sourceId, version: plan.sourceZoneVersion });
// Attribute only a newly lethal impact. A later unrelated destruction must not
// count as a death caused by an earlier, nonlethal assault.
export function noteAssaultLethal(s, id, source) {
    const l = s.locations[id];
    if (!source || l?.zone !== 'play' || l.faceDown || (l.damage ?? 0) < effectiveDefense(s, id))
        return;
    s.assaultLethals ??= {};
    s.assaultLethals[id] = { targetVersion: l.zoneVersion, source };
}
export function reportAssaultDeath(s, id, event) {
    const cause = s.assaultLethals?.[id];
    if (!cause)
        return;
    delete s.assaultLethals[id];
    const l = s.locations[id], source = s.locations[cause.source.id];
    if (l.zoneVersion !== cause.targetVersion)
        return;
    // A reward belonging to the resolving assault survives its source leaving.
    // The caller grants it only after the lethal destruction actually happens.
    const reward = cause.source.renownDrawPlayer !== undefined && cardHasKeyword(s, id, '声望') ? { player: cause.source.renownDrawPlayer } : null;
    if (source?.zone === 'play' && !source.faceDown && source.zoneVersion === cause.source.version)
        event(s, cause.source.id, 'assault-killed', source, s.eventGroup, { subjectId: id });
    return reward;
}
