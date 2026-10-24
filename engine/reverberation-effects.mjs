import { rememberHardDeckCards, forgetHardDeckCards, hardDeckCards } from './hard-bot-library.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { RuleError } from './core.mjs';
import { hasCardType } from './card-types.mjs';
import { effectiveSubtypes, enterTapped } from './derived.mjs';
import { sealHost } from './sealing.mjs';
import { sourceLive } from './batch-rules.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function createReverberationEffects(ctx) {
    const { move, seal, event, choose, finishSpell, log, shuffle, startHidden, librarySearchBlocked, options, prepare, live, batchEffect } = ctx;
    const refs = (s, ids) => Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion]));
    const inDeck = (s, p, id, versions) => s.players[p].deck.includes(id) && s.locations[id]?.zone === 'deck' && s.locations[id].zoneVersion === versions[id];
    function bottomRandom(s, p, ids) {
        const remaining = ids.filter(id => s.players[p].deck.includes(id));
        shuffle(remaining);
        if (remaining.length > 1)
            forgetHardDeckCards(s, remaining);
        s.players[p].deck = [...s.players[p].deck.filter(id => !remaining.includes(id)), ...remaining];
    }
    function finishGift(s, a, top, selected) { bottomRandom(s, a.controller, top.filter(id => !selected.includes(id))); finishSpell(s, a); }
    function afterHidden(s, a, winner) {
        const p = a.controller, t = a.targets?.[0], top = hardDeckCards(s, p, 7, { kind: 'seal', side: 'top', sealHostId: t?.cardId ?? t?.ref?.hostId }), max = Math.min(top.length, winner === p ? 2 : 1);
        if (!top.length || librarySearchBlocked(s)) {
            finishGift(s, a, top, []);
            return;
        }
        choose(s, a, 'reverberation-gift', p, top, { min: max, max, versions: refs(s, top), choiceLabel: `原初烈焰赠礼 · 顶七张中寻找${max}张牌封印` });
    }
    function resetStructure(s, a) {
        const plan = a.plan;
        if (sourceLive(s, plan))
            setCardMarker(s, s.locations[plan.sourceId], "markers", null, (s.locations[plan.sourceId].markers ?? 0) + 2);
    }
    function finishStructure(s, a, ids, placed = false) {
        bottomRandom(s, a.controller, ids);
        if (placed)
            resetStructure(s, a);
        finishSpell(s, a);
    }
    function effect(s, a, plan, targets) {
        const p = a.controller;
        if (plan.operation === 'rescue-host') {
            const l = s.locations[plan.subjectId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.subjectZoneVersion)
                batchEffect(s, a, { ...plan, operation: 'blink' }, [{ cardId: plan.subjectId }]);
        }
        if (plan.operation === 'elder-top-three') {
            const ids = s.players[p].deck.slice(0, 3);
            if (!ids.length)
                return false;
            log(s, '迷途老者展示：' + ids.map(id => s.cards[id].name).join('、'));
            rememberHardDeckCards(s, ids);
            choose(s, a, 'reverberation-elder', p, ids, { public: true, versions: refs(s, ids), choiceLabel: '迷途老者 · 分配入手、封印与入墓' });
            return true;
        }
        if (plan.operation === 'hidden-gift') {
            if (startHidden(s, a.id, a)) {
                s.hidden.cardBonus = { controller: p, amount: 3, magic: '星辰' };
                return true;
            }
            afterHidden(s, a, null);
            return true;
        }
        if (plan.operation === 'entangled-structure') {
            const l = s.locations[plan.sourceId];
            if (sourceLive(s, plan) && (l.markers ?? 0) > 0) {
                setCardMarker(s, l, "markers", null, (l.markers) - 1);
                return false;
            }
            const ids = [];
            for (const id of s.players[p].deck) {
                ids.push(id);
                if (hasCardType(s.cards[id], 'attachment') && effectiveSubtypes(s, id).includes('设施'))
                    break;
            }
            if (ids.length)
                log(s, '纠缠结构展示：' + ids.map(id => s.cards[id].name).join('、'));
            rememberHardDeckCards(s, ids);
            const id = ids.at(-1), facility = id && hasCardType(s.cards[id], 'attachment') && effectiveSubtypes(s, id).includes('设施'), hosts = facility ? options(s, p, { ...s.cards[id].attachment, cardId: id }) : [];
            if (!hosts.length) {
                finishStructure(s, a, ids);
                return true;
            }
            choose(s, a, 'reverberation-facility', p, [], { public: true, revealedNames: ids.map(x => s.cards[x].name), options: hosts, facilityId: id, facilityVersion: s.locations[id].zoneVersion, revealedIds: ids, choiceLabel: `纠缠结构 · ${s.cards[id].name}结附于合法对象` });
            return true;
        }
        return false;
    }
    function choice(s, p, c, x) {
        const a = x.spell;
        if (x.kind === 'reverberation-elder') {
            need(x.cardIds.every(id => inDeck(s, p, id, x.versions)), '展示的牌已变更区域');
            need(x.cardIds.includes(c.handId) && (x.cardIds.length < 2 ? !c.sealId : x.cardIds.includes(c.sealId) && c.handId !== c.sealId), '请选择不同的入手牌和封印牌');
            move(s, c.handId, 'hand');
            const target = a.targets[0];
            if (c.sealId && live(s, p, a.plan, target))
                seal(s, c.sealId, sealHost(s, target.cardId), { zone: 'deck', zoneVersion: x.versions[c.sealId] });
            for (const id of x.cardIds.filter(id => id !== c.handId && id !== c.sealId))
                if (inDeck(s, p, id, x.versions))
                    move(s, id, 'graveyard');
        }
        else if (x.kind === 'reverberation-gift') {
            const ids = c.cardIds ?? [];
            need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.length === x.max && ids.every(id => x.cardIds.includes(id) && inDeck(s, p, id, x.versions)), '请选择检视范围内规定数量的不同卡牌');
            const t = a.targets[0], host = t?.kind === 'host' ? t.ref : sealHost(s, t?.cardId);
            if (!librarySearchBlocked(s))
                (() => {
                    for (const id of ids) {
                        log(s, '原初烈焰赠礼展示：' + s.cards[id].name);
                        if (t && live(s, p, a.plan, t))
                            seal(s, id, host, { zone: 'deck', zoneVersion: x.versions[id] });
                    }
                })();
            finishGift(s, a, x.cardIds, librarySearchBlocked(s) ? [] : ids);
            return;
        }
        else if (x.kind === 'reverberation-facility') {
            const id = x.facilityId, plan = { ...s.cards[id].attachment, cardId: id };
            let placed = false;
            need(x.options.some(o => o.id === c.cardId), '请选择已提供的合法结附对象');
            if (inDeck(s, p, id, { [id]: x.facilityVersion }) && options(s, p, plan).some(o => o.id === c.cardId)) {
                const t = prepare(s, p, { targetIds: [c.cardId] }, plan)[0], h = t.kind === 'host' ? t.ref : t.kind === 'district' ? sealHost(s, `district-host:${t.cardId}`) : sealHost(s, t.cardId), d = t.kind === 'district' ? t.district : t.kind === 'card' ? s.locations[t.cardId].district : undefined;
                if (live(s, p, plan, t) && move(s, id, 'play', { controller: p, faceDown: false, tapped: enterTapped(s, id, d), attachedTo: h.hostId, hostVersion: h.version, ...(d !== undefined ? { district: d } : {}) })) {
                    placed = true;
                    event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
                    event(s, id, 'attached', s.locations[id], a.id, { host: h });
                }
            }
            finishStructure(s, a, x.revealedIds, placed);
            return;
        }
        else
            throw new RuleError('未知霸权回响结算选择');
        finishSpell(s, a);
    }
    return { effect, choice, afterHidden };
}
