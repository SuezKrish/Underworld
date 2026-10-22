import { seatChoice } from './simultaneous-choice.mjs';
import { RuleError } from './core.mjs';
import { identity } from './ownership.mjs';
import { societyPlan } from './environment-definitions.mjs';
import { hardDeckCards, rememberHardDeckCards } from './hard-bot-library.mjs';
// A prediction is one occurrence, including a prediction of an empty library.
// The observer's continuous choice shares that occurrence's resolution window.
export function beginPrediction(s, choice) {
    const p = choice.controller;
    if (!choice.divinationExpanded) {
        choice.divinationExpanded = true;
        const bonus = 0;
        if (bonus)
            choice.cardIds = s.players[p].deck.slice(0, choice.cardIds.length + bonus);
    }
    choice.cardIds = hardDeckCards(s, p, choice.cardIds.length, { side: 'top', kind: 'hand' });
    if (!societyPlan(s, p).observePrediction)
        return choice;
    const counters = s.societyStates[p].counters;
    counters.crisis = (counters.crisis ?? 0) + 1;
    const id = s.players[1 - p].deck[0];
    choice.predictionObserver = { player: 1 - p, cardId: id, version: id ? s.locations[id]?.zoneVersion : undefined, inspected: false };
    return choice;
}
export function inspectPrediction(s, p, c) {
    if (c.type !== 'prediction-inspect')
        return false;
    const a = seatChoice(s.effectChoice, p), o = a?.predictionObserver;
    if (!a || a.id !== c.choiceId || a.controller !== p || !o)
        throw new RuleError('当前没有属于你的预测检视');
    if (!o.inspected) {
        const [id] = hardDeckCards(s, o.player, 1, { side: 'top', kind: 'hand' });
        o.cardId = id;
        o.version = id ? s.locations[id]?.zoneVersion : undefined;
        rememberHardDeckCards(s, id ? [id] : [], p);
    }
    o.inspected = true;
    return true;
}
export function finishPrediction(s, a, c, { reordered = false, event } = {}) {
    const o = a.predictionObserver;
    if (c.observerBottom !== undefined && typeof c.observerBottom !== 'boolean')
        throw new RuleError('请选择保留或置底');
    if (o && c.observerBottom) {
        if (!o.inspected)
            throw new RuleError('请先检视敌方牌库顶');
        if ((reordered ? !s.players[o.player].deck.includes(o.cardId) : s.players[o.player].deck[0] !== o.cardId) || s.locations[o.cardId]?.zoneVersion !== o.version)
            throw new RuleError('敌方牌库顶已改变');
        const deck = s.players[o.player].deck;
        deck.splice(deck.indexOf(o.cardId), 1);
        deck.push(o.cardId);
    }
    const p = a.controller;
    if ([0, 1].includes(p) && !a.predictionFinished) {
        a.predictionFinished = true;
        const e = { id: null, event: 'prediction-finished', group: a.spell?.id ?? a.id, loc: { faceDown: false, controller: p }, details: { player: p } };
        if (event)
            event(s, e.id, e.event, e.loc, e.group, e.details);
        else {
            s.fieldEvents ??= [];
            s.fieldEvents.push(e);
        }
    }
}
export function predictionView(s, a, p) {
    const o = a?.predictionObserver;
    if (!o || a.controller !== p)
        return undefined;
    const live = o.cardId && s.players[o.player].deck[0] === o.cardId && s.locations[o.cardId]?.zoneVersion === o.version;
    return { empty: !live, inspected: o.inspected, card: o.inspected && live ? identity(s, o.cardId) : undefined };
}
