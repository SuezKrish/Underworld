import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { printedRulesCard, allAbilitiesLost } from './printed-rules.mjs';
import { cardHasKeyword, auraApplies, attachmentHostLegal } from './derived.mjs';
import { controllerOf } from './ownership.mjs';
import { hasAnyCardType } from './card-types.mjs';
export function shieldEntryCounts(s, id) {
    const c = printedRulesCard(s, id), l = s.locations[id];
    if (l?.zone !== 'play' || l.faceDown)
        return [];
    const p = controllerOf(s, id), keys = [...(c.keywords ?? [])];
    if (effectiveSocietyMarkers(s, p).hidden > 0)
        keys.push(...(c.conditionalKeywords?.hidden ?? []));
    if (effectiveSocietyMarkers(s, p).exposed > 0)
        keys.push(...(c.conditionalKeywords?.exposed ?? []));
    for (const [source, sl] of Object.entries(s.locations))
        if (sl.zone === 'play' && !sl.faceDown) {
            const card = printedRulesCard(s, source);
            if (sl.attachedTo === id && attachmentHostLegal(s, source))
                keys.push(...(card.attachment?.grantKeywords ?? []));
            for (const aura of card.automation?.auras ?? [])
                if (auraApplies(s, source, id, aura))
                    keys.push(...(aura.grantKeywords ?? []));
        }
    for (const e of s.effects ?? [])
        if (e.kind === 'grant-keyword' && e.targetId === id && e.targetZoneVersion === l.zoneVersion)
            keys.push(e.keyword);
    return keys.filter(k => /^护盾\d+$/.test(k) && cardHasKeyword(s, id, k)).map(k => Number(k.slice(2))).filter(n => n > 0);
}
export function shieldCanTrigger(s, id, loc = s.locations[id]) { return loc?.zone === 'play' && !allAbilitiesLost(s, id, loc) && (loc.faceDown || hasAnyCardType(printedRulesCard(s, id), ['character', 'attachment'])) && (loc.counters?.shield ?? 0) > 0; }
