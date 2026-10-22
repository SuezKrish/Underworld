import { printedRulesCard } from './printed-rules.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { effectiveSubtypes } from './derived.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { controllerOf } from './ownership.mjs';
// A simultaneous batch observes the battlefield before its first departure.
// Sources that die early in the loop can still observe the other deaths.
export function beginEventGroup(s, group) {
    s.eventGroup = group;
    const ids = s.players.flatMap(p => p.play).filter(id => s.locations[id]?.zone === 'play');
    s.deathBatch = { group, sources: ids.filter(id => printedRulesCard(s, id).automation?.watch?.some(w => ['death', 'field-leave'].includes(w.event)) || printedRulesCard(s, id).automation?.static === 'repeat-host-death' || printedRulesCard(s, id).automation?.shoggothStatic === 'ebeniya').map(id => ({ id, silenced: abilitiesSuppressed(s, id), card: structuredClone(printedRulesCard(s, id)), loc: { ...structuredClone(s.locations[id]), controller: controllerOf(s, id) } })), subjects: Object.fromEntries(ids.map(id => [id, { ...printedRulesCard(s, id), abilitiesSuppressed: abilitiesSuppressed(s, id), controller: controllerOf(s, id), subtypes: effectiveSubtypes(s, id), magicDomains: effectiveMagicDomains(s, id) }])) };
}
export function endEventGroup(s) { delete s.eventGroup; delete s.deathBatch; }
