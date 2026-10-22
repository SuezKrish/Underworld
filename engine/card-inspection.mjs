import { uuid } from './random.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { RuleError } from './core.mjs';
import { controllerOf, identity } from './ownership.mjs';
export function hiddenNumber(s, id) { const l = s.locations[id], p = controllerOf(s, id); return s.players[p].play.filter(x => s.locations[x]?.zone === 'play' && s.locations[x].faceDown && s.locations[x].district === l.district).indexOf(id) + 1; }
// A continuous inspection grants no action priority and opens no response
// window. Its events use the same deferred-trigger path as effect inspections.
export function monitorTargets(s, p) {
    const sources = s.players.flatMap(pl => pl.play).filter(id => { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown; });
    const monitors = sources.filter(id => controllerOf(s, id) === p && !s.locations[id].tapped && printedRulesCard(s, id).automation?.static === 'inspect-district-hidden');
    const spies = sources.filter(id => controllerOf(s, id) !== p && printedRulesCard(s, id).automation?.static === 'undercover');
    return Object.entries(s.locations).flatMap(([id, l]) => {
        if (l.zone !== 'play' || !l.faceDown && !l.secretPlan)
            return [];
        const permissions = [...(l.faceDown ? monitors.filter(m => s.locations[m].district === l.district) : []), ...spies.filter(m => controllerOf(s, m) === controllerOf(s, id) && (l.secretPlan || s.locations[m].district === l.district))];
        if (!permissions.length)
            return [];
        return [{ id: l.faceDown ? `hidden:${l.hiddenHandle}` : id, name: l.secretPlan ? `${s.seats[controllerOf(s, id)].name}的秘密计划` : `${s.seats[controllerOf(s, id)].name}的暗藏者 ${hiddenNumber(s, id)} · 地区${l.district + 1}`, sourceNames: [...new Set(permissions.map(m => s.cards[m].name))] }];
    });
}
export function observeHiddenInspection(s, p, ids, event, group = uuid()) {
    for (const id of new Set(ids)) {
        const l = s.locations[id];
        if (l?.zone === 'play' && (l.faceDown || l.secretPlan))
            if (event(s, id, 'hidden-inspected', structuredClone(l), group, { operator: p }) === false)
                ids = ids.filter(x => x !== id);
    }
    return ids;
}
export function inspectWithMonitor(s, p, value, event) {
    if (!monitorTargets(s, p).some(t => t.id === value))
        throw new RuleError('没有生效的监控员或卧底允许检视这张牌');
    const id = value.startsWith('hidden:') ? Object.keys(s.locations).find(id => `hidden:${s.locations[id].hiddenHandle}` === value) : value, l = s.locations[id];
    const group = uuid();
    if (!observeHiddenInspection(s, p, [id], event, group).includes(id))
        return;
    const card = structuredClone(identity(s, id));
    if (l.secretPlan)
        for (const key of ['name', 'displayName', 'type', 'subtypes', 'printedCost', 'printedCostText', 'loyalty', 'magicDomains', 'icons', 'temporaryIcons', 'keywords'])
            card[key] = structuredClone(s.cards[id][key]);
    s.cardInspections ??= {};
    s.cardInspections[p] = { id: group, targetId: id, version: l.zoneVersion, card };
}
export function cardInspectionView(s, p) {
    const a = s.cardInspections?.[p], l = a && s.locations[a.targetId], targets = monitorTargets(s, p), handle = l?.faceDown ? `hidden:${l.hiddenHandle}` : a?.targetId;
    return { monitorTargets: targets, cardInspection: a && l?.zone === 'play' && (l.faceDown || l.secretPlan) && l.zoneVersion === a.version && targets.some(t => t.id === handle) ? { id: a.id, card: a.card } : null };
}
