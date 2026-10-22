import {earlyTriggerTiming,lateTriggerTiming,refreshTriggerPrice} from './trigger-timing.mjs';
import { effectObjectsLog, paidCostsClause } from './action-log.mjs';
import { abilityDescription } from './ability-description.mjs';
import { rememberHardDeckCards, hardDeckCards } from './hard-bot-library.mjs';
import { visionCopyOptions } from './spell-copy.mjs';
import { deckWasShuffled } from './deck-shuffle-events.mjs';
import { tapCostCards } from './tap-costs.mjs';
import { sealedCastMethods, consumeSealedCast } from './bq-rules.mjs';
import { currentAssetTapped } from "./standard-shared.mjs";
import { assetDomains } from "./standard-shared.mjs";
import { actionPaymentSources, payActionFee, ownActionPayment } from './action-payment.mjs';
import { changeHonor } from './player-resources.mjs';
import { triggerCostDecision, triggerCostBatchDecision } from './death-costs.mjs';
import { deferTriggerCost, flushTriggerCosts as flushCostQueue } from './trigger-cost-queue.mjs';
import { createLateNonQsEffects } from './late-non-qs-effects.mjs';
import { createSpellCopyEffects, captureSpell } from './spell-copy.mjs';
import { createVeilLateEffects, transferableMarkers } from './veil-late-effects.mjs';
import { createFateEffects } from './fate-effects.mjs';
import { swapRegionInfluence, placeRegionInfluence, clearDistrictInfluence } from './club-influence.mjs';
import { createStarlightEffects } from './starlight-effects.mjs';
import { settleTerminatedCard } from './terminated-card.mjs';
import { setCardMarker, setCardCounters } from './counter-placement.mjs';
import { cqTriggerState } from './cq-rules.mjs';
import { createCQEffects } from './cq-effects.mjs';
import { createReverberationEffects } from './reverberation-effects.mjs';
import { createBQEffects } from './bq-effects.mjs';
import { createVeiledStatusEffects } from './veiled-status-effects.mjs';
import { handDiscardProtection } from './veiled-status-rules.mjs';
import { createVeilToolsEffects, vampireOrHidden } from './veil-tools-effects.mjs';
import { magicTargetForbidden } from './veil-tools-rules.mjs';
import { createRegionalSynergyEffects } from './regional-synergy-effects.mjs';
import { createContinuingCostEffects } from './continuing-cost-effects.mjs';
import { societyShuffleCosts, graveBottomCosts } from './continuing-cost-rules.mjs';
import { createFieldSupportEffects, controlsIndustry } from './field-support-effects.mjs';
import { participatesInContest, participatesInDistrictContest } from './contest-participation.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { createNonQsEffects } from './non-qs-effects.mjs';
import { createTimeCultEffects } from './time-cult-effects.mjs';
import { woundsPrevented, addWounds } from './wounds.mjs';
import { firstAbilitiesActive } from './green-black-rules.mjs';
import { createAttachmentToolsEffects } from './attachment-tools-effects.mjs';
import { createPredictionToolsEffects } from './prediction-tools-effects.mjs';
import { createSecrecyBatchEffects } from './secrecy-batch-effects.mjs';
import { continuingCardEffect } from './continuing-cards.mjs';
import { registerTaskDistrict, districtNumber, adjacentDistricts } from './task-districts.mjs';
import { attachmentGrantedTriggers } from './granted-triggers.mjs';
import { selectedModeIds, unusedCommandModes } from './multi-mode.mjs';
import { createShoggothEffects } from './shoggoth-effects.mjs';
import { coreRole } from './shoggoth-rules.mjs';
import { simultaneousChoice, seatChoice, choicePending, commitChoice, withSimultaneousDepartures } from './simultaneous-choice.mjs';
import { createGreenBlackEffects } from './green-black-effects.mjs';
import { beginPrediction, finishPrediction, predictionView } from './prediction.mjs';
import { matchesCardNameFilter } from './card-names.mjs';
import { establishesAttachment, attachmentSelectionOwner } from './attachment-targets.mjs';
import { createYellowGrayEffects } from './yellow-gray-effects.mjs';
import { graveCards, inGrave, graveZones, graveEventName } from './graveyard-rules.mjs';
import { createCriminalDeckEffects } from './criminal-deck-effects.mjs';
import { publicActionAllowed } from './derived.mjs';
import { createScarabEffects } from './scarab-effects.mjs';
import { createGrayEffects } from './gray-effects.mjs';
import { progressCount, hadesCosts, graveCastMethods, selectedGraveCast } from './plan-rules.mjs';
import { createEntropyEffects, wildOrDestroyed, unstableSacrificeDiscount, unstableAbilityDiscount } from './entropy-effects.mjs';
import { deathSocietyCondition, ghoulEndCondition } from './death-deck-rules.mjs';
import { createDeathDeckEffects } from './death-deck-effects.mjs';
import { canTerminate } from './holy-deck-rules.mjs';
import { createRealityDeckEffects } from './reality-deck-effects.mjs';
import { createDiscardDeckEffects } from './discard-deck-effects.mjs';
import { shieldEntryCounts, shieldCanTrigger } from './shield-markers.mjs';
import { inEffectDistrict } from './holy-deck-rules.mjs';
import { createHolyDeckEffects } from './holy-deck-effects.mjs';
import { uuid, randomValues } from './random.mjs';
import { printedRulesCard, printedRulesBlank } from './printed-rules.mjs';
import { scoredCard } from './scoring.mjs';
import { lotusFreeCast, effectiveCastPlan, lotusHasSeal, consumeContingencyCast, contingencySources } from './casting-rules.mjs';
import { noteAssaultLethal, assaultSource } from './assault.mjs';
import { observeHiddenInspection } from './card-inspection.mjs';
import { relocate, districtTraits } from './district-rules.mjs';
import { PHILOSOPHER_STONE, philosopherStoneCount, revivePhilosopherStone } from './philosopher-stone.mjs';
import { librarySearchBlocked } from './library-search.mjs';
import { canTapCard, tapCard, flushPlayerEvents } from './field-events.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { discardMany, flushDiscardBatch } from './discard-events.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { hasCardType, hasAnyCardType } from './card-types.mjs';
import { districtTimeMarkers } from './time-markers.mjs';
import { dealDamage } from './damage.mjs';
import { consumeDiscounts, batBlocksTransaction, cannotTarget, cannotFlip, sourceLive, sourceDistrictLive, sameSourceObject } from './batch-rules.mjs';
import { createBatchEffects } from './batch-effects.mjs';
import { sealHost, liveSealHost, sealedOn } from './sealing.mjs';
import { takeControl, updateControl, effectiveActions, currentSocietyName, effectiveSubtypes, cardHasKeyword, sacrificeCostBlocked, hasBarrier, playerHasBarrier, graveyardLocked, castingCost, castingDiscount, enterTapped, keywordAmount } from './derived.mjs';
import { effectiveIcons, effectiveDefense } from './rounds.mjs';
import { controllerOf, identity } from './ownership.mjs';
import { castSourceStatus } from './zone-actions.mjs';
import manifest from '../data/automation-manifest.json' with { type: 'json' };
import { comparableCardRules } from './card-text-format.mjs';
import { environmentStatus, societyPlan } from './environment-definitions.mjs';
import { RuleError, pushAbility, societyMarkers } from './core.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const plain = comparableCardRules;
// Keep the legacy key for saved rooms; both faces must enter from the graveyard.
function matchesEntrySource(s, id, def, event, loc) {
    if (!(def.graveEntryOnly || def.graveOrHiddenEntry))
        return true;
    return event === 'entry' && graveZones(s, s.cards[id].owner, id).includes(loc.entryFromZone) &&
        (!loc.faceDown || def.hiddenEntryCondition !== 'death-society' || deathSocietyCondition(s, loc.controller ?? s.cards[id].owner));
}
export function automationStatus(card) {
    const spec = manifest.find(c => c.id === card.id);
    if (!spec)
        return environmentStatus(card) ?? { implemented: false, reason: '能力尚未实现' };
    const changed = Object.keys(spec.source).filter(k => k === 'text' ? plain(card[k]) !== plain(spec.source[k]) : card[k] !== spec.source[k]);
    return changed.length ? { implemented: false, reason: `卡牌资料已修改，需重新审核：${changed.join('、')}` } : { implemented: true, plan: spec.plan, reason: '本版本已实现并通过针对性测试' };
}
export function cardPrintedCostText(card) { return String(card.printedCostText ?? manifest.find(c => c.id === card.catalogId)?.source.printedCost ?? card.printedCost ?? '-').trim() || '-'; }
export function compileSupported(cards) {
    return cards.flatMap(c => {
        const status = automationStatus(c);
        if (!status.implemented || ['society', 'district'].includes(status.plan.kind))
            return [];
        const loyalty = {}, suffix = c.cost.split('/')[1] ?? '';
        for (const symbol of suffix)
            loyalty[symbol] = (loyalty[symbol] ?? 0) + 1;
        const plan = status.plan, icons = {}, temporaryIcons = {};
        for (const [k, v] of Object.entries({ investigation: '眼', battle: '刀', influence: '星' })) {
            icons[k] = c.iconsDefense.split(`［黑${v}］`).length - 1;
            temporaryIcons[k] = c.iconsDefense.split(`［白${v}］`).length - 1;
        }
        const keywords = plan.keywords ?? (!plan.conditionalKeywords?.exposed?.includes('非资产') && /非资产/.test(plain(c.text).split(/FAQ/)[0]) ? ['非资产'] : []);
        return [{ catalogId: c.id, name: c.name, displayName: c.displayName, type: hasCardType(c, 'character') && hasCardType(c, 'attachment') ? 'character/attachment' : plan.kind === 'core-area' ? 'core-area' : plan.kind === 'character' ? 'character' : plan.kind === 'attachment' ? 'attachment' : plan.kind === 'asset' ? 'asset' : plan.kind === 'task' ? 'task/district' : 'spell', printedCost: Number.isFinite(Number(c.printedCost)) ? Number(c.printedCost) : 0, printedCostText: String(c.printedCost ?? '-').trim() || '-', faction: c.faction, unique: c.unique === 1, magicDomains: plan.allDomains ? ['心灵', '神圣', '星辰', '死亡', '鲜血'] : c.magic === '无' ? [] : [c.magic], ...(plan.allColors ? { factionColors: ['黄', '绿', '蓝', '红', '灰', '白', '黑', '紫'] } : {}), loyalty, token: !!plan.token, cannotMove: !!plan.cannotMove, noEquipment: !!plan.noEquipment, noAttachments: !!plan.noAttachments, icons, temporaryIcons, conditionalKeywords: plan.conditionalKeywords ?? {}, keywords, text: c.text, subtitle: c.subtitle, flavorText: c.flavorText, subtypes: c.typeLine.includes('-') ? c.typeLine.split('-').slice(1).join('-').split('/') : [], hiddenAbilities: plan.hidden ?? [], ...(plan.kind === 'core-area' ? { automation: plan } : plan.kind === 'character' ? { automation: plan, defense: Number(c.iconsDefense.split('/').at(-1)) || 0, icons, temporaryIcons } : plan.kind === 'attachment' ? { attachment: plan, automation: plan, ...(hasCardType(c, 'character') || plan.battleDamageable ? { defense: Number(c.iconsDefense.split('/').at(-1)) || 0 } : {}) } : plan.kind === 'asset' ? { assetAbility: plan } : plan.kind === 'task' ? { spell: plan, automation: plan } : { spell: plan, ...(plan['grave-entry'] || plan.zoneActions || plan.sealed || plan.watch ? { automation: plan } : {}) }) }];
    });
}
export function graveCycleComparison(cards) { const costs = cards.map(c => c.printedCost), domains = cards.map(c => (c.magicDomains ?? []).filter(x => ['心灵', '神圣', '星辰', '死亡', '鲜血'].includes(x))); const costsValid = costs.every(Number.isFinite), domainsPresent = domains.every(a => a.length > 0); return { draw: costsValid && new Set(costs).size === 3 || domainsPresent && domains.every((a, i) => domains.slice(i + 1).every(b => a.every(x => !b.includes(x)))), repeat: costsValid && new Set(costs).size === 1 || domainsPresent && domains[0].some(x => domains.every(a => a.includes(x))) }; }
export function createAutomationEngine(ctx) {
    const { move, conceal, announce, registerGroup, seal, setLocation, log, pay, checkLoyalty, standardAction, hasPriority, openWindow, draw, stateBased, finish, trigger, onTriggersChosen, startHidden } = ctx;
    const payCostBatch = ctx.payCostBatch ?? ((s, ids, apply) => withSimultaneousDepartures(s, ids, apply));
    const active = s => s.mode === 'automation-play';
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
    const fate = createFateEffects({ move, draw, choose, finishSpell, log });
    const lateNonQs = createLateNonQsEffects({ ...ctx, event, choose, finishSpell, options, live, shuffle, destroy, librarySearchBlocked, revealByEffect: (s, a, id) => batchEffect(s, a, { operation: 'target-direct-reveal' }, [{ cardId: id }]) });
    const veilLate = createVeilLateEffects({ move, event, choose, finishSpell, options, prepare, live, log });
    const starlight = createStarlightEffects({ ...ctx, event, choose, finishSpell, destroy });
    const cq = createCQEffects({ ...ctx, move, event, seal, choose, finishSpell, log, shuffle, librarySearchBlocked, filterCard });
    const nonQs = createNonQsEffects({ ...ctx, event, choose, finishSpell, seal, terminateTarget });
    const spellCopy = createSpellCopyEffects({ ...ctx, choose, finishSpell, options, prepare, live });
    const secrecyBatch = createSecrecyBatchEffects({ ...ctx, event, draw, choose, finishSpell, log, shuffle, seal, hurt });
    const { effect: batchEffect, choice: batchChoice, deter } = createBatchEffects({ move, conceal, setLocation, event, seal, draw, choose, finishSpell, log, filterCard, shuffle, destroy, hurt, live, pay, options, prepare, castDuringResolution: ctx.castDuringResolution });
    const holy = createHolyDeckEffects({ move, event, choose, finishSpell, log, shuffle, prepare, options, librarySearchBlocked, uuid, tapCard });
    const entropy = createEntropyEffects({ ...ctx, event, choose, finishSpell, log, shuffle, destroy, librarySearchBlocked, live, blink: (s, a, plan) => batchEffect(s, a, { ...plan, operation: 'blink' }, [{ cardId: plan.sourceId }]) });
    const deathDeck = createDeathDeckEffects({ move, event, seal, choose, finishSpell, log, shuffle, destroy, librarySearchBlocked });
    const reality = createRealityDeckEffects({ move, event, seal, draw, choose, finishSpell, log, shuffle, librarySearchBlocked, deter });
    const scarab = createScarabEffects({ ...ctx, event, choose, finishSpell, emit });
    const gray = createGrayEffects({ ...ctx, event, choose, finishSpell, shuffle, emit, options, prepare, live, destroy, hurt, librarySearchBlocked });
    const discardDeck = createDiscardDeckEffects({ ...ctx, event, choose, finishSpell, shuffle, options, prepare, uuid });
    const yellow = createYellowGrayEffects({ ...ctx, event, choose, finishSpell, shuffle, emit, options, prepare });
    const shoggoth = createShoggothEffects({ ...ctx, event, choose, finishSpell, emit, options, prepare, live, destroy, hurt, librarySearchBlocked, shuffle, deter });
    const green = createGreenBlackEffects({ ...ctx, event, choose, finishSpell, shuffle, options, destroy, librarySearchBlocked });
    const criminal = createCriminalDeckEffects({ ...ctx, event, choose, finishSpell, shuffle, options, prepare, emit, uuid, destroy, deter });
    const timeCult = createTimeCultEffects({ move, destroy, hurt, draw, event, log });
    const predictionTools = createPredictionToolsEffects({ move, choose, finishSpell, log });
    const attachmentTools = createAttachmentToolsEffects({ hurt });
    const continuingCost = createContinuingCostEffects({ deter, event, log, draw, choose, finishSpell, hurt, live });
    const veiledStatus = createVeiledStatusEffects({ seal, draw, choose, finishSpell });
    const veilTools = createVeilToolsEffects({ choose, finishSpell, move, seal, event, log, shuffle, draw, drink: (...args) => discardDeck.effect(...args) });
    const regionalSynergy = createRegionalSynergyEffects({ choose, finishSpell, conceal, draw, options, event, drink: (...args) => discardDeck.effect(...args) });
    ;
    const reverberation = createReverberationEffects({ ...ctx, event, choose, finishSpell, log, shuffle, options, prepare, live, batchEffect, librarySearchBlocked });
    const bq = createBQEffects({ ...ctx, event, choose, finishSpell, log, shuffle, options, discard, librarySearchBlocked, discardDeck });
    const fieldSupport = createFieldSupportEffects({ move, event, draw, choose, finishSpell, log, shuffle, filterCard, librarySearchBlocked });
    function actual(s, value) {
        if (typeof value !== 'string')
            return null;
        if (!value.startsWith('hidden:'))
            return value;
        return Object.keys(s.locations).find(id => s.locations[id].hiddenHandle === value.slice(7)) ?? null;
    }
    function qualifies(s, p, target, id, plan = {}) {
        if (target === 'vision-copy-role')
            return id !== plan.originalHostId && hasCardType(printedRulesCard(s, id), 'character') && qualifies(s, p, 'character', id, { ...plan, target: 'character' }) && visionCopyOptions(s, plan.copiedSpell, options).some(o => o.id === id);
        if (target === 'enemy-hidden')
            return controllerOf(s, id) !== p && qualifies(s, p, 'hidden', id, plan);
        if (target === 'district-enemy-locked-character-or-hidden')
            return controllerOf(s, id) !== p && qualifies(s, p, 'district-locked-character-or-hidden', id, plan);
        if (target === 'adjacent-enemy-character')
            return qualifies(s, p, 'enemy-character', id, plan) && adjacentDistricts(s, plan.sourceDistrict ?? s.locations[plan.sourceId]?.district).includes(s.locations[id]?.district);
        const printed = printedRulesCard(s, id), l = s.locations[id];
        if (plan.targetSubtypesAny && !plan.targetSubtypesAny.some(t => effectiveSubtypes(s, id).includes(t)))
            return false;
        if (plan.targetSubtypeOrKeyword && !plan.targetSubtypeOrKeyword.some(t => effectiveSubtypes(s, id).includes(t) || cardHasKeyword(s, id, t)))
            return false;
        if (plan.ownTarget && controllerOf(s, id) !== p || plan.requiredSubtype && !effectiveSubtypes(s, id).includes(plan.requiredSubtype))
            return false;
        if (plan.requiredKeyword && !cardHasKeyword(s, id, plan.requiredKeyword))
            return false;
        if (plan.otherHost && id === s.locations[plan.sourceId]?.attachedTo)
            return false;
        if (plan.otherTarget && sameSourceObject(s,id,plan))
            return false;
        if (plan.requiredSubtitle && printed?.subtitle !== plan.requiredSubtitle)
            return false;
        if (!printed || !l || !plan.nonTargeted && cannotTarget(s, id, { ...plan, attachmentPlay: plan.attachmentPlay || establishesAttachment(plan) }) || plan.transaction && (printed.automation?.transactionUntargetable || batBlocksTransaction(s, id, s.cards[plan.cardId]?.owner ?? p)))
            return false;
        const c = { ...printed, magicDomains: effectiveMagicDomains(s, id), subtypes: effectiveSubtypes(s, id) }, barrierBlocked = controllerOf(s, id) !== attachmentSelectionOwner(s, p, plan) && (!plan.nonTargeted || establishesAttachment(plan)) && hasBarrier(s, id);
        // Apply barrier before specialized target branches return. Non-targeted
        // choices and attachment ownership are already accounted for above.
        if (barrierBlocked || magicTargetForbidden(s, id, plan))
            return false;
        if (plan.demosX && plan.chosenX !== undefined && c.printedCost > 2 * plan.chosenX)
            return false;
        if (target === 'own-character-and-district')
            target = 'own-character';
        if (target === 'own-character-or-industry')
            return l.zone === 'play' && !l.faceDown && controllerOf(s, id) === p && (hasCardType(c, 'character') && !c.noAttachments || hasCardType(c, 'attachment') && c.subtitle === '圣甲虫产业') && !barrierBlocked;
        if ((['graveyard', 'headquarters'].includes(l.zone) || l.zone === 'play' && l.faceDown) && barrierBlocked)
            return false;
        if (inGrave(s, id, plan.sourceId ?? plan.cardId ?? p) && graveyardLocked(s, plan.sourceId ?? plan.cardId ?? p, c.owner))
            return false;
        if (plan.hiddenSubtype && !effectiveSubtypes(s, id).includes(plan.hiddenSubtype))
            return false;
        if (target === 'investigation-character')
            return l.zone === 'play' && !l.faceDown && hasCardType(c, 'character') && effectiveIcons(s, id, true).investigation > 0 && !barrierBlocked;
        if (target === 'district-magic-character')
            return l.zone === 'play' && !l.faceDown && hasCardType(c, 'character') && l.district === plan.sourceDistrict && c.magicDomains.length > 0 && !barrierBlocked;
        if (target === 'deja-sealed')
            return false;
        if (target === 'own-society-sealed')
            return l.zone === 'sealed' && sealedOn(s, `society:${p}`).includes(id);
        if (target === 'permanent-and-district')
            target = 'role-or-attachment';
        if (target === 'character-and-district')
            target = 'character';
        if (target === 'disaster-and-district')
            return qualifies(s, p, 'filtered-character', id, { ...plan, filter: { requireSubtype: '灾难' } });
        if (target === 'district-role-or-attachment') {
            if (l.district !== plan.sourceDistrict)
                return false;
            target = 'role-or-attachment';
        }
        if (target === 'non-core-character' && (!hasCardType(c, 'character') || coreRole(s, id, p)))
            return false;
        if (target === 'own-core')
            return l.zone === 'play' && !l.faceDown && coreRole(s, id, p) && !barrierBlocked;
        if (target === 'core-or-tentacle')
            return l.zone === 'play' && !l.faceDown && controllerOf(s, id) === p && (coreRole(s, id, p) || c.name === '触手') && !barrierBlocked;
        if (target === 'core-district-character')
            return l.zone === 'play' && !l.faceDown && hasCardType(c, 'character') && s.players[p].play.some(x => s.locations[x].district === l.district && !s.locations[x].faceDown && (coreRole(s, x, p) || s.cards[x].name === '触手')) && !barrierBlocked;
        if (target === 'enemy-society-attachment')
            return l.zone === 'play' && !l.faceDown && hasCardType(c, 'attachment') && l.attachedTo === `society:${1 - p}` && !barrierBlocked;
        if (target === 'characters-up-to-two')
            return l.zone === 'play' && !l.faceDown && hasCardType(c, 'character') && !barrierBlocked;
        if (target === 'spike-control')
            return l.zone === 'play' && !l.faceDown && hasCardType(c, 'character') && controllerOf(s, id) !== p && (l.markers ?? 0) >= 3 && !barrierBlocked;
        if (target === 'plan' || target === 'own-plan')
            return l.zone === 'play' && !l.faceDown && (l.secretPlan || hasCardType(c, 'attachment') && c.subtypes.includes('计划')) && (target !== 'own-plan' || controllerOf(s, id) === p) && !barrierBlocked;
        if (target === 'own-industry')
            return l.zone === 'play' && !l.faceDown && controllerOf(s, id) === p && hasCardType(c, 'attachment') && c.subtitle === '圣甲虫产业';
        if (['untapped-asset', 'tapped-asset'].includes(target))
            return l.zone === 'asset' && !barrierBlocked && currentAssetTapped(s, id) === (target === 'tapped-asset');
        if (target === 'own-asset')
            return l.zone === 'asset' && controllerOf(s, id) === p;
        if (target === 'own-grave-filtered')
            return inGrave(s, id, plan.sourceId ?? plan.cardId ?? p) && c.owner === p && filterCard({ ...c, subtypes: effectiveSubtypes(s, id) }, plan.filterTarget ?? plan.filter);
        if (target === 'sadikin-pair')
            return inGrave(s, id, plan.sourceId ?? plan.cardId ?? p) && c.owner === p && c.name === '无名尸体' || l.zone === 'play' && !l.faceDown && controllerOf(s, id) === p && hasCardType(c, 'attachment') && c.subtypes.includes('研究');
        if (target === 'own-grave-attachment')
            return inGrave(s, id, plan.sourceId ?? plan.cardId ?? p) && c.owner === p && hasCardType(c, 'attachment') && filterCard(c, plan.filter);
        if (target === 'grave-character')
            return inGrave(s, id, plan.sourceId ?? plan.cardId ?? p) && hasCardType(c, 'character');
        if (target === 'graveyard')
            return inGrave(s, id, plan.sourceId ?? plan.cardId ?? p);
        if (target === 'own-grave-host-character')
            return inGrave(s, id, plan.sourceId ?? plan.cardId ?? p) && c.owner === p && hasCardType(c, 'character') && effectiveSubtypes(s, id).includes('宿主');
        if (target === 'own-grave-plans')
            return inGrave(s, id, plan.sourceId ?? plan.cardId ?? p) && c.owner === p && effectiveSubtypes(s, id).some(x => ['计划', '任务', '命令'].includes(x));
        if (target === 'own-grave-cheap-character')
            return inGrave(s, id, plan.sourceId ?? plan.cardId ?? p) && c.owner === p && hasCardType(c, 'character') && c.printedCost <= (effectiveSocietyMarkers(s, p).hidden > 0 ? 5 : 3);
        if (target === 'own-grave-character')
            return inGrave(s, id, plan.sourceId ?? plan.cardId ?? p) && c.owner === p && hasCardType(c, 'character');
        if (target === 'seal-host' || target === 'cheap-character-or-attachment') {
            if (l.zone !== 'play' || l.faceDown || !hasAnyCardType(c, ['character', 'attachment']) || barrierBlocked)
                return false;
            return target === 'seal-host' || c.printedCost <= effectiveSocietyMarkers(s, p).hidden + 1;
        }
        if (target === 'locked-character-or-hidden' || target === 'district-locked-character-or-hidden') {
            if (!(l.counters?.locked > 0) || target === 'district-locked-character-or-hidden' && l.district !== plan.sourceDistrict)
                return false;
            target = 'character-or-hidden';
        }
        if (target === 'district-character-or-hidden' || target === 'district-any-character-or-hidden') {
            if (l.zone !== 'play' || l.district !== plan.sourceDistrict || target === 'district-character-or-hidden' && sameSourceObject(s,id,plan))
                return false;
            if (l.faceDown)
                return !s.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === id);
            return hasCardType(c, 'character') && !(barrierBlocked);
        }
        if (target === 'two-roles-or-attachments')
            target = 'role-or-attachment';
        if (target === 'marked-permanent') {
            if (l.zone !== 'play' || !l.faceDown && !hasAnyCardType(c, ['character', 'attachment']) || !l.faceDown && barrierBlocked)
                return false;
            return (l.markers ?? 0) > 0 || (l.wounds ?? 0) > 0 || Object.entries(l.counters ?? {}).some(([k, n]) => k !== '势力' && Number.isFinite(n) && n > 0);
        }
        if (target === 'encounter-characters')
            return l.zone === 'play' && !l.faceDown && hasCardType(c, 'character') && !c.cannotMove && !barrierBlocked;
        if (target === 'role-attachment-or-district')
            target = 'role-or-attachment';
        if (target === 'role-or-attachment' && plan.exactPrintedCost !== undefined && c.printedCost !== plan.exactPrintedCost)
            return false;
        if (target === 'role-or-attachment')
            return l.zone === 'play' && !l.faceDown && hasAnyCardType(c, ['character', 'attachment']) && !barrierBlocked;
        if (target === 'district-own-role-or-hidden') {
            if (l.zone !== 'play' || l.district !== plan.sourceDistrict || controllerOf(s, id) !== p)
                return false;
            return l.faceDown || hasCardType(c, 'character');
        }
        if (target === 'own-sergei-hunter')
            return !barrierBlocked && void 0;
        if (target === 'district-own-other-character')
            return (true || !c.noAttachments && !c.noEquipment && (s.cards[plan.sourceId]?.owner === controllerOf(s, id) || !hasBarrier(s, id)) && (!c.automation?.allowedAttachmentSubtypes || effectiveSubtypes(s, plan.sourceId).some(t => c.automation.allowedAttachmentSubtypes.includes(t)))) && l.zone === 'play' && !l.faceDown && l.district === plan.sourceDistrict && controllerOf(s, id) === p && !sameSourceObject(s,id,plan) && hasCardType(c, 'character') && !barrierBlocked;
        if (target === 'filtered-attachment')
            return l.zone === 'play' && !l.faceDown && hasCardType(c, 'attachment') && filterCard(c, plan.filter) && !barrierBlocked;
        if (target === 'own-attachment')
            return l.zone === 'play' && !l.faceDown && controllerOf(s, id) === p && hasCardType(c, 'attachment');
        if (target === 'attachment')
            return l.zone === 'play' && !l.faceDown && hasCardType(c, 'attachment') && !barrierBlocked;
        if (target === 'society-or-source-district-attachment')
            return l.zone === 'play' && !l.faceDown && hasCardType(c, 'attachment') && (l.attachedTo?.startsWith('society:') || l.attachedTo === `district-host:${plan.sourceDistrictCardId}`);
        if (target === 'attachment-conditional-host')
            return l.zone === 'play' && !l.faceDown && hasCardType(c, 'attachment') && (s.players[p].assets.some(a => a.magicDomains?.includes('心灵')) || hasCardType(s.cards[l.attachedTo], 'character'));
        if (target === 'magic-role-attachment-or-asset')
            return c.magicDomains.length > 0 && qualifies(s, p, 'role-attachment-or-asset', id, plan);
        if (target === 'echo-ordered-permanents')
            target = 'role-attachment-or-asset';
        if (target === 'own-society-or-human-character')
            target = 'human-character';
        if (target === 'role-attachment-or-asset')
            return (l.zone === 'asset' || l.zone === 'play' && !l.faceDown && hasAnyCardType(c, ['character', 'attachment'])) && !barrierBlocked;
        if (target === 'attachment-or-asset')
            return (l.zone === 'asset' || l.zone === 'play' && !l.faceDown && hasCardType(c, 'attachment')) && !barrierBlocked;
        if (target === 'enemy-character-or-hidden')
            return l.zone === 'play' && controllerOf(s, id) !== p && (l.faceDown || hasCardType(c, 'character') && !barrierBlocked);
        if (target === 'own-character-or-hidden')
            return l.zone === 'play' && controllerOf(s, id) === p && (l.faceDown || hasCardType(c, 'character'));
        if (target === 'hidden-or-secret-plan')
            return l.zone === 'play' && (l.faceDown || l.secretPlan) && !barrierBlocked && !s.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === id);
        if (target === 'own-hidden')
            return l.zone === 'play' && l.faceDown && controllerOf(s, id) === p && !s.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === id);
        if (target === 'hidden')
            return l.zone === 'play' && l.faceDown && !s.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === id);
        if (target === 'district-hidden')
            return l.zone === 'play' && l.faceDown && l.district === plan.sourceDistrict && !s.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === id);
        if (target === 'character-or-hidden' && l.zone === 'play' && l.faceDown)
            return !s.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === id);
        if (target === 'hidden-up-to-two')
            return l.zone === 'play' && l.faceDown && !s.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === id);
        if (l.zone !== 'play' || l.faceDown || !hasCardType(c, 'character'))
            return false;
        if (barrierBlocked)
            return false;
        if (['attach', 'reattach'].includes(plan.effect) || plan.operation === 'attach-modal') {
            const attachmentId = plan.cardId ?? plan.sourceId, subtypes = effectiveSubtypes(s, attachmentId), allowed = c.automation?.allowedAttachmentSubtypes;
            if (c.noAttachments || c.noEquipment && subtypes.includes('装备') || allowed && !subtypes.some(t => allowed.includes(t)))
                return false;
        }
        if (target === 'other-subtitle-character')
            return !sameSourceObject(s,id,plan) && c.subtitle === plan.subtitle;
        if (target === 'unique-character')
            return !!c.unique;
        if (target === 'ordered-assault')
            return l.district === plan.sourceDistrict;
        if (target === 'own-human-character')
            return controllerOf(s, id) === p && c.subtypes?.includes('人类');
        if (target === 'own-filtered-character')
            return controllerOf(s, id) === p && filterCard({ ...c, subtypes: effectiveSubtypes(s, id) }, plan.filterTarget ?? plan.filter);
        if (target === 'filtered-character')
            return filterCard({ ...c, subtypes: effectiveSubtypes(s, id) }, plan.filter);
        if (target === 'district-eye-character')
            return l.district === plan.sourceDistrict && effectiveIcons(s, id, true).investigation > 0;
        if (target === 'nonhuman-character')
            return !effectiveSubtypes(s, id).includes('人类') && (!plan.excludeAngel || !effectiveSubtypes(s, id).includes('天使'));
        if (target === 'district-other-character')
            return l.district === plan.sourceDistrict && !sameSourceObject(s,id,plan);
        if (target === 'district-filtered-character')
            return l.district === plan.sourceDistrict && filterCard({ ...c, subtypes: effectiveSubtypes(s, id) }, plan.filter);
        if (target === 'own-district-character')
            return controllerOf(s, id) === p && l.district === plan.sourceDistrict;
        if (target === 'own-character')
            return controllerOf(s, id) === p;
        if (target === 'district-tapped-character')
            return !!l.tapped && l.district === plan.sourceDistrict;
        if (target === 'tapped-character')
            return !!l.tapped;
        if (target === 'battle-icon-character')
            return effectiveIcons(s, id, true).battle > 0;
        if (target === 'source-district-cheap-character')
            return l.district === plan.sourceDistrict && c.printedCost <= plan.maxCost;
        if (target === 'district-enemy-character')
            return controllerOf(s, id) !== p && l.district === plan.sourceDistrict && filterCard(c, plan.filter);
        if (target === 'enemy-character')
            return controllerOf(s, id) !== p;
        if (target === 'enemy-nonhuman-cost-three')
            return controllerOf(s, id) !== p && !effectiveSubtypes(s, id).includes('人类') && c.printedCost >= 3;
        if (target === 'other-character')
            return id !== s.locations[plan.sourceId]?.attachedTo;
        if (target === 'ghost-or-death-character')
            return effectiveSubtypes(s, id).includes('阴魂') || effectiveMagicDomains(s, id).includes('死亡');
        if (target === 'blood-or-death-character')
            return effectiveMagicDomains(s, id).some(x => ['鲜血', '死亡'].includes(x));
        if (target === 'district-vampire-character')
            return l.district === plan.sourceDistrict && effectiveSubtypes(s, id).includes('吸血鬼');
        if (target === 'vampire-character')
            return effectiveSubtypes(s, id).includes('吸血鬼');
        if (target === 'human-or-vampire')
            return effectiveSubtypes(s, id).some(x => ['人类', '吸血鬼'].includes(x));
        if (target === 'district-human')
            return l.district === plan.sourceDistrict && effectiveSubtypes(s, id).includes('人类');
        if (target === 'district-other-magic-character')
            return !sameSourceObject(s,id,plan) && l.district === plan.sourceDistrict && !!c.magicDomains?.length;
        if (target === 'magic-character')
            return !!c.magicDomains?.length;
        if (target === 'printed-human-character')
            return printed.subtypes?.includes('人类') ?? false;
        if (target === 'source-district-nonhuman-character')
            return l.district === plan.sourceDistrict && !c.subtypes.includes('人类');
        if (target === 'onmyoji-character')
            return c.subtypes?.includes('阴阳师') ?? false;
        if (target === 'human-character')
            return c.subtypes?.includes('人类') ?? false;
        if (target === 'district-defense-three')
            return l.district === plan.sourceDistrict && effectiveDefense(s, id) >= 3;
        if (target === 'district-character')
            return l.district === plan.sourceDistrict;
        if (target === 'own-other-character')
            return controllerOf(s, id) === p && !sameSourceObject(s,id,plan);
        if (target === 'own-other-district-character')
            return controllerOf(s, id) === p && !sameSourceObject(s,id,plan) && l.district === plan.sourceDistrict;
        return ['character', 'character-or-hidden', 'non-core-character'].includes(target);
    }
    function stackTargetLegal(s, a, target) {
        if (target === 'stack-effect')
            return !a.kind.startsWith('rule-');
        if (target === 'stack-character')
            return a.kind === 'play-character' && s.locations[a.cardId]?.zone === 'stack';
        if (target === 'stack-own-command')
            return a.kind === 'play-spell' && hasCardType(s.cards[a.cardId], 'spell') && s.cards[a.cardId].subtypes?.includes('命令') && plain(s.cards[a.cardId].text).includes('选择一项') && a.plan?.modes?.length > 1 && unusedCommandModes(a).length > 0 && s.locations[a.cardId]?.zone === 'stack';
        if (target === 'stack-role-ability') {
            const id = a.cardId ?? a.sourceId, l = s.locations[id];
            const version = a.plan?.sourceZoneVersion ?? a.sourceZoneVersion;
            return (version === undefined || version === l?.zoneVersion) && !['play-spell', 'play-character', 'reveal-character', 'rule-return-aside', 'rule-region-return'].includes(a.kind) && l?.zone === 'play' && !l.faceDown && hasCardType(printedRulesCard(s, id), 'character');
        }
        return (target === 'stack-card' ? ['play-spell', 'play-character', 'reveal-character'].includes(a.kind) : a.kind === 'play-spell') && (a.kind === 'reveal-character' ? s.locations[a.cardId]?.faceDown : s.locations[a.cardId]?.zone === 'stack') && (target !== 'stack-attachment' || hasCardType(s.cards[a.cardId], 'attachment')) && (target !== 'stack-spell' || hasCardType(s.cards[a.cardId], 'spell'));
    }
    // Death grave-target choices retain the event-time pool, including object versions.
    function options(s, p, plan) {
        if (plan.eventTargetRefs) {
            const { eventTargetRefs, ...current } = plan;
            return options(s, p, current).filter(o => eventTargetRefs.some(r => r.id === o.id && s.locations[actual(s, o.id)]?.zone === r.zone && s.locations[actual(s, o.id)]?.zoneVersion === r.zoneVersion));
        }
        ;
        if (plan.target === 'gunfire-district')
            return [...options(s, p, { ...plan, target: 'district' }).map(o => ({ ...o, slot: 'district' })), ...options(s, p, { ...plan, target: 'hidden-up-to-two' }).map(o => ({ ...o, slot: 'hidden', district: s.locations[actual(s, o.id)].district }))];
        if (plan.cqRepeatModes)
            return plan.modes.flatMap(m => options(s, p, { ...plan, ...plan.modeTargets[m.id], cqRepeatModes: null, modeTargets: null }).map(o => ({ ...o, modes: [m.id] })));
        if (plan.target === 'grave-character-and-district')
            return [...options(s, p, { ...plan, target: 'own-grave-character' }).map(o => ({ ...o, slot: 'grave' })), ...options(s, p, { ...plan, target: 'district' }).map(o => ({ ...o, slot: 'district' }))];
        if (plan.target === 'distributed-districts')
            return options(s, p, { ...plan, target: 'district' });
        if (plan.modeTargets && !plan.selectedMode)
            return plan.modes.flatMap(m => options(s, p, { ...plan, ...plan.modeTargets[m.id], modeTargets: null }).map(o => ({ ...o, modes: [m.id] })));
        if (plan.modeTargets)
            plan = { ...plan, ...plan.modeTargets[plan.selectedMode] };
        if (plan.target === 'own-society-sealed')
            return sealedOn(s, `society:${p}`).map(id => ({ id, name: s.cards[id].name }));
        if (plan.target === 'sealed-and-character')
            return [...Object.keys(s.cards).filter(id => s.locations[id]?.zone === 'sealed' && s.locations[id].hostId === plan.sourceId && !s.locations[id].faceDown).map(id => ({ id, name: s.cards[id].name, slot: 'sealed' })), ...options(s, p, { ...plan, target: 'character', otherTarget: true }).map(o => ({ ...o, slot: 'host' }))];
        if (plan.target === 'gray-biology') {
            const n = plan.sourceCounters?.progress ?? progressCount(s, plan.sourceId);
            return [...(n >= 3 ? options(s, p, { target: 'character' }).map(o => ({ ...o, slot: 'character' })) : []), ...(n >= 5 ? options(s, p, { target: 'attachment' }).map(o => ({ ...o, slot: 'attachment' })) : [])];
        }
        ;
        if (plan.target === 'district-with-optional-industry')
            return [...options(s, p, { ...plan, target: 'district' }).map(o => ({ ...o, slot: 'district' })), ...options(s, p, { ...plan, target: 'own-industry' }).map(o => ({ ...o, slot: 'industry' }))];
        if (plan.target === 'none')
            return [];
        ;
        ;
        if (['permanent-and-district', 'disaster-and-district', 'character-and-district', 'own-character-and-district'].includes(plan.target))
            return [...options(s, p, { ...plan, target: plan.target === 'permanent-and-district' ? 'role-or-attachment' : plan.target === 'own-character-and-district' ? 'own-character' : plan.target === 'character-and-district' ? 'character' : 'filtered-character', ...(plan.target === 'disaster-and-district' ? { filter: { requireSubtype: '灾难' } } : {}) }).map(o => ({ ...o, slot: 'subject', ...(['character-and-district', 'own-character-and-district'].includes(plan.target) ? { district: s.locations[o.id].district } : {}) })), ...options(s, p, { ...plan, target: 'district' }).map(o => ({ ...o, slot: 'district' }))];
        if (plan.target === 'society')
            return [0, 1].map(q => ({ id: `society:${q}`, name: `${s.seats[q].name}的秘社` }));
        if (plan.target === 'own-society')
            return [{ id: `society:${p}`, name: `${s.seats[p].name}的秘社` }];
        if (plan.target === 'role-attachment-or-district')
            return [...options(s, p, { ...plan, target: 'district' }), ...options(s, p, { ...plan, target: 'role-or-attachment' })];
        if (['district', 'task-district', 'destroyed-district', 'other-district', 'city-district', 'water-district', 'twilight-district'].includes(plan.target))
            return s.districts.flatMap((d, i) => d && true && (!plan.oncePerTargetRound || s.targetRoundUses?.[`${p}:${plan.oncePerTargetRound}:${d.id}`] !== s.round) && (plan.target !== 'task-district' || hasCardType(d, 'task')) && (plan.target !== 'destroyed-district' || d.destroyed) && (plan.target !== 'city-district' || districtTraits(s, i).includes('城市')) && (plan.target !== 'water-district' || districtTraits(s, i).includes('水域')) && (plan.target !== 'twilight-district' || districtTraits(s, i).includes('黄昏')) && (plan.target !== 'other-district' || i !== (s.locations[plan.sourceId]?.district ?? plan.sourceDistrict)) ? [{ id: `district:${i}`, name: `地区${districtNumber(s, i)} · ${d.name}` }] : []);
        if (plan.target === 'enemy-player')
            return playerHasBarrier(s, 1 - p) && !plan.nonTargeted && plan.effect !== 'draw-exposed' ? [] : [{ id: `player:${1 - p}`, name: s.seats[1 - p].name }];
        if (plan.target === 'player')
            return s.seats.flatMap((a, i) => i !== p && !plan.nonTargeted && plan.effect !== 'draw-exposed' && playerHasBarrier(s, i) ? [] : [{ id: `player:${i}`, name: a.name }]);
        ;
        if (['stack-card', 'stack-spell', 'stack-attachment', 'stack-role-ability', 'stack-effect', 'stack-character'].includes(plan.target))
            return s.flow.stack.filter(a => stackTargetLegal(s, a, plan.target) && (!plan.bottomDomainHandCost || !plan.paidDomains || effectiveMagicDomains(s, a.cardId).some(d => plan.paidDomains.includes(d)))).map(a => ({ id: `stack:${a.id}`, name: a.displayName ?? s.cards[a.cardId].name, ...(plan.bottomDomainHandCost ? { magicDomains: effectiveMagicDomains(s, a.cardId) } : {}) }));
        const hosts = plan.target === 'seal-host' ? [{ id: `society:${p}`, name: `${s.seats[p].name}的秘社` }] : [];
        return [...hosts, ...Object.keys(s.cards).filter(id => qualifies(s, p, plan.target, id, plan)).map(id => { const c = printedRulesCard(s, id), l = s.locations[id]; return { controller: controllerOf(s, id), ...(plan.distinctTargetDistricts ? { district: l.district } : {}), id: l.faceDown ? `hidden:${l.hiddenHandle}` : id, name: l.faceDown ? `${s.seats[controllerOf(s, id)].name}的暗藏者 · 地区${l.district + 1}` : `${s.seats[controllerOf(s, id)].name} · ${l.zone === 'asset' ? `资产 · ${c.name}` : l.secretPlan ? '秘密计划' : c.name}` }; })];
    }
    function prepare(s, p, c, plan) {
        if (plan.demosX) {
            need(Number.isSafeInteger(c.extraCost) && c.extraCost >= 1 && c.extraCost <= 1000, 'X须为至少1的整数');
            plan.chosenX = c.extraCost;
            plan.tapCharacters = { ...plan.tapCharacters, count: c.extraCost };
        }
        if (plan.bottomDomainHandCost) {
            need(s.players[p].hand.includes(c.costCardId) && effectiveMagicDomains(s, c.costCardId).length > 0, '请选择一张具有魔法领域图标的手牌作为置底费用');
            plan.paidDomains = [...effectiveMagicDomains(s, c.costCardId)];
        }
        ;
        if (plan.target === 'gunfire-district') {
            const ids = c.targetIds ?? [], mode = plan.selectedMode ?? c.mode;
            need(plan.modes?.some(m => m.id === mode), '请选择当前可用的枪火谈判模式');
            need(Array.isArray(ids) && ids.length >= 1 && ids.length <= 3 && typeof ids[0] === 'string' && ids[0].startsWith('district:') && (mode !== 'police' || ids.length === 1), '请选择一个目标地区及至多两个暗藏者');
            const district = prepare(s, p, { targetIds: [ids[0]] }, { ...plan, target: 'district' })[0], hidden = prepare(s, p, { targetIds: ids.slice(1) }, { ...plan, target: 'hidden-up-to-two' });
            need(hidden.every(t => s.locations[t.cardId].district === district.district), '暗藏者须位于所选目标地区');
            return [district, ...hidden.map(t => ({ ...t, requiredDistrict: district.district, requiredDistrictId: district.cardId }))];
        }
        if (plan.cqRepeatModes) {
            need(Array.isArray(c.modes) && c.modes.length === 2 && c.modes.every(m => plan.modes.some(x => x.id === m)), '请选择两项模式，可以重复');
            return c.modes.flatMap((mode, i) => prepare(s, p, { targetIds: c.modeTargetIds?.[i] ?? [] }, { ...plan, ...plan.modeTargets[mode], cqRepeatModes: null, modeTargets: null }).map(t => ({ ...t, modeIndex: i })));
        }
        if (plan.target === 'grave-character-and-district') {
            const ids = c.targetIds ?? [];
            need(ids.length === 2, '请选择墓地角色和目标地区');
            return [...prepare(s, p, { targetIds: [ids[0]] }, { ...plan, target: 'own-grave-character' }), ...prepare(s, p, { targetIds: [ids[1]] }, { ...plan, target: 'district' })];
        }
        if (plan.target === 'distributed-districts') {
            const values = c.distribution ?? [];
            need(Array.isArray(values) && values.length <= 3 && new Set(values.map(x => x.targetId)).size === values.length && values.every(x => typeof x.targetId === 'string' && Number.isSafeInteger(x.count) && x.count > 0) && values.reduce((n, x) => n + x.count, 0) <= 3, '请选择至多三个目标地区，合计至多三个指示物');
            need(!c.targetIds || c.targetIds.length === values.length && c.targetIds.every((id, i) => id === values[i].targetId), '目标地区必须与分配一致');
            return values.map(x => ({ ...prepare(s, p, { targetIds: [x.targetId] }, { ...plan, target: 'district' })[0], tokenCount: x.count }));
        }
        if (plan.multiMode) {
            const modes = selectedModeIds(plan, c);
            return modes.flatMap(modeId => prepare(s, p, { ...c, mode: modeId, targetIds: c.modeTargetIds?.[modeId] ?? (modes.length === 1 ? c.targetIds ?? [] : []) }, { ...plan, multiMode: null }).map(t => ({ ...t, modeId })));
        }
        if (plan.modeTargets) {
            need(!!plan.modeTargets[c.mode], '请选择能力模式');
            plan = { ...plan, ...plan.modeTargets[c.mode], selectedMode: c.mode };
        }
        let ids = c.targetIds ?? [];
        need(Array.isArray(ids) && ids.every(i => typeof i === 'string') && (['gray-biology', 'ordered-assault'].includes(plan.target) || new Set(ids).size === ids.length), '目标选择无效');
        const allowed = options(s, p, plan);
        if (plan.target === 'sealed-and-character')
            need(ids.length === 2 && ids.some(id => allowed.some(o => o.id === id && o.slot === 'sealed')) && ids.some(id => allowed.some(o => o.id === id && o.slot === 'host')), '请选择封印牌与角色两个目标');
        else if (plan.target === 'district-with-optional-industry')
            need(ids.length >= 1 && ids.length <= 2 && ids.filter(id => allowed.some(o => o.id === id && o.slot === 'district')).length === 1 && ids.every(id => allowed.some(o => o.id === id)), '请选择一个地区及至多一个本方产业附属目标');
        else if (plan.target === 'ordered-assault')
            need(ids.length === plan.targetCount, '请按顺序为每次袭击选择目标，可以重复选择同一角色');
        else if (plan.target === 'gray-biology') {
            const n = plan.sourceCounters?.progress ?? progressCount(s, plan.sourceId);
            need(ids.length === (n >= 5 ? 2 : n >= 3 ? 1 : 0) && (n < 3 || ids.some(id => allowed.some(o => o.id === id && o.slot === 'character'))) && (n < 5 || ids.some(id => allowed.some(o => o.id === id && o.slot === 'attachment'))), '请选择所需的角色及附属目标');
        }
        else if (['permanent-and-district', 'disaster-and-district', 'district-and-player', 'character-and-district', 'own-character-and-district'].includes(plan.target))
            need(ids.length === 2 && ids.filter(id => id.startsWith('district:')).length === 1, '请选择一个角色／附属目标和一个目标地区');
        else if (plan.target === 'sadikin-pair') {
            need(ids.length === 2 && ids.filter(id => inGrave(s, actual(s, id))).length === 1, '请选择一张墓地无名尸体和一个本方研究附属');
        }
        else if (plan.target === 'two-roles-or-attachments') {
            need(ids.length === 2, '请选择两个不同且由相同玩家操控的角色或附属');
        }
        else if (plan.target === 'encounter-characters')
            need(ids.length >= 1 && ids.length <= 2, '请选择本方和/或敌方各至多一个角色');
        else if (plan.target === 'none')
            need(!ids.length, '该牌无需目标');
        else if (['hidden-up-to-two', 'characters-up-to-two'].includes(plan.target))
            need(ids.length <= 2, '至多选择两个暗藏者');
        else if (plan.distinctTargetDistricts)
            need(new Set(ids.map(id => s.locations[actual(s, id)]?.district)).size === ids.length, '每个地区至多选择一个目标角色');
        else if (plan.optionalTarget)
            need(ids.length <= 1, '至多选择一个目标');
        else
            need(ids.length === 1, '请选择一个合法目标');
        need(ids.every(id => allowed.some(a => a.id === id)), '所选目标不合法');
        if (plan.target === 'two-roles-or-attachments')
            need(controllerOf(s, actual(s, ids[0])) === controllerOf(s, actual(s, ids[1])), '两个目标必须由相同玩家操控');
        if (plan.target === 'encounter-characters')
            need(new Set(ids.map(id => controllerOf(s, actual(s, id)))).size === ids.length, '双方各至多选择一个角色');
        if (['character-and-district', 'own-character-and-district'].includes(plan.target))
            need(!ids[0].startsWith('district:') && ids[1].startsWith('district:') && s.locations[actual(s, ids[0])].district === Number(ids[1].slice(9)), '目标角色必须位于目标地区');
        return ids.map((value, index) => {
            if (value.startsWith('society:'))
                return { kind: 'host', ref: sealHost(s, value) };
            if (value.startsWith('district:')) {
                const district = Number(value.slice(9));
                return { kind: 'district', district, cardId: s.districts[district].id };
            }
            if (value.startsWith('player:'))
                return { kind: 'player', player: Number(value.slice(7)) };
            if (value.startsWith('stack:'))
                return { kind: 'stack', entryId: value.slice(6) };
            const id = actual(s, value);
            return { kind: 'card', cardId: id, zoneVersion: s.locations[id].zoneVersion, faceDown: !!s.locations[id].faceDown, ...(['character-and-district', 'own-character-and-district'].includes(plan.target) ? { requiredDistrict: Number(ids[1].slice(9)), requiredDistrictId: s.districts[Number(ids[1].slice(9))].id } : {}), ...(plan.target === 'sealed-and-character' ? { slot: allowed.find(o => o.id === value).slot } : {}), ...(plan.target === 'ordered-assault' ? { targetIndex: index } : {}) };
        });
    }
    function live(s, p, plan, t) {
        ;
        if (plan.target === 'gunfire-district')
            return live(s, p, { ...plan, target: t.kind === 'district' ? 'district' : 'hidden' }, t);
        if (plan.cqRepeatModes)
            return live(s, p, { ...plan, ...plan.modeTargets[plan.selectedCQModes[t.modeIndex]], cqRepeatModes: null, modeTargets: null }, t);
        if (plan.target === 'grave-character-and-district')
            return live(s, p, { ...plan, target: t.kind === 'district' ? 'district' : 'own-grave-character' }, t);
        if (t.requiredDistrict !== undefined && (s.locations[t.cardId]?.district !== t.requiredDistrict || s.districts[t.requiredDistrict]?.id !== t.requiredDistrictId))
            return false;
        if (plan.target === 'sealed-and-character' && t.kind === 'card')
            return s.locations[t.cardId]?.zoneVersion === t.zoneVersion && (t.slot === 'sealed' ? s.locations[t.cardId].zone === 'sealed' && s.locations[t.cardId].hostId === plan.sourceId && !s.locations[t.cardId].faceDown : qualifies(s, p, 'character', t.cardId, { ...plan, otherTarget: true }));
        if (plan.target === 'ordered-assault' && t.targetIndex >= Math.min(plan.targetCount, effectiveSocietyMarkers(s, p).hidden))
            return false;
        if (plan.target === 'gray-biology' && t.kind === 'card')
            return s.locations[t.cardId]?.zone === 'play' && s.locations[t.cardId].zoneVersion === t.zoneVersion && !s.locations[t.cardId].faceDown && (controllerOf(s, t.cardId) === p || !hasBarrier(s, t.cardId));
        if (t.kind === 'host')
            return liveSealHost(s, t.ref);
        if (t.kind === 'district')
            return s.districts[t.district]?.id === t.cardId && (plan.target !== 'destroyed-district' || s.districts[t.district].destroyed) && (plan.target !== 'water-district' || districtTraits(s, t.district).includes('水域'));
        if (t.kind === 'player')
            return t.player === p || plan.nonTargeted || plan.effect === 'draw-exposed' || !playerHasBarrier(s, t.player);
        if (t.kind === 'stack')
            return s.flow.stack.some(a => a.id === t.entryId && stackTargetLegal(s, a, plan.target) && (!plan.bottomDomainHandCost || effectiveMagicDomains(s, a.cardId).some(d => plan.paidDomains?.includes(d))) && (true || a.controller === p));
        if (plan.target === 'district-with-optional-industry' && t.kind === 'card')
            return s.locations[t.cardId]?.zoneVersion === t.zoneVersion && qualifies(s, p, 'own-industry', t.cardId, plan);
        return s.locations[t.cardId]?.zoneVersion === t.zoneVersion && t.faceDown === !!s.locations[t.cardId]?.faceDown && qualifies(s, p, plan.target, t.cardId, plan);
    }
    function finishSpell(s, a) {
        if (s.status === 'playing' && s.keeperQueue?.length) {
            s.keeperContinuation = a;
            s.effectChoice = null;
            s.flow.locked = true;
            return;
        }
        if (a.sequence?.length && s.status === 'playing') {
            const [step, ...rest] = a.sequence;
            const next = { ...a, plan: { ...(a.sequenceBase ?? a.plan), ...step }, sequence: rest, targets: step.targets ?? (step.target === 'none' ? [] : a.sequenceTargets) };
            s.effectChoice = null;
            resolve(s, next);
            return;
        }
        if (a.kind === 'play-spell' && !a.copied && s.locations[a.cardId]?.zone === 'stack')
            move(s, a.cardId, a.plan?.graveBottomAfter ? 'deck' : 'graveyard', { cause: 'spell-resolution' });
        s.effectChoice = null;
        delete s.resolvingDistrictTransaction;
        if (s.status === 'playing')
            stateBased(s);
        ctx.repeatResolved?.(s, a);
    }
    function inspectCards(s, player, cardIds, a, what = 'hand-top') {
        rememberHardDeckCards(s, cardIds, player);
        cardIds = observeHiddenInspection(s, player, cardIds, event, a.id);
        const owners = new Set(cardIds.map(id => { const q = s.players.findIndex(pl => pl.hand.includes(id) || pl.deck.includes(id)); return q >= 0 ? q : controllerOf(s, id); }));
        for (const q of owners)
            if (q !== player)
                yellow.inspected(s, a, q, what);
        return cardIds;
    }
    function choose(s, a, kind, player, cardIds, extra = {}) {
        s.flow.locked = true;
        const inspecting = ['inspect', 'batch-inspect', 'batch-inspect-lock', 'secrecy-batch-rat', 'yellow-inspect', 'discard-deck-inspect'].includes(kind);
        if (inspecting)
            cardIds = inspectCards(s, player, cardIds, a);
        s.effectChoice = { id: uuid(), kind, controller: player, cardIds, spell: a, ...extra };
        if (['predict', 'reality-crow-predict'].includes(kind))
            beginPrediction(s, s.effectChoice);
    }
    function destroy(s, id, extra = {}) {
        if (s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && cardHasKeyword(s, id, '永恒'))
            return;
        if (s.locations[id]?.zone === 'asset') {
            move(s, id, 'graveyard', { ...extra, cause: 'destroy' });
            return;
        }
        if (s.locations[id]?.zone === 'play') {
            log(s, s.locations[id].faceDown ? '一个暗藏者被消灭。' : `${s.cards[id].name}被消灭。`);
            move(s, id, 'graveyard', { ...extra, cause: 'destroy' });
        }
    }
    function hurt(s, id, amount, options) { dealDamage(s, id, amount, 'effect', options); }
    function terminateTarget(s, target) {
        const name = target.displayName ?? s.cards[target.cardId]?.name ?? '该效果';
        if (!canTerminate(s, target)) {
            log(s, `${name}不能被终止，仍留在堆叠中。`);
            return;
        }
        s.flow.stack = s.flow.stack.filter(x => x !== target);
        settleTerminatedCard(s, target, move);
        log(s, `${name}被终止。`);
    }
    function takeAsset(s, p, id) { move(s, id, 'asset', { controller: p, tapped: false }); }
    function filterCard(c, f = {}) { return (!f.excludeSubtype || !c.subtypes?.includes(f.excludeSubtype)) && (!f.unique || !!c.unique) && (!f.nonToken || !hasCardType(c, 'token')) && (!f.anyDomain || !!c.magicDomains?.length) && (!f.type || hasCardType(c, f.type)) && (!f.typesAny || hasAnyCardType(c, f.typesAny)) && (!f.magic || c.magicDomains?.includes(f.magic)) && matchesCardNameFilter(c, f) && (!f.subtitle || c.subtitle === f.subtitle) && (!f.requireSubtype || c.subtypes?.includes(f.requireSubtype)) && (!f.subtypesAny || f.subtypesAny.some(x => c.subtypes?.includes(x))) && (!f.faction || c.faction?.split('·')[0] === f.faction) && (!f.factionGroup || c.faction?.split('·').includes(f.factionGroup)) && (!f.nonhuman || !c.subtypes?.includes('人类')) && (!f.subtypeOrNonhuman || c.subtypes?.includes(f.subtypeOrNonhuman) || !c.subtypes?.includes('人类')) && (!f.keyword || c.keywords?.includes(f.keyword)) && (f.exactCost === undefined || c.printedCost === f.exactCost) && (f.minCost === undefined || c.printedCost >= f.minCost) && (f.maxCost === undefined || c.printedCost <= f.maxCost); }
    function tapOptions(s, p, plan) { const played = s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && canTapCard(s, id) && hasCardType(s.cards[id], plan.tapCharacters.type ?? 'character') && (!plan.tapCharacters.otherOnly || id !== plan.sourceId) && (!plan.tapCharacters.sameDistrict || inEffectDistrict(s, id, plan.sourceDistrict)) && (!plan.tapCharacters.subjectKeyword || cardHasKeyword(s, id, plan.tapCharacters.subjectKeyword)) && filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id) }, plan.tapCharacters.filter)); return [...played, ...(plan.tapCharacters.scoredCatalogIds ? (s.players[p].scoreCards ?? []).map(c => typeof c === 'string' ? c : c.id).filter(id => plan.tapCharacters.scoredCatalogIds.includes(s.cards[id]?.catalogId) && !s.locations[id]?.tapped) : [])]; }
    function attachedSacrifices(s, p) { return s.players[p].play.filter(id => { const l = s.locations[id], h = s.locations[l.attachedTo]; return l?.zone === 'play' && !l.faceDown && hasCardType(s.cards[id], 'attachment') && !sacrificeCostBlocked(s, id) && h?.zone === 'play' && !h.faceDown && h.zoneVersion === l.hostVersion && controllerOf(s, l.attachedTo) === p && hasCardType(s.cards[l.attachedTo], 'character'); }); }
    function validateBatchCost(s, p, c, plan) {
        if (plan.abandonScoreCost)
            need(s.players[p].scoreCards.some(x => x.id === c.costCardId), '请选择本方计分区中的一张牌作为遗弃费用');
        if (plan.oncePerTargetRound) {
            const key = `${p}:${plan.oncePerTargetRound}:${s.districts[Number(c.targetIds?.[0]?.slice(9))]?.id}`;
            need(s.targetRoundUses?.[key] !== s.round, '本回合已对该地区发动过此能力');
        }
        if (plan.sourceWoundCost)
            need(sourceLive(s, plan) && !s.locations[plan.sourceId].faceDown && !woundsPrevented(s, plan.sourceId), '无法对来源角色造成创伤以支付费用');
        if (plan.tapOrAssetBottom)
            need(c.costMode === 'tap' ? sourceLive(s, plan) && canTapCard(s, plan.sourceId) : c.costMode === 'asset' && s.players[p].assets.some(a => a.id === c.costCardId), '请选择横置自身或将一个本方资产置底作为费用');
        if (plan.concealSelfCost)
            need(sourceLive(s, plan) && !cannotFlip(s, plan.sourceId) && !cardHasKeyword(s, plan.sourceId, '永恒'), '无法支付潜伏自身的费用');
        if (plan.sealedBottomCost)
            need(sealedOn(s, plan.sourceId).includes(c.costCardId) && filterCard({ ...s.cards[c.costCardId], magicDomains: effectiveMagicDomains(s, c.costCardId) }, plan.sealedBottomCost.filter), '请选择封印在来源牌上的牌作为置底费用');
        if (plan.societyShuffleCost)
            need(societyShuffleCosts(s, p, plan.societyShuffleCost.name).includes(c.costCardId), '请选择封印在本方秘社上的精神锚点作为洗牌费用');
        if (plan.graveBottomCost)
            need(graveBottomCosts(s, p, plan).includes(c.costCardId), '请选择本方墓地中的角色牌作为回底费用');
        if (plan.handSealCost)
            need(s.players[p].hand.includes(c.costCardId) && filterCard({ ...s.cards[c.costCardId], subtypes: effectiveSubtypes(s, c.costCardId) }, plan.handSealFilter) && !(s.cards[c.costCardId].token && hasCardType(s.cards[c.costCardId], 'character')), '请选择一张符合条件的本方手牌作为封印费用');
        if (plan.maxX !== undefined)
            need(Number.isSafeInteger(c.extraCost) && c.extraCost >= 0 && c.extraCost <= plan.maxX, 'X超出该能力允许的范围');
        if (plan.honorCost)
            need((s.players[p].honor ?? 0) >= plan.honorCost, '名誉点不足');
        if (plan.societyMarkerCost)
            need(s.players[p].markers[plan.societyMarkerCost] >= 1, '秘社标志不足');
        if (plan.sacrificeAttached)
            need(attachedSacrifices(s, p).includes(c.costCardId), '请选择结附于本方角色的本方附属作为牺牲费用');
        if (plan.returnGrantedCost) {
            const id = plan.grantedBy, l = s.locations[id];
            need(l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.grantedByVersion && l.attachedTo === plan.sourceId && l.hostVersion === plan.sourceZoneVersion && !cardHasKeyword(s, id, '永恒'), '无法将授予能力的双剑返手以支付费用');
        }
        if (plan.sourceProgressCost)
            need(sourceLive(s, plan) && progressCount(s, plan.sourceId) >= plan.sourceProgressCost, '推进标志不足');
        if (plan.progressCost) {
            const payments = c.progressPayments ?? [];
            need(Array.isArray(payments) && new Set(payments.map(x => x.cardId)).size === payments.length && payments.every(x => ['play', 'asset', 'society'].includes(s.locations[x.cardId]?.zone) && controllerOf(s, x.cardId) === p && Number.isSafeInteger(x.count) && x.count > 0 && x.count <= progressCount(s, x.cardId)) && payments.reduce((n, x) => n + x.count, 0) === plan.progressCost, '请选择恰好两个本方牌上的推进标志作为费用');
        }
        if (plan.sacrificeAssetOrPlan)
            need(gray.eligibleSacrifice(s, p).includes(c.costCardId), '请选择一个资产或秘密计划作为牺牲费用');
        if (plan.sourceTimeCost)
            need(sourceLive(s, plan) && (s.locations[plan.sourceId].markers ?? 0) >= plan.sourceTimeCost, '来源牌上没有足够时间标志支付费用');
        if (plan.graveSealCost || plan.graveShuffleCost) {
            const ids = c.sealIds ?? [], f = plan.graveSealCost ?? plan.graveShuffleCost;
            need(Array.isArray(ids) && ids.length === f.count && new Set(ids).size === ids.length && ids.every(id => graveCards(s, p).includes(id) && (!plan.graveSealCost || !s.cards[id].token) && filterCard({ ...s.cards[id], magicDomains: effectiveMagicDomains(s, id), subtypes: effectiveSubtypes(s, id) }, f.filter)) && (!f.distinctNames || new Set(ids.map(id => s.cards[id].name)).size === ids.length), '请选择规定数量且符合条件的不同墓地牌作为费用');
        }
        if (plan.alternativeCost) {
            need(['discard', 'tap'].includes(c.costMode), '请选择弃牌或横置法师作为额外费用');
            const id = c.costCardId, l = s.locations[id];
            need(c.costMode === 'discard' ? s.players[p].hand.includes(id) && id !== c.cardId && effectiveMagicDomains(s, id).includes(plan.alternativeCost.discardMagic) : l?.zone === 'play' && !l.faceDown && canTapCard(s, id) && controllerOf(s, id) === p && hasCardType(s.cards[id], 'character') && effectiveSubtypes(s, id).includes(plan.alternativeCost.tapSubtype), '所选额外费用不合法');
        }
        if (plan.counterCost) {
            const n = c.counterCostCount, total = plan.counterCost.timeMarkers ? s.locations[plan.sourceId]?.markers ?? 0 : s.locations[plan.sourceId]?.counters?.[plan.counterCost.key] ?? 0;
            need(Number.isSafeInteger(n) && n >= plan.counterCost.min && n <= Math.min(total, plan.counterCost.max ?? Infinity), `请选择不少于${plan.counterCost.min}且不超过现有数量的${plan.counterCost.label ?? plan.counterCost.key}标志`);
        }
        if (plan.scoreSelfCost)
            need(sourceLive(s, plan), '计分费用来源必须仍在场');
        if (plan.timeCostX) {
            const payments = c.timePayments ?? [];
            need(Array.isArray(payments) && new Set(payments.map(x => x.cardId)).size === payments.length && payments.every(x => s.locations[x.cardId] && ['play', 'asset', 'society'].includes(s.locations[x.cardId].zone) && !s.locations[x.cardId].faceDown && controllerOf(s, x.cardId) === p && (!plan.timeCostTypes || s.locations[x.cardId].zone === 'play' && plan.timeCostTypes.some(t => hasCardType(s.cards[x.cardId], t))) && Number.isSafeInteger(x.count) && x.count > 0 && x.count <= (s.locations[x.cardId].markers ?? 0)), '请选择本方牌上实际存在的时间标志作为费用');
            if (plan.timeCost)
                need(payments.reduce((n, x) => n + x.count, 0) === plan.timeCost, `请选择恰好${plan.timeCost}个本方牌上的时间标志作为费用`);
        }
        if (plan.tapCharacters) {
            const allowed = tapOptions(s, p, plan), ids = c.tapIds ?? [];
            need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => allowed.includes(id)) && (plan.tapCharacters.count === undefined || ids.length === plan.tapCharacters.count) && (plan.tapCharacters.max === undefined || ids.length <= plan.tapCharacters.max), '请选择合法的未横置本方角色作为横置费用');
        }
        if (plan.sacrificeAsset)
            need(s.players[p].assets.some(a => a.id === c.assetId), '请选择本方资产作为牺牲费用');
        if (plan.extraCost) {
            need(Number.isSafeInteger(c.extraCost) && c.extraCost >= 0 && c.extraCost <= 1000, '请选择非负整数额外费用');
            if (!plan.costX)
                need(c.targetIds?.length === 1 && s.cards[actual(s, c.targetIds[0])]?.printedCost === c.extraCost, '目标印刷费用须等于额外支付费用');
        }
        if (plan.removeTimeCost)
            need(['play', 'asset', 'society'].includes(s.locations[c.timeCardId]?.zone) && controllerOf(s, c.timeCardId) === p && !s.locations[c.timeCardId].faceDown && (s.locations[c.timeCardId].markers ?? 0) > 0, '请选择本方具有时间标志的卡牌');
    }
    function payBatchCost(s, p, c, plan) {
        if (plan.abandonScoreCost)
            ;
        if (plan.sacrificeCharacters?.snapshotIcons)
            plan.sacrificedCards = (c.sacrificeIds ?? []).map(id => ({ id, district: s.locations[id].district, districtId: s.districts[s.locations[id].district]?.id, subtypes: effectiveSubtypes(s, id), icons: effectiveIcons(s, id, false, true) }));
        if (plan.oncePerTargetRound) {
            s.targetRoundUses ??= {};
            s.targetRoundUses[`${p}:${plan.oncePerTargetRound}:${s.districts[Number(c.targetIds[0].slice(9))].id}`] = s.round;
        }
        if (plan.sourceWoundCost)
            need(addWounds(s, plan.sourceId, plan.sourceWoundCost, { event, group: s.eventGroup ?? c.id }) === plan.sourceWoundCost, '未能支付创伤费用');
        if (plan.graveShuffleCost) {
            const bottom = plan.graveShuffleCost.destination === 'bottom', owners = new Set();
            for (const id of c.sealIds) {
                need(move(s, id, 'deck', { cause: 'cost' }), bottom ? '未能将墓地牌置于牌库底' : '未能将墓地牌洗回牌库');
                owners.add(s.cards[id].owner);
            }
            if (bottom)
                log(s, `额外费用：将${c.sealIds.map(id => s.cards[id].name).join('、')}依次置于其拥有者牌库底，最后一张位于最底。`);
            else
                for (const owner of owners)
                    shuffle(s.players[owner].deck);
        }
        if (plan.bottomDomainHandCost) {
            log(s, `${s.seats[p].name}展示${s.cards[c.costCardId].name}并将其置于牌库底作为费用。`);
            need(move(s, c.costCardId, 'deck'), '无法支付手牌置底费用');
        }
        if (plan.tapOrAssetBottom && c.costMode === 'asset')
            need(move(s, c.costCardId, 'deck'), '无法支付资产置底费用');
        if (plan.concealSelfCost)
            need(conceal(s, plan.sourceId, c.id) !== false && s.locations[plan.sourceId]?.faceDown, '无法支付潜伏费用');
        if (plan.sealedBottomCost)
            need(move(s, c.costCardId, 'deck'), '无法支付封印牌置底费用');
        if (plan.sacrificeCharacter) {
            const id = c.sacrificeId, l = s.locations[id];
            plan.sacrificedRole = { id, district: l.district, districtId: s.districts[l.district]?.id, markers: l.markers ?? 0, printedCost: printedRulesCard(s, id).printedCost, subtypes: effectiveSubtypes(s, id) };
        }
        if (plan.societyShuffleCost) {
            const id = c.costCardId;
            need(move(s, id, 'deck'), '无法支付洗回封印牌的费用');
            shuffle(s.players[s.cards[id].owner].deck);
        }
        if (plan.graveBottomCost)
            need(move(s, c.costCardId, 'deck', { cause: 'cost' }), '无法支付墓地角色回底费用');
        if (plan.handSealCost) {
            const id = c.costCardId, before = { zone: s.locations[id].zone, zoneVersion: s.locations[id].zoneVersion };
            need(seal(s, id, sealHost(s, plan.handSealHost === 'self' ? plan.sourceId : `society:${p}`), before) || s.locations[id].zoneVersion !== before.zoneVersion, '无法支付手牌封印费用');
        }
        if (plan.honorCost)
            changeHonor(s, p, -plan.honorCost);
        if (plan.societyMarkerCost)
            setCardMarker(s, s.players[p], 'markers', null, { ...s.players[p].markers, [plan.societyMarkerCost]: s.players[p].markers[plan.societyMarkerCost] - 1 });
        if (plan.sacrificeAttached)
            need(move(s, c.costCardId, 'graveyard', { cause: 'sacrifice' }), '无法支付附属牺牲费用');
        if (plan.returnGrantedCost)
            need(move(s, plan.grantedBy, 'hand') && s.locations[plan.grantedBy]?.zone === 'hand', '无法支付双剑返手费用');
        if (plan.discardCost)
            plan.discardedPrintedCost = s.cards[c.discardIds?.[0]]?.printedCost ?? 0;
        if (plan.sourceProgressCost)
            gray.change(s, plan.sourceId, -plan.sourceProgressCost, s.eventGroup ?? c.id);
        for (const x of plan.progressCost ? c.progressPayments ?? [] : [])
            gray.change(s, x.cardId, -x.count, s.eventGroup ?? c.id);
        if (plan.sacrificeAssetOrPlan)
            move(s, c.costCardId, 'graveyard', { cause: 'sacrifice' });
        if (plan.sourceTimeCost)
            setCardMarker(s, s.locations[plan.sourceId], "markers", null, (s.locations[plan.sourceId].markers) - (plan.sourceTimeCost));
        if (plan.graveSealCost)
            for (const id of c.sealIds) {
                const before = { zone: s.locations[id].zone, zoneVersion: s.locations[id].zoneVersion };
                need(seal(s, id, sealHost(s, `society:${p}`), before, { cause: 'cost' }) || s.locations[id].zoneVersion !== before.zoneVersion, '无法支付封印费用');
            }
        if (plan.alternativeCost) {
            if (c.costMode === 'discard')
                discardMany(s, [c.costCardId], move, event, { cause: 'cost' });
            else { /* Paid with the other declared taps below. */ }
        }
        if (plan.counterCost) {
            const l = s.locations[plan.sourceId];
            l.counters ??= {};
            setCardMarker(s, l, plan.counterCost.timeMarkers ? 'markers' : 'counter', plan.counterCost.key, (plan.counterCost.timeMarkers ? l.markers ?? 0 : l.counters[plan.counterCost.key] ?? 0) - c.counterCostCount);
            plan.paidCounterCount = c.counterCostCount;
        }
        if (plan.scoreSelfCost) {
            need(move(s, plan.sourceId, 'score', { controller: p, cause: 'cost' }), '不能支付进入计分区的费用');
            s.players[p].scoreCards.push(scoredCard(s, p, { ...s.cards[plan.sourceId], points: plan.points ?? 1 }));
        }
        if (plan.timeCostX) {
            plan.paidTime = 0;
            for (const x of c.timePayments ?? []) {
                setCardMarker(s, s.locations[x.cardId], "markers", null, (s.locations[x.cardId].markers) - (x.count));
                plan.paidTime += x.count;
            }
        }
        if (plan.tapCharacters)
            plan.paidTapCount = (c.tapIds ?? []).length;
        tapCostCards(s, p, [...(plan.actionPaymentTaps ?? []), ...(plan.tapCharacters ? c.tapIds ?? [] : []), ...(plan.tap || plan.tapOrAssetBottom && c.costMode === 'tap' ? [plan.sourceId] : []), ...(plan.alternativeCost && c.costMode === 'tap' ? [c.costCardId] : [])]);
        if (plan.sacrificeAsset) {
            plan.paidAssetCost = s.cards[c.assetId].printedCost;
            move(s, c.assetId, 'graveyard', { cause: 'sacrifice' });
        }
        if (plan.removeTimeCost)
            setCardMarker(s, s.locations[c.timeCardId], "markers", null, (s.locations[c.timeCardId].markers) - 1);
    }
    function sacrificeOptions(s, p, plan) {
        if (plan.sacrificeCharacters.types) {
            const rule = plan.sacrificeCharacters;
            return [...s.players[p].play, ...(rule.types.includes('asset') ? s.players[p].assets.map(a => a.id) : [])].filter(id => { const l = s.locations[id], card = printedRulesCard(s, id); return ['play', 'asset'].includes(l?.zone) && !l.faceDown && controllerOf(s, id) === p && !sacrificeCostBlocked(s, id) && (l.zone === 'asset' ? rule.types.includes('asset') : rule.types.some(t => hasCardType(card, t))) && filterCard({ ...card, subtypes: effectiveSubtypes(s, id), magicDomains: effectiveMagicDomains(s, id) }, rule.filter); });
        }
        if (plan.sacrificeCharacters.allowDistrictAttachment)
            return [];
        return s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character') && !sacrificeCostBlocked(s, id) && filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id) }, plan.sacrificeCharacters.filter) && (!plan.sacrificeCharacters.sameDistrict || inEffectDistrict(s, id, plan.sourceDistrict)) && (!plan.sacrificeCharacters.otherOnly || id !== plan.sourceId));
    }
    function discard(s, a, p, count, batch = { cards: [], group: s.eventGroup ?? a.id }) {
        if (handDiscardProtection(s, p, a.controller).length) {
            log(s, '宗祠：敌方效果不能令本方弃掉手牌。');
            return false;
        }
        if (count > 1 && societyPlan(s, a.controller).cardinaDiscard && p !== a.controller && s.players[p].hand.length > 1) {
            choose(s, a, 'discard-deck-multiple', p, [...s.players[p].hand], { count: Math.min(count, s.players[p].hand.length), choiceLabel: '先选定全部待弃牌，再展示并处理弃牌替代' });
            return true;
        }
        if (count > 0 && s.players[p].hand.length) {
            choose(s, a, 'discard', p, [...s.players[p].hand], { remaining: count, discardBatch: batch });
            return true;
        }
        return false;
    }
    function sacrificeIds(s, p, zone) { return zone === 'asset' ? s.players[p].assets.map(a => a.id) : s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(s.cards[id], zone === 'attachment' ? 'attachment' : 'character') && !cardHasKeyword(s, id, '永恒')); }
    function continueSacrifice(s, a, players, zone) {
        if (!simultaneousChoice(s, choose, a, 'sacrifice', players.map(controller => ({ controller, cardIds: sacrificeIds(s, controller, zone), zone })), { zone, choiceLabel: '各自选择本方牌牺牲' }))
            finishSpell(s, a);
    }
    function cycleThree(s, a) {
        const ids = [...graveCards(s, a.controller)];
        if (ids.length < 3) {
            log(s, '流转不息：墓地不足三张，流程结束。');
            finishSpell(s, a);
            return;
        }
        choose(s, a, 'grave-cycle-three', a.controller, ids, { count: 3, public: true });
    }
    function resolve(s, a) {
        if (!['play-spell', 'auto-ability', 'hidden-effect'].includes(a.kind))
            return false;
        if (a.kind === 'play-spell' && !a.copied && s.locations[a.cardId]?.zone !== 'stack')
            return true;
        let plan = { ...(a.plan ?? s.cards[a.cardId].spell ?? s.cards[a.cardId].attachment), cardId: a.cardId };
        if (plan.cqRepeatModes) {
            const base = { ...plan, cqRepeatModes: null, modeTargets: null }, sequence = plan.selectedCQModes.map((mode, i) => ({ ...plan.modeTargets[mode], targets: a.targets.filter(t => t.modeIndex === i) }));
            finishSpell(s, { ...a, plan: base, sequenceBase: base, sequence });
            return true;
        }
        if (plan.multiMode) {
            const base = { ...plan, multiMode: null, modeTargets: null }, sequence = (plan.selectedModes ?? []).map(modeId => ({ ...plan.modeTargets[modeId], targets: a.targets.filter(t => t.modeId === modeId) }));
            finishSpell(s, { ...a, plan: base, sequenceBase: base, sequence });
            return true;
        }
        if (plan.modeTargets)
            plan = { ...plan, ...plan.modeTargets[a.mode ?? plan.selectedMode] };
        if (plan.condition === 'society-sealed-name' && !sealedOn(s, `society:${a.controller}`).some(id => matchesCardNameFilter(s.cards[id], { name: plan.sealedName }))) {
            finishSpell(s, a);
            return true;
        }
        if (plan.recheckSocietyName && currentSocietyName(s, a.controller) !== plan.societyName) {
            finishSpell(s, a);
            return true;
        }
        if (plan.condition === 'vampire-or-hidden' && !vampireOrHidden(s, a.controller)) {
            finishSpell(s, a);
            return true;
        }
        if (plan.minimumHidden !== undefined && effectiveSocietyMarkers(s, a.controller).hidden < plan.minimumHidden) {
            finishSpell(s, a);
            return true;
        }
        if (plan.condition === 'first' && !firstAbilitiesActive(s, a.controller)) {
            finishSpell(s, a);
            return true;
        }
        if (plan.condition === 'enemy-hand-at-most-three' && s.players[1 - a.controller].hand.length > 3) {
            finishSpell(s, a);
            return true;
        }
        if (plan.recheckHidden && effectiveSocietyMarkers(s, a.controller).hidden <= 0) {
            finishSpell(s, a);
            return true;
        }
        if (plan.condition === 'industry-attachment' && !controlsIndustry(s, a.controller)) {
            finishSpell(s, a);
            return true;
        }
        if (plan.condition === 'grave-seven' && graveCards(s, a.controller, a.cardId).length < 7) {
            finishSpell(s, a);
            return true;
        }
        if (plan.condition === 'death-society' && !deathSocietyCondition(s, a.controller) || plan.condition === 'ghoul-end' && !ghoulEndCondition(s, a.controller, plan)) {
            finishSpell(s, a);
            return true;
        }
        if (plan.condition === 'lotus-moon' && (!sourceLive(s, plan) || !lotusHasSeal(s, plan.sourceId, '江月'))) {
            finishSpell(s, a);
            return true;
        }
        if (plan.condition === 'green-assets' && !s.players[a.controller].assets.some(x => (x.factionColors ?? [x.faction?.split('·')[0]]).includes('绿'))) {
            finishSpell(s, a);
            return true;
        }
        if (plan.condition === 'purple-assets' && !s.players[a.controller].assets.some(x => (x.factionColors ?? [x.faction?.split('·')[0]]).includes('紫'))) {
            finishSpell(s, a);
            return true;
        }
        if (plan.requiredYellowAssets !== undefined && s.players[a.controller].assets.filter(x => (x.factionColors ?? [x.faction?.split('·')[0]]).includes('黄')).length < plan.requiredYellowAssets) {
            finishSpell(s, a);
            return true;
        }
        if (plan.condition === 'mind-assets-two' && s.players[a.controller].assets.filter(x => x.magicDomains?.includes('心灵')).length < 2) {
            finishSpell(s, a);
            return true;
        }
        if (plan.condition === 'assets-yellow' && !s.players[a.controller].assets.some(x => x.faction?.split('·')[0] === '黄')) {
            finishSpell(s, a);
            return true;
        }
        const targets = a.targets.filter(t => live(s, a.controller, plan, t));
        if (a.targets.length && !targets.length && !['biology', 'iteration-hidden', 'elder-top-three'].includes(plan.operation)) {
            log(s, `${a.displayName ?? s.cards[a.cardId].name}的全部目标失效，未产生效果。`);
            finishSpell(s, a);
            return true;
        }
        // Target legality affects only those target parts; it never terminates an entry.
        if (targets.length < a.targets.length)
            log(s, `${a.displayName ?? s.cards[a.cardId].name}的${a.targets.length - targets.length}个目标失效，其余部分继续结算。`);
        const p = a.controller, id = targets[0]?.cardId, district = targets[0]?.district, effect = plan.effect;
        if (effect === 'sequence') {
            a = { ...a, plan, sequenceBase: plan, sequence: [...plan.steps], sequenceTargets: targets };
            finishSpell(s, a);
            return true;
        }
        const host = plan.host === 'source' ? plan.hostRef : plan.host === 'society' ? sealHost(s, `society:${p}`) : targets[0]?.kind === 'host' ? targets[0].ref : sealHost(s, id);
        if (['seal-top', 'seal-random-hand', 'seal-search', 'seal-target-to-source', 'seal-draw-hand', 'seal-hand', 'seal-optional-top'].includes(effect) && !liveSealHost(s, host)) {
            log(s, '封印宿主已经失效，卡牌留在原区域。');
            finishSpell(s, a);
            return true;
        }
        if (effect === 'seal-target-to-source') {
            seal(s, id, host, { zone: s.locations[id].zone, zoneVersion: targets[0].zoneVersion });
        }
        else if (effect === 'seal-to-society') {
            seal(s, id, sealHost(s, `society:${p}`), { zone: 'play', zoneVersion: targets[0].zoneVersion });
        }
        else if (effect === 'seal-to-owner-society') {
            seal(s, id, sealHost(s, `society:${s.cards[id].owner}`), { zone: s.locations[id].zone, zoneVersion: targets[0].zoneVersion });
        }
        else if (effect === 'seal-top') {
            const top = s.players[p].deck[0];
            if (top)
                seal(s, top, host, { zone: 'deck', zoneVersion: s.locations[top].zoneVersion });
        }
        else if (effect === 'seal-random-hand') {
            const hand = s.players[targets[0].player].hand;
            if (hand.length) {
                const n = hand.length, limit = 0x100000000 - 0x100000000 % n;
                let v;
                do {
                    v = randomValues(new Uint32Array(1))[0];
                } while (v >= limit);
                seal(s, hand[v % n], host);
            }
        }
        else if (effect === 'seal-search') {
            if (librarySearchBlocked(s)) {
                log(s, '稻荷神社童子：双方不能检索牌库；封印检索跳过，牌库仍洗牌。');
                shuffle(s.players[p].deck);
                finishSpell(s, a);
                return true;
            }
            const ids = s.players[p].deck.filter(id => filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id), magicDomains: effectiveMagicDomains(s, id) }, plan.filter));
            choose(s, a, 'seal-search', p, ids, { canFail: true, hostRef: host });
            return true;
        }
        else if (effect === 'seal-optional-top') {
            const top = s.players[p].deck[0];
            if (top) {
                log(s, `${s.seats[p].name}展示牌库顶牌：${s.cards[top].name}。`);
                choose(s, a, 'seal-top', p, [top], { hostRef: host, sourceVersion: s.locations[top].zoneVersion, public: true });
                return true;
            }
        }
        else if (effect === 'seal-draw-hand' || effect === 'seal-hand') {
            if (effect === 'seal-draw-hand' && !draw(s, [p], 1))
                return true;
            const ids = s.players[p].hand.filter(id => filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id), magicDomains: effectiveMagicDomains(s, id) }, plan.handFilter ?? plan.filter));
            if (ids.length) {
                choose(s, a, 'seal-hand', p, ids, { hostRef: host, drawAfter: plan.drawAfter ?? 0, canSkip: !!plan.optional, discardAlternative: !!plan.discardAlternative, faceDownSeal: !!plan.faceDownSeal });
                return true;
            }
            log(s, '没有符合条件的手牌，未执行封印或后续抓牌。');
        }
        else if (effect === 'self-wound-if-sealed') {
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.sourceZoneVersion && sealedOn(s, plan.sourceId).length)
                addWounds(s, plan.sourceId, 1, { event, group: a.id });
        }
        else if (effect === 'spawn-token') {
            const template = s.reserveTemplates.find(c => c.catalogId === plan.catalogId), d = plan.tokenTargetDistrict ? targets[0]?.district : plan.sourceDistrict;
            if (template && s.districts[d]?.id === (plan.tokenTargetDistrict ? targets[0]?.cardId : plan.sourceDistrictCardId)) {
                for (let i = 0; i < (plan.count ?? 1); i++) {
                    const token = uuid();
                    s.cards[token] = { ...structuredClone(template), id: token, owner: p };
                    s.locations[token] = { zone: 'reserve', zoneVersion: 0 };
                    move(s, token, 'play', { controller: p, district: d, tapped: enterTapped(s, token), ...(template.attachment?.target === 'district' ? { attachedTo: `district-host:${s.districts[d].id}`, hostVersion: s.districts[d].id } : {}) });
                    event(s, token, 'entry', s.locations[token], a.id, { method: 'effect-placement' });
                }
            }
        }
        else if (effect === 'task-district') {
            move(s, a.cardId, 'play', { controller: p, tapped: false });
            registerTaskDistrict(s, a.cardId);
            event(s, a.cardId, 'entry', s.locations[a.cardId], a.id, { method: 'play' });
        }
        else if (effect === 'attach-society') {
            const h = targets[0].ref;
            move(s, a.cardId, 'play', { controller: p, tapped: false, attachedTo: h.hostId, hostVersion: h.version, ...(plan.playSecret ? { secretPlan: true } : {}) });
            event(s, a.cardId, 'entry', s.locations[a.cardId], a.id, { method: 'play' });
        }
        else if (effect === 'attach-district') {
            const t = targets[0];
            move(s, a.cardId, 'play', { controller: p, district, tapped: false, attachedTo: `district-host:${t.cardId}`, hostVersion: t.cardId });
            event(s, a.cardId, 'entry', s.locations[a.cardId], a.id, { method: 'play' });
        }
        else if (effect === 'attach') {
            const h = targets[0]?.kind === 'host' ? targets[0].ref : null;
            move(s, a.cardId, 'play', { controller: p, ...(!h ? { district: s.locations[id].district } : {}), tapped: false, attachedTo: h?.hostId ?? id, hostVersion: h?.version ?? s.locations[id].zoneVersion });
            updateControl(s);
            event(s, a.cardId, 'entry', s.locations[a.cardId], a.id, { method: 'play' });
            event(s, a.cardId, 'attached', s.locations[a.cardId], a.id, { host: sealHost(s, id) });
        }
        else if (effect === 'reattach') {
            const l = s.locations[a.cardId];
            if (l?.zone === 'play' && l.zoneVersion === plan.sourceZoneVersion) {
                l.attachedTo = id;
                l.hostVersion = s.locations[id].zoneVersion;
                l.district = s.locations[id].district;
                event(s, a.cardId, 'attached', l, a.id, { host: sealHost(s, id) });
            }
        }
        else if (effect === 'conceal-source') {
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && l.zoneVersion === plan.sourceZoneVersion)
                conceal(s, plan.sourceId, a.id);
        }
        else if (effect === 'return-source-hand') {
            if (sourceLive(s, plan))
                move(s, plan.sourceId, 'hand');
        }
        else if (effect === 'blink-source') {
            const id = plan.sourceId;
            if (sourceLive(s, plan))
                batchEffect(s, { ...a, targets: [{ cardId: id }] }, { ...plan, operation: 'blink' }, [{ cardId: id }]);
        }
        else if (effect === 'mode-conceal-bounce') {
            if (a.mode === 'conceal')
                conceal(s, id, a.id);
            else
                move(s, id, 'hand');
        }
        else if (effect === 'bottom-owner') {
            if (id && (s.locations[id].zone === 'asset' || !cardHasKeyword(s, id, '永恒')))
                move(s, id, 'deck');
        }
        else if (effect === 'grave-bottom-optional') {
            if (id)
                move(s, id, 'deck');
        }
        else if (effect === 'influence-if-none') {
            if (sourceDistrictLive(s, plan) && s.districts[plan.sourceDistrict].influence[p] === 0)
                placeRegionInfluence(s, plan.sourceDistrict, p);
        }
        else if (effect === 'place-influence') {
            placeRegionInfluence(s, district, p, plan.count ?? 1);
        }
        else if (effect === 'damage-source-district' || effect === 'damage-source-district-other') {
            for (const id of s.players.flatMap(pl => pl.play))
                if (!s.locations[id].faceDown && inEffectDistrict(s, id, plan.sourceDistrict) && hasCardType(s.cards[id], 'character') && (effect !== 'damage-source-district-other' || !sameSourceObject(s,id,plan)))
                    hurt(s, id, 1);
        }
        else if (effect === 'destroy-vampire-influence') {
            const d = s.locations[id].district, version = s.districts[d]?.id, isVampire = effectiveSubtypes(s, id).includes('吸血鬼');
            destroy(s, id);
            if (isVampire && s.locations[id].zone !== 'play' && s.districts[d]?.id === version) {
                choose(s, a, 'batch-optional-influence', p, [], { options: [{ id: 'yes', name: '放置一个本方势力标志' }, { id: 'no', name: '不放置' }], district: d, districtCardId: version });
                return true;
            }
        }
        else if (effect === 'tap-source-district-enemies') {
            for (const id of s.players[1 - p].play)
                if (!s.locations[id].faceDown && inEffectDistrict(s, id, plan.sourceDistrict) && hasCardType(s.cards[id], 'character'))
                    tapCard(s, id);
        }
        else if (effect === 'destroy-source-district-other') {
            const ids = s.players.flatMap(pl => pl.play).filter(id => !sameSourceObject(s,id,plan) && inEffectDistrict(s, id, plan.sourceDistrict) && (s.locations[id].faceDown || hasCardType(s.cards[id], 'character')));
            beginEventGroup(s, a.id);
            for (const id of ids)
                destroy(s, id);
            endEventGroup(s);
        }
        else if (effect === 'destroy-low-total-icons') {
            const ids = s.players.flatMap(pl => pl.play).filter(id => !s.locations[id].faceDown && hasCardType(s.cards[id], 'character') && Object.values(effectiveIcons(s, id)).reduce((a, b) => a + b, 0) <= plan.maxTotal);
            beginEventGroup(s, a.id);
            for (const id of ids)
                destroy(s, id);
            endEventGroup(s);
        }
        else if (effect === 'grant-icons-keyword') {
            for (const [icon, amount] of Object.entries(plan.icons))
                s.effects.push({ kind: 'modify-icons', icon, amount, targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: plan.duration });
            for (const keyword of plan.grantKeywords)
                s.effects.push({ kind: 'grant-keyword', keyword, targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: plan.duration });
        }
        else if (effect === 'grant-source-icons') {
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.sourceZoneVersion)
                for (const [icon, amount] of Object.entries(plan.icons))
                    s.effects.push({ kind: 'modify-icons', icon, amount, targetId: plan.sourceId, targetZoneVersion: l.zoneVersion, duration: plan.duration });
        }
        else if (effect === 'grant-target-keywords') {
            for (const keyword of plan.grantKeywords)
                s.effects.push({ kind: 'grant-keyword', keyword, targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: plan.duration });
        }
        else if (effect === 'grant-own-other-barrier') {
            if (effectiveSocietyMarkers(s, p).exposed === 0)
                for (const target of s.players[p].play)
                    if (!sameSourceObject(s,target,plan) && hasCardType(s.cards[target], 'character') && !s.locations[target].faceDown && plan.subtypesAny.some(t => effectiveSubtypes(s, target).includes(t)))
                        s.effects.push({ kind: 'barrier', targetId: target, targetZoneVersion: s.locations[target].zoneVersion, duration: 'until-end-of-round' });
        }
        else if (effect === 'move-source') {
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.sourceZoneVersion && l.district !== district && relocate(s, plan.sourceId, district)) {
                event(s, plan.sourceId, 'move', l, a.id, { district });
                log(s, `${s.cards[plan.sourceId].name}移动至地区${district + 1}。`);
            }
        }
        else if (effect === 'grant-source-keyword') {
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.sourceZoneVersion)
                for (const keyword of plan.grantKeywords)
                    s.effects.push({ kind: 'grant-keyword', keyword, targetId: plan.sourceId, targetZoneVersion: l.zoneVersion, duration: plan.duration });
        }
        else if (effect === 'skip-source-contest') {
            if (s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId)
                s.effects.push({ kind: 'skip-contests', district: plan.sourceDistrict, districtCardId: plan.sourceDistrictCardId, contest: plan.contestToSkip ?? plan.contest, duration: 'until-end-of-round' });
        }
        else if (effect === 'sacrifice-attachments') {
            continueSacrifice(s, a, [s.turn.firstPlayer, 1 - s.turn.firstPlayer], 'attachment');
            return true;
        }
        else if (effect === 'conceal')
            conceal(s, id, a.id);
        else if (effect === 'conceal-source-district-cheap') {
            beginEventGroup(s, a.id);
            for (const id of s.players.flatMap(pl => pl.play))
                if (inEffectDistrict(s, id, plan.sourceDistrict) && s.cards[id].printedCost <= plan.maxCost)
                    conceal(s, id, a.id);
            endEventGroup(s);
        }
        else if (effect === 'guess-top-cost') {
            choose(s, a, 'guess-cost', p, [], { public: true });
            return true;
        }
        else if (effect === 'grave-character-bottom-then-destroy') {
            const ids = graveCards(s, p).filter(id => hasCardType(s.cards[id], 'character'));
            if (ids.length) {
                choose(s, a, 'grave-bottom-destroy', p, ids, { public: true });
                return true;
            }
        }
        else if (effect === 'attach-entropy') {
            const t = targets[0], host = t.kind === 'host' ? t.ref : sealHost(s, `district-host:${t.cardId}`);
            if (host && liveSealHost(s, host)) {
                move(s, a.cardId, 'play', { controller: p, tapped: false, attachedTo: host.hostId, hostVersion: host.version, ...(t.kind === 'district' ? { district: t.district } : {}) });
                event(s, a.cardId, 'entry', s.locations[a.cardId], a.id, { method: 'play' });
            }
        }
        else if (effect === 'entropy') {
            if (entropy.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'time-cult') {
            if (timeCult.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'source-blink') {
            if (sourceLive(s, plan))
                batchEffect(s, a, { ...plan, operation: 'blink' }, [{ cardId: plan.sourceId }]);
        }
        else if (effect === 'continuing-cost') {
            if (continuingCost.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'starlight') {
            if (starlight.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'cq') {
            if (cq.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'reverberation') {
            if (reverberation.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'bq') {
            if (bq.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'veiled-status') {
            if (veiledStatus.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'veil-tools') {
            if (veilTools.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'regional-synergy') {
            if (regionalSynergy.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'field-support') {
            if (fieldSupport.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'attachment-tools') {
            attachmentTools.effect(s, a, plan, targets);
        }
        else if (effect === 'prediction-tools') {
            if (predictionTools.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'resource')
            s.players[p].costPool = (s.players[p].costPool ?? 0) + 1;
        else if (effect === 'add-own-exposed') {
            const m = s.players[p].markers;
            setCardMarker(s, s.players[p], 'markers', null, societyMarkers(m.hidden, m.exposed, 0, plan.count ?? 1));
        }
        else if (effect === 'destroy-enemy-attached-then-barrier') {
            for (const [aid, l] of Object.entries(s.locations))
                if (l.zone === 'play' && l.attachedTo === id && l.hostVersion === s.locations[id].zoneVersion && controllerOf(s, aid) !== p)
                    destroy(s, aid);
            s.effects.push({ kind: 'barrier', targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: 'until-end-of-round' });
        }
        else if (effect === 'qs') {
            if (void 0)
                return true;
        }
        else if (effect === 'late-non-qs') {
            if (lateNonQs.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'non-qs') {
            if (nonQs.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'spell-copy') {
            if (spellCopy.effect(s, a))
                return true;
        }
        else if (effect === 'secrecy-batch') {
            if (secrecyBatch.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'continuing') {
            continuingCardEffect(s, a, plan, { seal, shuffle, log });
        }
        else if (effect === 'discard-own') {
            if (discard(s, a, p, plan.count ?? 1))
                return true;
        }
        else if (effect === 'draw') {
            if (plan.condition !== 'enemy-influence-removed' || s.influenceRemovedRound?.[1 - p] === s.round)
                draw(s, [p], plan.count ?? 1);
        }
        else if (effect === 'control')
            takeControl(s, id, p, { duration: 'until-end-of-round' });
        else if (effect === 'control-source')
            takeControl(s, id, p, { sourceId: plan.sourceId, sourceZoneVersion: plan.sourceZoneVersion, extraSubtype: plan.extraSubtype });
        else if (effect === 'mode-buff')
            s.effects.push({ kind: a.mode === 'battle' ? 'modify-icons' : 'modify-defense', ...(a.mode === 'battle' ? { icon: 'battle' } : {}), amount: 2, targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: 'until-end-of-round' });
        else if (effect === 'draw-exposed') {
            if (draw(s, [p], 2)) {
                choose(s, a, 'exposed', p, [], { targetPlayer: targets[0].kind === 'host' ? targets[0].ref.owner : targets[0].player });
                return true;
            }
        }
        else if (effect === 'grave-random-enter') {
            const districts = s.districts.flatMap((d, i) => d ? [i] : []);
            if (districts.length && !graveyardLocked(s)) {
                const d = districts[randomValues(new Uint32Array(1))[0] % districts.length];
                if (move(s, id, 'play', { controller: p, district: d, tapped: enterTapped(s, id) }))
                    event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
            }
        }
        else if (effect === 'grave-hidden' || effect === 'grave-enter') {
            if (graveyardLocked(s)) {
                log(s, '镇魂曲禁止墓地进场，牌留在墓地。');
                finishSpell(s, a);
                return true;
            }
            const d = a.district;
            const entered = move(s, id, 'play', { controller: p, district: d, tapped: effect === 'grave-enter' && printedRulesCard(s, id).keywords?.includes('迟缓'), faceDown: effect === 'grave-hidden', ...(effect === 'grave-hidden' ? { hiddenHandle: uuid() } : { extraSubtypes: plan.extraSubtype ? [plan.extraSubtype] : [] }) });
            if (entered && effect === 'grave-enter')
                event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
        }
        else if (effect === 'source-influence') {
            const d = s.districts[plan.sourceDistrict];
            if (d?.id === plan.sourceDistrictCardId && (!plan.condition || s.players[1 - p].hand.length <= 3))
                placeRegionInfluence(s, plan.sourceDistrict, p);
        }
        else if (effect === 'event-influence') {
            const d = s.districts[plan.eventDistrict];
            if (d?.id === plan.eventDistrictCardId)
                placeRegionInfluence(s, plan.eventDistrict, p);
        }
        else if (effect === 'add-locked') {
            if (!cardHasKeyword(s, id, '不能被锁定')) {
                s.locations[id].counters ??= {};
                setCardMarker(s, s.locations[id], "counter", "locked", (s.locations[id].counters.locked ?? 0) + 1);
            }
        }
        else if (effect === 'top-tapped-asset') {
            const id = s.players[p].deck[0];
            if (id) {
                log(s, `${s.seats[p].name}展示${s.cards[id].name}并横置置入资产区。`);
                move(s, id, 'asset', { controller: p, tapped: true });
            }
        }
        else if (effect === 'top-type-three') {
            for (let i = 0; i < 3; i++) {
                const top = s.players[p].deck[0];
                if (!top)
                    break;
                log(s, `${s.seats[p].name}展示${s.cards[top].name}，检查${a.mode === 'character' ? '角色' : a.mode === 'attachment' ? '附属' : '事务'}类别（${i + 1}/3）。`);
                move(s, top, hasCardType(s.cards[top], a.mode) ? 'hand' : 'graveyard');
            }
        }
        else if (effect === 'top-select-hand') {
            const bonus = s.players[p].play.some(id => s.locations[id].zone === 'play' && !s.locations[id].faceDown && inEffectDistrict(s, id, plan.sourceDistrict) && hasCardType(s.cards[id], 'character') && cardHasKeyword(s, id, '威名')), top = hardDeckCards(s, p, plan.count, { kind: 'select-and-mill', handCount: bonus ? 2 : 1 }), eligible = top.filter(id => hasCardType(s.cards[id], 'character') || s.cards[id].subtypes?.includes('装备'));
            choose(s, a, 'top-select-hand', p, top, { eligibleIds: eligible, min: 0, max: bonus ? 2 : 1 });
            return true;
        }
        else if (effect === 'tap-or-bounce') {
            if (s.locations[id].tapped)
                move(s, id, 'hand');
            else
                tapCard(s, id);
        }
        else if (effect === 'tap-source-and-target') {
            tapCard(s, id);
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && l.zoneVersion === plan.sourceZoneVersion)
                tapCard(s, plan.sourceId);
        }
        else if (effect === 'search-filtered' || effect === 'search' && plan.filter) {
            if (librarySearchBlocked(s)) {
                log(s, '稻荷神社童子：双方不能检索牌库；检索跳过，牌库仍洗牌。');
                shuffle(s.players[p].deck);
                finishSpell(s, a);
                return true;
            }
            const filter = { ...(plan.searchFilter ?? plan.filter), ...(plan.costX || plan.waivedCostX ? { exactCost: plan.chosenX ?? plan.extraPaid } : {}) }, ids = s.players[p].deck.filter(id => filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id), magicDomains: effectiveMagicDomains(s, id) }, filter));
            choose(s, a, 'search', p, ids, { canFail: true, destination: plan.destination, reveal: plan.reveal });
            return true;
        }
        else if (effect === 'grave-cycle-three') {
            cycleThree(s, a);
            return true;
        }
        else if (effect === 'predict') {
            const ids = hardDeckCards(s, p, plan.count, { kind: 'hand' });
            choose(s, a, 'predict', p, ids, { drawAfter: plan.drawAfter ?? 0 });
            return true;
        }
        else if (effect === 'counter-card')
            terminateTarget(s, s.flow.stack.find(x => x.id === targets[0].entryId));
        else if (effect === 'counter-predict') {
            terminateTarget(s, s.flow.stack.find(x => x.id === targets[0].entryId));
            choose(s, a, 'predict', p, hardDeckCards(s, p, plan.count, { kind: 'hand' }));
            return true;
        }
        else if (effect === 'hidden-contest') {
            if (startHidden(s, a.id, a)) {
                if (plan.cardBonus)
                    s.hidden.cardBonus = { ...plan.cardBonus, controller: p };
                const bonus = plan.hiddenBonusFrom === 'paidTime' ? (plan.paidTime ?? 0) : plan.hiddenBonus;
                if (bonus) {
                    s.hidden.environmentBonus = { [p]: bonus };
                    s.hidden.environmentBonusScope = plan.hiddenBonusScope ?? 'player';
                }
                return true;
            }
        }
        else if (effect === 'bottom-to-hand') {
            for (const id of s.players[p].deck.slice(-(plan.count ?? 2)))
                move(s, id, 'hand');
        }
        else if (effect === 'draw-to-four')
            draw(s, [p], Math.max(0, 4 - s.players[p].hand.length));
        else if (effect === 'redraw-hand') {
            const cards = [...s.players[p].hand];
            discardMany(s, cards, move, event, { cause: 'discard', effectController: a.controller });
            draw(s, [p], cards.length + (effectiveSocietyMarkers(s, p).hidden > 0 ? 1 : 0));
        }
        else if (effect === 'mill-five-both' || effect === 'mill-self-one') {
            for (const player of effect === 'mill-five-both' ? [0, 1] : [p])
                for (const id of hardDeckCards(s, player, effect === 'mill-five-both' ? 5 : 1, { kind: 'graveyard' }))
                    move(s, id, 'graveyard');
        }
        else if (effect === 'bounce' || effect === 'grave-to-hand')
            move(s, id, 'hand');
        else if (effect === 'shuffle-owner') {
            const owner = s.cards[id].owner;
            if (move(s, id, 'deck'))
                shuffle(s.players[owner].deck);
        }
        else if (effect === 'defense-buff')
            s.effects.push({ kind: 'modify-defense', amount: 1, targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: 'until-end-of-round' });
        else if (effect === 'clear-wounds')
            setCardMarker(s, s.locations[id], "wounds", null, 0);
        else if (effect === 'tap-hidden-district') {
            for (const id of s.players.flatMap(p => p.play))
                if (s.locations[id].faceDown && inEffectDistrict(s, id, plan.sourceDistrict))
                    tapCard(s, id);
        }
        else if (effect === 'mill-both' || effect === 'mill-player') {
            for (const player of effect === 'mill-both' ? [0, 1] : [targets[0].player])
                for (const id of hardDeckCards(s, player, effect === 'mill-both' ? 4 : plan.count ?? 2, { kind: 'graveyard' }))
                    move(s, id, 'graveyard');
        }
        else if (effect === 'influence-if-existing') {
            const l = s.locations[plan.sourceId], d = s.districts[l?.district];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.sourceZoneVersion && d?.influence[p] > 0)
                placeRegionInfluence(s, l.district, p);
        }
        else if (effect === 'draw-discard-one') {
            if (draw(s, [p], 1) && s.players[p].hand.length) {
                choose(s, a, 'discard', p, [...s.players[p].hand]);
                return true;
            }
        }
        else if (effect === 'discard-random') {
            const hand = s.players[targets[0].player].hand;
            if (hand.length) {
                const n = hand.length, limit = 0x100000000 - 0x100000000 % n;
                let v;
                do {
                    v = randomValues(new Uint32Array(1))[0];
                } while (v >= limit);
                discardMany(s, [hand[v % n]], move, event, { cause: 'discard', effectController: p });
            }
        }
        else if (effect === 'discard-player') {
            if (discard(s, a, targets[0].player, plan.count ?? 1))
                return true;
        }
        else if (effect === 'add-time')
            setCardMarker(s, s.locations[id], "markers", null, (s.locations[id].markers ?? 0) + 1);
        else if (effect === 'add-philosopher-stone') {
            const l = s.locations[id];
            l.counters ??= {};
            setCardMarker(s, l, "counter", PHILOSOPHER_STONE, (l.counters[PHILOSOPHER_STONE] ?? 0) + 1);
            log(s, `${s.cards[id].name}获得一个哲人石标志。`);
        }
        else if (effect === 'philosopher-stone-return')
            revivePhilosopherStone(s, a, { move, event, log });
        else if (effect === 'tap')
            tapCard(s, id);
        else if (effect === 'buff') {
            for (const e of [{ kind: 'modify-defense', amount: 1 }, { kind: 'modify-icons', icon: 'battle', amount: 1 }])
                s.effects.push({ ...e, targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: 'until-end-of-round' });
        }
        else if (effect === 'prevent-damage')
            s.effects.push({ kind: 'prevent-damage', targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: 'until-end-of-round' });
        else if (effect === 'damage')
            hurt(s, id, (plan.amountFrom === 'enemy-exposure' ? effectiveSocietyMarkers(s, 1 - p).exposed : plan.amountFrom === 'own-grave-characters' ? graveCards(s, p).filter(id => hasCardType(s.cards[id], 'character')).length : plan.amount ?? 1) + (plan.assaultBonus ?? 0), { unpreventable: !!plan.unpreventable, assault: plan.assault ? { ...assaultSource(plan), ...(plan.drawOnRenownDeath ? { renownDrawPlayer: p } : {}) } : undefined });
        else if (effect === 'wound') {
            const amount = plan.amount ?? 1, before = effectiveDefense(s, id) - (s.locations[id].damage ?? 0);
            const added = addWounds(s, id, amount, { event, group: a.id });
            if (added && plan.assault && before > 0)
                noteAssaultLethal(s, id, assaultSource(plan));
        }
        else if (effect === 'destroy' || effect === 'destroy-if-sealed' && Object.values(s.locations).some(l => l.zone === 'sealed' && l.hostId === id))
            destroy(s, id);
        else if (effect === 'grave-bottom-draw') {
            move(s, id, 'deck');
            draw(s, [p], 1);
        }
        else if (effect === 'damage-district') {
            for (const player of s.players)
                for (const id of [...player.play])
                    if (inEffectDistrict(s, id, district) && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character'))
                        hurt(s, id, 1);
        }
        else if (effect === 'destroy-district') {
            beginEventGroup(s, a.id);
            for (const player of s.players)
                for (const id of [...player.play])
                    if (inEffectDistrict(s, id, district) && (s.locations[id].faceDown || hasCardType(s.cards[id], 'character')))
                        destroy(s, id);
            endEventGroup(s);
        }
        else if (effect === 'district-finale') {
            clearDistrictInfluence(s, district);
            if (districtTimeMarkers(s, district) >= 3) {
                beginEventGroup(s, a.id);
                for (const id of s.players.flatMap(player => [...player.play]))
                    if (s.locations[id]?.zone === 'play' && inEffectDistrict(s, id, district) && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character'))
                        destroy(s, id);
                endEventGroup(s);
            }
        }
        else if (effect === 'bounce-district-clear-counters') {
            const d = s.districts[district];
            beginEventGroup(s, a.id);
            for (const id of s.players.flatMap(player => [...player.play]))
                if (s.locations[id]?.zone === 'play' && inEffectDistrict(s, id, district) && (s.locations[id].faceDown || hasCardType(s.cards[id], 'character')))
                    move(s, id, 'hand');
            endEventGroup(s);
            setCardCounters(s, d, {});
            d.destroyed = 0;
        }
        else if (effect === 'destroy-attachments-by-host') {
            const ids = s.players.flatMap(pl => pl.play).filter(id => { const l = s.locations[id]; return !l.faceDown && hasCardType(s.cards[id], 'attachment') && (a.mode === 'society' ? l.attachedTo?.startsWith('society:') : l.attachedTo === `district-host:${s.districts[l.district]?.id}` && s.districts[l.district]?.destroyed); });
            beginEventGroup(s, a.id);
            for (const id of ids)
                if (s.locations[id].zone === 'play')
                    destroy(s, id);
            endEventGroup(s);
        }
        else if (effect === 'mark-district-destroyed')
            s.districts[district].destroyed = 1;
        else if (effect === 'tap-district') {
            for (const player of s.players)
                for (const id of player.play)
                    if (inEffectDistrict(s, id, district) && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character'))
                        tapCard(s, id);
        }
        else if (effect === 'destroy-hidden') {
            for (const player of s.players)
                for (const id of [...player.play])
                    if (s.locations[id].faceDown)
                        destroy(s, id);
        }
        else if (effect === 'top-to-asset') {
            const id = s.players[p].deck[0];
            if (id)
                takeAsset(s, p, id);
        }
        else if (effect === 'swap-influence') {
            swapRegionInfluence(s, district, p);
        }
        else if (effect === 'skip-contests')
            s.effects.push({ kind: 'skip-contests', district, districtCardId: s.districts[district].id, duration: 'until-end-of-round' });
        else if (effect === 'counter')
            terminateTarget(s, s.flow.stack.find(x => x.id === targets[0].entryId));
        else if (effect === 'draw-discard') {
            if (draw(s, [p], 2) && s.players[p].hand.length) {
                choose(s, a, 'discard', p, [...s.players[p].hand], { count: 1 });
                return true;
            }
        }
        else if (effect === 'search') {
            if (librarySearchBlocked(s)) {
                log(s, '稻荷神社童子：双方不能检索牌库；检索跳过，牌库仍洗牌。');
                shuffle(s.players[p].deck);
                finishSpell(s, a);
                return true;
            }
            if (s.players[p].deck.length) {
                choose(s, a, 'search', p, [...s.players[p].deck]);
                return true;
            }
        }
        else if (effect === 'sacrifice-assets') {
            continueSacrifice(s, a, [s.turn.firstPlayer, 1 - s.turn.firstPlayer], 'asset');
            return true;
        }
        else if (effect === 'sacrifice-both-characters') {
            continueSacrifice(s, a, [s.turn.firstPlayer, 1 - s.turn.firstPlayer], 'character');
            return true;
        }
        else if (effect === 'sacrifice-character') {
            continueSacrifice(s, a, [targets[0].player], 'character');
            return true;
        }
        else if (effect === 'fate') {
            return fate.effect(s, a);
        }
        else if (effect === 'veil-late') {
            if (veilLate.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'scarab') {
            return scarab.effect(s, a, plan, targets);
        }
        else if (effect === 'yellow-gray') {
            if (yellow.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'shoggoth') {
            if (shoggoth.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'green-black') {
            if (green.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'gray') {
            if (gray.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'criminal') {
            if (criminal.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'reality') {
            if (reality.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'discard-deck') {
            if (discardDeck.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'source-target-influence') {
            if (s.players.every((pl, i) => i === p || s.players[p].hand.length > pl.hand.length))
                placeRegionInfluence(s, district, p);
        }
        else if (effect === 'holy') {
            if (holy.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'death-deck') {
            if (deathDeck.effect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'batch') {
            if (batchEffect(s, a, plan, targets))
                return true;
        }
        else if (effect === 'inspect-draw') {
            if (targets.length) {
                choose(s, a, 'inspect', p, targets.map(t => t.cardId));
                return true;
            }
            draw(s, [p], 1);
        }
        log(s, `${a.displayName ?? s.cards[a.cardId].name}结算完成。`);
        finishSpell(s, a);
        return true;
    }
    function command(s, p, c) {
        if (!active(s))
            return false;
        if (c.type === 'trigger-choice' && s.triggerChoices.some(a => a.id === c.triggerId && a.kind === 'auto-ability')) {
            const a = s.triggerChoices.find(a => a.id === c.triggerId && a.controller === p);
            need(a, '当前没有属于你的该触发选择');
            need(typeof c.fire === 'boolean', '请明确是否发动');
            need(!a.mandatory || c.fire, '强制触发必须发动');
            if (c.fire)
                activateTrigger(s, p, c, a);
            s.triggerChoices = s.triggerChoices.filter(x => x !== a);
            if (!s.triggerChoices.length && !s.effectChoice)
                onTriggersChosen(s);
            return true;
        }
        if (c.type === 'effect-choice') {
            const choice = s.effectChoice;
            need(choice && choicePending(choice, p) && choice.id === c.choiceId, '当前没有属于你的该项结算选择');
            const a = choice.spell;
            if (['search', 'seal-search'].includes(choice.kind) && librarySearchBlocked(s)) {
                log(s, '检索限制已生效，本次不移动检索牌并仍洗牌。');
                shuffle(s.players[p].deck);
                finishSpell(s, a);
            }
            else if (choice.kind.startsWith('late-non-qs-'))
                lateNonQs.choice(s, p, c, choice);
            else if (choice.kind.startsWith('fate-'))
                fate.choice(s, p, c, choice);
            else if (choice.kind.startsWith('veil-late-'))
                veilLate.choice(s, p, c, choice);
            else if (choice.kind.startsWith('starlight-'))
                starlight.choice(s, p, c, choice);
            else if (choice.kind.startsWith('cq-'))
                cq.choice(s, p, c, choice);
            else if (choice.kind.startsWith('reverberation-')) {
                reverberation.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('bq-')) {
                bq.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('veiled-status-')) {
                veiledStatus.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('veil-tools-')) {
                veilTools.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('regional-synergy-')) {
                regionalSynergy.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('continuing-cost-')) {
                continuingCost.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('field-support-')) {
                fieldSupport.choice(s, p, c, choice);
            }
            else if (choice.kind === 'prediction-platform') {
                predictionTools.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('shoggoth-')) {
                shoggoth.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('green-')) {
                green.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('scarab-')) {
                scarab.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('yellow-')) {
                yellow.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('gray-')) {
                gray.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('entropy-')) {
                entropy.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('death-deck-')) {
                deathDeck.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('non-qs-')) {
                nonQs.choice(s, p, c, choice);
            }
            else if (choice.kind === 'spell-copy-targets')
                spellCopy.choice(s, p, c, choice);
            else if (choice.kind.startsWith('secrecy-batch-')) {
                secrecyBatch.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('criminal-')) {
                criminal.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('reality-')) {
                reality.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('discard-deck-')) {
                discardDeck.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('holy-')) {
                if (choice.canFail && c.fail === true) {
                    shuffle(s.players[p].deck);
                    finishSpell(s, a);
                }
                else
                    holy.choice(s, p, c, choice);
            }
            else if (choice.kind.startsWith('batch-')) {
                batchChoice(s, p, c, choice);
            }
            else if (choice.kind === 'top-select-hand') {
                const ids = c.cardIds;
                need(Array.isArray(ids) && ids.length >= choice.min && ids.length <= choice.max && new Set(ids).size === ids.length && ids.every(id => typeof id === 'string' && choice.eligibleIds.includes(id)), '请选择规定数量的角色或装备牌');
                need(choice.cardIds.every((id, i) => s.players[p].deck[i] === id), '牌库已经改变');
                beginEventGroup(s, a.id);
                for (const id of choice.cardIds)
                    move(s, id, ids.includes(id) ? 'hand' : 'graveyard');
                endEventGroup(s);
                log(s, `${s.seats[p].name}将${ids.length}张检视牌置于手中，其余置于墓地。`);
                finishSpell(s, a);
            }
            else if (choice.kind === 'grave-cycle-three') {
                const ids = c.cardIds;
                need(Array.isArray(ids) && ids.length === 3 && new Set(ids).size === 3 && ids.every(id => typeof id === 'string' && choice.cardIds.includes(id) && graveCards(s, p).includes(id) && s.cards[id].owner === p && inGrave(s, id)), '请选择恰好三张不同的本方墓地牌');
                const result = graveCycleComparison(ids.map(id => s.cards[id])), ordered = [...ids];
                shuffle(ordered);
                for (const id of ordered)
                    move(s, id, 'deck');
                log(s, `${s.seats[p].name}将${ids.map(id => s.cards[id].name).join('、')}以随机顺序置于牌库底。`);
                if (result.draw) {
                    log(s, '流转不息：满足三张费用或领域各不相同，抓一张牌。');
                    if (!draw(s, [p], 1))
                        return true;
                }
                if (result.repeat && graveCards(s, p).length >= 3) {
                    log(s, '流转不息：满足三张费用或领域相同，可选择重复。');
                    choose(s, a, 'grave-cycle-repeat', p, [], { canRepeat: graveCards(s, p).length >= 3, public: true });
                }
                else {
                    log(s, result.repeat ? '流转不息：墓地不足三张，结算结束。' : '流转不息：未满足重复条件，结算结束。');
                    finishSpell(s, a);
                }
            }
            else if (choice.kind === 'grave-cycle-repeat') {
                need(typeof c.repeat === 'boolean', '请选择是否重复流程');
                need(!c.repeat || choice.canRepeat && graveCards(s, p).length >= 3, '墓地不足三张，不能重复');
                if (c.repeat)
                    cycleThree(s, a);
                else {
                    log(s, '流转不息：不再重复，结算结束。');
                    finishSpell(s, a);
                }
            }
            else if (['seal-search', 'seal-hand', 'seal-top'].includes(choice.kind)) {
                const valid = liveSealHost(s, choice.hostRef);
                if (choice.kind === 'seal-search') {
                    if (c.fail === true)
                        need(choice.canFail, '不能放弃');
                    else
                        need(typeof c.cardId === 'string' && choice.cardIds.includes(c.cardId) && s.players[p].deck.includes(c.cardId), '请选择合法检索牌');
                    if (c.fail !== true && valid)
                        seal(s, c.cardId, choice.hostRef, { zone: 'deck', zoneVersion: s.locations[c.cardId].zoneVersion });
                    shuffle(s.players[p].deck);
                    log(s, '封印检索完成，牌库已洗牌。');
                }
                else if (choice.kind === 'seal-top') {
                    need(typeof c.seal === 'boolean', '请选择是否封印');
                    const id = choice.cardIds[0];
                    if (c.seal && valid && s.players[p].deck[0] === id)
                        seal(s, id, choice.hostRef, { zone: 'deck', zoneVersion: choice.sourceVersion });
                }
                else {
                    if (c.skip === true)
                        need(choice.canSkip, '此选择不能跳过');
                    else {
                        need(typeof c.cardId === 'string' && choice.cardIds.includes(c.cardId) && s.players[p].hand.includes(c.cardId), '请选择合法手牌');
                        need(!choice.discardAlternative || ['seal', 'discard'].includes(c.mode), '请选择弃牌或封印');
                        let done = false;
                        if (choice.discardAlternative && c.mode === 'discard') {
                            log(s, `${s.seats[p].name}展示并弃掉${s.cards[c.cardId].name}。`);
                            move(s, c.cardId, 'graveyard', { cause: 'discard', effectController: a.controller });
                            done = true;
                        }
                        else if (valid)
                            done = seal(s, c.cardId, choice.hostRef, { zone: 'hand', zoneVersion: s.locations[c.cardId].zoneVersion }, { faceDown: !!choice.faceDownSeal });
                        if (done && choice.drawAfter)
                            draw(s, [p], choice.drawAfter);
                    }
                }
                if (!valid)
                    log(s, '封印宿主失效，未改变所选牌的区域。');
                finishSpell(s, a);
            }
            else if (choice.kind === 'predict') {
                need(Array.isArray(c.top) && Array.isArray(c.bottom), '请选择牌库顺序');
                const all = [...c.top, ...c.bottom];
                need(all.length === choice.cardIds.length && new Set(all).size === all.length && all.every(id => choice.cardIds.includes(id)), '每张检视牌必须且只能安排一次');
                need(choice.cardIds.every((id, i) => s.players[p].deck[i] === id), '牌库已改变');
                s.players[p].deck = [...c.top, ...s.players[p].deck.slice(all.length), ...c.bottom];
                finishPrediction(s, choice, c, { event });
                if (choice.drawAfter)
                    draw(s, [p], choice.drawAfter);
                finishSpell(s, a);
            }
            else if (choice.kind === 'guess-cost') {
                need(Number.isSafeInteger(c.number) && c.number >= 0 && c.number <= 1000, '请选择非负整数费用');
                const top = s.players[p].deck[0];
                if (top) {
                    log(s, `${s.seats[p].name}选择费用${c.number}，展示${s.cards[top].name}（印刷费用${s.cards[top].printedCost}）。`);
                    rememberHardDeckCards(s, [top]);
                    move(s, top, s.cards[top].printedCost === c.number ? 'hand' : 'deck');
                }
                finishSpell(s, a);
            }
            else if (choice.kind === 'grave-bottom-destroy') {
                need(choice.cardIds.includes(c.cardId) && graveCards(s, p).includes(c.cardId), '请选择本方墓地角色');
                move(s, c.cardId, 'deck');
                const t = a.targets[0];
                if (live(s, p, a.plan, t))
                    destroy(s, t.cardId);
                finishSpell(s, a);
            }
            else if (choice.kind === 'exposed') {
                need(['add', 'remove', 'none'].includes(c.mode), '请选择暴露标志操作');
                const markers = s.players[choice.targetPlayer].markers;
                if (c.mode === 'add')
                    setCardMarker(s, s.players[choice.targetPlayer], 'markers', null, societyMarkers(markers.hidden, markers.exposed, 0, 1));
                if (c.mode === 'remove')
                    setCardMarker(s, s.players[choice.targetPlayer], 'markers', null, { ...markers, exposed: Math.max(0, markers.exposed - 1) });
                finishSpell(s, a);
            }
            else if (choice.kind === 'search' && choice.canFail && c.fail === true) {
                shuffle(s.players[p].deck);
                log(s, `${s.seats[p].name}未找到符合条件的牌，并将牌库洗牌。`);
                finishSpell(s, a);
            }
            else if (choice.kind === 'inspect') {
                need(c.confirm === true, '请确认检视结果');
                draw(s, [p], 1);
                finishSpell(s, a);
            }
            else {
                need(typeof c.cardId === 'string' && seatChoice(choice, p).cardIds.includes(c.cardId), '请选择合法卡牌');
                if (choice.kind === 'discard') {
                    need(s.players[p].hand.includes(c.cardId), '手牌已经改变');
                    const previous = s.discardBatch, batch = choice.discardBatch ?? { cards: [], group: a.id };
                    s.discardBatch = batch;
                    try {
                        move(s, c.cardId, 'graveyard', { cause: 'discard', effectController: a.controller });
                    }
                    finally {
                        if (previous)
                            s.discardBatch = previous;
                        else
                            delete s.discardBatch;
                    }
                    log(s, `${s.seats[p].name}弃掉${s.cards[c.cardId].name}。`);
                    if (!discard(s, a, p, (choice.remaining ?? 1) - 1, batch)) {
                        flushDiscardBatch(s, batch, event);
                        finishSpell(s, a);
                    }
                }
                else if (choice.kind === 'search' && choice.destination === 'source-district-hidden') {
                    need(s.players[p].deck.includes(c.cardId), '牌库已经改变');
                    const d = a.plan.sourceDistrict;
                    const valid = s.districts[d]?.id === a.plan.sourceDistrictCardId;
                    if (valid) {
                        if (choice.reveal)
                            log(s, `${s.seats[p].name}展示${s.cards[c.cardId].name}并秘密派遣至地区${d + 1}。`);
                        move(s, c.cardId, 'play', { controller: p, district: d, tapped: false, faceDown: true, hiddenHandle: uuid() });
                    }
                    shuffle(s.players[p].deck);
                    finishSpell(s, a);
                }
                else if (choice.kind === 'search' && choice.destination === 'source-district-play') {
                    need(s.players[p].deck.includes(c.cardId), '牌库已经改变');
                    const d = a.plan.sourceDistrict;
                    if (s.districts[d]?.id === a.plan.sourceDistrictCardId) {
                        log(s, `${s.seats[p].name}检索并将${s.cards[c.cardId].name}放置进场。`);
                        if (move(s, c.cardId, 'play', { controller: p, district: d, tapped: enterTapped(s, c.cardId, d) }))
                            event(s, c.cardId, 'entry', s.locations[c.cardId], a.id, { method: 'effect-placement' });
                    }
                    shuffle(s.players[p].deck);
                    finishSpell(s, a);
                }
                else if (choice.kind === 'search') {
                    need(s.players[p].deck.includes(c.cardId), '牌库已经改变');
                    move(s, c.cardId, choice.destination === 'graveyard' ? 'graveyard' : choice.destination === 'top' ? 'aside' : 'hand');
                    shuffle(s.players[p].deck);
                    if (choice.destination === 'top') {
                        move(s, c.cardId, 'deck');
                        s.players[p].deck = s.players[p].deck.filter(id => id !== c.cardId);
                        s.players[p].deck.unshift(c.cardId);
                    }
                    log(s, `${s.seats[p].name}完成牌库检索并洗牌${choice.reveal ? `，展示${s.cards[c.cardId].name}` : ''}。`);
                    finishSpell(s, a);
                }
                else if (choice.kind === 'sacrifice') {
                    if (choice.simultaneous) {
                        const selections = commitChoice(choice, p, { cardId: c.cardId }, (own, c) => need(own.cardIds.includes(c.cardId) && sacrificeIds(s, p, own.zone).includes(c.cardId), '请选择合法的本方牺牲牌'));
                        if (selections) {
                            beginEventGroup(s, a.id);
                            try {
                                withSimultaneousDepartures(s, selections.map(x => x.command.cardId), () => {
                                    for (const x of selections)
                                        if (sacrificeIds(s, x.player, x.choice.zone).includes(x.command.cardId))
                                            move(s, x.command.cardId, 'graveyard', { cause: 'sacrifice' });
                                });
                            }
                            finally {
                                endEventGroup(s);
                            }
                            stateBased(s);
                            finishSpell(s, a);
                        }
                    }
                    else {
                        need(choice.zone === 'asset' ? s.players[p].assets.some(x => x.id === c.cardId) : s.players[p].play.includes(c.cardId), '选择已经改变');
                        move(s, c.cardId, 'graveyard', { cause: 'sacrifice' });
                        stateBased(s);
                        continueSacrifice(s, a, choice.remainingPlayers, choice.zone);
                    }
                }
            }
            if (!s.effectChoice && s.status === 'playing') {
                if (s.turn?.step === 'recovery')
                    onTriggersChosen(s);
                else
                    openWindow(s);
            }
            return true;
        }
        if (s.effectChoice) {
            need(c.type === 'end-room' || c.type === 'concede', '能力结算尚未完成，当前没有快速行动窗口');
            return false;
        }
        const card = printedRulesCard(s, c.cardId);
        if (c.type === 'activate' && effectiveActions(s, c.cardId).length) {
            hasPriority(s, p);
            need(s.resolutionCasting || !s.triggerChoices.length, '请先完成触发选择');
            const l = s.locations[card.id];
            need(l.zone === 'play', '只能发动场上牌的能力');
            const index = c.actionIndex ?? 0;
            need(Number.isInteger(index) && !!effectiveActions(s, c.cardId)[index], '请选择已有主动能力');
            const plan = { ...effectiveActions(s, c.cardId)[index], actionIndex: index, sourceId: card.id, sourceDistrict: l.district, sourceDistrictCardId: s.districts[l.district]?.id, sourceZoneVersion: l.zoneVersion, sourceCounters: { ...l.counters, time: l.markers ?? 0 }, ...(effectiveActions(s, card.id)[index].snapshotMarkers ? { sourceMarkers: transferableMarkers(l) } : {}), sourceMagicDomains: effectiveMagicDomains(s, card.id), hostAttachment: l.attachedTo, hostAttachmentVersion: l.hostVersion, hostRef: sealHost(s, card.id) };
            const displayName = l.secretPlan && !plan.revealSecretCost && !plan.secretAction ? '秘密计划' : s.cards[card.id].name;
            need(controllerOf(s, card.id) === p || publicActionAllowed(s, p, card.id, plan), '只能发动本方场上牌的能力');
            need(!l.secretPlan || ['plan-progress', 'progress'].includes(plan.operation) || plan.secretAction || plan.revealSecretCost, '秘密计划尚未翻面，不能发动印刷正面能力');
            need(!l.faceDown || plan.allowHiddenSource, '暗藏者只能发动明确的暗藏者能力');
            if (plan.requiredDistrictTraits)
                need(plan.requiredDistrictTraits.some(t => districtTraits(s, l.district).includes(t)), '该能力只能在指定类型地区发动');
            if (plan.sourceHiddenOnly)
                need(l.faceDown, '该能力只能在暗藏者状态发动');
            if (plan.timing !== 'fast')
                standardAction(s, p);
            if (plan.declareSubtype) {
                need(typeof c.declaredSubtype === 'string' && c.declaredSubtype.trim().length > 0 && c.declaredSubtype.length <= 40, '请声明一个角色类别');
                plan.declaredSubtype = c.declaredSubtype.trim();
                log(s, `无序异体声明角色类别：${plan.declaredSubtype}。`);
            }
            if (plan.requiresHiddenMarker)
                need(effectiveSocietyMarkers(s, p).hidden > 0, '本方秘社须具有隐秘才能发动该能力');
            if (plan.actionPhaseOnly)
                need(s.turn.phase === 'action', '该能力只能在行动阶段发动');
            if (plan.oncePerRound) {
                const key = `${card.id}:${l.zoneVersion}:action:${index}${plan.perPlayer ? ':' + p : ''}`, used = s.abilityUses?.[key];
                need(!used || used.round !== s.round || used.count < plan.oncePerRound, '本回合该能力发动次数已用完');
                plan.usageKey = key;
            }
            need(!plan.tap || canTapCard(s, card.id), '该角色不能支付横置费用');
            const targets = prepare(s, p, c, plan);
            if (plan.multiMode)
                plan.selectedModes = selectedModeIds(plan, c);
            else if (plan.modes) {
                need(plan.modes.some(m => m.id === c.mode), '请选择能力模式');
                plan.selectedMode = c.mode;
            }
            if (plan.districtChoice) {
                need(Number.isInteger(c.district) && !!s.districts[c.district], '请选择地区');
                plan.destinationCardId = s.districts[c.district].id;
                if (plan.adjacentOnly)
                    need(adjacentDistricts(s, l.district).includes(c.district), '请选择相邻地区');
                need(!targets.some(t => t.kind === 'card' && s.locations[t.cardId].district === c.district), '不能原地移动');
            }
            validateBatchCost(s, p, c, plan);
            if (plan.sacrificeCharacter)
                need(s.players[p].play.includes(c.sacrificeId) && hasCardType(s.cards[c.sacrificeId], 'character') && !s.locations[c.sacrificeId].faceDown && !sacrificeCostBlocked(s, c.sacrificeId), '请选择本方正面角色作为牺牲费用');
            if (plan.discardCost)
                need(Array.isArray(c.discardIds) && c.discardIds.length === plan.discardCost && new Set(c.discardIds).size === plan.discardCost && c.discardIds.every(id => s.players[p].hand.includes(id) && filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id) }, plan.discardFilter)), '请选择规定类型和数量的手牌作为弃牌费用');
            const sacrifices = plan.sacrificeCharacters ? c.sacrificeIds : [];
            if (plan.sacrificeCharacters) {
                const allowed = sacrificeOptions(s, p, plan);
                need(Array.isArray(sacrifices) && sacrifices.length === plan.sacrificeCharacters.count && new Set(sacrifices).size === sacrifices.length && sacrifices.every(id => typeof id === 'string' && allowed.includes(id)), '请选择规定数量的不同合法本方角色作为牺牲费用');
                plan.sacrificedSubtypes = sacrifices.flatMap(id => effectiveSubtypes(s, id));
            }
            if (plan.sacrificeSelf)
                need(!sacrificeCostBlocked(s, card.id), '永恒牌或受诡异面容保护的角色不能支付牺牲费用');
            if (plan.secretAction && l.secretPlan)
                log(s, `公开秘密计划：${s.cards[card.id].name}。`);
            if (plan.revealSecretCost) {
                need(s.locations[card.id].secretPlan, '该能力只能从秘密计划状态翻面发动');
                s.locations[card.id].secretPlan = false;
            }
            const sacrificeDiscount = unstableAbilityDiscount(s, plan, c), totalPayment = Math.max(0, plan.cost + (plan.extraCost ? c.extraCost : 0) - (plan.tapCharacters?.reduceCost ? (c.tapIds?.length ?? 0) : 0) - sacrificeDiscount), ordinaryPayment = Math.min(totalPayment, Math.max(0, plan.cost + (plan.costX ? c.extraCost : 0) - (plan.tapCharacters?.reduceCost ? (c.tapIds?.length ?? 0) : 0) - sacrificeDiscount));
            payActionFee(s, p, c, ordinaryPayment, { pay, eligible: ownActionPayment(s, p, card.id), blockedIds: [...(plan.tap || plan.tapOrAssetBottom && c.costMode === 'tap' ? [card.id] : []), ...(c.tapIds ?? []), ...(plan.alternativeCost && c.costMode === 'tap' ? [c.costCardId] : [])], additional: totalPayment - ordinaryPayment, deferTap: true });
            plan.actionPaymentTaps = (c.actionPayments ?? []).map(x => x.cardId);
            if (plan.extraCost) {
                plan.chosenX = c.extraCost;
                plan.extraPaid = c.extraCost;
            }
            if (plan.oncePerRound) {
                s.abilityUses ??= {};
                const used = s.abilityUses[plan.usageKey];
                s.abilityUses[plan.usageKey] = { round: s.round, count: (used?.round === s.round ? used.count : 0) + 1 };
            }
            const costGroup = `cost:${c.id}`;
            if (!plan.immediate) {
                s.flow = pushAbility(s.flow, p, { id: c.id, kind: 'auto-ability', cardId: card.id, controller: p, displayName, abilityDescription: abilityDescription(s, { cardId: card.id, plan }), plan, district: c.district, targets });
            }
            if (!plan.immediate) {
                log(s, `${displayName}的行动能力进入堆叠${paidCostsClause(s, totalPayment, plan, c)}${effectObjectsLog(s, targets)}。`);
            }
            beginEventGroup(s, costGroup);
            payCostBatch(s, [...(plan.sacrificeSelf ? [card.id] : []), ...(plan.sacrificeCharacter ? [c.sacrificeId] : []), ...sacrifices], () => {
                payBatchCost(s, p, c, plan);
                discardMany(s, plan.discardCost ? c.discardIds : [], move, event, { cause: 'cost' });
                if (plan.sacrificeSelf) {
                    move(s, card.id, 'graveyard', { cause: 'sacrifice' });
                    plan.sourceAfterCostVersion = s.locations[card.id].zoneVersion;
                }
                if (plan.sacrificeCharacter)
                    move(s, c.sacrificeId, 'graveyard', { cause: 'sacrifice' });
                for (const id of sacrifices)
                    move(s, id, 'graveyard', { cause: 'sacrifice' });
            });
            endEventGroup(s);
            if (plan.sacrificeSelf)
                plan.sourceAfterCostVersion = s.locations[card.id].zoneVersion;
            const entry = s.flow.stack.find(a => a.id === c.id);
            if (entry)
                entry.plan = structuredClone(plan);
            if (plan.immediate) {
                resolve(s, { kind: 'auto-ability', cardId: card.id, controller: p, plan, targets: [] });
                s.flow.passed = [];
                return true;
            }
            announce(s, p, null, c.id, plan.bottomDomainHandCost || plan.tapOrAssetBottom || plan.societyShuffleCost || plan.graveBottomCost || plan.abandonScoreCost || plan.handSealCost || plan.graveSealCost || plan.graveShuffleCost || plan.sacrificeSelf || plan.sacrificeCharacter || plan.sacrificeCharacters || plan.sacrificeAttached || plan.sacrificeAsset || plan.removeTimeCost || plan.progressCost || plan.sacrificeAssetOrPlan || plan.timeCostX || plan.tapCharacters || plan.discardCost || plan.tap || plan.scoreSelfCost || plan.returnGrantedCost || c.actionPayments?.length ? costGroup : null);
            return true;
        }
        if (c.type !== 'play' || !((hasCardType(card, 'spell') || hasCardType(card, 'task')) && card.spell || hasCardType(card, 'attachment') && card.attachment))
            return false;
        hasPriority(s, p);
        need(s.resolutionCasting || !s.triggerChoices.length, '请先完成触发选择');
        const permission = castSourceStatus(s, p, card.id);
        need(permission.allowed, permission.reason);
        const sealedMethods = s.locations[card.id]?.zone === 'sealed' ? sealedCastMethods(s, p, card.id, castSourceStatus(s, p, card.id, { ignorePalace: true }).allowed) : [], sealedMethod = sealedMethods.find(m => m.id === (c.sealedCastMethod ?? sealedMethods[0]?.id));
        need(!sealedMethods.length || sealedMethod, '请选择有效的封印区打出方式');
        if ((card.spell ?? card.attachment).actionPhaseOnly)
            need(s.turn.phase === 'action', '该牌只能在行动阶段打出');
        if (effectiveCastPlan(s, p, card).timing !== 'fast')
            standardAction(s, p);
        const castFromZone = s.locations[card.id].zone, original = card.spell ?? card.attachment, fromGrave = inGrave(s, card.id), graveMethod = selectedGraveCast(s, p, card.id, c.graveCastMethod), hades = graveMethod?.id === 'hades', hadesIds = c.hadesIds ?? [], free = lotusFreeCast(s, p, card), base = { ...effectiveCastPlan(s, p, card), castFromZone, sourceMagicDomains: effectiveMagicDomains(s, card.id), graveCastMethod: graveMethod?.id, ...(!free && graveMethod?.discardCost ? { discardCost: graveMethod.discardCost, discardFilter: graveMethod.discardFilter } : {}) }, targets = prepare(s, p, c, { ...base, cardId: card.id });
        if (base.contingencySource) {
            const source = c.contingencySourceId ?? base.contingencySource;
            need(contingencySources(s, p, card).includes(source), '请选择当前可用的应急预案许可');
            base.contingencySource = source;
            base.contingencyVersion = s.locations[source].zoneVersion;
        }
        if (hades && !free)
            need(Array.isArray(hadesIds) && hadesIds.length === 2 && new Set(hadesIds).size === 2 && hadesIds.every(x => hadesCosts(s, p, card.id).includes(x)), '哈迪斯需要两张其他同主类别墓地牌作为回底费用');
        ;
        if (base.gunfireNegotiation)
            base.selectedMode = c.mode;
        if (base.cqRepeatModes)
            base.selectedCQModes = [...c.modes];
        if (base.multiMode)
            base.selectedModes = selectedModeIds(base, c);
        else
            need(base.cqRepeatModes || !base.modes || base.modes.some(m => m.id === c.mode), '请选择能力模式');
        if (base.districtChoice)
            need(Number.isInteger(c.district) && !!s.districts[c.district], '请选择地区');
        if (!free)
            checkLoyalty(s, p, card);
        if (free && original.extraCost && !original.costX)
            need(targets.length === 1 && s.cards[targets[0].cardId]?.printedCost === 0, '忽略费用时X为0，只能选择印刷费用为0的目标');
        if (base.secretPlan && c.secret === true) {
            need(effectiveSocietyMarkers(s, p).hidden > 0, '只有秘社具有隐秘标志时才能秘密打出计划');
            base.playSecret = true;
        }
        validateBatchCost(s, p, c, base);
        if (base.districtChoice) {
            base.destinationCardId = s.districts[c.district].id;
            need(!targets.some(t => t.kind === 'card' && s.locations[t.cardId].district === c.district), '不能原地移动');
        }
        const sacrifices = base.sacrificeCharacters ? (c.sacrificeIds ?? []) : [];
        if (base.sacrificeCharacters) {
            const allowed = sacrificeOptions(s, p, base);
            need(Array.isArray(sacrifices) && (base.sacrificeCharacters.variable || sacrifices.length === base.sacrificeCharacters.count) && new Set(sacrifices).size === sacrifices.length && sacrifices.every(id => typeof id === 'string' && allowed.includes(id)), '请选择规定数量的不同合法本方角色作为牺牲费用');
            base.sacrificedCount = sacrifices.length;
            if (base.sacrificeCharacters.costSumX) {
                base.chosenX = sacrifices.reduce((n, id) => n + s.cards[id].printedCost, 0) - (graveMethod?.sacrificeOffset ?? 0);
                need(base.chosenX >= 0, '从墓地打出不死族的复生时，牺牲角色的印刷费用总和至少为2');
            }
        }
        if (base.sacrificeCharacter)
            need(s.players[p].play.includes(c.sacrificeId) && hasCardType(s.cards[c.sacrificeId], 'character') && !s.locations[c.sacrificeId].faceDown && !sacrificeCostBlocked(s, c.sacrificeId), '请选择本方正面角色作为额外牺牲费用');
        if (base.discardCost)
            need(Array.isArray(c.discardIds) && c.discardIds.length === base.discardCost && new Set(c.discardIds).size === base.discardCost && c.discardIds.every(id => s.players[p].hand.includes(id) && id !== card.id && filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id) }, base.discardFilter)), '请选择规定数量的其他合格手牌作为额外弃牌费用');
        if (base.extraCost)
            base.chosenX = c.extraCost;
        const additionalReduction = unstableSacrificeDiscount(s, [...sacrifices, ...(base.sacrificeCharacter ? [c.sacrificeId] : [])]) + (base.tapCharacters?.reduceCost ? (c.tapIds?.length ?? 0) : 0) + (base.timeCastingDiscount ? (c.timePayments ?? []).reduce((n, x) => n + x.count, 0) : 0), requiredCost = free ? 0 : castingCost(s, p, card, 'play', targets, base.extraCost ? base.chosenX : 0, additionalReduction);
        if (graveMethod)
            log(s, `${s.seats[p].name}选择墓地打出方式：${graveMethod.label}。`);
        pay(s, p, requiredCost);
        consumeSealedCast(s, p, card.id, sealedMethod);
        if (base.extraCost)
            base.extraPaid = free ? 0 : c.extraCost;
        consumeDiscounts(s, p, card, 'play');
        ;
        const costGroup = `cost:${c.id}`;
        beginEventGroup(s, costGroup);
        move(s, card.id, 'aside');
        s.players[p].aside = s.players[p].aside.filter(id => id !== card.id);
        setLocation(s, card.id, 'stack', { castFromZone, controller: p, ...(base.chosenX !== undefined ? { chosenX: base.chosenX } : {}), ...(free ? { waivedOptionalExtraCosts: true } : {}), ...(base.playSecret ? { secretPlan: true } : {}) });
        consumeContingencyCast(s, base);
        s.flow = pushAbility(s.flow, p, { id: c.id, kind: 'play-spell', cardId: card.id, controller: p, displayName: base.playSecret ? '秘密计划' : card.name, mode: c.mode ?? null, plan: base, district: c.district ?? null, targets });
        log(s, `${s.seats[p].name}打出${base.playSecret ? '秘密计划' : card.name}${paidCostsClause(s, requiredCost, base, c)}${base.chosenX !== undefined ? `（X=${base.chosenX}）` : ''}${effectObjectsLog(s, targets)}，进入堆叠。`);
        payCostBatch(s, [...sacrifices, ...(base.sacrificeCharacter ? [c.sacrificeId] : [])], () => {
            if (hades && !free)
                for (const id of hadesIds)
                    move(s, id, 'deck', { cause: 'cost' });
            payBatchCost(s, p, c, base);
            for (const id of sacrifices) {
                log(s, `额外费用：牺牲${s.cards[id].name}，费用支付不能被响应。`);
                move(s, id, 'graveyard', { cause: 'sacrifice' });
            }
            if (base.sacrificeCharacter) {
                log(s, `额外费用：牺牲${s.cards[c.sacrificeId].name}，费用支付不能被响应。`);
                move(s, c.sacrificeId, 'graveyard', { cause: 'sacrifice' });
            }
            discardMany(s, base.discardCost ? c.discardIds : [], move, event, { cause: 'cost' });
        });
        endEventGroup(s);
        s.flow.stack.find(a => a.id === c.id).plan = structuredClone(base);
        announce(s, p, card.id, c.id, base.sacrificeCharacter || base.sacrificeCharacters || base.sacrificeAsset || base.tapCharacters || base.discardCost || base.timeCostX || base.alternativeCost || hades ? costGroup : null);
        return true;
    }
    function validateTrigger(s, p, c, a) {refreshTriggerPrice(s,a);
        const plan = a.plan;
        ;
        need(!['graveyard', 'headquarters'].includes(plan.sourceSnapshot?.zone) || !graveyardLocked(s, a.cardId, p, plan.sourceSnapshot.zone), '镇魂曲禁止在墓地中发动能力');
        const targets = plan.fixedTarget ? prepare(s, p, { targetIds: [plan.fixedTarget] }, plan) : prepare(s, p, c, plan);
        validateBatchCost(s, p, c, plan);
        if (plan.tap)
            need(sourceLive(s, plan) && canTapCard(s, a.cardId), '触发来源已离场或已横置，不能支付横置费用');
        if (plan.discardCost)
            need(Array.isArray(c.discardIds) && c.discardIds.length === plan.discardCost && new Set(c.discardIds).size === c.discardIds.length && c.discardIds.every(id => s.players[p].hand.includes(id) && filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id) }, plan.discardFilter)), '请选择符合条件的弃牌费用');
        if (plan.sacrificeSelf)
            need(sourceLive(s, plan) && !sacrificeCostBlocked(s, a.cardId), '来源不能支付牺牲费用');
        if (plan.sacrificeCharacter)
            need(s.players[p].play.includes(c.sacrificeId) && !s.locations[c.sacrificeId].faceDown && hasCardType(s.cards[c.sacrificeId], 'character') && !sacrificeCostBlocked(s, c.sacrificeId), '请选择合法的本方角色作为牺牲费用');
        if (plan.sacrificeCharacters) {
            const ids = c.sacrificeIds ?? [], allowed = sacrificeOptions(s, p, plan);
            need(Array.isArray(ids) && new Set(ids).size === ids.length && (plan.sacrificeCharacters.variable || ids.length === plan.sacrificeCharacters.count) && ids.every(id => allowed.includes(id)), '请选择规定数量的合法本方角色作为牺牲费用');
        }
        if (plan.modes)
            need(plan.modes.some(m => m.id === c.mode), '请选择能力模式');
        if (plan.oncePerRound) {
            const used = s.abilityUses?.[plan.usageKey];
            need(!used || used.round !== s.round || used.count < plan.oncePerRound, '本回合该能力已经发动过');
        }
        need((s.players[p].costPool ?? 0) + s.players[p].assets.filter(x => !x.tapped).length >= Math.max(0, (plan.optionalHiddenCost ? s.cards[targets[0]?.cardId]?.printedCost : plan.cost ?? 0) + (plan.extraCost ? c.extraCost : 0) - unstableAbilityDiscount(s, plan, c)), '费用池及未横置资产不足');
        return targets;
    }
    function activateTrigger(s, p, c, a) {
        const plan = a.plan, targets = validateTrigger(s, p, c, a);
        if (plan.modes)
            a.mode = c.mode;
        if (plan.oncePerRound) {
            s.abilityUses ??= {};
            const used = s.abilityUses[plan.usageKey];
            s.abilityUses[plan.usageKey] = { round: s.round, count: (used?.round === s.round ? used.count : 0) + 1 };
        }
        const fee = plan.optionalHiddenCost ? s.cards[targets[0].cardId].printedCost : plan.cost ?? 0;
        const paidFee = Math.max(0, fee + (plan.extraCost ? c.extraCost : 0) - unstableAbilityDiscount(s, plan, c));
        pay(s, p, paidFee);
        if (plan.optionalHiddenCost) {
            plan.exactPrintedCost = fee;
            plan.extraPaid = fee;
        }
        a.targets = targets;
        log(s, `${a.displayName ?? s.cards[a.cardId]?.name ?? '卡牌'}发动触发能力${paidCostsClause(s, paidFee, plan, c)}${effectObjectsLog(s, targets)}。`);
        const previous = s.eventGroup, batch = s.deathBatch, parent = s.costTriggerParent;
        s.costTriggerParent = a.id;
        beginEventGroup(s, `cost:${c.id}`);
        try {
            payCostBatch(s, [...(plan.sacrificeSelf ? [a.cardId] : []), ...(plan.sacrificeCharacter ? [c.sacrificeId] : []), ...(plan.sacrificeCharacters ? c.sacrificeIds ?? [] : [])], () => {
                payBatchCost(s, p, c, plan);
                if (plan.discardCost)
                    discardMany(s, c.discardIds, move, event, { cause: 'cost' });
                if (plan.sacrificeSelf) {
                    need(move(s, a.cardId, 'graveyard', { cause: 'sacrifice' }), '无法支付牺牲费用');
                    plan.sourceAfterCostVersion = s.locations[a.cardId].zoneVersion;
                }
                if (plan.sacrificeCharacter)
                    need(move(s, c.sacrificeId, 'graveyard', { cause: 'sacrifice' }), '无法支付牺牲费用');
                for (const id of plan.sacrificeCharacters ? c.sacrificeIds ?? [] : [])
                    need(move(s, id, 'graveyard', { cause: 'sacrifice' }), '无法支付牺牲费用');
            });
        }
        finally {
            endEventGroup(s);
            if (previous)
                s.eventGroup = previous;
            if (batch)
                s.deathBatch = batch;
            if (parent === undefined)
                delete s.costTriggerParent;
            else
                s.costTriggerParent = parent;
        }
        if (plan.sacrificeSelf)
            plan.sourceAfterCostVersion = s.locations[a.cardId].zoneVersion;
        flushPlayerEvents(s, event);
        trigger(s, a);
        flushTriggerCosts(s);
    }
    function costedTrigger(s, a) { const p = a.plan; return p.triggerCost || p.optionalHiddenCost || (p.cost ?? 0) > 0 || ['abandonScoreCost', 'sourceWoundCost', 'graveShuffleCost', 'tap', 'discardCost', 'concealSelfCost', 'sealedBottomCost', 'societyShuffleCost', 'graveBottomCost', 'handSealCost', 'honorCost', 'societyMarkerCost', 'sacrificeAttached', 'returnGrantedCost', 'sourceProgressCost', 'progressCost', 'sacrificeAssetOrPlan', 'sourceTimeCost', 'graveSealCost', 'alternativeCost', 'counterCost', 'scoreSelfCost', 'timeCostX', 'tapCharacters', 'sacrificeAsset', 'extraCost', 'removeTimeCost', 'sacrificeSelf', 'sacrificeCharacter', 'sacrificeCharacters'].some(k => p[k]); }
    function triggerUnavailable(s, a) {
        refreshTriggerPrice(s, a);
        const plan = a.plan, p = a.controller;
        if (plan.oncePerRound && s.abilityUses?.[plan.usageKey]?.round === s.round && s.abilityUses[plan.usageKey].count >= plan.oncePerRound)
            return true;
        if (plan.tap && (!sourceLive(s, plan) || !canTapCard(s, plan.sourceId)))
            return true;
        if (plan.sacrificeSelf && (!sourceLive(s, plan) || sacrificeCostBlocked(s, plan.sourceId)))
            return true;
        if (plan.discardCost && s.players[p].hand.filter(id => filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id) }, plan.discardFilter)).length < plan.discardCost)
            return true;
        const potentialSacrifices = [...(plan.sacrificeSelf ? [plan.sourceId] : []), ...(plan.sacrificeCharacter ? s.players[p].play.filter(id => !s.locations[id].faceDown && hasCardType(s.cards[id], 'character') && !sacrificeCostBlocked(s, id)).sort((a, b) => unstableSacrificeDiscount(s, [b]) - unstableSacrificeDiscount(s, [a])).slice(0, 1) : []), ...(plan.sacrificeCharacters ? sacrificeOptions(s, p, plan).sort((a, b) => unstableSacrificeDiscount(s, [b]) - unstableSacrificeDiscount(s, [a])).slice(0, plan.sacrificeCharacters.count) : [])];
        if ((s.players[p].costPool ?? 0) + s.players[p].assets.filter(x => !x.tapped).length < Math.max(0, (plan.cost ?? 0) - unstableSacrificeDiscount(s, potentialSacrifices)))
            return true;
        if (plan.sacrificeCharacters && !plan.sacrificeCharacters.variable && sacrificeOptions(s, p, plan).length < plan.sacrificeCharacters.count)
            return true;
        if (plan.sourceWoundCost && (!sourceLive(s, plan) || woundsPrevented(s, plan.sourceId)))
            return true;
        if (plan.sourceTimeCost && (!sourceLive(s, plan) || (s.locations[plan.sourceId].markers ?? 0) < plan.sourceTimeCost))
            return true;
        if (plan.sourceProgressCost && (!sourceLive(s, plan) || progressCount(s, plan.sourceId) < plan.sourceProgressCost))
            return true;
        if (plan.honorCost && (s.players[p].honor ?? 0) < plan.honorCost)
            return true;
        if (plan.societyMarkerCost && s.players[p].markers[plan.societyMarkerCost] < 1)
            return true;
        if (plan.tapCharacters && tapOptions(s, p, plan).length < (plan.tapCharacters.count ?? 0))
            return true;
        if (plan.sacrificeAsset && !s.players[p].assets.length)
            return true;
        if (plan.sacrificeAttached && !attachedSacrifices(s, p).length)
            return true;
        if (plan.graveShuffleCost && graveCards(s, p).filter(id => filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id), magicDomains: effectiveMagicDomains(s, id) }, plan.graveShuffleCost.filter)).length < plan.graveShuffleCost.count)
            return true;
        if (plan.graveSealCost && graveCards(s, p).filter(id => !s.cards[id].token && filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id), magicDomains: effectiveMagicDomains(s, id) }, plan.graveSealCost.filter)).length < plan.graveSealCost.count)
            return true;
        if (plan.sealedBottomCost && !sealedOn(s, plan.sourceId).some(id => filterCard({ ...s.cards[id], magicDomains: effectiveMagicDomains(s, id) }, plan.sealedBottomCost.filter)))
            return true;
        if (plan.societyShuffleCost && !societyShuffleCosts(s, p, plan.societyShuffleCost.name).length)
            return true;
        if (plan.graveBottomCost && !graveBottomCosts(s, p, plan).length)
            return true;
        if (plan.handSealCost && !s.players[p].hand.some(id => filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id) }, plan.handSealFilter)))
            return true;
        if (['none', 'hidden-up-to-two', 'characters-up-to-two'].includes(plan.target) || plan.optionalTarget || plan.target === 'gray-biology' && (plan.sourceCounters?.progress ?? 0) < 3)
            return false;
        const opts = options(s, p, plan);
        if (plan.fixedTarget)
            return !opts.some(o => o.id === plan.fixedTarget);
        return !opts.length;
    }
    function payOfferedTrigger(s, a) {
        if (triggerUnavailable(s, a)) {
            log(s, `${a.displayName}当前无法支付费用或没有合法目标，不发动。`);
            return;
        }
        const c = triggerCostDecision(s, a, options(s, a.controller, a.plan));
        if (!c.fire) {
            need(!a.mandatory, '强制触发必须发动');
            log(s, `${a.displayName}选择不发动。`);
            return;
        }
        a.committed = true;
        a.prepaid = !!costedTrigger(s, a);
        activateTrigger(s, a.controller, { ...c, id: `${a.id}:payment` }, a);
        log(s, `${a.displayName}已支付触发费用，等待触发轮入栈。`);
    }
    function payTriggerBatch(s,abilities){
  const available=abilities.filter(a=>!triggerUnavailable(s,a));if(!available.length)return;
  if(available.length===1){payOfferedTrigger(s,available[0]);return;}
  const c=triggerCostBatchDecision(s,available.map(a=>({...a,targetOptions:options(s,a.controller,a.plan)}))),ds=c.decisions;
  need(ds.length===available.length&&new Set(ds.map(d=>d.triggerId)).size===available.length&&ds.every(d=>available.some(a=>a.id===d.triggerId)&&typeof d.fire==='boolean'),'请为每条触发选择是否支付费用');
  const accepted=ds.filter(d=>d.fire),order=c.abilityIds??accepted.map(d=>d.triggerId);need(order.length===accepted.length&&new Set(order).size===order.length&&order.every(id=>accepted.some(d=>d.triggerId===id)),'请选择本批触发费用的支付顺序');
  for(const a of available){const d=ds.find(d=>d.triggerId===a.id);need(!a.mandatory||d.fire,'强制触发必须发动');if(d.fire)validateTrigger(s,a.controller,d,a);}
  for(const id of order){const a=available.find(a=>a.id===id),d=ds.find(d=>d.triggerId===id);if(triggerUnavailable(s,a)){log(s,`${a.displayName}已无法支付费用或已达次数上限，不发动。`);continue;}let valid=true;try{validateTrigger(s,a.controller,d,a);}catch(e){if(!(e instanceof RuleError))throw e;valid=false;}if(!valid){log(s,`${a.displayName}本批费用已被其他能力消耗，不发动。`);continue;}a.committed=true;a.prepaid=!!costedTrigger(s,a);activateTrigger(s,a.controller,{...d,id:`${a.id}:payment`},a);}
 }
    function flushTriggerCosts(s,opts={}){flushCostQueue(s,(_,a)=>a.kind==='auto-ability'?payOfferedTrigger(s,a):a.kind==='environment-ability'?ctx.payEnvironmentTrigger(s,a):ctx.commitTrigger(s,a),{...opts,activateBatch:payTriggerBatch});}
    function offerTrigger(s,a){
  a.abilityDescription??=abilityDescription(s,a);
  if(a.plan.predictionTapCost)a.plan.cost=s.hiddenWins?.[a.controller]===s.round?0:2;
  if(lateTriggerTiming(s)){s.triggerChoices.push(a);return;}
  if(earlyTriggerTiming(s)){if(a.mandatory&&a.plan.target==='none'&&!a.plan.oncePerRound&&!costedTrigger(s,a)){a.committed=true;trigger(s,a);return;}if(!deferTriggerCost(s,a))payOfferedTrigger(s,a);return;}
  if(!costedTrigger(s,a)){if(a.mandatory&&a.plan.target==='none')trigger(s,a);else s.triggerChoices.push(a);return;}
  if(!deferTriggerCost(s,a))payOfferedTrigger(s,a);
 }
    function emit(s, id, def, event, loc, group, extra = {}) {
        const cqState = cqTriggerState(s, id, def, loc);
        if (cqState === false)
            return;
        extra = { ...extra, ...cqState };
        if (def.condition === 'assets-three-domains' && assetDomains(s, loc.controller ?? s.cards[id].owner).length < 3)
            return;
        if (def.condition === 'society-sealed-round' && s.societySealedRound?.[loc.controller ?? s.cards[id].owner] !== s.round)
            return;
        if (def.condition === 'vampire-or-hidden' && !vampireOrHidden(s, loc.controller ?? s.cards[id].owner))
            return;
        if (def.minimumHidden !== undefined && effectiveSocietyMarkers(s, loc.controller ?? s.cards[id].owner).hidden < def.minimumHidden)
            return;
        if (def.condition === 'industry-attachment' && !controlsIndustry(s, loc.controller ?? s.cards[id].owner))
            return;
        if (def.countFrom === 'source-all-battle')
            extra = { ...extra, sourceBattleCount: effectiveIcons(s, id, true).battle };
        if (def.condition === 'first' && !firstAbilitiesActive(s, loc.controller ?? s.cards[id].owner))
            return;
        if (def.target === 'ordered-assault') {
            const targetCount = Math.min(3, effectiveSocietyMarkers(s, loc.controller ?? s.cards[id].owner).hidden);
            if (!targetCount)
                return;
            extra = { ...extra, targetCount };
        }
        if (def.condition === 'society-sealed-name' && !sealedOn(s, `society:${loc.controller ?? s.cards[id].owner}`).some(sid => matchesCardNameFilter(s.cards[sid], { name: def.sealedName })))
            return;
        if (def.condition === 'hidden' && effectiveSocietyMarkers(s, loc.controller ?? s.cards[id].owner).hidden <= 0)
            return;
        if (def.condition === 'source-time-zero' && (loc.markers ?? 0) > 0)
            return;
        if (def.condition === 'grave-seven' && graveCards(s, loc.controller ?? s.cards[id].owner, id).length < 7)
            return;
        if (def.condition === 'wild-or-destroyed' && !wildOrDestroyed(s, loc.district))
            return;
        const card = printedRulesCard(s, id);
        if (extra.sourceSilenced ?? abilitiesSuppressed(s, id, loc))
            return;
        if (def.condition === 'death-society' && !deathSocietyCondition(s, loc.controller ?? card.owner) || def.condition === 'ghoul-end' && !ghoulEndCondition(s, loc.controller ?? card.owner, { sourceDistrict: loc.district, sourceDistrictCardId: s.districts[loc.district]?.id }))
            return;
        if (def.condition === 'won-hidden-round' && s.hiddenWins?.[loc.controller ?? card.owner] !== s.round)
            return;
        if (def.condition === 'enemy-hand-at-most-three' && s.players[1 - (loc.controller ?? card.owner)].hand.length > 3)
            return;
        if (def.condition === 'most-hand' && !s.players.every((pl, i) => i === (loc.controller ?? card.owner) || s.players[loc.controller ?? card.owner].hand.length > pl.hand.length))
            return;
        if (def.societyName && currentSocietyName(s, loc.controller ?? card.owner) !== def.societyName)
            return;
        if (def.condition === 'green-assets' && !s.players[loc.controller ?? card.owner].assets.some(a => (a.factionColors ?? [a.faction?.split('·')[0]]).includes('绿')))
            return;
        if (def.condition === 'purple-assets' && !s.players[loc.controller ?? card.owner].assets.some(a => (a.factionColors ?? [a.faction?.split('·')[0]]).includes('紫')))
            return;
        if (def.condition === 'holy-assets' && !s.players[loc.controller ?? card.owner].assets.some(a => a.magicDomains?.includes('神圣')))
            return;
        if (['graveyard', 'headquarters'].includes(loc.zone) && graveyardLocked(s, id, card.owner, loc.zone))
            return;
        if (def.hostOwnRoleOrAttachment && (extra.eventHost?.kind !== 'card' || s.locations[extra.eventHost.hostId]?.zone !== 'play' || !hasAnyCardType(s.cards[extra.eventHost.hostId], ['character', 'attachment']) || controllerOf(s, extra.eventHost.hostId) !== (loc.controller ?? card.owner)))
            return;
        if (def.condition === 'sealed-to-character' && (extra.eventHost?.kind !== 'card' || !hasCardType(s.cards[extra.eventHost.hostId], 'character')))
            return;
        if (def.condition === 'lotus-moon' && !lotusHasSeal(s, id, '江月'))
            return;
        if (def.condition === 'has-seals' && !sealedOn(s, id).length)
            return;
        if (def.firstCounterEachRound) {
            s.firstCounterTriggerRounds ??= {};
            const stamp = id + ':' + loc.zoneVersion;
            if (s.firstCounterTriggerRounds[stamp] === s.round)
                return;
            s.firstCounterTriggerRounds[stamp] = s.round;
        }
        const plan = { ...def, sourceId: id, sourceDistrict: def.returnDistrict ?? loc.district, sourceZoneVersion: loc.zoneVersion, sourceDistrictCardId: s.districts?.[def.returnDistrict ?? loc.district]?.id, sourceCounters: { ...loc.counters, time: loc.markers ?? 0 }, sourceMagicDomains: effectiveMagicDomains(s, id), hostAttachment: loc.attachedTo, hostAttachmentVersion: loc.hostVersion, hostRef: sealHost(s, id), sourceSnapshot: { zone: loc.zone, zoneVersion: loc.zoneVersion, faceDown: !!loc.faceDown, controller: loc.controller ?? card.owner, district: loc.district, optionalExtraPaid: !!loc.optionalExtraPaid, waivedOptionalExtraCosts: !!loc.waivedOptionalExtraCosts }, ...extra };
        if (plan.oncePerRound) {
            const used = s.abilityUses?.[plan.usageKey];
            if (used?.round === s.round && used.count >= plan.oncePerRound)
                return;
        }
        if (!lateTriggerTiming(s) && event === 'death' && String(plan.target).startsWith('own-grave'))
            plan.eventTargetRefs = options(s, loc.controller ?? card.owner, plan).filter(o => !(s.simultaneousDepartureIds ?? []).includes(actual(s, o.id))).map(o => ({ id: o.id, zone: s.locations[actual(s, o.id)]?.zone, zoneVersion: s.locations[actual(s, o.id)]?.zoneVersion }));
        registerGroup?.(s, group);
        const a = { id: uuid(), kind: 'auto-ability', event, cardId: id, sourceId: id, ...((extra.triggerAfter ?? s.activatingPrepaid ?? s.costTriggerParent) ? { triggerAfter: extra.triggerAfter ?? s.activatingPrepaid ?? s.costTriggerParent } : {}), controller: loc.controller ?? card.owner, displayName: loc.faceDown ? `暗藏者 · ${def.abilityLabel ?? '触发能力'}` : def.abilityLabel ? `${card.name} · ${def.abilityLabel}` : card.name, group, plan, targets: [], mandatory: !!def.mandatory };
        const repeats = extra.ownDeathAbility ? hostDeathRepeats(s, id, loc, group) : 0;
        for (let i = 0; i <= repeats; i++) {
            const copy = i ? { ...a, id: uuid(), plan: { ...a.plan } } : a;
            if (repeats)
                copy.plan.chooseTriggerOrder = true;
            offerTrigger(s, copy);
        }
    }
    function hostDeathRepeats(s, id, loc, group) {
        const batch = s.deathBatch?.group === group ? s.deathBatch : null, subject = batch?.subjects[id], types = subject?.subtypes ?? effectiveSubtypes(s, id);
        if (!hasCardType(subject ?? s.cards[id], 'character') || !types.includes('宿主'))
            return 0;
        const sources = batch?.sources ?? s.players.flatMap(p => p.play).map(source => ({ id: source, loc: s.locations[source], card: printedRulesCard(s, source) }));
        return sources.filter(({ card, loc: sl }) => sl?.zone === 'play' && !sl.faceDown && (sl.controller ?? card.owner) === (loc.controller ?? s.cards[id].owner) && card.automation?.static === 'repeat-host-death').length;
    }
    // Saved rooms from older builds stored phase hooks under the legacy keys.
    // Prefer the current hook, so a room containing both keys fires only once.
    function selfTrigger(card, event) { const hooks = card?.automation; return hooks?.[event] ?? (event === 'prepare' ? hooks?.prepareTrigger : event === 'end' ? hooks?.endTrigger : undefined); }
    function event(s, id, event, loc, group = uuid(), details = {}) {
        if (!active(s))
            return;
        if (event === 'death')
            ;
        ;
        ;
        if (event === 'hidden-ended') {
            details = { ...details, firstHiddenContest: s.hiddenEndedRound !== s.round };
            s.hiddenEndedRound = s.round;
        }
        veiledStatus.event(s, event, details);
        if (event === 'contest-won')
            veilTools.contestWon(s, details);
        shoggoth.watch(s, id, event, loc, group, details);
        yellow.watch(s, id, event, loc, group, details);
        criminal.watch(s, id, event, loc, group, details);
        scarab.watch(s, id, event, loc, group, details);
        gray.event(s, id, event, loc, group, details);
        if (loc.secretPlan && !printedRulesBlank(s, id, loc) && ['hidden-inspected', 'hidden-destroyed'].includes(event) && details.operator === 1 - controllerOf(s, id)) {
            const def = s.cards[id].automation?.secretReactive;
            if (def)
                emit(s, id, def, event, loc, group);
        }
        const card = details.subjectCard ?? printedRulesCard(s, id, loc);
        if (event === 'contest-won' && details.contest === 'investigation' && [0, 1].includes(details.winner)) {
            const reservations = s.effects.filter(e => e.kind === 'next-investigation-draw' && e.controller === details.winner);
            s.effects = s.effects.filter(e => !reservations.includes(e));
            for (const e of reservations)
                emit(s, e.sourceId, { target: 'none', effect: 'draw', count: 1 }, event, e.sourceSnapshot, group, { sourceSilenced: false });
        }
        ;
        ;
        ;
        ;
        ;
        ;
        if (event === 'targeted' && details.targetingController !== controllerOf(s, id) && shieldCanTrigger(s, id, loc))
            emit(s, id, { mandatory: true, target: 'none', effect: 'holy', operation: 'shield-counter', abilityLabel: '护盾标志', chooseTriggerOrder: true }, event, loc, group, { targetedEntryId: details.entryId });
        if (loc.faceDown) {
            const def = selfTrigger(card, event);
            if (def?.allowHiddenSource && matchesEntrySource(s, id, def, event, loc) && (!def.enemyOperatorOnly || details.operator === 1 - (loc.controller ?? card.owner)) && (!def.requiredCounter || (loc.counters?.[def.requiredCounter] ?? 0) > 0))
                emit(s, id, def, event, loc, group, { operator: details.operator });
            if (!['move', 'field-leave'].includes(event))
                return;
        }
        if (event === 'entry' && card.automation?.timeEntry)
            emit(s, id, { mandatory: true, target: 'none', effect: 'entropy', operation: 'time-entry', count: card.automation.timeEntry, abilityLabel: '时间标志进场' }, event, loc, group);
        if (event === 'entry' && card.automation?.hiddenTimeEntry && effectiveSocietyMarkers(s, loc.controller ?? card.owner).hidden > 0)
            emit(s, id, { mandatory: true, target: 'none', effect: 'entropy', operation: 'time-entry', count: card.automation.hiddenTimeEntry, abilityLabel: '隐秘时间标志进场' }, event, loc, group);
        if (event === 'entry')
            for (const count of shieldEntryCounts(s, id))
                emit(s, id, { mandatory: true, target: 'none', effect: 'holy', operation: 'shield-entry', count, abilityLabel: '护盾进场', chooseTriggerOrder: true }, event, loc, group);
        if (event === 'death')
            for (let i = 0; i < philosopherStoneCount(s, id, loc); i++)
                emit(s, id, { mandatory: true, target: 'none', effect: 'philosopher-stone-return', abilityLabel: '哲人石标志', chooseTriggerOrder: true }, event, loc, group, { ownDeathAbility: true, sourceSilenced: details.sourceSilenced ?? (s.deathBatch?.group === group ? s.deathBatch.subjects[id]?.abilitiesSuppressed : undefined) });
        if (event === 'death')
            for (const def of attachmentGrantedTriggers(s, id, event, loc, details.sources ?? (s.deathBatch?.group === group ? s.deathBatch.sources : undefined)))
                emit(s, id, def, event, loc, group, { ownDeathAbility: true, sourceSilenced: details.sourceSilenced ?? (s.deathBatch?.group === group ? s.deathBatch.subjects[id]?.abilitiesSuppressed : undefined) });
        if (event === 'entry' && card.automation?.initialTime) {
            setCardMarker(s, loc, "markers", null, (loc.markers ?? 0) + card.automation.initialTime);
        }
        if (event === 'entry')
            for (const source of s.players.flatMap(p => p.play)) {
                const sl = s.locations[source], grant = false;
                if (sl.zone !== 'play' || sl.faceDown || !grant || grant.own && controllerOf(s, id) !== controllerOf(s, source) || !grant.filterAny.some(f => filterCard({ ...card, subtypes: effectiveSubtypes(s, id) }, f)))
                    continue;
                for (const g of grant.grants) {
                    const e = g === '屏障' ? { kind: 'barrier' } : { kind: 'modify-icons', icon: 'influence', amount: g.blackInfluence };
                    s.effects.push({ ...e, targetId: id, targetZoneVersion: loc.zoneVersion, duration: grant.duration, provenance: { name: s.cards[source].name, abilityText: '持续进场能力' } });
                }
                log(s, `${s.cards[source].name}的持续能力立即授予${card.name}屏障与势力图标，不进入堆叠。`);
            }
        const selfEvent = graveEventName(s, event, details, id);
        let def = selfTrigger(card, selfEvent), extraAssaults = [];
        if (event === 'reveal') {
            const ordinary = keywordAmount(s, id, '袭击'), wound = keywordAmount(s, id, '创伤袭击'), printed = def?.assault ? def.effect : null;
            if (def?.assault && def.target !== 'ordered-assault')
                def = { ...def, ...(def.amountFrom ? { assaultBonus: ordinary } : { amount: printed === 'wound' ? wound : ordinary }) };
            if (ordinary && printed !== 'damage')
                extraAssaults.push({ target: 'district-character', effect: 'damage', amount: ordinary, assault: true, abilityLabel: '袭击' });
            if (wound && printed !== 'wound')
                extraAssaults.push({ target: 'district-character', effect: 'wound', amount: wound, assault: true, abilityLabel: '创伤袭击' });
            if (def?.assault && def.target !== 'ordered-assault' && !def.amountFrom && !def.amount)
                def = null;
        }
        for (const extra of extraAssaults)
            emit(s, id, extra, event, loc, group);
        if (def && (!def.ownPhysicalSpellResolution || s.resolvingAbility?.kind === 'play-spell' && !s.resolvingAbility.copied && s.resolvingAbility.controller === card.owner && s.locations[s.resolvingAbility.cardId]?.zone === 'stack' && hasCardType(s.cards[s.resolvingAbility.cardId], 'spell')) && (!def.fromDeck || details.from?.zone === 'deck') && (!def.ownSocietyOnly || details.host?.kind === 'society' && details.host.owner === card.owner) && !def.sourceHiddenOnly && matchesEntrySource(s, id, def, event, loc) && (!def.discardOnly || details.from?.zone === 'hand' && (details.cause === 'discard' || def.discardCosts && details.cause === 'cost')) && (!def.enemyDiscardOnly || details.effectController === 1 - card.owner) && (!def.entryMethod || def.entryMethod === details.method))
            emit(s, id, def, selfEvent, loc, group, { eventHost: details.host, eventCount: details.amount ?? details.count, ownDeathAbility: event === 'death', sourceSilenced: details.sourceSilenced ?? (event === 'death' && s.deathBatch?.group === group ? s.deathBatch.subjects[id]?.abilitiesSuppressed : undefined) });
        if (event === 'death' && hasCardType(card, 'character'))
            for (const owner of [0, 1])
                for (const source of [...s.players[owner].graveyard, ...(s.players[owner].headquarters ?? [])]) {
                    if (!inGrave(s, source, source))
                        continue;
                    const sc = printedRulesCard(s, source), sl = s.locations[source];
                    for (const w of sc?.automation?.graveWatch ?? [])
                        if (w.event === event && (!w.enemy || (details.player ?? loc.controller ?? card.owner) !== owner))
                            emit(s, source, w, event, sl, group, { eventDistrict: details.district ?? loc.district, eventDistrictCardId: s.districts[details.district ?? loc.district]?.id });
                }
        const deathBatch = ['death', 'field-leave'].includes(event) && s.deathBatch?.group === group ? s.deathBatch : null;
        const observed = details.subjectCard ?? deathBatch?.subjects[id] ?? { ...card, controller: details.player ?? controllerOf(s, id), subtypes: effectiveSubtypes(s, id), magicDomains: effectiveMagicDomains(s, id) };
        const sources = details.sources ?? deathBatch?.sources ?? s.players.flatMap(p => p.play).map(source => ({ id: source, loc: s.locations[source], card: printedRulesCard(s, source) }));
        for (const { id: source, loc: sl, card: sc, silenced } of sources) {
            if (sl?.zone !== 'play')
                continue;
            for (const [i, w] of (sc.automation?.watch ?? []).entries()) {
                if (sl.faceDown && !w.allowHiddenSource || w.sourceHiddenOnly && !sl.faceDown)
                    continue;
                ;
                if (w.sourceUntapped && sl.tapped)
                    continue;
                if (w.sourceOnOwnSociety && (sl.attachedTo !== `society:${sl.controller ?? sc.owner}` || sl.hostVersion !== (s.societyVersions?.[sl.controller ?? sc.owner] ?? 0)))
                    continue;
                if (w.excludeCause && w.excludeCause === details.cause || w.subjectFaceUp && loc.faceDown)
                    continue;
                if (w.effectPlacementOnly && !(event === 'entry' && (details.method === 'effect-placement' || observed.token)) || w.selfOnly && source !== id || w.cause && w.cause !== details.cause || w.ownOwner && observed.owner !== (sl.controller ?? sc.owner) || w.hostRoleOrAttachment && (details.host?.kind !== 'card' || !hasAnyCardType(s.cards[details.host.hostId], ['character', 'attachment'])))
                    continue;
                const observedEvent = graveEventName(s, event, details, source);
                if ((w.entryOrMove ? !['entry', 'move'].includes(observedEvent) : w.event !== observedEvent) || w.namedCharacter && (!hasCardType(observed, 'character') || sl.namedCharacter !== observed.name) || w.otherOnly && source === id || w.subjectKeyword && !cardHasKeyword(s, id, w.subjectKeyword) || w.keywordAny && !w.keywordAny.includes(details.keyword))
                    continue;
                const owner = sl.controller ?? sc.owner;
                if (w.minimumSubjectTime && (loc.markers ?? 0) < w.minimumSubjectTime)
                    continue;
                if (w.subjectCounter && !(loc.counters?.[w.subjectCounter] > 0))
                    continue;
                if (w.subjectOwnSealedSubtypes && !sealedOn(s, id).some(sid => s.cards[sid].owner === owner && w.subjectOwnSealedSubtypes.some(t => effectiveSubtypes(s, sid).includes(t))))
                    continue;
                if (w.firstHiddenWin && s.hiddenWins?.[owner] === s.round)
                    continue;
                if (w.entryOrMove && !(event === 'entry' || event === 'move'))
                    continue;
                if (w.contest && w.contest !== details.contest || w.enemyWinner && details.winner === owner || w.ownWinner && details.winner !== owner || w.sameDistrict && sl.district !== (details.district ?? loc.district) || w.participating && (!participatesInDistrictContest(s, source, details.district, details.contest) || !hasCardType(sc, 'character')))
                    continue;
                if (w.ownParticipantSubtype && !s.players[owner].play.some(role => s.locations[role].zone === 'play' && !s.locations[role].faceDown && participatesInContest(s, role) && s.locations[role].district === details.district && hasCardType(s.cards[role], 'character') && effectiveSubtypes(s, role).includes(w.ownParticipantSubtype)))
                    continue;
                if (w.attachedToSource && (loc.attachedTo !== source || loc.hostVersion !== (sl.fieldVersion ?? sl.zoneVersion)))
                    continue;
                if (w.battleDamageDeath && !(loc.lethalChange?.kind === 'damage' && loc.lethalChange.damageKind === 'battle'))
                    continue;
                if (w.hostSubject && (sl.attachedTo !== id || sl.hostVersion !== loc.zoneVersion))
                    continue;
                if (w.hostShared && (details.host?.hostId !== sl.attachedTo || details.host?.version !== sl.hostVersion))
                    continue;
                if (w.attachmentName && printedRulesCard(s, id)?.name !== w.attachmentName)
                    continue;
                if (w.hostSubtypesAny && !w.hostSubtypesAny.some(t => effectiveSubtypes(s, details.host?.hostId).includes(t)))
                    continue;
                if (w.uniqueAttachmentName) {
                    const h = details.host;
                    const same = Object.entries(s.locations).filter(([aid, al]) => al.zone === 'play' && !al.faceDown && al.attachedTo === h?.hostId && al.hostVersion === h?.version && printedRulesCard(s, aid)?.name === printedRulesCard(s, id)?.name);
                    if (same.length !== 1) {
                        s.triggerChoices = s.triggerChoices.filter(a => !(false));
                        continue;
                    }
                }
                if (w.hostParticipating) {
                    const h = s.locations[sl.attachedTo];
                    if (!h || h.zone !== 'play' || h.faceDown || h.zoneVersion !== sl.hostVersion || !participatesInContest(s, sl.attachedTo) || h.district !== details.district || !hasCardType(s.cards[sl.attachedTo], 'character'))
                        continue;
                }
                if (w.enemyCard && (!details.targetingCard || details.targetingOwner !== 1 - owner))
                    continue;
                if (w.transactionOnly && !details.transactionId)
                    continue;
                if (w.enemyTransaction && (!details.transactionId || (details.targetingOwner ?? details.targetingController) !== 1 - owner))
                    continue;
                if (w.enemyTargetingSource && (details.targetingCard ? details.targetingOwner : details.targetingController) !== 1 - owner)
                    continue;
                if (w.enemyEffect && (details.targetingController !== 1 - owner || !details.transactionId && !details.isAbility))
                    continue;
                if (w.targetUnique && !observed.unique || w.targetingUnique && !details.targetingUnique || w.targetingHoly && !details.targetingDomains?.includes('神圣'))
                    continue;
                if (w.hostSource && (details.host?.hostId !== source || details.host.version !== (sl.fieldVersion ?? sl.zoneVersion)))
                    continue;
                if (w.hostOwnSociety && (details.host?.kind !== 'society' || details.host.owner !== owner))
                    continue;
                if (w.hostOwnRoleOrAttachment) {
                    const h = details.host;
                    if (h?.kind !== 'card' || s.locations[h.hostId]?.zone !== 'play' || !hasAnyCardType(s.cards[h.hostId], ['character', 'attachment']) || controllerOf(s, h.hostId) !== owner)
                        continue;
                }
                if (w.predictionTapCost && event === 'keyword-influence-placed' && (details.keyword !== '智谋' || details.winner !== owner))
                    continue;
                if (w.firstHiddenContest && !details.firstHiddenContest)
                    continue;
                if (w.hostEnemyCharacter) {
                    const h = details.host;
                    if (h?.kind !== 'card' || !hasCardType(s.cards[h.hostId], 'character') || controllerOf(s, h.hostId) === owner)
                        continue;
                }
                if (w.hostOwnCharacter) {
                    const h = details.host;
                    if (h?.kind !== 'card' || !hasCardType(s.cards[h.hostId], 'character') || controllerOf(s, h.hostId) !== owner)
                        continue;
                }
                if (w.excludeMarkerOrigin && w.excludeMarkerOrigin === details.markerOrigin)
                    continue;
                if (w.enemy && observed.controller === owner)
                    continue;
                if (w.operation === 'sophia-copy' && !s.flow.stack.some(a => a.id === group && a.kind === 'play-spell'))
                    continue;
                if (w.fromDeck && details.from?.zone !== 'deck')
                    continue;
                if (w.fromHand && loc.castFromZone !== 'hand')
                    continue;
                if (w.graveToSocietyOrHand && !(details.to === 'hand' || details.to === 'sealed' && details.toHost === `society:${owner}`))
                    continue;
                if (w.oncePerBatch && (!w.own || observed.controller === owner) && (!w.filter || filterCard(observed, w.filter))) {
                    s.millTriggerStamps ??= {};
                    const stamp = `${source}:${sl.zoneVersion}:${group}`;
                    if (s.millTriggerStamps[stamp])
                        continue;
                    s.millTriggerStamps[stamp] = true;
                }
                if (w.subjectTypes && !w.subjectTypes.some(t => hasCardType(observed, t)))
                    continue;
                if (w.enemyPlayer && observed.controller === owner || w.own && observed.controller !== owner || w.filter && (!card || !filterCard(observed, w.filter)))
                    continue;
                if (w.hostOwnAttachment) {
                    const h = details.host;
                    if (h?.kind !== 'card' || !hasCardType(s.cards[h.hostId], 'attachment') || controllerOf(s, h.hostId) !== owner || w.hostSubtitle && s.cards[h.hostId].subtitle !== w.hostSubtitle)
                        continue;
                }
                for (let copy = 0; copy < (w.eachCounter ? Math.max(0, Math.floor(details.count ?? 0)) : 1); copy++)
                    emit(s, source, w, observedEvent, sl, group, { ...(w.operation === 'sophia-copy' ? { copiedSpell: captureSpell(s, group) } : {}), ...(details.triggerAfter ? { triggerAfter: details.triggerAfter } : {}), markerField: details.markerField, markerKey: details.markerKey, revealedRefs: details.revealedRefs, targetedEntryId: details.entryId, subjectId: id, subjectZoneVersion: loc.zoneVersion, ...(w.snapshotMarkers ? { subjectMarkers: transferableMarkers(loc) } : {}), subjectName: card?.name, eventWinner: details.winner, ...(w.hostParticipating ? { eventAttachmentHost: sl.attachedTo, eventAttachmentHostVersion: sl.hostVersion } : {}), subjectHostRef: sealHost(s, id), subjectSubtypes: observed.subtypes, subjectPrintedCost: observed.printedCost, ownDeathAbility: source === id && event === 'death', eventHost: details.host, attachmentName: card?.name, eventCount: details.amount ?? details.count, sourceSilenced: silenced, eventDistrict: details.district ?? loc.district, eventDistrictCardId: s.districts[details.district ?? loc.district]?.id, usageKey: `${source}:${sl.zoneVersion}:watch:${i}` });
            }
        }
    }
    function conditions(s, group = uuid()) {
        if (!active(s) || s.status !== 'playing')
            return;
        shoggoth.conditions(s, group);
        gray.conditions(s, group);
        for (const id of s.players.flatMap(p => p.play)) {
            const card = printedRulesCard(s, id), l = s.locations[id], def = card.automation?.stateTrigger;
            if (l.zone !== 'play' || l.faceDown || !def)
                continue;
            const stamp = card.catalogId + ':' + l.zoneVersion, met = (def.timeCount !== undefined ? (l.markers ?? 0) >= def.timeCount : sealedOn(s, id).length >= def.sealCount) && !abilitiesSuppressed(s, id);
            if (!met) {
                delete l.stateTriggerStamp;
                continue;
            }
            if (l.stateTriggerStamp === stamp)
                continue;
            l.stateTriggerStamp = stamp;
            emit(s, id, def, 'state-condition', l, group, { sourceFace: card.catalogId });
        }
    }
    function view(s, p) {
        if (!active(s))
            return {};
        if (!s.players[p])
            return { automationTokenCount: s.automationCards.filter(c => c.token).length, automationCount: s.automationCards.length, spellTargets: {}, abilityTargets: {}, effectChoice: null };
        const handCards = [...new Set([...s.players[p].hand, ...[...graveCards(s, p), ...Object.keys(s.locations).filter(id => s.locations[id].zone === 'sealed' && s.cards[id]?.owner === p || s.locations[id].zone === 'asset' && controllerOf(s, id) === p)].filter(id => (s.cards[id]?.spell || s.cards[id]?.attachment) && castSourceStatus(s, p, id).allowed), ...(['discard-deck-cast', 'batch-spells-cast'].includes(s.effectChoice?.kind) && s.effectChoice.controller === p ? s.effectChoice.cardIds : [])])];
        const cardOptions = Object.fromEntries(handCards.filter(id => s.cards[id].spell || s.cards[id].attachment).map(id => {
            const card = s.cards[id], original = card.spell ?? card.attachment;
            let opts = options(s, p, { ...effectiveCastPlan(s, p, card), cardId: id });
            if (lotusFreeCast(s, p, card) && original.extraCost && !original.costX)
                opts = opts.filter(o => s.cards[o.id]?.printedCost === 0);
            return [id, opts];
        }));
        const abilityTargets = {};
        for (const id of s.players.flatMap(pl => pl.play))
            for (const [i, action] of effectiveActions(s, id).entries()) {
                if (controllerOf(s, id) !== p && !publicActionAllowed(s, p, id, action))
                    continue;
                const choices = options(s, p, { ...action, sourceId: id, sourceDistrict: s.locations[id].district });
                abilityTargets[`${id}:${i}`] = choices;
                if (i === 0)
                    abilityTargets[id] = choices;
            }
        const abilitySealCosts = {};
        for (const id of s.players[p].play)
            for (const [i, a] of effectiveActions(s, id).entries())
                if (a.graveSealCost || a.graveShuffleCost)
                    abilitySealCosts[`${id}:${i}`] = graveCards(s, p).filter(x => (!a.graveSealCost || !s.cards[x].token) && filterCard({ ...s.cards[x], subtypes: effectiveSubtypes(s, x), magicDomains: effectiveMagicDomains(s, x) }, (a.graveSealCost ?? a.graveShuffleCost).filter)).map(x => identity(s, x));
        const abilitySacrifices = Object.fromEntries(s.players[p].play.filter(id => !s.locations[id].faceDown && printedRulesCard(s, id).automation?.action?.sacrificeCharacters).map(id => [id, sacrificeOptions(s, p, printedRulesCard(s, id).automation.action).map(id => identity(s, id))]));
        const timeCostCards = Object.keys(s.locations).filter(id => ['play', 'asset', 'society'].includes(s.locations[id].zone) && !s.locations[id].faceDown && controllerOf(s, id) === p && (s.locations[id].markers ?? 0) > 0).map(id => ({ ...identity(s, id), zone: s.locations[id].zone, markers: s.locations[id].markers }));
        const abilityTaps = {};
        for (const id of s.players[p].play)
            for (const [i, action] of effectiveActions(s, id).entries()) {
                const plan = { ...action, sourceId: id, sourceDistrict: s.locations[id].district };
                if (plan.tapCharacters)
                    abilityTaps[`${id}:${i}`] = tapOptions(s, p, plan).map(id => identity(s, id));
                if (plan.sacrificeAttached)
                    abilitySacrifices[`${id}:${i}`] = attachedSacrifices(s, p).map(id => identity(s, id));
                if (plan.sacrificeCharacters)
                    abilitySacrifices[`${id}:${i}`] = sacrificeOptions(s, p, plan).map(id => identity(s, id));
            }
        for (const id of handCards) {
            const plan = effectiveCastPlan(s, p, s.cards[id]);
            if (plan?.tapCharacters)
                abilityTaps[id] = tapOptions(s, p, plan).map(id => identity(s, id));
            if (plan?.sacrificeCharacters)
                abilitySacrifices[id] = sacrificeOptions(s, p, plan).map(id => identity(s, id));
        }
        for (const a of [...s.triggerChoices, ...(s.deathContinuation?.choice?.kind === 'trigger-cost' ? [s.deathContinuation.choice.ability] : s.deathContinuation?.choice?.kind === 'trigger-cost-batch' ? s.deathContinuation.choice.abilities : [])])
            if (a.controller === p && a.kind === 'auto-ability') {
                abilityTargets[a.id] = options(s, p, a.plan);
                if (a.plan.tapCharacters)
                    abilityTaps[a.id] = tapOptions(s, p, a.plan).map(id => identity(s, id));
                if (a.plan.sacrificeCharacters)
                    abilitySacrifices[a.id] = sacrificeOptions(s, p, a.plan).map(id => identity(s, id));
                if (a.plan.sacrificeAttached)
                    abilitySacrifices[a.id] = attachedSacrifices(s, p).map(id => identity(s, id));
                if (a.plan.graveSealCost)
                    abilitySealCosts[a.id] = graveCards(s, p).filter(id => !s.cards[id].token && filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id), magicDomains: effectiveMagicDomains(s, id) }, a.plan.graveSealCost.filter)).map(id => identity(s, id));
            }
        let effectChoice = null;
        if (s.effectChoice && !['environment', 'abyss'].includes(s.effectChoice.kind)) {
            const a = seatChoice(s.effectChoice, p);
            effectChoice = { ...(a.kind === 'discard-deck-rigoletto' && a.controller === p ? { rigolettoHostId: a.spell.targets[0]?.cardId } : {}), ...({}), predictionObserver: predictionView(s, a, p), id: a.id, kind: a.kind, choiceLabel: a.choiceLabel, ...(['late-non-qs-mother-cast'].includes(a.kind) ? { ignoreCosts: true } : {}), ...(a.kind === 'late-non-qs-search' ? { searchOperation: a.searchOperation, targetAvailable: !!a.spell.targets[0] && live(s, a.controller, a.spell.plan, a.spell.targets[0]), districtAvailable: s.districts[a.spell.plan.sourceDistrict]?.id === a.spell.plan.sourceDistrictCardId } : {}), ...(a.kind === 'spell-copy-targets' && a.controller === p ? spellCopy.view(s, a) : {}), corePlan: a.controller === p ? a.corePlan : undefined, remainingCore: a.remainingCore, roleId: a.controller === p ? a.roleId : undefined, sourceDistrict: a.sourceDistrict, controller: a.controller, simultaneous: !!a.simultaneous, allowed: a.allowed, done: a.done, count: a.count ?? 1, min: a.min, max: a.max, eligibleIds: a.controller === p ? a.eligibleIds : undefined, canRepeat: !!a.canRepeat, canFail: !!a.canFail, drawAfter: a.drawAfter ?? 0, public: !!a.public, revealedNames: a.public ? a.revealedNames : undefined, hostName: a.hostRef?.name ?? null, canSkip: !!a.canSkip, distinctNames: !!a.distinctNames, discardAlternative: !!a.discardAlternative, faceDownSeal: !!a.faceDownSeal, amount: a.amount, cannotTerminate: !!a.cannotTerminate, destination: a.destination, maxPrintedCost: a.maxPrintedCost, targetPair: !!a.targetPair, maxNumber: a.maxNumber, canChooseGreater: a.canChooseGreater };
            if (a.controller === p || a.public)
                effectChoice.cards = a.options ?? a.cardIds.map(id => a.zone === 'asset' ? { id, name: '资产', faction: s.cards[id].faction } : { ...(s.locations[id]?.secretPlan && controllerOf(s, id) !== p && !['inspect', 'batch-inspect', 'batch-inspect-lock'].includes(a.kind) ? { id, name: '秘密计划', printedCost: 1, type: 'attachment' } : identity(s, id)), ...(a.kind === 'batch-inspect' && s.locations[id]?.secretPlan ? { name: s.cards[id].name, displayName: s.cards[id].displayName } : {}), ...(a.kind === 'shoggoth-remove-time' ? { markers: s.locations[id].markers } : {}), ...(['discard-deck-cast', 'batch-spells-cast'].includes(a.kind) ? ctx.castOptions(s, p, id) : {}), ...({}) });
        }
        const publicActions = s.players.flatMap(pl => pl.play).flatMap(id => effectiveActions(s, id).flatMap((plan, actionIndex) => publicActionAllowed(s, p, id, plan) ? [{ card: { ...identity(s, id) }, plan: { ...plan, used: !!plan.oncePerRound && s.abilityUses?.[`${id}:${s.locations[id].zoneVersion}:action:${actionIndex}${plan.perPlayer ? ':' + p : ''}`]?.round === s.round && (s.abilityUses?.[`${id}:${s.locations[id].zoneVersion}:action:${actionIndex}${plan.perPlayer ? ':' + p : ''}`]?.count ?? 0) >= plan.oncePerRound }, actionIndex }] : []));
        const revealCosts = Object.fromEntries(s.players[p].play.filter(id => s.locations[id].faceDown).map(id => [id, castingCost(s, p, s.cards[id], 'reveal')]));
        // Staging uses the paid-flip price, which can differ from face-up play.
        const deploymentRevealCosts = Object.fromEntries(s.players[p].hand.filter(id => hasCardType(s.cards[id], 'character')).map(id => [id, castingCost(s, p, s.cards[id], 'reveal')]));
        const top = s.players[p].play.some(id => !s.locations[id].faceDown && printedRulesCard(s, id).automation?.static === 'view-deck-top') ? s.cards[s.players[p].deck[0]] ?? null : null;
        const graveCastingMethods = Object.fromEntries(graveCards(s, p).map(id => [id, graveCastMethods(s, p, id)]));
        const progressCostCards = Object.keys(s.locations).filter(id => ['play', 'asset', 'society'].includes(s.locations[id].zone) && controllerOf(s, id) === p && progressCount(s, id) > 0).map(id => ({ ...identity(s, id), progress: progressCount(s, id) }));
        const planSacrificeCards = gray.eligibleSacrifice(s, p).map(id => identity(s, id));
        const hadesCastCosts = Object.fromEntries(graveCards(s, p).filter(id => graveCastMethods(s, p, id).some(m => m.id === 'hades')).map(id => [id, hadesCosts(s, p, id).map(id => identity(s, id))]));
        const abilityReturnCosts = {};
        for (const id of s.players[p].play)
            for (const [i, a] of effectiveActions(s, id).entries()) {
                const plan = { ...a, sourceId: id };
                if (a.societyShuffleCost || a.graveBottomCost || a.sealedBottomCost)
                    abilityReturnCosts[`${id}:${i}`] = (a.sealedBottomCost ? sealedOn(s, id).filter(x => filterCard({ ...s.cards[x], magicDomains: effectiveMagicDomains(s, x) }, a.sealedBottomCost.filter)) : a.societyShuffleCost ? societyShuffleCosts(s, p, a.societyShuffleCost.name) : graveBottomCosts(s, p, plan)).map(x => identity(s, x));
            }
        return { actionPaymentSources: actionPaymentSources(s, p), abilityReturnCosts, revealDiscounts: Object.fromEntries(s.players[p].play.filter(id => s.locations[id].faceDown).map(id => [id, castingDiscount(s, p, s.cards[id], 'reveal')])), graveCastingMethods, progressCostCards, planSacrificeCards, hadesCastCosts, publicActions, automationTokenCount: s.automationCards.filter(c => c.token).length, automationCount: s.automationCards.length, spellTargets: cardOptions, revealCosts, deploymentRevealCosts, castingCosts: Object.fromEntries(handCards.map(id => [id, castingCost(s, p, s.cards[id])])), castingDiscounts: Object.fromEntries(handCards.map(id => [id, castingDiscount(s, p, s.cards[id])])), targetCastingDiscounts: Object.fromEntries(handCards.filter(id => s.cards[id].attachment).map(id => [id, Object.fromEntries((cardOptions[id] ?? []).map(o => [o.id, castingDiscount(s, p, s.cards[id], 'play', [{ cardId: o.id }])]))])), targetCastingCosts: Object.fromEntries(handCards.filter(id => s.cards[id].attachment).map(id => [id, Object.fromEntries((cardOptions[id] ?? []).map(o => [o.id, castingCost(s, p, s.cards[id], 'play', [{ cardId: o.id }])]))])), abilityTargets, abilitySealCosts, abilitySacrifices, abilityTaps, timeCostCards, effectChoice, ownDeckTop: top };
    }
    function completeHidden(s, a, winner, shown) {
        ;
        ;
        ;
        if (a.plan?.effect === 'starlight') {
            starlight.effect(s, a, a.plan, []);
            finishSpell(s, a);
            return;
        }
        if (a.plan?.effect === 'reverberation') {
            reverberation.afterHidden(s, a, winner);
            return;
        }
        if (a.plan?.effect === 'non-qs') {
            nonQs.afterHidden(s, a);
            return;
        }
        if (a.plan?.effect === 'shoggoth') {
            shoggoth.afterHidden(s, a, winner);
            return;
        }
        if (a.plan?.effect === 'yellow-gray') {
            finishSpell(s, a);
            return;
        }
        if (a.plan?.effect === 'criminal') {
            criminal.afterHidden(s, a, winner, shown);
            return;
        }
        if (a.plan?.effect === 'entropy') {
            entropy.afterHidden(s, a, winner);
            return;
        }
        if (a.plan?.effect === 'discard-deck') {
            discardDeck.afterHidden(s, a, winner);
            return;
        }
        log(s, `${s.cards[a.cardId].name}开启的隐秘对抗已完成。`);
        finishSpell(s, a);
    }
    return { inspectCards, blink: (s, id, group) => batchEffect(s, { id: group, controller: controllerOf(s, id), targets: [{ cardId: id }], plan: {} }, { operation: 'blink' }, [{ cardId: id }]), offerTrigger, flushTriggerCosts, triggerUnavailable, validateTrigger, shoggothInitialize: shoggoth.initialize, shoggothDeparted: shoggoth.departed, shoggothCompleteDeparture: shoggoth.completeDeparture, activated: (s, a) => {
            yellow.activated(s, a);
            green.activated(s, a);
            ;
            if (a.plan?.assault && !a.assaultObserved) {
                a.assaultObserved = true;
                const id = a.plan.sourceId, loc = s.locations[id], subject = { ...s.cards[id], controller: a.controller };
                if (hasCardType(subject, 'character'))
                    for (let i = 0; i < (a.plan.target === 'ordered-assault' ? a.plan.targetCount : 1); i++)
                        event(s, id, 'assault-start', { ...loc, zoneVersion: a.plan.sourceZoneVersion, controller: a.controller, district: a.plan.sourceDistrict }, a.group ?? a.id, { subjectCard: subject });
            }
        }, inspected: yellow.inspected, leaving: entropy.leaving, command, resolve, view, event, conditions, completeHidden, options, prepare, finishSpell, replacement: discardDeck.replacement };
}
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const limit = 0x100000000 - 0x100000000 % (i + 1);
        let n;
        do {
            n = randomValues(new Uint32Array(1))[0];
        } while (n >= limit);
        const j = n % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    ;
    deckWasShuffled(a);
}
