import { exchangedPrintedCard } from './printed-exchange.mjs';
import { nisosSources } from './green-black-rules.mjs';
import { inGrave } from './graveyard-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { realityCard } from './reality-rules.mjs';
// Printed rules are a state projection, including virtual cards in every zone.
// Never overwrite the catalog or
// erase abilities granted by attachments, counters, or already-resolved effects.
export function abilityLossSources(s, id, loc = s.locations[id], seen = new Set()) {
    if (loc?.zone !== 'play' || loc.faceDown || seen.has(id))
        return [];
    const next = new Set([...seen, id]);
    return s.players.flatMap(p => p.play).filter(source => { const l = s.locations[source], c = s.cards[source]; return source !== id && !next.has(source) && l?.zone === 'play' && !l.faceDown && l.attachedTo === id && l.hostVersion === loc.zoneVersion && c?.automation?.silenceAttachedAbilities && !printedRulesBlank(s, source, l, next); });
}
export function allAbilitiesLost(s, id, loc = s.locations[id]) { return abilityLossSources(s, id, loc).length > 0; }
export function printedRulesBlank(s, id, loc = s.locations[id], seen = new Set()) {
    if (abilityLossSources(s, id, loc, seen).length)
        return true;
    if (realityCard(s, id) === false || nisosSources(s, id).length)
        return true;
    if (loc?.zone === 'play' && !loc.faceDown && (s.effects ?? []).some(e => e.kind === 'blank-printed-rules' && e.targetId === id && e.targetZoneVersion === loc.zoneVersion))
        return true;
    if (loc?.zone !== 'play' || loc.faceDown || !hasCardType(s.cards[id], 'character'))
        return false;
    return s.players.flatMap(p => p.play).some(source => {
        const l = s.locations[source], a = s.cards[source];
        return l?.zone === 'play' && !l.faceDown && l.attachedTo === id && l.hostVersion === loc.zoneVersion && a.automation?.static === 'blank-host-text' && realityCard(s, source) !== false && !(s.effects ?? []).some(e => e.kind === 'blank-printed-rules' && e.targetId === source && e.targetZoneVersion === l.zoneVersion);
    });
}
export function printedRulesCard(s, id, loc = s.locations[id]) {
    let c = exchangedPrintedCard(s, id);
    ;
    if (loc?.secretPlan && c?.attachment) {
        const a = c.automation ?? {};
        return { ...c, name: '秘密计划', displayName: '秘密计划', subtypes: ['计划'], printedCost: 1, printedCostText: '1', unique: false, icons: {}, temporaryIcons: {}, keywords: c.keywords?.includes('可推进') ? ['可推进'] : [], automation: { actions: a.actions ?? [] }, attachment: { kind: 'attachment', target: 'own-society', effect: 'attach-society' }, hiddenAbilities: [] };
    }
    if (!c || !printedRulesBlank(s, id, loc))
        return c;
    return { ...c, automation: undefined, attachment: c.attachment ? { kind: 'attachment', effect: 'attach', timing: 'standard', target: c.attachment.target, filter: c.attachment.filter } : undefined, spell: c.spell ? { timing: 'standard', target: 'none', effect: 'noop' } : undefined, assetAbility: undefined, action: undefined, prepareTrigger: undefined, endTrigger: undefined, keywords: [], conditionalKeywords: {}, hiddenAbilities: [], noEquipment: false, noAttachments: false, cannotMove: false, ...(realityCard(s, id) === false ? { icons: {}, temporaryIcons: {} } : {}) };
}
