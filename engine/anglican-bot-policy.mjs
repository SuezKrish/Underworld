import { resourcePriorities } from './bot-resource-planning.mjs';
import { botLibraryHasName } from './bot-library-information.mjs';
import { hasCardType } from './card-types.mjs';
import { canFund } from './bot-dynamic-planning.mjs';
export const anglicanBot = v => v.bot?.id === 'white-anglican';
const mine = v => v.players[v.seat], enemy = v => v.players[1 - v.seat];
const staged = (v, code) => mine(v).play.some(c => c.catalogId === code);
const yallorReveals = (v, c) => mine(v).hand.filter(x => x.id !== c.id && (x.faction?.split('·')[1] === '圣贤' || x.magicDomains?.includes('神圣'))).map(x => x.id);
export function anglicanMeditationHold(v, source, h) {
    if (!anglicanBot(v) || source.catalogId !== 'XQ32')
        return false;
    const m = mine(v), q = 1 - v.seat;
    if ((m.score ?? 0) + 1 >= (m.victoryThreshold ?? 8) && (m.score ?? 0) + 1 > (enemy(v).score ?? 0))
        return false;
    if (m.play.some(c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed && c.catalogId === 'JC080'))
        return false;
    if (v.flow.stack.some(a => a.controller === q && a.targetIds?.includes(source.id) && a.responseEffect?.removesTargets))
        return false;
    if (v.flow.stack.some(a => a.controller === v.seat && a.kind === 'play-character' && a.responseEffect?.enteringCard?.automation?.watch?.some(w => w.event === 'draw' && w.own && w.operation === 'source-influence' && w.amountFrom === 'draw-count')))
        return true;
    // During preparation or before our action, include the one asset we can
    // genuinely build. Do not wait for a six-cost professor several turns away.
    const actionAhead = ['setup', 'start'].includes(v.turn.phase) || v.turn.phase === 'action' && (v.flow.stepOwner === v.seat || v.turn.firstPlayer !== v.seat && v.turn.step === 'first-action');
    return actionAhead && m.hand.some(c => c.catalogId === 'JC080' && c.castAllowed !== false && canFund(v, c) && h.districts(v, c).some(d => !h.lethalBattleRisk(v, h.faceUp(v, c), d)));
}
export function anglicanHandBonus(v, c) {
    if (!anglicanBot(v))
        return 0;
    if (c.catalogId === 'XQ32')
        return staged(v, 'XQ32') ? 3 : 12;
    if (c.catalogId === 'XQ28' && !staged(v, 'XQ32'))
        return 6;
    return 0;
}
export function anglicanAssetBonus(v, c) {
    if (!anglicanBot(v))
        return 0;
    if (c.catalogId === 'XG22' && !staged(v, 'XG22'))
        return 18;
    if (c.catalogId === 'XQ32' && !staged(v, 'XQ32'))
        return 8;
    return 0;
}
export function anglicanMulligan(v, h) {
    if (!anglicanBot(v))
        return null;
    const hand = mine(v).hand, keep = new Set();
    const matuta = hand.find(c => c.catalogId === 'XG22');
    if (matuta)
        keep.add(matuta.id);
    // Open with investigation and a means of turning those wins into cards.
    // Additional meditations are valuable later, but cannot replace the bodies.
    for (const c of h.sorted(hand.filter(c => hasCardType(c, 'character') && h.cost(c) <= 3 && ((c.icons?.investigation ?? 0) + (c.temporaryIcons?.investigation ?? 0) > 0)), h.value).slice(0, 2))
        keep.add(c.id);
    const meditation = hand.find(c => c.catalogId === 'XQ32');
    if (meditation && keep.size)
        keep.add(meditation.id);
    const yallor = hand.find(c => c.catalogId === 'JC081' && yallorReveals(v, c).length >= 4);
    if (yallor && matuta)
        keep.add(yallor.id);
    for (const c of h.sorted(hand.filter(c => c.catalogId !== 'BQ108' && !c.nonAssetNow && !keep.has(c.id)), c => h.handValue(v, c), false).slice(0, 2))
        keep.add(c.id);
    return [{ type: 'mulligan', cardIds: hand.filter(c => !keep.has(c.id)).map(c => c.id) }];
}
export function anglicanTactics(v, h, add) {
    if (!anglicanBot(v))
        return;
    const p = v.seat, available = h.pool(v), standard = v.turn.standardAllowed && v.flow.stepOwner === p && !v.flow.stack.length;
    const earlyYallors = v.round <= 4 ? mine(v).hand.filter(c => c.catalogId === 'JC081' && c.castAllowed !== false && !c.concealedOnlyNow && !h.duplicate(v, c) && h.loyalty(v, c)).map(c => { const revealIds = yallorReveals(v, c); return { card: c, revealIds, price: Math.max(0, (v.castingCosts?.[c.id] ?? h.cost(c)) - revealIds.length) }; }).filter(x => x.price <= available) : [];
    if (standard)
        for (const { card: c, revealIds, price } of earlyYallors)
            for (const d of h.districts(v, c))
                if (!h.lethalBattleRisk(v, c, d))
                    add({ type: 'play', cardId: c.id, district: d, revealIds }, (v.round === 3 ? 150 : 68) + h.districtScore(v, d, c) - price * 6);
    if (standard && v.round === 2)
        for (const c of mine(v).hand.filter(c => c.catalogId === 'XQ28' && c.castAllowed !== false && h.loyalty(v, c) && (v.castingCosts?.[c.id] ?? h.cost(c)) <= available))
            for (const d of h.districts(v, c))
                if (!h.lethalBattleRisk(v, c, d))
                    add({ type: 'play', cardId: c.id, district: d }, 150 + h.districtScore(v, d, c));
    if (standard && h.own(v).some(c => c.catalogId === 'XQ32' && (c.counters?.冥想 ?? 0) >= 4))
        for (const c of mine(v).hand.filter(c => c.catalogId === 'JC080' && c.castAllowed !== false && h.loyalty(v, c) && (v.castingCosts?.[c.id] ?? h.cost(c)) <= available))
            for (const d of h.districts(v, c))
                if (!h.lethalBattleRisk(v, c, d))
                    add({ type: 'play', cardId: c.id, district: d }, 130 + h.districtScore(v, d, c));
    for (const c of h.own(v))
        for (const [i, a] of (c.availableActions ?? []).entries()) {
            if (a.used || a.tap && (c.tapped || c.cannotTap) || a.timing !== 'fast' && !standard || available < (a.cost ?? 0))
                continue;
            if (c.catalogId === 'XG22' && !botLibraryHasName(v, '光能盾'))
                continue;
            const base = { type: 'activate', cardId: c.id, actionIndex: i, targetIds: [] };
            if (c.catalogId === 'XG22' && (mine(v).deckCount > h.drawReserve(v) || standard && earlyYallors.some(x => x.price > 0) && mine(v).deckCount > 1)) {
                // Use the end window after reputation; a shield is also next turn's asset.
                if (v.turn.phase === 'end' || standard || v.turn.phase === 'start' && !mine(v).hand.some(x => x.catalogId === 'JC078'))
                    add(base, standard && earlyYallors.some(x => x.price > 0) ? 185 : 38);
            }
            if (c.catalogId !== 'XQ29')
                continue;
            const opts = v.abilityTargets?.[`${c.id}:${i}`] ?? [];
            for (const o of opts) {
                const target = h.lookup(v, o.id);
                if (!target || target.owner === p || h.targetedByUs(v, o.id))
                    continue;
                const pending = v.flow.stack.some(e => e.controller !== p && (e.targetIds?.includes(o.id) || e.cardId === o.id && e.kind === 'auto-ability'));
                const recursive = ['CQ31', 'BQ087', 'BQ086', 'WM060', 'BQ082', 'CQ32'].includes(target.catalogId);
                if (pending || recursive && (v.turn.phase === 'end' || v.turn.phase === 'start' || standard))
                    add({ ...base, targetIds: [o.id] }, pending ? 115 : 46 + h.value(target));
            }
            if (v.turn.step === 'contest-before' && v.turn.kind === 'investigation' && c.district === v.turn.district && !c.tapped) {
                const ours = h.total(v, p, c.district, 'investigation'), theirs = h.total(v, 1 - p, c.district, 'investigation');
                if (ours <= theirs && ours + 1 >= theirs)
                    add(base, 22);
            }
        }
}
// Spending an action on influence must account for the investigations and
// other useful actions lost by tapping a monk before the contest phase.
function monkTapPenalty(v, c, h) {
    const d = c.district, p = v.seat, icons = c.effectiveIcons ?? c.icons ?? {}, resources = resourcePriorities(v, h);
    let loss = 0;
    for (const kind of ['investigation', 'battle', 'influence']) {
        if (!h.contestPending(v, d, kind))
            continue;
        const amount = icons[kind] ?? 0, ours = h.total(v, p, d, kind), theirs = h.total(v, 1 - p, d, kind);
        if (amount && ours > theirs && ours - amount <= theirs)
            loss += kind === 'investigation' ? (resources.stocked ? 7 : 23) : kind === 'battle' ? 16 : 5;
    }
    const readyAction = (c.availableActions ?? []).some(a => a.tap && !a.used && (!a.target || v.abilityTargets?.[`${c.id}:${(c.availableActions ?? []).indexOf(a)}`]?.length));
    if (readyAction && !(c.catalogId === 'XG22' && !botLibraryHasName(v, '光能盾')))
        loss += 9;
    return loss;
}
function influenceGain(v, d, h) {
    const region = v.districts[d];
    if (!region || region.pendingWinner !== undefined && region.pendingWinner !== null)
        return -100;
    if (h.influenceWorth && !h.influenceWorth(v, d))
        return -12;
    const needed = region.threshold - region.influence[v.seat], score = mine(v).score ?? 0;
    return 13 + (needed <= 1 ? 12 + (score + (region.points ?? 0) >= (mine(v).victoryThreshold ?? 8) ? 35 : 0) : 0);
}
export function anglicanSurplusMana(v, h, { reservedMana = 0, candidates = [] } = {}) {
    const m = mine(v), available = h.pool(v), payable = n => n > 0 && n <= available;
    if (reservedMana > 0)
        return false;
    const price = c => v.castingCosts?.[c.id] ?? h.cost(c);
    // Include held fast cards and delayed reveals, even when their best window
    // has not arrived. Do not spend a response budget just because we can pass.
    if (m.hand.some(c => c.castAllowed !== false && h.loyalty(v, c) && !h.duplicate(v, c) && payable(price(c)) && (hasCardType(c, 'character') || (c.spell ?? c.attachment)?.timing === 'fast' || (c.spell ?? c.attachment)?.target === 'none' || (v.spellTargets?.[c.id] ?? []).length)))
        return false;
    if (m.play.some(c => c.faceDown && !c.paidRevealBlocked && !c.automation?.noPaidReveal && h.loyalty(v, c) && payable(v.revealCosts?.[c.id] ?? h.cost(c))))
        return false;
    if (h.own(v).some(c => (c.availableActions ?? []).some((a, i) => !a.used && (!a.tap || !c.tapped && !c.cannotTap) && payable(a.cost ?? 0) && (!a.target || a.target === 'none' || v.abilityTargets?.[`${c.id}:${i}`]?.length))))
        return false;
    if ((v.zoneActions ?? []).some(a => a.allowed && payable(a.cost ?? 0)))
        return false;
    return !candidates.some(c => {
        const card = h.lookup(v, c.cardId);
        if (c.type === 'play' && card)
            return payable(price(card));
        if (c.type === 'reveal' && card)
            return payable(v.revealCosts?.[card.id] ?? h.cost(card));
        if (c.type === 'secret-deploy')
            return payable(h.secretDeploymentPrice(v, c.district));
        if (c.type === 'activate')
            return payable(card?.availableActions?.[c.actionIndex ?? 0]?.cost ?? 0);
        if (c.type === 'society-action')
            return payable(v.societies[v.seat].actions.find(a => a.id === c.abilityId)?.cost ?? 0);
        return false;
    });
}
export function anglicanInfluenceTactics(v, h, add, spending = {}) {
    const p = v.seat, society = v.societies?.[p];
    if (!anglicanBot(v) || society?.tapped || !v.turn.standardAllowed || v.flow.stepOwner !== p || v.flow.stack.length || !anglicanSurplusMana(v, h, spending))
        return;
    for (const a of society?.actions ?? []) {
        if (a.botDisabled || a.id !== 'anglican-influence' || a.used || h.pool(v) < a.cost)
            continue;
        for (const t of a.targetOptions ?? []) {
            const d = Number(t.id.slice(9)), region = v.districts[d];
            if (!region || region.pendingWinner !== undefined && region.pendingWinner !== null || !region.influence[1 - p])
                continue;
            const concession = h.districtConcession?.(v, d, h) ?? 0;
            if (concession >= 12)
                continue;
            const monks = mine(v).play.filter(c => !c.faceDown && !c.tapped && !c.cannotTap && c.district === d && hasCardType(c, 'character') && c.subtypes?.includes('僧侣'));
            const conversion = region.influence[1 - p] === 1 ? Math.max(0, ...monks.map(c => influenceGain(v, d, h) - monkTapPenalty(v, c, h))) : 0;
            const threat = region.influence[1 - p] >= region.threshold - 1 ? 20 : 0, score = 13 + threat + conversion - a.cost * 5 - concession;
            if (score > 0)
                add({ type: 'society-action', abilityId: a.id, targetIds: [t.id] }, score);
        }
    }
}
export function anglicanMonkChoice(v, a, h, type) {
    if (!['monk-influence', 'monk-empty-influence'].includes(a.mode))
        return null;
    const ranked = (a.cards ?? []).map(c => ({ ...c, ...(h.lookup(v, c.id) ?? {}) })).map(c => ({ c, score: (a.mode === 'monk-empty-influence' && v.districts[c.district]?.influence.some(n => n > 0) ? 0 : influenceGain(v, c.district, h)) - monkTapPenalty(v, c, h) })).sort((x, y) => y.score - x.score);
    const best = ranked[0];
    return [{ type, choiceId: a.id, cardIds: best && ((a.min ?? 0) > 0 || best.score > 0) ? [best.c.id] : [] }];
}
