import { continuousDecision } from './death-costs.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
// Replacing the graveyard destination still observes the original death on
// the battlefield. The choice pauses that operation without using the stack.
export function deathToDeckTop(s, id, loc, group, fallbackLabel) {
    if (loc?.zone !== 'play' || loc.faceDown || !(loc.markers > 0) || !printedRulesCard(s, id).automation?.optionalDeathToDeckTop)
        return false;
    return continuousDecision(s, `death-destination:${id}:${loc.zoneVersion}:${group}`, {
        kind: 'death-destination', controller: controllerOf(s, id), sourceName: s.cards[id].name, ...(fallbackLabel ? { fallbackLabel } : {})
    });
}
export function deathDestination(s, id, loc, group) {
    const top = loc?.zone === 'play' && !loc.faceDown && loc.markers > 0 && printedRulesCard(s, id).automation?.optionalDeathToDeckTop;
    const blink = false;
    const sources = [...(top ? [{ id: 'top', name: '死亡时置于牌库顶', controller: controllerOf(s, id) }] : []), ...(blink ? [{ id: 'blink', name: '远古石像 · 死亡时闪烁', controller: controllerOf(s, id) }] : []), ...(!loc.faceDown && hasCardType(printedRulesCard(s, id), 'character') ? Object.entries(s.locations).filter(([aid, l]) => false).map(([aid, l]) => ({ id: aid, name: printedRulesCard(s, aid).name, controller: controllerOf(s, aid), version: l.zoneVersion })) : [])];
    const first = s.flow.priority ?? s.flow.stepOwner ?? s.turn?.firstPlayer ?? 0;
    for (const p of [first, 1 - first]) {
        let own = sources.filter(r => r.controller === p);
        while (own.length) {
            // Preserve the established single-player top/blink ordering contract.
            const selected = own.length === 1 ? own[0].id : continuousDecision(s, `death-order:${id}:${loc.zoneVersion}:${group}:${p}:${own.map(r => r.id).join(',')}`, { kind: 'grave-continuous-order', controller: p, sources: own });
            const row = own.find(r => r.id === selected);
            if (!row)
                throw Error('死亡替代来源已失效');
            own = own.filter(r => r !== row);
            if (row.id === 'top') {
                if (deathToDeckTop(s, id, loc, group, blink ? '改为闪烁' : undefined))
                    return 'top';
                continue;
            }
            if (row.id === 'blink')
                return 'blink';
            return { kind: 'jade', sourceId: row.id, sourceVersion: row.version, controller: p };
        }
    }
    return null;
}
