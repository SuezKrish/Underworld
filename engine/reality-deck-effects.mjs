import { finishPrediction } from './prediction.mjs';
import { hardDeckCards, rememberHardDeckCards } from './hard-bot-library.mjs';
import { graveCards, inGrave } from './graveyard-rules.mjs';
import { RuleError } from './core.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { effectiveSubtypes, graveyardLocked, enterTapped } from './derived.mjs';
import { hasCardType } from './card-types.mjs';
import { sealHost, sealedOn, liveSealHost } from './sealing.mjs';
import { discardMany } from './discard-events.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function createRealityDeckEffects(ctx) {
    const { move, event, seal, draw, choose, finishSpell, log, shuffle, librarySearchBlocked, deter } = ctx;
    const districtLive = (s, plan) => s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId;
    function place(s, a, id) {
        const d = a.plan.sourceDistrict;
        if (!districtLive(s, a.plan) || inGrave(s, id) && graveyardLocked(s))
            return false;
        if (move(s, id, 'play', { controller: a.controller, district: d, tapped: enterTapped(s, id, d), faceDown: false })) {
            event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
            return true;
        }
        return false;
    }
    function crowTop(s, a) {
        const p = a.controller, id = hardDeckCards(s, p, 1, { kind: 'hand' })[0];
        if (!id) {
            finishSpell(s, a);
            return;
        }
        log(s, `“报幕”的乌鸦展示牌库顶：${s.cards[id].name}。`);
        rememberHardDeckCards(s, [id]);
        if (effectiveSubtypes(s, id).some(t => ['诅咒', '灾难'].includes(t)) || effectiveMagicDomains(s, id).includes('死亡')) {
            if (s.players[p].hand.length) {
                choose(s, a, 'reality-crow-discard', p, [...s.players[p].hand], { canSkip: true, topId: id, topVersion: s.locations[id].zoneVersion, choiceLabel: '弃一张手牌，再封印展示的顶牌；放弃则顶牌入墓' });
                return;
            }
        }
        move(s, id, 'graveyard');
        finishSpell(s, a);
    }
    function effect(s, a, plan, targets) {
        const p = a.controller;
        ;
        ;
        if (plan.operation === 'anchor') {
            const mode = a.mode ?? plan.selectedMode;
            if (mode === 'predict') {
                choose(s, a, 'predict', p, s.players[p].deck.slice(0, 1));
                return true;
            }
            return deter(s, a, 1);
        }
        if (plan.operation === 'ghost-revive') {
            const ids = sealedOn(s, `society:${p}`).filter(id => printedRulesCard(s, id).name === '精神锚点');
            if (ids.length) {
                choose(s, a, 'reality-anchor-recycle', p, ids, { public: true, canSkip: true, choiceLabel: '战栗凶灵 · 可洗回一个精神锚点，再令目标角色进场' });
                return true;
            }
            return false;
        }
        if (plan.operation === 'calamity-blank') {
            const h = plan.eventHost;
            if (h?.kind === 'card' && liveSealHost(s, h) && hasCardType(s.cards[h.hostId], 'character') && s.players[p].assets.some(x => (x.factionColors ?? [x.faction?.split('·')[0]]).includes('紫')))
                s.effects.push({ kind: 'blank-printed-rules', targetId: h.hostId, targetZoneVersion: s.locations[h.hostId].zoneVersion, duration: 'until-end-of-round' }, { kind: 'lose-all-icons', targetId: h.hostId, targetZoneVersion: s.locations[h.hostId].zoneVersion, duration: 'until-end-of-round' });
            return false;
        }
        if (plan.operation === 'calamity-seal') {
            const l = s.locations[a.cardId], t = targets[0];
            if (plan.hiddenWon && l?.zone === 'aside' && l.zoneVersion === plan.sourceVersion)
                seal(s, a.cardId, sealHost(s, t.cardId), { zone: 'aside', zoneVersion: l.zoneVersion });
            return false;
        }
        if (['crow-predict', 'crow-prepare'].includes(plan.operation)) {
            choose(s, a, 'reality-crow-predict', p, s.players[p].deck.slice(0, 1), { choiceLabel: '“报幕”的乌鸦 · 预测1，再展示牌库顶' });
            return true;
        }
        if (['crow-return', 'crow-end'].includes(plan.operation)) {
            const ids = liveSealHost(s, plan.hostRef) ? sealedOn(s, plan.sourceId) : [];
            if (ids.length) {
                choose(s, a, 'reality-crow-return', p, ids, { public: true, choiceLabel: '“报幕”的乌鸦 · 选择一张封印牌回拥有者手中' });
                return true;
            }
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.sourceZoneVersion)
                move(s, plan.sourceId, 'graveyard', { cause: 'sacrifice' });
            return false;
        }
        if (plan.operation === 'vortex-revive') {
            const ids = sealedOn(s, `society:${p}`).filter(id => hasCardType(s.cards[id], 'character'));
            if (ids.length && districtLive(s, plan)) {
                choose(s, a, 'reality-vortex-revive', p, ids, { public: true, canSkip: true, choiceLabel: '漩涡体质 · 选择秘社上的封印角色放置进场' });
                return true;
            }
            return false;
        }
        if (plan.operation === 'liliel-discard') {
            if (s.players[p].hand.length) {
                choose(s, a, 'reality-liliel-discard', p, [...s.players[p].hand], { canSkip: true, choiceLabel: '暮天使莉芮尔 · 可弃一张手牌，若如此做则抓一张' });
                return true;
            }
            return false;
        }
        return false;
    }
    function choice(s, p, c, x) {
        const a = x.spell, plan = a.plan;
        if (x.kind === 'reality-fate-source') {
            need(x.options.some(o => o.id === c.cardId), '请选择寻找区域');
            const useDeck = ['deck', 'both'].includes(c.cardId), useGrave = ['grave', 'both'].includes(c.cardId), ids = [...(useDeck && !librarySearchBlocked(s) ? s.players[p].deck : []), ...(useGrave && !graveyardLocked(s) ? graveCards(s, p) : [])].filter(id => effectiveSubtypes(s, id).includes('命运'));
            choose(s, a, 'reality-fate-search', p, ids, { min: 0, max: 3, distinctNames: true, shuffleDeck: useDeck, choiceLabel: '选择至多三张名称各不相同的命运牌' });
            return;
        }
        if (x.kind === 'reality-fate-search') {
            const ids = c.cardIds;
            need(Array.isArray(ids) && ids.length <= 3 && new Set(ids).size === ids.length && new Set(ids.map(id => s.cards[id]?.name)).size === ids.length && ids.every(id => x.cardIds.includes(id) && (s.locations[id]?.zone === 'deck' || inGrave(s, id, a.cardId))), '请选择至多三张不同名命运牌');
            beginEventGroup(s, a.id);
            for (const id of ids)
                if (!(inGrave(s, id) && graveyardLocked(s)))
                    seal(s, id, sealHost(s, `society:${p}`));
            endEventGroup(s);
            if (x.shuffleDeck)
                shuffle(s.players[p].deck);
        }
        else if (x.kind === 'reality-crow-predict') {
            const all = [...(c.top ?? []), ...(c.bottom ?? [])];
            need(all.length === x.cardIds.length && new Set(all).size === all.length && all.every(id => x.cardIds.includes(id)) && x.cardIds.every((id, i) => s.players[p].deck[i] === id), '请为全部预测牌安排顶底顺序');
            s.players[p].deck = [...c.top, ...s.players[p].deck.slice(all.length), ...c.bottom];
            finishPrediction(s, x, c, { event: event });
            crowTop(s, a);
            return;
        }
        else if (x.kind === 'reality-crow-discard') {
            if (c.skip === true) {
                if (s.players[p].deck[0] === x.topId)
                    move(s, x.topId, 'graveyard');
            }
            else {
                need(x.cardIds.includes(c.cardId) && s.players[p].hand.includes(c.cardId), '请选择一张手牌');
                discardMany(s, [c.cardId], move, event, { cause: 'discard', effectController: p });
                if (s.players[p].deck[0] === x.topId && s.locations[x.topId].zoneVersion === x.topVersion)
                    seal(s, x.topId, plan.hostRef, { zone: 'deck', zoneVersion: x.topVersion });
            }
        }
        else if (x.canSkip && c.skip === true) {
            finishSpell(s, a);
            return;
        }
        else {
            need(x.cardIds.includes(c.cardId), '请选择合法卡牌');
            if (x.kind === 'reality-anchor-recycle') {
                need(sealedOn(s, `society:${p}`).includes(c.cardId), '精神锚点已离开封印区');
                const owner = s.cards[c.cardId].owner;
                if (move(s, c.cardId, 'deck')) {
                    shuffle(s.players[owner].deck);
                    const t = a.targets[0];
                    if (inGrave(s, t.cardId) && s.locations[t.cardId].zoneVersion === t.zoneVersion)
                        place(s, a, t.cardId);
                }
            }
            if (x.kind === 'reality-vortex-revive') {
                need(sealedOn(s, `society:${p}`).includes(c.cardId), '封印牌已改变');
                place(s, a, c.cardId);
            }
            if (x.kind === 'reality-crow-return') {
                if (liveSealHost(s, plan.hostRef) && sealedOn(s, plan.sourceId).includes(c.cardId))
                    move(s, c.cardId, 'hand');
            }
            if (x.kind === 'reality-liliel-discard') {
                need(s.players[p].hand.includes(c.cardId), '手牌已改变');
                discardMany(s, [c.cardId], move, event, { cause: 'discard', effectController: p });
                draw(s, [p], 1);
            }
        }
        finishSpell(s, a);
    }
    return { effect, choice };
}
