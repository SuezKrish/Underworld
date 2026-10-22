import { RuleError } from './core.mjs';
import { hasCardType } from './card-types.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { effectiveSubtypes, enterTapped, graveyardLocked } from './derived.mjs';
import { graveCards, inGrave } from './graveyard-rules.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { sealHost } from './sealing.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function createBQEffects(ctx) {
    const { move, event, choose, finishSpell, log, shuffle, pay, seal, options, discard, librarySearchBlocked, discardDeck } = ctx;
    function enter(s, a, id, d) {
        if (!s.districts[d])
            return false;
        const placed = move(s, id, 'play', { controller: a.controller, district: d, faceDown: false, tapped: enterTapped(s, id, d) });
        if (placed)
            event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
        return placed;
    }
    function industryOptions(s, a, ids, d) { return ids.filter(id => hasCardType(s.cards[id], 'attachment') && (effectiveSubtypes(s, id).includes('研究') || s.cards[id].subtitle === '圣甲虫产业') && options(s, a.controller, { ...s.cards[id].attachment, cardId: id }).some(o => o.id === `district:${d}`)); }
    function leak(s, a, remaining, targets) {
        const p = a.controller, d = targets.find(t => t.kind === 'district'), h = targets.find(t => t.kind === 'card');
        if (s.players[p].deck.length)
            move(s, s.players[p].deck[0], 'graveyard');
        if (d && s.districts[d.district]?.id === d.cardId) {
            const template = s.reserveTemplates.find(c => c.name === '行尸' && hasCardType(c, 'character'));
            if (template) {
                const id = crypto.randomUUID();
                s.cards[id] = { ...structuredClone(template), id, owner: p };
                s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
                enter(s, a, id, d.district);
            }
        }
        const l = s.locations[h?.cardId], ids = h && l?.zone === 'play' && !l.faceDown && l.zoneVersion === h.zoneVersion ? graveCards(s, p, a.cardId).filter(id => matchesSpecifiedName(printedRulesCard(s, id), '无名尸体') && !graveyardLocked(s, id, p, s.locations[id].zone)) : [];
        if (ids.length) {
            choose(s, a, 'bq-leak-seal', p, ids, { canSkip: true, public: true, remaining, targets, host: sealHost(s, h.cardId), versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])), choiceLabel: '生化泄露 · 可封印一张无名尸体' });
            return;
        }
        leakRepeat(s, a, remaining, targets);
    }
    function leakRepeat(s, a, remaining, targets) {
        if (remaining > 0)
            choose(s, a, 'bq-leak-repeat', a.controller, [], { remaining, targets, options: [{ id: 'repeat', name: `重复流程（还可重复${remaining}次）` }, { id: 'stop', name: '结束流程' }], choiceLabel: '生化泄露 · 是否重复' });
        else
            finishSpell(s, a);
    }
    function effect(s, a, plan, targets) {
        const p = a.controller;
        if (plan.operation === 'assault-drink')
            return discardDeck.effect(s, a, { ...plan, operation: 'drink-blood', sourceId: plan.subjectId, sourceZoneVersion: plan.subjectZoneVersion, count: 1 }, []);
        if (plan.operation === 'death-return') {
            const t = targets[0];
            s.effects.push({ kind: 'archaeological-return', targetId: t.cardId, targetZoneVersion: t.zoneVersion, sourceId: plan.sourceId, round: s.round, duration: 'until-end-of-round' });
        }
        if (plan.operation === 'feast-discard') {
            const q = targets[0].player;
            choose(s, a, 'bq-feast-pay', q, [], { options: [{ id: 'pay', name: '支付2费用' }, { id: 'discard', name: '不支付，弃一张手牌' }], choiceLabel: '欢宴 · 支付费用或弃牌' });
            return true;
        }
        if (plan.operation === 'ace-replace') {
            const ids = [];
            for (const id of s.players[p].deck) {
                ids.push(id);
                if (hasCardType(s.cards[id], 'character'))
                    break;
            }
            if (ids.length)
                log(s, '百变王牌展示：' + ids.map(id => s.cards[id].name).join('、'));
            const role = ids.at(-1);
            if (role && hasCardType(s.cards[role], 'character') && s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId && enter(s, a, role, plan.sourceDistrict)) {
                const ace = plan.sourceId, l = s.locations[ace], host = s.locations[role];
                if (inGrave(s, ace, ace) && l.zoneVersion === plan.sourceZoneVersion + 1 && !graveyardLocked(s, ace, s.cards[ace].owner, l.zone) && options(s, p, { ...s.cards[ace].attachment, cardId: ace }).some(o => o.id === role)) {
                    if (move(s, ace, 'play', { controller: p, district: host.district, attachedTo: role, hostVersion: host.zoneVersion, faceDown: false, tapped: true })) {
                        event(s, ace, 'entry', s.locations[ace], a.id, { method: 'effect-placement' });
                        event(s, ace, 'attached', s.locations[ace], a.id, { host: sealHost(s, role) });
                    }
                }
            }
            shuffle(s.players[p].deck);
        }
        if (plan.operation === 'lucian-industry') {
            if (s.hiddenWins?.[p] !== s.round || s.districts[plan.sourceDistrict]?.id !== plan.sourceDistrictCardId || librarySearchBlocked(s)) {
                shuffle(s.players[p].deck);
                return false;
            }
            const top = s.players[p].deck.slice(0, 5), ids = industryOptions(s, a, top, plan.sourceDistrict);
            if (!ids.length) {
                shuffle(s.players[p].deck);
                return false;
            }
            choose(s, a, 'bq-lucian-place', p, ids, { canFail: true, district: plan.sourceDistrict, districtId: plan.sourceDistrictCardId, versions: Object.fromEntries(top.map(id => [id, s.locations[id].zoneVersion])), choiceLabel: '卢锡安博士 · 顶五张中寻找可结附本地区的研究／产业附属' });
            return true;
        }
        if (plan.operation === 'biochemical-leak') {
            leak(s, a, effectiveSocietyMarkers(s, p).hidden, targets);
            return true;
        }
        return false;
    }
    function choice(s, p, c, x) {
        const a = x.spell;
        if (x.kind === 'bq-feast-pay') {
            need(['pay', 'discard'].includes(c.cardId), '请选择支付费用或弃牌');
            if (c.cardId === 'pay')
                pay(s, p, 2);
            else if (discard(s, a, p, 1))
                return;
        }
        else if (x.kind === 'bq-lucian-place') {
            if (!c.fail) {
                const id = c.cardId;
                need(x.cardIds.includes(id) && s.players[p].deck.includes(id) && s.locations[id].zoneVersion === x.versions[id], '检索牌已变更区域');
                if (!librarySearchBlocked(s) && s.districts[x.district]?.id === x.districtId && industryOptions(s, a, [id], x.district).length) {
                    const host = `district-host:${x.districtId}`;
                    log(s, '卢锡安博士展示：' + s.cards[id].name);
                    if (move(s, id, 'play', { controller: p, district: x.district, attachedTo: host, hostVersion: x.districtId, faceDown: false, tapped: enterTapped(s, id, x.district) })) {
                        event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
                        event(s, id, 'attached', s.locations[id], a.id, { host: sealHost(s, host) });
                    }
                }
            }
            shuffle(s.players[p].deck);
        }
        else if (x.kind === 'bq-leak-seal') {
            if (!c.skip) {
                const id = c.cardId;
                need(x.cardIds.includes(id) && inGrave(s, id, a.cardId) && s.locations[id].zoneVersion === x.versions[id], '请选择仍在墓地的无名尸体');
                seal(s, id, x.host, { zone: s.locations[id].zone, zoneVersion: x.versions[id] });
            }
            leakRepeat(s, a, x.remaining, x.targets);
            return;
        }
        else if (x.kind === 'bq-leak-repeat') {
            need(['repeat', 'stop'].includes(c.cardId), '请选择是否重复');
            if (c.cardId === 'repeat') {
                leak(s, a, x.remaining - 1, x.targets);
                return;
            }
        }
        else
            throw new RuleError('未知BQ结算选择');
        finishSpell(s, a);
    }
    return { effect, choice };
}
