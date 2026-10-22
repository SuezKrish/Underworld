import { readFileSync } from 'node:fs';
import { parseCatalog, applyRulings } from './catalog.mjs';
import { applyMetadata } from './metadata.mjs';
import { compileSupported } from './automation.mjs';
import { compileEnvironment } from './environment-definitions.mjs';
import { prepareCodeDeck } from './match-deck.mjs';
import { createRoomState, joinSeat, command, viewFor } from './match.mjs';
import { RuleError } from './core.mjs';
import { getBotProfile } from './bot-deck.mjs';
import { botCommands, botCardValue } from './bot-policy.mjs';
import { hardBotView, hardBotCommands, hardLibraryWeights } from './hard-bot-policy.mjs';
import { installHardLibraryScorer } from './hard-bot-library.mjs';
import { scoreValue } from './scoring.mjs';
import { createEngineAudit, observeEngineStep } from './bot-engine-audit.mjs';
import { auditSilverTransitions } from './bot-silver-audit.mjs';
import { BOT_EVALUATION_SOCIETY_POLICY, evaluationSocietyActions, evaluationBotPolicy } from './bot-evaluation-rules.mjs';
let context;
function catalog() {
    if (!context) {
        const cards = parseCatalog(applyMetadata(applyRulings(readFileSync(new URL('../data/Card.xml', import.meta.url), 'utf8')))).cards, compiled = compileSupported(cards);
        context = { cards, compiled, environment: compileEnvironment(cards), implemented: new Set(compiled.map(c => c.catalogId)), revision: 0, poolRevision: 0 };
    }
    return context;
}
// Isolated, synchronous evaluation only. Production games always use native
// crypto randomness. Restore it even if an engine assertion fails.
function seeded(seed, fn) {
    let n = seed >>> 0 || 1;
    const word = () => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return n >>> 0; };
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const random = { getRandomValues: array => {
            for (let i = 0; i < array.length; i++)
                array[i] = word();
            return array;
        }, randomUUID: () => {
            const b = new Uint8Array(16);
            random.getRandomValues(b);
            b[6] = (b[6] & 15) | 64;
            b[8] = (b[8] & 63) | 128;
            const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
            return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
        } };
    Object.defineProperty(globalThis, 'crypto', { value: random, configurable: true });
    try {
        return fn();
    }
    finally {
        if (previous)
            Object.defineProperty(globalThis, 'crypto', previous);
        else
            delete globalThis.crypto;
    }
}
export function simulateBotMatch({ seed = 1, profiles = ['green-black-renown', 'white-anglican'], maxCommands = 2200, policy = botCommands, cardValue = botCardValue, difficulty = 'normal', openingFirstPlayer = null, includeTrace = false, includeDecisions = false, onProgress } = {}) {
    if (!['normal', 'hard'].includes(difficulty))
        throw Error('Invalid BOT difficulty');
    if (openingFirstPlayer !== null && openingFirstPlayer !== 0 && openingFirstPlayer !== 1)
        throw Error('Invalid opening first player');
    const evaluationPolicy = evaluationBotPolicy(policy);
    const previousScorer = difficulty === 'hard' ? installHardLibraryScorer((s, context) => hardLibraryWeights(s, context, viewFor, cardValue)) : null;
    try {
        return seeded(seed, () => {
            const ctx = catalog(), bots = profiles.map(id => getBotProfile(id));
            if (bots.some(b => !b))
                throw Error('Unknown BOT profile');
            const ids = new Set(bots.flatMap(b => b.deck.cards.map(c => c.cardId))), defs = ctx.compiled.filter(c => ids.has(c.catalogId) || c.token);
            const environment = ctx.environment.map(c => ({ ...c, plan: { ...c.plan, actions: evaluationSocietyActions(c.plan?.actions) } }));
            let s = createRoomState(bots[0].name, 'simulation-0', 'automation-play', defs, defs.filter(c => c.token), environment);
            s.openingFirstPlayer = openingFirstPlayer;
            joinSeat(s, bots[1].name, 'simulation-1');
            s.deckRequired = true;
            s.deckSelections = bots.map(b => prepareCodeDeck(b.deckCode, ctx));
            if (difficulty === 'hard')
                s.simulationBots = bots.map((b, p) => ({ id: b.id, seat: p, difficulty: 'hard', pending: false, actionKeys: [], libraryKnown: {} }));
            const engineAudit = includeDecisions ? createEngineAudit() : null;
            const memory = [[], []], actions = [{}, {}], cardsUsed = [{}, {}], metrics = [0, 1].map(() => ({ cardsToHandFromDeck: 0, investigationWins: 0, zeroFeeSpells: 0, storageRecycles: 0, silverRevealRounds: [], silverLosses: [], spellsByRound: {} })), invalid = {}, trace = [];
            let steps = 0, stalled = null, initialFirstPlayer = null;
            for (; steps < maxCommands && s.status !== 'finished'; steps++) {
                let done = false, lastError = '';
                const priority = s.flow.priority ?? s.turn?.firstPlayer ?? 0;
                for (const p of [priority, 1 - priority]) {
                    s.bot = difficulty === 'hard' ? s.simulationBots[p] : { id: bots[p].id, seat: p, difficulty: 'normal', pending: false };
                    s.bot.actionKeys = memory[p];
                    onProgress?.({ step: steps, seat: p, round: s.round, phase: s.turn?.phase, window: s.turn?.step, stage: 'view' });
                    const v = difficulty === 'hard' ? hardBotView(s, viewFor) : viewFor(s, p, 0, 'SIMULATION');
                    onProgress?.({ step: steps, seat: p, round: s.round, stage: 'policy' });
                    const candidates = difficulty === 'hard' ? hardBotCommands(s, v, evaluationPolicy) : evaluationPolicy(v);
                    for (const c of candidates) {
                        const next = structuredClone(s), code = s.cards[c.cardId]?.catalogId;
                        onProgress?.({ step: steps, seat: p, round: s.round, stage: 'command', command: c.type, card: code, choice: s.effectChoice?.kind });
                        try {
                            command(next, p, { ...c, id: crypto.randomUUID() });
                        }
                        catch (e) {
                            if (!(e instanceof RuleError))
                                throw e;
                            lastError = e.message;
                            invalid[`${c.type}: ${lastError}`] = (invalid[`${c.type}: ${lastError}`] ?? 0) + 1;
                            continue;
                        }
                        if (engineAudit)
                            observeEngineStep(s, next, c, p, engineAudit);
                        if (includeDecisions)
                            auditSilverTransitions(s, next, c, metrics);
                        if (c.botActionKey) {
                            memory[p] = [...memory[p], c.botActionKey].slice(-48);
                            next.bot.actionKeys = memory[p];
                        }
                        actions[p][c.type] = (actions[p][c.type] ?? 0) + 1;
                        if (code)
                            cardsUsed[p][`${code}:${c.type}`] = (cardsUsed[p][`${code}:${c.type}`] ?? 0) + 1;
                        for (let q = 0; q < 2; q++)
                            metrics[q].cardsToHandFromDeck += (next.players[q]?.hand ?? []).filter(id => s.players[q]?.deck.includes(id)).length;
                        if (c.type === 'investigate')
                            metrics[p].investigationWins++;
                        const paid = (s.players[p]?.costPool ?? 0) + (s.players[p]?.assets ?? []).filter(a => !a.tapped).length - (next.players[p]?.costPool ?? 0) - (next.players[p]?.assets ?? []).filter(a => !a.tapped).length;
                        if (c.type === 'play' && s.cards[c.cardId]?.subtypes?.includes('法术')) {
                            metrics[p].spellsByRound[s.round] = (metrics[p].spellsByRound[s.round] ?? 0) + 1;
                            if (paid === 0)
                                metrics[p].zeroFeeSpells++;
                        }
                        if (c.type === 'reveal' && code === 'XG01')
                            metrics[p].silverRevealRounds.push({ round: s.round, phase: s.turn?.phase });
                        for (let q = 0; q < 2; q++)
                            for (const id of s.players[q]?.play ?? [])
                                if (s.cards[id]?.catalogId === 'XG01' && !s.locations[id].faceDown && (next.locations[id]?.zone !== 'play' || next.locations[id]?.faceDown))
                                    metrics[q].silverLosses.push({ round: s.round, phase: s.turn?.phase, destination: next.locations[id]?.zone });
                        if (c.type === 'rule-sacrifice' && c.cardIds?.some(id => s.cards[id]?.catalogId === 'WM055' && Object.values(s.locations).some(l => l.zone === 'sealed' && l.hostId === id)))
                            metrics[p].storageRecycles++;
                        const source = c.type === 'trigger-choice' ? s.triggerChoices.find(a => a.id === c.triggerId)?.cardId : null;
                        trace.push({ step: steps, seat: p, round: s.round, phase: s.turn?.phase, window: s.turn?.step, command: c.type, card: code, source: source ? s.cards[source]?.catalogId : undefined, choice: s.effectChoice?.kind, ...(c.type === 'play' ? { paid } : {}), ...(c.type === 'trigger-choice' ? { fire: c.fire } : {}), ...(c.type === 'secret-deploy' || c.type === 'play' ? { district: c.district } : {}), handCount: next.players[p]?.hand.length, deckCount: next.players[p]?.deck.length, ...(includeTrace ? { ownHand: v.players[p]?.hand.map(c => c.catalogId), loyalty: v.players[p]?.loyalty, assets: (next.players[p]?.assets ?? []).map(a => a.faction) } : {}) });
                        if (includeDecisions && (c.type !== 'pass' || v.turn?.phase === 'action' && v.flow.stepOwner === p && !v.flow.stack.length))
                            Object.assign(trace.at(-1), {
                                candidateChoices: structuredClone(candidates.slice(0, 5)),
                                decision: structuredClone(c), kind: v.turn?.kind, contestDistrict: v.turn?.district,
                                board: v.players.map(x => ({ score: x.score, pool: x.costPool, markers: x.markers, assets: x.assets.map(a => ({ id: a.id, code: a.catalogId, tapped: a.tapped, faction: a.faction })), grave: x.graveyard.map(a => a.catalogId), play: x.play.map(a => ({ id: a.id, code: a.catalogId, name: a.name, type: a.type, d: a.district, hidden: a.faceDown, tapped: a.tapped, icons: a.effectiveIcons, defense: a.effectiveDefense, damage: a.damage, counters: a.counters, barrier: a.barrierNow, preview: a.revealPreview, attachedTo: a.attachedTo })) })),
                                regions: (v.districts ?? []).map(x => x ? { name: x.name, points: x.points, threshold: x.threshold, influence: x.influence } : null),
                                abilities: v.triggerRound?.abilities.map(a => ({ id: a.id, source: a.cardId, event: a.event, effect: a.plan?.effect, operation: a.plan?.operation, target: a.plan?.target })),
                                ownGrave: (v.players[p]?.graveyard ?? []).map(a => ({ id: a.id, code: a.catalogId })), hiddenBonus: v.hidden?.cardBonus,
                            });
                        s = next;
                        if (initialFirstPlayer === null && s.turn?.firstPlayer !== undefined)
                            initialFirstPlayer = s.turn.firstPlayer;
                        // The evaluator never offers undo. Keeping one snapshot avoids copying
                        // thirty unrelated past turns for every candidate, without changing rules.
                        s.undoFrames = s.undoFrames.slice(-1);
                        done = true;
                        break;
                    }
                    if (done)
                        break;
                }
                if (!done) {
                    stalled = { round: s.round, phase: s.turn?.phase, step: s.turn?.step, choice: s.effectChoice?.kind ?? s.roundChoice?.kind, priority: s.flow.priority, lastError };
                    break;
                }
            }
            return { seed, profiles, difficulty, societyAbilityPolicy: BOT_EVALUATION_SOCIETY_POLICY, initialFirstPlayer, status: s.status, winner: s.result?.winner ?? null, reason: s.result?.reason ?? null, rounds: s.round, commands: steps,
                scores: s.players.map(p => p.scoreCards.reduce((n, c) => n + scoreValue(c), 0)), cardsRemaining: s.players.map(p => p.deck.length), actions, cardsUsed, metrics, invalid, stalled,
                ...(includeTrace ? { trace, finalLogs: s.logs.slice(-30).map(l => l.text) } : {}), ...(includeDecisions ? { logs: s.logs, engineAudit } : {}) };
        });
    }
    finally {
        if (difficulty === 'hard')
            installHardLibraryScorer(previousScorer);
    }
}
