import { hasCardType } from './card-types.mjs';
const groups = { curse: { from: ['幽灵', '仪式', '不死生物'], to: '诅咒' }, disaster: { from: ['梦魇', '异界', '相位怪物'], to: '灾难' }, mind: { from: ['梦境', '命运', '超能力者'], to: '心灵' } };
export const realityModes = Object.entries(groups).map(([id, g]) => ({ id, name: `${g.from.join('／')}额外具有${g.to}` })).concat({ id: 'invert', name: '本阶段反转虚实判断' });
export function realitySociety(s, p) { return false; }
export function realitySubtypes(s, id) {
    const c = s.cards[id], st = s.societyStates?.[c?.owner];
    if (!c || !realitySociety(s, c.owner) || st?.realityPhase !== s.turn?.phase)
        return [];
    const g = groups[st.realityMode];
    return g && c.subtypes?.some(t => g.from.includes(t)) ? [g.to] : [];
}
export function realityCard(s, id) {
    const c = s.cards[id];
    if (!c || !realitySociety(s, c.owner) || hasCardType(c, 'society') || ['society', 'district'].includes(c.type))
        return null;
    const types = [...(c.subtypes ?? []), ...realitySubtypes(s, id)], usual = types.some(t => ['诅咒', '灾难', '心灵'].includes(t)), st = s.societyStates[c.owner];
    return st.realityPhase === s.turn?.phase && st.realityMode === 'invert' ? !usual : usual;
}
export function fateSealedPermission(s, p, id) { const c = s.cards[id], l = s.locations[id]; return !!c && c.owner === p && l?.zone === 'sealed' && !l.faceDown && l.hostId === `society:${p}` && l.hostVersion === (s.societyVersions?.[p] ?? 0) && [...(c.subtypes ?? []), ...realitySubtypes(s, id)].includes('命运') && s.players[p].play.some(source => { const sl = s.locations[source]; return false; }); }
