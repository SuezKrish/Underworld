import { printedRulesCard } from './printed-rules.mjs';
import { effectiveSubtypes } from './derived.mjs';
import { hasAnyCardType, hasCardType } from './card-types.mjs';
import { controllerOf, identity } from './ownership.mjs';
import { canTapCard, tapCard } from './field-events.mjs';
import { continuousDecision } from './death-costs.mjs';
import { uuid } from './random.mjs';
import { RuleError } from './core.mjs';
// These are additional costs, not targets or effects that wait on the stack.
// Ask before tapping any of the declared mages; replay keeps the whole payment
// suspended without opening priority or exposing enemy hidden identities.
export function tapCostCards(s, p, ids) {
    const paid = [...new Set(ids)];
    if (paid.some(id => !canTapCard(s, id)))
        throw new RuleError('所选卡牌不能横置以支付额外费用');
    const mages = paid.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && controllerOf(s, id) === p && hasCardType(printedRulesCard(s, id), 'character') && effectiveSubtypes(s, id).includes('法师'));
    const sources = mages.length ? s.players[p].play.filter(id => { const l = s.locations[id]; return false; }) : [];
    let selected = [];
    if (sources.length) {
        const options = s.players[1 - p].play.filter(id => canTapCard(s, id) && (s.locations[id].faceDown || hasAnyCardType(printedRulesCard(s, id), ['character', 'attachment']))).map(id => ({ id: s.locations[id].faceDown ? `hidden:${s.locations[id].hiddenHandle}` : id, cardId: id, version: s.locations[id].zoneVersion }));
        const max = Math.min(options.length, mages.length * sources.length);
        if (max) {
            const cards = options.map(o => s.locations[o.cardId].faceDown ? { id: o.id, name: '暗藏者', faceDown: true } : s.locations[o.cardId].secretPlan ? { id: o.id, name: '秘密计划', type: 'attachment', printedCost: 1, secretPlan: true } : { ...identity(s, o.cardId), id: o.id });
            selected = continuousDecision(s, `mage-tap-cost:${uuid()}`, { kind: 'mage-tap-cost', controller: p, sourceName: s.cards[sources[0]].name, max, cards });
            if (!Array.isArray(selected) || selected.length > max || new Set(selected).size !== selected.length || selected.some(id => !options.some(o => o.id === id && s.locations[o.cardId]?.zone === 'play' && s.locations[o.cardId].zoneVersion === o.version && canTapCard(s, o.cardId))))
                throw new RuleError('请选择至多等量的未横置敌方角色、暗藏者或附属作为额外费用');
            selected = selected.map(id => options.find(o => o.id === id).cardId);
        }
    }
    for (const id of [...paid, ...selected])
        if (!tapCard(s, id))
            throw new RuleError('未能横置卡牌以支付额外费用');
    return selected.length;
}
