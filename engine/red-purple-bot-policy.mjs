import { refillInvestmentPenalty } from './bot-refill-economy.mjs';
import { nonDrawLockValue, nonDrawLockActive, nonDrawEffectBlocked } from './bot-draw-lock-planning.mjs';
import { entryTapTempo, bestEntryTapTempo, mutantSealTempo } from './bot-entry-tempo.mjs';
import { giftAssessment, rankSealPayloads } from './bot-seal-gift-planning.mjs';
import { tormentUtility } from './bot-torment-planning.mjs';
import { announcedHiddenBonus } from './bot-hidden-information.mjs';
import { rumorTriggerChoices } from './bot-rumor-planning.mjs';
import { pendingTargetThreat } from './bot-response-timing.mjs';
import { hasCardType } from './card-types.mjs';
import { investigationRelief } from './bot-library-safety.mjs';
// Ordinary seat views only: public board/zones and this player's hand.
export const redBot = v => v.bot?.id === 'red-monastery';
export const purpleBot = v => v.bot?.id === 'purple-matriarch';
const active = v => redBot(v) || purpleBot(v), me = v => v.players[v.seat], foe = v => v.players[1 - v.seat];
const front = v => me(v).play.filter(c => !c.faceDown), live = (v, id) => front(v).filter(c => c.catalogId === id && !c.printedTextBlank && !c.abilitiesSuppressed), has = (v, id) => live(v, id).length > 0;
const seals = (v, id) => (v.sealed ?? []).filter(c => c.hostId === id);
const revival = v => v.societies?.[v.seat]?.counters?.revival ?? 0;
// The draw step precedes this turn's available revival-counter action.
// Forecast it for acquisition only; casting still uses actual counters.
export function motherAcquisitionCurve(v) {
    const soc = v.societies?.[v.seat], now = revival(v), counter = soc?.actions?.find(a => a.id === 'revival-counter');
    const pending = (v.flow?.stack ?? []).some(a => a.controller === v.seat && a.ops?.some(o => o.kind === 'society-counter' && o.counter === 'revival' && o.amount > 0));
    const ahead = ['setup', 'start', 'action'].includes(v.turn?.phase);
    return Math.min(8, now + Number(!!(pending || ahead && counter && !counter.used && !soc.tapped)));
}
const role = c => hasCardType(c, 'character');
const sameHeld = (v, c) => me(v).hand.some(x => x.catalogId === c.catalogId);
const timing = v => v.turn.standardAllowed && v.flow.stepOwner === v.seat && !v.flow.stack.length;
const price = (v, c, h) => v.castingCosts?.[c.id] ?? h.cost(c);
const destroyed = v => (v.districts ?? []).filter(d => d?.destroyed).length + v.players.reduce((n, p) => n + (p.scoreCards ?? []).filter(c => c.destroyed).length, 0);
const activeDestruction = v => (v.districts ?? []).filter(d => d?.destroyed).length;
const capturedDestruction = v => (me(v).scoreCards ?? []).reduce((n, c) => n + (c.destroyed ?? 0), 0);
// BB359AN5: a disaster can claim the final destroyed region before the
// society-switch spell resolves. Only count active, already-present Witherers.
function doomFinishDistricts(v) {
    const marks = live(v, 'XG14').length, p = v.seat, captured = capturedDestruction(v);
    return (v.districts ?? []).flatMap((d, i) => d?.destroyed && captured + d.destroyed >= 3 && Math.max(0, d.threshold + d.influence[1 - p] - d.influence[p]) <= marks ? [i] : []);
}
function lethalRisk(v, c, d, h) {
    if (!h.lethalBattleRisk(v, c, d))
        return false;
    const spirit = h.keyword(c, '灵体') || (!c.printedTextBlank && !c.abilitiesSuppressed && (me(v).effectiveMarkers ?? me(v).markers).hidden > 0 && (c.automation?.conditionalKeywords?.hidden ?? c.conditionalKeywords?.hidden ?? []).includes('灵体'));
    if (!spirit)
        return true;
    const wounds = foe(v).play.filter(x => !x.faceDown && !x.tapped && x.district === d).reduce((n, x) => {
        const states = x.keywordStates ?? (x.keywords ?? []).map(keyword => ({ keyword, present: true }));
        return n + Math.max(0, ...states.filter(k => k.present && /^创伤\d+$/.test(k.keyword)).map(k => k.amount ?? Number(k.keyword.slice(2))));
    }, 0);
    const existing = me(v).play.find(x => x.id === c.id && x.district === d && !x.tapped), before = existing ? (existing.effectiveIcons ?? existing.icons ?? {}).battle ?? 0 : 0;
    const after = c.tapped ? 0 : (c.effectiveIcons ?? c.icons ?? {}).battle ?? 0, margin = h.total(v, 1 - v.seat, d, 'battle') - h.total(v, v.seat, d, 'battle') - (after - before);
    if (Math.min(wounds, margin) >= (c.effectiveDefense ?? c.defense ?? 1) - (c.damage ?? 0))
        return true;
    const domains = p => v.players[p].play.filter(x => !x.faceDown && x.district === d && x.id !== c.id).reduce((n, x) => n + (x.effectiveMagicDomains ?? x.magicDomains ?? []).length, 0);
    return domains(v.seat) + (c.effectiveMagicDomains ?? c.magicDomains ?? []).length <= domains(1 - v.seat);
}
export function purpleLibraryUse(v, a) {
    if (!purpleBot(v))
        return 0;
    const count = plan => !plan || nonDrawEffectBlocked(v) && plan.effect === 'draw' ? 0 : plan.effect === 'sequence' ? (plan.steps ?? []).reduce((n, p) => n + count(p), 0) : ['draw', 'bottom-to-hand', 'seal-top', 'seal-search'].includes(plan.effect) ? plan.count ?? 1 : 0;
    return a.plan ? count(a.plan) : a.responseEffect?.libraryUse ?? 0;
}
export function purpleLibraryBudget(v, h) {
    // Once the hand is already stocked, preserve another round of unavoidable
    // draws as well as this round. Nested whale rounds share queued consumption.
    const stocked = me(v).hand.length >= Math.max(4, (me(v).handLimit ?? 7) - 1);
    // Later deployments can win investigations that today's board would lose.
    const nextInvestigations = nonDrawLockActive(v) ? 0 : (v.districts ?? []).filter(Boolean).length;
    const reserve = h.drawReserve(v) + (stocked ? 1 + nextInvestigations : 0);
    const queued = (v.flow?.stack ?? []).filter(a => a.controller === v.seat).reduce((n, a) => n + purpleLibraryUse(v, a), 0);
    return Math.max(0, me(v).deckCount - reserve - queued);
}
export function redPurpleLibraryBonus(v, c, context) {
    if (context.kind !== 'hand' || !active(v))
        return 0;
    const missing = code => !has(v, code) && !me(v).hand.some(x => x.catalogId === code) && !me(v).play.some(x => x.faceDown && x.catalogId === code);
    if (redBot(v)) {
        if (v.societies?.[v.seat]?.plan?.disasterOnly) {
            // After the switch only disasters can be cast. A forbidden character is
            // useful as an asset or priest fuel, not as a future field engine.
            if (!c.subtypes?.includes('灾难')) {
                const priest = v.societies[v.seat].actions?.find(a => a.id === 'priest');
                const fuel = c.faction?.includes(priest?.discard?.factionName ?? '鸣钟教派');
                return fuel && !priest?.discardOptions?.length && !v.societies[v.seat].tapped ? 25 : -100;
            }
            const copies = front(v).filter(x => x.catalogId === c.catalogId).length;
            const cost = Math.max(0, (c.printedCost ?? 0) - activeDestruction(v) * (c.automation?.destroyedPlayDiscount ?? 0));
            const funds = Math.max((me(v).costPool ?? 0) + me(v).assets.filter(a => !a.tapped).length, me(v).assets.length + Number(!me(v).actionsUsed?.asset));
            if (cost > funds + 1)
                return -30;
            if (c.catalogId === 'BQ047' && foe(v).assets.length >= 4)
                return sameHeld(v, c) ? 10 : 125;
            if (c.catalogId === 'XG14')
                return sameHeld(v, c) ? 15 : Math.max(45, 115 - copies * 25);
            return sameHeld(v, c) ? 0 : 55;
        }
        if (v.round === 2 && c.catalogId === 'XG36' && missing('XG36'))
            return 230;
        if (v.round <= 2 && c.catalogId === 'JC042' && missing('JC042'))
            return 110;
        if (v.round <= 3 && c.catalogId === 'XG36' && missing('XG36'))
            return 75;
        if (c.catalogId === 'JZ42' && missing('JZ42') && !v.societies?.[v.seat]?.plan?.disasterOnly && v.round >= 4 && destroyed(v) >= 2)
            return capturedDestruction(v) >= 2 ? 180 : 110;
        const futureRed = (me(v).loyalty?.factions?.红 ?? 0) + Number(!me(v).actionsUsed?.asset && me(v).hand.some(x => x.id !== c.id && !x.nonAssetNow && x.faction?.startsWith('红')));
        if (c.catalogId === 'XG14' && missing('XG14') && activeDestruction(v) >= 1 && futureRed >= 3 && v.round >= 3)
            return 135;
        if (c.catalogId === 'JZ32' && missing('JZ32') && activeDestruction(v) >= 1 && v.round >= 3)
            return 95;
        if (c.catalogId === 'BH23' && missing('BH23') && activeDestruction(v) < 3 && front(v).length && v.round >= 4)
            return 70;
        if (c.catalogId === 'WM033' && missing('WM033') && v.round >= 3)
            return 75;
        if (c.catalogId === 'BH24' && missing('BH24') && activeDestruction(v) < 3 && front(v).length && v.round <= 5)
            return 70;
        if (c.catalogId === 'XG14' && missing('XG14') && activeDestruction(v) >= 2 && (me(v).loyalty?.factions?.红 ?? 0) >= 3)
            return 60;
        return 0;
    }
    const curve = motherAcquisitionCurve(v);
    // A future free deployment is not an immediate engine. Do not use an early
    // controlled draw on a body several turns above both the revival curve and
    // the available mana, merely because its eventual field value is high.
    const budget = Math.max(curve, (me(v).costPool ?? 0) + me(v).assets.filter(a => !a.tapped).length, me(v).assets.length + Number(!me(v).actionsUsed?.asset));
    const wait = (v.castingCosts?.[c.id] ?? c.printedCost ?? 0) - budget;
    if (role(c) && wait > 1)
        return -Math.min(90, wait * 15);
    if (role(c) && c.unique && sameHeld(v, c))
        return -45;
    if (curve <= 1 && missing('BH46') && missing('XQ42') && ['BH46', 'XQ42'].includes(c.catalogId))
        return c.catalogId === 'BH46' ? 120 : 110;
    if (curve === 2 && ['XQ44', 'WM067'].includes(c.catalogId) && missing(c.catalogId))
        return c.catalogId === 'XQ44' ? 90 : (me(v).effectiveMarkers ?? me(v).markers).hidden ? 85 : 25;
    if (curve >= 3 && curve <= 4 && c.automation?.entry?.effect === 'tap' && missing(c.catalogId) && bestEntryTapTempo(v, c) >= 25)
        return 160;
    if (curve >= 3 && curve <= 4 && c.catalogId === 'JZ62' && missing('JZ62'))
        return 135;
    if (curve === 3 && c.catalogId === 'JZ63' && missing('JZ63') && !has(v, 'JZ62'))
        return 75;
    if (curve >= 5 && c.catalogId === 'JZ64' && missing('JZ64'))
        return 100;
    if (c.catalogId === 'WM066' && missing('WM066') && (has(v, 'JZ64') || curve >= 3 && (has(v, 'BH46') || has(v, 'JZ62'))))
        return 95;
    if (curve >= 3 && c.catalogId === 'BH51' && missing('BH51') && !(me(v).effectiveMarkers ?? me(v).markers).hidden && has(v, 'WM066'))
        return 105;
    return 0;
}
function earlyBonus(v, c) {
    if (!redBot(v) || v.round > 4)
        return 0;
    if (c.catalogId === 'XG36')
        return has(v, 'XG36') ? 0 : 18;
    if (c.catalogId === 'JC045')
        return has(v, 'JC045') ? 0 : 16;
    if (c.catalogId === 'JC042')
        return has(v, 'JC042') ? 0 : 12;
    if (c.catalogId === 'JZ32' && activeDestruction(v) > 0)
        return has(v, 'JZ32') ? 0 : 18;
    if (c.catalogId === 'BH24')
        return (me(v).effectiveMarkers ?? me(v).markers).hidden ? 8 : 20;
    return 0;
}
function redHiddenPoints(v, c, h) { return h.hiddenStrength(c, v) + announcedHiddenBonus(v, c); }
export function redPurpleHiddenScore(v, c, h) {
    if (purpleBot(v)) {
        const payoff = !!v.hidden?.cardBonus || has(v, 'CQ32') && me(v).graveyard.some(x => x.subtypes?.includes('梦魇'));
        if (!payoff)
            return undefined;
        const points = redHiddenPoints(v, c, h);
        return (points >= 6 ? 80 : points * 7) - h.handValue(v, c) * 0.6 - points * 0.2;
    }
    if (!redBot(v) || v.hidden?.cardBonus?.faction !== '红')
        return undefined;
    const points = redHiddenPoints(v, c, h);
    const imminentDiscount = c.catalogId === 'XG14' && activeDestruction(v) >= 1 ? 25 : 0;
    return (points >= 6 ? 100 : points * 5) - h.handValue(v, c) * 0.8 - points * 0.1 - imminentDiscount;
}
function canTakePoint(v, c, h) {
    if (h.keyword(c, '永恒'))
        return false;
    if (!h.keyword(c, '灵体'))
        return true;
    const domains = p => v.players[p].play.filter(x => !x.faceDown && x.district === c.district).reduce((n, x) => n + (x.effectiveMagicDomains ?? x.magicDomains ?? []).length, 0);
    return domains(c.controller) <= domains(1 - c.controller);
}
function preserveEngineTap(v, source, host, h) {
    const p = v.seat, q = 1 - p, d = host?.district, r = v.districts?.[d];
    if (!host || host.controller !== p || host.owner !== p || host.tapped || host.cannotTap || host.printedTextBlank || host.abilitiesSuppressed ||
        !['CQ32', 'JZ64', 'WM066', 'WM071', 'WM068', 'LC17', 'CQ33'].includes(host.catalogId) ||
        !(me(v).effectiveMarkers ?? me(v).markers).hidden || v.turn.step !== 'contest-before' || v.turn.kind !== 'influence' || v.turn.district !== d ||
        !r || r.pendingWinner !== null && r.pendingWinner !== undefined || v.turn.claimWinner !== null && v.turn.claimWinner !== undefined)
        return false;
    // A region claim also replenishes the library. Do not keep stocked draw
    // engines indefinitely when their cards should return to the deck instead.
    if (me(v).deckCount <= Math.max(6, h.drawReserve(v) + 2) || host.catalogId !== 'CQ32' && me(v).hand.length >= 5)
        return false;
    const points = Math.max(0, (r.points ?? 0) - (r.destroyed ?? 0));
    if ((me(v).score ?? 0) + points >= (me(v).victoryThreshold ?? 8))
        return false;
    const before = h.total(v, p, d, 'influence'), enemy = h.total(v, q, d, 'influence');
    const hostStars = (host.effectiveIcons ?? host.icons ?? {}).influence ?? 0, sourceStars = source.district === d ? ((source.effectiveIcons ?? source.icons ?? {}).influence ?? 0) : 0;
    // A sealed mutant can also induce pastor tokens. Even placing all those
    // tokens here must not undo the intended delay of the region's claim.
    const tokens = v.turn.firstPlayer === p ? live(v, 'WM066').length : 0, after = before - hostStars - sourceStars + tokens;
    return (r.influence[p] ?? 0) + Math.max(0, before - enemy - (r.influence[q] ?? 0)) >= r.threshold &&
        (r.influence[p] ?? 0) + Math.max(0, after - enemy - (r.influence[q] ?? 0)) < r.threshold &&
        (r.influence[q] ?? 0) + Math.max(0, enemy - after - (r.influence[p] ?? 0)) < r.threshold;
}
function sweepLoss(v, p, h, district) { return v.players[p].play.filter(c => !c.faceDown && role(c) && (district === undefined ? v.districts[c.district]?.destroyed : c.district === district) && (c.effectiveDefense ?? c.defense ?? 1) - (c.damage ?? 0) <= 1 && canTakePoint(v, c, h)).reduce((n, c) => n + h.value(c) + engineBonus(v, c), 0); }
function engineBonus(v, c) {
    const ids = redBot(v) ? ['XG14', 'WM033', 'BH23', 'JC045'] : ['JZ64', 'WM066', 'WM071', 'JZ62', 'WM068'];
    if (!ids.includes(c.catalogId))
        return 0;
    const copies = front(v).filter(x => x.catalogId === c.catalogId).length;
    const weight = { XG14: 14, WM033: 10, BH23: 12, JC045: 8, JZ64: 24, WM066: 22, WM071: 34, JZ62: 14, WM068: 12 };
    // Belandanna is a field engine only when deployable. The society can tutor
    // her later, so early acquisition/asset retention should chiefly value her
    // hidden-contest strength rather than reserve an eight-cost engine forever.
    if (purpleBot(v) && c.catalogId === 'WM071' && !front(v).some(x => x.id === c.id)) {
        const curve = motherAcquisitionCurve(v);
        return (curve >= 8 ? 34 : curve === 7 ? 8 : 0) * (copies ? 0.2 : 1);
    }
    return (weight[c.catalogId] ?? 0) * (copies ? 0.2 : 1);
}
export function motherValue(v, c, h) {
    if (c.spell?.operation === 'torment')
        return tormentUtility(v, c, h) * 2;
    if (c.spell?.operation === 'hidden-gift')
        return (giftAssessment(v, c, { ...h, giftCost: 0 })?.utility ?? -100) * 2;
    let n = engineBonus(v, c) + h.cost(c) * 2 + bestEntryTapTempo(v, c);
    const curve = revival(v);
    if (curve === 1) {
        if (c.catalogId === 'XQ42')
            n += 40;
        if (c.catalogId === 'BH46' && me(v).play.some(x => x.id === c.id && x.faceDown))
            n += 55;
    }
    if (curve === 2)
        n += c.catalogId === 'XQ44' ? 70 : c.catalogId === 'WM067' ? ((me(v).effectiveMarkers ?? me(v).markers).hidden ? 55 : 8) : 0;
    if (curve === 3)
        n += c.catalogId === 'JZ62' ? 40 : ['WM068', 'JZ63', 'BH51'].includes(c.catalogId) ? 35 : 0;
    if (c.catalogId === 'JZ64')
        n += (has(v, 'JZ64') ? 8 : 28) + (has(v, 'WM066') || me(v).hand.some(x => x.catalogId === 'WM066') ? 18 : 0);
    if (c.catalogId === 'WM066')
        n += (has(v, 'WM066') ? 0 : 8) + (has(v, 'JZ64') ? 20 : !has(v, 'WM066') && curve >= 3 && (has(v, 'BH46') || has(v, 'JZ62')) ? 28 : 0);
    if (c.catalogId === 'BH46' && me(v).play.some(x => x.id === c.id && x.faceDown))
        n += 20 + (has(v, 'JZ64') ? 16 : 0) + (has(v, 'WM066') ? 16 : 0);
    if (c.catalogId === 'WM067' && curve !== 2 && (me(v).effectiveMarkers ?? me(v).markers).hidden)
        n += 24;
    if (c.automation?.static === 'block-non-draw')
        n += nonDrawLockValue(v, c);
    if (c.spell?.effect === 'damage')
        n += Math.max(0, ...(v.spellTargets?.[c.id] ?? []).map(o => h.lookup(v, o.id)).filter(x => x?.controller !== v.seat && !x?.faceDown).map(x => (x.effectiveDefense ?? x.defense ?? 1) - (x.damage ?? 0) <= (c.spell.amount ?? 1) ? h.value(x) * 3 : 0));
    if (c.catalogId === 'WM069' && !has(v, 'WM069'))
        n += 12;
    if (c.catalogId === 'BH51' && !(me(v).effectiveMarkers ?? me(v).markers).hidden && has(v, 'WM066'))
        n += 70;
    return n - refillInvestmentPenalty(v, c, h) + (c.catalogId === 'XQ42' ? 24 : 0);
}
// Expose the actual free-play prospect to the common two-action planner.
export function redPurpleFreeProspect(v, command, h) {
    if (!purpleBot(v) || command.abilityId !== 'revival-play')
        return null;
    const candidates = h.sorted([...me(v).hand, ...me(v).play.filter(c => c.faceDown)].filter(c => h.cost(c) <= revival(v) && h.loyalty(v, c) && !h.duplicate(v, c)), c => motherValue(v, c, h));
    for (const card of candidates) {
        const hidden = me(v).play.find(c => c.id === card.id && c.faceDown), play = hidden ? { type: 'reveal', cardId: card.id, district: hidden.district } : playOptions(v, card, h, true)[0];
        if (!play || hidden && lethalRisk(v, h.faceUp(v, hidden), hidden.district, h))
            continue;
        return { card: h.faceUp(v, card), command: play, plan: card.spell ?? card.attachment, cost: 0, isCard: true, freeKey: 'revival-play', resourceKey: 'revival-play' };
    }
    return null;
}
function waterFirst(v, h) {
    if (me(v).actionsUsed.secret || me(v).secretDeploymentBlocked || h.pool(v) < 1 || revival(v) < 1)
        return null;
    const card = me(v).hand.find(c => c.catalogId === 'BH46');
    if (!card || card.publicNow || !h.loyalty(v, card))
        return null;
    const district = [...h.districts(v, h.faceUp(v, card))].sort((a, b) => h.districtScore(v, b, h.faceUp(v, card)) - h.districtScore(v, a, h.faceUp(v, card)) || a - b).find(d => !lethalRisk(v, h.faceUp(v, card), d, h) && h.secretDeploymentPrice(v, d) <= h.pool(v));
    return district === undefined ? null : { type: 'secret-deploy', cardId: card.id, district };
}
export function redPurpleHandBonus(v, c) {
    if (!active(v))
        return 0;
    if (redBot(v) && v.societies?.[v.seat]?.plan?.disasterOnly && !c.subtypes?.includes('灾难'))
        return -12;
    const bidReserve = redBot(v) && v.hidden?.cardBonus?.faction === '红' && c.automation?.destroyedPlayDiscount && me(v).hand.some(x => x.id === c.id) &&
        (v.castingCosts?.[c.id] ?? c.printedCost ?? 0) <= (me(v).costPool ?? 0) + me(v).assets.filter(a => !a.tapped).length ? 70 : 0;
    return bidReserve + engineBonus(v, c) + earlyBonus(v, c) + (purpleBot(v) && ['XQ42', 'BH46'].includes(c.catalogId) ? 8 : 0) + (redBot(v) && c.catalogId === 'JZ42' && !v.societies?.[v.seat]?.plan?.disasterOnly ? 35 : 0) + (redBot(v) && c.catalogId === 'BH23' && !has(v, 'BH23') && v.round >= 3 && activeDestruction(v) < 3 ? 20 : 0);
}
export function redPurpleAssetReserve(v, c) {
    if (!active(v))
        return 0;
    const other = [...front(v), ...me(v).hand, ...me(v).play.filter(x => x.faceDown)].some(x => x.id !== c.id && x.catalogId === c.catalogId);
    if (redBot(v) && c.catalogId === 'JZ42' && !v.societies?.[v.seat]?.plan?.disasterOnly)
        return other ? 0 : 260;
    if (!purpleBot(v) || other)
        return 0;
    const curve = motherAcquisitionCurve(v);
    if (c.catalogId === 'JZ62' && curve <= 4)
        return 80;
    if (c.catalogId === 'WM066' && (has(v, 'JZ64') || curve >= 3 && (has(v, 'BH46') || has(v, 'JZ62'))))
        return 85;
    if (c.catalogId === 'JZ64' && curve >= 4)
        return 90;
    return 0;
}
export function redPurpleAssetBonus(v, c) {
    if (!active(v))
        return 0;
    if (redBot(v) && v.societies?.[v.seat]?.plan?.disasterOnly && !c.subtypes?.includes('灾难'))
        return -35;
    let n = engineBonus(v, c) * 2 + earlyBonus(v, c);
    if (redBot(v)) {
        const switchPlan = !v.societies?.[v.seat]?.plan?.disasterOnly && (v.round >= 4 || me(v).hand.some(x => x.catalogId === 'JZ42'));
        const red = me(v).loyalty?.factions?.红 ?? 0;
        if (c.faction?.startsWith('红') && red < (switchPlan ? 5 : 3))
            n -= (switchPlan ? 110 : 75) - 10 * Math.min(3, red);
        if (c.catalogId === 'JZ42' && !v.societies?.[v.seat]?.plan?.disasterOnly)
            n += 100;
        if (c.catalogId === 'JC042' && !front(v).some(x => x.catalogId === 'JC042') && me(v).hand.some(x => x.id !== c.id && role(x) && Number(x.printedCost) >= 3 && x.faction?.startsWith('红')))
            n += 28;
    }
    else {
        if (!v.societies?.[v.seat]?.plan?.ignorePurpleLoyalty && !(me(v).loyalty?.factions?.紫 > 0) && c.faction?.startsWith('紫'))
            n -= 80;
        for (const [domain, count] of Object.entries({ 心灵: 1, 鲜血: 2, 星辰: 1 }))
            if (c.magicDomains?.includes(domain) && (me(v).loyalty?.domains?.[domain] ?? 0) < count)
                n -= 20;
        if (['XQ41', 'WM069'].includes(c.catalogId))
            n -= 6;
        if (v.round <= 2 && ['BH46', 'XQ42'].includes(c.catalogId) && !me(v).play.length && !me(v).hand.some(x => x.id !== c.id && x.catalogId === c.catalogId))
            n += 80;
        n += redPurpleAssetReserve(v, c);
    }
    return n;
}
export function redPurpleMulligan(v, h) {
    if (!active(v))
        return null;
    const hand = me(v).hand, keep = new Set();
    if (redBot(v)) {
        const add = code => {
            const c = hand.find(c => c.catalogId === code);
            if (c && keep.size < 4)
                keep.add(c.id);
        };
        const asset = h.sorted(hand.filter(c => !c.nonAssetNow && c.faction?.startsWith('红') && c.catalogId !== 'JC042'), c => h.handValue(v, c), false)[0];
        if (asset)
            keep.add(asset.id);
        add('JC042');
        add('XG36');
        const opener = hand.some(c => ['JC042', 'XG36'].includes(c.catalogId));
        if (opener)
            add('BH24');
        for (const code of hand.some(c => c.catalogId === 'JC042') ? ['JC045', 'WM033', 'BH23', 'XG14'] : ['WM033', 'BH23', 'XG14', 'JC045']) {
            const c = hand.find(c => c.catalogId === code && !keep.has(c.id));
            if (c) {
                keep.add(c.id);
                break;
            }
        }
        // Leave room to find the low-cost curve instead of retaining a full hand
        // of four-cost engines. The asset chosen above is already playable fuel.
        while (keep.size > 4)
            keep.delete([...keep].at(-1));
    }
    else {
        // Without a turn-one opener, both starting cards should look for one.
        for (const code of ['BH46', 'XQ42']) {
            const c = hand.find(c => c.catalogId === code);
            if (c)
                keep.add(c.id);
        }
        const later = h.sorted(hand.filter(c => ['XQ44', 'WM067', 'WM066', 'WM068', 'JZ62', 'JZ63'].includes(c.catalogId)), c => c.catalogId === 'XQ44' ? 7 : c.catalogId === 'WM067' ? 6 : 5 - h.cost(c))[0];
        if (later && keep.size)
            keep.add(later.id);
        if (!keep.size) {
            const fallback = hand.find(c => c.catalogId === 'JZ62') ?? hand.find(c => c.catalogId === 'WM067');
            if (fallback)
                keep.add(fallback.id);
        }
    }
    return [{ type: 'mulligan', cardIds: hand.filter(c => !keep.has(c.id)).map(c => c.id) }];
}
export function redPurplePreferHidden(v, c) {
    if (!active(v) || c.publicNow)
        return false;
    if (redBot(v))
        return c.catalogId === 'BH23' && (v.castingCosts?.[c.id] ?? Number(c.printedCost)) > 2 || c.catalogId === 'WM082' && v.round < 3;
    if (c.catalogId === 'BH46')
        return true;
    return ['JZ64', 'WM071', 'LC17', 'CQ33'].includes(c.catalogId) && Number(c.printedCost) > Math.max(2, me(v).assets.length - 1);
}
export function redPurpleDeployAllowed(v, c, h, district = null, hidden = false) {
    if (redBot(v) && hidden && c?.automation?.destroyedPlayDiscount)
        return false;
    if (purpleBot(v) && hidden && ['JZ64', 'WM071', 'LC17', 'CQ33'].includes(c?.catalogId) && district !== null) {
        if (me(v).play.some(x => x.faceDown && x.catalogId === c.catalogId))
            return false;
        const r = v.districts[district], wait = Math.max(1, h.cost(c) - revival(v));
        const delta = h.total(v, v.seat, district, 'influence') + 1 - h.total(v, 1 - v.seat, district, 'influence');
        // Do not let a staged engine claim its district and return to the deck
        // before the revival curve can reveal it. Existing influence cancels first.
        if (delta > 0 && (r.influence[v.seat] ?? 0) + Math.max(0, delta * wait - (r.influence[1 - v.seat] ?? 0)) >= r.threshold)
            return false;
        if (delta < 0 && (r.influence[1 - v.seat] ?? 0) + Math.max(0, -delta * wait - (r.influence[v.seat] ?? 0)) >= r.threshold)
            return false;
    }
    if (!redBot(v) || c?.catalogId !== 'JZ33')
        return true;
    return sweepLoss(v, v.seat, h) <= sweepLoss(v, 1 - v.seat, h) + 2;
}
export function redPurpleReveal(v, c, h) {
    if (!active(v))
        return undefined;
    if (!redPurpleDeployAllowed(v, c, h))
        return null;
    const up = h.faceUp(v, c);
    if (lethalRisk(v, up, c.district, h))
        return null;
    if (purpleBot(v) && timing(v) && h.cost(c) <= revival(v) && v.societies?.[v.seat]?.actions?.some(a => a.id === 'revival-play' && !a.used))
        return null;
    const priority = engineBonus(v, c);
    if (priority > 0 && (v.turn.phase === 'end' || timing(v) || v.turn.step === 'contest-before'))
        return 48 + priority;
    if (c.catalogId === 'BH46' && (v.turn.phase === 'end' || timing(v) || v.turn.step === 'contest-before'))
        return 35 + (has(v, 'WM066') ? 12 : 0) + (has(v, 'JZ64') ? 12 : 0);
    return undefined;
}
export function redPurpleDistrictBonus(v, d, c) {
    if (!active(v))
        return 0;
    if (redBot(v)) {
        const terrain = v.districts[d]?.destroyed || v.districts[d]?.traits?.some(t => ['荒野', '山脉'].includes(t));
        return (c.faceDown ? (c.catalogId === 'BH23' ? 12 : c.catalogId === 'WM033' ? 8 : 0) : 0) + (c.catalogId === 'XG36' && terrain ? 22 : v.districts[d]?.destroyed ? (['JZ32', 'WM082'].includes(c.catalogId) ? 10 : 3) : 0);
    }
    const mutant = c.catalogId === 'WM067' && !c.faceDown && (me(v).effectiveMarkers ?? me(v).markers).hidden ? Math.max(0, 2 - d) * 3 : 0;
    const tapTempo = mutant + (!c.faceDown ? entryTapTempo(v, c, d) : 0);
    return tapTempo + (['JZ64', 'WM066', 'WM071'].includes(c.catalogId) && !c.faceDown ? Math.max(0, 4 - (v.districts[d]?.influence?.[v.seat] ?? 0)) : c.catalogId === 'CQ33' ? Math.max(0, 6 - (v.districts[d]?.influence?.[v.seat] ?? 0)) : 0);
}
function payloadScore(v, c, h, host) {
    let n = c.catalogId === 'XQ41' ? 45 : c.catalogId === 'JZ63' ? 24 : c.catalogId === 'WM066' && !has(v, 'WM066') ? 20 : 0;
    if (c.catalogId === 'WM069')
        n += host?.controller === 1 - v.seat ? 55 : -35;
    if (has(v, 'JZ64') && h.keyword(c, '灵体'))
        n += 24 * live(v, 'JZ64').length;
    if (has(v, 'WM066'))
        n += 8;
    return n - h.handValue(v, c) * 0.15;
}
function safeHost(v, opts, h) {
    return h.sorted(opts, o => {
        const x = h.lookup(v, o.id);
        if (!x)
            return o.id === `society:${v.seat}` ? 0 : -100;
        return x.controller === v.seat ? (x.catalogId === 'WM068' ? 35 : engineBonus(v, x) + 5) : -20;
    })[0];
}
function playOptions(v, c, h, free = false) {
    if (!c || !h.loyalty(v, c) || h.duplicate(v, c))
        return [];
    const plan = c.spell ?? c.attachment, opts = v.spellTargets?.[c.id] ?? [], base = { type: 'play', cardId: c.id };
    if (!plan)
        return h.districts(v, h.faceUp(v, c)).filter(d => !lethalRisk(v, h.faceUp(v, c), d, h)).sort((a, b) => purpleBot(v) && c.automation?.entry?.effect === 'tap' ? h.districtScore(v, b, c) - h.districtScore(v, a, c) : 0).map(d => ({ ...base, district: d }));
    if (plan.effect === 'damage')
        return h.orderedTargets(v, opts).filter(o => { const x = h.lookup(v, o.id); return x?.controller === 1 - v.seat && !x.faceDown && !h.targetedByUs(v, o.id) && (x.effectiveDefense ?? x.defense ?? 1) - (x.damage ?? 0) <= (plan.amount ?? 1); }).map(o => ({ ...base, targetIds: [o.id] }));
    if (plan.operation === 'torment')
        return tormentUtility(v, c, h) > 4 ? opts.map(o => ({ ...base, targetIds: [o.id] })) : [];
    if (plan.target === 'none')
        return [{ ...base, targetIds: [] }];
    if (c.catalogId === 'XQ42')
        return opts.map(o => ({ ...base, targetIds: [o.id] })).sort((a, b) => h.districtScore(v, Number(b.targetIds[0].slice(9)), c) - h.districtScore(v, Number(a.targetIds[0].slice(9)), c));
    if (c.catalogId === 'XQ45')
        return h.orderedTargets(v, opts).filter(o => h.lookup(v, o.id)?.controller === 1 - v.seat && !h.targetedByUs(v, o.id)).map(o => ({ ...base, targetIds: [o.id] }));
    if (c.catalogId === 'BH25')
        return h.sorted(opts, o => { const x = h.lookup(v, o.id); return x?.controller === 1 - v.seat ? h.value(x) + (v.districts[x.district]?.destroyed ? 10 : 0) : -100; }).filter(o => h.lookup(v, o.id)?.controller === 1 - v.seat).map(o => ({ ...base, targetIds: [o.id] }));
    if (c.spell?.operation === 'hidden-gift') {
        const host = giftAssessment(v, c, free ? { ...h, giftCost: 0 } : h)?.host;
        return host ? [{ ...base, targetIds: [host.id] }] : [];
    }
    if (c.catalogId === 'XQ44') {
        const host = safeHost(v, opts, h);
        return host ? [{ ...base, targetIds: [host.id] }] : [];
    }
    if (c.catalogId === 'BH24') {
        const ds = opts.filter(o => o.id.startsWith('district:') && !v.districts[Number(o.id.slice(9))]?.destroyed), cs = opts.filter(o => !o.id.startsWith('district:') && h.lookup(v, o.id)?.controller === v.seat);
        return ds.flatMap(d => h.sorted(cs, o => { const x = h.lookup(v, o.id); return (x.catalogId === 'BH23' && (x.markers ?? 0) < 4 ? 40 : 0) + (x.catalogId === 'WM033' && !(x.markers > 0) ? 18 : 0) + (x.catalogId === 'JC045' ? 10 : 0) + engineBonus(v, x); }).slice(0, 2).map(x => ({ ...base, targetIds: [x.id, d.id] })));
    }
    return free ? [] : opts.map(o => ({ ...base, targetIds: [o.id] }));
}
export function redPurpleChoice(v, a, h, type = 'effect-choice') {
    if (!active(v))
        return null;
    const b = { type, choiceId: a.id }, cards = a.cards ?? [];
    if (type === 'environment-choice') {
        if (a.mode === 'search' || a.mode === 'simultaneous-search')
            return [{ ...b, cardIds: h.sorted(cards, c => h.handValue(v, c)).slice(0, a.max ?? 1).map(c => c.id) }];
        return null;
    }
    if (purpleBot(v) && a.kind === 'veiled-status-mutant') {
        const host = h.lookup(v, a.target?.cardId), needed = host && host.controller === v.seat && !host.tapped && ['investigation', 'battle', 'influence'].some(k => h.contestPending(v, host.district, k) && (host.effectiveIcons ?? host.icons ?? {})[k] > 0);
        const preserve = host && v.bot.actionKeys?.includes(`purple-preserve-engine:${v.round}:${host.id}`);
        return [{ ...b, cardId: (!needed || preserve) && purpleLibraryBudget(v, h) >= 1 ? 'yes' : 'no' }];
    }
    if (a.kind === 'late-non-qs-mother-select') {
        const picks = h.sorted(cards, c => motherValue(v, c, h)).filter(c => {
            const hidden = me(v).play.find(x => x.id === c.id && x.faceDown);
            return h.loyalty(v, c) && !h.duplicate(v, c) && (hidden ? !lethalRisk(v, h.faceUp(v, hidden), hidden.district, h) : playOptions(v, c, h, true).length);
        });
        return [...picks.map(c => ({ ...b, cardId: c.id })), { ...b, fail: true }];
    }
    if (a.kind === 'late-non-qs-mother-cast')
        return playOptions(v, cards[0], h, true).map(play => ({ ...b, play }));
    if (a.kind === 'late-non-qs-search') {
        const best = h.sorted(cards, c => engineBonus(v, c) + (c.catalogId === 'JZ64' && !has(v, 'JZ64') ? 35 : c.catalogId === 'WM066' && !has(v, 'WM066') ? 30 : 0) - h.cost(c) * 0.1);
        return best.map(c => ({ ...b, cardId: c.id, destination: a.searchOperation === 'bell-search' && a.districtAvailable ? 'hidden' : 'hand' })).concat({ ...b, fail: true });
    }
    if (a.kind === 'reverberation-gift') {
        const target = a.spell?.targets?.[0], host = h.lookup(v, a.giftHostId ?? target?.cardId ?? target?.ref?.hostId) ?? (a.giftHostId === `society:${v.seat}` ? { id: a.giftHostId, controller: v.seat } : null);
        return [{ ...b, cardIds: rankSealPayloads(v, cards, host, { ...h, sealCommitted: true }, a.max).map(x => x.card.id) }];
    }
    if (a.kind === 'cq-house-seal')
        return h.sorted(cards, c => h.value(c) + engineBonus(v, c) * 2 - (c.token ? 15 : 0) - (c.catalogId === 'XQ41' ? 25 : 0) - (c.tapped ? 3 : 0), false).map(c => ({ ...b, cardId: c.id }));
    if (a.kind === 'discard-deck-rigoletto')
        return h.sorted(cards, c => payloadScore(v, c, h, { controller: 1 - v.seat }) + (c.subtypes?.includes('梦魇') ? 40 : 0)).map(c => ({ ...b, cardId: c.id }));
    if (['search', 'seal-search'].includes(a.kind)) {
        const target = a.spell?.targets?.[0], host = h.lookup(v, target?.cardId ?? target?.ref?.hostId);
        return h.sorted(cards, c => payloadScore(v, c, h, host) + (c.catalogId === 'JZ63' ? 10 : 0)).map(c => ({ ...b, cardId: c.id })).concat(a.canFail ? [{ ...b, fail: true }] : []);
    }
    if (a.kind === 'entropy-recover')
        return h.sorted(cards, c => c.catalogId === 'BH24' && activeDestruction(v) < 3 && h.pool(v) >= 2 && me(v).hand.some(x => x.faction?.startsWith('红') && h.hiddenStrength(x, v) + 3 >= 6) ? 65 : c.catalogId === 'WM037' ? 35 : c.catalogId === 'BQ108' ? has(v, 'XG14') ? 30 : 8 : h.handValue(v, c)).map(c => ({ ...b, cardId: c.id }));
    if (['discard', 'sacrifice', 'shoggoth-assets', 'entropy-assets'].includes(a.kind)) {
        const least = h.sorted(cards, c => h.handValue(v, c) + (role(c) ? engineBonus(v, c) * 2 : 0) - (c.token ? 12 : 0) - (a.kind === 'sacrifice' ? investigationRelief(v, h.lookup(v, c.id) ?? c, h) : 0), false);
        if (a.kind === 'entropy-assets')
            return [{ ...b, cardIds: least.slice(0, a.count ?? a.min ?? 1).map(c => c.id) }];
        return least.map(c => ({ ...b, cardId: c.id }));
    }
    return null;
}
export function redPurpleTrigger(v, a, h) {
    if (!active(v))
        return null;
    if (purpleBot(v) && a.effect?.kind === 'seal-from-graveyard') {
        // Keep the pastor/whale chain useful without ignoring a host's payable
        // escape response or the opportunity to recover immediately after battle.
        return rumorTriggerChoices(v, a, h, c => c.controller === v.seat && c.catalogId === 'WM068' ? 15 : 0);
    }
    if (!a.plan)
        return null;
    const b = { type: 'trigger-choice', triggerId: a.id }, opts = v.abilityTargets?.[a.id] ?? [], source = h.lookup(v, a.cardId), plan = a.plan;
    if (!a.mandatory && purpleLibraryUse(v, a) > purpleLibraryBudget(v, h))
        return [{ ...b, fire: false }];
    if (plan.operation === 'calamity-blank' && h.lookup(v, plan.eventHost?.hostId)?.controller === v.seat)
        return [{ ...b, fire: false }];
    if (plan.operation === 'bell-search') {
        const host = safeHost(v, opts, h);
        return [{ ...b, fire: true, targetIds: host ? [host.id] : [] }];
    }
    if (plan.effect === 'seal-top' && source?.catalogId === 'BH46')
        return [{ ...b, fire: purpleLibraryBudget(v, h) >= 1, targetIds: [] }];
    if (plan.operation === 'rigoletto-seal')
        return h.orderedTargets(v, opts).filter(o => h.lookup(v, o.id)?.controller === 1 - v.seat).map(o => ({ ...b, fire: true, targetIds: [o.id] })).concat({ ...b, fire: false });
    if (['place-influence', 'spawn', 'spawn-token'].includes(plan.effect) && opts.some(o => o.id.startsWith('district:'))) {
        if (redBot(v) && source?.catalogId === 'XG14' && plan.effect === 'place-influence' && (me(v).hand.some(c => c.catalogId === 'JZ42') || v.flow.stack.some(a => a.controller === v.seat && a.displayName === '末日钟降临') || v.societies?.[v.seat]?.plan?.destroyedVictory)) {
            const finish = doomFinishDistricts(v).find(d => opts.some(o => o.id === `district:${d}`));
            if (finish !== undefined)
                return [{ ...b, fire: true, targetIds: [`district:${finish}`] }];
        }
        const nightmare = purpleBot(v) && plan.effect === 'spawn-token' && plan.catalogId === 'TK005';
        const token = { type: 'character', keywords: nightmare ? ['灵体'] : [], effectiveIcons: { investigation: 0, battle: nightmare ? 0 : 1, influence: nightmare ? (v.turn.firstPlayer === v.seat ? 1 : 0) : 1 }, controller: v.seat };
        return [...h.sorted(opts, o => h.districtScore(v, Number(o.id.slice(9)), token)).map(o => ({ ...b, fire: true, targetIds: [o.id] })), { ...b, fire: false }];
    }
    return null;
}
function timePayment(v, n) {
    const cards = [...(v.timeCostCards ?? front(v))].sort((a, b) => (['JC045', 'WM033'].includes(a.catalogId) ? 1 : 0) - (['JC045', 'WM033'].includes(b.catalogId) ? 1 : 0));
    let left = n;
    const payments = [];
    for (const c of cards) {
        const count = Math.min(left, c.markers ?? c.timeCounters ?? 0);
        if (count) {
            payments.push({ cardId: c.id, count });
            left -= count;
        }
    }
    return left ? null : payments;
}
function doomTimePayment(v, n, reserveAllowance) {
    // Hugo's time may all fund an early switch. Prefer spare time over the
    // Clocktower's next recovery, without imposing a four-counter Hugo reserve.
    const cards = v.timeCostCards ?? front(v), paid = new Map();
    let left = n;
    const keep = c => c.catalogId === 'WM033' ? 1 : 0;
    for (const c of cards) {
        const count = Math.min(left, Math.max(0, (c.markers ?? c.timeCounters ?? 0) - keep(c)));
        if (count) {
            paid.set(c.id, count);
            left -= count;
        }
    }
    if (left > reserveAllowance)
        return null;
    for (const c of cards) {
        const count = Math.min(left, (c.markers ?? c.timeCounters ?? 0) - (paid.get(c.id) ?? 0));
        if (count) {
            paid.set(c.id, (paid.get(c.id) ?? 0) + count);
            left -= count;
        }
    }
    return left ? null : [...paid].map(([cardId, count]) => ({ cardId, count }));
}
function doomSwitch(v, h) {
    const soc = v.societies?.[v.seat], doom = me(v).hand.find(c => c.catalogId === 'JZ42' && c.castAllowed !== false);
    if (soc?.plan?.disasterOnly || !doom || !h.loyalty(v, doom))
        return null;
    const available = h.pool(v), cost = price(v, doom, h), finish = capturedDestruction(v) >= 3 || doomFinishDistricts(v).length > 0;
    if (finish) {
        const pay = timePayment(v, Math.max(0, cost - available));
        return pay ? { doom, pay, score: 180 } : null;
    }
    // Switching cheaply is useful before the third captured destruction marker.
    // In particular, keep the mana to cast World Devourer after the switch, so
    // its entry ability also sacrifices assets. Only use our own known cards.
    const devourer = me(v).hand.find(c => c.catalogId === 'BQ047' && c.castAllowed !== false && h.loyalty(v, c)) ??
        me(v).play.find(c => c.catalogId === 'BQ047' && c.faceDown && h.loyalty(v, h.faceUp(v, c)));
    const followCost = devourer ? price(v, devourer, h) : Infinity, followNow = available >= followCost;
    // Capturing a destroyed region removes its active casting discount. Spend
    // slightly more now when that public discount is about to disappear.
    const discountAtRisk = (v.districts ?? []).some((d, i) => d?.destroyed && ((d.pendingWinner !== null && d.pendingWinner !== undefined) || [0, 1].some(p => (d.influence[p] ?? 0) + Math.max(0, h.total(v, p, i, 'influence') - h.total(v, 1 - p, i, 'influence') - (d.influence[1 - p] ?? 0)) >= d.threshold - 1)));
    const budget = Math.min(discountAtRisk ? 5 : 3, Math.max(0, available - (followNow ? followCost : 0))), pay = doomTimePayment(v, Math.max(0, cost - budget), followNow ? 4 : 1);
    if (!pay)
        return null;
    const staged = me(v).play.filter(c => c.faceDown && !c.subtypes?.includes('灾难')).length;
    const preparation = me(v).hand.filter(c => c.id !== doom.id && !c.subtypes?.includes('灾难') && role(c) && engineBonus(v, c) > 0).length;
    const score = followNow ? 145 : (discountAtRisk ? 120 : 58) + (devourer ? 14 : 0) + (capturedDestruction(v) >= 2 ? 10 : 0) - Math.min(28, staged * 18 + preparation * 6);
    return { doom, pay, score };
}
// Compare the complete discount sequence, not only the next card's body.
function timeFlowPreparation(v, h) {
    if (!redBot(v) || v.societies?.[v.seat]?.plan?.disasterOnly || activeDestruction(v) >= 3)
        return null;
    const flow = me(v).hand.find(c => c.catalogId === 'BH24' && c.castAllowed !== false && h.loyalty(v, c));
    if (!flow || !me(v).hand.some(c => c.id !== flow.id && redHiddenPoints(v, c, h) + 3 * Number(c.faction?.startsWith('红')) >= 6))
        return null;
    const cultist = front(v).find(c => c.catalogId === 'JC042' && !c.printedTextBlank && !c.abilitiesSuppressed);
    const cost = price(v, flow, h), sacrifice = cost >= 2 && cultist && front(v).some(c => c.id !== cultist.id);
    const pay = Math.max(0, cost - (sacrifice ? 2 : 0));
    if (pay > h.pool(v))
        return null;
    const follow = me(v).hand.filter(c => c.id !== flow.id && c.castAllowed !== false && h.loyalty(v, c) && c.automation?.destroyedPlayDiscount && (price(v, c, h) > 0 || cost === 0 && (c.printedCost ?? 0) > activeDestruction(v) * c.automation.destroyedPlayDiscount) &&
        Math.max(0, price(v, c, h) - c.automation.destroyedPlayDiscount) <= h.pool(v) - pay &&
        me(v).hand.some(b => b.id !== c.id && b.id !== flow.id && redHiddenPoints(v, b, h) + 3 * Number(b.faction?.startsWith('红')) >= 6));
    return follow.length && playOptions(v, flow, h).length ? { flow, cultist: sacrifice ? cultist : null } : null;
}
function doomSocietyActions(v, h, add) {
    const p = v.seat, soc = v.societies?.[p];
    if (!redBot(v) || !soc?.plan?.disasterOnly || soc.tapped)
        return;
    const cards = v.players.flatMap(p => p.play), ownPriests = front(v).filter(c => ['JC045', 'TK009'].includes(c.catalogId));
    const investigations = v.districts.filter((r, d) => r && h.total(v, p, d, 'investigation') > h.total(v, 1 - p, d, 'investigation')).length;
    const libraryUrgency = Math.max(0, Math.min(1, (4 * (1 + investigations) - me(v).deckCount) / (3 * (1 + investigations))));
    const token = { id: 'doom-priest-preview', type: 'character', catalogId: 'TK009', controller: p, printedCost: 4, defense: 2, effectiveDefense: 2, icons: { battle: 2, investigation: 1, influence: 0 }, effectiveIcons: { battle: 2, investigation: 1, influence: 0 }, keywords: [] };
    for (const a of soc.actions ?? []) {
        if (a.used || a.botDisabled || (a.cost ?? 0) > h.pool(v))
            continue;
        if (a.id === 'priest') {
            const fuel = h.sorted((a.discardOptions ?? []).map(o => h.lookup(v, o.id)).filter(Boolean), c => h.handValue(v, c) + (c.subtypes?.includes('灾难') ? 45 : 0), false)[0];
            if (!fuel)
                continue;
            for (const o of a.targetOptions ?? []) {
                const d = Number(o.id.slice(9));
                if (!v.districts[d] || lethalRisk(v, token, d, h))
                    continue;
                add({ type: 'society-action', abilityId: a.id, discardIds: [fuel.id], targetIds: [o.id] }, 62 + h.districtScore(v, d, token) - Math.max(0, h.handValue(v, fuel)) * 0.6 + (front(v).length < 2 ? 18 : 0) - libraryUrgency * (ownPriests.some(c => c.district === d && !c.tapped) && h.total(v, p, d, 'battle') >= h.total(v, 1 - p, d, 'battle') ? 75 : 20));
            }
        }
        if (a.id === 'time')
            for (const o of a.targetOptions ?? []) {
                const object = h.lookup(v, o.id), d = o.id.startsWith('district:') ? Number(o.id.slice(9)) : object?.district, r = v.districts[d];
                if (!r || object && object.controller !== p)
                    continue;
                const marks = (r.counters?.time ?? 0) + cards.filter(c => c.district === d).reduce((n, c) => n + (c.markers ?? 0), 0);
                let score = 0;
                if (!r.destroyed) {
                    const ours = h.total(v, p, d, 'influence'), theirs = h.total(v, 1 - p, d, 'influence');
                    score = marks >= 3 ? 70 + (ours > theirs ? 20 : 0) + (capturedDestruction(v) >= 2 ? 25 : 0) : 4 + marks * 3;
                }
                if (object && ownPriests.some(c => c.id === object.id)) {
                    const before = h.total(v, p, d, 'influence') - h.total(v, 1 - p, d, 'influence'), wins = (r.influence[p] ?? 0) + Math.max(0, before + 1 - (r.influence[1 - p] ?? 0)) >= r.threshold;
                    const winningMargin = Math.max(0, before), nextMargin = Math.max(0, before + 1), remaining = (r.threshold ?? 99) + (r.influence[1 - p] ?? 0) - (r.influence[p] ?? 0);
                    // Before exhausting the library, convert existing priests into claim pressure.
                    // Further investigation bodies do not solve the mandatory draw problem.
                    const progress = remaining > winningMargin ? Math.max(0, nextMargin - winningMargin) : 0;
                    score += libraryUrgency * 85 * progress * (!object.tapped ? 1 : 0.45);
                    score += 22 + (!object.tapped ? 10 : 0) + (wins && !object.tapped ? 35 : 0) + (wins && r.destroyed && capturedDestruction(v) >= 2 ? 100 : 0);
                }
                if (object?.catalogId === 'BH23' && (object.markers ?? 0) === 3)
                    score += 38;
                if (object?.catalogId === 'WM033' && !(object.markers > 0) && me(v).graveyard.some(c => c.subtypes?.some(t => ['法术', '灾难'].includes(t))))
                    score += 35;
                if (score > 0)
                    add({ type: 'society-action', abilityId: a.id, targetIds: [o.id] }, score);
            }
    }
}
export function redPurpleTactics(v, h, add) {
    if (!active(v))
        return;
    const p = v.seat, standard = timing(v), available = h.pool(v), soc = v.societies?.[p];
    if (standard) {
        doomSocietyActions(v, h, add);
        const sequence = timeFlowPreparation(v, h);
        if (sequence?.cultist)
            add({ type: 'activate', cardId: sequence.cultist.id, actionIndex: 0, targetIds: [] }, 126);
        else if (sequence)
            for (const op of playOptions(v, sequence.flow, h))
                add(op, 116);
    }
    if (purpleBot(v) && standard && soc) {
        const jelly = waterFirst(v, h);
        for (const a of soc.actions ?? []) {
            if (a.used || a.tap && soc.tapped)
                continue;
            if (a.id === 'revival-counter' && revival(v) < 8)
                add({ type: 'society-action', abilityId: a.id, targetIds: [] }, 150);
            if (a.id === 'revival-play') {
                if (jelly) {
                    add(jelly, 145);
                    continue;
                }
                // A hand jellyfish cast directly does not trigger its reveal ability.
                // Build the first asset, then deploy/reveal it using the society instead.
                if (v.round === 1 && revival(v) === 1 && available < 1 && !me(v).actionsUsed.asset && !me(v).actionsUsed.secret && me(v).hand.some(c => c.catalogId === 'BH46') && !me(v).hand.some(c => c.catalogId === 'XQ42') && me(v).hand.some(c => c.catalogId !== 'BH46' && !c.nonAssetNow))
                    continue;
                const candidates = [...me(v).hand, ...me(v).play.filter(c => c.faceDown)].filter(c => h.cost(c) <= revival(v) && h.loyalty(v, c) && !h.duplicate(v, c));
                if (candidates.some(c => me(v).hand.some(x => x.id === c.id) ? playOptions(v, c, h, true).length : !lethalRisk(v, h.faceUp(v, c), c.district, h)))
                    add({ type: 'society-action', abilityId: a.id, targetIds: [] }, 140);
            }
            if (a.id === 'belandanna-search' && revival(v) >= 8 && !has(v, 'WM071') && !me(v).hand.some(c => c.catalogId === 'WM071') && !me(v).play.some(c => c.faceDown && c.catalogId === 'WM071') && me(v).deckCount > h.drawReserve(v))
                add({ type: 'society-action', abilityId: a.id, targetIds: [] }, 130);
        }
    }
    for (const c of front(v))
        for (const [i, a] of (c.availableActions ?? c.automation?.actions ?? (c.automation?.action ? [c.automation.action] : [])).entries()) {
            if (a.used || a.tap && c.tapped || a.timing !== 'fast' && !standard || available < (a.cost ?? 0))
                continue;
            const b = { type: 'activate', cardId: c.id, actionIndex: i, targetIds: [] }, opts = v.abilityTargets?.[`${c.id}:${i}`] ?? [];
            if (c.catalogId === 'WM033' && (c.markers ?? 0) > 0 && me(v).graveyard.some(x => x.subtypes?.some(t => ['法术', '灾难'].includes(t))))
                add(b, 28);
            if (c.catalogId === 'JC044') {
                const t = timePayment(v, 1);
                if (t && v.districts.some(d => d?.influence?.[1 - p] > 0))
                    add({ ...b, timeCardId: t[0].cardId }, 20);
            }
            if (c.catalogId === 'JC042' && standard && me(v).hand.some(x => x.id !== c.id && x.castAllowed !== false && h.loyalty(v, x) && price(v, x, h) >= 2 && price(v, x, h) <= available + 2 && (x.faction?.startsWith('红') || x.magicDomains?.includes('鲜血')) &&
                (x.catalogId !== 'WM037' || v.round >= 3 && me(v).hand.length <= 2) &&
                (x.catalogId !== 'JC043' || foe(v).play.some(t => !t.faceDown && hasCardType(t, 'attachment'))) &&
                (x.catalogId !== 'BH24' || front(v).some(t => t.id !== c.id))))
                add(b, 65);
            if (purpleBot(v) && a.operation === 'mutant-seal') {
                if (purpleLibraryBudget(v, h) >= 1)
                    for (const o of opts) {
                        const host = h.lookup(v, o.id);
                        if (preserveEngineTap(v, c, host, h))
                            add({ ...b, targetIds: [o.id] }, 138 + h.value(host), `purple-preserve-engine:${v.round}:${host.id}`);
                    }
                const enablesHidden = standard && me(v).hand.some(x => ['BH51', 'CQ32'].includes(x.catalogId) && x.castAllowed !== false && h.loyalty(v, x) && (price(v, x, h) <= available || x.catalogId === 'CQ32' && h.cost(x) <= revival(v) && soc?.actions?.some(a => a.id === 'revival-play' && !a.used)));
                const beforeClaim = v.turn.step === 'contest-before' && v.turn.kind === 'influence' && v.turn.district === c.district &&
                    (v.districts[c.district]?.influence?.[p] ?? 0) + Math.max(0, h.total(v, p, c.district, 'influence') - h.total(v, 1 - p, c.district, 'influence')) >= (v.districts[c.district]?.threshold ?? Infinity);
                const threatened = !!pendingTargetThreat(v, c.id) || lethalRisk(v, c, c.district, h) && v.turn.step === 'contest-before' && v.turn.kind === 'battle';
                if (enablesHidden || beforeClaim || threatened || v.turn.phase === 'end' && (has(v, 'WM066') || has(v, 'JZ64'))) {
                    const targets = h.sorted(opts, o => { const host = h.lookup(v, o.id); return host ? (host.controller !== p ? (!host.tapped ? 30 : 5) : host.catalogId === 'CQ32' ? 25 : 10) + h.value(host) * 0.1 : -100; });
                    for (const o of targets)
                        add({ ...b, targetIds: [o.id] }, (enablesHidden ? 160 : beforeClaim ? 85 : threatened ? 90 : 35) + (has(v, 'WM066') ? 12 : 0) + (has(v, 'JZ64') ? 12 : 0));
                }
            }
            if (c.catalogId === 'BH23') {
                const pay = timePayment(v, 4);
                if (!pay || v.flow.stack.some(a => a.controller === p && a.cardId === c.id))
                    continue;
                const gain = sweepLoss(v, 1 - p, h, c.district) - sweepLoss(v, p, h, c.district), threat = pendingTargetThreat(v, c.id), lethal = threat && (threat.responseEffect?.removesTargets || (threat.responseEffect?.damageAmount ?? 1) >= (c.effectiveDefense ?? c.defense ?? 2) - (c.damage ?? 0)), modes = [];
                if (lethal && !h.keyword(c, '永恒'))
                    modes.push('return');
                // Keep the threat of a sweep while no interaction or contest requires it.
                const contest = v.turn.step === 'contest-before' && v.turn.district === c.district;
                if (gain > 3 && (lethal || contest))
                    modes.push('damage');
                const discountNow = standard && me(v).hand.some(x => x.automation?.destroyedPlayDiscount && (price(v, x, h) > available || price(v, x, h) > 0) && h.loyalty(v, x));
                if (!v.districts[c.district]?.destroyed && activeDestruction(v) < 3 && (discountNow || lethal || contest && gain > 3 || v.turn.phase === 'end'))
                    modes.push('destroy');
                if (modes.length)
                    add({ ...b, modes: modes.slice(0, 2), timePayments: pay }, lethal ? 140 : 55 + Math.max(0, gain));
            }
            if (c.catalogId === 'WM067')
                for (const o of h.orderedTargets(v, opts)) {
                    const target = h.lookup(v, o.id);
                    if (target?.controller === 1 - p && !h.targetedByUs(v, o.id) && !seals(v, target.id).length) {
                        const gain = mutantSealTempo(v, c, target);
                        if (gain > 0)
                            add({ ...b, targetIds: [o.id] }, 24 + gain);
                    }
                }
        }
    if (redBot(v) && standard)
        for (const c of me(v).hand.filter(x => role(x) && x.castAllowed !== false && h.loyalty(v, x) && !h.duplicate(v, x) && price(v, x, h) <= available)) {
            const need = price(v, c, h), up = h.faceUp(v, c);
            if (c.catalogId === 'XG36' && v.round <= 4)
                for (const d of h.districts(v, up)) {
                    if (!v.districts[d]?.destroyed && !v.districts[d]?.traits?.some(t => ['荒野', '山脉'].includes(t)))
                        continue;
                    const projected = { ...up, effectiveIcons: { ...up.effectiveIcons, investigation: (up.effectiveIcons?.investigation ?? 0) + 1 } };
                    if (!lethalRisk(v, projected, d, h))
                        add({ type: 'play', cardId: c.id, district: d }, (v.round === 2 ? 170 : 82) + h.districtScore(v, d, projected));
                }
            if (c.catalogId === 'JC045' && v.round <= 4 && need <= 2)
                for (const d of h.districts(v, up))
                    if (!lethalRisk(v, up, d, h))
                        add({ type: 'play', cardId: c.id, district: d }, 88 + h.districtScore(v, d, up));
            if (c.catalogId === 'JZ32')
                for (const d of h.districts(v, up))
                    if (v.districts[d]?.destroyed) {
                        const projected = { ...up, effectiveIcons: { ...up.effectiveIcons, influence: (up.effectiveIcons?.influence ?? 0) + 2 } };
                        if (!lethalRisk(v, projected, d, h))
                            add({ type: 'play', cardId: c.id, district: d }, 90 + h.districtScore(v, d, projected) - need);
                    }
            if (c.catalogId === 'BH23' && me(v).hand.some(x => x.catalogId === 'JZ42') && !has(v, 'BH23'))
                for (const d of h.districts(v, up))
                    if (!lethalRisk(v, up, d, h))
                        add({ type: 'play', cardId: c.id, district: d }, 86 + h.districtScore(v, d, up) - need);
            if (c.catalogId === 'XG14' && v.round <= 4 && need <= 2)
                for (const d of h.districts(v, up))
                    if (!lethalRisk(v, up, d, h))
                        add({ type: 'play', cardId: c.id, district: d }, 85 + h.districtScore(v, d, up) - need);
            if (c.catalogId === 'BQ047' && soc?.plan?.disasterOnly && foe(v).assets.length)
                for (const d of h.districts(v, up))
                    if (!lethalRisk(v, up, d, h))
                        add({ type: 'play', cardId: c.id, district: d }, 110 + h.districtScore(v, d, up) + Math.min(4, foe(v).assets.length) * 3 + (v.districts[d]?.destroyed ? 0 : 8));
            if (c.catalogId === 'JZ33' && redPurpleDeployAllowed(v, c, h)) {
                const gain = sweepLoss(v, 1 - p, h) - sweepLoss(v, p, h);
                if (gain >= 3 && need <= 2)
                    for (const d of h.districts(v, up))
                        if (!lethalRisk(v, up, d, h))
                            add({ type: 'play', cardId: c.id, district: d }, 125 + gain);
            }
        }
    if (redBot(v) && standard && !front(v).some(x => x.catalogId === 'JC042'))
        for (const c of me(v).hand.filter(x => x.catalogId === 'JC042' && x.castAllowed !== false && h.loyalty(v, x) && price(v, x, h) <= available)) {
            const follow = me(v).hand.some(x => x.id !== c.id && role(x) && x.castAllowed !== false && h.loyalty(v, x) && x.faction?.startsWith('红') && price(v, x, h) >= 2 && price(v, x, h) <= Math.max(3, me(v).assets.length + 1) + 2);
            if (follow || v.round <= 2)
                for (const d of h.districts(v, h.faceUp(v, c)))
                    if (!lethalRisk(v, h.faceUp(v, c), d, h))
                        add({ type: 'play', cardId: c.id, district: d }, (v.round <= 2 ? 100 : 78) + h.districtScore(v, d, c));
        }
    if (standard)
        for (const c of me(v).hand.filter(c => role(c) && engineBonus(v, c) > 0 && c.castAllowed !== false && !h.duplicate(v, c) && h.loyalty(v, c))) {
            const up = h.faceUp(v, c), need = price(v, c, h);
            if (!redPurplePreferHidden(v, c) && need <= available)
                for (const d of h.districts(v, up))
                    if (!lethalRisk(v, up, d, h))
                        add({ type: 'play', cardId: c.id, district: d }, 30 + engineBonus(v, c) + h.districtScore(v, d, up) - need);
        }
    for (const c of me(v).hand) {
        if (c.castAllowed === false || !h.loyalty(v, c) || h.duplicate(v, c))
            continue;
        const plan = c.spell ?? c.attachment;
        if (!plan || plan.timing !== 'fast' && !standard)
            continue;
        const need = price(v, c, h);
        if (need > available)
            continue;
        const ops = playOptions(v, c, h);
        if (plan.effect === 'damage' && (!plan.actionPhaseOnly || v.turn.phase === 'action'))
            for (const op of ops) {
                const target = h.lookup(v, op.targetIds[0]);
                add(op, 24 + h.value(target) - need * 2);
            }
        if (plan.operation === 'torment') {
            const gain = tormentUtility(v, c, h);
            if (gain > need * 2 + 4)
                for (const op of ops)
                    add(op, 24 + gain - need * 2);
        }
        if (c.catalogId === 'WM037' && me(v).hand.length >= 2 && me(v).deckCount > h.drawReserve(v) + 2)
            add({ type: 'play', cardId: c.id, targetIds: [] }, 40);
        if (c.catalogId === 'BH25')
            for (const op of ops)
                add(op, 28 + h.value(h.lookup(v, op.targetIds[0])));
        if (c.catalogId === 'BH24' && activeDestruction(v) < 3 && me(v).hand.length >= 2 && me(v).hand.some(x => x.id !== c.id && h.hiddenStrength(x, v) + (x.faction?.startsWith('红') ? 3 : 0) >= 6))
            for (const op of ops) {
                const target = h.lookup(v, op.targetIds[0]);
                add(op, (v.round <= 3 ? 76 : 50) + (target?.catalogId === 'BH23' && (target.markers ?? 0) < 4 ? 20 : 0));
            }
        if (c.catalogId === 'XQ42' && me(v).deckCount > h.drawReserve(v))
            for (const op of ops)
                add(op, 40);
        if (c.catalogId === 'XQ44' && me(v).deckCount > h.drawReserve(v))
            for (const op of ops)
                add(op, 27 + (has(v, 'WM066') ? 14 : 0) + (has(v, 'JZ64') ? 10 : 0));
        if (c.spell?.operation === 'hidden-gift' && me(v).deckCount > h.drawReserve(v) + 2) {
            const gain = giftAssessment(v, c, h)?.utility ?? 0;
            if (gain > need * 3 + 4)
                for (const op of ops)
                    add(op, 12 + gain - need * 2);
        }
        if (c.catalogId === 'XQ45')
            for (const op of ops)
                add(op, 45 + h.value(h.lookup(v, op.targetIds[0])));
    }
    if (purpleBot(v) && standard)
        for (const c of v.sealed ?? [])
            if (c.catalogId === 'JZ63' && c.owner === p && c.castAllowed !== false && h.loyalty(v, c) && price(v, c, h) <= available)
                for (const d of h.districts(v, h.faceUp(v, c)))
                    if (!lethalRisk(v, h.faceUp(v, c), d, h))
                        add({ type: 'play', cardId: c.id, district: d }, 35 + h.districtScore(v, d, c));
    if (redBot(v) && standard) {
        const choice = doomSwitch(v, h);
        if (choice)
            add({ type: 'play', cardId: choice.doom.id, targetIds: [], timePayments: choice.pay }, choice.score);
    }
}
