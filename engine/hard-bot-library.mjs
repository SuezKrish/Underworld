import { hasCardType } from './card-types.mjs';
// Only the server's hard BOT uses this state. It is never part of a seat view.
let scorer = null, active = null;
export const hardBot = s => s.bot?.difficulty === 'hard' && [0, 1].includes(s.bot.seat) && !!s.players?.[s.bot.seat];
export function installHardLibraryScorer(fn) { const previous = scorer; scorer = fn; return previous; }
// The isolated league may contain two hard seats. Live rooms keep one BOT.
const botSeats = s => s.simulationBots ?? [s.bot];
function withSeat(s, bot, fn) {
    const previous = s.bot;
    s.bot = bot;
    try {
        return fn();
    }
    finally {
        s.bot = previous;
    }
}
function eachHardSeat(s, fn) {
    for (const bot of botSeats(s))
        if (bot?.difficulty === 'hard')
            withSeat(s, bot, () => {
                if (hardBot(s))
                    fn(bot);
            });
}
// A private look by the BOT does not constrain its privilege. Only information
// available to the other seat (or publicly revealed) fixes library positions.
export function rememberHardDeckCards(s, ids, viewer = null) {
    eachHardSeat(s, () => {
        if (viewer !== s.bot.seat)
            rememberForSeat(s, ids);
    });
}
export function forgetHardDeckCards(s, ids) {
    eachHardSeat(s, () => {
        for (const id of ids ?? [])
            if (s.bot.libraryKnown)
                delete s.bot.libraryKnown[id];
    });
}
function rememberForSeat(s, ids) {
    if (!hardBot(s))
        return;
    const p = s.bot.seat, deck = s.players[p].deck;
    for (const id of ids ?? [])
        if (deck.includes(id) && s.locations[id]?.zone === 'deck') {
            s.bot.libraryKnown ??= {};
            s.bot.libraryKnown[id] = s.locations[id].zoneVersion;
        }
}
export function rememberHardDeckMove(s, id, old) {
    eachHardSeat(s, bot => {
        const choices = [s.roundChoice, s.effectChoice, ...s.effectChoice?.playerChoices ?? [], ...s.effectChoice?.parallelChoices ?? []];
        const publicSource = ['graveyard', 'headquarters', 'asset', 'core', 'score'].includes(old?.zone) || ['play', 'stack', 'aside'].includes(old?.zone) && !old.faceDown && !old.secretPlan || old?.zone === 'sealed' && !old.faceDown;
        const witnessed = choices.some(x => x?.cardIds?.includes(id) && (x.public || [0, 1].includes(x.controller) && x.controller !== bot.seat));
        if (publicSource || witnessed || old?.zone === 'deck' && bot.libraryKnown?.[id] === old.zoneVersion)
            rememberForSeat(s, [id]);
    });
}
function clean(s) {
    const known = s.bot.libraryKnown ?? {};
    for (const id of Object.keys(known))
        if (!s.players[s.bot.seat].deck.includes(id) || known[id] !== s.locations[id]?.zoneVersion)
            delete known[id];
    return known;
}
function inspections(s) {
    const out = [];
    for (const x of [s.roundChoice, s.effectChoice, ...s.effectChoice?.playerChoices ?? [], ...s.effectChoice?.parallelChoices ?? []])
        if (x && /investigation|predict|top|bottom|inspect|reveal|preview/.test([x.kind, x.zone, x.mode].filter(Boolean).join(' ')))
            out.push({ x, viewer: x.public ? null : x.controller });
    for (const [viewer, x] of Object.entries(s.privateInspections ?? {}))
        if (x && x.zone !== 'unordered-deck')
            out.push({ x, viewer: Number(viewer) });
    return out;
}
const inspectionIds = x => x.cardIds ?? x.ids ?? x.cards?.map(c => c.id) ?? [];
const inspectionKey = ({ x, viewer }) => `${viewer ?? 'public'}:${x.kind ?? x.zone}:${x.id ?? inspectionIds(x).join(',')}`;
function temporaryInspectionIds(s) {
    return new Set(inspections(s).filter(entry => entry.viewer === s.bot.seat && !entry.x.predictionFinished && !entry.x.libraryOrderCommitted && s.bot.libraryObservations?.[inspectionKey(entry)] === (s.bot.libraryEpoch ?? 0)).flatMap(({ x }) => inspectionIds(x)));
}
export function rememberHardObservations(s, c = null, epoch = null, actor = null) { eachHardSeat(s, () => observeForSeat(s, c, epoch, actor)); }
function observeForSeat(s, c = null, epoch = null, actor = null) {
    if (!hardBot(s))
        return;
    clean(s);
    const seen = s.bot.libraryObservations ?? {}, epochNow = s.bot.libraryEpoch ?? 0;
    for (const entry of inspections(s)) {
        const { x, viewer } = entry, key = inspectionKey(entry), ids = inspectionIds(x), deck = s.players[s.bot.seat].deck;
        if (!ids.some(id => deck.includes(id)) && !(x.predictionObserver?.inspected && deck.includes(x.predictionObserver.cardId)))
            continue;
        if (Object.hasOwn(seen, key) && seen[key] !== epochNow)
            continue;
        s.bot.libraryObservations = seen;
        seen[key] = epochNow;
        rememberHardDeckCards(s, ids, viewer);
        if (x.predictionObserver?.inspected)
            rememberHardDeckCards(s, [x.predictionObserver.cardId], x.controller);
    }
    for (const key of Object.keys(seen).slice(0, -128))
        delete seen[key];
    if (c && epoch === (s.bot.libraryEpoch ?? 0))
        rememberHardDeckCards(s, [...c.top ?? [], ...c.bottom ?? [], ...c.orderIds ?? [], ...(c.type === 'investigate' || s.effectChoice?.kind === 'predict' ? c.cardIds ?? [] : [])], actor);
}
export function hardLibraryPurpose(s, c) { const x = s.effectChoice ?? s.roundChoice, a = s.resolvingAbility ?? x?.spell ?? s.flow.stack.at(-1), plan = a?.plan ?? {}, text = [x?.kind, c?.zone, c?.operation, plan.effect, plan.operation, s.cards[a?.cardId]?.name, s.cards[plan.sourceId]?.name].filter(Boolean).join(' '); return { ...(x?.kind === 'guess-cost' && Number.isSafeInteger(c?.number) ? { matchingCost: c.number } : {}), side: /bottom|deck-bottom/.test(text) ? 'bottom' : 'top', kind: /mill|bury|asylum|废弃收容所|堆墓/.test(text) ? 'graveyard' : /seal|封印/.test(text) ? 'seal' : 'hand' }; }
function fallback(s, id) { const c = s.cards[id]; return (c?.printedCost ?? 0) + Object.values(c?.icons ?? {}).reduce((a, b) => a + b, 0); }
export function prepareHardLibrary(s, context = hardLibraryPurpose(s, active?.command), observe = true) {
    if (!hardBot(s) || s.status !== 'playing' || s.setup || s.turn?.phase === 'setup' || s.turn?.step === 'mulligan')
        return;
    if (observe)
        rememberHardObservations(s);
    const known = clean(s), temporary = temporaryInspectionIds(s), p = s.bot.seat, deck = s.players[p].deck, positions = deck.flatMap((id, i) => Object.hasOwn(known, id) || temporary.has(id) ? [] : [i]);
    if (positions.length < 2)
        return;
    const weights = scorer?.(s, context.kind === 'select-and-mill' ? { ...context, kind: 'hand' } : context) ?? {};
    let cards = positions.map(i => deck[i]).sort((a, b) => (weights[b] ?? fallback(s, b)) - (weights[a] ?? fallback(s, a)) || a.localeCompare(b));
    if (context.kind === 'select-and-mill') {
        const eligible = id => hasCardType(s.cards[id], 'character') || s.cards[id].subtypes?.includes('装备');
        const knownEligible = deck.slice(0, context.count).filter(id => Object.hasOwn(known, id) && eligible(id)).length;
        const take = Math.max(0, (context.handCount ?? 1) - knownEligible), picked = cards.filter(eligible).slice(0, Math.min(take, positions.filter(i => i < context.count).length)), chosen = new Set(picked);
        const mill = scorer?.(s, { ...context, kind: 'graveyard' }) ?? {};
        cards = [...picked, ...cards.filter(id => !chosen.has(id)).sort((a, b) => (mill[b] ?? fallback(s, b)) - (mill[a] ?? fallback(s, a)) || a.localeCompare(b))];
    }
    if (context.side === 'bottom')
        cards.reverse();
    for (let i = 0; i < positions.length; i++)
        deck[positions[i]] = cards[i];
}
export function hardDeckShuffled(s, p) {
    const bot = botSeats(s).find(b => b?.difficulty === 'hard' && b.seat === p);
    if (bot)
        return withSeat(s, bot, () => shuffledForSeat(s, p));
}
function shuffledForSeat(s, p) {
    if (!hardBot(s) || s.bot.seat !== p)
        return;
    s.bot.libraryKnown = {};
    s.bot.libraryEpoch = (s.bot.libraryEpoch ?? 0) + 1;
    prepareHardLibrary(s, hardLibraryPurpose(s, active?.command), false);
    rememberHardObservations(s);
}
export function withHardBotCommand(s, c, fn, actor = null) {
    if (s.simulationBots)
        return withHardSimulationCommand(s, c, fn, actor);
    if (!hardBot(s) || c.type === 'mulligan' || c.operation === 'undo' || ['manual-confirm', 'manual-request'].includes(c.type) && s.manualRequest?.operation === 'undo')
        return fn();
    const previous = active;
    active = { state: s, command: c };
    const epoch = s.bot.libraryEpoch ?? 0;
    rememberHardObservations(s);
    const deckBefore = [...s.players[s.bot.seat].deck], knownBefore = JSON.stringify(s.bot.libraryKnown ?? {}), observedBefore = JSON.stringify(s.bot.libraryObservations ?? {});
    if (!['room-message', 'cancel-inspection', 'cancel-card-inspection', 'inspect-hidden', 'shoggoth-return-preference'].includes(c.type) && !(c.operation === 'inspect' && c.zone === 'unordered-deck'))
        prepareHardLibrary(s, hardLibraryPurpose(s, c));
    const prepared = [...s.players[s.bot.seat].deck];
    active.settle = () => {
        rememberHardObservations(s, c, epoch, actor);
        const deck = s.players[s.bot.seat].deck;
        if ((s.bot.libraryEpoch ?? 0) === epoch && JSON.stringify(s.bot.libraryKnown ?? {}) === knownBefore && JSON.stringify(s.bot.libraryObservations ?? {}) === observedBefore && deck.length === prepared.length && deck.every((id, i) => id === prepared[i]))
            deck.splice(0, deck.length, ...deckBefore);
    };
    try {
        return fn();
    }
    finally {
        active.settle();
        active = previous;
    }
}
function withHardSimulationCommand(s, c, fn, actor) {
    if (c.type === 'mulligan' || c.operation === 'undo')
        return fn();
    const previous = active;
    active = { state: s, command: c };
    const snapshots = [];
    eachHardSeat(s, bot => {
        const epoch = bot.libraryEpoch ?? 0;
        observeForSeat(s);
        const deckBefore = [...s.players[bot.seat].deck], knownBefore = JSON.stringify(bot.libraryKnown ?? {}), observedBefore = JSON.stringify(bot.libraryObservations ?? {});
        if (!['room-message', 'cancel-inspection', 'cancel-card-inspection', 'inspect-hidden', 'shoggoth-return-preference'].includes(c.type) && !(c.operation === 'inspect' && c.zone === 'unordered-deck'))
            prepareHardLibrary(s, hardLibraryPurpose(s, c));
        snapshots.push({ bot, epoch, deckBefore, knownBefore, observedBefore, prepared: [...s.players[bot.seat].deck] });
    });
    active.settle = () => {
        for (const x of snapshots)
            withSeat(s, x.bot, () => {
                observeForSeat(s, c, x.epoch, actor);
                const deck = s.players[x.bot.seat].deck;
                if ((x.bot.libraryEpoch ?? 0) === x.epoch && JSON.stringify(x.bot.libraryKnown ?? {}) === x.knownBefore && JSON.stringify(x.bot.libraryObservations ?? {}) === x.observedBefore && deck.length === x.prepared.length && deck.every((id, i) => id === x.prepared[i]))
                    deck.splice(0, deck.length, ...x.deckBefore);
            });
    };
    try {
        return fn();
    }
    finally {
        active.settle();
        active = previous;
    }
}
export function settleHardBotCommand(s) {
    if (active?.state === s)
        active.settle?.();
}
// Commit at the actual access as well as at command boundaries. A multi-part
// effect may draw, then mill, or shuffle and draw during the same resolution.
export function hardDeckCards(s, p, count = 1, options = {}) {
    const n = Math.max(0, Math.trunc(count)), context = { ...hardLibraryPurpose(s, active?.command), ...options, count: n };
    const bot = botSeats(s).find(b => b?.difficulty === 'hard' && b.seat === p);
    if (bot)
        withSeat(s, bot, () => prepareHardLibrary(s, context));
    const deck = s.players[p].deck, ids = context.side === 'bottom' ? deck.slice(Math.max(0, deck.length - n)) : deck.slice(0, n);
    if (bot && (options.public || options.viewer !== undefined))
        rememberHardDeckCards(s, ids, options.public ? null : options.viewer);
    return ids;
}
