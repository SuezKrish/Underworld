import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { secrecyLevel } from './secrecy-counts.mjs';
import { simultaneousChoice, commitChoice, withSimultaneousDepartures } from './simultaneous-choice.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { graveCards, inGrave, isGraveZone } from './graveyard-rules.mjs';
import { RuleError } from './core.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType, hasAnyCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { effectiveSubtypes, cardHasKeyword, enterTapped, graveyardLocked, takeControl } from './derived.mjs';
import { sealHost, liveSealHost, sealedOn } from './sealing.mjs';
import { discardMany } from './discard-events.mjs';
import { observeHiddenInspection } from './card-inspection.mjs';
import { attachmentHostLegal, sacrificeEffectBlocked } from './derived.mjs';
import { canTerminate } from './holy-deck-rules.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export { secrecyLevel } from './secrecy-counts.mjs';
export function createDiscardDeckEffects(ctx) {
    const { move, event, choose, finishSpell, log, shuffle, seal, draw, startHidden, uuid } = ctx;
    const roleIds = (s, p, type = 'character') => s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(printedRulesCard(s, id), type) && !cardHasKeyword(s, id, '永恒'));
    function discardOne(s, a, p, next = {}) {
        if (!s.players[p].hand.length) {
            afterDiscard(s, a, p, null, next);
            return;
        }
        choose(s, a, 'discard-deck-discard', p, [...s.players[p].hand], { next, choiceLabel: '选择一张手牌弃掉' });
    }
    function afterDiscard(s, a, p, id, next) {
        if (next.cast && id && inGrave(s, id)) {
            choose(s, a, 'discard-deck-cast', p, [id], { cardVersion: s.locations[id].zoneVersion, canSkip: true, choiceLabel: '卡迪纳家族线人 · 当场从墓地付费打出' });
            return;
        }
        if (next.repeat > 0) {
            repeatDrawDiscard(s, a, p, next.repeat);
            return;
        }
        finishSpell(s, a);
    }
    function repeatDrawDiscard(s, a, target, times) {
        if (times <= 0 || !draw(s, [a.controller], 1)) {
            finishSpell(s, a);
            return;
        }
        discardOne(s, a, target, { repeat: times - 1 });
    }
    function bounceBoth(s, a, players, type) {
        if (!simultaneousChoice(s, choose, a, 'discard-deck-bounce', players.map(controller => ({ controller, cardIds: roleIds(s, controller, type), cardType: type })), { cardType: type, choiceLabel: '每位玩家返回一个自己操控的' + (type === 'character' ? '角色' : '附属') }))
            finishSpell(s, a);
    }
    function planTop(s, a, remaining, canSacrifice) {
        const ids = s.players[a.controller].deck.slice(0, 2);
        if (ids.length) {
            log(s, '计划：归来展示：' + ids.map(id => s.cards[id].name).join('、'));
            choose(s, a, 'discard-deck-plan-top', a.controller, ids, { remaining, canSacrifice, public: true, choiceLabel: '计划：归来 · 一张入墓或封印，另一张置底' });
            return;
        }
        planNext(s, a, remaining, canSacrifice);
    }
    function planNext(s, a, remaining, canSacrifice) {
        if (remaining > 0) {
            planTop(s, a, remaining - 1, false);
            return;
        }
        if (canSacrifice) {
            choose(s, a, 'discard-deck-plan-sacrifice', a.controller, roleIds(s, a.controller), { canSkip: true, public: true, choiceLabel: '计划：归来 · 可牺牲一个角色，按状态附属费用总和重复' });
            return;
        }
        finishSpell(s, a);
    }
    function drink(s, a, plan, targets) {
        const target = plan.drinkTarget ? targets[0] : { cardId: plan.sourceId, zoneVersion: plan.sourceZoneVersion }, l = s.locations[target?.cardId];
        if (l?.zone !== 'play' || l.faceDown || l.zoneVersion !== target.zoneVersion) {
            finishSpell(s, a);
            return false;
        }
        const ids = [...graveCards(s, a.controller), ...sealedOn(s, `society:${a.controller}`)].filter(id => printedRulesCard(s, id).name === '鲜血' && hasCardType(s.cards[id], 'attachment') && !(inGrave(s, id) && graveyardLocked(s)) && ctx.options(s, a.controller, { target: 'vampire-character', effect: 'attach', cardId: id }).some(o => o.id === target.cardId));
        if (!ids.length) {
            finishSpell(s, a);
            return false;
        }
        const count = plan.count ?? 1;
        choose(s, a, count > 1 ? 'discard-deck-drink-multiple' : 'discard-deck-drink', a.controller, ids, { drinkHost: target, canSkip: true, public: true, min: 0, max: Math.min(count, ids.length), versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])), choiceLabel: `饮血${count} · 选择墓地或秘社封印中的鲜血` });
        return true;
    }
    function protectionCosts(s, p, plan) {
        const l = s.locations[plan.subjectId];
        if (l?.zone !== 'play' || l.faceDown || l.zoneVersion !== plan.subjectZoneVersion)
            return [];
        return s.players[p].play.filter(id => { const a = s.locations[id]; return a?.zone === 'play' && !a.faceDown && a.attachedTo === plan.subjectId && a.hostVersion === plan.subjectZoneVersion && hasCardType(s.cards[id], 'attachment') && !sacrificeEffectBlocked(s, id) && attachmentHostLegal(s, id); });
    }
    function timeIds(s, p, number, greater) { return s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasAnyCardType(s.cards[id], ['character', 'attachment']) && !cardHasKeyword(s, id, '永恒') && (greater ? s.cards[id].printedCost > number : s.cards[id].printedCost < number)); }
    function timeChoose(s, a, players, number, greater) {
        if (!simultaneousChoice(s, choose, a, 'discard-deck-time-card', players.map(controller => ({ controller, cardIds: timeIds(s, controller, number, greater) })), { number, greater, choiceLabel: '时空紊乱 · 各自选择一张牌洗回其拥有者牌库' }))
            finishSpell(s, a);
    }
    function effect(s, a, plan, targets) {
        const p = a.controller, t = targets[0];
        ;
        if (plan.operation === 'discard-one') {
            discardOne(s, a, t.player);
            return true;
        }
        ;
        ;
        if (plan.operation === 'drink-blood') {
            drink(s, a, plan, targets);
            return true;
        }
        if (plan.operation === 'conditional-drink') {
            if (plan.requireHidden && !effectiveSocietyMarkers(s, p).hidden || plan.optionalOrHidden && !plan.sourceSnapshot?.optionalExtraPaid && !plan.sourceSnapshot?.waivedOptionalExtraCosts && !effectiveSocietyMarkers(s, p).hidden)
                return false;
            drink(s, a, plan, targets);
            return true;
        }
        if (plan.operation === 'vampire-protection') {
            if (s.flow.stack.some(x => x.id === plan.targetedEntryId)) {
                const ids = protectionCosts(s, p, plan);
                if (ids.length) {
                    choose(s, a, 'discard-deck-protection', p, ids, { canSkip: true, public: true, choiceLabel: '雾羽弥生 · 牺牲结附于该角色的本方附属' });
                    return true;
                }
            }
            return false;
        }
        if (plan.operation === 'phoenix-top') {
            const top = s.players[p].deck.slice(0, 6), eligible = top.filter(id => hasCardType(s.cards[id], 'attachment') && effectiveSubtypes(s, id).some(t => ['装备', '武器', '状态'].includes(t)));
            choose(s, a, 'discard-deck-phoenix', p, top, { eligibleIds: eligible, min: 0, max: eligible.length, choiceLabel: '菲尼克斯 · 检视六张，选择附属加入手中' });
            return true;
        }
        if (plan.operation === 'hidden-start') {
            if (startHidden(s, a.id, a)) {
                if (plan.bonusScope === 'player')
                    s.hidden.environmentBonus = { [p]: plan.bonus };
                else
                    s.hidden.cardBonus = { controller: p, amount: plan.bonus, subtypes: plan.bonusSubtypes };
                return true;
            }
            return false;
        }
        if (plan.operation === 'rigoletto-seal') {
            if (!graveyardLocked(s) && graveCards(s, p).length) {
                choose(s, a, 'discard-deck-rigoletto', p, [...graveCards(s, p)], { public: true, choiceLabel: '巡游的里戈莱托 · 选择墓地牌封印' });
                return true;
            }
        }
        if (plan.operation === 'francois-return') {
            if (s.hiddenWins?.[p] === s.round && s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId && !graveyardLocked(s) && move(s, t.cardId, 'play', { controller: p, district: plan.sourceDistrict, tapped: enterTapped(s, t.cardId, plan.sourceDistrict) }))
                event(s, t.cardId, 'entry', s.locations[t.cardId], a.id, { method: 'effect-placement' });
        }
        if (plan.operation === 'draw-discard-repeat') {
            repeatDrawDiscard(s, a, t.player, 1 + effectiveSocietyMarkers(s, p).hidden);
            return true;
        }
        ;
        ;
        ;
        ;
        ;
        ;
        ;
        return false;
    }
    function afterHidden(s, a, winner) {
        if (a.plan.hiddenAfter === 'hallucination' && winner === a.controller) {
            const original = s.flow.stack.find(x => x.id === a.targets[0]?.entryId);
            if (original) {
                const host = sealHost(s, original.cardId ?? original.sourceId);
                original.hallucination = { controller: a.controller, host };
                log(s, '幻视：原能力每次结算时改为封印一个本方非指示物角色；无法做到则执行原效果。');
            }
        }
        finishSpell(s, a);
    }
    function replacement(s, a) {
        const r = a.hallucination;
        if (!r)
            return false;
        const ids = roleIds(s, r.controller).filter(id => !s.cards[id].token && id !== r.host?.hostId);
        if (!liveSealHost(s, r.host) || !ids.length)
            return false;
        choose(s, a, 'discard-deck-hallucination', r.controller, ids, { public: true, choiceLabel: '幻视 · 选择一个非指示物角色封印到原能力来源' });
        return true;
    }
    function choice(s, p, c, x) {
        const a = x.spell, plan = a.plan;
        if (x.kind === 'discard-deck-phoenix') {
            const ids = c.cardIds;
            need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => x.eligibleIds.includes(id)) && x.cardIds.every((id, i) => s.players[p].deck[i] === id), '请选择检视牌中的装备、武器或状态附属');
            for (const id of ids)
                move(s, id, 'hand');
            shuffle(s.players[p].deck);
            log(s, '菲尼克斯展示并加入手中：' + (ids.map(id => s.cards[id].name).join('、') || '无') + '；其余牌洗回牌库。');
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'discard-deck-multiple') {
            const ids = c.cardIds;
            need(Array.isArray(ids) && ids.length === x.count && new Set(ids).size === ids.length && ids.every(id => x.cardIds.includes(id) && s.players[p].hand.includes(id)), '请选择全部待弃牌');
            discardMany(s, ids, move, event, { cause: 'discard', effectController: a.controller });
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'discard-deck-cast') {
            if (!c.skip) {
                need(c.cardId === x.cardIds[0] && inGrave(s, c.cardId) && s.locations[c.cardId].zoneVersion === x.cardVersion, '刚弃掉的牌已经离开墓地');
                ctx.castDuringResolution(s, p, { ...c, type: 'play', id: uuid() }, x);
            }
            finishSpell(s, a);
            return;
        }
        if (x.canSkip && c.skip === true) {
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'discard-deck-discard') {
            need(x.cardIds.includes(c.cardId) && s.players[p].hand.includes(c.cardId), '请选择当前手牌');
            discardMany(s, [c.cardId], move, event, { cause: 'discard', effectController: a.controller });
            afterDiscard(s, a, p, c.cardId, x.next);
            return;
        }
        if (x.kind === 'discard-deck-bounce') {
            if (x.simultaneous) {
                const selections = commitChoice(x, p, { cardId: c.cardId }, (own, c) => need(own.cardIds.includes(c.cardId) && roleIds(s, p, x.cardType).includes(c.cardId), '请选择当前可返回的本方牌'));
                if (selections) {
                    beginEventGroup(s, a.id);
                    try {
                        withSimultaneousDepartures(s, selections.map(x => x.command.cardId), () => {
                            for (const y of selections)
                                if (roleIds(s, y.player, x.cardType).includes(y.command.cardId))
                                    move(s, y.command.cardId, 'hand');
                        });
                    }
                    finally {
                        endEventGroup(s);
                    }
                    finishSpell(s, a);
                }
            }
            else {
                need(x.cardIds.includes(c.cardId) && roleIds(s, p, x.cardType).includes(c.cardId), '请选择当前可返回的本方牌');
                move(s, c.cardId, 'hand');
                bounceBoth(s, a, x.remainingPlayers, x.cardType);
            }
            return;
        }
        if (x.kind === 'discard-deck-name') {
            need(x.options.some(o => o.id === c.cardId), '请选择卡牌名称');
            const hand = s.players[x.targetPlayer].hand;
            log(s, `雾羽才藏说出：${c.cardId}。`);
            const ids = hand.filter(id => printedRulesCard(s, id).name === c.cardId);
            if (ids.length) {
                choose(s, a, 'discard-deck-named-discard', x.targetPlayer, ids, { public: false, choiceLabel: '雾羽才藏 · 弃掉一张所说名称的手牌' });
            }
            else {
                observeHiddenInspection(s, p, hand, event, a.id);
                choose(s, a, 'discard-deck-inspect', p, [...hand], { choiceLabel: '雾羽才藏 · 私人检视敌方手牌' });
            }
            return;
        }
        if (x.kind === 'discard-deck-named-discard') {
            need(x.cardIds.includes(c.cardId) && s.players[p].hand.includes(c.cardId), '请选择指定名称的手牌');
            discardMany(s, [c.cardId], move, event, { cause: 'discard', effectController: a.controller });
        }
        if (x.kind === 'discard-deck-inspect')
            need(c.confirm === true, '请确认检视结束');
        if (x.kind === 'discard-deck-cain') {
            need(x.options.some(o => o.id === c.cardId), '请选择其他地区的合法角色');
            const l = s.locations[plan.sourceId];
            if (isGraveZone(s, l.zone) && l.zoneVersion === plan.sourceZoneVersion + 1 && !graveyardLocked(s) && ctx.options(s, p, { target: 'blood-or-death-character', cardId: plan.sourceId }).some(o => o.id === c.cardId)) {
                move(s, plan.sourceId, 'play', { controller: p, district: s.locations[c.cardId].district, tapped: false, attachedTo: c.cardId, hostVersion: s.locations[c.cardId].zoneVersion });
                event(s, plan.sourceId, 'entry', s.locations[plan.sourceId], a.id, { method: 'effect-placement' });
                event(s, plan.sourceId, 'attached', s.locations[plan.sourceId], a.id, { host: sealHost(s, c.cardId) });
            }
        }
        if (x.kind === 'discard-deck-rigoletto') {
            need(x.cardIds.includes(c.cardId) && graveCards(s, p).includes(c.cardId), '请选择墓地中的牌');
            const t = a.targets[0], nightmare = effectiveSubtypes(s, c.cardId).includes('梦魇');
            if (s.locations[t.cardId]?.zone === 'play' && s.locations[t.cardId].zoneVersion === t.zoneVersion && seal(s, c.cardId, sealHost(s, t.cardId), { zone: s.locations[c.cardId].zone, zoneVersion: s.locations[c.cardId].zoneVersion }) && nightmare)
                takeControl(s, t.cardId, p, { duration: 'until-end-of-round' });
        }
        if (['discard-deck-drink', 'discard-deck-drink-multiple'].includes(x.kind)) {
            const ids = x.kind === 'discard-deck-drink-multiple' ? c.cardIds : [c.cardId], h = x.drinkHost ?? { cardId: plan.sourceId, zoneVersion: plan.sourceZoneVersion }, l = s.locations[h.cardId];
            need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.length <= (x.max ?? 1) && ids.every(id => x.cardIds.includes(id)), '请选择至多指定数量的不同鲜血');
            if (l?.zone === 'play' && l.zoneVersion === h.zoneVersion && !l.faceDown) {
                need(ids.every(id => printedRulesCard(s, id).name === '鲜血' && (graveCards(s, p).includes(id) || sealedOn(s, `society:${p}`).includes(id)) && (!x.versions || x.versions[id] === s.locations[id].zoneVersion)), '鲜血已经改变区域');
                beginEventGroup(s, a.id);
                try {
                    for (const id of ids)
                        if ((!graveyardLocked(s) || !inGrave(s, id)) && ctx.options(s, p, { target: 'vampire-character', effect: 'attach', cardId: id }).some(o => o.id === h.cardId) && move(s, id, 'play', { controller: p, district: l.district, tapped: false, attachedTo: h.cardId, hostVersion: l.zoneVersion })) {
                            event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
                            event(s, id, 'attached', s.locations[id], a.id, { host: sealHost(s, h.cardId) });
                        }
                }
                finally {
                    endEventGroup(s);
                }
            }
        }
        if (x.kind === 'discard-deck-protection') {
            need(x.cardIds.includes(c.cardId), '请选择结附于受保护角色的本方附属');
            const original = s.flow.stack.find(e => e.id === plan.targetedEntryId);
            if (original && protectionCosts(s, p, plan).includes(c.cardId) && move(s, c.cardId, 'graveyard', { cause: 'sacrifice' })) {
                if (canTerminate(s, original)) {
                    s.flow.stack = s.flow.stack.filter(e => e !== original);
                    if (!original.copied)
                        move(s, original.cardId, 'graveyard', { cause: 'terminated' });
                    log(s, '雾羽弥生牺牲附属，终止敌方卡牌。');
                }
                else
                    log(s, '雾羽弥生已牺牲附属，但敌方卡牌不能被终止。');
            }
        }
        if (x.kind === 'discard-deck-plan-top') {
            need(x.cardIds.includes(c.cardId) && x.cardIds.every((id, i) => s.players[p].deck[i] === id) && ['grave', 'seal'].includes(c.mode), '请选择展示牌及入墓或封印');
            for (const id of x.cardIds)
                if (id === c.cardId) {
                    if (c.mode === 'seal')
                        seal(s, id, sealHost(s, `society:${p}`));
                    else
                        move(s, id, 'graveyard');
                }
                else
                    move(s, id, 'deck');
            planNext(s, a, x.remaining, x.canSacrifice);
            return;
        }
        if (x.kind === 'discard-deck-plan-sacrifice') {
            need(roleIds(s, p).includes(c.cardId), '请选择可牺牲的本方角色');
            const l = s.locations[c.cardId], xCount = Object.entries(s.locations).filter(([id, al]) => al.zone === 'play' && !al.faceDown && al.attachedTo === c.cardId && al.hostVersion === l.zoneVersion && hasCardType(s.cards[id], 'attachment') && effectiveSubtypes(s, id).includes('状态')).reduce((n, [id]) => n + s.cards[id].printedCost, 0);
            move(s, c.cardId, 'graveyard', { cause: 'sacrifice' });
            if (xCount > 0) {
                planTop(s, a, xCount - 1, false);
                return;
            }
        }
        if (x.kind === 'discard-deck-time-number') {
            need(Number.isSafeInteger(c.number) && c.number >= 0 && c.number <= x.maxNumber && (!c.greater || x.canChooseGreater), '数字或大于模式不合法');
            log(s, `时空紊乱说出${c.number}，每位玩家选择印刷费用${c.greater ? '大于' : '小于'}该数字的角色或附属。`);
            timeChoose(s, a, [s.turn.firstPlayer, 1 - s.turn.firstPlayer], c.number, !!c.greater);
            return;
        }
        if (x.kind === 'discard-deck-time-card') {
            if (x.simultaneous) {
                const selections = commitChoice(x, p, { cardId: c.cardId }, (own, c) => need(own.cardIds.includes(c.cardId) && timeIds(s, p, x.number, x.greater).includes(c.cardId), '请选择符合费用要求的本方牌'));
                if (selections) {
                    const owners = new Set();
                    beginEventGroup(s, a.id);
                    try {
                        withSimultaneousDepartures(s, selections.map(x => x.command.cardId), () => {
                            for (const y of selections)
                                if (timeIds(s, y.player, x.number, x.greater).includes(y.command.cardId)) {
                                    owners.add(s.cards[y.command.cardId].owner);
                                    move(s, y.command.cardId, 'deck');
                                }
                        });
                    }
                    finally {
                        endEventGroup(s);
                    }
                    for (const owner of owners)
                        shuffle(s.players[owner].deck);
                    finishSpell(s, a);
                }
            }
            else {
                need(x.cardIds.includes(c.cardId) && s.locations[c.cardId].zone === 'play' && controllerOf(s, c.cardId) === p, '请选择符合费用要求的本方牌');
                const owner = s.cards[c.cardId].owner;
                move(s, c.cardId, 'deck');
                shuffle(s.players[owner].deck);
                timeChoose(s, a, x.remainingPlayers, x.number, x.greater);
            }
            return;
        }
        if (x.kind === 'discard-deck-hallucination') {
            need(x.cardIds.includes(c.cardId) && roleIds(s, p).includes(c.cardId) && !s.cards[c.cardId].token, '请选择本方非指示物角色');
            if (!liveSealHost(s, a.hallucination.host) || !seal(s, c.cardId, a.hallucination.host)) {
                ctx.resolveOriginal(s, a);
                return;
            }
            log(s, '幻视：完成封印，原能力按替代效果结算。');
        }
        finishSpell(s, a);
    }
    return { effect, choice, afterHidden, replacement };
}
