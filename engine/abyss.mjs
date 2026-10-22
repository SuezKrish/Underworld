import { effectObjectsLog } from './action-log.mjs';
import { deckWasShuffled } from './deck-shuffle-events.mjs';
import { graveCards } from './graveyard-rules.mjs';
import { uuid, randomValues } from './random.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { librarySearchBlocked } from './library-search.mjs';
import { tapCard } from './field-events.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { hasCardType, hasAnyCardType } from './card-types.mjs';
import { RuleError, pushAbility } from './core.mjs';
import { controllerOf, identity } from './ownership.mjs';
import { sealHost, liveSealHost } from './sealing.mjs';
import { enterTapped, sacrificeEffectBlocked } from './derived.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const domains = ['星辰', '心灵'];
const starHeart = (s, id) => domains.some(d => effectiveMagicDomains(s, id).includes(d));
const faceCharacter = (s, id) => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character');
const beastInPlay = (s, p) => s.players[p].play.some(id => !s.locations[id].faceDown && s.cards[id].subtitle === '深渊兽');
function allowedHost(s, p, l) { const h = l?.zone === 'sealed' && sealHost(s, l.hostId); return h && h.version === l.hostVersion && (h.kind === 'society' ? h.owner === p : h.kind === 'card' && s.locations[h.hostId].zone === 'play' && hasAnyCardType(s.cards[h.hostId], ['character', 'attachment'])); }
export function printedHandActionCost(s, p, id, base) { const reduction = s.cards[id].owner === p ? s.players[p].play.filter(source => faceCharacter(s, source) && false === 'dis-pater').length : 0; return Math.max(0, base - reduction); }
export const abyssHiddenBonus = (s, p) => s.abyssHiddenBonus?.round === s.round ? (s.abyssHiddenBonus.values[p] ?? 0) : 0;
function shuffle(cards) {
    for (let i = cards.length - 1; i > 0; i--) {
        const limit = 0x100000000 - 0x100000000 % (i + 1);
        let n;
        do {
            n = randomValues(new Uint32Array(1))[0];
        } while (n >= limit);
        const j = n % (i + 1);
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    ;
    deckWasShuffled(cards);
}
export function createAbyssEngine({ repeatResolved, move, seal, log, pay, hasPriority, standardAction, announce, openWindow, stateBased, draw, event, trigger, registerGroup, resume, targetOptions, targetRefs }) {
    const active = s => s.mode === 'automation-play';
    function handAllowed(s, p, id) { const c = printedRulesCard(s, id), l = s.locations[id]; return false; }
    function disUse(s, id) { return `${id}:${s.locations[id].fieldVersion ?? s.locations[id].zoneVersion}:dis-pater`; }
    function orderUse(s, id, d) { return `${id}:${s.locations[id].fieldVersion ?? s.locations[id].zoneVersion}:abyss-order:${d}`; }
    function used(s, key) { return s.abyssUses?.[key] === s.round; }
    function use(s, key) { s.abyssUses ??= {}; s.abyssUses[key] = s.round; }
    function finish(s, a) {
        s.effectChoice = null;
        log(s, `${s.cards[a.cardId].name}的能力结算完成。`);
        if (s.status === 'playing')
            stateBased(s);
        repeatResolved?.(s, a);
    }
    function choice(s, a, mode, ids, extra = {}) { s.flow.locked = true; s.effectChoice = { id: uuid(), kind: 'abyss', mode, controller: a.controller, cardIds: ids, ability: a, ...extra }; }
    function sealedCharacters(s, p) { return Object.keys(s.cards).filter(id => hasCardType(s.cards[id], 'character') && starHeart(s, id) && allowedHost(s, p, s.locations[id])); }
    function recover(s, a) { const ids = graveCards(s, a.controller).filter(id => starHeart(s, id)); choice(s, a, 'recover', ids, { public: true }); }
    function lowestEnemies(s, p) { const ids = s.players[1 - p].play.filter(id => faceCharacter(s, id)), min = Math.min(...ids.map(id => s.cards[id].printedCost)); return ids.filter(id => s.cards[id].printedCost === min); }
    function resolve(s, a) {
        const effect = a.kind === 'abyss-ability' ? a.effect : a.plan?.effect;
        if (!['abyss-enter', 'abyss-search', 'abyss-release', 'abyss-recover', 'abyss-baldek', 'abyss-order'].includes(effect))
            return false;
        const p = a.controller;
        if (effect === 'abyss-enter') {
            const l = s.locations[a.cardId], t = a.targets[0];
            if (l?.zone === a.sourceRef.zone && l.zoneVersion === a.sourceRef.zoneVersion && s.districts[t.district]?.id === t.cardId && true) {
                if (move(s, a.cardId, 'play', { controller: p, district: t.district, tapped: enterTapped(s, a.cardId), faceDown: false }))
                    event(s, a.cardId, 'entry', s.locations[a.cardId], a.id, { method: 'effect-placement' });
            }
            else
                log(s, '深渊兽来源或目标地区已经改变，未放置进场。');
            finish(s, a);
        }
        else if (effect === 'abyss-search') {
            if (librarySearchBlocked(s)) {
                log(s, '稻荷神社童子：跳过深渊兽检索，牌库仍洗牌。');
                shuffle(s.players[p].deck);
                finish(s, a);
            }
            else
                choice(s, a, 'search', s.players[p].deck.filter(id => s.cards[id].subtitle === '深渊兽'), { private: true });
        }
        else if (effect === 'abyss-release') {
            const t = a.targets[0];
            const ids = sealedCharacters(s, p);
            if (s.districts[t.district]?.id === t.cardId && true && ids.length)
                choice(s, a, 'release', ids, { public: true });
            else
                finish(s, a);
        }
        else if (effect === 'abyss-recover') {
            if (s.players[p].hand.length)
                choice(s, a, 'discard', s.players[p].hand, { private: true, optional: true });
            else
                finish(s, a);
        }
        else if (effect === 'abyss-baldek') {
            const ids = lowestEnemies(s, p);
            if (ids.length)
                choice(s, a, 'baldek', ids, { public: true, hostRef: a.plan.eventHost });
            else
                finish(s, a);
        }
        else if (effect === 'abyss-order') {
            const l = s.locations[a.subjectId];
            if (l?.zone === 'sealed' && l.zoneVersion === a.subjectVersion && l.hostId === a.hostRef.hostId && liveSealHost(s, a.hostRef)) {
                move(s, a.subjectId, 'deck');
                draw(s, [p], 1);
            }
            else
                log(s, '深渊之序：原封印对象已经改变，未回底或抓牌。');
            finish(s, a);
        }
        return true;
    }
    function command(s, p, c) {
        if (!active(s))
            return false;
        if (c.type === 'abyss-trigger') {
            const a = s.triggerChoices.find(a => a.id === c.triggerId && a.kind === 'abyss-ability' && a.controller === p);
            need(a, '当前没有属于你的深渊兽触发选择');
            need(typeof c.fire === 'boolean', '请选择是否发动');
            if (c.fire) {
                need(a.domains.includes(c.domain) && !used(s, a.usageKeys[c.domain]), '该魔法领域本回合已发动，或领域选择不合法');
                use(s, a.usageKeys[c.domain]);
                trigger(s, { ...a, domain: c.domain });
            }
            s.triggerChoices = s.triggerChoices.filter(x => x !== a);
            if (!s.triggerChoices.length && !s.effectChoice)
                resume(s);
            return true;
        }
        if (c.type === 'abyss-choice') {
            const q = s.effectChoice;
            need(q?.kind === 'abyss' && q.id === c.choiceId && q.controller === p, '当前没有属于你的深渊兽结算选择');
            const a = q.ability;
            if (q.mode === 'search') {
                need(!librarySearchBlocked(s), '稻荷神社童子在场时不能检索牌库');
                need(c.fail === true || q.cardIds.includes(c.cardId) && s.players[p].deck.includes(c.cardId), '请选择合法深渊兽牌或查找失败');
                if (!c.fail) {
                    log(s, `${s.seats[p].name}展示检索的${s.cards[c.cardId].name}。`);
                    move(s, c.cardId, 'hand');
                }
                shuffle(s.players[p].deck);
                finish(s, a);
            }
            else if (q.mode === 'release') {
                need(q.cardIds.includes(c.cardId) && sealedCharacters(s, p).includes(c.cardId), '请选择合法封印角色');
                const t = a.targets[0];
                if (s.districts[t.district]?.id === t.cardId && true) {
                    if (move(s, c.cardId, 'play', { controller: p, district: t.district, tapped: enterTapped(s, c.cardId), faceDown: false }))
                        event(s, c.cardId, 'entry', s.locations[c.cardId], a.id, { method: 'effect-placement' });
                }
                finish(s, a);
            }
            else if (q.mode === 'discard') {
                if (c.skip === true)
                    finish(s, a);
                else {
                    need(q.cardIds.includes(c.cardId) && s.players[p].hand.includes(c.cardId), '请选择合法手牌');
                    move(s, c.cardId, 'graveyard', { cause: 'discard', effectController: a.controller });
                    recover(s, a);
                }
            }
            else if (q.mode === 'recover') {
                const ids = c.cardIds;
                need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.length <= 2 && ids.every(id => q.cardIds.includes(id) && graveCards(s, p).includes(id)), '请选择至多两张合法墓地牌');
                need(ids.length < 2 || domains.some(d => s.cards[ids[0]].magicDomains.includes(d) && s.cards[ids[1]].magicDomains.includes(domains.find(x => x !== d))), '只能各取一张星辰和心灵牌');
                for (const id of ids)
                    move(s, id, 'hand');
                finish(s, a);
            }
            else if (q.mode === 'baldek') {
                need(q.cardIds.includes(c.cardId) && lowestEnemies(s, p).includes(c.cardId), '请选择当前印刷费用最低的敌方角色');
                const l = s.locations[c.cardId];
                if (!l.tapped) {
                    tapCard(s, c.cardId);
                    finish(s, a);
                }
                else {
                    const ids = s.players[p].play.filter(id => faceCharacter(s, id) && !sacrificeEffectBlocked(s, id));
                    choice(s, a, 'sacrifice', ids, { public: true, optional: true, hostRef: q.hostRef, enemyRef: { id: c.cardId, zoneVersion: l.zoneVersion } });
                }
            }
            else if (q.mode === 'sacrifice') {
                if (c.skip === true)
                    finish(s, a);
                else {
                    need(q.cardIds.includes(c.cardId) && faceCharacter(s, c.cardId) && controllerOf(s, c.cardId) === p && !sacrificeEffectBlocked(s, c.cardId), '请选择本方角色牺牲');
                    move(s, c.cardId, 'graveyard', { cause: 'sacrifice' });
                    const t = q.enemyRef;
                    if (faceCharacter(s, t.id) && s.locations[t.id].zoneVersion === t.zoneVersion)
                        seal(s, t.id, q.hostRef, { zone: 'play', zoneVersion: t.zoneVersion });
                    finish(s, a);
                }
            }
            else
                throw new RuleError('未知深渊兽选择');
            if (!s.effectChoice && s.status === 'playing')
                openWindow(s);
            return true;
        }
        if (!['abyss-hand', 'abyss-field'].includes(c.type))
            return false;
        hasPriority(s, p);
        need(!s.triggerChoices.length && !s.effectChoice, '请先完成当前选择');
        const card = printedRulesCard(s, c.cardId), l = s.locations[c.cardId];
        need(card, '卡牌不存在');
        if (c.type === 'abyss-field')
            need(!abilitiesSuppressed(s, card.id), '本地区禁音使阻止角色发动能力');
        if (c.type === 'abyss-field') {
            need(faceCharacter(s, c.cardId) && controllerOf(s, c.cardId) === p && false === 'dis-pater', '只能发动本方狄斯·帕忒尔的能力');
            standardAction(s, p);
            need(!used(s, disUse(s, c.cardId)), '本回合该能力已经发动');
            const targets = targetRefs(s, p, c, { target: 'district' });
            pay(s, p, 2);
            use(s, disUse(s, c.cardId));
            s.flow = pushAbility(s.flow, p, { id: c.id, kind: 'abyss-ability', cardId: c.cardId, controller: p, displayName: card.name, effect: 'abyss-release', targets });
            log(s, `狄斯·帕忒尔的放置进场能力进入堆叠，支付2点费用${effectObjectsLog(s, targets)}。`);
            return true;
        }
        need(handAllowed(s, p, c.cardId), '当前区域不能发动该牌的印刷手牌行动能力');
        const def = false;
        if (!def.fast)
            standardAction(s, p);
        const targets = [];
        need(true || !(c.targetIds ?? []).length, '此能力无需目标');
        const host = sealHost(s, `society:${p}`), costIds = [c.cardId, c.otherHandId];
        need(s.players[p].hand.includes(c.otherHandId) && c.otherHandId !== c.cardId, '请选择一张其他手牌作为封印费用');
        need(costIds.every(id => !s.cards[id]?.token), '指示物角色不能支付封印额外费用');
        const cost = printedHandActionCost(s, p, c.cardId, def.cost), sourceRef = { zone: l.zone, zoneVersion: l.zoneVersion }, group = `cost:${c.id}`;
        pay(s, p, cost);
        beginEventGroup(s, group);
        for (const id of costIds) {
            const before = { zone: s.locations[id].zone, zoneVersion: s.locations[id].zoneVersion };
            const sealed = seal(s, id, host, before, { cause: 'cost' });
            need(sealed || s.locations[id].zoneVersion !== before.zoneVersion, '封印费用不能支付');
        }
        endEventGroup(s);
        s.flow = pushAbility(s.flow, p, { id: c.id, kind: 'abyss-ability', cardId: c.cardId, controller: p, displayName: card.name, effect: def.effect, sourceRef, targets });
        log(s, `${card.name}发动印刷${def.fast ? '快速' : ''}手牌行动${cost > 0 ? `，支付${cost}点费用` : ''}，支付封印费用${effectObjectsLog(s, targets)}；费用支付不能响应。`);
        announce(s, p, null, c.id, group);
        return true;
    }
    function onEvent(s, id, name, loc, group = uuid(), details = {}) {
        if (!active(s))
            return;
        if (name === 'seal-left' && details.from.hostId?.startsWith('society:')) {
            const p = Number(details.from.hostId.slice(8)), count = s.players[p].play.filter(source => !s.locations[source].faceDown && false === 'order').length;
            if (count) {
                if (s.abyssHiddenBonus?.round !== s.round)
                    s.abyssHiddenBonus = { round: s.round, values: [0, 0] };
                s.abyssHiddenBonus.values[p] += count;
                log(s, `深渊之序持续能力：${s.seats[p].name}本回合隐秘对抗修正增加${count}，累计+${s.abyssHiddenBonus.values[p]}。`);
            }
        }
        if (name !== 'sealed')
            return;
        for (const source of s.players.flatMap(pl => pl.play)) {
            const sl = s.locations[source], p = controllerOf(s, source);
            if (sl.faceDown || abilitiesSuppressed(s, source) || false !== 'order' || s.cards[id].owner !== p || !allowedHost(s, p, loc))
                continue;
            const ds = domains.filter(d => s.cards[id].magicDomains?.includes(d)), keys = Object.fromEntries(ds.map(d => [d, orderUse(s, source, d)]));
            if (!ds.some(d => !used(s, keys[d])))
                continue;
            registerGroup(s, group);
            s.triggerChoices.push({ id: uuid(), kind: 'abyss-ability', event: 'sealed', cardId: source, controller: p, displayName: s.cards[source].name, group, ...(s.costTriggerParent ? { triggerAfter: s.costTriggerParent } : {}), effect: 'abyss-order', subjectId: id, subjectVersion: loc.zoneVersion, hostRef: details.host, domains: ds, usageKeys: keys, mandatory: false });
        }
    }
    function view(s, p) {
        if (!active(s) || !s.players[p])
            return {};
        const handActions = Object.keys(s.cards).filter(id => handAllowed(s, p, id)).map(id => { const c = printedRulesCard(s, id), def = false; return { id, name: c.name, from: s.locations[id].zone, cost: printedHandActionCost(s, p, id, def.cost), fast: !!def.fast, effect: def.effect, costCards: s.players[p].hand.filter(x => x !== id && !s.cards[x].token).map(id => identity(s, id)), targets: [] }; });
        const fieldActions = s.players[p].play.filter(id => faceCharacter(s, id) && !abilitiesSuppressed(s, id) && false === 'dis-pater').map(id => ({ id, name: s.cards[id].name, cost: 2, used: used(s, disUse(s, id)), hasCards: sealedCharacters(s, p).length > 0, targets: targetOptions(s, p, { target: 'district' }) }));
        const triggers = s.triggerChoices.filter(a => a.controller === p && a.kind === 'abyss-ability').map(a => ({ id: a.id, name: a.displayName, subjectName: s.cards[a.subjectId].name, domains: a.domains.filter(d => !used(s, a.usageKeys[d])) }));
        const q = s.effectChoice;
        let abyssChoice = null;
        if (q?.kind === 'abyss') {
            abyssChoice = { id: q.id, controller: q.controller, mode: q.mode, name: s.cards[q.ability.cardId].name, optional: !!q.optional, hostName: q.hostRef?.name, public: !!q.public, ...(q.controller === p || q.public ? { cards: q.cardIds.map(id => identity(s, id)) } : {}) };
        }
        return { abyssHandActions: handActions, abyssFieldActions: fieldActions, abyssTriggers: triggers, abyssChoice, abyssHiddenBonus: abyssHiddenBonus(s, p) };
    }
    return { command, resolve, event: onEvent, view };
}
