import { printedRulesCard, allAbilitiesLost } from './printed-rules.mjs';
// Granted triggers belong to the host, even when the attachment is controlled
// by somebody else or the host's printed text has been blanked.
export function attachmentGrantedTriggers(s, id, event, loc = s.locations[id], sources) {
    if (loc?.zone !== 'play' || loc.faceDown || allAbilitiesLost(s, id, loc))
        return [];
    const cards = sources ?? s.players.flatMap(p => p.play).map(aid => ({ id: aid, loc: s.locations[aid], card: printedRulesCard(s, aid) }));
    const grants = (s.effects ?? []).filter(e => e.kind === 'grant-trigger' && e.event === event && e.targetId === id && e.targetZoneVersion === loc.zoneVersion).map(e => ({ ...e.definition, grantedBy: e.sourceId, grantedEffect: true, provenance: e.provenance }));
    return [...grants, ...cards.flatMap(({ id: aid, loc: al, card }) => al?.zone === 'play' && !al.faceDown && al.attachedTo === id && al.hostVersion === loc.zoneVersion ?
            (card?.attachment?.grantTriggers ?? []).filter(t => t.event === event).map(t => ({ ...t, grantedBy: aid })) : [])];
}
