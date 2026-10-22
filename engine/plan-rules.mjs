import { graveCards, inGrave } from './graveyard-rules.mjs';
import { RuleError } from './core.mjs';
import { hasCardType, cardTypes } from './card-types.mjs';
import { printedRulesCard, printedRulesBlank } from './printed-rules.mjs';
import { controlsGerone } from './cq-rules.mjs';
export const progressCount = (s, id) => s.locations[id]?.counters?.progress ?? 0;
export const scoredPlan = (s, p, code) => (s.players[p].scoreCards ?? []).some(c => c.catalogId === code);
export function graveCastMethods(s, p, id) {
    const c = printedRulesCard(s, id), l = s.locations[id];
    if (!inGrave(s, id, id))
        return [];
    const methods = [];
    if (inGrave(s, id, s.resolutionCasting?.sourceId ?? id) && s.resolutionCasting?.cardId === id && s.resolutionCasting.player === p && s.resolutionCasting.zoneVersion === l.zoneVersion)
        methods.push({ id: 'resolution', label: '当前效果授予的墓地打出许可', sacrificeOffset: 0 });
    if (c.automation?.castFromGrave || c.attachment?.castFromGrave || c.spell?.castFromGrave)
        methods.push({ id: 'card', label: c.name + '自身的墓地打出能力', sacrificeOffset: 0 });
    ;
    if (c.spell?.castFromGraveCondition === 'gerone' && controlsGerone(s, p))
        methods.push({ id: 'card', label: c.name + ' · 弃一张红牌作为额外费用', discardCost: 1, discardFilter: { faction: '红' }, sacrificeOffset: 0 });
    if (hasCardType(c, 'character') && c.magicDomains?.includes('死亡'))
        for (const source of s.players[p].play)
            if (s.locations[source].zone === 'play' && !s.locations[source].faceDown && inGrave(s, id, source) && printedRulesCard(s, source).automation?.static === 'grave-death-casting')
                methods.push({ id: 'vizier:' + source, label: printedRulesCard(s, source).name + ' · 无墓地打出额外费用', sacrificeOffset: 0 });
    ;
    return methods;
}
export function selectedGraveCast(s, p, id, requested) {
    const methods = graveCastMethods(s, p, id);
    if (requested !== undefined && !methods.some(m => m.id === requested))
        throw new RuleError('所选墓地打出许可已失效或不适用于此牌');
    return methods.find(m => m.id === requested) ?? methods[0] ?? null;
}
export function nativeGraveCast(s, p, id) { return graveCastMethods(s, p, id).some(m => m.id !== 'hades'); }
export function hadesCosts(s, p, id) { return graveCards(s, p).filter(x => x !== id && s.cards[x].owner === p && cardTypes(printedRulesCard(s, x)).some(t => cardTypes(printedRulesCard(s, id)).includes(t))); }
export function requiresHades(s, p, id, requested) { return selectedGraveCast(s, p, id, requested)?.id === 'hades'; }
export function progressive(s, id) { const c = s.cards[id], l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && (!printedRulesBlank(s, id) || l.secretPlan) && (c?.keywords?.includes('可推进')); }
export function planPrintedCost(s, id) { return s.locations[id]?.secretPlan ? 1 : s.cards[id]?.printedCost ?? 0; }
export function planCastingAllowed(s, p, c) { return !s.players[1 - p].play.some(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && !s.locations[id].secretPlan && printedRulesCard(s, id).automation?.grayStatic === 'ban' && s.locations[id].bannedCost === c.printedCost); }
export function actionAllowance(s, p, kind) { return 1 + (0); }
export function actionUsed(s, p, kind) { return s.players[p].actionCounts?.[kind] ?? (s.players[p].actionsUsed?.[kind] ? 1 : 0); }
export function useRoundAction(s, p, kind) { const player = s.players[p]; player.actionCounts ??= { asset: actionUsed(s, p, 'asset'), secret: actionUsed(s, p, 'secret') }; player.actionCounts[kind]++; player.actionsUsed ??= {}; player.actionsUsed[kind] = player.actionCounts[kind] >= actionAllowance(s, p, kind); }
export function utopiaTargets(s, a) {
    const p = 1 - a.controller;
    if (true)
        return 0;
    const keys = new Set();
    for (const t of a.targets ?? []) {
        let yes = false, key;
        if (t.kind === 'player') {
            yes = t.player === p;
            key = 'player:' + t.player;
        }
        else if (t.kind === 'host') {
            yes = t.ref?.kind === 'society' && t.ref.owner === p;
            key = t.ref?.hostId;
        }
        else if (t.kind === 'stack') {
            yes = s.flow.stack.some(x => x.id === t.entryId && x.controller === p && ['play-spell', 'play-character'].includes(x.kind));
            key = 'stack:' + t.entryId;
        }
        else if (t.kind === 'card') {
            const l = s.locations[t.cardId], c = printedRulesCard(s, t.cardId);
            if (l?.zoneVersion !== t.zoneVersion)
                continue;
            yes = l.zone === 'graveyard' ? c.owner === p : l.zone === 'stack' ? s.flow.stack.some(x => x.cardId === t.cardId && x.controller === p) : ['play', 'asset', 'society'].includes(l.zone) && (l.controller ?? c.owner) === p && (l.zone !== 'play' || l.faceDown || hasCardType(c, 'character') || hasCardType(c, 'attachment'));
            key = 'card:' + t.cardId;
        }
        if (yes)
            keys.add(key);
    }
    return keys.size;
}
