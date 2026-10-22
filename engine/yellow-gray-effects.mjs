import { settleTerminatedCard } from './terminated-card.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
import { graveCards, inGrave } from './graveyard-rules.mjs';
import { RuleError } from './core.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { effectiveSubtypes, cardHasKeyword, graveyardLocked } from './derived.mjs';
import { sourceLive } from './batch-rules.mjs';
import { canTerminate } from './holy-deck-rules.mjs';
import { sealHost } from './sealing.mjs';
import { uuid } from './random.mjs';
import { yellowSources } from './yellow-gray-rules.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const assets = (s, p, color, n = 1) => s.players[p].assets.filter(a => (a.factionColors ?? [a.faction?.split('·')[0]]).includes(color)).length >= n;
export function createYellowGrayEffects(ctx) {
    const { move, event, choose, finishSpell, log, shuffle, draw, pay, emit, startHidden, seal, options, prepare } = ctx;
    function activated(s, a) {
        const source = s.cards[a.cardId], plan = a.plan;
        if (!source || !hasCardType(source, 'attachment') || !effectiveSubtypes(s, a.cardId).includes('计划') || !plan || plan.grantedBy || plan.abilityLabel === '推进1' || a.kind !== 'auto-ability')
            return;
        const raw = (s.locations[a.cardId]?.secretPlan ? s.cards[a.cardId] : printedRulesCard(s, a.cardId))?.automation ?? {}, printed = [...(raw.actions ?? [raw.action]), ...(raw.watch ?? []), raw.entryTrigger, raw.prepareTrigger, raw.advanceTrigger].filter(Boolean);
        if (!printed.some(d => d.effect === plan.effect && d.operation === plan.operation))
            return;
        for (const id of yellowSources(s, a.controller, 'plan-ability-time'))
            emit(s, id, { target: 'none', effect: 'yellow-gray', operation: 'source-time', count: 1, abilityLabel: '计划能力发动' }, 'plan-ability', s.locations[id], a.group ?? a.id);
    }
    function inspected(s, a, player, what) {
        if (!['auto-ability', 'hidden-effect', 'environment-ability', 'play-spell'].includes(a.kind))
            return;
        if (a.kind === 'hidden-effect')
            return;
        s.inspectionTriggerStamps ??= {};
        const key = `${a.id}:${player}`;
        if (s.inspectionTriggerStamps[key])
            return;
        s.inspectionTriggerStamps[key] = true;
        for (const id of yellowSources(s, a.controller, 'plan-ability-time'))
            if (player !== a.controller)
                emit(s, id, { target: 'none', effect: 'hidden-contest', abilityLabel: '检视敌方' }, 'enemy-inspection', s.locations[id], a.id, { inspection: what });
    }
    function inspect(s, a, p, ids, player, what, extra = {}) { choose(s, a, 'yellow-inspect', p, ids, { choiceLabel: what === 'hand' ? '检视手牌' : '检视手牌与牌库顶', ...extra }); inspected(s, a, player, what); }
    function watch(s, id, ev, l, group, details) {
        if (ev === 'draw' && s.turn?.step !== 'draw' && !details.drawStep)
            for (const source of s.players.flatMap(p => p.play)) {
                const sl = s.locations[source], c = printedRulesCard(s, source), p = controllerOf(s, source);
                if (sl?.zone === 'play' && !sl.faceDown && c.automation?.static === 'network-scaling' && details.player !== p && effectiveSocietyMarkers(s, p).exposed === 0)
                    emit(s, source, { target: 'none', effect: 'yellow-gray', operation: 'mirror-draw' }, ev, sl, group, { eventCount: details.count });
            }
        if (ev === 'contest-won' && details.contest === 'hidden' && [0, 1].includes(details.winner))
            for (const source of graveCards(s, details.winner)) {
                const c = printedRulesCard(s, source);
                if (c.automation?.graveHiddenReturn)
                    emit(s, source, { target: 'none', effect: 'yellow-gray', operation: 'grave-return' }, ev, s.locations[source], group);
            }
    }
    function spawn(s, a, code, d) {
        if (!d || s.districts[d.district]?.id !== d.cardId)
            return null;
        const template = s.automationCards.find(c => c.catalogId === code);
        if (!template)
            return null;
        const id = uuid();
        s.cards[id] = { ...structuredClone(template), id, owner: a.controller, token: true };
        s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
        s.players[a.controller].reserve.push(id);
        move(s, id, 'play', { controller: a.controller, tapped: false, attachedTo: `district-host:${d.cardId}`, hostVersion: d.cardId, district: d.district });
        event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
        event(s, id, 'attached', s.locations[id], a.id, { host: sealHost(s, `district-host:${d.cardId}`) });
        return id;
    }
    function effect(s, a, plan, targets) {
        const p = a.controller, id = plan.sourceId ?? a.cardId, op = plan.operation;
        if (op === 'read-hand') {
            if (targets[0]) {
                const q = targets[0].player;
                inspect(s, a, p, [...s.players[q].hand], q, 'hand', { drawAfter: plan.drawAfter ? 1 : 0 });
                return true;
            }
        }
        else if (op === 'read-both') {
            if (targets[0]) {
                const q = targets[0].player;
                inspect(s, a, p, [...s.players[q].hand, ...s.players[q].deck.slice(0, 1)], q, 'hand-top', { otherPlayer: q, after: 'draw-or-shuffle' });
                return true;
            }
        }
        else if (op === 'source-time') {
            if (sourceLive(s, plan))
                setCardMarker(s, s.locations[id], "markers", null, (s.locations[id].markers ?? 0) + (plan.count ?? 1));
        }
        else if (op === 'mirror-draw') {
            if (effectiveSocietyMarkers(s, p).exposed === 0)
                draw(s, [p], plan.eventCount ?? 1);
        }
        else if (op === 'grave-return') {
            if (inGrave(s, id, id) && s.locations[id].zoneVersion === plan.sourceZoneVersion && !graveyardLocked(s, id))
                move(s, id, 'hand');
        }
        else if (op === 'flute') {
            if (sourceLive(s, plan))
                move(s, id, 'graveyard', { cause: 'sacrifice' });
            if (targets[0] && !cardHasKeyword(s, targets[0].cardId, '永恒')) {
                if (move(s, targets[0].cardId, 'deck') && s.locations[targets[0].cardId].zone === 'deck') {
                    const deck = s.players[s.cards[targets[0].cardId].owner].deck;
                    deck.splice(deck.indexOf(targets[0].cardId), 1);
                    deck.unshift(targets[0].cardId);
                }
            }
        }
        else if (op === 'website') {
            if (assets(s, p, '黄', 2))
                spawn(s, a, 'TK012', targets[0]);
        }
        else if (op === 'read-seal') {
            if (assets(s, p, '黄'))
                seal(s, a.cardId, sealHost(s, `society:${p}`), { zone: 'aside', zoneVersion: plan.sourceVersion });
        }
        else if (op === 'precognition-time') {
            for (const role of s.players[p].play)
                if (s.locations[role].zone === 'play' && !s.locations[role].faceDown && matchesSpecifiedName(printedRulesCard(s, role), '阿玛多伊斯'))
                    setCardMarker(s, s.locations[role], "markers", null, (s.locations[role].markers ?? 0) + 1);
        }
        else if (op === 'progress') {
            if (targets[0]) {
                const l = s.locations[targets[0].cardId];
                l.counters ??= {};
                setCardMarker(s, l, "counter", "progress", (l.counters.progress ?? 0) + 1);
                event(s, targets[0].cardId, 'progress-change', l, a.id);
            }
        }
        else if (op === 'secret-plan') {
            const ids = s.players[p].hand.filter(x => hasCardType(s.cards[x], 'attachment') && effectiveSubtypes(s, x).includes('计划'));
            if (ids.length) {
                choose(s, a, 'yellow-secret-plan', p, ids, { choiceLabel: '从手牌秘密放置一张计划', canSkip: true });
                return true;
            }
        }
        else if (op === 'sword-hidden') {
            if (assets(s, p, '黄') && s.players[p].assets.some(a => a.magicDomains?.includes('鲜血')))
                draw(s, [p], 1);
        }
        else if (op === 'next-discount')
            s.effects.push({ kind: 'next-cost-discount', controller: p, amount: 1, filter: { any: [{ subtype: '人工智能' }, { subtype: '工程师' }] }, duration: 'until-end-of-round' });
        else if (op === 'margaret-bottom') {
            if (targets[0] && !cardHasKeyword(s, targets[0].cardId, '永恒'))
                move(s, targets[0].cardId, 'deck');
        }
        else if (op === 'counter-discard') {
            const target = targets[0] && s.flow.stack.find(x => x.id === targets[0].entryId);
            if (target && (s.cards[target.cardId]?.printedCost ?? 0) <= (plan.discardedPrintedCost ?? 0) && canTerminate(s, target)) {
                s.flow.stack = s.flow.stack.filter(x => x !== target);
                settleTerminatedCard(s, target, move);
                log(s, '天才玛格丽特终止了目标卡牌。');
            }
        }
        else if (op === 'simulation') {
            if (startHidden(s, a.id, a)) {
                s.hidden.cardBonus = { controller: p, amount: 4 };
                s.hidden.rewardKind = 'predict';
                return true;
            }
        }
        else if (op === 'simulation-eye') {
            if (sourceLive(s, plan))
                s.effects.push({ kind: 'modify-icons', icon: 'investigation', amount: 1, targetId: id, targetZoneVersion: plan.sourceZoneVersion, duration: 'until-end-of-round' });
        }
        else if (op === 'chronos') {
            const d = targets.find(t => t.kind === 'district'), q = targets.find(t => t.kind === 'player')?.player, time = spawn(s, a, 'TK014', d);
            if (time !== null && [0, 1].includes(q) && !graveyardLocked(s, a.cardId, q)) {
                const host = sealHost(s, time), n = plan.sourceCounters?.progress ?? 0;
                for (const x of [...graveCards(s, q, a.cardId)])
                    if (s.cards[x].printedCost < n)
                        seal(s, x, host, { zone: s.locations[x].zone, zoneVersion: s.locations[x].zoneVersion });
            }
        }
        else
            return false;
        finishSpell(s, a);
        return true;
    }
    function choice(s, p, c, x) {
        const a = x.spell;
        if (x.kind === 'yellow-inspect') {
            need(c.confirm === true, '请确认检视完成');
            if (x.after === 'draw-or-shuffle') {
                choose(s, a, 'yellow-draw-shuffle', p, [], { otherPlayer: x.otherPlayer, options: [{ id: 'draw', name: '双方各抓一张牌' }, { id: 'shuffle', name: '双方各洗牌' }, { id: 'none', name: '不执行' }], choiceLabel: '阿玛多伊斯 · 选择后续处理' });
                return;
            }
            if (x.drawAfter)
                draw(s, [p], x.drawAfter);
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'yellow-draw-shuffle') {
            need(['draw', 'shuffle', 'none'].includes(c.cardId), '请选择处理方式');
            if (c.cardId === 'draw')
                draw(s, [p, x.otherPlayer], 1);
            if (c.cardId === 'shuffle') {
                shuffle(s.players[p].deck);
                shuffle(s.players[x.otherPlayer].deck);
            }
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'yellow-secret-plan') {
            if (!c.skip) {
                need(x.cardIds.includes(c.cardId) && s.players[p].hand.includes(c.cardId), '所选计划已失效');
                move(s, c.cardId, 'play', { controller: p, tapped: false, secretPlan: true, attachedTo: `society:${p}`, hostVersion: s.societyVersions?.[p] ?? 0, counters: { progress: 0 } });
                event(s, c.cardId, 'entry', s.locations[c.cardId], a.id, { method: 'secret-plan-placement' });
            }
            finishSpell(s, a);
            return;
        }
    }
    return { effect, choice, watch, activated, inspected };
}
