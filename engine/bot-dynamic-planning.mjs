import {responseFilter} from './response-effect-semantics.mjs';
import {hiddenContestReady} from './bot-graveyard-uses.mjs';
import { hasCardType } from './card-types.mjs';
import { activeRumor,graveyardPurposeValue } from './bot-card-purpose.mjs';
const mine = v => v.players[v.seat];
const field = v => mine(v).play.filter(c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed);
const grave = v => [...mine(v).graveyard, ...mine(v).headquarters ?? []];
const is = (c, code) => c.catalogId === code;
const live = (v, code) => field(v).some(c => is(c, code));
const staged = (v, code) => mine(v).play.some(c => is(c, code));
export function libraryNameCount(v, name) { return v.bot?.libraryNames?.[name] ?? v.hardInfo?.ownDeck.filter(c => c.name === name).length; }
export function turnMana(v, exclude) {
    const m = mine(v), actionAhead = ['setup', 'start'].includes(v.turn?.phase) || v.turn?.phase === 'action' && (v.flow.stepOwner === v.seat || v.turn.firstPlayer !== v.seat && v.turn.step === 'first-action');
    return (m.costPool ?? 0) + m.assets.filter(a => !a.tapped).length + Number(!!actionAhead && !m.actionsUsed?.asset && m.hand.some(c => c.id !== exclude && !c.nonAssetNow));
}
export function canFund(v, c, amount = v.castingCosts?.[c.id] ?? c.printedCost ?? 0) {
    if (amount > turnMana(v, c.id))
        return false;
    if (mine(v).ignoreLoyalty)
        return true;
    const domains = { 心: '心灵', 圣: '神圣', 星: '星辰', 死: '死亡', 血: '鲜血' }, m = mine(v);
    const missing = asset => Object.entries(c.loyalty ?? {}).every(([symbol, n]) => symbol === '核' ? !!m.coreArea : ((domains[symbol] ? m.loyalty?.domains?.[domains[symbol]] : m.loyalty?.factions?.[symbol]) ?? 0) + Number(!!asset && (domains[symbol] ? asset.magicDomains?.includes(domains[symbol]) : asset.faction?.split('·')[0] === symbol)) >= n);
    return missing(null) || !m.actionsUsed?.asset && m.hand.some(x => x.id !== c.id && !x.nonAssetNow && missing(x));
}
// Count established/staged copies and earlier copies in this selection. A
// four-card inspection must not value every copy as the first engine.
export function copyIndex(v, c) {
    const held = mine(v).hand.filter(x => is(x, c.catalogId)), inHand = held.findIndex(x => x.id === c.id);
    const board = mine(v).play.filter(x => x.id !== c.id && is(x, c.catalogId)).length;
    const library = v.hardInfo?.ownDeck ?? [], unknown = library.filter(x => is(x, c.catalogId) && !Object.hasOwn(v.hardInfo.libraryKnown ?? {}, x.id)).sort((a, b) => a.id.localeCompare(b.id));
    return board + (inHand >= 0 ? inHand : held.length) + (library.some(x => x.id === c.id) ? Math.max(0, unknown.findIndex(x => x.id === c.id)) : 0);
}
export function matutaBonus(v, c) {
    if (!['white-anglican', 'yellow-white-spells'].includes(v.bot?.id) || !is(c, 'XG22'))
        return 0;
    const shields = libraryNameCount(v, '光能盾');
    if (shields === 0)
        return -65;
    if (copyIndex(v, c) > 0)
        return -45;
    return grave(v).some(x => is(x, 'XG22')) && (shields ?? 0) >= 2 ? 85 : v.round <= 3 ? 32 : 16;
}
export function engineCanStart(v, c) {
    const m = mine(v), mana = turnMana(v, c.id), cost = v.castingCosts?.[c.id] ?? c.printedCost ?? 0;
    if (!canFund(v, c, cost))
        return false;
    if (is(c, 'XG01')) {
        const relics = field(v).filter(x => is(x, 'XG06') && !x.tapped).length;
        return m.hand.some(x => x.id !== c.id && x.subtypes?.includes('法术') && x.castAllowed !== false && canFund(v, x) && (v.castingCosts?.[x.id] ?? Math.max(0, (x.printedCost ?? 0) - relics)) <= mana - cost);
    }
    if (is(c, 'BQ030')) {
        const host = hasCardType(c, 'character') || field(v).some(x => hasCardType(x, 'character'));
        const blood = [...grave(v), ...(v.sealed ?? []).filter(x => x.hostId === `society:${v.seat}`)].some(x => x.name === '鲜血');
        const free = host && (field(v).some(x => is(x, 'BQ026') && !x.attachedTo) || blood && field(v).some(x => is(x, 'BQ027') || is(x, 'XG10') && !x.tapped));
        return free || m.hand.some(x => x.id !== c.id && (x.attachment?.effect === 'attach' && host && is(x, 'JC036') === false || is(x, 'BQ026')) && canFund(v, x) && (v.castingCosts?.[x.id] ?? x.printedCost ?? 0) <= mana - cost);
    }
    return false;
}
export function engineCopyBonus(v, c) {
    if (!(v.bot?.id === 'yellow-white-spells' && is(c, 'XG01') || v.bot?.id === 'blue-dragon-feast' && is(c, 'BQ030')))
        return 0;
    const n = copyIndex(v, c), ready = engineCanStart(v, c);
    return n >= 2 ? -55 : n === 1 ? ready ? 30 : -18 : ready ? 110 : 12;
}
export function enginePlayBonus(v, c) {
    if (v.bot?.id !== 'yellow-white-spells' || !is(c, 'XG01'))
        return 0;
    const n = copyIndex(v, c);
    return n >= 2 ? -25 : engineCanStart(v, c) ? n === 0 ? 90 : 30 : n === 0 ? 15 : 0;
}
export function projectedGraveCount(v) {
    const m = mine(v), mana = turnMana(v), cleaner = m.hand.some(c => is(c, 'XQ36') && canFund(v, c));
    const renown = field(v).some(c => c.keywordStates?.some(k => k.keyword === '威名' && k.present) || c.keywords?.includes('威名'));
    const poet = m.hand.some(c => is(c, 'BH09') && canFund(v, c));
    const stacked = (v.flow?.stack ?? []).filter(a => a.controller === v.seat).reduce((n, a) => n + (a.responseEffect?.libraryUse ?? 0), 0);
    // Count both held enablers only if this turn can actually pay for both.
    return grave(v).length + Math.max(stacked, (cleaner ? 4 : 0) + (poet && (!cleaner || mana >= 3) ? renown ? 2 : 3 : 0));
}
export function blackHandBonus(v, c) {
    if (!['black-purple-criminals', 'green-black-renown'].includes(v.bot?.id))
        return 0;
    if (is(c, 'BQ091'))
        return copyIndex(v, c) >= 2 ? 4 : projectedGraveCount(v) >= 7 ? 95 : v.round <= 3 ? 35 : 15;
    if (is(c, 'XQ36'))
        return v.round <= 3 && grave(v).length < 7 ? 65 : grave(v).length < 7 ? 30 : 0;
    if (is(c, 'BH41') && staged(v, 'BQ091'))
        return 32;
    if (is(c, 'CQ24') && v.players[1 - v.seat].play.some(x => !x.faceDown && hasCardType(x, 'attachment') && (x.printedCost ?? 0) <= 3))
        return canFund(v, c, (c.printedCost ?? 0) + 3) ? 85 : 30;
    return 0;
}
export function greenHandBonus(v, c) {
    if (v.bot?.id !== 'green-black-renown')
        return 0;
    if (is(c, 'BH12'))
        return staged(v, 'BH12') ? -12 : mine(v).play.some(x => x.faceDown) ? v.round <= 3 ? 70 : 25 : v.round <= 2 ? 24 : 0;
    if (is(c, 'BH07') && copyIndex(v, c) === 0 && v.round <= 2)
        return v.round === 1 ? 110 : 40;
    if (is(c, 'JC014') && copyIndex(v, c) === 0 && v.round <= 3)
        return 65;
    if (is(c, 'BH09')) {
        const partner = field(v).some(x => x.keywords?.includes('威名') || x.keywordStates?.some(k => k.keyword === '威名' && k.present));
        if (!partner)
            return 8;
        // After the first refill, complete the early combat curve before asking
        // the hard library picker for another Poet with the same top priority.
        return v.round <= 3 && live(v, 'BH09') && !staged(v, 'JC014') ? 36 : 76;
    }
    if (is(c, 'BH11') && copyIndex(v, c) === 0)
        return v.round >= 4 && canFund(v, c) ? 100 : v.round === 3 ? 25 : -12;
    if (['LC02', 'BH10'].includes(c.catalogId))
        return v.round <= 3 ? -10 : 0;
    return 0;
}
export function yallorBonus(v, c) {
    if (v.bot?.id !== 'white-anglican')
        return 0;
    if (is(c, 'XQ28'))
        return copyIndex(v, c) > 0 ? -16 : v.round <= 2 ? 65 : 12;
    if (!is(c, 'JC081') || copyIndex(v, c) > 0)
        return 0;
    const reveals = mine(v).hand.filter(x => x.id !== c.id && (x.faction?.split('·')[1] === '圣贤' || x.magicDomains?.includes('神圣'))).length;
    return v.round >= 3 && canFund(v, c, Math.max(0, (c.printedCost ?? 7) - reveals)) ? 120 : v.round === 2 ? 45 : 8;
}
function hasDiscard(plan) { return !!plan && (plan.discardCost > 0 || ['discard-own', 'discard-self', 'discard-hand'].includes(plan.effect) || (plan.steps ?? []).some(hasDiscard)); }
export function rumorDemand(v) {
    const m = mine(v), mana = turnMana(v);
    const hidden = !!v.hidden || [...m.hand, ...m.play].some(c => ['BQ082', 'CQ32'].includes(c.catalogId) && mana >= Math.max(1, (c.faceDown ? v.revealCosts?.[c.id] ?? c.printedCost : c.printedCost ?? 0) - 1));
    const discard = (v.flow?.stack ?? []).some(a => a.controller === v.seat && (hasDiscard(a.plan) || a.responseEffect?.discardCount > 0)) || field(v).some(c => (c.availableActions ?? []).some(a => !a.used && (!a.tap || !c.tapped) && hasDiscard(a) && (a.cost ?? 0) <= mana) || is(c, 'WM060') || is(c, 'CQ26')) || m.hand.some(c => hasDiscard(c.spell) && canFund(v, c));
    return Number(hidden) + Number(discard);
}
export function rumorHandBonus(v, c) {
    if (!c.keywords?.includes('传闻'))
        return 0;
    const demand = rumorDemand(v);
    if (!demand)
        return 0;
    const copies = mine(v).hand.filter(x => x.id !== c.id && x.keywords?.includes('传闻')).length;
    return copies >= 2 ? -8 : copies ? 15 : 65 + demand * 10;
}
export function criminalNeedsRemoval(v) {
    const ours = field(v).filter(c => hasCardType(c, 'character')), foes = v.players[1 - v.seat].play.filter(c => !c.faceDown && hasCardType(c, 'character'));
    return foes.some(c => (c.printedCost ?? 0) >= 4) && (foes.length <= 2 || foes.length > ours.length + 1);
}
export function criminalEngineWindow(v) {
    return hiddenContestReady(v);
}
export function rumorGraveRecovery(v) {
    if (mine(v).hand.length > 3)
        return false;
    return field(v).some(c => hasCardType(c, 'character') && !c.keywords?.includes('永恒') && ((c.printedCost ?? 0) <= 2 && ((c.effectiveDefense ?? c.defense ?? 1) - (c.damage ?? 0) <= 1 || c.tapped) ||
        (v.flow?.stack ?? []).some(a => a.targetIds?.includes(c.id) && a.responseEffect?.removesTargets)));
}
export function criminalGravePriority(v, c, context = {}) {
    if (v.bot?.id !== 'black-purple-criminals')
        return null;
    const cards = grave(v), unknown = (v.hardInfo?.ownDeck ?? []).filter(x => is(x, c.catalogId) && !Object.hasOwn(v.hardInfo.libraryKnown ?? {}, x.id)).sort((a, b) => a.id.localeCompare(b.id));
    const rank = Math.max(0, unknown.findIndex(x => x.id === c.id)), count = cards.filter(x => is(x, c.catalogId)).length + rank, removal = criminalNeedsRemoval(v), engine = context.gravePlan?.hiddenReady ?? criminalEngineWindow(v);
    const revive = context.gravePlan?.uses.some(u => u.kind === 'enter' && u.weight >= 0.8 && u.source.id !== c.id && responseFilter(c, u.filter)) ?? engine;
    const payload = [...cards, ...mine(v).hand, ...(v.hardInfo?.ownDeck ?? []).filter(x => !Object.hasOwn(v.hardInfo.libraryKnown ?? {}, x.id))].some(x => ['WM060', 'BQ086'].includes(x.catalogId));
    const generic = () => context.cardValue ? graveyardPurposeValue(v, c, context.cardValue, context.gravePlan) : activeRumor(v, c) ? 125 : -(c.printedCost ?? 0);
    let n = is(c, 'WM060') ? count || live(v, 'WM060') ? 8 : revive ? removal ? 145 : 220 : -30 :
        is(c, 'BQ086') ? count || live(v, 'BQ086') ? 8 : revive ? removal ? 225 : 150 : -30 :
            is(c, 'CQ31') ? count < 3 ? (engine ? 200 - count * 3 : -35 - count) : 12 :
                is(c, 'BQ087') && revive && !payload && !cards.some(x => hasCardType(x, 'character') && (x.printedCost ?? 0) >= 5) && !count ? 135 :
                    generic();
    return n;
}
export function criminalLibraryBonus(v, c, context) {
    if (v.bot?.id !== 'black-purple-criminals' || context.kind !== 'hand')
        return 0;
    if (['WM060', 'BQ086'].includes(c.catalogId))
        return -120;
    if (is(c, 'BQ082')) {
        const payload = grave(v).some(x => ['WM060', 'BQ086'].includes(x.catalogId)), monsters = grave(v).filter(x => is(x, 'CQ31')).length;
        return copyIndex(v, c) > 0 ? -25 : payload ? (monsters >= 3 ? 165 : 100) : 10;
    }
    if (is(c, 'CQ32') && grave(v).some(x => is(x, 'CQ31')) && copyIndex(v, c) === 0)
        return 35;
    return 0;
}
export function greenAssetBonus(v, c) {
    if (v.bot?.id !== 'green-black-renown')
        return 0;
    const colors = mine(v).loyalty?.factions ?? {}, color = c.faction?.split('·')[0];
    let n = 0;
    if (color === '绿' && (colors.绿 ?? 0) < (v.round === 1 ? 1 : 2))
        n -= 120;
    if (color === '黑' && (colors.绿 ?? 0) >= 2 && !(colors.黑 > 0))
        n -= 90;
    if (v.round === 1 && is(c, 'BH07') && copyIndex(v, c) === 0)
        n += 180;
    if (v.round <= 3 && is(c, 'JC014') && copyIndex(v, c) === 0)
        n += 100;
    if (v.round <= 4 && is(c, 'BH11') && copyIndex(v, c) === 0)
        n += 120;
    return n;
}
export function greenLibraryBonus(v, c, context) {
    if (v.bot?.id !== 'green-black-renown' || context.kind !== 'hand' || v.round !== 1 || mine(v).loyalty?.factions?.绿 > 0)
        return 0;
    const boxer = mine(v).hand.find(x => is(x, 'BH07'));
    if (!boxer || mine(v).hand.some(x => x.id !== boxer.id && x.faction?.startsWith('绿') && !x.nonAssetNow))
        return 0;
    const material = (v.hardInfo?.ownDeck ?? []).filter(x => !x.nonAssetNow && !x.keywords?.includes('非资产') && x.faction?.startsWith('绿') && !['BH07', 'JC014'].includes(x.catalogId) && !Object.hasOwn(v.hardInfo.libraryKnown ?? {}, x.id)).sort((a, b) => (a.printedCost ?? 0) - (b.printedCost ?? 0) || a.id.localeCompare(b.id))[0];
    return c.id === material?.id ? 190 : 0;
}
export function needsCurveAsset(v, h) {
    const m = mine(v);
    if (m.actionsUsed?.asset)
        return false;
    return m.hand.some(c => {
        const wanted = v.bot?.id === 'red-monastery' ? v.round === 2 && is(c, 'XG36') : v.bot?.id === 'white-anglican' ? v.round === 2 && is(c, 'XQ28') || v.round === 3 && is(c, 'JC081') : v.bot?.id === 'green-black-renown' ? v.round === 1 && is(c, 'BH07') || v.round <= 3 && ['JC014', 'BH09'].includes(c.catalogId) || v.round === 4 && is(c, 'BH11') : false;
        if (!wanted || c.castAllowed === false)
            return false;
        const reveal = is(c, 'JC081') ? m.hand.filter(x => x.id !== c.id && (x.faction?.split('·')[1] === '圣贤' || x.magicDomains?.includes('神圣'))).length : 0;
        const price = Math.max(0, (v.castingCosts?.[c.id] ?? c.printedCost ?? 0) - reveal);
        return (price > h.pool(v) || !h.loyalty(v, c)) && canFund(v, c, price);
    });
}
