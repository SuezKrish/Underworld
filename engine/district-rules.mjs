import { cageRestricts } from './field-rules.mjs';
import { districtAttachmentVersionValid } from './task-districts.mjs';
import { recordOutsideAction } from './green-black-rules.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
// Read continuous district attachments from the live host object, rather than
// changing the region's printed traits or carrying them into its score card.
export function districtAttachments(s, district) {
    const host = s.districts?.[district];
    if (!host)
        return [];
    return Object.keys(s.locations).filter(id => { const l = s.locations[id]; return l.zone === 'play' && !l.faceDown && l.attachedTo === `district-host:${host.id}` && districtAttachmentVersionValid(host, l.hostVersion) && l.district === district && hasCardType(s.cards[id], 'attachment'); });
}
export function districtTraits(s, district) {
    const host = s.districts?.[district];
    if (!host)
        return [];
    return [...new Set([...(host.traits ?? []), ...districtAttachments(s, district).flatMap(id => s.cards[id].attachment?.grantDistrictTraits ?? [])])];
}
export function restrictedDistrict(s, id, district) {
    const c = printedRulesCard(s, id);
    return hasCardType(c, 'character') && c.faction?.split('·')[1] !== '国家机构' && districtAttachments(s, district).some(a => s.cards[a].attachment?.static === 'martial-law');
}
export function canMoveToDistrict(s, id, district) {
    const l = s.locations[id];
    return !!s.districts?.[district] && l?.zone === 'play' && !movementBlocked(s, id) && (l.faceDown || !restrictedDistrict(s, id, district));
}
export function movementBlocked(s, id) {
    const l = s.locations[id], c = printedRulesCard(s, id);
    if (!l || l.faceDown)
        return false;
    return [].length > 0 || cageRestricts(s, id) || !!c?.cannotMove || !!(c?.automation?.noMoveWhileAttached && l.attachedTo && s.locations[l.attachedTo]?.zone === 'play' && s.locations[l.attachedTo].zoneVersion === l.hostVersion);
}
export function relocate(s, id, district) {
    if (!canMoveToDistrict(s, id, district))
        return false;
    const l = s.locations[id];
    if (l.district === district)
        return true;
    recordOutsideAction(s, id);
    l.district = district;
    const visited = new Set();
    function follow(host) {
        if (visited.has(host))
            return;
        visited.add(host);
        for (const [aid, a] of Object.entries(s.locations))
            if (a.zone === 'play' && a.attachedTo === host && a.hostVersion === s.locations[host].zoneVersion) {
                if (printedRulesCard(s, aid)?.automation?.stayWhenHostMoves) {
                    delete a.attachedTo;
                    delete a.hostVersion;
                    continue;
                }
                a.district = district;
                follow(aid);
            }
    }
    follow(id);
    return true;
}
export function chaosEntryDistricts(s, id) { return s.districts.flatMap((d, i) => d && !restrictedDistrict(s, id, i) ? [i] : []); }
