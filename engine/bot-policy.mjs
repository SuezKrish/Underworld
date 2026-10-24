import { sequenceThreats, reserveCounterForFollowUp } from './bot-threat-sequencing.mjs';
import { nonDrawLockValue, nonDrawEffectBlocked, onlyDrawEffect } from './bot-draw-lock-planning.mjs';
import { refillInvestmentPenalty } from './bot-refill-economy.mjs';
import { investigationSealValue } from './bot-grave-seal-planning.mjs';
import { mutantForfeitsWinningClaim } from './bot-entry-tempo.mjs';
import { tormentVictimCost, woundVictimCost } from './bot-torment-planning.mjs';
import { negativeChoiceImpact } from './bot-choice-impact.mjs';
import { projectedClaimOutcome } from './bot-claim-outcome.mjs';
import { knownMillOutcome } from './bot-library-outlook.mjs';
import { matchupHandBonus, matchupDistrictBonus } from './bot-matchup-planning.mjs';
import { upcomingContest } from './contest-timing.mjs';
import { nightPatrolMoves, greenCarmenTactics, greenEmployeeSetup, greenEmployeeScore, greenEmployeeRevealHold, greenOpeningMulligan } from './green-black-tactics.mjs';
import { blueBot, blueHandBonus, bluePlayBonus, blueDistrictBonus, blueAttachmentScore, blueBatAttachTargets, blueBatMobility, blueBloodSacrifice, bluePhoenixContest, blueMobilityRevealScore, blueRevealReserve, blueEngineRevealScore, blueBattleDiscards, blueBattleDistrictBonus, blueHeartPathPlayScore, blueMulligan, blueSecretDeployAllowed, blueHiddenDistrictBonus, blueBloodSearch } from './blue-dragon-bot-policy.mjs';
import { actionEffectForecast } from './bot-effect-forecast.mjs';
import { fastRemovalDue, paidRevealDue, imminentHandLoss } from './bot-response-timing.mjs';
import { redPurpleFreeProspect, purpleBot, purpleLibraryUse, purpleLibraryBudget, redPurpleDeployAllowed, redPurpleHandBonus, redPurpleAssetBonus, redPurpleMulligan, redPurpleHiddenScore, redPurplePreferHidden, redPurpleReveal, redPurpleDistrictBonus, redPurpleChoice, redPurpleTrigger, redPurpleTactics } from './red-purple-bot-policy.mjs';
import { libraryClaimPlacement, investigationRelief } from './bot-library-safety.mjs';
import { criminalBot, criminalHandBonus, criminalAssetBonus, criminalPreferHidden, criminalDistrictBonus, criminalReserve, criminalCommitmentPenalty, criminalMulligan, criminalReveal, criminalTrigger, criminalChoice, criminalHiddenScore, criminalTactics, criminalOrder, criminalRuleSacrifice, criminalDeployAllowed, criminalLibraryUse, criminalLibraryBudget } from './criminal-bot-policy.mjs';
import { anglicanBot, anglicanHandBonus, anglicanAssetBonus, anglicanMulligan, anglicanTactics, anglicanInfluenceTactics, anglicanMonkChoice, anglicanMeditationHold } from './anglican-bot-policy.mjs';
import { defaultTriggerEnabled } from './trigger-selection.mjs';
import { radioBot, radioHandBonus, radioAssetBonus, radioDistrictBonus, radioPreferHidden, radioDeployAllowed, radioReserve, radioReveal, radioMulligan, radioTrigger, radioChoice, radioHiddenScore, radioTactics } from './rumor-radio-bot-policy.mjs';
import { lockingHandBonus, lockingAssetBonus, lockingAssetAllowed, lockingDistrictBonus, lockingChoice, lockingTactics, lockingMulligan, lockingRevealBonus, lockingCommandAllowed, lockingCommandPenalty, lockingReveal } from './shoggoth-bot-policy.mjs';
import { hasCardType } from './card-types.mjs';
import { uniqueIdentity, matchesCardNameFilter } from './card-names.mjs';
import { botLibraryHasName } from './bot-library-information.mjs';
import { responsePlan, ambushRevealScore, secretDeploymentPrice } from './bot-response-planning.mjs';
import { secretDeploymentAssessment } from './bot-deployment-planning.mjs';
import { openingBlackBladeRisk } from './bot-opening-safety.mjs';
import { recurringEngine, libraryReserve, libraryUse, libraryBudget, optionalRefillUseful, resourcePriorities, regionRewardUtility, regionTriggerUseful, lakeShouldShuffle, secrecyReward, districtConcession, handCommitmentPenalty, assetPreservesHand, districtAttachmentTenure, earlyEngineTenurePenalty, removalEngineTempoBonus } from './bot-resource-planning.mjs';
import { spellFuel, spellCombatReserve, spellCombatPump, spellProtectionReserve, spellBlinkHold, spellSilverRescue } from './spell-bot-planning.mjs';
import { spellFuneralScore, spellRelicDomain, spellRelicRebuild, wheelOpponentScore, wheelDisruptionKey, wheelDisruptionPending, wheelRecoveryDraw, wheelRefillKey, wheelPrice, wantsStarRelic } from './spell-graveyard-planning.mjs';
import { pendingGraveyardUse } from './bot-graveyard-uses.mjs';
import { matutaBonus, engineCopyBonus, enginePlayBonus, blackHandBonus, greenHandBonus, greenAssetBonus, yallorBonus, rumorHandBonus, engineCanStart, needsCurveAsset } from './bot-dynamic-planning.mjs';
import { rumorTriggerChoices } from './bot-rumor-planning.mjs';
import { assetComboReserve, assetLoyaltyBenefit, assetCommitmentPenalty } from './bot-card-purpose.mjs';
import { characterSacrificePlays } from './bot-character-payments.mjs';
// Normal BOTs receive only their ordinary seat view. The opt-in hard policy
// supplies a separate server-only view; player views never gain these details.
const cost = c => Number(c?.printedCost) || 0;
const mine = v => v.players[v.seat], enemy = v => v.players[1 - v.seat];
const pool = v => (mine(v).costPool ?? 0) + mine(v).assets.filter(c => !c.tapped).length;
const board = v => v.players.flatMap(p => p.play);
const own = v => mine(v).play.filter(c => !c.faceDown);
const value = c => {
    if (!c)
        return 0;
    if (c.faceDown && !c.name)
        return 2;
    const special = { JC080: 16, XQ31: 13, JC081: 12, LC11: 8, BH36: 7, XQ32: 7, JC076: 6, LC06: 6, XQ29: 5, XQ28: 4, XG22: 4, JZ47: 5, LC08: 4, BQ073: 4, JC078: 3, XQ33: 2, BQ108: 1,
        WM060: 17, BQ087: 19, BQ086: 14, BQ082: 11, CQ32: 11, CQ31: 7, JZ63: 6, WM063: 8, BH11: 11, BH10: 9, LC02: 10, JC014: 6, BH07: 5, BH09: 5, CQ26: 8, BH41: 6, JC086: 6, JC084: 4, XQ36: 5, JC017: 6, WM011: 4, WM019: 7, BQ091: 4, XG28: 5, JZ55: 7, JZ54: 4, BQ020: 3, XG01: 17, XG06: 11, WM055: 6, WM090: 3, BQ010: 4, JC006: 5, XG03: 7, WM008: 4, XQ04: 5, BQ009: 1, BQ030: 16, BQ034: 11, BQ035: 14, BQ031: 10, BQ036: 14, CQ07: 10, WM021: 8, BQ029: 5, BQ027: 3, BQ026: 5, BH16: 6, BQ040: 4, BQ039: 5, JC030: 8, JC034: 8, JC036: 10, XG10: 10 };
    return special[c.catalogId] ?? (cost(c) + Object.values(c.effectiveIcons ?? c.icons ?? {}).reduce((n, x) => n + x, 0) + 2);
};
const sorted = (cards, score, desc = true) => [...cards].sort((a, b) => (desc ? 1 : -1) * (score(b) - score(a)) || a.id.localeCompare(b.id));
const icons = (v, c, k) => c.effectiveIcons ? c.effectiveIcons[k] ?? 0 : c.faceDown ? (k === 'influence' ? c.influenceIcons ?? 1 : 0) : (c.icons?.[k] ?? 0) + (v.turn?.firstPlayer === c.controller ? (c.temporaryIcons?.[k] ?? 0) : 0);
const total = (v, p, d, k) => v.players[p].play.filter(c => c.district === d && !c.tapped && (k === 'battle' || !c.nonBattleParticipationBlocked)).reduce((n, c) => n + icons(v, c, k), 0);
const keyword = (c, k) => c.keywordStates?.find(x => x.keyword === k)?.present ?? c.keywords?.includes(k) ?? false;
const blue = blueBot;
const bloodAvailable = v => mine(v).graveyard.concat(mine(v).headquarters ?? [], (v.sealed ?? []).filter(c => c.hostId === `society:${v.seat}`)).some(c => c.name === '鲜血');
const vampires = v => own(v).filter(c => c.subtypes?.includes('吸血鬼'));
const green = v => v.bot?.id === 'green-black-renown';
const spells = v => v.bot?.id === 'yellow-white-spells';
const poetPartner = (v, d) => own(v).some(c => c.district === d && hasCardType(c, 'character') && keyword(c, '威名'));
function poetPlayAllowed(v, c, d) {
    if (!green(v) || c.catalogId !== 'BH09' || poetPartner(v, d))
        return true;
    // Preserve the two-card refill while a renown character is available or
    // being staged. A depleted hand can still use the single-card mode.
    const waiting = mine(v).hand.concat(mine(v).play.filter(x => x.faceDown)).some(x => x.id !== c.id && hasCardType(x, 'character') && keyword(x.faceDown ? faceUp(v, x) : x, '威名'));
    return (!waiting && mine(v).hand.length <= 2 && v.round >= 3) || districtScore(v, d, faceUp(v, c)) >= 100;
}
const drawEngines = v => nonDrawEffectBlocked(v) ? 0 : own(v).filter(c => c.catalogId === 'XG01').length;
const targetedByUs = (v, id) => v.flow.stack.some(a => a.controller === v.seat && a.targetIds?.includes(id));
const keyRole = c => hasCardType(c, 'character') && ['XG01', 'JC080', 'XQ31', 'BH11', 'BH10', 'BH36', 'BQ030', 'BQ036'].includes(c.catalogId);
const threatenedEngine = v => own(v).filter(c => keyRole(c) && lethalBattleRisk(v, c, c.district));
function shieldReserve(v) {
    const interaction = spellProtectionReserve(v, policyHelpers);
    if (!threatenedEngine(v).length)
        return interaction;
    const c = mine(v).hand.find(c => c.catalogId === 'JC078' && loyalty(v, c));
    return Math.max(interaction, c ? v.castingCosts?.[c.id] ?? cost(c) : 0);
}
// A spell/draw chain is useful even above the recovery hand limit. Bound it by
// the remaining deck, not an arbitrary number of casts per round.
const drawReserve = v => libraryReserve(v, { contestPending });
const cycleAllowed = v => wheelRecoveryDraw(v) ? mine(v).deckCount > 0 : mine(v).deckCount > drawEngines(v) + drawReserve(v);
const hiddenSilvers = v => mine(v).play.filter(c => c.faceDown && c.catalogId === 'XG01');
const matutaReady = v => own(v).some(c => c.catalogId === 'XG22');
const enemyMana = v => (enemy(v).costPool ?? 0) + enemy(v).assets.filter(c => !c.tapped).length;
function safeSilverChain(v, c) {
    if (!v.turn.standardAllowed || v.flow.stepOwner !== v.seat || v.flow.stack.length || enemyMana(v) > 0 || lethalBattleRisk(v, faceUp(v, c), c.district))
        return false;
    // Zero-cost printed actions remain visible threats even with an empty pool.
    if (enemy(v).play.some(x => !x.faceDown && (x.availableActions ?? x.automation?.actions ?? (x.automation?.action ? [x.automation.action] : [])).some(a => a.timing === 'fast' && (a.cost ?? 0) === 0 && ['damage', 'wound', 'destroy', 'return-hand', 'conceal'].includes(a.effect))))
        return false;
    const after = pool(v) - (v.revealCosts?.[c.id] ?? cost(c));
    return mine(v).hand.some(x => x.subtypes?.includes('法术') && x.castAllowed !== false && loyalty(v, x) && (v.castingCosts?.[x.id] ?? cost(x)) <= after && (x.spell?.target === 'none' || (v.spellTargets?.[x.id] ?? []).length));
}
const sealCount = (v, id) => (v.sealed ?? []).filter(c => c.hostId === id).length;
const wheelInHand = v => mine(v).hand.some(c => c.catalogId === 'XQ02');
const wheelInDeck = v => botLibraryHasName(v, '轮回秘仪');
const recoverStorage = (v, id) => mine(v).hand.length <= Math.max(4, (mine(v).handLimit ?? 7) - 2) || mine(v).deckCount <= 10 && !wheelInHand(v) && (v.sealed ?? []).some(c => c.hostId === id && c.catalogId === 'XQ02');
const storageReplacement = (v, c) => spells(v) && c.catalogId === 'WM055' && own(v).some(x => x.catalogId === 'WM055' && sealCount(v, x.id) > 0 && recoverStorage(v, x.id));
const silverDrawAllowed = v => wheelRecoveryDraw(v) || !(spells(v) && mine(v).deckCount <= 10 && mine(v).hand.length >= (mine(v).handLimit ?? 7));
function reservedReveal(v) {
    if (blue(v))
        return blueRevealReserve(v, policyHelpers);
    if (criminalBot(v))
        return criminalReserve(v);
    if (radioBot(v))
        return radioReserve(v);
    if (!spells(v) || !['start', 'action', 'contest'].includes(v.turn.phase))
        return 0;
    const matuta = !matutaReady(v) && botLibraryHasName(v, '光能盾') && mine(v).play.find(c => c.faceDown && c.catalogId === 'XG22' && !c.paidRevealBlocked && loyalty(v, c));
    const matutaPrice = matuta ? v.revealCosts?.[matuta.id] ?? cost(matuta) : 0;
    const matutaReserve = matutaPrice <= Math.max(pool(v), mine(v).assets.length) ? matutaPrice : 0;
    if (v.round < 3 || drawEngines(v))
        return matutaReserve;
    const c = hiddenSilvers(v).find(c => loyalty(v, c) && !c.paidRevealBlocked);
    // Preserve untapped assets for the end window; cost pools still expire at
    // each step boundary according to the ordinary engine rules.
    const required = c ? v.revealCosts?.[c.id] ?? cost(c) : 0;
    return Math.max(matutaReserve, required <= Math.max(pool(v), mine(v).assets.length) ? required : 0);
}
function claimPenalty(v, d, ours, prospect) {
    const r = v.districts?.[d];
    if (!r || ours < r.threshold)
        return 0;
    if (resourcePriorities(v, policyHelpers).race)
        return 0;
    const points = Math.max(0, (r.points ?? 0) - (r.destroyed ?? 0));
    if (projectedClaimOutcome(v, v.seat, d, policyHelpers).wins)
        return 0;
    const cardTempo = c => value(c) * 0.45 + icons(v, c, 'investigation') * 2 + (c.catalogId === 'XG01' ? 8 : 0);
    const tempo = p => v.players[p].play.filter(c => c.district === d).reduce((n, c) => n + cardTempo(c), 0);
    const added = prospect && !mine(v).play.some(c => c.id === prospect.id) ? cardTempo(prospect) : 0;
    return Math.max(0, tempo(v.seat) + added - tempo(1 - v.seat) - points * 3 - v.round * 0.3);
}
function influenceWorth(v, d, count = 1) { const r = v.districts?.[d]; return !r || districtConcession(v, d, policyHelpers) < 4 && claimPenalty(v, d, r.influence[v.seat] + count) < 4; }
function hiddenStrength(c, v) { return cost(c) + (blue(v ?? {}) && c.subtypes?.includes('吸血鬼') ? own(v).filter(x => x.catalogId === 'WM021').length * 2 : 0) + (c.hiddenAbilities ?? []).filter(a => a.kind === 'point-modifier' && !a.condition).reduce((n, a) => n + (a.amount ?? a.modifier ?? 0), 0); }
const reputation = c => c.keywordStates?.find(k => k.keyword === '声望')?.present ?? c.keywords?.includes('声望') ?? false;
function contestPending(v, d, kind) {
    const t = v.turn;
    if (['setup', 'start', 'action'].includes(t.phase))
        return true;
    if (t.phase !== 'contest' || !['contest-before', 'contest-after', 'contest-resolve', 'contest-triggers', 'contest-start', 'mobility-first', 'mobility-second'].includes(t.step))
        return false;
    if (t.district === null || t.district < d)
        return true;
    if (t.district > d)
        return false;
    const order = ['investigation', 'battle', 'influence'], a = order.indexOf(t.kind), b = order.indexOf(kind);
    return a < b || a === b && t.step === 'contest-before';
}
function faceUp(v, c) {
    const preview = c.revealPreview;
    const out = { ...c, controller: v.seat, faceDown: false,
        ...(c.faceDown ? { tapped: !!preview?.entersTapped, effectiveIcons: preview?.icons, effectiveDefense: preview?.defense,
            battleDamagePrevented: preview?.battleDamagePrevented, keywords: preview?.reputation ? ['声望'] : c.keywords, keywordStates: undefined } : {}) };
    if (!c.faceDown && !c.effectiveIcons) {
        const projected = { ...c.icons };
        for (const k of ['investigation', 'battle', 'influence'])
            projected[k] = (projected[k] ?? 0) + (v.turn.firstPlayer === v.seat ? (c.temporaryIcons?.[k] ?? 0) : 0);
        if (green(v) && keyword(c, '威名') && v.turn.firstPlayer === v.seat && (mine(v).loyalty?.domains?.心灵 ?? 0) >= 2 && (c.catalogId === 'BH11' || own(v).some(a => a.catalogId === 'BH11')))
            projected.investigation++;
        if (c.automation?.static === 'blood-bat' && (mine(v).loyalty?.domains?.鲜血 ?? 0) >= 2)
            projected.investigation = (projected.investigation ?? 0) + 1;
        if (c.catalogId === 'CQ26' && mine(v).graveyard.length + (mine(v).headquarters?.length ?? 0) >= 7) {
            projected.investigation++;
            projected.battle++;
        }
        out.effectiveIcons = projected;
    }
    return out;
}
function lethalBattleRisk(v, c, d) {
    if (!contestPending(v, d, 'battle') || c.battleDamagePrevented)
        return false;
    const existing = mine(v).play.find(x => x.id === c.id && x.district === d), before = existing && !existing.tapped ? icons(v, existing, 'battle') : 0, after = c.tapped ? 0 : icons(v, c, 'battle');
    const margin = total(v, 1 - v.seat, d, 'battle') - total(v, v.seat, d, 'battle') - (after - before);
    return margin > 0 && margin >= (c.effectiveDefense ?? c.defense ?? 1) - (c.damage ?? 0);
}
function revealScore(v, c) {
    if (greenEmployeeRevealHold(v, c, policyHelpers))
        return null;
    const blueReveal = blueMobilityRevealScore(v, c, policyHelpers);
    if (blueReveal !== undefined)
        return blueReveal;
    const blueEngine = blueEngineRevealScore(v, c, policyHelpers);
    if (blueEngine !== undefined)
        return blueEngine;
    const ambush = ambushRevealScore(v, c, policyHelpers);
    if (ambush !== undefined)
        return ambush;
    const newDeck = redPurpleReveal(v, c, policyHelpers);
    if (newDeck !== undefined)
        return newDeck;
    const lock = lockingReveal(v, c, policyHelpers);
    if (lock !== undefined)
        return lock;
    const crime = criminalReveal(v, c, policyHelpers);
    if (crime !== undefined)
        return crime;
    const special = radioReveal(v, c, policyHelpers);
    if (special !== undefined)
        return special;
    if (c.tapped || !v.districts?.[c.district])
        return null;
    const up = faceUp(v, c), d = c.district;
    if (!poetPlayAllowed(v, c, d))
        return null;
    if (spells(v) && c.catalogId === 'XG01') {
        if (v.round < 3)
            return null;
        if (safeSilverChain(v, c))
            return 112 + value(c);
        // First establish the draw engine after battle, ready for the fourth round.
        // Do not condition this on which player will have the next initiative.
        if (v.turn.phase === 'end')
            return 85 + value(c);
        if (v.round === 3) {
            // The replay reveals after this region's battle, before influence, to turn
            // a loss into a tie. Do not wait for end step when the safe reveal matters.
            if (v.turn.phase === 'contest' && v.turn.district === d && !contestPending(v, d, 'battle') && contestPending(v, d, 'influence') && !up.tapped) {
                const ours = total(v, v.seat, d, 'influence'), theirs = total(v, 1 - v.seat, d, 'influence'), after = ours - icons(v, c, 'influence') + icons(v, up, 'influence'), region = v.districts[d];
                const result = Math.max(0, region.influence[v.seat] + after - theirs - region.influence[1 - v.seat]);
                if (ours <= theirs && after > ours && after >= theirs && claimPenalty(v, d, result) < 4)
                    return 85 + value(c);
            }
            return null;
        }
        if (!lethalBattleRisk(v, up, d))
            return 55 + value(c);
    }
    if ((spells(v) || anglicanBot(v)) && c.catalogId === 'XG22' && !matutaReady(v)) {
        if (v.turn.phase === 'end')
            return 72 + value(c);
        if (!up.tapped && v.turn.standardAllowed && !lethalBattleRisk(v, up, d))
            return 55 + value(c);
    }
    if (up.tapped)
        return v.turn.phase === 'end' ? 10 + value(c) : null;
    if (lethalBattleRisk(v, up, d))
        return null;
    // The ambush can immediately remove a one-defense enemy, before battle.
    if (green(v) && c.catalogId === 'LC02' && enemy(v).play.some(x => !x.faceDown && x.district === d && !x.barrierNow && (x.effectiveDefense ?? x.defense ?? 1) - (x.damage ?? 0) <= 1))
        return 55;
    const eye = contestPending(v, d, 'investigation') ? icons(v, up, 'investigation') : 0;
    const battle = contestPending(v, d, 'battle') ? icons(v, up, 'battle') : 0;
    const star = contestPending(v, d, 'influence') ? icons(v, up, 'influence') - icons(v, c, 'influence') : 0;
    const postInfluence = v.turn.step === 'contest-after' && v.turn.kind === 'influence' && v.turn.district === d && v.turn.reputationPending;
    const ownReputation = own(v).filter(a => a.district === d && !a.tapped && reputation(a)).length;
    const enemyReputation = enemy(v).play.filter(a => a.district === d && !a.tapped && reputation(a)).length;
    if (postInfluence && reputation(up) && ownReputation <= enemyReputation && ownReputation + 1 > enemyReputation)
        return 50 + value(c);
    // Keep the hidden influence when the face-up card supplies no useful icons.
    // A reputation reveal waits for this region's post-influence window.
    if (eye > 0 || battle > 0 || star > 0) {
        const weights = resourcePriorities(v, policyHelpers);
        return 25 + value(c) + eye * weights.investigation / 2 + battle * (green(v) ? 4 : 2) + Math.max(0, star) * weights.influence / 2;
    }
    // Prepare white icons for the coming first-player turn after contests finish.
    if (v.turn.phase === 'end' && v.turn.firstPlayer !== v.seat)
        return 12 + value(c);
    return null;
}
function loyalty(v, c) {
    if (mine(v).ignoreLoyalty)
        return true;
    const domains = { 心: '心灵', 圣: '神圣', 星: '星辰', 死: '死亡', 血: '鲜血' }, l = mine(v).loyalty;
    return Object.entries(c.loyalty ?? {}).every(([symbol, n]) => (symbol === '紫' && v.societies?.[v.seat]?.plan?.ignorePurpleLoyalty && c.owner === v.seat ? true : symbol === '核' ? !!mine(v).coreArea : (domains[symbol] ? l?.domains?.[domains[symbol]] : l?.factions?.[symbol]) >= n));
}
function duplicate(v, c) { const id = uniqueIdentity(c); return !!id && own(v).some(a => a.id !== c.id && uniqueIdentity(a) === id); }
function handValue(v, c) {
    let n = value(c) - (duplicate(v, c) && !(spells(v) && c.catalogId === 'WM055') ? 15 : 0) - (cost(c) > mine(v).assets.length + 2 ? 2 : 0);
    n += blueHandBonus(v, c, policyHelpers);
    if (spells(v)) {
        if (c.catalogId === 'XG01' && !drawEngines(v) && !hiddenSilvers(v).length)
            n += 18;
        if (c.catalogId === 'XG06' && own(v).filter(a => a.catalogId === 'XG06' && !a.tapped).length < 2)
            n += 14;
        if (c.catalogId === 'WM055')
            n += storageReplacement(v, c) ? 20 : !own(v).some(a => a.catalogId === 'WM055') ? 9 : 12;
        if (c.subtypes?.includes('法术') && drawEngines(v))
            n += 5;
        if (c.catalogId === 'XQ02' && wheelDisruptionPending(v))
            n += 80;
        if (c.catalogId === 'XQ49' && mine(v).graveyard.some(t => ['XQ02', 'XG01', 'XG06', 'WM055', 'BH03'].includes(t.catalogId)))
            n += mine(v).hand.filter(x => x.catalogId === 'XQ49').length <= 1 ? 16 : 3;
        if (spellFuel(c) && (drawEngines(v) || hiddenSilvers(v).length) && !mine(v).hand.some(x => x.id === c.id) && mine(v).hand.filter(spellFuel).length < 2)
            n += 24;
        if (mine(v).hand.some(x => x.id === c.id)) {
            if (spellFuel(c) && (drawEngines(v) || hiddenSilvers(v).length) && mine(v).hand.filter(spellFuel).length <= 2)
                n += 14;
            if (c.catalogId === 'XQ02' && (mine(v).deckCount <= 20 || !wheelInDeck(v)) && sorted(mine(v).hand.filter(x => x.catalogId === 'XQ02'), x => 0)[0]?.id === c.id)
                n += 45;
            if (c.catalogId === 'BH36' && drawEngines(v) && !own(v).some(x => x.catalogId === 'BH36'))
                n += 25;
            if (c.catalogId === 'XQ28' && drawEngines(v) && own(v).reduce((n, x) => n + icons(v, x, 'investigation'), 0) < 2)
                n += 12;
            if (c.catalogId === 'XG01' && drawEngines(v))
                n -= 18;
        }
    }
    return n - refillInvestmentPenalty(v, c, policyHelpers) + matchupHandBonus(v, c, policyHelpers) + spellCombatReserve(v, c) + matutaBonus(v, c) + engineCopyBonus(v, c) + blackHandBonus(v, c) + greenHandBonus(v, c) + yallorBonus(v, c) + rumorHandBonus(v, c) + redPurpleHandBonus(v, c) + lockingHandBonus(v, c) + radioHandBonus(v, c) + criminalHandBonus(v, c) + anglicanHandBonus(v, c);
}
function assetValue(v, c) {
    let score = handValue(v, c) + (mine(v).assets.length < 3 && c.faction?.startsWith('白') ? -8 : 0);
    if (blue(v)) {
        if ((c.magicDomains ?? []).includes('鲜血') && (mine(v).loyalty?.domains?.鲜血 ?? 0) < 2)
            score -= 30;
        if (c.catalogId === 'BQ030' && !own(v).some(x => x.catalogId === 'BQ030'))
            score += 40;
    }
    if (spells(v)) {
        const colors = mine(v).loyalty?.factions ?? {}, color = c.faction?.split('·')[0], need = color === '黄' ? 2 : color === '白' ? 1 : 0;
        if ((colors[color] ?? 0) < need)
            score -= 80 - 5 * (colors[color] ?? 0);
        if (color === '黄' && (colors.黄 ?? 0) < 2)
            score -= 16 * (2 - (colors.黄 ?? 0));
        if (c.catalogId === 'XG01' && !drawEngines(v) && !hiddenSilvers(v).length)
            score += 80;
        if (c.catalogId === 'XG01' && !drawEngines(v))
            score += 18;
        if (hasCardType(c, 'character'))
            score += c.catalogId === 'XQ28' && drawEngines(v) ? -15 : 12;
        if (c.catalogId === 'XG06' && !own(v).some(x => x.catalogId === 'XG06'))
            score += 10;
    }
    if (green(v)) {
        const factions = mine(v).loyalty?.factions ?? {}, color = c.faction?.split('·')[0];
        const desired = Math.max(1, ...mine(v).hand.map(x => x.loyalty?.[color] ?? 0));
        if (['绿', '黑'].includes(color) && (factions[color] ?? 0) < Math.min(2, desired))
            score -= 18 - 4 * (factions[color] ?? 0);
        if (c.magicDomains?.includes('心灵') && (mine(v).loyalty?.domains?.心灵 ?? 0) < 2)
            score -= 3;
    }
    return score + greenAssetBonus(v, c) + redPurpleAssetBonus(v, c) + lockingAssetBonus(v, c) + radioAssetBonus(v, c) + criminalAssetBonus(v, c) + anglicanAssetBonus(v, c) + assetComboReserve(v, c) - assetLoyaltyBenefit(v, c);
}
function hiddenCardScore(v, c) {
    const special = redPurpleHiddenScore(v, c, policyHelpers) ?? criminalHiddenScore(v, c, policyHelpers) ?? radioHiddenScore(v, c, policyHelpers);
    if (special !== undefined)
        return special;
    const strength = hiddenStrength(c, v), tempo = handValue(v, c);
    // These cards go to the deck bottom. A large comparison number does not
    // justify losing a draw engine or a card needed for the next action step.
    if (!blue(v))
        return Math.min(8, strength) * 1.25 - tempo * 2;
    const abilityPayoff = (c.hiddenAbilities ?? []).filter(a => a.kind === 'hidden-effect').length * (bloodAvailable(v) ? 4 : 1);
    return strength * 3 + abilityPayoff - tempo * 0.65;
}
function wantsOptionalHidden(v) {
    if (blue(v))
        return true;
    return spells(v) && !mine(v).markers.hidden && own(v).some(c => c.catalogId === 'WM055' && sealCount(v, c.id) >= 2) && mine(v).hand.some(c => hiddenStrength(c, v) >= 4 && handValue(v, c) <= 5);
}
function districtScore(v, d, c) {
    const region = v.districts?.[d];
    if (!region)
        return -1000;
    const eye = total(v, v.seat, d, 'investigation'), theirEye = total(v, 1 - v.seat, d, 'investigation'), star = total(v, v.seat, d, 'influence'), theirStar = total(v, 1 - v.seat, d, 'influence');
    const gainEye = icons(v, { ...c, controller: v.seat }, 'investigation'), gainStar = icons(v, { ...c, controller: v.seat }, 'influence');
    // Investigation gives another card even to a deck whose main payoff is
    // battle. Spread eyes to win additional districts rather than overstacking.
    const weights = resourcePriorities(v, policyHelpers), blade = total(v, v.seat, d, 'battle'), theirBlade = total(v, 1 - v.seat, d, 'battle'), gainBlade = icons(v, { ...c, controller: v.seat }, 'battle');
    let score = (region.points ?? 0) + weights.investigation * ((eye <= theirEye && eye + gainEye > theirEye) + Math.min(gainEye, Math.max(0, theirEye - eye)) / 6 + Math.min(gainEye, 2) / 24) + weights.influence * (star <= theirStar && star + gainStar > theirStar) + weights.battle * (blade <= theirBlade && blade + gainBlade > theirBlade) - Math.max(0, eye - theirEye - 1) - Math.max(0, star - theirStar - 1) * 0.5;
    score += matchupDistrictBonus(v, c, d, policyHelpers);
    score += Math.max(0, region.influence?.[v.seat] ?? 0) * 0.5;
    const concede = districtConcession(v, d, policyHelpers);
    if (concede > 0 && gainStar > 0)
        score -= concede + Math.min(12, gainStar * 4);
    const points = Math.max(0, (region.points ?? 0) - (region.destroyed ?? 0));
    const enemyWins = (region.influence[1 - v.seat] ?? 0) + Math.max(0, theirStar - star - (region.influence[v.seat] ?? 0)) >= region.threshold;
    const stopsEnemyWin = (region.influence[1 - v.seat] ?? 0) + Math.max(0, theirStar - star - gainStar - (region.influence[v.seat] ?? 0)) < region.threshold;
    if (enemyWins && stopsEnemyWin && contestPending(v, d, 'influence') && projectedClaimOutcome(v, 1 - v.seat, d, policyHelpers).wins)
        score += 120;
    if (c.catalogId === 'LC11' && region.traits?.includes('黄昏'))
        score += 3;
    if (c.catalogId === 'JC080')
        score += 3 - (region.influence?.[v.seat] ?? 0);
    if (spells(v) && c.catalogId === 'XG01' && c.faceDown && v.round <= 3) {
        const remaining = 5 - v.round, delta = star + gainStar - theirStar;
        // A low-threshold empty district can return the hidden engine to the deck
        // before its planned reveal, even without investing any other bodies.
        if (delta > 0 && region.influence[v.seat] + Math.max(0, delta * remaining - region.influence[1 - v.seat]) >= region.threshold)
            score -= 24;
        if (delta < 0 && region.influence[1 - v.seat] + Math.max(0, -delta * remaining - region.influence[v.seat]) >= region.threshold)
            score -= 24;
    }
    if (contestPending(v, d, 'influence')) {
        const gain = Math.max(0, star + gainStar - theirStar - (region.influence[1 - v.seat] ?? 0));
        const result = (region.influence[v.seat] ?? 0) + gain;
        score -= claimPenalty(v, d, result, c);
        if (weights.race)
            score += Math.min(result, region.threshold) * 2 + (result >= region.threshold ? 16 + points * 3 : 0);
        if (result >= region.threshold && projectedClaimOutcome(v, v.seat, d, policyHelpers).wins)
            score += 30;
    }
    if (green(v) && contestPending(v, d, 'battle')) {
        const blade = total(v, v.seat, d, 'battle'), theirBlade = total(v, 1 - v.seat, d, 'battle'), gain = icons(v, { ...c, controller: v.seat }, 'battle');
        const renown = own(v).some(x => x.district === d && !x.tapped && keyword(x, '威名')) || !c.faceDown && keyword(c, '威名');
        const partners = own(v).filter(x => x.catalogId === 'BH10').length + (c.catalogId === 'BH10' ? 1 : 0);
        const swing = blade <= theirBlade && blade + gain > theirBlade;
        const drawPayoff = own(v).filter(x => x.catalogId === 'BH11').length;
        score += swing * (renown ? 8 + Math.min(3, partners) + Math.min(2, drawPayoff) * 2 : 5) + Math.min(gain, Math.max(0, theirBlade - blade)) * 1.5 - Math.max(0, blade - theirBlade - 1) * 1.5;
        if (c.faceDown && c.catalogId === 'LC02')
            score += enemy(v).play.some(x => x.district === d && !x.faceDown && (x.effectiveDefense ?? x.defense ?? 1) <= 1) ? 3 : 0;
    }
    const threat = total(v, 1 - v.seat, d, 'battle') - total(v, v.seat, d, 'battle');
    if (threat > 0 && !c.barrierNow && !c.keywords?.includes('灵体'))
        score -= Math.min(4, threat);
    if (green(v) && c.catalogId === 'BH09' && !c.faceDown && poetPartner(v, d))
        score += 24;
    return score + libraryClaimPlacement(v, d, c, policyHelpers) + blueBattleDistrictBonus(v, c, d, policyHelpers) - earlyEngineTenurePenalty(v, c, d, policyHelpers) + redPurpleDistrictBonus(v, d, c) + lockingDistrictBonus(v, d, c) + radioDistrictBonus(v, d, c) + criminalDistrictBonus(v, d, c);
}
const districts = (v, c) => (v.districts ?? []).flatMap((d, i) => d ? [i] : []).sort((a, b) => districtScore(v, b, c) - districtScore(v, a, c) || a - b);
function battleOpportunity(v, d) {
    if (!contestPending(v, d, 'battle'))
        return 0;
    const margin = total(v, v.seat, d, 'battle') - total(v, 1 - v.seat, d, 'battle');
    if (!margin)
        return 0;
    const victim = margin > 0 ? 1 - v.seat : v.seat;
    let budget = Math.abs(margin), result = 0;
    // Barrier does not prevent combat damage. Only visible face-up bodies can
    // be valued as possible kills; an enemy hidden card's identity is unknown.
    const targets = sorted(v.players[victim].play.filter(c => c.district === d && !c.faceDown && hasCardType(c, 'character') && !c.battleDamagePrevented && !keyword(c, '永恒')), value);
    for (const c of targets) {
        const lethal = Math.max(1, (c.effectiveDefense ?? c.defense ?? 1) - (c.damage ?? 0));
        if (budget >= lethal) {
            budget -= lethal;
            result += value(c) * 3;
        }
    }
    return margin > 0 ? result : -result;
}
function mobilityScore(v, c, d) {
    // Compare alternative placements from the same board without this mover.
    // Scoring it in its original district otherwise counts its icons twice.
    const base = { ...v, players: v.players.map(p => ({ ...p, play: p.play.filter(x => x.id !== c.id) })) };
    const placed = { ...base, players: base.players.map((p, i) => i === v.seat ? { ...p, play: [...p.play, { ...c, district: d }] } : p) };
    const actions = v.districtActions?.find(x => x.district === d)?.actions ?? [];
    // Standard actions cannot be used during mobility. Account for the next
    // action phase, when the opponent can reset assets and pay a regional tap
    // cost with our character, even if it has barrier or the cost was used now.
    const enemyFunds = Math.max((enemy(v).costPool ?? 0) + enemy(v).assets.filter(a => !a.tapped).length, enemy(v).assets.length);
    const tapRisk = actions.some(a => a.tapDistrictCharacter && (a.cost ?? 0) <= enemyFunds) ? value(c) * 0.5 + icons(v, c, 'investigation') * 3 + icons(v, c, 'battle') * 2 : 0;
    return districtScore(base, d, c) + battleOpportunity(placed, d) - battleOpportunity(base, d) - tapRisk;
}
const lookup = (v, id) => board(v).find(c => c.id === id || c.faceDown && `hidden:${c.hiddenHandle}` === id) || v.players.flatMap(p => p.assets).find(c => c.id === id) || mine(v).hand.find(c => c.id === id) || v.players.flatMap(p => [...p.graveyard, ...(p.headquarters ?? [])]).find(c => c.id === id);
function orderedTargets(v, opts, good = false) {
    return sorted(opts, o => {
        if (o.id.startsWith('district:'))
            return districtScore(v, Number(o.id.slice(9)), { icons: { investigation: 1, influence: 1 } });
        const c = lookup(v, o.id) ?? o;
        return (c.controller === v.seat ? good ? 1 : -1 : good ? -1 : 1) * value(c);
    });
}
function prediction(v, cards, kind = 'predict') {
    const good = sorted(cards, c => handValue(v, c));
    const keep = c => kind !== 'investigation' && spells(v) && !drawEngines(v) && !hiddenSilvers(v).length && !mine(v).hand.some(x => x.catalogId === 'XG01') ? c.catalogId === 'XG01' || c.catalogId === 'XG22' && !matutaReady(v) || c.catalogId === 'BQ010' : handValue(v, c) > 1;
    return { top: good.filter(keep).map(c => c.id), bottom: good.filter(c => !keep(c)).map(c => c.id) };
}
function effectChoices(v, a, type = 'effect-choice') {
    const newDeck = redPurpleChoice(v, a, policyHelpers, type);
    if (newDeck)
        return newDeck;
    if (a.kind === 'criminal-murder' && !criminalBot(v)) {
        const base = { type, choiceId: a.id };
        return sorted(a.cards ?? [], c => (c.controller === v.seat ? -1 : 1) * value(c)).map(c => ({ ...base, cardId: c.id }));
    }
    if (a.kind === 'spell-copy-targets')
        return [{ type, choiceId: a.id, replacements: [] }];
    const special = type === 'effect-choice' ? (criminalChoice(v, a, policyHelpers) ?? radioChoice(v, a, policyHelpers) ?? lockingChoice(v, a, policyHelpers)) : null;
    if (special)
        return special;
    const base = { type, choiceId: a.id }, cards = a.cards ?? [], least = sorted(cards, c => handValue(v, c), false), best = sorted(cards, c => handValue(v, c));
    // This is a forced loss of one of our own permanents, rather than a
    // search/recovery choice. Preserve engines and prefer expendable bodies.
    if (a.kind === 'cq-house-seal')
        return sorted(cards, c => (c.token ? -20 : value(c) + icons(v, c, 'investigation') * 3 + (recurringEngine(c) ? 10 : 0)) - (v.sealed ?? []).filter(x => x.hostId === c.id).reduce((n, x) => n + (x.owner === v.seat ? 5 : -5), 0), false).map(c => ({ ...base, cardId: c.id }));
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    ;
    if (type === 'environment-choice') {
        const monkChoice = anglicanMonkChoice(v, a, policyHelpers, type);
        if (monkChoice)
            return monkChoice;
        // An optional exchange is library consumption, even though hand size does
        // not change. Keep the deck reserve and valuable pieces of the current plan.
        if (a.mode === 'discard-redraw')
            return [{ ...base, cardIds: least.filter(c => handValue(v, c) < 12).slice(0, Math.min(a.max ?? cards.length, libraryBudget(v, policyHelpers))).map(c => c.id) }];
        if (a.mode === 'predict')
            return [{ ...base, ...prediction(v, cards) }];
        if (a.mode === 'inspect')
            return [{ ...base, confirm: true }];
        if (['sacrifice-character', 'sacrifice-draw-defense'].includes(a.mode)) {
            const paid = sorted(cards, c => handValue(v, c) - (a.mode === 'sacrifice-draw-defense' ? (c.effectiveDefense ?? c.defense ?? 0) * 0.8 : 0), false);
            return [{ ...base, cardIds: paid.slice(0, a.max ?? 1).map(c => c.id) }];
        }
        if (a.mode === 'optional' && a.options?.some(o => o.name?.includes('隐秘对抗')))
            return [{ ...base, option: wantsOptionalHidden(v) ? 'yes' : 'no' }];
        if (a.options)
            return [...a.options].sort((x, y) => (y.ops ? regionRewardUtility(v, y.ops, policyHelpers) : 0) - (x.ops ? regionRewardUtility(v, x.ops, policyHelpers) : 0)).map(o => ({ ...base, option: o.id }));
        return [{ ...base, cardIds: best.slice(0, a.max ?? 1).map(c => c.id) }, ...cards.map(c => ({ ...base, cardIds: [c.id] })), { ...base, cardIds: [] }];
    }
    if (a.kind === 'fate-modes') {
        const available = cards.map(c => c.id), selected = available.filter(id => id === 'recover' || id === 'sacrifice' && mine(v).play.some(c => !c.faceDown && hasCardType(c, 'attachment') && value(c) < 5) || id === 'asset' && mine(v).assets.length < 4);
        return [{ ...base, modes: selected.length ? selected : [available[0]] }];
    }
    if (a.kind === 'fate-influence') {
        let left = 2;
        const allocations = cards.flatMap(o => { const amount = Math.min(left, o.count); left -= amount; return amount ? [{ id: o.id, amount }] : []; });
        return [{ ...base, allocations }];
    }
    if (['fate-sacrifice', 'fate-asset'].includes(a.kind))
        return least.map(c => ({ ...base, cardId: c.id }));
    if (['predict', 'hidden-predict', 'reality-crow-predict'].includes(a.kind))
        return [{ ...base, ...prediction(v, cards) }];
    if (a.kind === 'batch-optional-draw')
        return [{ ...base, cardId: optionalRefillUseful(v, { plan: { effect: 'draw', count: a.count ?? 1 } }, policyHelpers) ? 'yes' : 'no' }];
    if (a.kind === 'gray-tax')
        return [{ ...base, pay: pool(v) >= a.amount }, { ...base, pay: false }];
    if (a.kind === 'shoggoth-pay-honor')
        return [{ ...base, pay: (mine(v).honor ?? 0) >= 1 && mine(v).deckCount > drawReserve(v) }, { ...base, pay: false }];
    if (a.kind === 'hidden-return-order')
        return [{ ...base, cardIds: least.map(c => c.id) }];
    if (a.kind === 'batch-deter')
        return sorted(cards, c => { const d = v.districts?.[Number(c.id.slice(9))]; return (d?.points ?? 0) + (d?.influence?.[v.seat] ?? 0) * 0.5; }, false).map(c => ({ ...base, cardId: c.id }));
    if (a.kind === 'exposed')
        return [{ ...base, mode: 'remove' }, { ...base, mode: 'none' }];
    if (a.kind === 'seal-top')
        return [{ ...base, seal: libraryBudget(v, policyHelpers) >= 1 }, { ...base, seal: false }];
    if (a.kind === 'grave-cycle-repeat')
        return [{ ...base, repeat: false }];
    if (a.kind === 'guess-cost')
        return [{ ...base, number: 3 }];
    if (/inspect/.test(a.kind))
        return [{ ...base, confirm: true }];
    if (['discard-deck-phoenix', 'top-select-hand', 'batch-top-place', 'batch-expansion-top-hand', 'field-support-top-spells'].includes(a.kind))
        return [{ ...base, cardIds: best.filter(c => a.eligibleIds?.includes(c.id)).slice(0, a.max ?? 1).map(c => c.id) }];
    if (a.kind === 'secrecy-batch-deep-seal')
        return [{ ...base, cardIds: least.slice(0, a.count).map(c => c.id) }];
    if (a.kind === 'secrecy-batch-rat')
        return [...best.filter(c => a.eligibleIds?.includes(c.id)).map(c => ({ ...base, cardId: c.id })), { ...base, skip: true }];
    if (a.kind === 'green-swords-search')
        return [{ ...base, cardIds: best.slice(0, 3).map(c => c.id) }, { ...base, cardIds: [] }];
    if (a.kind === 'discard-deck-protection')
        return [...least.map(c => ({ ...base, cardId: c.id })), { ...base, skip: true }];
    if (a.kind === 'discard-deck-drink-multiple')
        return [{ ...base, cardIds: sorted(cards, c => 0).slice(0, a.max ?? 2).map(c => c.id) }];
    if (a.kind === 'discard-deck-drink')
        return [...sorted(cards, c => 0).map(c => ({ ...base, cardId: c.id })), { ...base, skip: true }];
    if (a.kind === 'grave-cycle-three')
        return [{ ...base, cardIds: least.slice(0, 3).map(c => c.id) }];
    if (a.kind === 'entropy-assets')
        return [{ ...base, cardIds: least.slice(0, a.count).map(c => c.id) }];
    if (a.kind === 'gray-subtype')
        return [{ ...base, subtype: '人类' }];
    if (a.kind === 'death-deck-upkeep')
        return [{ ...base, cardIds: least.slice(0, a.count).map(c => c.id) }];
    if (a.kind === 'death-deck-azrael-enemies') {
        let budget = a.maxPrintedCost, ids = [];
        for (const c of best)
            if (cost(c) <= budget) {
                ids.push(c.id);
                budget -= cost(c);
            }
        return [{ ...base, cardIds: ids }];
    }
    if (a.kind === 'batch-domain-reveal-time') {
        const groups = [cards.filter(c => !c.magicDomains?.length), ...['心灵', '神圣', '星辰', '死亡', '鲜血'].map(d => cards.filter(c => c.magicDomains?.includes(d)))];
        groups.sort((a, b) => b.length - a.length);
        return [{ ...base, cardIds: groups[0].map(c => c.id) }];
    }
    if (a.kind === 'batch-spells-domain') {
        if (spells(v))
            return [{ ...base, cardId: spellRelicDomain(v) }];
        const rank = d => mine(v).hand.filter(c => c.subtypes?.includes('法术') && c.magicDomains?.includes(d)).length * 2 + (d === '心灵' ? 5 : d === '星辰' ? 1 : 0);
        return sorted(cards, c => rank(c.id)).map(c => ({ ...base, cardId: c.id }));
    }
    if (a.kind === 'secrecy-batch-patrol') {
        const role = lookup(v, a.roleId), moves = nightPatrolMoves(v, role, policyHelpers, cards);
        return moves.length ? moves.map(m => ({ ...base, cardId: `district:${m.district}` })) : sorted(cards, c => districtScore(v, Number(c.id.slice(9)), role ?? { faceDown: true })).map(c => ({ ...base, cardId: c.id }));
    }
    const impact = negativeChoiceImpact(a);
    if (impact?.kind === 'wound')
        return sorted(cards, c => (impact.afterHidden ? tormentVictimCost : woundVictimCost)(v, lookup(v, c.id) ?? c, policyHelpers), false).map(c => ({ ...base, cardId: c.id }));
    if (a.kind === 'green-fire-payment')
        return [{ ...base, cardId: pool(v) >= 2 ? 'pay' : 'skip' }, { ...base, cardId: 'skip' }];
    if (a.kind === 'green-fire-target')
        return [...(pool(v) >= 2 ? orderedTargets(v, cards, true).map(o => ({ ...base, cardId: o.id })) : []), { ...base, skip: true }];
    const choices = (impact ? least : best).map(c => ({ ...base, cardId: c.id }));
    if (a.canSkip)
        choices.push({ ...base, skip: true });
    if (a.canFail)
        choices.push({ ...base, fail: true });
    // Boolean choices generated by other decks may be presented to this player.
    choices.push({ ...base, pay: false }, { ...base, use: false }, { ...base, confirm: true });
    return choices;
}
function damage(v, a) {
    let left = a.budget, allocations = [];
    const ordered = sorted(a.targets, c => value(c) / (Math.max(1, (c.effectiveDefense ?? c.defense ?? 1) - (c.damage ?? 0))));
    const add = (c, n) => {
        n = Math.min(left, n);
        if (n > 0) {
            const old = allocations.find(x => x.cardId === c.id);
            if (old)
                old.amount += n;
            else
                allocations.push({ cardId: c.id, amount: n });
            left -= n;
        }
    };
    for (const c of ordered.filter(c => c.guardRequirement > 0))
        add(c, c.guardRequirement);
    const guardsPaid = ordered.every(c => !c.guardRequirement || (allocations.find(x => x.cardId === c.id)?.amount ?? 0) >= c.guardRequirement);
    for (const c of ordered)
        if (guardsPaid || c.guardRequirement) {
            const old = allocations.find(x => x.cardId === c.id)?.amount ?? 0;
            add(c, Math.max(0, (c.effectiveDefense ?? c.defense ?? 1) - (c.damage ?? 0) - old));
        }
    if (left > 0 && ordered.length)
        add(ordered.find(c => c.guardRequirement > 0) ?? ordered[0], left);
    let convertible = a.woundBudget ?? 0;
    for (const x of allocations) {
        const target = a.targets.find(c => c.id === x.cardId);
        if (!target?.woundsPrevented) {
            x.wounds = Math.min(convertible, x.amount);
            x.amount -= x.wounds;
            convertible -= x.wounds;
        }
    }
    return { type: 'assign-damage', allocations };
}
const triggerLibraryUse = (v, a) => Math.max(libraryUse(a, v.seat, v), criminalLibraryUse(v, a), purpleLibraryUse(v, a));
function triggerLibraryBudget(v, abilities = []) {
    const budget = Math.min(libraryBudget(v, policyHelpers), criminalBot(v) ? criminalLibraryBudget(v, policyHelpers) : purpleBot(v) ? purpleLibraryBudget(v, policyHelpers) : Infinity);
    const queued = new Set((v.flow?.stack ?? []).map(a => a.id).filter(Boolean)), reserved = new Map();
    // Event-time activations may have paid and chosen targets without entering
    // the stack yet. Every entry point must reserve those draws, together with
    // this batch's mandatory draws, before selecting any optional ones.
    for (const a of [...v.pendingTriggers ?? [], ...abilities.filter(a => a.pending || a.mandatory)]) {
        if (a.controller !== v.seat || a.id && queued.has(a.id))
            continue;
        reserved.set(a.id ?? a, triggerLibraryUse(v, a));
    }
    return Math.max(0, budget - [...reserved.values()].reduce((n, use) => n + use, 0));
}
function triggers(v) {
    const candidates = [];
    for (const a of v.triggerChoices ?? []) {
        const base = { type: 'trigger-choice', triggerId: a.id }, plan = a.plan;
        if (!a.mandatory && !a.pending && (triggerLibraryUse(v, a) > triggerLibraryBudget(v) || !optionalRefillUseful(v, a, policyHelpers))) {
            candidates.push({ ...base, fire: false });
            continue;
        }
        const special = redPurpleTrigger(v, a, policyHelpers) ?? criminalTrigger(v, a, policyHelpers) ?? radioTrigger(v, a, policyHelpers);
        if (special) {
            candidates.push(...special);
            continue;
        }
        if (a.limitReached) {
            candidates.push({ ...base, fire: false });
            continue;
        }
        if (!a.mandatory && lookup(v, a.cardId)?.catalogId === 'XG01' && plan?.effect === 'draw' && !silverDrawAllowed(v)) {
            candidates.push({ ...base, fire: false });
            continue;
        }
        if (!a.mandatory && ['reputation', 'keyword-influence'].includes(a.event) && !influenceWorth(v, a.effect?.district ?? v.turn.district, a.effect?.count ?? 1)) {
            candidates.push({ ...base, fire: false });
            continue;
        }
        if (!plan) {
            if (a.effect?.kind === 'seal-from-graveyard')
                candidates.push(...rumorTriggerChoices(v, a, policyHelpers));
            else
                candidates.push({ ...base, fire: true }, { ...base, fire: false });
            continue;
        }
        if (!a.mandatory && plan.effect === 'draw' && mine(v).deckCount < (plan.count ?? 1) + drawReserve(v)) {
            candidates.push({ ...base, fire: false });
            continue;
        }
        const opts = v.abilityTargets?.[a.id] ?? [];
        if (plan.operation === 'seal-source-grave' && lookup(v, a.cardId)?.automation?.sealedSkipInvestigation) {
            candidates.push(...sorted(opts, o => investigationSealValue(v, Number(o.id.slice(9)))).filter(o => investigationSealValue(v, Number(o.id.slice(9))) > 0).map(o => ({ ...base, fire: true, targetIds: [o.id] })), { ...base, fire: false });
            continue;
        }
        if (!a.mandatory && plan.effect === 'tap' && !opts.some(o => lookup(v, o.id)?.controller === 1 - v.seat)) {
            candidates.push({ ...base, fire: false });
            continue;
        }
        if (blue(v) && plan.effect === 'reattach' && lookup(v, a.cardId)?.catalogId === 'BQ026') {
            const ids = blueBatAttachTargets(v, lookup(v, a.cardId), opts, policyHelpers);
            candidates.push(...ids.map(id => ({ ...base, fire: true, targetIds: [id] })), { ...base, fire: false });
            continue;
        }
        if (a.event === 'mobility') {
            const source = lookup(v, a.cardId);
            if (blue(v) && source) {
                const ids = blueBatMobility(v, source, opts, policyHelpers);
                if (ids) {
                    candidates.push(...ids.map(id => ({ ...base, fire: true, targetIds: [id] })), { ...base, fire: false });
                    continue;
                }
            }
            if (!source) {
                candidates.push({ ...base, fire: false });
                continue;
            }
            const host = source.catalogId === 'BQ026' && source.attachedTo ? lookup(v, source.attachedTo) : null, hostMobile = host && !host.tapped && keyword(host, '机动');
            if (source.cannotMove && !hostMobile) {
                candidates.push({ ...base, fire: false });
                continue;
            }
            const mover = hostMobile ? host : source, stay = mobilityScore(v, mover, mover.district), targets = opts.filter(o => mobilityScore(v, mover, Number(o.id.slice(9))) > stay + 1).sort((x, y) => mobilityScore(v, mover, Number(y.id.slice(9))) - mobilityScore(v, mover, Number(x.id.slice(9))));
            candidates.push(...targets.map(o => ({ ...base, fire: true, targetIds: [o.id] })), { ...base, fire: false });
            continue;
        }
        ;
        if (plan.target === 'ordered-assault') {
            const target = orderedTargets(v, opts, false)[0];
            if (target)
                candidates.push({ ...base, fire: true, targetIds: Array(plan.targetCount).fill(target.id) });
            candidates.push({ ...base, fire: false });
            continue;
        }
        if (plan.target === 'none' || plan.optionalTarget)
            candidates.push({ ...base, fire: true, targetIds: [], mode: plan.modes?.[0]?.id });
        else
            for (const o of orderedTargets(v, opts, plan.effect === 'reattach' || plan.drinkTarget || /^own-/.test(plan.target) || ['grave-to-hand', 'destroy-enemy-attached-then-barrier'].includes(plan.effect)))
                candidates.push({ ...base, fire: true, targetIds: [o.id], mode: plan.modes?.[0]?.id });
        candidates.push({ ...base, fire: false });
    }
    return candidates;
}
function tactical(v, mode = 'normal') {
    if (mode === 'normal') {
        const next = upcomingContest(v);
        if (next) {
            const projected = { ...v, turn: { ...v.turn, ...next, step: 'contest-before' } }, seen = new Set();
            return [...tactical(v, 'scores'), ...tactical(projected, 'scores')].sort((a, b) => b.score - a.score).filter(x => {
                const key = JSON.stringify(x.command);
                if (seen.has(key))
                    return false;
                seen.add(key);
                return true;
            }).map(x => x.command);
        }
    }
    const choices = [], p = v.seat, available = pool(v), standard = v.turn?.standardAllowed && v.flow.stepOwner === p && !v.flow.stack.length;
    const responses = responsePlan(v, policyHelpers), revealBudget = Math.max(reservedReveal(v), responses.ambushMana), shieldBudget = Math.max(shieldReserve(v), responses.responseMana), untapped = mine(v).assets.filter(a => !a.tapped).length, reserve = Math.max(wheelRecoveryDraw(v) ? wheelPrice(v) : 0, revealBudget + (revealBudget + shieldBudget <= untapped ? shieldBudget : Math.max(0, shieldBudget - revealBudget))), spare = Math.max(0, available - reserve);
    const add = (command, score, key, defensiveRescue = false) => {
        const source = lookup(v, command.cardId);
        if (source && ['play', 'reveal'].includes(command.type))
            score -= refillInvestmentPenalty(v, command.type === 'reveal' ? { ...source, faceDown: false } : source, policyHelpers);
        if (command.type === 'play' && source?.attachment?.target === 'district') {
            const target = command.targetIds?.find(id => id.startsWith('district:'));
            if (target) {
                const tenure = districtAttachmentTenure(v, source, Number(target.slice(9)), policyHelpers);
                if (!Number.isFinite(tenure))
                    return;
                score += tenure;
            }
        }
        const plan = command.type === 'play' ? (source?.spell ?? source?.attachment) : command.type === 'activate' ? (source?.availableActions ?? source?.automation?.actions ?? [source?.automation?.action])?.[command.actionIndex ?? 0] : command.type === 'society-action' ? { ops: v.societies?.[p]?.actions?.find(a => a.id === command.abilityId)?.ops ?? [] } : null;
        if (plan && nonDrawEffectBlocked(v) && onlyDrawEffect(plan))
            return;
        if (plan?.operation === 'mutant-seal' && mutantForfeitsWinningClaim(v, source, lookup(v, command.targetIds?.[0]), policyHelpers))
            return;
        if (plan && libraryUse({ plan }, p, v) > libraryBudget(v, policyHelpers))
            return;
        if (plan)
            score += knownMillOutcome(v, plan, policyHelpers, command.targetIds)?.bonus ?? 0;
        if (plan && !fastRemovalDue(v, source, plan, command.targetIds, policyHelpers))
            return;
        if (plan?.timing === 'fast') {
            const forecast = actionEffectForecast(v, source, plan, command.targetIds, policyHelpers, { isCard: command.type === 'play' });
            const escape = plan.effect === 'destroy' && (command.targetIds ?? []).some(id => investigationRelief(v, lookup(v, id), policyHelpers) > 0);
            if ((forecast.blocked || !defensiveRescue && !escape && (forecast.wait || forecast.urgent && !forecast.profitable)) && !imminentHandLoss(v, source))
                return;
            if (forecast.supported)
                score += Math.max(-20, Math.min(20, forecast.now * 0.4 - Math.max(0, forecast.delta)));
        }
        if (command.type === 'play' && !redPurpleDeployAllowed(v, lookup(v, command.cardId), policyHelpers))
            return;
        if (command.type === 'play' && !lockingCommandAllowed(v, lookup(v, command.cardId), command.mode))
            return;
        // Specialized tactics also generate reveals; all routes share this check.
        if (command.type === 'reveal' && v.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === command.cardId))
            return;
        score -= criminalCommitmentPenalty(v, command, policyHelpers);
        if (command.type === 'play')
            score -= lockingCommandPenalty(v, source, command, policyHelpers);
        if (source?.automation?.static === 'block-non-draw' && ['play', 'reveal'].includes(command.type))
            score += nonDrawLockValue(v, source);
        // A proactive engine removal may use its own response budget, but should
        // not silently spend the mana reserved for a staged contest ambush.
        if (standard && command.type === 'play' && plan?.actionPhaseOnly && ['destroy', 'destroy-if-sealed', 'damage', 'wound', 'shuffle-owner', 'bounce', 'return-hand', 'conceal'].includes(plan.effect) && revealBudget > 0 &&
            (command.targetIds ?? []).some(id => removalEngineTempoBonus(v, lookup(v, id), policyHelpers) > 0) &&
            (v.castingCosts?.[source.id] ?? cost(source)) > Math.max(0, available - revealBudget))
            return;
        if (standard && reserve > 0 && score < 95 && !responses.responseIds.has(command.cardId)) {
            const card = lookup(v, command.cardId);
            let spending = 0;
            if (command.type === 'play' && card)
                spending = Math.max(0, (v.castingCosts?.[card.id] ?? cost(card)) - (command.revealIds?.length ?? 0) - (command.tapIds?.length ?? 0) - (command.costIds ?? []).reduce((n, id) => n + (v.characterCosts?.[card.id]?.payments?.[id]?.reduction ?? 0), 0) - (plan?.timeCastingDiscount ? (command.timePayments ?? []).reduce((n, x) => n + x.count, 0) : 0));
            if (command.type === 'secret-deploy')
                spending = secretDeploymentPrice(v, command.district);
            if (command.type === 'activate')
                spending = (card?.availableActions ?? [])[command.actionIndex ?? 0]?.cost ?? 0;
            if (command.type === 'society-action')
                spending = v.societies?.[p]?.actions?.find(a => a.id === command.abilityId)?.cost ?? 0;
            if (command.type === 'district-action')
                spending = v.districtActions?.find(a => a.district === command.district)?.actions?.find(a => a.id === command.abilityId)?.cost ?? 0;
            if (command.type === 'zone-activate')
                spending = v.zoneActions?.find(a => a.id === command.cardId && a.actionIndex === (command.actionIndex ?? 0))?.cost ?? 0;
            if (spending > spare)
                return;
        }
        if (command.type === 'secret-deploy') {
            const deployment = secretDeploymentAssessment(v, source, command.district, policyHelpers, { ambush: responses.ambush.some(a => a.id === source?.id) });
            if (!deployment.allowed)
                return;
            score -= deployment.penalty;
            if (score <= 0)
                return;
        }
        if (score < 95 && plan && ['draw', 'draw-to-four'].includes(plan.effect) && resourcePriorities(v, policyHelpers).stocked)
            score -= 30;
        if (score < 95) {
            score -= handCommitmentPenalty(v, command, policyHelpers);
            if (score <= 0)
                return;
        }
        choices.push({ command: { ...command, ...(key ? { botActionKey: key } : {}) }, score });
    };
    if (green(v) && standard && v.turn.firstPlayer === p) {
        const society = v.societies?.[p];
        for (const a of society?.actions ?? [])
            if (a.id === 'first-draw' && !a.used && !society.tapped && available >= a.cost)
                add({ type: 'society-action', abilityId: a.id, targetIds: [] }, 4);
    }
    const silver = drawEngines(v), drawBonus = silver * 8;
    if (standard && mine(v).hand.length <= 4 && mine(v).deckCount > drawReserve(v) && v.turn.firstPlayer === p) {
        const society = v.societies?.[p];
        for (const a of society?.actions ?? [])
            if (a.id === 'first-draw' && !a.used && !society.tapped && spare >= a.cost)
                add({ type: 'society-action', abilityId: a.id, targetIds: [] }, mine(v).hand.length <= 2 ? 35 : 15);
    }
    if (spells(v) && standard && !mine(v).markers.hidden && v.sealed?.filter(c => own(v).some(a => a.catalogId === 'WM055' && a.id === c.hostId)).length >= 2) {
        for (const a of v.zoneActions ?? [])
            if (a.allowed && a.plan?.effect === 'zone-hidden-contest' && !v.bot.actionKeys?.includes(`hidden:${v.round}`) && mine(v).hand.some(c => c.id !== a.id && hiddenStrength(c, v) >= 4)) {
                const attachment = sorted(a.costCards, c => c.catalogId === 'WM055' ? 0 : value(c), false)[0];
                if (attachment)
                    add({ type: 'zone-activate', cardId: a.id, actionIndex: a.actionIndex, costIds: [attachment.id], targetIds: [] }, 20, `hidden:${v.round}`);
            }
    }
    if (blue(v) && standard && !mine(v).markers.hidden && !v.bot.actionKeys?.includes(`dragon-hidden:${v.round}`))
        for (const a of v.zoneActions ?? [])
            if (a.catalogId === 'BQ039' && a.allowed && available >= a.cost && !(v.spellTargets?.[a.id] ?? []).some(o => { const host = lookup(v, o.id); return host?.controller === p && !lethalBattleRisk(v, host, host.district); }) && mine(v).hand.some(c => c.id !== a.id && hiddenStrength(c, v) >= 7))
                add({ type: 'zone-activate', cardId: a.id, actionIndex: a.actionIndex, targetIds: [], costIds: [] }, 15, `dragon-hidden:${v.round}`);
    for (const c of own(v))
        for (const [i, a] of (c.availableActions ?? c.automation?.actions ?? (c.automation?.action ? [c.automation.action] : [])).entries()) {
            if (a.used || a.tap && c.tapped || a.timing !== 'fast' && !standard || available < (a.cost ?? 0))
                continue;
            if (c.catalogId === 'XG22' && !botLibraryHasName(v, '光能盾'))
                continue;
            const base = { type: 'activate', cardId: c.id, actionIndex: i, targetIds: [] };
            // Generate responses from the mechanics of any simple fast ability. Deck
            // specializations can still add combo lines; they do not define deadlines.
            if (a.timing === 'fast' && !['extraCost', 'costX', 'discardSelf', 'sacrificeSelf', 'sacrificeCharacter', 'sacrificeCharacters', 'sacrificeAttached', 'tapCharacters', 'timeCostX', 'sourceTimeCost', 'sourceProgressCost', 'handSealCost', 'graveSealCost', 'graveShuffleCost', 'alternativeCost', 'counterCost', 'sacrificeAssetOrPlan', 'societyShuffleCost', 'sealedBottomCost'].some(k => a[k])) {
                for (const o of v.abilityTargets?.[`${c.id}:${i}`] ?? []) {
                    const f = actionEffectForecast(v, c, a, [o.id], policyHelpers, { isCard: false });
                    if (f.urgent && f.profitable && !f.wait && f.now > Math.max(2, a.cost ?? 0))
                        add({ ...base, targetIds: [o.id] }, 96 + f.now - (a.cost ?? 0));
                }
            }
            if (blue(v)) {
                const opts = v.abilityTargets?.[`${c.id}:${i}`] ?? [], hiddenKey = `dragon-hidden:${v.round}`;
                if (c.catalogId === 'XG10' && i === 0 && cycleAllowed(v) && botLibraryHasName(v, '鲜血')) {
                    const blood = blueBloodSearch(v, c, opts, policyHelpers);
                    if (blood && !v.bot.actionKeys?.includes(`blood-search:${v.round}:${c.id}`))
                        add({ ...base, targetIds: [blood.targetId] }, blood.score, `blood-search:${v.round}:${c.id}`);
                }
                if (c.catalogId === 'XG10' && i === 1 && botLibraryHasName(v, '初拥')) {
                    const target = sorted(enemy(v).play.filter(x => opts.some(o => o.id === x.id) && !x.faceDown), value)[0];
                    if (target)
                        add({ ...base, targetIds: [target.id] }, 35 + value(target));
                }
                if (c.catalogId === 'BQ036' && standard && !v.bot.actionKeys?.includes(hiddenKey)) {
                    const contest = bluePhoenixContest(v, c, v.abilitySacrifices?.[`${c.id}:${i}`] ?? [], policyHelpers);
                    if (contest)
                        add({ ...base, costCardId: contest.costCardId }, contest.score, hiddenKey);
                }
                if (c.catalogId === 'BQ027' || a.operation === 'slave-blood-return') {
                    const drink = blueBloodSacrifice(v, c, opts, policyHelpers);
                    if (drink)
                        add({ ...base, targetIds: [drink.targetId] }, drink.score);
                }
            }
            if (c.catalogId === 'XQ32' && (c.counters?.冥想 ?? 0) >= 4 && !anglicanMeditationHold(v, c, policyHelpers))
                add({ ...base, counterCostCount: 4 }, anglicanBot(v) && (mine(v).score ?? 0) + 1 >= (mine(v).victoryThreshold ?? 8) && (mine(v).score ?? 0) + 1 > (enemy(v).score ?? 0) ? 300 : 100);
            if (spells(v) && c.catalogId === 'XG22' && ['start', 'action', 'end'].includes(v.turn.phase) && mine(v).deckCount > drawReserve(v))
                add(base, 38);
            else if (c.catalogId === 'XG22' && !mine(v).hand.some(c => c.catalogId === 'JC078') && (v.turn.phase === 'end' || standard))
                add(base, 5);
            if (spells(v) && c.catalogId === 'WM055' && standard && mine(v).markers.hidden > 0 && (v.sealed ?? []).filter(x => x.hostId === c.id).length >= 3 && recoverStorage(v, c.id))
                add(base, 21);
            if (!anglicanBot(v) && c.catalogId === 'XQ29' && v.turn.step === 'contest-before' && v.turn.kind === 'investigation' && c.district === v.turn.district && !c.tapped)
                add(base, 10);
            if (green(v) && c.catalogId === 'BH07' && v.turn.step === 'contest-before' && v.turn.kind === 'battle' && c.district === v.turn.district) {
                const ours = total(v, p, c.district, 'battle'), theirs = total(v, 1 - p, c.district, 'battle');
                if (ours <= theirs && ours + 1 >= theirs && !v.bot.actionKeys?.includes(`boxer:${v.round}:${c.id}`))
                    add(base, 35, `boxer:${v.round}:${c.id}`);
            }
            if (green(v) && c.catalogId === 'WM011' && (standard && mine(v).hand.some(x => loyalty(v, x) && !duplicate(v, x) && x.castAllowed !== false) || available === 1 && mine(v).hand.some(x => x.catalogId === 'JZ55') && enemy(v).play.some(x => x.unique)))
                add(base, 65);
            if (green(v) && c.catalogId === 'XG28' && standard && !v.bot.actionKeys?.includes(`retrieve:${v.round}:${c.id}`))
                for (const o of orderedTargets(v, v.abilityTargets?.[`${c.id}:${i}`] ?? v.abilityTargets?.[c.id] ?? [], true))
                    add({ ...base, targetIds: [o.id] }, 12 + value(lookup(v, o.id)) - mine(v).hand.length, `retrieve:${v.round}:${c.id}`);
        }
    const protection = board(v).filter(c => c.controller === p && !c.faceDown && hasCardType(c, 'character'));
    for (const c of mine(v).hand) {
        if (c.castAllowed === false || duplicate(v, c) && !storageReplacement(v, c))
            continue;
        const plan = c.spell ?? c.attachment;
        if (plan) {
            if (!loyalty(v, c))
                continue;
            if (plan.timing !== 'fast' && !standard || plan.actionPhaseOnly && v.turn.phase !== 'action')
                continue;
            const taps = v.abilityTaps?.[c.id] ?? [], required = v.castingCosts?.[c.id] ?? cost(c), tapCount = plan.tapCharacters?.reduceCost ? Math.max(0, required - available) : 0;
            if (tapCount > taps.length || required - tapCount > available)
                continue;
            const rescue = spellSilverRescue(v, c, v.spellTargets?.[c.id] ?? [], policyHelpers);
            const urgentHand = imminentHandLoss(v, c), urgentProtection = (v.spellTargets?.[c.id] ?? []).some(o => actionEffectForecast(v, c, plan, [o.id], policyHelpers, { isCard: true }).urgent), urgentDefense = rescue.length > 0 || ['WM008', 'XQ04', 'JZ05'].includes(c.catalogId) && v.flow.stack.some(a => a.controller !== p && a.targetIds?.some(id => keyRole(lookup(v, id)) && lookup(v, id)?.controller === p)), urgentRefill = spells(v) && c.catalogId === 'XQ02' && standard && (mine(v).deckCount <= 6 || wheelDisruptionPending(v)), rescueWheel = spells(v) && c.catalogId === 'XG03' && standard && !wheelInHand(v) && !wheelInDeck(v) && mine(v).assets.some(a => a.catalogId === 'XQ02');
            const urgentGrave = spells(v) && plan.effect === 'grave-bottom-draw' && (v.spellTargets?.[c.id] ?? []).some(o => pendingGraveyardUse(v, o.id) && spellFuneralScore(v, c, lookup(v, o.id), policyHelpers) !== null);
            if ((standard || revealBudget > 0 || shieldBudget > 0) && required - tapCount > spare && !responses.responseIds.has(c.id) && !(c.catalogId === 'JC078' && shieldBudget) && !urgentHand && !urgentProtection && !urgentDefense && !urgentRefill && !rescueWheel && !urgentGrave)
                continue;
            const tapIds = sorted(taps, x => value(x), false).slice(0, tapCount).map(x => x.id), opts = v.spellTargets?.[c.id] ?? [], base = { type: 'play', cardId: c.id, tapIds };
            for (const action of rescue)
                add({ ...base, targetIds: [action.targetId] }, action.score, undefined, true);
            if (plan.timing === 'fast' && !plan.targetCount && !plan.targetSlots && !plan.modeTargets)
                for (const o of opts) {
                    if (targetedByUs(v, o.id))
                        continue;
                    const f = actionEffectForecast(v, c, plan, [o.id], policyHelpers, { isCard: true });
                    if (f.supported && !f.blocked && !f.wait && (urgentHand || f.urgent && f.profitable) && f.now > Math.max(2, required * 0.8))
                        add({ ...base, targetIds: [o.id] }, 108 + f.now - required);
                }
            if (plan.effect === 'destroy')
                for (const o of opts) {
                    const victim = lookup(v, o.id), relief = investigationRelief(v, victim, policyHelpers);
                    if (relief && !targetedByUs(v, o.id))
                        add({ ...base, targetIds: [o.id] }, relief - value(victim) * 2 - required);
                }
            if (spells(v) && plan.effect === 'grave-bottom-draw') {
                for (const o of opts) {
                    const score = spellFuneralScore(v, c, lookup(v, o.id), policyHelpers);
                    if (score !== null && !targetedByUs(v, o.id))
                        add({ ...base, targetIds: [o.id] }, score);
                }
                continue;
            }
            if (plan.gunfireNegotiation) {
                for (const d of opts.filter(o => o.slot === 'district')) {
                    const ds = Number(d.id.slice(9)), victims = opts.filter(o => o.slot === 'hidden' && o.district === ds && o.controller !== p).slice(0, 2);
                    for (const m of plan.modes ?? [])
                        if (m.id !== 'destroy' || victims.length)
                            add({ ...base, mode: m.id, targetIds: [d.id, ...(m.id === 'police' ? [] : victims.map(o => o.id))] }, (m.id === 'police' ? 8 : 20 * victims.length) + (m.id === 'destroy' ? 0 : districtScore(v, ds, c)));
                }
                continue;
            }
            if (blue(v) && standard && plan.effect === 'attach') {
                const target = c.catalogId === 'JC036' ? null : sorted(own(v).filter(x => opts.some(o => o.id === x.id) && hasCardType(x, 'character')), x => blueAttachmentScore(v, c, x, policyHelpers))[0];
                if (target)
                    add({ ...base, targetIds: [target.id] }, 24 + value(target) * 0.4 + own(v).filter(x => x.catalogId === 'BQ030').length * 12 + (c.catalogId === 'JC036' ? 0 : 5));
                if (c.catalogId === 'JC036')
                    for (const o of opts) {
                        const x = lookup(v, o.id);
                        if (x?.controller !== p && !x.faceDown)
                            add({ ...base, targetIds: [o.id] }, 45 + value(x));
                    }
            }
            if (blue(v) && standard && c.catalogId === 'JC034' && opts.some(o => o.id === `society:${p}`)) {
                const score = blueHeartPathPlayScore(v, policyHelpers);
                if (score !== undefined)
                    add({ ...base, targetIds: [`society:${p}`] }, score);
            }
            if (c.catalogId === 'XQ32' && standard)
                add({ ...base, targetIds: [`society:${p}`] }, 30);
            if (spells(v) && standard) {
                if (c.catalogId === 'XG06')
                    add({ ...base, targetIds: [`society:${p}`] }, own(v).filter(x => x.catalogId === 'XG06' && !x.tapped).length < 2 ? 80 : wantsStarRelic(v) ? 82 : 38);
                if (c.catalogId === 'WM055' && (!own(v).some(x => x.catalogId === 'WM055') || storageReplacement(v, c)))
                    add({ ...base, targetIds: [`society:${p}`] }, storageReplacement(v, c) ? 58 + Math.min(12, (v.sealed ?? []).filter(x => own(v).some(a => a.catalogId === 'WM055' && a.id === x.hostId)).length * 3) : !silver ? 18 : mine(v).hand.length >= (mine(v).handLimit ?? 7) ? 88 : 44);
                if (c.catalogId === 'BQ009' && silver && cycleAllowed(v))
                    add({ ...base, targetIds: [] }, 38 + drawBonus);
                if (c.catalogId === 'WM090' && (silver && cycleAllowed(v) || !silver && mine(v).deckCount > 1))
                    add({ ...base, targetIds: [], mode: 'predict' }, silver ? 41 + drawBonus : 16);
                if (c.catalogId === 'BQ010' && cycleAllowed(v) && !(v.round >= 3 && !silver && hiddenSilvers(v).some(x => !x.paidRevealBlocked && loyalty(v, x) && (v.revealCosts?.[x.id] ?? cost(x)) <= Math.max(available, mine(v).assets.length + 1))))
                    add({ ...base, targetIds: [`player:${1 - p}`] }, 42 + drawBonus - required * 3);
                // At three relics this can be free and shuffle itself back. Refill once
                // per action step, then finish the turn rather than restarting forever.
                const refillKey = wheelRefillKey(v);
                if (c.catalogId === 'XQ02') {
                    const disrupting = wheelDisruptionPending(v), opponentScore = wheelOpponentScore(v, c);
                    if (opponentScore !== null)
                        add({ ...base, targetIds: [`player:${1 - p}`] }, opponentScore, wheelDisruptionKey(v));
                    if ((disrupting || mine(v).deckCount <= Math.max(10, silver * 4)) && mine(v).graveyard.length >= (disrupting || mine(v).deckCount <= 2 ? 1 : 3) && !v.bot.actionKeys?.includes(refillKey))
                        add({ ...base, targetIds: [`player:${p}`] }, disrupting ? 146 : urgentRefill ? 130 : 90, refillKey);
                }
                if (['JC006', 'XG03'].includes(c.catalogId))
                    for (const o of orderedTargets(v, opts)) {
                        const target = lookup(v, o.id);
                        if (target?.controller === 1 - p && !target.faceDown && !targetedByUs(v, o.id) && !keyword(target, '永恒') && (c.catalogId === 'XG03' || !target.tapped || keyRole(target)))
                            add({ ...base, targetIds: [o.id] }, (c.catalogId === 'XG03' && silver && cycleAllowed(v) ? 35 : 16) + value(target) + (target.catalogId === 'BH36' ? 25 : 0) + drawBonus - required);
                        if (rescueWheel && target?.catalogId === 'XQ02' && mine(v).assets.some(a => a.id === target.id) && !targetedByUs(v, target.id))
                            add({ ...base, targetIds: [o.id] }, 145);
                    }
            }
            if (spells(v) && c.catalogId === 'BH03') {
                const pump = spellCombatPump(v, c, opts, policyHelpers);
                if (pump)
                    add({ ...base, targetIds: [pump.targetId], mode: 'battle' }, pump.score);
            }
            if (spells(v) && standard && silver && cycleAllowed(v) && required === 0 && ['JZ05', 'JC078'].includes(c.catalogId) && !spellBlinkHold(v, c, policyHelpers)) {
                const target = sorted(protection.filter(t => opts.some(o => o.id === t.id) && !targetedByUs(v, t.id) && !(c.catalogId === 'JZ05' && contestPending(v, t.district, 'battle') && icons(v, t, 'battle') > (t.icons?.battle ?? 0) + (v.turn.firstPlayer === p ? (t.temporaryIcons?.battle ?? 0) : 0))), value)[0];
                if (target)
                    add({ ...base, targetIds: [target.id] }, 34 + drawBonus);
            }
            if (['WM008', 'XQ04'].includes(c.catalogId))
                for (const o of opts) {
                    const entry = v.flow.stack.find(a => `stack:${a.id}` === o.id);
                    if (!entry || entry.controller === p || entry.canBeTerminated === false || targetedByUs(v, o.id) || reserveCounterForFollowUp(v, entry, c, policyHelpers))
                        continue;
                    const threatened = (entry.targetIds ?? []).map(id => lookup(v, id)).filter(c => c?.controller === p);
                    const utility = threatened.reduce((n, c) => n + value(c), 0) + (entry.damageEffect ? 8 : 0) + (entry.kind === 'play-character' || entry.kind === 'reveal-character' ? 10 : 2);
                    if (utility >= 8)
                        add({ ...base, targetIds: [o.id] }, 32 + utility + drawBonus - required);
                }
            if (c.catalogId === 'BH03' && v.turn.step === 'contest-before' && v.turn.kind === 'battle') {
                const d = v.turn.district, margin = total(v, 1 - p, d, 'battle') - total(v, p, d, 'battle');
                for (const target of protection.filter(c => c.district === d && !c.tapped))
                    if (opts.some(o => o.id === target.id) && !targetedByUs(v, target.id)) {
                        if (margin >= 0 && margin < 2)
                            add({ ...base, targetIds: [target.id], mode: 'battle' }, 34 + value(target) + drawBonus);
                        else if (margin > 0 && margin <= (target.effectiveDefense ?? target.defense ?? 1) - (target.damage ?? 0) + 1 && !v.bot.actionKeys?.includes(`buff-defense:${v.round}:${target.id}`))
                            add({ ...base, targetIds: [target.id], mode: 'defense' }, 24 + value(target) + drawBonus, `buff-defense:${v.round}:${target.id}`);
                    }
            }
            if (c.catalogId === 'JC005')
                for (const o of orderedTargets(v, opts)) {
                    const target = lookup(v, o.id);
                    if (target?.controller === 1 - p && !target.faceDown && !targetedByUs(v, o.id) && !keyword(target, '永恒'))
                        add({ ...base, targetIds: [o.id] }, 14 + value(target) + drawBonus);
                    if (target && !targetedByUs(v, o.id) && !keyword(target, '永恒')) {
                        const rebuild = spellRelicRebuild(v, c, target);
                        if (rebuild !== null)
                            add({ ...base, targetIds: [o.id] }, rebuild);
                    }
                    if (spells(v) && standard && silver && cycleAllowed(v) && target?.controller === p && target.catalogId === 'WM055' && !keyword(target, '永恒') && !targetedByUs(v, o.id)) {
                        const recovered = (v.sealed ?? []).filter(x => x.hostId === target.id && x.owner === p && x.subtypes?.includes('法术'));
                        const replacement = mine(v).hand.some(x => x.catalogId === 'WM055' && x.castAllowed !== false && loyalty(v, x) && (v.castingCosts?.[x.id] ?? cost(x)) <= spare);
                        if (recovered.length >= 3 && !replacement && recoverStorage(v, target.id))
                            add({ ...base, targetIds: [o.id] }, 32 + Math.min(20, recovered.length * 2) + drawBonus - required);
                    }
                }
            if (spells(v) && c.catalogId === 'JC006' && v.turn.step === 'claim-before')
                for (const o of opts) {
                    const target = lookup(v, o.id);
                    if (target?.controller === p && target.district === v.turn.district && ['XG01', 'XG22', 'BH36'].includes(target.catalogId) && !targetedByUs(v, o.id))
                        add({ ...base, targetIds: [o.id] }, 115 + value(target));
                }
            if (c.catalogId === 'JZ05')
                for (const o of orderedTargets(v, opts, true)) {
                    const target = lookup(v, o.id), hit = v.flow.stack.some(a => a.controller !== p && a.targetIds?.includes(o.id));
                    if (target?.controller === p && !targetedByUs(v, o.id) && hit && !v.bot.actionKeys?.includes(`blink:${v.round}:${o.id}`))
                        add({ ...base, targetIds: [o.id] }, 38 + value(target) + drawBonus, `blink:${v.round}:${o.id}`);
                }
            if (green(v) && c.catalogId === 'BH12' && standard)
                for (const o of opts) {
                    const score = greenEmployeeScore(v, lookup(v, o.id), policyHelpers);
                    if (score !== null)
                        add({ ...base, targetIds: [o.id] }, score);
                }
            if (green(v) && c.catalogId === 'WM019' && standard && !own(v).some(x => x.catalogId === 'WM019'))
                add({ ...base, targetIds: [`society:${p}`] }, 29);
            if (green(v) && ['BQ091', 'XG28'].includes(c.catalogId) && standard)
                for (const o of opts) {
                    const d = Number(o.id.slice(9)), existing = own(v).filter(x => x.district === d && hasCardType(x, 'attachment')).length;
                    add({ ...base, targetIds: [o.id] }, 17 + blackHandBonus(v, c) + districtScore(v, d, c) - existing * 2);
                }
            if (green(v) && c.catalogId === 'BQ020' && mine(v).deckCount > drawReserve(v))
                for (const o of opts) {
                    const x = lookup(v, o.id);
                    if (!x || targetedByUs(v, o.id))
                        continue;
                    const move = nightPatrolMoves(v, x, policyHelpers)[0];
                    if (move)
                        add({ ...base, targetIds: [o.id] }, move.score);
                }
            if (c.catalogId === 'JZ54' && !v.flow.stack.some(a => a.controller === p && a.displayName === c.name)) {
                const legal = enemy(v).play.filter(x => !x.faceDown && hasCardType(x, 'character') && !keyword(x, '永恒'));
                if (legal.length) {
                    const minimum = Math.min(...legal.map(value));
                    if (minimum >= 5 || v.turn.step === 'contest-before' && v.turn.kind === 'battle' && legal.some(x => x.district === v.turn.district) && legal.length <= 2)
                        add({ ...base, targetIds: [`player:${1 - p}`] }, 25 + minimum * 1.5);
                }
            }
            if (green(v) && c.catalogId === 'JZ55')
                for (const o of orderedTargets(v, opts)) {
                    const target = lookup(v, o.id);
                    if (target?.controller === 1 - p && !target.faceDown && !v.flow.stack.some(a => a.controller === p && a.targetIds?.includes(o.id)) && (value(target) >= 7 || v.turn.step === 'contest-before' && target.district === v.turn.district))
                        add({ ...base, targetIds: [o.id] }, 25 + value(target));
                }
            if (['BQ073', 'LC08'].includes(c.catalogId))
                for (const o of orderedTargets(v, opts)) {
                    const target = lookup(v, o.id);
                    if (target?.controller !== 1 - p || target.faceDown || keyword(target, '永恒') || v.flow.stack.some(a => a.controller === p && a.targetIds?.includes(o.id)))
                        continue;
                    const tempo = removalEngineTempoBonus(v, target, policyHelpers), danger = tempo > 0 || target.catalogId === 'JC080' || target.catalogId === 'XQ31' || !target.tapped && value(target) >= 5;
                    if (danger)
                        add({ ...base, targetIds: [o.id] }, 18 + value(target) + tempo);
                }
            if (c.catalogId === 'XQ33' && standard)
                for (const o of opts) {
                    const d = Number(o.id.slice(9)), victims = board(v).filter(c => c.district === d && !c.faceDown && (icons(v, c, 'battle') > 0)), gain = victims.reduce((n, c) => n + (c.controller === p ? -1 : 1) * value(c), 0);
                    if (gain >= 5)
                        add({ ...base, targetIds: [o.id] }, 15 + gain);
                }
            if (c.catalogId === 'JC078') {
                for (const target of threatenedEngine(v))
                    if (opts.some(o => o.id === target.id) && !targetedByUs(v, target.id) && !v.bot.actionKeys?.includes(`shield:${v.round}:${target.id}`))
                        add({ ...base, targetIds: [target.id] }, 95 + value(target), `shield:${v.round}:${target.id}`);
                if (v.turn.step === 'contest-before' && v.turn.kind === 'battle') {
                    const d = v.turn.district, threat = total(v, 1 - p, d, 'battle') - total(v, p, d, 'battle');
                    if (threat > 0)
                        for (const target of protection.filter(c => c.district === d))
                            if (opts.some(o => o.id === target.id) && !v.bot?.actionKeys?.includes(`shield:${v.round}:${target.id}`))
                                add({ ...base, targetIds: [target.id] }, 20 + value(target), `shield:${v.round}:${target.id}`);
                }
                for (const entry of v.flow.stack)
                    if (entry.controller !== p && entry.damageEffect)
                        for (const id of entry.targetIds ?? [])
                            if (protection.some(c => c.id === id) && opts.some(o => o.id === id) && !v.bot?.actionKeys?.includes(`shield:${v.round}:${id}`))
                                add({ ...base, targetIds: [id] }, 45, `shield:${v.round}:${id}`);
            }
            if (c.catalogId === 'BQ108') {
                const theirs = enemy(v).play.filter(c => hasCardType(c, 'attachment') && !c.faceDown), ours = own(v).filter(c => hasCardType(c, 'attachment'));
                if (theirs.length && (!ours.length || Math.min(...theirs.map(value)) > Math.min(...ours.map(value)) + 3))
                    add({ ...base, targetIds: [] }, 15);
            }
            continue;
        }
        if (!hasCardType(c, 'character') || !radioDeployAllowed(v, c) || !criminalDeployAllowed(v, c))
            continue;
        if (standard && loyalty(v, c) && !c.concealedOnlyNow)
            for (const x of characterSacrificePlays(v, c, policyHelpers, spare))
                add(x.command, x.score);
        if (spells(v) && c.catalogId === 'XG01' && !silver && hiddenSilvers(v).length)
            continue;
        const revealIds = c.automation?.revealHandDiscount ? mine(v).hand.filter(x => x.id !== c.id && (x.faction?.split('·')[1] === '圣贤' || x.magicDomains?.includes('神圣'))).map(x => x.id) : [], price = Math.max(0, (v.castingCosts?.[c.id] ?? cost(c)) - revealIds.length);
        const up = faceUp(v, c), activeIcons = ['investigation', 'battle', 'influence'].reduce((n, k) => n + icons(v, up, k), 0), silverSetup = spells(v) && c.catalogId === 'XG01' && v.round <= 2 && !engineCanStart(v, c), matutaSetup = (spells(v) || anglicanBot(v)) && c.catalogId === 'XG22' && !matutaReady(v), plannedAmbush = responses.ambush.some(a => a.id === c.id && !a.hidden);
        const deployments = districts(v, { ...c, faceDown: true, effectiveIcons: undefined }).map(d => secretDeploymentAssessment(v, c, d, policyHelpers, { ambush: plannedAmbush }));
        const revealPayoff = deployments.some(a => a.allowed && a.revealBenefit && a.wait <= 1);
        const employeeSetup = green(v) && districts(v, { ...c, faceDown: true, effectiveIcons: undefined }).some(d => greenEmployeeSetup(v, c, policyHelpers, d));
        const preferHidden = employeeSetup || plannedAmbush || revealPayoff || (matutaSetup ? !mine(v).markers.hidden && openingBlackBladeRisk(v) : redPurplePreferHidden(v, c) || criminalPreferHidden(v, c) || radioPreferHidden(v, c) || silverSetup || blue(v) && c.catalogId === 'BQ036' || activeIcons === 0 && reputation(up));
        // Additional engines should amplify an available spell chain, rather than
        // consume the last mana and hand card while the first engine sits idle.
        if (spells(v) && c.catalogId === 'XG01' && silver > 0 && !mine(v).hand.some(x => x.id !== c.id && spellFuel(x) && loyalty(v, x) && (v.castingCosts?.[x.id] ?? cost(x)) <= Math.max(0, spare - price)))
            continue;
        const drawSetupBonus = matutaSetup ? (spells(v) && v.round <= 2 && hiddenSilvers(v).length ? 70 : v.round <= 3 ? 48 : 28) : spells(v) && silver && c.catalogId === 'BH36' ? 24 : 0;
        const upkeepRisk = green(v) && c.catalogId === 'BH41' && !mine(v).graveyard.length && !mine(v).headquarters?.length && !own(v).some(x => ['BQ091', 'XG28'].includes(x.catalogId)) ? 12 : 0;
        if (standard && loyalty(v, c) && !c.concealedOnlyNow && !preferHidden && price <= spare)
            for (const d of districts(v, up))
                if (!lethalBattleRisk(v, up, d) && poetPlayAllowed(v, c, d))
                    add({ type: 'play', cardId: c.id, district: d, revealIds }, 12 + value(c) + districtScore(v, d, up) - price - upkeepRisk + drawSetupBonus + bluePlayBonus(v, c, policyHelpers) + blueDistrictBonus(v, up, d, policyHelpers) + enginePlayBonus(v, c) + (c.catalogId === 'BH09' && !green(v) ? 12 : 0));
        const keepYellowAsset = silverSetup && hiddenSilvers(v).length && (mine(v).loyalty?.factions?.黄 ?? 0) < 2 && !mine(v).hand.some(x => x.id !== c.id && !x.nonAssetNow && x.faction?.startsWith('黄'));
        if (standard && !keepYellowAsset && blueSecretDeployAllowed(v, c) && !mine(v).actionsUsed.secret && !mine(v).secretDeploymentBlocked && !c.publicNow && spare >= 1)
            for (const d of districts(v, { ...c, faceDown: true, effectiveIcons: undefined }))
                if (poetPlayAllowed(v, c, d) && redPurpleDeployAllowed(v, c, policyHelpers, d, true) && secretDeploymentPrice(v, d) <= spare && (c.concealedOnlyNow || preferHidden || lethalBattleRisk(v, up, d) || (c.catalogId === 'JC076' && available >= price + 1) || price > available))
                    add({ type: 'secret-deploy', cardId: c.id, district: d }, (employeeSetup ? 72 : silverSetup ? hiddenSilvers(v).length ? 55 : 90 : preferHidden || c.concealedOnlyNow ? 18 : 6) + value(c) * 0.5 + districtScore(v, d, { ...c, faceDown: true, effectiveIcons: undefined }) + (matutaSetup ? drawSetupBonus : 0) + (plannedAmbush ? 38 : 0) + blueDistrictBonus(v, c, d, policyHelpers) + blueHiddenDistrictBonus(v, c, d, policyHelpers));
    }
    for (const c of mine(v).play.filter(c => c.faceDown && !c.paidRevealBlocked && !c.automation?.noPaidReveal))
        if (!duplicate(v, c) && loyalty(v, c) && (v.revealCosts?.[c.id] ?? cost(c)) <= available && !v.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === c.id)) {
            const score = revealScore(v, c);
            if (score === null || score < 95 && !paidRevealDue(v, c, policyHelpers) && blueMobilityRevealScore(v, c, policyHelpers) === undefined && blueEngineRevealScore(v, c, policyHelpers) === undefined)
                continue;
            if (score < 95 && (v.revealCosts?.[c.id] ?? cost(c)) > spare && !responses.ambush.some(a => a.id === c.id) && !(spells(v) && c.catalogId === 'XG01' || criminalBot(v) && c.catalogId === 'WM060'))
                continue;
            add({ type: 'reveal', cardId: c.id }, score + lockingRevealBonus(v, c));
        }
    if (standard && !mine(v).actionsUsed.asset && mine(v).assets.length < 8 && (!blue(v) || mine(v).assets.length < 5 || mine(v).hand.length >= 4) && (!green(v) || mine(v).assets.length < 5 || mine(v).hand.length >= 3)) {
        const choices = sorted(mine(v).hand.filter(c => !c.nonAssetNow && lockingAssetAllowed(v, c) && !spellCombatReserve(v, c) && !assetPreservesHand(v, c, policyHelpers) && !(spells(v) && c.catalogId === 'XQ02' && !wheelInDeck(v) && mine(v).hand.filter(x => x.catalogId === 'XQ02').length === 1)), c => assetValue(v, c), false);
        const curveAsset = needsCurveAsset(v, policyHelpers);
        for (const c of choices) {
            const score = (curveAsset ? 210 : mine(v).assets.length < 3 || v.bot?.id === 'red-monastery' && mine(v).assets.length < 4 ? 100 : mine(v).assets.length < 5 ? 45 : mine(v).assets.length < 7 ? 20 : 8) - assetCommitmentPenalty(v, c);
            if (score > 0)
                add({ type: 'build-asset', cardId: c.id }, score);
        }
    }
    redPurpleTactics(v, policyHelpers, add);
    greenCarmenTactics(v, policyHelpers, add);
    criminalTactics(v, policyHelpers, add);
    anglicanTactics(v, policyHelpers, add);
    radioTactics(v, policyHelpers, add);
    lockingTactics(v, policyHelpers, add);
    if (green(v) && standard)
        for (const c of mine(v).hand.filter(c => hasCardType(c, 'character') && c.castAllowed !== false && loyalty(v, c) && !duplicate(v, c) && (v.castingCosts?.[c.id] ?? cost(c)) <= spare)) {
            const bonus = greenHandBonus(v, c) + blackHandBonus(v, c);
            if (bonus < 30)
                continue;
            for (const d of districts(v, faceUp(v, c)))
                if (!lethalBattleRisk(v, faceUp(v, c), d) && poetPlayAllowed(v, c, d))
                    add({ type: 'play', cardId: c.id, district: d }, 85 + bonus + districtScore(v, d, faceUp(v, c)));
        }
    anglicanInfluenceTactics(v, policyHelpers, add, { reservedMana: reserve, candidates: choices.map(x => x.command) });
    const sequenced = sequenceThreats(v, choices, { ...policyHelpers, freeProspect: redPurpleFreeProspect });
    return mode === 'scores' ? sequenced : sequenced.sort((a, b) => b.score - a.score).map(x => x.command);
}
function paidTriggerDraft(v, a, c, used = new Set()) {
    if (!c?.fire)
        return c ?? { triggerId: a.id, fire: false };
    const plan = a.plan ?? {}, out = { ...c }, no = () => ({ triggerId: a.id, fire: false });
    if (plan.discardCost) {
        const f = plan.discardFilter ?? {}, cards = sorted(mine(v).hand.filter(x => !used.has(x.id) && (!f.type || hasCardType(x, f.type)) && (!f.requireSubtype || x.subtypes?.includes(f.requireSubtype)) && (!f.subtypesAny || f.subtypesAny.some(t => x.subtypes?.includes(t))) && matchesCardNameFilter(x, f)), x => handValue(v, x), false);
        if (cards.length < plan.discardCost)
            return no();
        out.discardIds = cards.slice(0, plan.discardCost).map(x => x.id);
    }
    if (plan.graveSealCost || plan.graveShuffleCost) {
        const f = plan.graveSealCost ?? plan.graveShuffleCost, ids = (v.abilitySealCosts?.[a.id] ?? []).filter(x => !used.has(x.id)).slice(0, f.count).map(x => x.id);
        if (ids.length < f.count)
            return no();
        out.sealIds = ids;
    }
    for (const id of [...out.discardIds ?? [], ...out.sealIds ?? []])
        used.add(id);
    return out;
}
function triggerCostBatchCommands(v, a) {
    if (a.controller !== v.seat)
        return [];
    if (a.abilities.every(x => x.event === 'mobility'))
        return triggerRoundCommands({ ...v, triggerRound: { id: a.id, controller: v.seat, abilities: a.abilities } }).map(c => ({ ...c, type: 'trigger-cost-batch-choice', choiceId: a.id }));
    const enabled = defaultTriggerEnabled(a.abilities), used = new Set();
    let available = a.available, drawBudget = triggerLibraryBudget(v, a.abilities);
    const decisions = a.abilities.map(x => {
        const use = triggerLibraryUse(v, x), cost = x.plan?.cost ?? 0;
        const candidate = enabled[x.id] && (x.mandatory || use <= drawBudget) && cost <= available ? triggers({ ...v, triggerChoices: [x] }).find(c => c.fire) : null;
        const d = paidTriggerDraft(v, x, candidate, used);
        if (d.fire) {
            available -= cost;
            if (!x.mandatory)
                drawBudget -= use;
        }
        return d;
    });
    return [{ type: 'trigger-cost-batch-choice', choiceId: a.id, decisions, abilityIds: decisions.filter(d => d.fire).map(d => d.triggerId) }];
}
function triggerRoundCommands(v) {
    const r = v.triggerRound;
    if (r.controller !== v.seat)
        return [];
    let available = pool(v), drawBudget = triggerLibraryBudget(v, r.abilities);
    const used = new Set(), decisions = [];
    const mobilityView = blue(v) ? { ...v, players: v.players.map(p => ({ ...p, play: p.play.map(c => ({ ...c })) })) } : v, plannedMoves = new Map();
    // Plan hosts before their attached bats, then retain the ordinary reverse
    // stack ordering below. Other movers see already planned icon distributions.
    const planning = blue(v) ? [...r.abilities].sort((a, b) => Number(a.event === 'mobility' && lookup(v, a.cardId)?.catalogId === 'BQ026' && !!lookup(v, a.cardId)?.attachedTo) - Number(b.event === 'mobility' && lookup(v, b.cardId)?.catalogId === 'BQ026' && !!lookup(v, b.cardId)?.attachedTo)) : r.abilities;
    for (const a of planning) {
        if (a.pending)
            continue;
        let candidate;
        if (a.unavailable)
            candidate = { triggerId: a.id, fire: false };
        else if (a.kind === 'environment-ability') {
            const x = v.environmentTriggers.find(x => x.id === a.id);
            candidate = { triggerId: a.id, fire: (!x.requiresTarget || !!x.targetOptions.length) && regionTriggerUseful(v, a, policyHelpers), targetIds: x.requiresTarget ? [x.targetOptions[0]?.id] : [] };
        }
        else if (a.kind === 'abyss-ability') {
            const x = v.abyssTriggers.find(x => x.id === a.id), domain = x.domains.find(d => !used.has(`abyss:${a.cardId}:${d}`));
            candidate = { triggerId: a.id, fire: !!domain, domain };
            if (domain)
                used.add(`abyss:${a.cardId}:${domain}`);
        }
        else if (blue(v) && a.event === 'mobility' && lookup(v, a.cardId)?.catalogId === 'BQ026' && lookup(v, a.cardId)?.attachedTo) {
            const d = plannedMoves.get(lookup(v, a.cardId).attachedTo), target = d === undefined ? null : (v.abilityTargets?.[a.id] ?? []).find(o => o.id === `district:${d}`);
            candidate = target ? { triggerId: a.id, fire: true, targetIds: [target.id] } : { triggerId: a.id, fire: false };
        }
        else
            candidate = triggers({ ...((blue(v) && a.event === 'mobility') ? mobilityView : v), triggerChoices: [a] }).find(c => c.fire) || { triggerId: a.id, fire: false };
        const cost = a.plan?.cost ?? v.environmentTriggers?.find(x => x.id === a.id)?.cost ?? 0, key = a.plan?.oncePerRound ? a.plan.usageKey : null;
        const optionalDraw = !a.mandatory && triggerLibraryUse(v, a);
        if (optionalDraw && optionalDraw > drawBudget)
            candidate = { triggerId: a.id, fire: false };
        if (!a.mandatory && (cost > available || key && used.has(key)))
            candidate = { triggerId: a.id, fire: false };
        if (candidate.fire) {
            available -= cost;
            if (optionalDraw)
                drawBudget -= optionalDraw;
            if (key)
                used.add(key);
        }
        if (blue(v) && candidate.fire && a.event === 'mobility' && candidate.targetIds?.[0]?.startsWith('district:')) {
            const d = Number(candidate.targetIds[0].slice(9));
            plannedMoves.set(a.cardId, d);
            mobilityView.players[v.seat].play = mobilityView.players[v.seat].play.map(c => c.id === a.cardId || c.attachedTo === a.cardId && !hasCardType(c, 'character') ? { ...c, district: d } : c);
        }
        decisions.push(candidate);
    }
    const ranked = blue(v) ? [...r.abilities].sort((x, y) => (lookup(v, x.cardId)?.catalogId === 'BQ026' ? 0 : 1) - (lookup(v, y.cardId)?.catalogId === 'BQ026' ? 0 : 1)) : criminalOrder(v, r.abilities, policyHelpers);
    const command = ds => ({ type: 'trigger-round', roundId: r.id, decisions: ds, abilityIds: ranked.filter(a => a.pending || ds.find(d => d.triggerId === a.id)?.fire).map(a => a.id) });
    const fallback = decisions.map(d => r.abilities.find(a => a.id === d.triggerId).mandatory ? d : { triggerId: d.triggerId, fire: false });
    return [command(decisions), ...decisions.filter(d => d.fire && !r.abilities.find(a => a.id === d.triggerId).mandatory).map(d => command(fallback.map(x => x.triggerId === d.triggerId ? d : x))), command(fallback)];
}
export function botCommands(v) {
    const p = v.seat;
    if (!v.bot || v.bot.seat !== p || v.status === 'finished')
        return [];
    if (v.status === 'waiting')
        return v.seats[p]?.ready ? [] : [{ type: 'ready' }];
    if (v.manualRequest)
        return v.manualRequest.requester === p ? [] : [{ type: 'manual-confirm', requestId: v.manualRequest.id, accept: ['inspect', 'undo'].includes(v.manualRequest.operation) }];
    if (v.keeperChoice)
        return v.keeperChoice.controller === p ? [{ type: 'keeper-choice', choiceId: v.keeperChoice.id, skip: true }] : [];
    if (v.effectChoice?.controller === p) {
        const deckChoice = redPurpleChoice(v, v.effectChoice, policyHelpers);
        if (deckChoice)
            return deckChoice;
    }
    if (v.effectChoice?.kind === 'late-non-qs-search' && v.effectChoice.controller === p) {
        const x = v.effectChoice, c = x.cards?.[0];
        return [{ type: 'effect-choice', choiceId: x.id, ...(c ? { cardId: c.id, destination: 'hand' } : { fail: true }) }];
    }
    if (v.deathCostChoice) {
        const a = v.deathCostChoice;
        ;
        ;
        if (a.kind === 'silence-pay')
            return a.controller === p ? [{ type: 'continuous-choice', choiceId: a.id, fire: false }] : [];
        if (a.kind === 'silence-order')
            return a.controller === p ? [{ type: 'continuous-source-choice', choiceId: a.id, sourceId: a.sources[0].id }] : [];
        ;
        ;
        if (a.kind === 'mage-tap-cost')
            return a.controller === p ? [{ type: 'continuous-choice', choiceId: a.id, cardIds: a.cards.slice(0, a.max).map(c => c.id) }] : [];
        ;
        ;
        if (a.kind === 'trigger-cost-batch')
            return triggerCostBatchCommands(v, a);
        if (a.kind === 'trigger-cost') {
            if (a.controller !== p)
                return [];
            if (!a.ability.plan) {
                const x = a.ability;
                if (x.kind === 'abyss-ability') {
                    const domain = x.domains.find(d => !v.abyssUses || v.abyssUses[x.usageKeys[d]] !== v.round);
                    return [{ type: 'trigger-cost-choice', choiceId: a.id, fire: !!domain, domain }];
                }
                if (x.kind !== 'environment-ability')
                    return triggers({ ...v, triggerChoices: [x] }).map(c => ({ ...c, type: 'trigger-cost-choice', choiceId: a.id }));
                return [{ type: 'trigger-cost-choice', choiceId: a.id, fire: regionTriggerUseful(v, x, policyHelpers) && a.available >= (x.cost ?? 0) && (!x.claimMobileTarget || a.targetOptions.length > 0), targetIds: a.targetOptions.length ? [a.targetOptions[0].id] : [] }];
            }
            return triggers({ ...v, triggerChoices: [a.ability] }).map(c => ({ ...paidTriggerDraft(v, a.ability, c), type: 'trigger-cost-choice', choiceId: a.id }));
        }
        ;
        if (['well-capture', 'command-post-order', 'grave-continuous-order'].includes(a.kind))
            return a.controller === p ? [{ type: 'continuous-source-choice', choiceId: a.id, sourceId: a.sources[0].id }] : [];
        if (a.kind === 'command-post-tax')
            return a.controller === p ? [{ type: 'continuous-choice', choiceId: a.id, fire: a.available >= a.amount }] : [];
        if (a.controller !== p)
            return [];
        if (['influence-cancellation', 'influence-removal'].includes(a.kind)) {
            let left = a.count;
            const allocations = a.options.flatMap(o => { const amount = Math.min(left, o.count); left -= amount; return amount ? [{ id: o.id, amount }] : []; });
            return [{ type: 'influence-choice', choiceId: a.id, allocations }];
        }
        if (['death-destination', 'shoggoth-core-return', 'dragon-blood-seal'].includes(a.kind))
            return [{ type: 'continuous-choice', choiceId: a.id, fire: true }];
        if (a.kind === 'reset-tax')
            return [{ type: 'reset-tax-choice', choiceId: a.id, fire: a.available >= (a.total - a.paid) }];
        ;
        ;
        if (a.kind === 'draw-replacement')
            return [{ type: 'draw-replacement-choice', choiceId: a.id, sourceId: null }];
        if (a.kind === 'discard-replacement')
            return [{ type: 'discard-replacement-choice', choiceId: a.id, cardId: null }];
        return [];
    }
    if (v.triggerRound)
        return triggerRoundCommands(v);
    if (v.triggerOrderChoice) {
        const a = v.triggerOrderChoice;
        if (a.controller !== p)
            return [];
        // Stack order: upkeep goes in first, so grave-filling effects resolve first.
        const abilities = blue(v) ? [...a.abilities].sort((x, y) => (lookup(v, x.cardId)?.catalogId === 'BQ026' ? 0 : 1) - (lookup(v, y.cardId)?.catalogId === 'BQ026' ? 0 : 1)) : green(v) ? [...a.abilities].sort((x, y) => {
            const rank = t => t.name?.includes('突变食尸鬼') ? 0 : /废弃收容所|违禁品临时收容所/.test(t.name) ? 2 : 1;
            return rank(x) - rank(y);
        }) : criminalOrder(v, a.abilities, policyHelpers);
        return [{ type: 'trigger-order', choiceId: a.id, abilityIds: abilities.map(t => t.id) }];
    }
    if (v.damageChoice)
        return v.damageChoice.controller === p ? v.damageChoice.options.map(o => ({ type: 'damage-replacement', choiceId: v.damageChoice.id, replacementId: o.id })) : [];
    if (v.ruleChoice)
        return v.ruleChoice.controller === p ? [{ type: 'rule-sacrifice', choiceId: v.ruleChoice.id, cardIds: criminalRuleSacrifice(v, v.ruleChoice, policyHelpers) ?? sorted(v.ruleChoice.cards, c => value(c) - (spells(v) && c.catalogId === 'WM055' ? sealCount(v, c.id) * 20 : 0), false).slice(0, v.ruleChoice.count).map(c => c.id) }] : [];
    if (v.worldPreview)
        return [{ type: 'world-preview', bottom: false }];
    if (v.lakeClaim)
        return v.lakeClaim.winner === p ? [{ type: 'lake-claim', shuffle: lakeShouldShuffle(v, policyHelpers) }] : [];
    if (v.environmentChoice) {
        const a = v.environmentChoice;
        return a.allowed && !a.done ? effectChoices(v, a, 'environment-choice') : [];
    }
    if (v.effectChoice)
        return v.effectChoice.controller === p ? effectChoices(v, v.effectChoice) : [];
    if (v.hidden) {
        const h = v.hidden;
        if (h.step === 2 && !h.committed[p] && h.canSelect) {
            const c = sorted(mine(v).hand, c => hiddenCardScore(v, c))[0];
            return c ? [{ type: 'select-hidden', cardId: c.id }] : [];
        }
        return h.step === 7 && h.comparison.player === p ? [{ type: 'hidden-reward', reward: h.rewardKind === 'predict' ? 'predict' : secrecyReward(v, policyHelpers) }] : [];
    }
    if (v.turn?.step === 'mulligan') {
        if (v.ownMulliganDone)
            return [];
        const special = redPurpleMulligan(v, policyHelpers) ?? criminalMulligan(v, policyHelpers) ?? radioMulligan(v, policyHelpers) ?? lockingMulligan(v, policyHelpers) ?? anglicanMulligan(v, policyHelpers);
        if (special)
            return special;
        if (spells(v)) {
            const hand = mine(v).hand, keep = new Set(), silver = hand.find(c => c.catalogId === 'XG01');
            if (silver)
                keep.add(silver.id);
            if (!silver && !hand.some(c => c.catalogId === 'XG22')) {
                const relic = hand.find(c => c.catalogId === 'XG06'), yellow = sorted(hand.filter(c => !c.nonAssetNow && c.faction?.startsWith('黄')), c => handValue(v, c), false)[0];
                return [{ type: 'mulligan', cardIds: hand.filter(c => c.id !== relic?.id && c.id !== yellow?.id).map(c => c.id) }];
            }
            for (const color of ['黄', '白'])
                for (const c of sorted(hand.filter(c => !c.nonAssetNow && c.faction?.startsWith(color) && c.id !== silver?.id), c => handValue(v, c), false).slice(0, color === '黄' && silver ? 2 : 1))
                    keep.add(c.id);
            const relic = hand.find(c => c.catalogId === 'XG06');
            if (relic)
                keep.add(relic.id);
            const fuel = sorted(hand.filter(spellFuel), c => c.catalogId === 'BQ010' ? 3 : c.catalogId === 'WM090' ? 2 : c.catalogId === 'BQ009' ? 1 : 0)[0];
            if (fuel && silver)
                keep.add(fuel.id);
            const storage = hand.find(c => c.catalogId === 'WM055');
            if (storage && silver && fuel && relic)
                keep.add(storage.id);
            const eye = hand.find(c => c.catalogId === 'XQ28');
            if (eye && silver && !relic)
                keep.add(eye.id);
            const matuta = hand.find(c => c.catalogId === 'XG22');
            if (matuta)
                keep.add(matuta.id);
            return [{ type: 'mulligan', cardIds: hand.filter(c => !keep.has(c.id)).map(c => c.id) }];
        }
        if (blue(v))
            return blueMulligan(v, policyHelpers);
        if (green(v))
            return greenOpeningMulligan(v, policyHelpers);
        let keptCheap = 0;
        return [{ type: 'mulligan', cardIds: mine(v).hand.filter(c => {
                    if (hasCardType(c, 'character') && cost(c) <= 3 && keptCheap++ < 2)
                        return false;
                    return cost(c) >= 5 || c.catalogId === 'XQ33' || c.catalogId === 'BQ108';
                }).map(c => c.id) }];
    }
    if (v.turn?.step === 'recovery')
        return v.turn.discardRequired[p] > 0 ? [{ type: 'discard-excess', cardIds: sorted(mine(v).hand, c => handValue(v, c), false).slice(0, v.turn.discardRequired[p]).map(c => c.id) }] : [];
    if (v.turn?.step === 'claim-return')
        return !v.turn.returnDone[p] ? [{ type: 'return-district', cardIds: [...(v.turn.returnCardIds ?? [])].sort((a, b) => value(lookup(v, a)) - value(lookup(v, b)) || a.localeCompare(b)) }] : [];
    if (v.roundChoice) {
        const a = v.roundChoice;
        if (a.controller !== p)
            return [];
        if (a.kind === 'privilege') {
            const kind = v.turn.kind, d = v.turn.district;
            const battlePayoff = kind === 'battle' && (enemy(v).play.some(c => c.district === d && !c.faceDown && hasCardType(c, 'character')) || green(v) && own(v).some(c => c.district === d && !c.tapped && keyword(c, '威名')) || blue(v) && blueBattleDiscards(v, d, policyHelpers) > 0);
            const use = pool(v) - reservedReveal(v) >= 1 && (kind === 'investigation' || battlePayoff || kind === 'influence' && influenceWorth(v, d));
            return [{ type: 'privilege', use }];
        }
        ;
        if (a.kind === 'investigation')
            return [{ type: 'investigate', ...prediction(v, a.cards, 'investigation') }];
        if (a.kind === 'damage')
            return [damage(v, a), { type: 'assign-damage', allocations: [] }];
        return [];
    }
    if (v.environmentTriggers?.some(a => a.controller === p))
        return v.environmentTriggers.filter(a => a.controller === p).flatMap(a => [...a.targetOptions.filter(() => regionTriggerUseful(v, a, policyHelpers)).map(o => ({ type: 'environment-trigger', triggerId: a.id, fire: true, targetIds: [o.id] })), { type: 'environment-trigger', triggerId: a.id, fire: !a.requiresTarget && regionTriggerUseful(v, a, policyHelpers), targetIds: [] }, { type: 'environment-trigger', triggerId: a.id, fire: false }]);
    const triggered = triggers(v);
    if (triggered.length)
        return triggered;
    if (v.canResumeTriggerWindow && !v.pendingChoiceCount)
        return [{ type: 'resume-window' }];
    if (v.pendingChoiceCount || v.flow.locked || v.flow.priority !== p)
        return [];
    return [...tactical(v).slice(0, 10), { type: 'pass' }];
}
const policyHelpers = { influenceWorth, districtConcession, libraryHasName: botLibraryHasName, secretDeploymentPrice, mine, pool, own, value, cost, icons, sorted, handValue, assetValue, districtScore, districts, lookup, drawReserve, loyalty, duplicate, lethalBattleRisk, targetedByUs, keyword, total, contestPending, faceUp, hiddenStrength, orderedTargets };
export const botCardValue = (view, card) => handValue(view, card);
export const botAssetValue = (view, card) => assetValue(view, card);
