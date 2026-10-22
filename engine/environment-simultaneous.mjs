import { simultaneousChoice, seatChoice, choicePending, commitChoice, withSimultaneousDepartures } from './simultaneous-choice.mjs';
import { rememberHardDeckCards } from './hard-bot-library.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { beginPrediction, finishPrediction } from './prediction.mjs';
import { RuleError } from './core.mjs';
import { uuid } from './random.mjs';
import { graveCards } from './graveyard-rules.mjs';
import { librarySearchBlocked } from './library-search.mjs';
import { hasCardType } from './card-types.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { cardHasKeyword, graveyardLocked } from './derived.mjs';
import { effectiveDefense, effectiveIcons } from './rounds.mjs';
import { sealHost, liveSealHost } from './sealing.mjs';
import { discardMany } from './discard-events.mjs';
import { shuffleCards } from './environment-definitions.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const unique = ids => Array.isArray(ids) && ids.every(x => typeof x === 'string') && new Set(ids).size === ids.length;
const modes = new Set(['search', 'predict', 'discard', 'discard-redraw', 'reveal', 'sacrifice-character', 'sacrifice-draw-defense', 'return-character', 'grave-enter', 'even-top-asset', 'hand-enter']);
export function operationPlayer(s, a, o) { return o.player === 'winner' ? a.controller : o.player === 'other' ? 1 - a.controller : o.player === 'first' ? s.turn.firstPlayer : o.player === 'second' ? 1 - s.turn.firstPlayer : o.player ?? a.controller; }
export function pairedOperations(s, a, o, next) { return modes.has(o.kind) && next?.kind === o.kind && operationPlayer(s, a, o) !== operationPlayer(s, a, next); }
export function createParallelEnvironment(ctx) {
    const { chooser, run, chars, matches, move, seal, draw, log, event, enter, setLocation, targetOptions, targetRefs } = ctx;
    function prompt(s, a, o) {
        const p = operationPlayer(s, a, o), mode = o.kind;
        let ids = [], min = 1, max = 1;
        if (mode === 'search') {
            ids = librarySearchBlocked(s) ? [] : s.players[p].deck.filter(id => matches(s, id, o.filter));
            min = 0;
        }
        if (mode === 'predict') {
            const n = o.count === 'investigation-plus-two' ? chars(s, p).reduce((n, id) => n + effectiveIcons(s, id, true).investigation, 2) : o.count;
            ids = s.players[p].deck.slice(0, n);
            min = 0;
            max = ids.length;
        }
        if (mode === 'discard' || mode === 'discard-redraw') {
            ids = [...s.players[p].hand];
            min = mode === 'discard' ? Math.min(o.count, ids.length) : 0;
            max = mode === 'discard' ? min : ids.length;
        }
        if (mode === 'hand-enter') {
            ids = s.players[p].hand.filter(id => hasCardType(s.cards[id], 'character') || hasCardType(s.cards[id], 'attachment'));
            min = 0;
        }
        if (mode === 'reveal') {
            ids = s.players[p].play.filter(id => s.locations[id].faceDown && !s.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === id));
            min = o.optional ? 0 : 1;
        }
        if (['sacrifice-character', 'sacrifice-draw-defense', 'return-character'].includes(mode))
            ids = chars(s, p).filter(id => !cardHasKeyword(s, id, '永恒') && (mode !== 'return-character' || s.locations[id].district !== a.sourceDistrict));
        if (mode === 'grave-enter')
            ids = graveCards(s, p).filter(id => hasCardType(s.cards[id], 'character') && !graveyardLocked(s));
        if (mode === 'even-top-asset') {
            ids = s.players[p].deck.slice(0, 1);
            min = 0;
            if (ids.length) {
                log(s, `${s.seats[p].name}展示顶牌：${s.cards[ids[0]].name}。`);
                rememberHardDeckCards(s, ids);
                if (s.cards[ids[0]].printedCost % 2)
                    ids = [];
            }
        }
        const x = { id: uuid(), controller: p, mode, cardIds: ids, min, max, operation: { ...o, player: p }, skipPrompt: (!ids.length && mode !== 'predict') };
        if (mode === 'predict')
            beginPrediction(s, x);
        return x;
    }
    function apply(s, a, choices, selections, remaining) {
        const picked = new Map(selections.map(x => [x.player, x.command]));
        const defenses = new Map(choices.filter(x => x.mode === 'sacrifice-draw-defense' && picked.get(x.controller)?.cardIds?.length).map(x => [x.controller, effectiveDefense(s, picked.get(x.controller)?.cardIds?.[0])]));
        beginEventGroup(s, a.id);
        try {
            withSimultaneousDepartures(s, selections.flatMap(x => x.command.cardIds ?? []), () => {
                // Apply both predictions before an observer moves a previously inspected card.
                for (const x of choices)
                    if (x.mode === 'predict') {
                        const c = picked.get(x.controller);
                        s.players[x.controller].deck = [...c.top, ...s.players[x.controller].deck.slice(x.cardIds.length), ...c.bottom];
                    }
                const discards = choices.filter(x => ['discard', 'discard-redraw'].includes(x.mode)).flatMap(x => picked.get(x.controller)?.cardIds ?? []);
                if (discards.length)
                    discardMany(s, discards, move, event, { cause: 'discard', effectController: a.controller });
                for (const x of choices) {
                    const p = x.controller, o = x.operation, c = picked.get(p) ?? { cardIds: [] }, id = c.cardIds?.[0];
                    if (x.mode === 'predict') {
                        finishPrediction(s, { ...x, predictionObserver: selections.find(y => y.player === p)?.choice.predictionObserver }, c, { reordered: true, event });
                        continue;
                    }
                    if (x.mode === 'search') {
                        if (id) {
                            if (o.reveal)
                                log(s, `${s.seats[p].name}展示${s.cards[id].name}。`);
                            if (o.destination === 'seal')
                                seal(s, id, sealHost(s, o.hostId ?? `society:${p}`));
                            else
                                move(s, id, o.destination === 'top' ? 'aside' : 'hand');
                        }
                        shuffleCards(s.players[p].deck);
                        if (id && o.destination === 'top') {
                            move(s, id, 'deck');
                            s.players[p].deck = s.players[p].deck.filter(x => x !== id);
                            s.players[p].deck.unshift(id);
                        }
                        continue;
                    }
                    if (x.mode === 'discard-redraw') {
                        draw(s, [p], c.cardIds.length);
                        continue;
                    }
                    if (x.mode === 'discard')
                        continue;
                    if (x.mode === 'even-top-asset') {
                        const top = s.players[p].deck[0];
                        if (top && s.cards[top].printedCost % 2)
                            shuffleCards(s.players[p].deck);
                        else if (id && top === id)
                            move(s, id, 'asset', { controller: p, tapped: false });
                        continue;
                    }
                    if (x.mode === 'reveal') {
                        if (id && s.locations[id]?.zone === 'play' && s.locations[id].faceDown) {
                            const l = s.locations[id];
                            if (setLocation(s, id, 'play', { controller: p, district: l.district, tapped: l.tapped || printedRulesCard(s, id).keywords?.includes('迟缓'), faceDown: false, fieldVersion: l.zoneVersion + 1 })) {
                                event(s, id, 'entry', s.locations[id], a.id, { method: 'reveal' });
                                event(s, id, 'reveal', s.locations[id], a.id);
                            }
                        }
                        continue;
                    }
                    if (x.mode === 'sacrifice-character' || x.mode === 'sacrifice-draw-defense') {
                        if (id && chars(s, p).includes(id) && !cardHasKeyword(s, id, '永恒'))
                            move(s, id, 'graveyard', { cause: 'sacrifice' });
                        continue;
                    }
                    if (x.mode === 'return-character') {
                        if (id && chars(s, p).includes(id))
                            move(s, id, 'hand');
                        continue;
                    }
                    if (x.mode === 'grave-enter') {
                        if (id && graveCards(s, p).includes(id) && !graveyardLocked(s))
                            enter(s, id, p, a.memory?.[o.districtKey], false, a.id);
                        continue;
                    }
                    if (x.mode === 'hand-enter') {
                        if (id && s.players[p].hand.includes(id)) {
                            if (c.host) {
                                const h = c.host;
                                if (liveSealHost(s, h) && targetOptions(s, p, { ...s.cards[id].attachment, cardId: id }).some(t => t.id === c.hostOption) && move(s, id, 'play', { controller: p, tapped: false, attachedTo: h.hostId, hostVersion: h.version, ...(h.kind === 'card' ? { district: s.locations[h.hostId].district } : h.kind === 'district' ? { district: c.district } : {}) })) {
                                    event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
                                    event(s, id, 'attached', s.locations[id], a.id, { host: h });
                                }
                            }
                            else
                                enter(s, id, p, c.district, false, a.id);
                        }
                        continue;
                    }
                }
                for (const x of choices)
                    if (x.mode === 'sacrifice-draw-defense' && picked.get(x.controller)?.cardIds?.length)
                        draw(s, [x.controller], defenses.get(x.controller));
            });
        }
        finally {
            endEventGroup(s);
        }
        s.effectChoice = null;
        if (s.status === 'playing')
            run(s, a, remaining);
    }
    function open(s, a, ops, remaining) {
        const choices = ops.map(o => prompt(s, a, o)), active = choices.filter(x => !x.skipPrompt);
        const choose = (s, a, mode, p, ids, extra) => chooser(s, a, { kind: 'parallel', player: p }, remaining, mode, ids, extra);
        if (!simultaneousChoice(s, choose, a, 'parallel', active, { parallelChoices: choices, parallelRemaining: remaining }))
            apply(s, a, choices, [], remaining);
    }
    function command(s, p, c) {
        const root = s.effectChoice;
        if (root?.kind !== 'environment' || !root.simultaneous)
            return false;
        const x = seatChoice(root, p);
        need(choicePending(root, p) && (c.choiceId === x.id || c.choiceId === root.id), '没有属于你的未锁定选择');
        const ids = c.cardIds ?? [];
        let selection = { cardIds: ids };
        if (x.mode === 'predict') {
            const all = [...(c.top ?? []), ...(c.bottom ?? [])];
            need(Array.isArray(c.top) && Array.isArray(c.bottom) && unique(all) && all.length === x.cardIds.length && all.every(id => x.cardIds.includes(id)) && x.cardIds.every((id, i) => s.players[p].deck[i] === id), '预测需为全部牌指定顶底顺序');
            if (c.observerBottom)
                need(x.predictionObserver?.inspected, '请先检视敌方牌库顶');
            need(c.observerBottom === undefined || typeof c.observerBottom === 'boolean', '请选择保留或置底');
            selection = { top: c.top, bottom: c.bottom, observerBottom: c.observerBottom };
        }
        else {
            need(unique(ids) && ids.length >= x.min && ids.length <= x.max && ids.every(id => x.cardIds.includes(id)), '请选择规定数量的合法卡牌');
            if (x.mode === 'hand-enter' && ids[0]) {
                const id = ids[0];
                need(s.players[p].hand.includes(id), '手牌已改变');
                const card = s.cards[id];
                let next;
                if (hasCardType(card, 'attachment') && card.attachment) {
                    const hostOptions = targetOptions(s, p, { ...card.attachment, cardId: id });
                    if (hostOptions.length)
                        next = { mode: 'attachment-host', hostOptions, cardIds: hostOptions.map(x => x.id) };
                    else
                        selection = { cardIds: [] };
                }
                else
                    next = { mode: 'enter-district', cardIds: s.districts.flatMap((d, i) => d ? [`district:${i}`] : []) };
                if (next) {
                    const pending = root.playerChoices.find(x => x.controller === p);
                    Object.assign(pending, next, { id: uuid(), min: 1, max: 1, enterId: id });
                    Object.assign(root, pending);
                    return true;
                }
            }
            else if (x.mode === 'enter-district')
                selection = { cardIds: [x.enterId], district: Number(ids[0].slice(9)) };
            else if (x.mode === 'attachment-host') {
                const refs = targetRefs(s, p, { targetIds: [ids[0]] }, { ...s.cards[x.enterId].attachment, cardId: x.enterId }), t = refs[0], host = t.kind === 'host' ? t.ref : sealHost(s, t.kind === 'district' ? `district-host:${t.cardId}` : t.cardId);
                need(liveSealHost(s, host), '结附目标失效');
                selection = { cardIds: [x.enterId], host, hostOption: ids[0], ...(t.kind === 'district' ? { district: t.district } : {}) };
            }
        }
        const selections = commitChoice(root, p, selection, () => { });
        if (selections)
            apply(s, root.job, root.parallelChoices, selections, root.parallelRemaining);
        return true;
    }
    return { open, command };
}
