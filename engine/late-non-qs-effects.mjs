import { loyaltyMet } from './loyalty.mjs';
import { tapCard } from './field-events.mjs';
import { RuleError } from './core.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { controllerOf } from './ownership.mjs';
import { sealedOn, sealHost } from './sealing.mjs';
import { enterTapped, effectiveSubtypes } from './derived.mjs';
import { hasCardType } from './card-types.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
import { addWounds } from './wounds.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { uuid } from './random.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function createLateNonQsEffects({ move, event, seal, choose, finishSpell, live, shuffle, destroy, librarySearchBlocked, castDuringResolution, castOptions, revealByEffect }) {
    function effect(s, a, plan, targets) {
        const p = a.controller;
        if (plan.operation === 'mother-play') {
            const hand = s.players[p].hand.filter(id => s.cards[id].printedCost <= plan.maxCost && castOptions(s, p, id).castAllowed), hidden = s.players[p].play.filter(id => s.locations[id]?.faceDown && s.cards[id].printedCost <= plan.maxCost && loyaltyMet(s, p, printedRulesCard(s, id).loyalty, printedRulesCard(s, id)));
            const ids = [...hand, ...hidden];
            if (!ids.length)
                return false;
            choose(s, a, 'late-non-qs-mother-select', p, ids, { versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])), canFail: true, choiceLabel: '梦魇主母 · 选择打出或现身的牌' });
            return true;
        }
        if (plan.operation === 'gunfire') {
            const district = targets.find(t => t.kind === 'district');
            if (!district)
                return false;
            const mode = plan.selectedMode ?? a.mode;
            beginEventGroup(s, a.id);
            try {
                if (mode !== 'police')
                    for (const t of targets.filter(t => t.kind === 'card'))
                        destroy(s, t.cardId);
                const template = s.reserveTemplates.find(c => c.catalogId === 'TK003');
                if (mode !== 'destroy' && template)
                    for (let i = 0; i < 2; i++) {
                        const id = uuid();
                        s.cards[id] = { ...structuredClone(template), id, owner: p };
                        s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
                        if (move(s, id, 'play', { controller: p, district: district.district, faceDown: false, tapped: enterTapped(s, id, district.district) }))
                            event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
                    }
            }
            finally {
                endEventGroup(s);
            }
            return false;
        }
        if (plan.operation === 'well-ghost-wound') {
            if (s.districts[plan.sourceDistrict]?.id !== plan.sourceDistrictCardId)
                return false;
            const count = s.players[p].play.reduce((n, id) => { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && l.district === plan.sourceDistrict && hasCardType(printedRulesCard(s, id), 'attachment') && matchesSpecifiedName(printedRulesCard(s, id), '枯井') ? n + sealedOn(s, id).length : n; }, 0);
            addWounds(s, targets[0].cardId, count, { event, group: a.id });
            return false;
        }
        if (plan.operation === 'george-tap-host') {
            const h = plan.eventHost, l = s.locations[h?.hostId];
            if (l?.zone === 'play' && !l.faceDown && (l.fieldVersion ?? l.zoneVersion) === h.version && hasCardType(printedRulesCard(s, h.hostId), 'character'))
                tapCard(s, h.hostId);
            return false;
        }
        if (plan.operation === 'george-seal') {
            const target = targets[0];
            if (!target)
                return false;
            for (const ref of plan.revealedRefs ?? [])
                if (ref.player === p)
                    seal(s, ref.cardId, sealHost(s, target.cardId), { zone: 'aside', zoneVersion: ref.zoneVersion });
            return false;
        }
        if (!['bell-search', 'zhang-search'].includes(plan.operation))
            return false;
        if (librarySearchBlocked(s)) {
            shuffle(s.players[p].deck);
            return false;
        }
        const ids = s.players[p].deck.filter(id => hasCardType(s.cards[id], 'character') && (plan.operation === 'bell-search' ? effectiveSubtypes(s, id).some(t => ['梦境', '梦魇'].includes(t)) : matchesSpecifiedName(s.cards[id], '无知路人')));
        if (!ids.length) {
            shuffle(s.players[p].deck);
            return false;
        }
        choose(s, a, 'late-non-qs-search', p, ids, { canFail: true, choiceLabel: plan.operation === 'bell-search' ? '贝兰丹娜 · 选择角色牌及去向' : '张角 · 选择无知路人', searchOperation: plan.operation, versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])) });
        return true;
    }
    function choice(s, p, c, x) {
        const a = x.spell, plan = a.plan, id = c.cardId;
        if (x.kind === 'late-non-qs-mother-cast') {
            need(c.play?.cardId === x.cardIds[0], '请选择本次许可的手牌');
            castDuringResolution(s, p, { ...c.play, id: c.id }, x);
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'late-non-qs-mother-select') {
            if (c.fail === true) {
                finishSpell(s, a);
                return;
            }
            need(x.cardIds.includes(id) && s.locations[id]?.zoneVersion === x.versions[id] && s.cards[id].printedCost <= plan.maxCost, '所选牌不符合本次费用上限');
            if (s.locations[id].zone === 'play' && s.locations[id].faceDown && controllerOf(s, id) === p) {
                need(loyaltyMet(s, p, printedRulesCard(s, id).loyalty, printedRulesCard(s, id)), '资产未满足忠诚需求');
                revealByEffect(s, a, id);
                finishSpell(s, a);
                return;
            }
            need(s.players[p].hand.includes(id) && castOptions(s, p, id).castAllowed, '所选牌当前不能打出');
            choose(s, a, 'late-non-qs-mother-cast', p, [id], { castSourceZone: 'hand', cardVersion: x.versions[id], fastCast: true, ignoreCosts: true, choiceLabel: '梦魇主母 · 免费打出' });
            return;
        }
        if (c.fail !== true) {
            need(x.cardIds.includes(id) && s.locations[id]?.zone === 'deck' && s.players[p].deck.includes(id) && s.locations[id].zoneVersion === x.versions[id], '请选择仍在牌库中的检索牌');
            if (x.searchOperation === 'zhang-search') {
                const t = a.targets[0];
                if (live(s, p, plan, t) && move(s, id, 'play', { controller: p, district: t.district, faceDown: false, tapped: enterTapped(s, id, t.district) }))
                    event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
            }
            else {
                need(['hand', 'sealed', 'hidden'].includes(c.destination), '请选择置于手中、封印或以暗藏者状态进场');
                if (c.destination === 'hand')
                    move(s, id, 'hand');
                else if (c.destination === 'sealed') {
                    const t = a.targets[0];
                    need(t && live(s, p, plan, t), '原封印目标已失效');
                    seal(s, id, sealHost(s, t.cardId), { zone: 'deck', zoneVersion: x.versions[id] });
                }
                else {
                    need(s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId, '原地区已离场，不能置于该地区');
                    move(s, id, 'play', { controller: p, district: plan.sourceDistrict, faceDown: true, hiddenHandle: uuid(), tapped: false });
                }
            }
        }
        shuffle(s.players[p].deck);
        finishSpell(s, a);
    }
    return { effect, choice };
}
