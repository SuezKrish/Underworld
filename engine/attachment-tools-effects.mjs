import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { tapCard } from './field-events.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
export function createAttachmentToolsEffects({ hurt }) {
    function effect(s, a, plan, targets) {
        if (plan.operation === 'thunder') {
            const district = targets[0].district;
            const rows = s.players.flatMap(p => p.play).filter(id => { const l = s.locations[id]; return l.zone === 'play' && !l.faceDown && l.district === district && hasCardType(printedRulesCard(s, id), 'character'); }).map(id => ({ id, version: s.locations[id].zoneVersion, tapped: !!s.locations[id].tapped }));
            beginEventGroup(s, a.id);
            try {
                for (const r of rows)
                    if (r.tapped)
                        hurt(s, r.id, 4);
                for (const r of rows)
                    if (!r.tapped && s.locations[r.id]?.zone === 'play' && s.locations[r.id].zoneVersion === r.version)
                        tapCard(s, r.id);
            }
            finally {
                endEventGroup(s);
            }
        }
    }
    return { effect };
}
