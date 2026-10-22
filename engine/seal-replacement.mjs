import { continuousDecision } from './death-costs.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { controllerOf, identity } from './ownership.mjs';
import { hasCardType } from './card-types.mjs';
import { canTapCard } from './field-events.mjs';
import { tapCostCards } from './tap-costs.mjs';
import { uuid } from './random.mjs';
import { RuleError } from './core.mjs';
export function silenceTapOptions(s, p) {
    const play = s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && controllerOf(s, id) === p && canTapCard(s, id));
    return [play.filter(id => hasCardType(printedRulesCard(s, id), 'character')), play.filter(id => hasCardType(printedRulesCard(s, id), 'attachment')), s.players[p].assets.filter(a => controllerOf(s, a.id) === p && canTapCard(s, a.id)).map(a => a.id)];
}
const distinctTriple = groups => groups[0].some(a => groups[1].some(b => b !== a && groups[2].some(c => c !== a && c !== b)));
export function silenceSealFace(s, id, faceDown, { log }) {
    if (faceDown)
        return true;
    const first = s.flow.stepOwner ?? s.turn?.firstPlayer ?? 0;
    let sources = [first, 1 - first].flatMap(p => s.players[p].play).filter(source => { const l = s.locations[source]; return false; });
    for (const p of [first, 1 - first]) {
        let own = sources.filter(source => controllerOf(s, source) === p);
        while (own.length) {
            const source = own.length === 1 ? own[0] : continuousDecision(s, `silence-order:${uuid()}`, { kind: 'silence-order', controller: p, sourceName: '缄默', sources: own.map(id => ({ id, name: s.cards[id].name })) });
            if (!own.includes(source))
                throw new RuleError('请选择本方仍待适用的缄默');
            own = own.filter(id => id !== source);
            const owner = s.cards[id].owner, groups = silenceTapOptions(s, owner);
            if (!distinctTriple(groups)) {
                log(s, '缄默：无法横置角色、附属和资产各一个，改为背面封印。');
                return true;
            }
            const payment = continuousDecision(s, `silence-pay:${uuid()}`, { kind: 'silence-pay', controller: owner, sourceName: '缄默', groups: groups.map((ids, i) => ({ label: ['角色', '附属', '资产'][i], cards: ids.map(id => s.locations[id].secretPlan ? { id, name: '秘密计划' } : identity(s, id)) })) });
            if (!payment.fire) {
                log(s, '缄默：选择不支付横置费用，改为背面封印。');
                return true;
            }
            const ids = payment.cardIds;
            if (!Array.isArray(ids) || ids.length !== 3 || new Set(ids).size !== 3 || ids.some((id, i) => !groups[i].includes(id)))
                throw new RuleError('请选择三个不同的本方角色、附属和资产支付横置费用');
            tapCostCards(s, owner, ids);
            log(s, '缄默：拥有者横置角色、附属和资产各一个，保留正面封印。');
        }
    }
    return false;
}
