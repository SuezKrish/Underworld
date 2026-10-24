import { withProjectionReads } from './projection-read-cache.mjs';
import { sealPayloadAssessment } from './bot-seal-gift-planning.mjs';
import { cardCapabilities } from './bot-card-analysis.mjs';
import { knownOpponentOptions, opponentCapabilityForecast } from './bot-matchup-planning.mjs';
import { informedBot } from './bot-difficulty.mjs';
import { announcedHiddenBonus } from './bot-hidden-information.mjs';
import { identity } from './ownership.mjs';
import { botCommands, botCardValue, botAssetValue } from './bot-policy.mjs';
import { hardBot, rememberHardObservations } from './hard-bot-library.mjs';
import { hasCardType } from './card-types.mjs';
import { spellLibraryBonus } from './spell-bot-planning.mjs';
import { redPurpleLibraryBonus } from './red-purple-bot-policy.mjs';
import { lockingLibraryBonus } from './shoggoth-bot-policy.mjs';
import { criminalGravePriority, criminalLibraryBonus, greenLibraryBonus } from './bot-dynamic-planning.mjs';
import { needsAssetMaterial, assetAcquisitionValue, graveyardPurposeValue } from './bot-card-purpose.mjs';
import { graveyardPlanning, hiddenContestReady } from './bot-graveyard-uses.mjs';
import { rumorHosts } from './bot-rumor-planning.mjs';
import { responseFilter } from './response-effect-semantics.mjs';
const mana = p => (p.costPool ?? 0) + (p.assets ?? []).filter(a => !a.tapped).length;
const strength = (c, v, p) => (c.printedCost ?? 0) + (c.hiddenAbilities ?? []).filter(a => a.kind === 'point-modifier' && !a.condition).reduce((n, a) => n + (a.amount ?? a.modifier ?? 0), 0) + announcedHiddenBonus(v, c, p);
export function hardBotView(s, view, { observe = true } = {}) {
    return withProjectionReads(() => {
        const p = s.bot.seat, v = view(s, p, 0, 'BOT');
        if (!informedBot(s))
            return v;
        if (observe)
            rememberHardObservations(s);
        const q = 1 - p, foe = view(s, q, 0, 'BOT');
        v.players[q].hand = foe.players[q].hand;
        const rival = s.simulationBots?.find(b => b?.seat === q), hiddenOrder = hardBot(s) && rival?.difficulty === 'hard';
        const opponentDeck = s.players[q].deck.map(id => identity(s, id));
        const fixed = hiddenOrder ? s.players[q].deck.flatMap((id, index) => Object.hasOwn(rival.libraryKnown ?? {}, id) && rival.libraryKnown[id] === s.locations[id]?.zoneVersion ? [{ index, card: identity(s, id) }] : []) : [];
        const real = new Map(s.players[q].play.map(id => [s.locations[id].faceDown ? `hidden:${s.locations[id].hiddenHandle}` : id, id]));
        v.players[q].play = v.players[q].play.map(c => { const id = real.get(c.id), full = foe.players[q].play.find(x => x.id === id); return full ? { ...full, ...(c.secretPlan ? { hardPrintedCard: structuredClone(s.cards[id]), name: s.cards[id].name, displayName: s.cards[id].displayName, catalogId: s.cards[id].catalogId } : {}), id: c.id, faceDown: c.faceDown, secretPlan: c.secretPlan, hardKnown: true, hardObjectId: id } : c; });
        v.hardInfo = { ownDeck: s.players[p].deck.map(id => identity(s, id)), canControlLibrary: hardBot(s), opponentSealed: Object.keys(s.locations).filter(id => s.locations[id].zone === 'sealed' && s.cards[id]?.owner === q).map(id => ({ ...identity(s, id), hardPrintedCard: structuredClone(s.cards[id]) })), opponentDeck: hiddenOrder ? [] : opponentDeck, opponentDeckOrderKnown: !hiddenOrder, opponentCanControlLibrary: hiddenOrder, opponentDeckPool: hiddenOrder ? [...opponentDeck].sort((a, b) => a.id.localeCompare(b.id)) : [], opponentKnownPositions: fixed, opponentSelection: s.hidden?.selections?.[q] ?? null, opponentRevealCosts: Object.fromEntries([...real].map(([visible, id]) => [visible, foe.revealCosts?.[id] ?? Math.max(0, (s.cards[id]?.printedCost ?? 0) - 1)])), opponentCastingCosts: foe.castingCosts ?? {}, libraryKnown: { ...s.bot.libraryKnown } };
        return v;
    });
}
export function hardLibraryWeights(s, context, view, cardValue = botCardValue, compact = true) {
    const scoreView = compact ? (s, p, r, c) => view(s, p, r, c, { libraryScoreOnly: true }) : view;
    const v = hardBotView(s, scoreView, { observe: false }), p = s.bot.seat, own = v.players[p], opponent = v.players[1 - p], cards = v.hardInfo.ownDeck;
    const assetNeeded = context.kind === 'hand' && needsAssetMaterial(v, botAssetValue);
    const gravePlan = context.kind === 'graveyard' ? graveyardPlanning(v, cards, cardValue, context, botAssetValue) : null;
    if (gravePlan) {
        gravePlan.rumorHosts = rumorHosts(v);
        gravePlan.hiddenReady = hiddenContestReady(v);
    }
    const graveScores = gravePlan ? new Map(cards.map(c => [c.id, (criminalGravePriority(v, c, { ...context, gravePlan, cardValue }) ?? graveyardPurposeValue(v, c, cardValue, gravePlan)) - (gravePlan.loyaltyReserve.has(c.id) ? 180 : 0)])) : null;
    // A once-per-batch loot needs at most one matching milled card. Prefer a
    // useful rumor for that role, rather than boosting every expensive body.
    if (gravePlan) {
        const known = v.hardInfo.libraryKnown ?? {}, segment = context.side === 'bottom' ? cards.slice(-(context.count ?? 1)) : cards.slice(0, context.count ?? 1);
        const watches = own.play.filter(c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed).flatMap(c => c.automation?.watch ?? []).filter(w => w.event === 'grave-entry' && w.own && w.fromDeck && w.oncePerBatch);
        for (const w of watches) {
            const matches = c => responseFilter(c, w.filter);
            if (segment.some(c => Object.hasOwn(known, c.id) && matches(c)))
                continue;
            const best = cards.filter(c => !Object.hasOwn(known, c.id) && matches(c)).sort((a, b) => graveScores.get(b.id) - graveScores.get(a.id) || a.id.localeCompare(b.id))[0];
            if (best)
                graveScores.set(best.id, graveScores.get(best.id) + (own.hand.length < 4 ? 28 : 10));
        }
    }
    return Object.fromEntries(cards.map(c => {
        if (context.kind === 'seal' && context.sealHostId) {
            const host = v.players.flatMap(p => p.play).find(c => c.id === context.sealHostId) ?? { id: context.sealHostId, controller: p };
            return [c.id, sealPayloadAssessment(v, c, host, { value: c => cardValue(v, c), sealCommitted: true }).utility];
        }
        let n = cardValue(v, c) + (context.matchingCost === c.printedCost ? 100 : 0);
        const same = own.hand.filter(x => x.catalogId === c.catalogId).length;
        n -= same * 4;
        if (context.kind === 'graveyard') {
            n = graveScores.get(c.id);
        }
        else {
            n += spellLibraryBonus(v, c) + redPurpleLibraryBonus(v, c, context) + lockingLibraryBonus(v, c, context) + criminalLibraryBonus(v, c, context) + greenLibraryBonus(v, c, context);
            if (s.bot.id === 'purple-matriarch' && context.kind === 'seal') {
                const whales = own.play.filter(x => !x.faceDown && x.catalogId === 'JZ64').length;
                const spirit = c.keywordStates?.find(x => x.keyword === '灵体')?.present ?? c.keywords?.includes('灵体');
                n += (c.catalogId === 'XQ41' ? 100 : c.catalogId === 'JZ63' ? 35 : 0) + (spirit ? whales * 24 : 0);
            }
            const threats = opponent.play.filter(x => !x.faceDown && (x.printedCost ?? 0) >= 4).length;
            if (threats && ['destroy', 'return-hand', 'terminate'].includes(c.spell?.effect))
                n += threats * 4;
            if ((own.hand.length < 4 || s.round < 3) && /抓|寻找|检视/.test(c.text ?? ''))
                n += 4;
            if ((own.loyalty?.factions?.[c.faction?.split('·')[0]] ?? 0) < 1 && own.assets.length < 4 && !c.keywords?.includes('非资产'))
                n += 2;
            if ((c.printedCost ?? 0) > mana(own) + 2)
                n -= 5;
            if (cardCapabilities(c).removal && knownOpponentOptions(v).some(x => x.available && ['top', 'bottom'].includes(x.origin) && hasCardType(x.card, 'character') && (x.card.printedCost ?? 0) >= 4))
                n += 3;
            if (assetNeeded) {
                const material = assetAcquisitionValue(v, c, botAssetValue, true);
                if (material !== null)
                    n = Math.max(n, material);
            }
        }
        return [c.id, n];
    }));
}
export function hardBotCommands(s, v, policy = botCommands) {
    const commands = policy(v);
    if (!informedBot(s) || !commands.length)
        return commands;
    const p = v.seat, enemy = v.players[1 - p], mine = v.players[p];
    if (v.effectChoice?.controller === p && v.effectChoice.kind === 'guess-cost') {
        const top = v.hardInfo.ownDeck[0], known = top && Object.hasOwn(v.hardInfo.libraryKnown, top.id), choice = !hardBot(s) || known ? top : [...v.hardInfo.ownDeck].filter(c => !Object.hasOwn(v.hardInfo.libraryKnown, c.id)).sort((a, b) => botCardValue(v, b) - botCardValue(v, a))[0];
        if (choice)
            return [{ type: 'effect-choice', choiceId: v.effectChoice.id, number: choice.printedCost }];
    }
    if (v.hidden?.step === 2 && !v.hidden.committed[p] && v.hidden.canSelect) {
        const selection = v.hardInfo.opponentSelection, ids = Array.isArray(selection) ? selection : selection?.cardIds ?? (selection?.cardId ? [selection.cardId] : typeof selection === 'string' ? [selection] : []), selected = ids.map(id => enemy.hand.find(c => c.id === id)).filter(Boolean);
        const threshold = selected.length ? selected.reduce((n, c) => n + strength(c, v, 1 - p), 0) : Math.max(0, ...enemy.hand.map(c => strength(c, v, 1 - p)));
        const ordered = [...mine.hand].sort((a, b) => {
            const winA = strength(a, v, p) > threshold, winB = strength(b, v, p) > threshold;
            if (winA !== winB)
                return winA ? -1 : 1;
            return botCardValue(v, a) - botCardValue(v, b) || strength(b, v, p) - strength(a, v, p);
        });
        return ordered.map(c => ({ type: 'select-hidden', cardId: c.id }));
    }
    const lookup = id => v.players.flatMap(p => [...p.play, ...p.hand, ...p.graveyard, ...p.headquarters ?? []]).find(c => c.id === id);
    const danger = opponentCapabilityForecast(v).removal;
    return commands.map((c, i) => {
        let score = -i;
        for (const id of c.targetIds ?? []) {
            const target = lookup(id);
            if (target?.controller !== p && target?.hardKnown)
                score += Math.min(12, botCardValue(v, target) * 0.5);
        }
        if (c.type === 'reveal' && danger > 0) {
            const role = lookup(c.cardId);
            if (role && !role.barrierNow && !role.eternalNow) {
                const cap = cardCapabilities(role);
                if (cap.draw || cap.discount || cap.grave || cap.protection)
                    score -= Math.min(9, danger * 3);
            }
        }
        if (c.type === 'play') {
            const card = lookup(c.cardId);
            if (card?.spell?.effect === 'terminate' && v.flow.stack.at(-1)?.controller !== p)
                score += 2;
        }
        return { c, score };
    }).sort((a, b) => b.score - a.score).map(x => x.c);
}
