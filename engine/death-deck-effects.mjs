import { graveCards, inGrave } from './graveyard-rules.mjs';
import { RuleError } from './core.mjs';
import { hasCardType } from './card-types.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { enterTapped, graveyardLocked, cardHasKeyword } from './derived.mjs';
import { sealHost } from './sealing.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { uuid } from './random.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function createDeathDeckEffects(ctx) {
    const { move, event, seal, choose, finishSpell, log, shuffle, destroy, librarySearchBlocked } = ctx;
    const front = (s, id) => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown;
    const roles = (s, p) => s.players[p].play.filter(id => front(s, id) && hasCardType(printedRulesCard(s, id), 'character'));
    const grave = (s, p, f = () => true) => graveyardLocked(s) ? [] : graveCards(s, p).filter(f);
    const district = (s, a) => a.plan.eventDestination ? { district: a.plan.eventDistrict, id: a.plan.eventDistrictCardId } : a.targets[0]?.kind === 'district' ? { district: a.targets[0].district, id: a.targets[0].cardId } : { district: a.plan.sourceDistrict, id: a.plan.sourceDistrictCardId };
    function place(s, a, id, d, hidden = false, tapped = false) {
        if (s.districts[d.district]?.id !== d.id || !inGrave(s, id) || graveyardLocked(s))
            return false;
        const ok = move(s, id, 'play', { controller: a.controller, district: d.district, faceDown: hidden, tapped: tapped || !hidden && enterTapped(s, id, d.district), ...(hidden ? { hiddenHandle: uuid() } : {}) });
        if (ok && !hidden)
            event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
        return ok;
    }
    function spawn(s, a, d, count = 1) {
        if (s.districts[d.district]?.id !== d.id)
            return;
        const t = s.reserveTemplates.find(c => c.catalogId === 'TK001');
        if (!t)
            return;
        for (let i = 0; i < count; i++) {
            const id = uuid();
            s.cards[id] = { ...structuredClone(t), id, owner: a.controller };
            s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
            if (move(s, id, 'play', { controller: a.controller, district: d.district, faceDown: false, tapped: enterTapped(s, id, d.district) }))
                event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
        }
    }
    function effect(s, a, plan, targets) {
        const p = a.controller, d = district(s, a);
        if (plan.operation === 'ghoul-upkeep') {
            const ids = [...graveCards(s, p)];
            if (ids.length >= plan.count) {
                choose(s, a, 'death-deck-upkeep', p, ids, { count: plan.count, public: true, choiceLabel: `${s.cards[a.cardId].name} · 按选择顺序将${plan.count}张墓地牌置底` });
                return true;
            }
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.sourceZoneVersion)
                move(s, plan.sourceId, 'graveyard', { cause: 'sacrifice' });
            return false;
        }
        if (plan.operation === 'grave-place') {
            const t = targets[0];
            if (t && inGrave(s, t.cardId) && s.locations[t.cardId].zoneVersion === t.zoneVersion)
                place(s, a, t.cardId, d, !!plan.hidden, !!plan.tapped);
            return false;
        }
        if (plan.operation === 'sadikin-seal') {
            if (targets.length === 2) {
                const t = targets.find(t => inGrave(s, t.cardId)), host = targets.find(t => s.locations[t.cardId]?.zone === 'play');
                if (t && host)
                    seal(s, t.cardId, sealHost(s, host.cardId), { zone: s.locations[t.cardId].zone, zoneVersion: t.zoneVersion });
            }
            return false;
        }
        if (plan.operation === 'sadikin-sacrifice') {
            const enemy = targets[0]?.player;
            const ids = enemy === undefined ? [] : s.players[enemy].play.filter(id => s.locations[id]?.zone === 'play' && (s.locations[id].faceDown || hasCardType(s.cards[id], 'character')) && !cardHasKeyword(s, id, '永恒'));
            if (ids.length) {
                choose(s, a, 'death-deck-sacrifice', enemy, ids, { public: true, choiceLabel: '萨迪金 · 选择本方角色或暗藏者牺牲' });
                return true;
            }
            return false;
        }
        if (plan.operation === 'root-upkeep') {
            const ids = grave(s, p, id => hasCardType(s.cards[id], 'character'));
            if (ids.length) {
                choose(s, a, 'death-deck-root-bottom', p, ids, { public: true, choiceLabel: '骨根灵主 · 选择墓地角色置底，再生成行尸' });
                return true;
            }
            spawn(s, a, d);
            return false;
        }
        ;
        ;
        ;
        return false;
    }
    function choice(s, p, c, x) {
        const a = x.spell, plan = a.plan, d = district(s, a);
        if (x.kind === 'death-deck-upkeep') {
            const ids = c.cardIds;
            need(Array.isArray(ids) && ids.length === x.count && new Set(ids).size === ids.length && ids.every(id => x.cardIds.includes(id) && graveCards(s, p).includes(id)), '请选择规定数量的墓地牌，并按回底顺序排列');
            beginEventGroup(s, a.id);
            for (const id of ids)
                move(s, id, 'deck');
            endEventGroup(s);
        }
        else if (x.kind === 'death-deck-azrael-own') {
            need(x.cardIds.includes(c.cardId) && roles(s, p).includes(c.cardId), '请选择本方正面角色');
            const enemies = roles(s, 1 - p), amount = s.cards[c.cardId].printedCost;
            choose(s, a, 'death-deck-azrael-enemies', p, enemies, { min: 0, max: enemies.length, public: true, maxPrintedCost: amount, ownId: c.cardId, ownVersion: s.locations[c.cardId].zoneVersion, choiceLabel: `选择敌方角色，印刷费用总和至多${amount}（不受本方消灭是否成功影响）` });
            return;
        }
        else if (x.kind === 'death-deck-azrael-enemies') {
            const ids = c.cardIds;
            need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => x.cardIds.includes(id) && roles(s, 1 - p).includes(id)) && ids.reduce((n, id) => n + s.cards[id].printedCost, 0) <= x.maxPrintedCost, '所选敌方角色的印刷费用总和超过上限');
            beginEventGroup(s, a.id);
            if (s.locations[x.ownId]?.zoneVersion === x.ownVersion)
                destroy(s, x.ownId);
            for (const id of ids)
                destroy(s, id);
            endEventGroup(s);
        }
        else if (x.kind === 'death-deck-funeral-search' && c.fail === true) {
            shuffle(s.players[p].deck);
        }
        else {
            need(x.cardIds.includes(c.cardId), '请选择合法卡牌');
            if (x.kind === 'death-deck-sacrifice') {
                need(s.players[p].play.includes(c.cardId) && !cardHasKeyword(s, c.cardId, '永恒'), '无法牺牲该牌');
                move(s, c.cardId, 'graveyard', { cause: 'sacrifice' });
            }
            if (x.kind === 'death-deck-root-bottom') {
                need(graveCards(s, p).includes(c.cardId), '墓地牌已改变');
                move(s, c.cardId, 'deck');
                spawn(s, a, d);
            }
            if (x.kind === 'death-deck-rebirth') {
                need(graveCards(s, p).includes(c.cardId), '墓地牌已改变');
                place(s, a, c.cardId, d);
                spawn(s, a, d, 2);
            }
            if (x.kind === 'death-deck-funeral-search') {
                need(!librarySearchBlocked(s) && s.players[p].deck.includes(c.cardId), '牌库不能检索或所选牌已改变');
                log(s, `亡者的葬列展示检索牌：${s.cards[c.cardId].name}。`);
                move(s, c.cardId, 'graveyard');
                shuffle(s.players[p].deck);
            }
        }
        finishSpell(s, a);
    }
    return { effect, choice };
}
