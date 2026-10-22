import { setCardMarker } from './counter-placement.mjs';
import { addWounds } from './wounds.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { RuleError } from './core.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { sourceLive, sourceDistrictLive } from './batch-rules.mjs';
import { graveCards, inGrave } from './graveyard-rules.mjs';
import { cardHasKeyword, enterTapped } from './derived.mjs';
import { effectiveIcons } from './rounds.mjs';
import { relocate } from './district-rules.mjs';
import { sealHost } from './sealing.mjs';
import { tapCard } from './field-events.mjs';
import { recordOutsideAction } from './green-black-rules.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const front = (s, id) => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown;
export function createGreenBlackEffects(ctx) {
    const { move, event, seal, choose, finishSpell, log, shuffle, destroy, draw, pay, options, librarySearchBlocked } = ctx;
    function activated(s, a) {
        if (a.kind === 'auto-ability' && !a.event && ['fast', 'standard'].includes(a.plan?.timing))
            recordOutsideAction(s, a.cardId);
    }
    function swordsSearch(s, a, q, name) {
        const ids = [...new Set([...(!librarySearchBlocked(s) ? s.players[q].deck : []), ...s.players[q].hand, ...graveCards(s, q, a.cardId)])].filter(id => hasCardType(s.cards[id], 'character') && printedRulesCard(s, id)?.name === name);
        choose(s, a, 'green-swords-search', a.controller, ids, { min: 0, max: Math.min(3, ids.length), otherPlayer: q, matchedName: name, hostRef: sealHost(s, `society:${a.controller}`), choiceLabel: `双剑 · 封印至多三张同名角色牌（${name}）` });
    }
    function effect(s, a, plan, targets) {
        const p = a.controller, id = plan.sourceId ?? a.cardId, op = plan.operation;
        if (op === 'aoi-equip') {
            const t = targets[0], host = s.locations[id];
            if (t && effectiveSocietyMarkers(s, p).exposed === 0 && sourceLive(s, plan) && inGrave(s, t.cardId, id) && options(s, p, { ...s.cards[t.cardId].attachment, cardId: t.cardId, attachmentPlay: true }).some(o => o.id === id)) {
                if (move(s, t.cardId, 'play', { controller: p, tapped: enterTapped(s, t.cardId), attachedTo: id, hostVersion: host.zoneVersion, district: host.district })) {
                    event(s, t.cardId, 'entry', s.locations[t.cardId], a.id, { method: 'effect-placement' });
                    event(s, t.cardId, 'attached', s.locations[t.cardId], a.id, { host: sealHost(s, id) });
                }
            }
        }
        else if (op === 'aoi-barrier') {
            if (sourceLive(s, plan)) {
                tapCard(s, id);
                s.effects.push({ kind: 'barrier', targetId: id, targetZoneVersion: plan.sourceZoneVersion, duration: 'until-end-of-round' });
            }
        }
        else if (op === 'fire-suppression') {
            const counts = s.players.map(pl => pl.play.reduce((n, x) => front(s, x) && hasCardType(s.cards[x], 'character') ? n + effectiveIcons(s, x, true).battle : n, 0));
            if (counts[p] > counts[1 - p]) {
                if (!draw(s, [p], 1))
                    return true;
            }
            else {
                const eligible = options(s, p, { target: 'own-character', nonTargeted: true });
                if (eligible.length) {
                    choose(s, a, 'green-fire-payment', p, [], { options: [{ id: 'pay', name: '支付2并放置一个黑刀标志' }, { id: 'skip', name: '不支付' }], choiceLabel: '火力压制 · 选择是否支付2', targetIds: [] });
                    return true;
                }
            }
        }
        else if (op === 'swords') {
            const t = targets[0];
            if (t) {
                const q = controllerOf(s, t.cardId), name = printedRulesCard(s, t.cardId).name;
                destroy(s, t.cardId);
                swordsSearch(s, a, q, name);
                return true;
            }
        }
        else if (op === 'snowy-move') {
            const t = targets[0];
            if (t && sourceDistrictLive(s, plan) && s.locations[t.cardId].district !== plan.sourceDistrict && relocate(s, t.cardId, plan.sourceDistrict))
                event(s, t.cardId, 'move', s.locations[t.cardId], a.id, { district: plan.sourceDistrict });
        }
        else if (op === 'nisos-entry') {
            if (sourceDistrictLive(s, plan)) {
                beginEventGroup(s, a.id);
                for (const x of s.players[1 - p].play)
                    if (front(s, x) && hasCardType(s.cards[x], 'character') && s.locations[x].district === plan.sourceDistrict && s.locations[x].outsideActionRound === s.round) {
                        addWounds(s, x, 1, { event, group: a.id, details: { count: 1 } });
                    }
                endEventGroup(s);
            }
        }
        else if (op === 'nisos-first') {
            s.effects.push({ kind: 'first-abilities', controller: p, duration: 'until-end-of-round', provenance: { name: s.cards[id].name, abilityText: '准备步骤触发' } });
            if (sourceLive(s, plan)) {
                addWounds(s, id, 1, { event, group: a.id, details: { count: 1 } });
            }
        }
        else if (op === 'nameless-return') {
            if (sourceDistrictLive(s, plan)) {
                const ids = s.players.flatMap(pl => pl.play).filter(x => front(s, x) && hasCardType(s.cards[x], 'character') && s.cards[x].unique && s.locations[x].district === plan.sourceDistrict);
                beginEventGroup(s, a.id);
                for (const x of ids)
                    if (!cardHasKeyword(s, x, '永恒'))
                        move(s, x, 'hand');
                endEventGroup(s);
            }
        }
        else
            return false;
        finishSpell(s, a);
        return true;
    }
    function choice(s, p, c, x) {
        const a = x.spell;
        if (x.kind === 'green-fire-payment') {
            need(['pay', 'skip'].includes(c.cardId), '请选择是否支付');
            if (c.cardId === 'pay') {
                const eligible = options(s, p, { target: 'own-character', nonTargeted: true });
                if (eligible.length) {
                    choose(s, a, 'green-fire-target', p, [], { options: eligible, canSkip: true, choiceLabel: '火力压制 · 选择本方角色并支付2放置黑刀标志' });
                    return;
                }
            }
        }
        else if (x.kind === 'green-fire-target') {
            if (c.skip) {
                finishSpell(s, a);
                return;
            }
            need(x.options.some(o => o.id === c.cardId) && front(s, c.cardId) && controllerOf(s, c.cardId) === p, '请选择合法本方角色');
            pay(s, p, 2);
            const l = s.locations[c.cardId];
            l.counters ??= {};
            setCardMarker(s, l, "counter", "battle", (l.counters.battle ?? 0) + 1);
        }
        else if (x.kind === 'green-swords-search') {
            const ids = c.cardIds;
            need(Array.isArray(ids) && ids.length <= 3 && new Set(ids).size === ids.length && ids.every(id => x.cardIds.includes(id) && [...s.players[x.otherPlayer].hand, ...(!librarySearchBlocked(s) ? s.players[x.otherPlayer].deck : []), ...graveCards(s, x.otherPlayer, a.cardId)].includes(id) && hasCardType(s.cards[id], 'character') && printedRulesCard(s, id).name === x.matchedName), '请选择至多三张同名角色牌');
            beginEventGroup(s, a.id);
            for (const id of ids) {
                log(s, `双剑展示并封印：${s.cards[id].name}。`);
                seal(s, id, x.hostRef, { zone: s.locations[id].zone, zoneVersion: s.locations[id].zoneVersion });
            }
            endEventGroup(s);
            shuffle(s.players[x.otherPlayer].deck);
            log(s, `${s.seats[x.otherPlayer].name}将牌库洗牌。`);
        }
        else
            return false;
        finishSpell(s, a);
        return true;
    }
    return { effect, choice, activated };
}
