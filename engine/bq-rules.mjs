import { sealedResolutionPermit } from './sealed-resolution-cast.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { attachmentHostLegal, effectiveSubtypes, graveyardLocked } from './derived.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { sealHost, liveSealHost } from './sealing.mjs';
import { inGrave } from './graveyard-rules.mjs';
const field = (s, id) => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown;
export function equippedHiddenBonus(s, p) {
    const sources = s.players[p].play.filter(id => field(s, id) && printedRulesCard(s, id)?.automation?.static === 'equipped-hidden-bonus' && attachmentHostLegal(s, id));
    if (!sources.length)
        return 0;
    const count = s.players[p].play.filter(id => field(s, id) && hasCardType(printedRulesCard(s, id), 'character') && Object.entries(s.locations).some(([aid, l]) => field(s, aid) && l.attachedTo === id && l.hostVersion === s.locations[id].zoneVersion && hasCardType(printedRulesCard(s, aid), 'attachment') && effectiveSubtypes(s, aid).some(t => ['装备', '武器', '状态'].includes(t)) && attachmentHostLegal(s, aid))).length;
    return sources.length * count;
}
export function palaceSources(s, p, id) {
    const c = printedRulesCard(s, id), l = s.locations[id], h = sealHost(s, l?.hostId);
    if (c?.owner !== p || l?.zone !== 'sealed' || l.faceDown || !liveSealHost(s, h) || h.version !== l.hostVersion)
        return [];
    return s.players[p].play.filter(source => {
        if (!field(s, source) || abilitiesSuppressed(s, source) || s.sealedCastUses?.[`${source}:${s.locations[source].zoneVersion}`] === s.round)
            return false;
        const kind = printedRulesCard(s, source)?.automation?.static;
        if (kind === 'torii-sealed-casting')
            return null !== null && effectiveSubtypes(s, id).includes('式神') && ['character', 'attachment'].some(t => hasCardType(c, t)) && (h.kind === 'society' && h.owner === p || h.kind === 'card' && field(s, h.hostId) && ['character', 'attachment'].some(t => hasCardType(printedRulesCard(s, h.hostId), t)));
        if (kind === 'sealed-ritual-casting')
            return h.kind === 'district' && effectiveSubtypes(s, id).includes('仪式');
        return kind === 'sealed-character-casting' && hasCardType(c, 'character') && (h.kind === 'society' && h.owner === p || h.kind === 'card' && field(s, h.hostId) && ['character', 'attachment'].some(t => hasCardType(printedRulesCard(s, h.hostId), t)));
    });
}
export function sealedCastMethods(s, p, id, native = false) {
    if (sealedResolutionPermit(s, p, id))
        return [{ id: 'resolution', label: '使用本次结算的打出许可' }];
    return [...(native ? [{ id: 'native', label: '使用此牌已有的区域打出许可' }] : []), ...palaceSources(s, p, id).map(source => ({ id: `palace:${source}:${s.locations[source].zoneVersion}`, label: `${s.cards[source].name} · 本回合一次`, sourceId: source, sourceVersion: s.locations[source].zoneVersion, ...(null !== null ? { district: null } : {}) }))];
}
export function consumeSealedCast(s, p, id, method) {
    if (!method || ['native', 'resolution'].includes(method.id))
        return;
    if (!palaceSources(s, p, id).includes(method.sourceId) || s.locations[method.sourceId].zoneVersion !== method.sourceVersion)
        throw Error('封印打出许可已失效');
    s.sealedCastUses ??= {};
    s.sealedCastUses[`${method.sourceId}:${method.sourceVersion}`] = s.round;
}
// This is an immediate death return, not a trigger and not destruction
// prevention. Death/entry events and new-object cleanup still occur normally.
export function archaeologicalReturn(s, id, old, group, { move, event, log }) {
    if (old?.zone !== 'play' || old.faceDown || !hasCardType(s.cards[id], 'character'))
        return;
    const effects = s.effects.filter(e => e.kind === 'archaeological-return' && e.targetId === id && e.targetZoneVersion === old.zoneVersion && e.round === s.round);
    if (!effects.length || !inGrave(s, id, id) || s.locations[id].zoneVersion !== old.zoneVersion + 1 || graveyardLocked(s, id, s.cards[id].owner, s.locations[id].zone))
        return;
    const district = s.districts[old.district];
    if (!district)
        return;
    if (move(s, id, 'play', { controller: old.controller ?? s.cards[id].owner, district: old.district, faceDown: false, tapped: true })) {
        log(s, '老迈的考古学家：死亡角色立即从墓地横置回场。');
        event(s, id, 'entry', s.locations[id], group, { method: 'effect-placement' });
    }
}
