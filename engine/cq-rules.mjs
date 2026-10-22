import { effectiveSubtypes } from './derived.mjs';
import { scoredTasks } from './task-districts.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
export function controlsGerone(s, p) { return s.players[p].play.some(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(printedRulesCard(s, id), 'character') && matchesSpecifiedName(printedRulesCard(s, id), '盖罗涅')); }
export function cqTriggerState(s, id, def, loc) {
    if (def.cqCondition !== 'three-sisters')
        return {};
    const p = loc.controller ?? s.cards[id].owner;
    const n = s.players[p].play.filter(x => { const l = s.locations[x], c = printedRulesCard(s, x); return l?.zone === 'play' && !l.faceDown && controllerOf(s, x) === p && hasCardType(c, 'character') && c.name === '诡异三姐妹'; }).length;
    if (n < 3)
        return false;
    return { usageKey: `cq-sisters:${p}:${printedRulesCard(s, id).name}` };
}
export const virtualAttachments = (s, p) => scoredTasks(s, p).filter(c => c.automation?.scoredVirtualAttachment?.length).map(c => ({ ...c, type: 'attachment', subtypes: c.automation.scoredVirtualAttachment }));
export function cqTaskIcons(s, id, includeWhite = false, blackOnly = false) {
    const l = s.locations[id];
    if (l?.zone !== 'play' || l.faceDown || !effectiveSubtypes(s, id).includes('工程师'))
        return {};
    const d = s.districts[l.district];
    if (d?.plan?.taskStatic !== 'engineer-icons' || printedRulesCard(s, d.id)?.automation?.taskStatic !== 'engineer-icons')
        return {};
    return { investigation: includeWhite || !blackOnly && controllerOf(s, id) === s.turn?.firstPlayer ? 1 : 0, influence: 1 };
}
