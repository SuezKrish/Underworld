import { hasCardType } from './card-types.mjs';
// District slots stay stable for target references and pending effects. Public
// numbering follows the live order, so removing a task never retargets a spell.
export const districtIndexes = s => (s.districts ?? []).flatMap((d, i) => d ? [i] : []);
export const districtNumber = (s, index) => (s.districts ?? []).slice(0, index + 1).filter(Boolean).length;
export function adjacentDistricts(s, index) {
    const ids = districtIndexes(s), at = ids.indexOf(index);
    if (at < 0)
        return [];
    return [ids[at - 1], ids[at + 1]].filter(i => i !== undefined);
}
export const isTaskDistrict = c => hasCardType(c, 'task') && hasCardType(c, 'district');
export const districtHostVersion = d => isTaskDistrict(d) ? `${d.id}:${d.objectVersion ?? 0}` : d?.id;
export const districtAttachmentVersionValid = (d, version) => !!d && (version === d.id || version === districtHostVersion(d));
export function registerTaskDistrict(s, id) {
    const c = s.cards[id], l = s.locations[id];
    if (!isTaskDistrict(c) || l?.zone !== 'play')
        return;
    const found = s.districts.findIndex(d => d?.id === id);
    if (found >= 0) {
        l.district = found;
        return found;
    }
    const index = s.districts.length;
    s.districts.push({ ...c, pendingWinner: null, objectVersion: l.fieldVersion ?? l.zoneVersion, plan: c.automation, traits: [...(c.subtypes ?? [])], threshold: c.automation.taskThreshold ?? 4, points: c.automation.taskPoints ?? 0, influence: [0, 0], destroyed: 0 });
    l.district = index;
    return index;
}
export function unregisterTaskDistrict(s, id) {
    const index = s.districts.findIndex(d => d?.id === id);
    if (index >= 0 && isTaskDistrict(s.districts[index]))
        s.districts[index] = null;
    return index;
}
export const scoredTasks = (s, p, catalogId) => (s.players[p].scoreCards ?? []).filter(c => isTaskDistrict(c) && (!catalogId || c.catalogId === catalogId));
