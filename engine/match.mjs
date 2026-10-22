import { recordReplayStep } from './replay.mjs';
import { effectObjectsLog } from './action-log.mjs';
import { hiddenTriggersAfterContest } from './hidden-trigger-effects.mjs';
import { stackResponseInformation } from './stack-response-information.mjs';
import { botLibraryNames } from './bot-library-information.mjs';
import { silenceSealFace } from './seal-replacement.mjs';
import { withHardBotCommand, rememberHardDeckMove, settleHardBotCommand } from './hard-bot-library.mjs';
import { liveSealedCastRef } from './sealed-resolution-cast.mjs';
import { flushFieldEvents } from './field-events.mjs';
import { deckWasShuffled } from './deck-shuffle-events.mjs';
import { tapCostCards } from './tap-costs.mjs';
import { currentTargetingView } from './current-targets.mjs';
import { stackEntryDestinations } from './stack-entry-destinations.mjs';
import { stackCastRestriction, stackResponsesBlocked, prepareRepeatedResolution } from './stack-continuous.mjs';
import { stageCostSacrifice, withCostPayment } from './cost-payment.mjs';
import { commandPostTax, wellCaptureSources, captureWithWell } from './command-post-well.mjs';
import { rememberLambDeath } from './veil-late-effects.mjs';
import { deathDestination } from './death-destinations.mjs';
import { resetCard, resetAssets } from './reset.mjs';
import { settleClubInfluence } from './club-influence.mjs';
import { settleTerminatedCard } from './terminated-card.mjs';
import { loyaltyMet } from './loyalty.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { destructionImmune } from './destruction-rules.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { equippedHiddenBonus, archaeologicalReturn, sealedCastMethods, consumeSealedCast } from './bq-rules.mjs';
import { reincarnateAfterEntry } from './zone-entry-rules.mjs';
import { isTaskDistrict, registerTaskDistrict, unregisterTaskDistrict } from './task-districts.mjs';
import { selectedModeIds } from './multi-mode.mjs';
import { coreArea, coreRest, coreCastPayment, shoggothHiddenBonus, coreNoResponse } from './shoggoth-rules.mjs';
import { parseRoomCommand } from './room-commands.mjs';
import { regionalHiddenBonus, hiddenSlowSources } from './regional-synergy-rules.mjs';
import { movementBlocked } from './district-rules.mjs';
import { nisosSources } from './green-black-rules.mjs';
import { secretDeploymentDiscount, handDiscardProtection } from './veiled-status-rules.mjs';
import { paidRevealRestriction } from './veil-tools-rules.mjs';
import { paidRevealPreview } from './reveal-preview.mjs';
import { splitCardRules } from './card-text-format.mjs';
import { beginPrediction, finishPrediction, inspectPrediction } from './prediction.mjs';
import { recordEffectSources } from './ability-information.mjs';
import { finishedInformation, finishedRoomView } from './match-record.mjs';
import { migrateLegacyDeterChoice } from './deter.mjs';
import { canTapCard, flushPlayerEvents } from './field-events.mjs';
import { establishesAttachment } from './attachment-targets.mjs';
import { graveCards, inGrave, withGraveReference } from './graveyard-rules.mjs';
import { actionAllowance, actionUsed, useRoundAction, hadesCosts, selectedGraveCast, utopiaTargets } from './plan-rules.mjs';
import { canTerminate } from './holy-deck-rules.mjs';
import { entropyHiddenCard } from './entropy-effects.mjs';
import { deathCharacterCostOptions, prepareDeathCharacterCost } from './death-deck-rules.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { isCostChoice, runDeathCommand, deathAttachmentCosts, deathCostView, discardReplacementDecision, triggerCostDecision } from './death-costs.mjs';
import { uuid, randomValues } from './random.mjs';
import { printedRulesCard, printedRulesBlank } from './printed-rules.mjs';
import { fateSealedPermission, realityCard } from './reality-rules.mjs';
import { scoreValue, victoryThreshold } from './scoring.mjs';
import { lotusFreeCast, effectiveCastPlan, waiveCastingCosts, societyAllowsCast } from './casting-rules.mjs';
import { inspectWithMonitor, cardInspectionView, hiddenNumber } from './card-inspection.mjs';
import { revealHandCostReduction } from './reveal-hand-cost.mjs';
import { secretDeploymentBlocked, abilitiesSuppressed, transactionsBlocked } from './field-rules.mjs';
import { hasCardType, hasAnyCardType } from './card-types.mjs';
import { chooseDamageReplacement } from './damage.mjs';
import { restoreCardForm } from './card-forms.mjs';
import { maskSealedFace, restoreSealedFace } from './sealed-face.mjs';
import { restrictedDistrict, districtTraits, chaosEntryDistricts } from './district-rules.mjs';
import { consumeDiscounts, cannotFlip } from './batch-rules.mjs';
import { createKeeperEngine } from './keeper.mjs';
import { createSealingEngine, isFieldZone, sealedView, sealHost } from './sealing.mjs';
import { anchorHiddenBonus, criminalHiddenBonus, undercoverHiddenPenalty, playerHasBarrier } from './derived.mjs';
import { updateControl, cannotBuildAsset, effectiveActions, effectiveSubtypes, enterTapped, graveyardLocked, cardHasKeyword, hasBarrier, castingCost } from './derived.mjs';
import { identity, controllerOf } from './ownership.mjs';
import { createManualEngine, manualView, undoSnapshot, saveUndo, manualNames, manualQuantity, manualMutationOperations, gameplayUndoState, prunePriorityUndo } from './manual.mjs';
import { autoPassState, setAutoPass, resetAutoPassForRound, assetLoyalty, assetView } from './priority.mjs';
import { RuleError, markerEntryAbility, rumorTrigger, resolveRumorSeal, newPriority, pushAbility, passPriority, beginHiddenContest, selectHiddenCard, revealHiddenCards, hiddenComparison, eligibleAsideReturns, societyMarkers, handLimit } from './core.mjs';
import { createRoundEngine, effectiveIcons, effectiveTemporaryIcons, effectiveDefense } from './rounds.mjs';
import { cardPrintedCostText, createAutomationEngine } from './automation.mjs';
import { createAbyssEngine, abyssHiddenBonus } from './abyss.mjs';
import { createZoneActionEngine, castSourceStatus } from './zone-actions.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { hiddenSelectionIds } from './core.mjs';
import { networkHiddenBonus, researchMultiSelection, hiddenFirstSelectionPlayer, yellowHiddenCard } from './yellow-gray-rules.mjs';
import { whiteIconsConverted } from './derived.mjs';
import { createUniqueEngine } from './unique.mjs';
import { createEnvironmentEngine } from './environment.mjs';
import { playerHandLimit, loyaltyAssets, societyPlan } from './environment-definitions.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
import { offerTriggerOrder, arrangeTriggers, triggerOrderView } from './trigger-order.mjs';
import { currentTriggerRound, triggerRoundView, submitTriggerRound } from './trigger-round.mjs';
import { triggerDisplayName } from './trigger-display.mjs';
import { abilityDescription, abilityDescriptionView } from './ability-description.mjs';
import { deferTriggerCost } from './trigger-cost-queue.mjs';
import { normalizeTriggerTiming, earlyTriggerTiming, lateTriggerTiming } from './trigger-timing.mjs';
export const RULE_VERSION = '2026-10-22-trigger-timing';
export function createRoomState(nickname, hash, mode = 'round-play', automationCards = [], reserveTemplates = [], environmentCatalog = null, triggerTiming = 'event') {
    return { triggerTiming: normalizeTriggerTiming(triggerTiming), deckRequired: false, deckSelections: /** @type {any[]} */ ([null, null]), reserveTemplates, undoFrames: [], privateInspections: {}, manualRequest: null, mode, rulesVersion: RULE_VERSION, status: 'waiting', createdAt: Date.now(),
        seats: [{ name: nickname, hash, ready: false }, null], players: [], cards: {},
        playerPreferences: [{ skipAdditionalCoreReturn: true }, { skipAdditionalCoreReturn: true }], keeperQueue: [], ruleChoice: null, flow: newPriority(0), pendingTriggers: [], triggerChoices: [], hidden: null,
        battle: null, round: 1, logs: [], recentCommands: [], locations: {}, environmentCatalog, ...(mode === 'automation-play' ? { automationCards } : {}) };
}
const log = (s, text) => { s.logs.push({ id: s.logs.length ? s.logs.at(-1).id + 1 : 1, text, at: Date.now(), round: s.round, phase: s.turn?.phase ?? s.status, step: s.turn?.step ?? null }); };
export function joinSeat(s, name, hash) { need(s.status === 'waiting' && !s.seats[1], '房间已满或测试已经开始'); s.seats[1] = { name, hash, ready: false }; log(s, `${name}已加入房间`); }
const names = ['标志测试角色', '战斗触发测试角色', '传闻测试牌', '隐秘修正测试牌', '隐秘效果测试牌', '基础测试角色'];
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const limit = 0x100000000 - (0x100000000 % (i + 1));
        let n;
        do {
            n = randomValues(new Uint32Array(1))[0];
        } while (n >= limit);
        const j = n % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    deckWasShuffled(a);
    return a;
}
function makeDeck(s, p) {
    if (s.mode === 'automation-play') {
        const deck = [], selection = s.deckSelections?.[p], pool = selection?.cards ?? s.automationCards.filter(c => !c.token);
        for (const [n, def] of pool.entries())
            for (let i = 0; i < (!selection && n < Math.max(0, 60 - pool.length) ? 2 : 1); i++) {
                const id = uuid();
                s.cards[id] = { ...structuredClone(def), id, owner: p };
                s.locations[id] = { zone: 'deck', zoneVersion: 0 };
                deck.push(id);
            }
        const anchorNames = [];
        s.initialAnchorCounts ??= [0, 0];
        s.initialAnchorCounts[p] = deck.filter(id => false).length;
        for (const id of deck)
            ;
        return shuffle(deck);
    }
    let cards = [];
    for (let i = 0; i < 30; i++) {
        let type = i % 6, id = `p${p}-c${i}`;
        s.cards[id] = { id, owner: p, name: `测试·${names[type]}`, type: 'character', printedCost: 1 + (type % 3),
            faction: '中立', magicDomains: [], loyalty: {}, keywords: [], defense: 2, rumor: type === 2, marker: type === 0, battleTrigger: type === 1,
            hiddenAbilities: type === 3 ? [{ kind: 'point-modifier', amount: 3 }] : type === 4 ? [{ id: `${id}:hidden`, kind: 'gain-hidden', controller: p }] : [],
            text: type === 0 ? '进场强制触发：在本牌上放置1个时间标志。' : type === 1 ? '测试触发：战斗结算时，可以在本牌上放置1个时间标志；等下一个快速行动窗口入栈。' : type === 2 ? '传闻：因卡牌或能力效果从手牌或牌库进入墓地后，可以从墓地封印到目标角色上。' : type === 3 ? '隐秘点数修正：+3。立即结算。' : type === 4 ? '隐秘：获得1个隐秘标志。进入堆叠，隐秘对抗结束后才有响应窗口。' : '用于测试地区、手牌与横置状态。' };
        cards.push(id);
        s.locations[id] = { zone: 'deck', zoneVersion: 0 };
        if (s.mode === 'round-play') {
            const card = printedRulesCard(s, id);
            card.icons = [{ investigation: 1, battle: 1, influence: 1 }, { investigation: 0, battle: 2, influence: 1 }, { investigation: 2, battle: 0, influence: 1 }, { investigation: 1, battle: 0, influence: 1 }, { investigation: 0, battle: 1, influence: 2 }, { investigation: 1, battle: 1, influence: 2 }][type];
            card.temporaryIcons = type === 5 ? { influence: 1 } : {};
            if (type === 3) {
                card.prepareTrigger = { effect: { kind: 'place-markers', marker: 'time', count: 1 } };
                card.text += ' 测试准备步骤触发：可以在本牌上放置1个时间标志。';
            }
            if (type === 2) {
                card.endTrigger = { effect: { kind: 'draw', count: 1 } };
                card.text += ' 测试结束步骤触发：可以抓1张牌。';
            }
            if (type === 5) {
                card.action = { timing: 'standard', tap: true, cost: 0, effect: { kind: 'draw', count: 1 } };
                card.text += ' 测试行动：横置本牌，抓1张牌。先手回合临时增加1个势力图标。';
            }
            if (type === 4) {
                card.action = { timing: 'fast', tap: false, cost: 1, effect: { kind: 'modify-icons', icon: 'influence', amount: 1, duration: 'until-end-of-round' } };
                card.text += ' 测试快速行动：支付1，本牌势力图标+1直到回合结束。';
            }
        }
    }
    return s.mode === 'round-play' ? shuffle(cards) : [...cards.slice(0, 6), ...shuffle(cards.slice(6))];
}
function initialize(s) {
    s.status = 'playing';
    s.flow = newPriority(0);
    s.players = [0, 1].map(p => ({ hand: [], deck: makeDeck(s, p), graveyard: [], aside: [], play: [], assets: [], reserve: [], actionsUsed: { asset: false, secret: false }, markers: { hidden: 0, exposed: 0 } }));
    for (let p = 0; p < 2; p++) {
        if (!s.environmentCatalog)
            for (let i = 0, n = s.societies?.[p]?.initialHand ?? 6; i < n; i++) {
                const id = s.players[p].deck.shift();
                s.players[p].hand.push(id);
                setLocation(s, id, 'hand');
            }
        // Lab setup, deliberately different from official game initial setup.
        s.players[p].assets = Array.from({ length: 4 }, (_, i) => ({ id: `asset-${p}-${i}`, tapped: false }));
    }
    if (roundEngine.active(s))
        roundEngine.initialize(s);
    else
        log(s, '双方已就绪。机制测试开始：各6张手牌、4个测试资产；这不是正式游戏的起始设置。');
}
function chaosEntryBlocked(s, id) { return hasCardType(s.cards[id], 'character') && cardHasKeyword(s, id, '混乱') && !chaosEntryDistricts(s, id).length; }
function setLocation(s, id, zone, extra = {}) {
    const old = s.locations[id], version = (old?.zoneVersion ?? 0) + 1;
    ;
    if (zone === 'play' && old?.zone === 'play' && old.faceDown && !extra.faceDown && cannotFlip(s, id)) {
        log(s, '该暗藏者目前不能现身，维持暗藏状态。');
        return false;
    }
    if (zone === 'play' && !extra.faceDown && (old?.zone !== 'play' || old.faceDown) && hasCardType(s.cards[id], 'character') && cardHasKeyword(s, id, '混乱')) {
        const ds = chaosEntryDistricts(s, id);
        if (!ds.length) {
            log(s, '戒严：混乱角色没有合法进场地区，维持原区域或暗藏状态。');
            return false;
        }
        const limit = 0x100000000 - 0x100000000 % ds.length;
        let n;
        do {
            n = randomValues(new Uint32Array(1))[0];
        } while (n >= limit);
        extra = { ...extra, district: ds[n % ds.length] };
    }
    if (old?.zone === 'play' && old.faceDown && zone === 'play' && !extra.faceDown)
        cardEvent(s, id, 'field-leave', old, s.eventGroup ?? uuid(), { cause: 'reveal', to: 'play' });
    if (old?.zone === 'play')
        restoreCardForm(s, id);
    if (zone === 'play' && (old?.zone !== 'play' || old.faceDown))
        extra = { entryFromZone: old?.castFromZone ?? old?.zone, ...(old?.faceDown ? { entryLockedBefore: (old.counters?.locked ?? 0) > 0 } : {}), ...extra };
    s.locations[id] = { zone, zoneVersion: version, ...(isFieldZone(zone) ? { fieldVersion: isFieldZone(old?.zone) ? old.fieldVersion ?? old.zoneVersion : version } : {}), ...extra };
    if (zone === 'sealed' && extra.faceDown)
        maskSealedFace(s, id);
    if (hiddenSlowSources(s, id).length)
        s.locations[id].tapped = true;
    return true;
}
function removeEverywhere(s, id) {
    for (const p of s.players) {
        for (const k of ['hand', 'deck', 'graveyard', 'headquarters', 'core', 'aside', 'play', 'reserve'])
            p[k] = (p[k] ?? []).filter(v => v !== id);
        p.assets = p.assets.filter(a => a.id !== id);
        p.scoreCards = (p.scoreCards ?? []).filter(c => c.id !== id);
    }
}
function move(s, id, zone, extra = {}) {
    const old = s.locations[id] && { ...s.locations[id] };
    const masked = restoreSealedFace(s, id);
    try {
        return moveUnmasked(s, id, zone, extra);
    }
    finally {
        if (zone === 'deck')
            rememberHardDeckMove(s, id, old);
        if (masked && s.locations[id]?.zone === 'sealed' && s.locations[id].faceDown)
            maskSealedFace(s, id);
    }
}
function moveUnmasked(s, id, zone, extra = {}) {
    if (stageCostSacrifice(s, id, zone, extra))
        return true;
    settleClubInfluence(s);
    const { cause = 'effect', effectController, ruleDeath = false, ...locationExtra } = extra;
    extra = locationExtra;
    const eventGroup = s.eventGroup ?? uuid();
    const replacementPlayer = extra.controller ?? controllerOf(s, id);
    if (zone === 'asset' && !s.cards[id].token && societyPlan(s, replacementPlayer).replaceRealAsset) {
        const template = s.reserveTemplates?.find(c => false) ?? s.automationCards?.find(c => false);
        need(template, '缺少小世界指示物资料，请创建新版房间');
        move(s, id, 'deck');
        const token = uuid();
        s.cards[token] = { ...structuredClone(template), id: token, owner: replacementPlayer };
        s.locations[token] = { zone: 'reserve', zoneVersion: 0 };
        move(s, token, 'asset', { controller: replacementPlayer, tapped: extra.tapped ?? false });
        log(s, `世界持续替代：${s.cards[id].name}回到其拥有者${s.seats[s.cards[id].owner].name}的牌库底，生成${extra.tapped ? '横置' : '未横置'}小世界资产。`);
        return true;
    }
    const old = s.locations[id];
    let coreDeparture = null;
    ;
    const zonePlayer = ['hand', 'deck'].includes(old?.zone) ? s.players.findIndex(p => p[old.zone].includes(id)) : -1;
    const wellRefs = zone === 'graveyard' ? wellCaptureSources(s, id, { from: old?.zone, player: zonePlayer < 0 ? s.cards[id].owner : zonePlayer, cause, zone: s.players[s.cards[id].owner].headquartersActive ? 'headquarters' : 'graveyard', rumor: cardHasKeyword(s, id, '传闻') }).map(id => ({ id, version: s.locations[id].zoneVersion })) : [];
    if (zone === 'graveyard' && cause === 'destroy' && destructionImmune(s, id)) {
        log(s, `${s.cards[id].name}本回合不能被消灭，消灭未生效。`);
        return false;
    }
    ;
    const destroyed = zone === 'graveyard' ? null : null;
    const tokenSealedDeath = old?.zone === 'play' && zone === 'sealed' && s.cards[id].token && hasCardType(s.cards[id], 'character');
    const dying = old?.zone === 'play' && !old.faceDown && (zone === 'graveyard' || tokenSealedDeath);
    const destination = dying && zone === 'graveyard' ? deathDestination(s, id, old, eventGroup) : null;
    const topInstead = destination === 'top';
    if (destination?.kind === 'jade') {
        const jade = s.locations[destination.sourceId], ref = sealHost(s, destination.sourceId);
        Object.assign(jade, { attachedTo: `society:${destination.controller}`, hostVersion: s.societyVersions?.[destination.controller] ?? 0 });
        delete jade.district;
        cardEvent(s, destination.sourceId, 'attached', jade, eventGroup, { host: sealHost(s, `society:${destination.controller}`) });
        zone = 'sealed';
        extra = { hostId: ref.hostId, hostVersion: ref.version, faceDown: silenceSealFace(s, id, false, { log }) };
        log(s, `八尺琼勾玉：转附本方秘社，将死亡角色${s.cards[id].name}封印在其上，而非置于墓地。`);
    }
    if (destination === 'blink') {
        const prepared = s.preparedCostDeaths?.[`${id}:${old.zoneVersion}`];
        if (!prepared) {
            deathAttachmentCosts(s, id, old, eventGroup, { move, seal: sealingEngine.seal, pay, trigger, registerGroup, log, ...(s.triggerTiming ? { defer: a => automationEngine.offerTrigger(s, a) } : {}) });
            s.deathsThisRound ??= [];
            s.deathsThisRound.push(id);
            cardEvent(s, id, 'death', old, eventGroup, { cause });
        }
        keeperEngine.death(s, id, old);
        log(s, `${s.cards[id].name}死亡时改为闪烁，而非置于墓地。`);
        automationEngine.blink(s, id, eventGroup);
        ;
        return true;
    }
    if (topInstead) {
        zone = 'deck';
        log(s, `${s.cards[id].name}的持续能力：死亡时改为置于其拥有者牌库顶，而非置于墓地。`);
    }
    if (isTaskDistrict(s.cards[id]) && old?.zone === 'play' && zone !== 'play')
        unregisterTaskDistrict(s, id);
    if (old?.zone === 'stack' && zone !== 'stack') {
        const permits = (s.effects ?? []).filter(e => e.kind === 'spell-finish-seal' && e.subjectId === id && e.subjectZoneVersion === old.zoneVersion);
        s.effects = (s.effects ?? []).filter(e => !permits.includes(e));
        if (zone === 'graveyard' && cause === 'spell-resolution')
            for (const e of permits) {
                if (sealingEngine.seal(s, id, e.host, { zone: 'stack', zoneVersion: old.zoneVersion })) {
                    log(s, `${s.cards[id].name}结束后封印在${e.host.name}上。`);
                    return true;
                }
            }
    }
    if (old?.zone === 'hand' && zone === 'graveyard' && cause === 'discard') {
        const actor = effectController ?? s.resolvingController, owner = s.cards[id].owner, st = s.societyStates?.[actor];
        if (handDiscardProtection(s, owner, actor).length) {
            log(s, '宗祠：敌方效果不能令本方弃掉手牌。');
            return false;
        }
        if (actor === 1 - owner && societyPlan(s, actor).cardinaDiscard && st?.uses?.['discard-replacement'] !== s.round && ((s.players[actor].costPool ?? 0) + s.players[actor].assets.filter(a => !a.tapped).length) >= 2) {
            const ids = (s.discardBatch?.requestedIds ?? [id]).filter(x => s.locations[x]?.zone === 'hand' && s.cards[x].owner === owner);
            const key = `discard:${actor}:${(s.discardBatch?.requestedIds ?? [id]).join(',')}`;
            const selected = discardReplacementDecision(s, key, { controller: actor, player: owner, cardIds: ids, sourceName: s.societies[actor].name });
            if (selected !== null && (typeof selected === 'string' ? selected : selected.cardId) === id) {
                pay(s, actor, 2);
                st.uses ??= {};
                st.uses['discard-replacement'] = s.round;
                log(s, `卡迪纳家族：展示待弃牌，支付2，将${s.cards[id].name}置于${s.seats[owner].name}牌库${selected.destination === 'bottom' ? '底' : '顶'}；不视为弃牌。`);
                move(s, id, 'deck');
                s.players[owner].deck = s.players[owner].deck.filter(x => x !== id);
                s.players[owner].deck[selected.destination === 'bottom' ? 'push' : 'unshift'](id);
                return true;
            }
        }
    }
    if (old?.zone === 'asset' && zone !== 'asset' && !s.preparedCostDeaths?.[`${id}:${old.zoneVersion}`])
        cardEvent(s, id, 'asset-leave', structuredClone(old), eventGroup, { cause, to: zone });
    if (old?.zone === 'play' && (old.faceDown || old.secretPlan) && zone === 'graveyard' && cause === 'destroy' && cardEvent(s, id, 'hidden-destroyed', structuredClone(old), eventGroup, { operator: effectController ?? s.resolvingController }) === false)
        return false;
    if (zone === 'play' && old?.zone !== 'play' && !extra.faceDown && chaosEntryBlocked(s, id)) {
        log(s, '戒严：混乱角色没有合法进场地区，牌留在原区域。');
        return false;
    }
    if (dying && !s.preparedCostDeaths?.[`${id}:${old.zoneVersion}`] && hasCardType(s.cards[id], 'character'))
        deathAttachmentCosts(s, id, old, eventGroup, { move, seal: sealingEngine.seal, pay, trigger, registerGroup, log, ...(s.triggerTiming ? { defer: a => automationEngine.offerTrigger(s, a) } : {}) });
    if (['graveyard', 'headquarters'].includes(old?.zone) && zone === 'play' && hasAnyCardType(s.cards[id], ['character', 'attachment']) && graveyardLocked(s, undefined, s.cards[id].owner, old.zone)) {
        log(s, `镇魂曲禁止${s.cards[id].name}从墓地进场，牌留在墓地。`);
        return false;
    }
    if (old?.zone === 'play' && zone !== 'play') {
        if (!s.preparedCostDeaths?.[`${id}:${old.zoneVersion}`])
            cardEvent(s, id, 'field-leave', old, eventGroup, { cause, to: zone });
        coreDeparture = automationEngine.shoggothDeparted(s, id, old, eventGroup);
        automationEngine.leaving(s, id);
        environmentEngine.leaving(s, id, old, zone);
        if (!s.preparedCostDeaths?.[`${id}:${old.zoneVersion}`] && !old.faceDown && (cause !== 'destroy' || printedRulesCard(s, id).automation?.leave?.includeDestroyed))
            cardEvent(s, id, 'leave', old, eventGroup, { cause, to: zone });
    }
    if (dying) {
        if (!s.preparedCostDeaths?.[`${id}:${old.zoneVersion}`]) {
            s.deathsThisRound ??= [];
            s.deathsThisRound.push(id);
            cardEvent(s, id, 'death', old, eventGroup, { cause });
        }
        keeperEngine.death(s, id, old);
    }
    if (old?.zone === 'play' && zone !== 'play') {
        for (const [aid, l] of Object.entries(s.locations))
            if (l.zone === 'play' && l.attachedTo === id && !s.regionReturnIds?.includes(aid) && !s.simultaneousDepartureIds?.includes(aid))
                recoverHostAttachment(s, aid, eventGroup);
    }
    if (s.cards[id].token && isFieldZone(old?.zone) && !isFieldZone(zone)) {
        if (tokenSealedDeath)
            log(s, `规则动作：${s.cards[id].name}指示物角色被封印视作死亡，离开游戏。`);
        zone = 'reserve';
        extra = {};
    }
    if (isFieldZone(old?.zone) && (!isFieldZone(zone) || old.zone === 'play' && zone !== 'play' && printedRulesCard(s, id)?.automation?.releaseEnemySealsToDeck))
        sealingEngine.release(s, id);
    if (['graveyard', 'headquarters'].includes(old?.zone) && zone !== old.zone && hasCardType(s.cards[id], 'character')) {
        s.graveCharacterLeftRounds ??= {};
        s.graveCharacterLeftRounds[s.cards[id].owner] = s.round;
    }
    if (['graveyard', 'headquarters'].includes(old?.zone) && zone !== old.zone)
        cardEvent(s, id, old.zone === 'headquarters' ? 'headquarters-leave' : 'grave-leave', old, eventGroup, { cause, to: zone, toHost: extra.hostId, player: s.cards[id].owner });
    if (old?.zone === 'stack' && zone === 'play' && old.waivedOptionalExtraCosts)
        extra = { waivedOptionalExtraCosts: true, chosenX: 0, ...extra };
    if (zone === 'stack')
        extra = { castFromZone: old?.zone, ...extra };
    const requestedZone = zone;
    if (zone === 'graveyard' && s.players[s.cards[id].owner].headquartersActive)
        zone = 'headquarters';
    if (zone === 'headquarters')
        s.players[s.cards[id].owner].headquarters ??= [];
    const controller = extra.controller ?? controllerOf(s, id);
    removeEverywhere(s, id);
    setLocation(s, id, zone, ['play', 'asset'].includes(zone) ? { ...extra, controller } : extra);
    if (zone === 'asset') {
        const c = printedRulesCard(s, id);
        s.players[controller].assets.push({ id, tapped: extra.tapped ?? false, faction: c.faction, magicDomains: c.magicDomains ?? [], factionColors: c.factionColors });
    }
    else if (!['sealed', 'stack', 'score'].includes(zone)) {
        const p = zone === 'core' ? extra.corePlayer : zone === 'play' ? controller : s.cards[id].owner;
        s.players[p][zone] ??= [];
        s.players[p][zone].push(id);
    }
    if (topInstead) {
        const owner = s.cards[id].owner;
        s.players[owner].deck = s.players[owner].deck.filter(x => x !== id);
        s.players[owner].deck.unshift(id);
    }
    settleClubInfluence(s);
    if (zone === 'play' && isTaskDistrict(s.cards[id]))
        registerTaskDistrict(s, id);
    if (old?.zone === 'hand' && requestedZone === 'graveyard' && ['discard', 'cost', 'hand-limit'].includes(cause)) {
        const discarded = { id, player: s.cards[id].owner, loc: s.locations[id] };
        if (s.discardBatch)
            s.discardBatch.cards.push(discarded);
        else
            cardEvent(s, id, 'discard', discarded.loc, eventGroup, { player: discarded.player, count: 1 });
    }
    if (old?.zone === 'sealed')
        cardEvent(s, id, 'seal-left', s.locations[id], eventGroup, { from: old, to: zone });
    if (['graveyard', 'headquarters'].includes(zone) && old?.zone !== zone) {
        cardEvent(s, id, zone === 'headquarters' ? 'headquarters-entry' : 'grave-entry', s.locations[id], eventGroup, { from: old, cause, effectController, player: s.cards[id].owner });
        const wellClaimed = captureWithWell(s, id, wellRefs, `${id}:${s.locations[id].zoneVersion}:${eventGroup}`, { seal: sealingEngine.seal, log, immediateEntry: () => reincarnateAfterEntry(s, id, zone === 'headquarters' ? 'headquarters-entry' : 'grave-entry', eventGroup, { move, event: cardEvent, log }) });
        if (!wellClaimed && ['effect', 'discard', 'cost'].includes(cause) && ['hand', 'deck'].includes(old?.zone) && cardHasKeyword(s, id, '传闻')) {
            const a = rumorTrigger({ ...s.cards[id], rumor: true }, { cardId: id, from: old.zone, to: 'graveyard', cause: 'card-or-ability-effect', zoneVersion: s.locations[id].zoneVersion });
            offerTrigger(s, { ...a, id: uuid(), displayName: s.cards[id].name, group: eventGroup, event: 'rumor', ...((s.activatingPrepaid ?? s.costTriggerParent) ? { triggerAfter: s.activatingPrepaid ?? s.costTriggerParent } : {}) });
            log(s, '传闻牌先进入墓地，其拥有者可选择发动封印触发。');
        }
    }
    if (['graveyard', 'headquarters'].includes(zone) && old?.zone === 'play' && !old.faceDown && hasCardType(s.cards[id], 'character'))
        rememberLambDeath(s, id, old, { cause, ruleDeath, operator: effectController ?? s.resolvingController });
    if (['graveyard', 'headquarters'].includes(zone) && old?.zone === 'play' && !old.faceDown)
        archaeologicalReturn(s, id, old, eventGroup, { move, event: cardEvent, log });
    if (['graveyard', 'headquarters'].includes(zone) && old?.zone !== zone)
        reincarnateAfterEntry(s, id, zone === 'headquarters' ? 'headquarters-entry' : 'grave-entry', eventGroup, { move, event: cardEvent, log });
    if ((s.effects ?? []).some(e => e.shoggothControl && e.sourceId === id))
        updateControl(s);
    if (zone === 'play' && extra.faceDown)
        cardEvent(s, id, 'entry', s.locations[id], eventGroup, { method: 'hidden-entry' });
    if (coreDeparture && zone === 'sealed')
        s.locations[id].coreReturnPending = coreDeparture;
    else
        automationEngine.shoggothCompleteDeparture(s, id, coreDeparture);
    if (destination?.kind === 'jade' && zone === 'sealed')
        cardEvent(s, id, 'sealed', s.locations[id], eventGroup, { from: old, host: sealHost(s, destination.sourceId) });
    ;
    return true;
}
function payCostBatch(s, ids, apply) {
    return withCostPayment(s, ids, apply, { move, flush: (s, options) => automationEngine.flushTriggerCosts(s, options), prepareDeaths(s, moves) {
            const group = s.eventGroup;
            for (const x of moves) {
                const loc = s.locations[x.id];
                if (!loc)
                    continue;
                if (loc.zone === 'asset')
                    cardEvent(s, x.id, 'asset-leave', structuredClone(loc), group, { cause: 'sacrifice', to: 'graveyard' });
                else if (loc.zone === 'play') {
                    if (!loc.faceDown && hasCardType(s.cards[x.id], 'character'))
                        deathAttachmentCosts(s, x.id, loc, group, { move, seal: sealingEngine.seal, pay, trigger, registerGroup, log, defer: a => automationEngine.offerTrigger(s, a) });
                    cardEvent(s, x.id, 'field-leave', loc, group, { cause: 'sacrifice', to: 'graveyard' });
                    if (!loc.faceDown) {
                        cardEvent(s, x.id, 'leave', loc, group, { cause: 'sacrifice', to: 'graveyard' });
                        s.deathsThisRound ??= [];
                        s.deathsThisRound.push(x.id);
                        cardEvent(s, x.id, 'death', loc, group, { cause: 'sacrifice' });
                    }
                }
                s.preparedCostDeaths[`${x.id}:${loc.zoneVersion}`] = true;
            }
        } });
}
function recoverHostAttachment(s, id, group) {
    const plan = printedRulesCard(s, id).attachment, p = controllerOf(s, id);
    if (move(s, id, plan?.recover ? 'hand' : 'graveyard') && plan?.recoverHiddenDraw && s.locations[id].zone === 'hand' && effectiveSocietyMarkers(s, p).hidden > 0)
        roundEngine.draw(s, [p], 1);
}
function conceal(s, id, group) {
    const l = s.locations[id];
    if (l?.zone !== 'play' || l.faceDown || !hasCardType(s.cards[id], 'character') || cannotFlip(s, id))
        return false;
    if (s.cards[id].token) {
        log(s, `规则动作：${s.cards[id].name}指示物潜伏后不能留在场上，离开游戏。`);
        move(s, id, 'graveyard');
        return true;
    }
    const coreDeparture = automationEngine.shoggothDeparted(s, id, l, group);
    environmentEngine.leaving(s, id, l, 'hidden');
    if (!s.preparedCostDeaths?.[`${id}:${l.zoneVersion}`]) {
        cardEvent(s, id, 'field-leave', l, group, { cause: 'conceal', to: 'hidden' });
        cardEvent(s, id, 'leave', l, group, { cause: 'conceal', to: 'hidden' });
    }
    for (const [aid, al] of Object.entries(s.locations))
        if (al.zone === 'play' && al.attachedTo === id)
            recoverHostAttachment(s, aid, group);
    sealingEngine.release(s, id);
    cardEvent(s, id, 'conceal', l, group);
    setLocation(s, id, 'play', { controller: l.controller ?? s.cards[id].owner, district: l.district, tapped: l.tapped, faceDown: true, fieldVersion: l.zoneVersion + 1, hiddenHandle: uuid(), ...(l.baseController !== undefined ? { baseController: l.baseController } : {}) });
    if (s.cards[id].automation?.entry?.allowHiddenSource)
        cardEvent(s, id, 'entry', s.locations[id], group, { method: 'hidden-entry' });
    automationEngine.shoggothCompleteDeparture(s, id, coreDeparture);
    return true;
}
function registerGroup(s, group) {
    s.triggerGroupOrder ??= [];
    if (!s.triggerGroupOrder.includes(group))
        s.triggerGroupOrder.push(group);
}
function collectTriggers(s,run){const before=s.collectingEventTriggers;s.collectingEventTriggers=true;try{run();}finally{if(before)s.collectingEventTriggers=before;else delete s.collectingEventTriggers;}if(!before)automationEngine.flushTriggerCosts(s,{batch:true});}
function offerTrigger(s,a){
 if(a.kind==='auto-ability')return automationEngine.offerTrigger(s,a);
 if(!earlyTriggerTiming(s)){if(a.mandatory&&!a.claimMobileTarget)trigger(s,a);else s.triggerChoices.push(a);return;}
 if(a.mandatory&&!a.claimMobileTarget){a.committed=true;trigger(s,a);return;}
 if(deferTriggerCost(s,a))return;
 commitTrigger(s,a);
}
function chooseBasicTrigger(s,p,c){
        const a = s.triggerChoices.find(a => a.id === c.triggerId && a.controller === p);
        need(a, '当前没有该触发选择');
        need(typeof c.fire === 'boolean', '需要明确选择是否发动');
        if (c.fire) {
            if (a.effect.kind === 'seal-from-graveyard') {
                need(!graveyardLocked(s), '镇魂曲禁止在墓地中发动传闻能力');
                const target = s.cards[c.targetId], loc = s.locations[c.targetId];
                need(target && loc?.zone === 'play' && !loc.faceDown && hasCardType(target, 'character') && (controllerOf(s, c.targetId) === p || !hasBarrier(s, c.targetId)), '请指定场上的目标角色（合法目标不能具有敌方屏障）');
                a.targetId = c.targetId;
                a.targetZoneVersion = loc.zoneVersion;
                a.sealHost = sealHost(s, c.targetId);
            }
            trigger(s, a);
        }
        s.triggerChoices = s.triggerChoices.filter(x => x.id !== a.id);
        if (!s.triggerChoices.length)
            resumeRules(s);
        return;
    }
function commitTrigger(s,a){
 const p=a.controller;
 if(triggerUnavailable(s,a))return;
 const c=triggerCostDecision(s,a);if(!c.fire){need(!a.mandatory,'强制触发必须发动');return;}
 const previous=s.triggerBatchApplying;s.triggerBatchApplying=true;
 s.triggerChoices.push(a);a.committed=true;
 try{const command={...c,id:`${a.id}:commit`,triggerId:a.id,type:a.kind==='abyss-ability'?'abyss-trigger':'trigger-choice'};if(a.kind==='abyss-ability')abyssEngine.command(s,p,command);else chooseBasicTrigger(s,p,command);}finally{if(previous)s.triggerBatchApplying=previous;else delete s.triggerBatchApplying;}
}
function trigger(s,a){
 a.abilityDescription??=abilityDescription(s,a);
 if(a.committed||s.triggerBatchApplying||s.activatingPrepaid||s.costTriggerParent)a.awaitTriggerRound=true;
 if(s.activatingPrepaid??s.costTriggerParent)a.triggerAfter=s.activatingPrepaid??s.costTriggerParent;
 const previous=s.activatingPrepaid;if(a.prepaid||a.committed)s.activatingPrepaid=a.id;
 try{automationEngine.activated(s,a);observeTargets(s,a);}finally{if(previous===undefined)delete s.activatingPrepaid;else s.activatingPrepaid=previous;}
 registerGroup(s,a.group);s.pendingTriggers.push(a);log(s,`${a.mandatory?'强制触发':'触发能力'}已发动${effectObjectsLog(s,a.targets??(a.effect?.kind==='seal-from-graveyard'&&a.targetId?[{kind:'card',cardId:a.targetId}]:[]))}，等待下一个快速行动窗口。`);
}
function openWindow(s) {
    if (s.triggerBatchApplying || s.triggerRound)
        return;
    automationEngine.flushTriggerCosts(s, { batch: true });
    s.flow.locked = false;
    if (keeperEngine.block(s))
        return;
    if (s.roundChoice || s.effectBattle || s.hidden || s.battle) {
        s.flow.locked = true;
        return;
    }
    if (offerUtopia(s))
        return;
    // Complete every optional choice in an event group before ordering the
    // group's mandatory and optional triggers together into the next stack.
    if (s.effectChoice || s.damageChoice) {
        s.flow.locked = true;
        return;
    }
    if (s.triggerChoices.length) {
        s.flow.passed = [];
        s.flow.priority = s.flow.stepOwner;
        return;
    }
    roundEngine.stateBased(s);
    if (keeperEngine.block(s) || s.ruleChoice || s.triggerChoices.length || s.status !== 'playing')
        return;
    if (s.pendingTriggers.some(a => (a.prepaid || a.awaitTriggerRound) && !a.triggerRoundNumber)) {
        s.flow.passed = [];
        s.flow.priority = s.flow.stepOwner;
        return;
    }
    if (offerTriggerOrder(s))
        return;
    // Enqueue one simultaneous group at a time. Pending event groups preserve event order.
    const batched = s.pendingTriggers.filter(a => a.triggerRoundNumber).sort((a, b) => a.triggerRoundNumber - b.triggerRoundNumber);
    s.flow.stack.push(...batched);
    const legacy = s.pendingTriggers.filter(a => !a.triggerRoundNumber);
    const groups = [...new Set(legacy.map(a => a.group))].sort((a, b) => (s.triggerGroupOrder ?? []).indexOf(a) - (s.triggerGroupOrder ?? []).indexOf(b));
    const first = roundEngine.active(s) ? s.turn.firstPlayer : s.flow.stepOwner;
    for (const group of groups) {
        for (const player of [first, 1 - first]) {
            for (const a of legacy.filter(a => a.group === group && a.controller === player))
                s.flow.stack.push(a);
        }
    }
    const n = s.pendingTriggers.length;
    s.pendingTriggers = [];
    s.triggerGroupOrder = [];
    s.flow.passed = [];
    s.flow.priority = s.windowPriorityAfterTriggers ?? s.flow.stepOwner;
    delete s.windowPriorityAfterTriggers;
    if (!s.flow.stack.length && s.delayedStackCopies?.length) {
        const copy = s.delayedStackCopies.shift();
        s.flow.stack.push(copy);
        observeTargets(s, copy);
        if (s.triggerChoices.length || s.pendingTriggers.length) {
            openWindow(s);
            return;
        }
        log(s, '守护天使：原堆叠已清空，延后的复制进入堆叠，不能响应。');
    }
    if (offerUtopia(s))
        return;
    if (n)
        log(s, `快速行动窗口开启：${n}个待入栈触发已加入堆叠。`);
}
function offerUtopia(s) {
    if (s.effectChoice || s.hidden || s.battle)
        return false;
    const tax = s.utopiaQueue?.find(x => s.flow.stack.some(a => a.id === x.entryId));
    if (!tax)
        return false;
    const entry = s.flow.stack.find(a => a.id === tax.entryId), cannotTerminate = !canTerminate(s, entry);
    s.effectChoice = { id: uuid(), kind: 'gray-tax', controller: tax.controller, amount: tax.amount, entryId: tax.entryId, cannotTerminate, cardIds: [], choiceLabel: cannotTerminate ? `计划：乌托邦 · 支付${tax.amount}费用（原效果不能被终止）` : `计划：乌托邦 · 为目标支付${tax.amount}费用，或终止整个${entry.displayName ?? '效果'}` };
    s.flow.locked = true;
    return true;
}
function responseBlocked(s) { return stackResponsesBlocked(s); }
function hasPriority(s, p, automatic = false) {
    if (s.resolutionCasting?.player === p)
        return;
    need(automatic || !responseBlocked(s), '堆叠中有不能被响应的效果，只能发动触发能力');
    need(!s.flow.locked && !s.roundChoice && !s.effectChoice && !s.effectBattle && !s.hidden && !s.battle && !s.ruleChoice && !s.triggerOrderChoice && !s.triggerRound && !currentTriggerRound(s) && !s.damageChoice && !keeperEngine.pending(s), '当前没有快速行动窗口');
    need(s.flow.priority === p, '当前没有行动优先权');
}
function pay(s, p, n) {
    const player = s.players[p], pool = player.costPool ?? 0, a = player.assets.filter(a => !a.tapped);
    need(a.length + pool >= n, '可用资产不足');
    const used = Math.min(pool, n);
    player.costPool = pool - used;
    for (let i = 0; i < n - used; i++)
        a[i].tapped = true;
}
function checkLoyalty(s, p, card) { need(loyaltyMet(s, p, card.loyalty, card), '资产未满足忠诚需求'); }
function standardAction(s, p) {
    if (s.resolutionCasting?.player === p)
        return;
    need(!roundEngine.active(s) || (s.turn.phase === 'action' && ['first-action', 'second-action'].includes(s.turn.step) && !s.turn.actionClosed), '当前没有标准行动窗口');
    need(p === s.flow.stepOwner, '只能在自己的行动步骤进行标准行动');
    need(!s.flow.stack.length, '请先结算当前堆叠');
}
function cardIdentityView(s, id) { const card = identity(s, id); return { ...card, printedCostText: cardPrintedCostText(card) }; }
function hiddenCardView(s, id, viewer) {
    const card = identity(s, id), loc = s.locations[id];
    if (loc.secretPlan && card.controller !== viewer)
        return { id, owner: card.owner, ownerName: card.ownerName, controller: card.controller, name: '秘密计划', displayName: '秘密计划', type: 'attachment', subtypes: ['计划'], printedCost: 1, secretPlan: true, tapped: loc.tapped, attachedTo: loc.attachedTo, counters: loc.counters };
    if (loc.faceDown && card.controller !== viewer)
        return { id: `hidden:${loc.hiddenHandle}`, owner: card.owner, ownerName: card.ownerName, hiddenNumber: hiddenNumber(s, id), controller: card.controller, controllerName: card.controllerName, name: '暗藏者', type: 'hidden-character', faceDown: true, district: loc.district, tapped: loc.tapped, counters: loc.counters ? { ...loc.counters } : undefined, influenceIcons: 1, text: '暗藏者具有1个势力图标，不能作为角色被指定或受到伤害。' };
    const projected = printedRulesCard(s, id);
    return { ...card, ...loc, ...(loc.secretPlan ? { name: s.cards[id].name, displayName: s.cards[id].displayName } : {}), printedCost: projected.printedCost, printedCostText: cardPrintedCostText(projected), automation: projected.automation, attachment: projected.attachment, spell: projected.spell, icons: projected.icons, temporaryIcons: projected.temporaryIcons, isReal: realityCard(s, id), keywords: projected.keywords, cannotMove: movementBlocked(s, id), cannotTap: !loc.tapped && !canTapCard(s, id), printedTextBlank: printedRulesBlank(s, id), nonBattleParticipationBlocked: nisosSources(s, id).length > 0, ...(!societyAllowsCast(s, card.controller, card) || paidRevealRestriction(s, card.controller) ? { paidRevealBlocked: true } : {}), ...(loc.faceDown ? { hiddenNumber: hiddenNumber(s, id), revealPreview: roundEngine.active(s) ? paidRevealPreview(s, id) : undefined } : {}), subtypes: effectiveSubtypes(s, id), printedSubtypes: s.cards[id].subtypes, triggerUsage: Object.fromEntries((projected.automation?.watch ?? []).map((w, i) => { const used = s.abilityUses?.[`${id}:${loc.zoneVersion}:watch:${i}`]; return [i, used?.round === s.round ? used.count : 0]; })), availableActions: effectiveActions(s, id).map((a, i) => ({ ...a, used: !!a.oncePerRound && (s.abilityUses?.[`${id}:${loc.zoneVersion}:action:${i}${a.perPlayer ? ':' + viewer : ''}`]?.round === s.round && (s.abilityUses?.[`${id}:${loc.zoneVersion}:action:${i}${a.perPlayer ? ':' + viewer : ''}`]?.count ?? 0) >= a.oncePerRound) })), ...(!loc.faceDown ? { abilitiesSuppressed: abilitiesSuppressed(s, id), leaderNow: cardHasKeyword(s, id, '领袖'), effectiveMagicDomains: effectiveMagicDomains(s, id), whiteIconsConvertedNow: whiteIconsConverted(s, id) } : {}), attachedCards: Object.entries(s.locations).filter(([, l]) => l.zone === 'play' && l.attachedTo === id).map(([aid]) => ({ id: aid, name: s.cards[aid].name })), influenceIcons: loc.faceDown ? 1 : undefined, ...(roundEngine.active(s) ? { effectiveIcons: effectiveIcons(s, id), effectiveTemporaryIcons: effectiveTemporaryIcons(s, id), effectiveDefense: loc.faceDown ? undefined : effectiveDefense(s, id), barrierNow: !loc.faceDown && hasBarrier(s, id) } : {}) };
}
function repeatResolved(s, a) {
    const repeat = a.sameEntryRepeat;
    if (!repeat?.remaining || s.status !== 'playing')
        return false;
    log(s, `${a.displayName ?? s.cards[a.cardId ?? a.sourceId]?.name ?? '触发能力'}在同一堆叠项内额外结算一次。`);
    resolve(s, { ...structuredClone(repeat.ability), sameEntryRepeat: { ...repeat, remaining: repeat.remaining - 1 } });
    return true;
}
function resolve(s, a) {
    a = prepareRepeatedResolution(s, a);
    if (a.kind === 'play-spell' && hasCardType(s.cards[a.cardId], 'spell') && a.targets?.some(t => t.kind === 'district'))
        s.resolvingDistrictTransaction = { id: a.id };
    const effectBefore = new Set(s.effects ?? []), effectSource = a.cardId ?? a.sourceId, previous = s.resolvingController, previousAbility = s.resolvingAbility, previousGroup = s.eventGroup;
    s.resolvingController = a.controller;
    s.resolvingAbility = a;
    s.eventGroup ??= a.id;
    try {
        return withGraveReference(s, a.cardId ?? a.sourceId, () => resolveInner(s, a));
    }
    finally {
        recordEffectSources(s, effectBefore, effectSource, a.plan?.abilityLabel);
        if (previousGroup === undefined)
            delete s.eventGroup;
        else
            s.eventGroup = previousGroup;
        if (previous === undefined)
            delete s.resolvingController;
        else
            s.resolvingController = previous;
        if (previousAbility === undefined)
            delete s.resolvingAbility;
        else
            s.resolvingAbility = previousAbility;
        if (!s.effectChoice && !s.hidden)
            delete s.resolvingDistrictTransaction;
    }
}
function resolveInner(s, a) {
    if (a.hallucination && automationEngine.replacement(s, a))
        return;
    if (environmentEngine.resolve(s, a))
        return;
    if (abyssEngine.resolve(s, a))
        return;
    if (zoneActionEngine.resolve(s, a))
        return;
    if (automationEngine.resolve(s, a))
        return;
    if (a.kind === 'play-character') {
        const loc = s.locations[a.cardId];
        if (loc.zone !== 'stack')
            return;
        if (!move(s, a.cardId, 'play', { controller: a.controller, district: a.district, tapped: enterTapped(s, a.cardId, a.district), markers: 0, optionalExtraPaid: !!a.optionalExtraPaid, waivedOptionalExtraCosts: !!a.waivedOptionalExtraCosts || !!loc.waivedOptionalExtraCosts })) {
            move(s, a.cardId, 'graveyard');
            return;
        }
        cardEvent(s, a.cardId, 'entry', s.locations[a.cardId], a.id, { method: 'play' });
        log(s, `${s.cards[a.cardId].name}在地区${s.locations[a.cardId].district + 1}进场。`);
        if (s.cards[a.cardId].marker)
            trigger(s, { ...markerEntryAbility(a.cardId, 'time', 1), id: `${a.id}:entry`, controller: a.controller, group: a.id });
    }
    else if (a.kind === 'reveal-character') {
        const loc = s.locations[a.cardId];
        if (loc?.zone !== 'play' || !loc.faceDown || loc.zoneVersion !== a.sourceZoneVersion || cannotFlip(s, a.cardId)) {
            log(s, '暗藏者已改变位置，现身未生效。');
            return;
        }
        if (chaosEntryBlocked(s, a.cardId)) {
            log(s, '戒严：没有合法混乱进场地区，现身未生效。');
            return;
        }
        sealingEngine.release(s, a.cardId);
        setLocation(s, a.cardId, 'play', { district: loc.district, tapped: loc.tapped || enterTapped(s, a.cardId, loc.district), markers: 0, fieldVersion: loc.zoneVersion + 1, faceDown: false, controller: loc.controller ?? a.controller, optionalExtraPaid: !!a.optionalExtraPaid });
        cardEvent(s, a.cardId, 'entry', s.locations[a.cardId], a.id, { method: 'reveal' });
        cardEvent(s, a.cardId, 'reveal', s.locations[a.cardId], a.id, { lockedBefore: (loc.counters?.locked ?? 0) > 0 });
        log(s, `${s.cards[a.cardId].name}付费翻面。`);
        if (s.cards[a.cardId].marker)
            trigger(s, { ...markerEntryAbility(a.cardId, 'time', 1), id: `${a.id}:entry`, controller: a.controller, group: a.id });
    }
    else if (a.effect?.kind === 'place-markers') {
        const loc = s.locations[a.effect.targetId];
        if (loc?.zone === 'play') {
            setCardMarker(s, loc, "markers", null, (loc.markers ?? 0) + a.effect.count);
            log(s, `时间标志已放置在${s.cards[a.effect.targetId].name}上。`);
        }
        else
            log(s, '目标已离场，标志能力未生效。');
    }
    else if (a.effect?.kind === 'seal-from-graveyard') {
        const card = { ...s.cards[a.sourceId], ...s.locations[a.sourceId], zone: inGrave(s, a.sourceId, a.sourceId) ? 'graveyard' : s.locations[a.sourceId].zone }, target = s.cards[a.targetId] ? { ...s.cards[a.targetId], ...s.locations[a.targetId] } : null;
        const result = resolveRumorSeal(card, a, target);
        if (a.targetZoneVersion !== undefined && s.locations[a.targetId]?.zoneVersion !== a.targetZoneVersion)
            result.resolved = false;
        if (target && controllerOf(s, a.targetId) !== a.controller && hasBarrier(s, a.targetId))
            result.resolved = false;
        if (result.resolved && !graveyardLocked(s)) {
            sealingEngine.seal(s, a.sourceId, a.sealHost ?? sealHost(s, a.targetId), { zone: s.locations[a.sourceId].zone, zoneVersion: a.sourceZoneVersion });
        }
        else
            log(s, '传闻结算时来源牌或目标不再合法，能力未生效。');
    }
    else if (a.kind === 'rule-return-aside') {
        returnHiddenAside(s, a);
    }
    else if (a.kind === 'gain-hidden') {
        const p = s.players[a.controller];
        setCardMarker(s, p, "markers", null, societyMarkers(p.markers.hidden, p.markers.exposed, 1, 0));
        log(s, `${s.seats[a.controller].name}的隐秘效果结算。`);
    }
    else if (a.kind === 'move-aside-to-graveyard') {
        if (s.locations[a.cardId]?.zone === 'aside') {
            move(s, a.cardId, 'graveyard');
            log(s, '测试快速行动结算：展示牌已从一旁进入墓地，回底能力将跳过它。');
        }
    }
    else
        roundEngine.resolveEffect(s, a);
    repeatResolved(s, a);
}
const sealingEngine = createSealingEngine({ move, log, event: cardEvent });
const roundEngine = createRoundEngine({ collectTriggers, offerTrigger, inspectCards: (...args) => automationEngine.inspectCards(...args), resolveEffectBattle: (s, a) => automationEngine.resolve(s, a), move, conceal, setLocation, eternalAttachmentOptions: (s, p, id) => automationEngine.options(s, p, { ...s.cards[id].attachment, cardId: id, attachmentPlay: true }), eternalAttachmentTarget: (s, p, id, value, regional) => automationEngine.prepare(s, p, { targetIds: [value] }, regional ? { target: 'district' } : { ...s.cards[id].attachment, cardId: id, attachmentPlay: true })[0], resolveRoundEnd: (s, a) => automationEngine.resolve(s, a), log, openWindow, pay, hasPriority, trigger, seal: sealingEngine.seal, releaseSeals: sealingEngine.release, cleanupSeals: sealingEngine.cleanup, stateTriggers: s => { automationEngine.conditions(s); environmentEngine.conditions(s); }, ruleActions: s => { environmentEngine.stateActions(s); uniqueEngine.check(s); }, phaseEvent: cardEvent, environment: () => environmentEngine });
const automationEngine = createAutomationEngine({ revealWorldDistrict: (s, d) => environmentEngine.reveal(s, d), repeatResolved, payCostBatch, offerTrigger, commitTrigger, payEnvironmentTrigger: (s, a) => environmentEngine.payOfferedTrigger(s, a), effectBattle: (...args) => roundEngine.effectBattle(...args), claimDistrict: (...args) => roundEngine.claimDistrict(...args), observeTargets, move, conceal, announce, registerGroup, seal: sealingEngine.seal, setLocation, log, pay, checkLoyalty, standardAction, hasPriority, openWindow, draw: roundEngine.draw, stateBased: roundEngine.stateBased, finish: roundEngine.finishGame, trigger, onTriggersChosen: resumeRules, startHidden, castDuringResolution, castOptions: (s, p, id) => { const card = s.cards[id], status = keeperCastStatus(s, p, id); return { castAllowed: status.allowed, castReason: status.reason }; }, resolveOriginal: (s, a) => resolveInner(s, { ...a, hallucination: undefined }) });
const uniqueEngine = createUniqueEngine({ move, log, resume: resumeRules });
const abyssEngine = createAbyssEngine({ offerTrigger, repeatResolved, move, seal: sealingEngine.seal, log, pay, hasPriority, standardAction, announce, openWindow, stateBased: roundEngine.stateBased, draw: roundEngine.draw, event: cardEvent, trigger, registerGroup, resume: resumeRules, targetOptions: (...args) => automationEngine.options(...args), targetRefs: (...args) => automationEngine.prepare(...args), startHidden });
const zoneActionEngine = createZoneActionEngine({ payCostBatch, resolveEffect: (s, a) => automationEngine.resolve(s, a), move, seal: sealingEngine.seal, draw: roundEngine.draw, log, pay, checkLoyalty, hasPriority, standardAction, announce, stateBased: roundEngine.stateBased, event: cardEvent, targetOptions: (...args) => automationEngine.options(...args), targetRefs: (...args) => automationEngine.prepare(...args), startHidden });
function keeperCastStatus(s, p, id) {
    const card = printedRulesCard(s, id), base = card.spell ?? card.attachment;
    const restricted = stackCastRestriction(s, p, card);
    if (restricted)
        return { allowed: false, reason: restricted };
    if (!societyAllowsCast(s, p, card))
        return { allowed: false, reason: '末日钟禁止打出非灾难牌' };
    if (hasCardType(card, 'spell') && transactionsBlocked(s))
        return { allowed: false, reason: '未横置的州议员贝伦·希恩斯禁止双方打出事务牌' };
    if (card.automation?.noNormalPlay || card.spell?.noNormalPlay || cardHasKeyword(s, id, '隐匿'))
        return { allowed: false, reason: '该牌不能正面打出' };
    if (!base && !hasCardType(card, 'character'))
        return { allowed: false, reason: '该牌没有已接入的打出流程' };
    if (base?.actionPhaseOnly && s.turn.phase !== 'action')
        return { allowed: false, reason: '该牌只能在行动阶段打出' };
    if (!base && card.automation?.cityPlayOnly && !s.districts.some(d => d?.traits?.includes('城市')))
        return { allowed: false, reason: '没有满足要求的城市地区' };
    try {
        if (!lotusFreeCast(s, p, card))
            checkLoyalty(s, p, card);
    }
    catch (e) {
        if (e instanceof RuleError)
            return { allowed: false, reason: e.message };
        throw e;
    }
    return { allowed: true };
}
function keeperCastPlan(card) { return { ...waiveCastingCosts(card.spell ?? card.attachment), timing: 'fast', transaction: hasCardType(card, 'spell'), attachmentPlay: hasCardType(card, 'attachment') && !hasCardType(card, 'spell') }; }
function prepareKeeperCast(s, p, c) {
    const card = printedRulesCard(s, c.cardId), status = keeperCastStatus(s, p, c.cardId);
    need(status.allowed, status.reason);
    if (card.spell || card.attachment) {
        const original = card.spell ?? card.attachment, plan = keeperCastPlan(card), targets = automationEngine.prepare(s, p, c, { ...plan, cardId: card.id });
        if (plan.cqRepeatModes)
            plan.selectedCQModes = [...c.modes];
        if (plan.multiMode)
            plan.selectedModes = selectedModeIds(plan, c);
        else
            need(plan.cqRepeatModes || !plan.modes || plan.modes.some(m => m.id === c.mode), '请选择能力模式');
        if (plan.districtChoice) {
            need(Number.isInteger(c.district) && !!s.districts[c.district], '请选择地区');
            plan.destinationCardId = s.districts[c.district].id;
            need(!targets.some(t => t.kind === 'card' && s.locations[t.cardId].district === c.district), '不能原地移动');
        }
        if (original.extraCost && !original.costX)
            need(targets.length === 1 && s.cards[targets[0].cardId]?.printedCost === 0, '忽略费用时X为0，只能选择印刷费用为0的目标');
        return { id: c.id, kind: 'play-spell', cardId: card.id, controller: p, displayName: card.name, mode: c.mode ?? null, plan, district: c.district ?? null, targets };
    }
    if (cardHasKeyword(s, card.id, '混乱')) {
        const ds = chaosEntryDistricts(s, card.id);
        need(ds.length, '混乱角色没有合法进场地区');
        c = { ...c, district: ds[0] };
    }
    need(Number.isInteger(c.district) && !!s.districts[c.district], '请选择存在的进场地区');
    if (card.automation?.cityPlayOnly)
        need(s.districts[c.district].traits?.includes('城市'), '该角色只能在城市地区打出');
    need(cardHasKeyword(s, card.id, '混乱') ? !chaosEntryBlocked(s, card.id) : !restrictedDistrict(s, card.id, c.district), '戒严禁止非国家机构角色正面打出在本地区');
    return { id: c.id, kind: 'play-character', cardId: card.id, controller: p, displayName: card.name, district: c.district, chosenX: 0, waivedOptionalExtraCosts: true, plan: { noResponse: coreNoResponse(s, p, card), cannotTerminate: !!card.automation?.cannotTerminate } };
}
const keeperEngine = createKeeperEngine({ log, move, prepareCast: prepareKeeperCast, announce, castStarted: (s, p, id) => consumeDiscounts(s, p, s.cards[id], 'play'),
    castOptions: (s, p, id) => {
        const card = printedRulesCard(s, id), status = keeperCastStatus(s, p, id), plan = card.spell || card.attachment ? keeperCastPlan(card) : null;
        let options = plan ? automationEngine.options(s, p, { ...plan, cardId: id }) : [];
        if ((card.spell ?? card.attachment)?.extraCost && !(card.spell ?? card.attachment).costX)
            options = options.filter(o => s.cards[o.id]?.printedCost === 0);
        return { castAllowed: status.allowed, castReason: status.reason, freeCastPlan: plan, targetOptions: options, allowedDistricts: s.districts.flatMap((d, i) => d && (true || i === 0) && (!card.automation?.cityPlayOnly || d.traits?.includes('城市')) ? [i] : []) };
    },
    resume: s => {
        if (keeperEngine.block(s))
            return;
        const a = s.keeperContinuation;
        delete s.keeperContinuation;
        if (a)
            automationEngine.finishSpell(s, a);
        if (keeperEngine.block(s))
            return;
        s.flow.locked = !!(s.effectChoice || s.damageChoice || s.roundChoice || s.hidden || s.battle);
        resumeRules(s);
    } });
function cardEvent(...args){const state=args[0],collecting=state.collectingEventTriggers;state.collectingEventTriggers=true;try{if(args[2]==='reveal')args[5]={lockedBefore:!!args[3]?.entryLockedBefore,...args[5]};if(automationEngine.event(...args)===false)return false;environmentEngine.event(...args);abyssEngine.event(...args);automationEngine.conditions(args[0],args[4]);environmentEngine.conditions(args[0],args[4]);if(args[2]==='sealed'){const s=args[0],id=args[1],departure=s.locations[id]?.coreReturnPending;if(departure){delete s.locations[id].coreReturnPending;automationEngine.shoggothCompleteDeparture(s,id,departure);}}}finally{if(collecting)state.collectingEventTriggers=collecting;else delete state.collectingEventTriggers;}if(!collecting)automationEngine.flushTriggerCosts(state,{batch:true});}
function finishSetup(s) {
    for (const p of [0, 1])
        if (!roundEngine.draw(s, [p], s.societies?.[p]?.initialHand ?? 6))
            return;
    s.turn.step = 'mulligan';
    s.flow.locked = true;
    log(s, '开局秘社效果全部结算；双方抓取起始手牌，开始再调度。');
}
const environmentEngine = createEnvironmentEngine({ repeatResolved, resolveCardAbility: (s, a) => automationEngine.resolve(s, a), initializeCore: s => automationEngine.shoggothInitialize(s), move, setLocation, seal: sealingEngine.seal, releaseSeals: sealingEngine.release, conceal, draw: roundEngine.draw, log, trigger, registerGroup, pay, hasPriority, standardAction, announce, openWindow, stateBased: roundEngine.stateBased, event: cardEvent, startHidden, onSetupDone: finishSetup, onPhaseDone: s => roundEngine.phaseReady(s), resume: resumeRules, finishRegionReturn: s => roundEngine.finishReturn(s, true), targetOptions: (...args) => automationEngine.options(...args), targetRefs: (...args) => automationEngine.prepare(...args) });
function resumeRules(s) {
    if (s.triggerBatchApplying || s.triggerRound)
        return;
    automationEngine.flushTriggerCosts(s, { batch: true });
    roundEngine.stateBased(s);
    if (keeperEngine.block(s) || s.damageChoice || s.effectChoice || s.ruleChoice || s.triggerChoices.length || s.status !== 'playing')
        return;
    if (roundEngine.active(s))
        roundEngine.onTriggersChosen(s);
    if (!s.flow.locked && !s.effectChoice && !s.hidden && !s.battle)
        openWindow(s);
}
function observeTargets(s, entry) {
    if (!entry || entry.targetsObserved)
        return;
    entry.targetsObserved = true;
    if (establishesAttachment(entry.plan))
        return;
    const taxed = utopiaTargets(s, entry);
    if (taxed) {
        s.utopiaQueue ??= [];
        s.utopiaQueue.push({ entryId: entry.id, controller: entry.controller, amount: taxed * 2 });
    }
    const source = entry.copySource ?? printedRulesCard(s, entry.cardId ?? entry.sourceId);
    for (const id of new Set((entry.targets ?? []).filter(t => t.kind === 'card' && s.locations[t.cardId] && s.locations[t.cardId].zoneVersion === t.zoneVersion).map(t => t.cardId)))
        cardEvent(s, id, 'targeted', s.locations[id], entry.group ?? entry.id, { targetingOwner: source?.owner, targetingCard: ['play-spell', 'play-character', 'reveal-character'].includes(entry.kind), targetingController: entry.controller, isAbility: !['play-spell', 'play-character', 'reveal-character'].includes(entry.kind), transactionId: entry.kind === 'play-spell' && hasCardType(source, 'spell') ? entry.cardId : null, entryId: entry.id, targetingUnique: !!source?.unique, targetingDomains: entry.copySource?.magicDomains ?? (source ? effectiveMagicDomains(s, source.id) : []) });
}
function announce(s, p, cardId, group, costGroup = null) {
    flushPlayerEvents(s, cardEvent);
    automationEngine.flushTriggerCosts(s);
    if (cardId) {
        registerGroup(s, group);
        if (costGroup && s.triggerGroupOrder.includes(costGroup)) {
            s.triggerGroupOrder = s.triggerGroupOrder.filter(g => g !== group);
            s.triggerGroupOrder.splice(s.triggerGroupOrder.indexOf(costGroup), 0, group);
        }
        cardEvent(s, cardId, 'cast', s.locations[cardId], group, { player: p });
    }
    const entry = s.flow.stack.find(a => a.id === group);
    if (!cardId && entry)
        automationEngine.activated(s, entry);
    observeTargets(s, entry);
    if (costGroup)
        roundEngine.stateBased(s);
    if (s.resolutionCasting)
        return;
    if (s.triggerChoices.length || s.pendingTriggers.length || s.ruleChoice || s.utopiaQueue?.length) {
        s.windowPriorityAfterTriggers = p;
        if (!s.effectChoice && !s.hidden)
            openWindow(s);
    }
}
function castDuringResolution(s, p, c, x) {
    const oldChoice = s.effectChoice, priority = s.flow.priority, locked = s.flow.locked, previousCasting = s.resolutionCasting;
    need(c.cardId === x.cardIds[0] && (x.castSourceZone === 'sealed' ? liveSealedCastRef(s, p, x.sealedRef) : x.castSourceZone === 'hand' ? s.players[p].hand.includes(c.cardId) && s.locations[c.cardId]?.zone === 'hand' : inGrave(s, c.cardId, x.spell.cardId)) && s.locations[c.cardId].zoneVersion === x.cardVersion, '本次打出许可已失效');
    s.resolutionCasting = { player: p, cardId: c.cardId, sourceId: x.spell.cardId, zoneVersion: x.cardVersion, castSourceZone: x.castSourceZone, sealedRef: x.sealedRef, deathBoundary: !!x.deathBoundary, fastCast: !!x.fastCast, ignoreCosts: !!x.ignoreCosts };
    s.effectChoice = null;
    s.flow.locked = false;
    s.flow.priority = p;
    try {
        executeCommand(s, p, c);
    }
    finally {
        if (previousCasting)
            s.resolutionCasting = previousCasting;
        else
            delete s.resolutionCasting;
        s.effectChoice = oldChoice;
        s.flow.priority = priority;
        s.flow.locked = locked;
    }
}
function executeCommand(s, p, c) {
    const effectBefore = new Set(s.effects ?? []), effectSource = c.type === 'effect-choice' ? s.effectChoice?.spell?.cardId : c.type === 'environment-choice' ? s.effectChoice?.job?.cardId : c.type === 'society-action' ? `society:${p}` : c.cardId, previous = s.resolvingController, previousAbility = s.resolvingAbility;
    if (['effect-choice', 'environment-choice', 'abyss-choice'].includes(c.type)) {
        const choice = s.effectChoice;
        s.resolvingAbility = choice?.spell ?? choice?.job ?? choice?.ability;
        s.resolvingController = choice?.spell?.controller ?? choice?.job?.controller ?? choice?.ability?.controller;
    }
    try {
        const source = c.type === 'effect-choice' ? s.effectChoice?.spell?.cardId : c.type === 'environment-choice' ? s.effectChoice?.job?.cardId : c.type === 'trigger-choice' ? s.triggerChoices.find(a => a.id === c.triggerId)?.cardId : c.type === 'society-action' ? `society:${p}` : c.type === 'district-action' ? s.districts[c.district]?.id : c.cardId;
        return withGraveReference(s, source ?? p, () => executeCommandInner(s, p, c));
    }
    finally {
        recordEffectSources(s, effectBefore, effectSource);
        if (previous === undefined)
            delete s.resolvingController;
        else
            s.resolvingController = previous;
        if (previousAbility === undefined)
            delete s.resolvingAbility;
        else
            s.resolvingAbility = previousAbility;
    }
}
export function canResumeTriggerWindow(s) { return s.status === 'playing' && s.flow.locked && s.pendingTriggers.length > 0 && ['prepare', 'draw', 'first-action', 'second-action', 'mobility-first', 'mobility-second', 'contest-before', 'contest-after', 'claim-before', 'claim-after', 'end'].includes(s.turn?.step) && !s.triggerChoices.length && !s.effectChoice && !s.ruleChoice && !s.damageChoice && !s.triggerOrderChoice && !s.deathContinuation && !s.keeperQueue?.length && !s.keeperContinuation && !s.hidden && !s.battle && !s.roundChoice && !s.setup && !s.manualRequest; }
function executeCommandInner(s, p, c) {
    need([0, 1].includes(p) && s.seats[p], '座位无效');
    if (c.type === 'trigger-round') {
        const next = structuredClone(s);
        try {
            submitTriggerRound(next, p, c, { execute: executeCommand, log, unavailable: triggerUnavailable, validate: validateRoundTrigger, resume: resumeRules });
        }
        catch (error) {
            if (isCostChoice(error)) {
                for (const key of Object.keys(s))
                    delete s[key];
                Object.assign(s, next);
            }
            throw error;
        }
        for (const key of Object.keys(s))
            delete s[key];
        Object.assign(s, next);
        return;
    }
    if (c.type === 'resume-window') {
        need(canResumeTriggerWindow(s), '当前没有可恢复的待入栈触发窗口');
        openWindow(s);
        log(s, '恢复快速行动窗口，待入栈触发正常加入堆叠。');
        return;
    }
    if (c.type === 'cancel-card-inspection') {
        if (s.cardInspections)
            delete s.cardInspections[p];
        return;
    }
    if (c.type === 'inspect-hidden') {
        need(s.status === 'playing', '对局未进行，不能检视');
        const n = s.triggerChoices.length;
        inspectWithMonitor(s, p, c.targetId, cardEvent);
        if (s.triggerChoices.length > n && !s.flow.locked && !s.hidden && !s.battle && !s.effectChoice && !s.ruleChoice && !s.damageChoice && !s.triggerOrderChoice)
            openWindow(s);
        return;
    }
    if (manualEngine.command(s, p, c))
        return;
    if (c.type === 'end-room') {
        need(s.status !== 'finished', '房间已经结束');
        s.status = 'finished';
        s.endedAt = Date.now();
        s.result = { winner: null, reason: `${s.seats[p].name}主动结束房间`, round: s.round, endedBy: p, kind: 'stopped' };
        s.flow.locked = true;
        s.keeperQueue = [];
        delete s.keeperContinuation;
        s.roundChoice = null;
        s.effectChoice = null;
        s.ruleChoice = null;
        s.triggerOrderChoice = null;
        s.hidden = null;
        s.battle = null;
        s.damageChoice = null;
        s.damageQueue = [];
        s.triggerChoices = [];
        s.pendingTriggers = [];
        log(s, `房间主动结束：${s.seats[p].name}停止对局，记录已保留。`);
        return;
    }
    if (c.type === 'ready') {
        need(s.status === 'waiting', '测试已经开始');
        s.seats[p].ready = !s.seats[p].ready;
        if (s.seats.every(x => x?.ready))
            initialize(s);
        return;
    }
    need(s.status === 'playing', s.status === 'finished' ? '对局已经结束，请新建房间开始下一局' : '请等待双方就绪');
    if (c.type === 'shoggoth-return-preference') {
        need(!!coreArea(s, p), '只有使用核心区的玩家可更改此选项');
        need(typeof c.skip === 'boolean', '请选择是否取消询问');
        s.playerPreferences ??= [{}, {}];
        s.playerPreferences[p] ??= {};
        s.playerPreferences[p].skipAdditionalCoreReturn = c.skip;
        return;
    }
    if (c.type === 'effect-choice' && s.effectChoice?.kind === 'gray-tax') {
        const x = s.effectChoice;
        need(x.controller === p && x.id === c.choiceId, '乌托邦选择已改变');
        need(typeof c.pay === 'boolean', '请选择是否支付');
        const entry = s.flow.stack.find(a => a.id === x.entryId);
        if (c.pay)
            pay(s, p, x.amount);
        else if (canTerminate(s, entry)) {
            s.flow.stack = s.flow.stack.filter(a => a !== entry);
            settleTerminatedCard(s, entry, move);
            log(s, '乌托邦：未支付完整费用，整个效果被终止。');
        }
        else if (entry)
            log(s, '乌托邦：未支付费用；原效果不能被终止，仍留在堆叠中。');
        s.utopiaQueue = s.utopiaQueue.filter(q => q.entryId !== x.entryId);
        s.effectChoice = null;
        openWindow(s);
        return;
    }
    if (keeperEngine.command(s, p, c))
        return;
    need(!keeperEngine.pending(s) || c.type === 'concede' || c.type === 'auto-pass', '请先完成守秘人的持续能力选择');
    if (c.type === 'auto-pass') {
        setAutoPass(s, p, c.mode, c.stepKey);
        log(s, `${s.seats[p].name}${c.mode === 'step' ? '启用本步骤让过优先权' : c.mode === 'continuous' ? '启用持续让过优先权' : '取消自动让过优先权'}。`);
        return;
    }
    if (c.type === 'trigger-order') {
        arrangeTriggers(s, p, c);
        log(s, `${s.seats[p].name}确认了本方触发的入栈顺序。`);
        openWindow(s);
        return;
    }
    need(!s.triggerOrderChoice || c.type === 'concede', '请先完成本方触发排序');
    if (c.type === 'damage-replacement') {
        if (chooseDamageReplacement(s, p, c) && !s.effectChoice) {
            s.flow.locked = false;
            resumeRules(s);
        }
        return;
    }
    need(!s.damageChoice || c.type === 'concede', '请先完成伤害替代选择');
    if (uniqueEngine.command(s, p, c))
        return;
    need(!s.ruleChoice || c.type === 'concede', '请先完成独有或领袖的规则性牺牲选择');
    if (inspectPrediction(s, p, c))
        return;
    if (environmentEngine.command(s, p, c))
        return;
    if (abyssEngine.command(s, p, c))
        return;
    if (zoneActionEngine.command(s, p, c))
        return;
    if (c.type === 'effect-choice' && s.effectChoice?.kind === 'hidden-return-order') {
        const x = s.effectChoice;
        need(x.controller === p && x.id === c.choiceId, '当前没有属于你的回底顺序选择');
        const ids = c.cardIds;
        need(Array.isArray(ids) && ids.length === x.cardIds.length && new Set(ids).size === ids.length && ids.every(id => x.cardIds.includes(id)), '请排列全部展示牌');
        for (const id of ids)
            if (eligibleAsideReturns(x.returnAbility, s.locations).some(v => v.cardId === id))
                move(s, id, 'deck');
        s.effectChoice = null;
        returnHiddenAside(s, x.returnAbility);
        if (!s.effectChoice) {
            resumeRules(s);
            if (!s.ruleChoice && !s.damageChoice && !s.effectChoice && s.status === 'playing')
                openWindow(s);
        }
        return;
    }
    if (c.type === 'effect-choice' && s.effectChoice?.kind === 'hidden-predict') {
        const x = s.effectChoice;
        need(x.controller === p && x.id === c.choiceId, '当前没有属于你的预测奖励');
        need(Array.isArray(c.top) && Array.isArray(c.bottom), '请安排预测牌');
        const ids = [...c.top, ...c.bottom];
        need(ids.length === x.cardIds.length && new Set(ids).size === ids.length && ids.every(id => x.cardIds.includes(id)) && x.cardIds.every((id, i) => s.players[p].deck[i] === id), '预测牌库已变化');
        s.players[p].deck = [...c.top, ...s.players[p].deck.slice(ids.length), ...c.bottom];
        finishPrediction(s, x, c, { event: cardEvent });
        s.effectChoice = null;
        finishHidden(s);
        return;
    }
    if (c.type === 'effect-choice' && s.effectChoice?.kind === 'hidden-target') {
        const x = s.effectChoice;
        need(x.controller === p && x.id === c.choiceId, '当前没有属于你的隐秘目标选择');
        const entry = s.flow.stack.find(a => a.id === x.entryId);
        need(entry, '隐秘能力已经失效');
        if (c.skip === true) {
            need(x.canSkip, '该隐秘能力不能跳过');
            s.flow.stack = s.flow.stack.filter(a => a !== entry);
        }
        else {
            entry.targets = automationEngine.prepare(s, p, { targetIds: x.targetPair ? c.targetIds : [c.cardId] }, entry.plan);
            if (entry.plan.optionalHiddenCost || entry.plan.hiddenActivationCost !== undefined) {
                const cost = entry.plan.optionalHiddenCost ? s.cards[entry.targets[0].cardId].printedCost : entry.plan.hiddenActivationCost;
                pay(s, p, cost);
                if (entry.plan.optionalHiddenCost)
                    entry.plan.exactPrintedCost = cost;
                entry.plan.extraPaid = cost;
                log(s, `${s.seats[p].name}支付${cost}，发动隐秘能力。`);
            }
            observeTargets(s, entry);
        }
        s.effectChoice = null;
        advanceHiddenTargets(s);
        return;
    }
    if (automationEngine.command(s, p, c))
        return;
    if (roundEngine.command(s, p, c))
        return;
    if (c.type === 'select-hidden') {
        need(s.hidden, '没有隐秘对抗');
        s.hidden = selectHiddenCard(s.hidden, s.players, p, c.cardIds ?? c.cardId, s.cards);
        log(s, `${s.seats[p].name}已锁定隐秘对抗选择。`);
        if (s.hidden.firstSelectionPlayer === p) {
            s.hidden.earlyRevealed = { player: p, cardIds: hiddenSelectionIds(s.hidden.selections[p]) };
            log(s, `${s.seats[p].name}先展示${s.hidden.earlyRevealed.cardIds.map(id => s.cards[id].name).join('、')}。`);
        }
        if (s.hidden.selections.every(Boolean)) {
            // Player bonuses apply once; display-card bonuses apply independently to every selected card.
            const bonuses = s.players.map((pl, i) => networkHiddenBonus(s, i) + abyssHiddenBonus(s, i) + (s.hidden.environmentBonusScope !== 'card' ? (s.hidden.environmentBonus?.[i] ?? 0) : 0) + (s.hidden.pendingBonus?.[i] ?? 0));
            const perCardBonuses = s.players.map((pl, i) => equippedHiddenBonus(s, i) + shoggothHiddenBonus(s, i) + (s.hidden.environmentBonusScope === 'card' ? (s.hidden.environmentBonus?.[i] ?? 0) : 0) + (s.hidden.pendingCardBonus?.[i] ?? 0) + (s.turn?.firstPlayer === i ? (s.societies?.[i]?.plan.hiddenFirstBonus ?? 0) : 0));
            const cardBonuses = {};
            for (const i of [0, 1])
                for (const id of hiddenSelectionIds(s.hidden.selections[i])) {
                    const shown = s.cards[id], pl = s.players[i], plan = s.societies?.[i]?.plan ?? {};
                    cardBonuses[id] = perCardBonuses[i] + undercoverHiddenPenalty(s, i) + regionalHiddenBonus(s, i, id) + (shown.faction?.includes('炼金师学会') ? pl.play.filter(x => s.locations[x]?.zone === 'play' && !s.locations[x].faceDown && printedRulesCard(s, x).automation?.static === 'alchemist-hidden-bonus').length : 0) + anchorHiddenBonus(s, i) + criminalHiddenBonus(s, i, id) + (effectiveSubtypes(s, id).includes('吸血鬼') ? pl.play.filter(x => !s.locations[x].faceDown && printedRulesCard(s, x).automation?.static === 'vampire-hidden-bonus').length * 2 : 0) + (s.hidden.cardBonus?.controller === i && (!s.hidden.cardBonus.type || hasCardType(shown, s.hidden.cardBonus.type)) && (!s.hidden.cardBonus.magic || effectiveMagicDomains(s, id).includes(s.hidden.cardBonus.magic)) && (!s.hidden.cardBonus.colors || s.hidden.cardBonus.colors.some(color => (shown.factionColors ?? [shown.faction?.split('·')[0]]).includes(color))) && (!s.hidden.cardBonus.subtypes || s.hidden.cardBonus.subtypes.some(t => effectiveSubtypes(s, id).includes(t))) && (!s.hidden.cardBonus.faction || shown.faction?.split('·')[0] === s.hidden.cardBonus.faction) ? s.hidden.cardBonus.amount : 0) + (s.hidden.entropyDeclaration && effectiveSubtypes(s, id).includes(s.hidden.entropyDeclaration) ? 2 : 0) + (effectiveSubtypes(s, id).includes('阴魂') ? (plan.hiddenGhostBonus ?? 0) : 0);
                }
            const r = revealHiddenCards(s.hidden, s.players, Object.fromEntries(Object.keys(s.cards).map(id => [id, yellowHiddenCard(s, entropyHiddenCard(s, id))])), bonuses, cardBonuses);
            s.players = r.players;
            s.hidden = r.contest;
            for (const x of s.hidden.revealed.flatMap(c => c.cards ?? [c])) {
                setLocation(s, x.cardId, 'aside', { asideToken: x.asideToken });
                s.players[x.owner].aside.push(x.cardId);
            }
            s.flow.stack.push(...s.hidden.stackedAbilities.filter(a => a.kind === 'rule-return-aside'));
            s.hidden.triggeredAbilities = s.hidden.stackedAbilities.filter(a => a.kind !== 'rule-return-aside').map(a => a.plan ? { ...a, plan: { ...a.plan, sourceVersion: s.locations[a.sourceId].zoneVersion } } : a);
            log(s, `双方展示：${s.hidden.revealed.map(x => `${s.seats[x.owner].name}展示${(x.cards ?? [x]).map(c => s.cards[c.cardId].name).join('、')}（印刷${x.printedCost}，修正${x.modifier >= 0 ? '+' : ''}${x.modifier}，合计${x.value}）`).join('；')}。`);
            s.hidden.targetEntries = [];
            advanceHiddenTargets(s);
        }
        return;
    }
    if (c.type === 'hidden-reward') {
        need(s.hidden?.step === 7 && s.hidden.comparison.player === p, '当前不能选择隐秘对抗奖励');
        if (s.hidden.rewardKind === 'predict') {
            need(['predict', 'none'].includes(c.reward), '本次奖励仅为预测1');
            if (c.reward === 'predict') {
                s.effectChoice = { id: uuid(), kind: 'hidden-predict', controller: p, cardIds: s.players[p].deck.slice(0, 1), choiceLabel: '隐秘对抗奖励 · 预测1' };
                beginPrediction(s, s.effectChoice);
                return;
            }
            finishHidden(s);
            return;
        }
        need(['hidden', 'exposed', 'none'].includes(c.reward), '奖励选项无效');
        if (c.reward !== 'none') {
            const who = c.reward === 'hidden' ? p : 1 - p, v = s.players[who];
            setCardMarker(s, v, "markers", null, societyMarkers(v.markers.hidden, v.markers.exposed, c.reward === 'hidden' ? 1 : 0, c.reward === 'exposed' ? 1 : 0));
            log(s, c.reward === 'hidden' ? '胜者选择放置本方隐秘标志。' : '胜者选择放置敌方暴露标志。');
        }
        finishHidden(s);
        return;
    }
    if(c.type==='trigger-choice'){chooseBasicTrigger(s,p,c);return;}
    if (c.type === 'finish-battle') {
        need(s.battle?.controller === p, '只有测试发起方能结束本次战斗测试');
        need(!s.triggerChoices.length, '请先完成触发能力是否发动的选择');
        s.battle = null;
        log(s, '战斗测试结束。');
        openWindow(s);
        return;
    }
    hasPriority(s, p, c.type === 'pass' && !!c.automatic);
    need(!s.triggerChoices.length, '请先完成触发选择');
    if (c.type === 'pass') {
        if (c.automatic)
            log(s, `${s.seats[p].name}自动让过优先权。`);
        // Passing on an empty stack closes the owner's standard actions. Passing
        // while responding to a stack does not prevent further standard actions.
        if (roundEngine.active(s) && !s.flow.stack.length && s.turn.phase === 'action' && ['first-action', 'second-action'].includes(s.turn.step) && p === s.flow.stepOwner)
            s.turn.actionClosed = true;
        const r = passPriority(s.flow, p);
        s.flow = r.state;
        if (r.action === 'resolve-one') {
            resolve(s, r.entry);
            roundEngine.stateBased(s);
            if (s.status === 'playing' && !s.effectChoice && !s.hidden && !['claim-return', 'claim-lake'].includes(s.turn?.step))
                openWindow(s);
        }
        else if (r.action === 'window-complete') {
            if (roundEngine.active(s)) {
                roundEngine.advance(s);
                return;
            }
            s.round++;
            resetAutoPassForRound(s);
            s.flow = newPriority(1 - s.flow.stepOwner);
            resetAssets(s);
            for (const player of s.players) {
                player.actionsUsed = { asset: false, secret: false };
                player.actionCounts = { asset: 0, secret: 0 };
                for (const id of player.play)
                    resetCard(s, id, controllerOf(s, id));
            }
            log(s, '本测试窗口结束，交换先手并重置测试资产。正式回合各阶段尚未接入。');
        }
        return;
    }
    if (c.type === 'move-aside') {
        need(s.locations[c.cardId]?.zone === 'aside', '该牌没有被置于一旁');
        s.flow = pushAbility(s.flow, p, { id: c.id, kind: 'move-aside-to-graveyard', cardId: c.cardId, controller: p });
        return;
    }
    if (c.type === 'reveal') {
        const card = printedRulesCard(s, c.cardId), loc = s.locations[c.cardId];
        need(card && controllerOf(s, c.cardId) === p && loc?.zone === 'play' && loc.faceDown, '只能令自己的暗藏者现身');
        need(societyAllowsCast(s, p, card), s.societies?.[p]?.plan?.disasterOnly ? '末日钟禁止付费翻面非灾难牌' : '修格斯失控限制禁止付费翻面该牌');
        need(!card.automation?.noPaidReveal, '该牌不能付费翻面，只能由卡牌或能力效果令其现身');
        need(!paidRevealRestriction(s, p), '疯狂之影刹奇拉：只能在自己的行动步骤付费翻面');
        need(!s.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === c.cardId), '该暗藏者已在等待现身');
        need(!cannotFlip(s, card.id), '具有锁定标志的该暗藏者不能翻面');
        checkLoyalty(s, p, card);
        const optional = !!card.automation?.optionalExtraCost && c.payOptionalExtra === true, extra = prepareDeathCharacterCost(s, p, card.id, 'reveal', c.costIds ?? []), requiredCost = Math.max(0, castingCost(s, p, card, 'reveal', [], optional ? card.automation.optionalExtraCost : 0) - extra.reduction);
        pay(s, p, requiredCost);
        const costGroup = `cost:${c.id}`;
        s.flow = pushAbility(s.flow, p, { id: c.id, kind: 'reveal-character', cardId: card.id, optionalExtraPaid: optional, sourceZoneVersion: loc.zoneVersion, controller: p, displayName: card.name, plan: { noResponse: coreNoResponse(s, p, card), cannotTerminate: !!card.automation?.cannotTerminate } });
        log(s, `${s.seats[p].name}${requiredCost > 0 ? `支付${requiredCost}点费用，` : ''}宣布${card.name}付费翻面，${cardHasKeyword(s, card.id, '混乱') ? '具有混乱，结算时随机决定进场地区' : `将进入地区${(loc.district) + 1}`}，进入堆叠。`);
        beginEventGroup(s, costGroup);
        payCostBatch(s, extra.payments.filter(x => x.kind === 'sacrifice').map(x => x.id), () => {
            tapCostCards(s, p, extra.payments.filter(x => x.kind === 'tap').map(x => x.id));
            for (const { id, kind } of extra.payments) {
                if (kind === 'tap') { /* Paid as one batch above. */ }
                else if (kind === 'shuffle-seal') {
                    need(move(s, id, 'deck'), '封印牌无法洗回牌库');
                    shuffle(s.players[s.cards[id].owner].deck);
                }
                else
                    move(s, id, kind === 'bottom' ? 'deck' : 'graveyard', kind === 'sacrifice' ? { cause: 'sacrifice' } : { cause: 'cost' });
            }
            ;
        });
        endEventGroup(s);
        consumeDiscounts(s, p, card, 'reveal');
        automationEngine.flushTriggerCosts(s);
        cardEvent(s, card.id, 'cast', loc, c.id, { player: p, method: 'paid-reveal' });
        commandPostTax(s, s.flow.stack.find(a => a.id === c.id), { pay, move, log });
        announce(s, p, null, c.id, extra.ids.length ? costGroup : null);
        return;
    }
    if (!(c.type === 'play' && fateSealedPermission(s, p, c.cardId)))
        standardAction(s, p);
    if (c.type === 'build-asset') {
        const card = printedRulesCard(s, c.cardId), player = s.players[p];
        need(player.hand.includes(c.cardId), '只能用自己的手牌建立资产');
        need(!cannotBuildAsset(s, p, card), '该牌不能用于建立资产');
        player.actionsUsed ??= { asset: false, secret: false };
        need(actionUsed(s, p, 'asset') < actionAllowance(s, p, 'asset'), '本回合建立资产次数已用完');
        move(s, card.id, 'asset', { controller: p, tapped: false });
        useRoundAction(s, p, 'asset');
        s.flow.passed = [];
        log(s, societyPlan(s, p).replaceRealAsset && !card.token ? `${s.seats[p].name}完成建立资产，由世界持续能力替代为小世界。此行动不进入堆叠。` : `${s.seats[p].name}将${card.name}建立为资产。此行动不进入堆叠，不能被响应。`);
        return;
    }
    if (c.type === 'secret-deploy') {
        need(!secretDeploymentBlocked(s, p), '阿格斯IV或帷幕之后的持续能力禁止秘密派遣');
        const card = printedRulesCard(s, c.cardId), player = s.players[p];
        need(player.hand.includes(c.cardId), '只能秘密派遣自己的手牌');
        const attachment = hasCardType(card, 'attachment') && societyPlan(s, p).secretAttachments;
        need(hasCardType(card, 'character') || attachment, '只有角色牌或天人学会的附属牌可秘密派遣');
        if (attachment) {
            need(actionUsed(s, p, 'secret') < actionAllowance(s, p, 'secret'), '本回合秘密派遣次数已用完');
            pay(s, p, Math.max(0, 1 - secretDeploymentDiscount(s, p)));
            move(s, card.id, 'play', { controller: p, tapped: false, secretPlan: true, attachedTo: `society:${p}`, hostVersion: s.societyVersions?.[p] ?? 0, counters: { progress: 0 } });
            useRoundAction(s, p, 'secret');
            cardEvent(s, card.id, 'entry', s.locations[card.id], c.id, { method: 'secret-deploy' });
            roundEngine.stateBased(s);
            openWindow(s);
            log(s, `天人学会：支付${Math.max(0, 1 - secretDeploymentDiscount(s, p))}秘密派遣附属，背面结附于本方秘社。`);
            return;
        }
        need(!cardHasKeyword(s, card.id, '公开'), '公开角色不能被秘密派遣');
        need(Number.isInteger(c.district) && c.district >= 0 && c.district < (s.districts?.length ?? 3) && (!roundEngine.active(s) || s.districts[c.district]), '请选择一个现存地区');
        player.actionsUsed ??= { asset: false, secret: false };
        need(actionUsed(s, p, 'secret') < actionAllowance(s, p, 'secret'), '本回合秘密派遣次数已用完');
        const secretCost = Math.max(0, 1 - secretDeploymentDiscount(s, p) + s.players.flatMap(pl => pl.play).filter(id => { const l = s.locations[id]; return l.zone === 'play' && !l.faceDown && !l.tapped && l.district === c.district && printedRulesCard(s, id).automation?.static === 'secret-deploy-tax'; }).length);
        pay(s, p, secretCost);
        move(s, card.id, 'play', { district: c.district, tapped: false, faceDown: true, hiddenHandle: uuid() });
        useRoundAction(s, p, 'secret');
        s.flow.passed = [];
        log(s, `${s.seats[p].name}${secretCost > 0 ? `支付${secretCost}点费用，` : ''}秘密派遣一张暗藏者至地区${c.district + 1}。此行动不进入堆叠。`);
        return;
    }
    if (c.type === 'play') {
        if (cardHasKeyword(s, c.cardId, '混乱')) {
            const ds = chaosEntryDistricts(s, c.cardId);
            need(ds.length, '混乱角色没有合法进场地区');
            c = { ...c, district: ds[0] };
        }
        const permission = castSourceStatus(s, p, c.cardId);
        need(permission.allowed, permission.reason);
        const sealedMethods = s.locations[c.cardId]?.zone === 'sealed' ? sealedCastMethods(s, p, c.cardId, castSourceStatus(s, p, c.cardId, { ignorePalace: true }).allowed) : [], sealedMethod = sealedMethods.find(m => m.id === (c.sealedCastMethod ?? sealedMethods[0]?.id));
        need(!sealedMethods.length || sealedMethod, '请选择有效的封印区打出方式');
        need(Number.isInteger(c.district) && c.district >= 0 && c.district < (s.districts?.length ?? 3) && (!roundEngine.active(s) || s.districts[c.district]), '请选择一个现存地区');
        need(!cardHasKeyword(s, c.cardId, '隐匿'), '隐匿角色只能秘密派遣');
        if (!lotusFreeCast(s, p, s.cards[c.cardId]))
            checkLoyalty(s, p, s.cards[c.cardId]);
        const graveMethod = selectedGraveCast(s, p, c.cardId, c.graveCastMethod), hades = graveMethod?.id === 'hades' && !lotusFreeCast(s, p, printedRulesCard(s, c.cardId)), hadesIds = c.hadesIds ?? [];
        if (hades)
            need(Array.isArray(hadesIds) && hadesIds.length === 2 && new Set(hadesIds).size === 2 && hadesIds.every(x => hadesCosts(s, p, c.cardId).includes(x)), '哈迪斯需要两张其他同主类别墓地牌作为费用');
        const card = printedRulesCard(s, c.cardId);
        need(cardHasKeyword(s, card.id, '混乱') ? !chaosEntryBlocked(s, card.id) : !restrictedDistrict(s, card.id, c.district), '戒严禁止非国家机构角色正面打出在本地区');
        need(!card.automation?.cityPlayOnly || districtTraits(s, c.district).includes('城市'), '该角色只能打出在城市地区');
        const free = lotusFreeCast(s, p, card), revealIds = free ? [] : c.revealIds ?? [], discount = revealHandCostReduction(s, p, card.id, revealIds), extra = free ? { ids: [], payments: [], reduction: 0 } : prepareDeathCharacterCost(s, p, card.id, 'play', c.costIds ?? []), optional = !!card.automation?.optionalExtraCost && c.payOptionalExtra === true, requiredCost = free ? 0 : Math.max(0, castingCost(s, p, card, 'play', [], optional ? card.automation.optionalExtraCost : 0) - discount - extra.reduction);
        if (graveMethod)
            log(s, `${s.seats[p].name}选择墓地打出方式：${graveMethod.label}。`);
        const corePayment = s.locations[card.id].zone === 'core' ? (coreRest(s, p) - (c.honorRest ?? 0)) * 2 : 0, coreHonor = s.locations[card.id].zone === 'core' ? (c.honorRest ?? 0) * 2 : 0;
        pay(s, p, requiredCost);
        coreCastPayment(s, p, card.id, c, pay);
        consumeSealedCast(s, p, card.id, sealedMethod);
        ;
        if (sealedMethod)
            log(s, `${s.seats[p].name}选择封印区打出方式：${sealedMethod.label}。`);
        consumeDiscounts(s, p, card, 'play');
        if (revealIds.length)
            log(s, `额外费用：${s.seats[p].name}展示手牌${revealIds.map(id => s.cards[id].name).join('、')}，所需费用减少${discount}；这些牌仍留在手中。`);
        const costGroup = `cost:${c.id}`;
        beginEventGroup(s, costGroup);
        move(s, c.cardId, 'stack', { controller: p, ...(free ? { chosenX: 0, waivedOptionalExtraCosts: true } : {}) });
        s.flow = pushAbility(s.flow, p, { id: c.id, kind: 'play-character', cardId: c.cardId, optionalExtraPaid: optional || free && !!card.automation?.optionalExtraCost, district: c.district, controller: p, displayName: card.name, plan: { noResponse: coreNoResponse(s, p, card), cannotTerminate: !!card.automation?.cannotTerminate, graveCastMethod: graveMethod?.id } });
        log(s, `${s.seats[p].name}打出${s.cards[c.cardId].name}${requiredCost + corePayment > 0 ? `，支付${requiredCost + corePayment}点费用` : ''}${coreHonor ? `，支付${coreHonor}名誉点` : ''}，${cardHasKeyword(s, card.id, '混乱') ? '具有混乱，结算时随机决定进场地区' : `将进入地区${(c.district) + 1}`}，进入堆叠。`);
        payCostBatch(s, extra.payments.filter(x => x.kind === 'sacrifice').map(x => x.id), () => {
            if (hades)
                for (const id of hadesIds)
                    move(s, id, 'deck', { cause: 'cost' });
            tapCostCards(s, p, extra.payments.filter(x => x.kind === 'tap').map(x => x.id));
            for (const { id, kind } of extra.payments) {
                if (kind === 'tap') { /* Paid as one batch above. */ }
                else if (kind === 'shuffle-seal') {
                    need(move(s, id, 'deck'), '封印牌无法洗回牌库');
                    shuffle(s.players[s.cards[id].owner].deck);
                }
                else
                    move(s, id, kind === 'bottom' ? 'deck' : 'graveyard', kind === 'sacrifice' ? { cause: 'sacrifice' } : { cause: 'cost' });
            }
            ;
        });
        endEventGroup(s);
        announce(s, p, c.cardId, c.id, extra.ids.length || hades ? costGroup : null);
        return;
    }
    if (c.type === 'hidden') {
        const r = beginHiddenContest(s.players, s.flow.priority, c.id);
        if (r.skipped) {
            log(s, '有玩家的手牌与牌库同时为空，不进行隐秘对抗。');
            return;
        }
        pay(s, p, 1); // Lab society ability cost; not an official society rule.
        // Preserve payment made after the cloned contest preparation.
        for (let i = 0; i < 2; i++)
            r.players[i].assets = s.players[i].assets;
        s.players = r.players;
        s.hidden = r.contest;
        s.flow.locked = true;
        for (let i = 0; i < 2; i++)
            for (const id of s.players[i].hand)
                if (s.locations[id].zone === 'deck')
                    setLocation(s, id, 'hand');
        log(s, '隐秘对抗开始：双方牌库顶牌置于手中；秘密选择一张手牌。期间没有快速行动窗口。');
        return;
    }
    if (c.type === 'battle') {
        s.battle = { controller: p };
        s.flow.locked = true;
        log(s, '战斗触发测试开始：快速行动窗口关闭。');
        for (let who = 0; who < 2; who++)
            for (const id of s.players[who].play)
                if (!s.locations[id].faceDown && s.cards[id].battleTrigger) {
                    s.triggerChoices.push({ id: `${c.id}:${id}`, kind: 'trigger', mandatory: false, sourceId: id, controller: who, group: c.id,
                        effect: { kind: 'place-markers', targetId: id, marker: 'time', count: 1 } });
                }
        return;
    }
    if (c.type === 'discard-rumor') {
        need(s.players[p].hand.includes(c.cardId), '请从自己的手牌选择测试牌');
        need(s.cards[c.cardId].rumor, '该测试牌没有传闻能力');
        move(s, c.cardId, 'graveyard');
        log(s, '测试弃牌效果：传闻牌已进入墓地。');
        const a = rumorTrigger(s.cards[c.cardId], { cardId: c.cardId, from: 'hand', to: 'graveyard', cause: 'card-or-ability-effect', zoneVersion: s.locations[c.cardId].zoneVersion });
        s.triggerChoices.push({ ...a, id: `${c.id}:rumor`, group: c.id });
        return;
    }
    throw new RuleError('不支持的操作');
}
function canManualFlip(s, id) { const l = s.locations[id]; return l?.zone === 'play' && !cannotFlip(s, id) && (l.faceDown ? !chaosEntryBlocked(s, id) : hasCardType(s.cards[id], 'character')); }
function manualFlip(s, id, group) {
    const l = s.locations[id];
    if (!canManualFlip(s, id))
        return false;
    if (!l.faceDown)
        return conceal(s, id, group);
    sealingEngine.release(s, id);
    if (!setLocation(s, id, 'play', { district: l.district, tapped: l.tapped || enterTapped(s, id, l.district), fieldVersion: l.zoneVersion + 1, faceDown: false, controller: controllerOf(s, id), ...(l.baseController !== undefined ? { baseController: l.baseController } : {}) }))
        return false;
    cardEvent(s, id, 'entry', s.locations[id], group, { method: 'effect-reveal' });
    cardEvent(s, id, 'reveal', s.locations[id], group, { lockedBefore: (l.counters?.locked ?? 0) > 0 });
    if (s.cards[id].marker)
        trigger(s, { ...markerEntryAbility(id, 'time', 1), id: `${group}:entry:${id}`, controller: controllerOf(s, id), group });
    return true;
}
const manualEngine = createManualEngine({ targetOptions: (...args) => automationEngine.options(...args), seal: sealingEngine.seal, move, draw: roundEngine.draw, log, openWindow, stateBased: roundEngine.stateBased, event: cardEvent, flipCharacter: manualFlip, canFlipCharacter: canManualFlip, startHidden });
const commandLabels = { 'trigger-cost-choice': '触发时支付费用', 'influence-choice': '势力抵消或移除位置选择', 'reset-tax-choice': '立方重置费用选择', 'trigger-round': '批量确认触发轮', 'continuous-choice': '持续能力选择', 'prediction-inspect': '联席会议观察员私人检视', 'draw-replacement-choice': '心脑系统重塑实验室抓牌替代选择', 'resume-window': '恢复待入栈触发窗口', 'death-seal-choice': '伊索德死亡触发费用与目标选择', 'discard-replacement-choice': '卡迪纳家族弃牌替代选择', 'inspect-hidden': '监控员私人检视暗藏者', 'keeper-choice': '守秘人免费打出与回手选择', 'trigger-order': '确认本方触发入栈顺序', 'zone-activate': '发动手牌或墓地能力', 'abyss-hand': '发动印刷手牌行动', 'abyss-field': '发动深渊兽场上能力', 'abyss-choice': '深渊兽结算选择', 'abyss-trigger': '深渊之序触发选择', pass: '让过优先权与结算', play: '打出卡牌', reveal: '暗藏者现身', activate: '发动能力', 'build-asset': '建立资产', 'secret-deploy': '秘密派遣', 'tap-asset': '横置资产', 'auto-pass': '自动让过优先权', 'trigger-choice': '触发选择', 'rule-sacrifice': '规则性牺牲', 'effect-choice': '结算选择', 'select-hidden': '隐秘对抗选择', 'hidden-reward': '隐秘奖励', 'end-room': '结束房间', concede: '认输', 'society-action': '发动秘社能力', 'district-action': '发动地区能力', 'environment-choice': '秘社或地区结算选择', 'environment-trigger': '秘社或地区触发选择', 'world-preview': '世界牌库私人检视', 'road-move': '公路移动', 'lake-claim': '亚伯拉罕湖封印选择', 'return-district': '地区回底', 'replace-battle-damage': '执行部特遣组替代战斗伤害', 'assign-damage': '分配伤害', mulligan: '再调度' };
export function command(s, p, c) { const result = recordedCommand(s, p, c); recordReplayStep(s, p, c); return result; }
function recordedCommand(s, p, c) {
    // Conceding is an out-of-game decision: it cannot wait for priority,
    // another player's consent, or an interrupted cost/trigger choice.
    if (c.type === 'concede') {
        need([0, 1].includes(p) && s.seats[p], '座位无效');
        need(s.status === 'playing', '仅进行中的对局可以投降');
        roundEngine.finishGame(s, 1 - p, `${s.seats[p].name}投降`);
        s.result = { ...s.result, kind: 'conceded', endedBy: p };
        s.undoFrames = [];
        s.keeperQueue = [];
        s.triggerChoices = [];
        s.pendingTriggers = [];
        for (const key of ['deathContinuation', 'keeperContinuation', 'triggerRound', 'deferredTriggerCosts', 'flushingTriggerCosts', 'costTriggerParent', 'effectBattle', 'utopiaQueue'])
            delete s[key];
        for (const key of ['manualRequest', 'hidden', 'battle', 'triggerOrderChoice'])
            s[key] = null;
        s.manualSelections = {};
        s.privateInspections = {};
        if (s.bot) {
            s.bot.pending = false;
            s.bot.undoPaused = true;
            delete s.bot.blocked;
        }
        return;
    }
    if (c.type === 'shoggoth-return-preference')
        return applyCommand(s, p, c);
    migrateLegacyDeterChoice(s);
    let text = null, selectionId = null;
    if (c.type === 'room-message') {
        const def = parseRoomCommand(c.text);
        if (def) {
            text = c.text;
            c = { id: c.id, type: def.select ? 'manual-selection-start' : 'manual-request', operation: def.operation, commandText: text, ...(def.count !== undefined ? { count: def.count } : {}), ...(def.zone ? { zone: def.zone } : {}), ...(['deck', 'unordered-deck'].includes(def.zone) ? { count: s.players[p]?.deck.length ?? 0 } : def.count !== undefined ? { count: def.count } : {}) };
        }
    }
    if (c.type === 'manual-selection-submit') {
        const pick = s.manualSelections?.[p];
        need(pick && pick.id === c.selectionId, '选牌指令已关闭或变化');
        selectionId = pick.id;
        c = { id: c.id, type: 'manual-request', operation: pick.operation, cardIds: c.cardIds, destinations: c.destinations, district: c.district, count: pick.count, commandText: pick.commandText };
    }
    const result = runDeathCommand(s, p, c, applyCommand);
    if (text) {
        s.commandAcknowledgements ??= {};
        s.commandAcknowledgements[p] = { id: c.id, text };
    }
    if (selectionId && s.manualSelections?.[p]?.id === selectionId)
        delete s.manualSelections[p];
    return result;
}
function applyCommand(s, p, c, checkpoint) {
    if (c.type === 'shoggoth-return-preference')
        return executeCommand(s, p, c);
    if (c.type === 'bot-resume') {
        need(s.bot && p !== s.bot.seat && s.bot.undoPaused, '当前没有因撤销暂停的BOT');
        need(!s.manualRequest, '请先完成手动操作申请');
        s.bot.undoPaused = false;
        log(s, '继续BOT对局。');
        return;
    }
    if (c.type === 'room-message') {
        need([0, 1].includes(p) && s.seats[p], '座位无效');
        need(typeof c.text === 'string' && c.text.trim().length > 0 && c.text.length <= 1000, '消息需为1至1000字');
        log(s, `${s.seats[p].name}：${c.text.trim()}`);
        Object.assign(s.logs.at(-1), { kind: 'message', player: p });
        return;
    }
    prunePriorityUndo(s);
    const approvedRequest = c.type === 'manual-confirm' && c.accept ? s.manualRequest : c.type === 'manual-request' && s.manualWithoutConsent ? { ...c, requester: p } : null, op = approvedRequest?.operation;
    let mutation = s.players.length && (!['ready', 'prediction-inspect', 'cancel-inspection', 'cancel-card-inspection', 'manual-request', 'manual-cancel', 'manual-confirm', 'manual-selection-start', 'manual-selection-cancel'].includes(c.type) || manualMutationOperations.includes(op));
    const offersBefore = s.triggerChoices.length;
    const before = mutation ? undoSnapshot(s) : null;
    if (checkpoint)
        checkpoint.before ??= before ?? undoSnapshot(s);
    const influences = (s.districts ?? []).map(d => d ? { id: d.id, influence: [...d.influence] } : null);
    return withHardBotCommand(s, c, () => {
        executeCommand(s, p, c);
        if (s.fieldEvents?.some(e => e.event === 'deck-shuffled')) {
            flushFieldEvents(s, cardEvent);
            if (s.status === 'playing' && !s.flow.locked && !s.effectChoice && !s.roundChoice && !s.hidden && !s.battle && !s.damageChoice && !s.ruleChoice)
                openWindow(s);
        }
        if (!s.deathContinuation)
            automationEngine.flushTriggerCosts(s);
        if (c.type === 'inspect-hidden' && s.triggerChoices.length === offersBefore)
            mutation = false;
        if (s.status === 'playing')
            keeperEngine.block(s);
        // Passing an empty stack only proposes ending the action step. If the
        // opponent responds with a card/ability, the owner may act again once the
        // stack clears. Merely cancelling auto-pass or tapping mana is not a response.
        const currentActionTurn = s.turn?.claim?.resume?.turn ?? s.turn;
        if (!['pass', 'auto-pass'].includes(c.type) && before?.turn?.actionClosed && before.turn.phase === 'action' && ['first-action', 'second-action'].includes(before.turn.step) && p !== before.flow.stepOwner && currentActionTurn?.step === before.turn.step && currentActionTurn.phase === 'action' && s.round === before.round && !before.flow.stack.length && s.flow.stack.some(a => !before.flow.stack.some(old => old.id === a.id)))
            currentActionTurn.actionClosed = false;
        // Consent requests and read-only inspections do not advance automatic passes.
        if (!s.manualRequest && !['manual-request', 'manual-cancel', 'manual-confirm', 'manual-selection-start', 'manual-selection-cancel', 'cancel-inspection', 'prediction-inspect', 'inspect-hidden', 'cancel-card-inspection'].includes(c.type))
            drainAutoPass(s);
        settleHardBotCommand(s);
        if (op !== 'undo')
            for (const old of influences) {
                const d = (s.districts ?? []).find(d => d?.id === old?.id);
                if (d)
                    for (let i = 0; i < 2; i++)
                        if (d.influence[i] < old.influence[i]) {
                            s.influenceRemovedRound ??= {};
                            s.influenceRemovedRound[i] = s.round;
                        }
            }
        if (before && ['pass', 'auto-pass'].includes(c.type) && gameplayUndoState(before) === gameplayUndoState(undoSnapshot(s)))
            mutation = false;
        if (mutation) {
            s.privateInspections = {};
            s.manualSelections = {};
        }
        if (before && mutation)
            saveUndo(s, before, op ? `${s.seats[approvedRequest.requester].name}${manualNames[op]}${manualQuantity(approvedRequest) ? `（${manualQuantity(approvedRequest)}）` : ''}` : ['pass', 'auto-pass'].includes(c.type) ? '能力结算或步骤推进' : commandLabels[c.type] ?? '上一次对局操作');
    }, p);
}
export function drainAutoPass(s) {
    for (let i = 0; i < 512; i++) {
        if (currentTriggerRound(s))
            return;
        if (s.manualRequest || s.status !== 'playing' || s.flow.locked || s.hidden || s.battle || s.ruleChoice || s.triggerOrderChoice || s.effectChoice || s.damageChoice || s.roundChoice || keeperEngine.pending(s) || s.triggerChoices.length)
            return;
        const p = s.flow.priority;
        if (!responseBlocked(s) && autoPassState(s, p).mode === 'none')
            return;
        executeCommand(s, p, { id: uuid(), type: 'pass', automatic: true });
    }
    throw new RuleError('自动让过次数异常，操作未保存');
}
function returnHiddenAside(s, a) {
    if (!a.extraHandAdded) {
        a.extraHandAdded = true;
        for (const p of [0, 1])
            for (let n = 0; n < (a.extraHandCounts?.[p] ?? 0) && s.players[p].deck.length; n++)
                move(s, s.players[p].deck[0], 'hand');
    }
    const eligible = eligibleAsideReturns(a, s.locations);
    for (const p of [0, 1]) {
        const ids = eligible.filter(c => c.owner === p).map(c => c.cardId);
        if (ids.length > 1) {
            s.effectChoice = { id: uuid(), kind: 'hidden-return-order', controller: p, cardIds: ids, returnAbility: a, choiceLabel: '排列展示牌置于牌库底的顺序' };
            s.flow.locked = true;
            return;
        }
        for (const id of ids)
            move(s, id, 'deck');
    }
    s.effectChoice = null;
    log(s, '规则性能力结算：补充手牌后，仍置于一旁的展示牌已按拥有者选择的顺序置于牌库底。');
}
function advanceHiddenTargets(s) {
    while (s.hidden?.targetEntries?.length) {
        const entryId = s.hidden.targetEntries.shift(), entry = s.flow.stack.find(a => a.id === entryId);
        if (!entry)
            continue;
        if (entry.plan.requiredSocietyName && s.societies?.[entry.controller]?.name !== entry.plan.requiredSocietyName) {
            s.flow.stack = s.flow.stack.filter(a => a !== entry);
            continue;
        }
        if (entry.plan.requiredYellowAssets !== undefined && s.players[entry.controller].assets.filter(a => (a.factionColors ?? [a.faction?.split('·')[0]]).includes('黄')).length < entry.plan.requiredYellowAssets) {
            s.flow.stack = s.flow.stack.filter(a => a !== entry);
            continue;
        }
        let opts = automationEngine.options(s, entry.controller, entry.plan);
        if (entry.plan.optionalHiddenCost || entry.plan.hiddenActivationCost !== undefined) {
            const pool = (s.players[entry.controller].costPool ?? 0) + s.players[entry.controller].assets.filter(a => !a.tapped).length;
            opts = opts.filter(o => (entry.plan.optionalHiddenCost ? s.cards[o.id]?.printedCost : entry.plan.hiddenActivationCost) <= pool).map(o => ({ ...o, name: o.name + ` · 支付${entry.plan.optionalHiddenCost ? s.cards[o.id].printedCost : entry.plan.hiddenActivationCost}` }));
        }
        if (!opts.length || entry.plan.target === 'disaster-and-district' && (!opts.some(o => o.slot === 'subject') || !opts.some(o => o.slot === 'district'))) {
            s.flow.stack = s.flow.stack.filter(a => a !== entry);
            continue;
        }
        s.effectChoice = { id: uuid(), kind: 'hidden-target', controller: entry.controller, cardIds: [], options: opts, canSkip: !!entry.plan.optionalHidden || !!entry.plan.optionalHiddenCost || entry.plan.hiddenActivationCost !== undefined, targetPair: entry.plan.target === 'disaster-and-district', entryId, choiceLabel: `${s.cards[entry.cardId]?.name ?? '卡牌'} · 隐秘能力目标（无快速响应窗口）` };
        s.flow.locked = true;
        return;
    }
    const comparison = hiddenComparison(s.hidden);
    s.hidden.comparison = comparison;
    if (comparison.kind === 'tie') {
        log(s, '隐秘对抗平局，无人获胜。');
        finishHidden(s);
    }
    else
        s.hidden.step = 7;
}
function finishHidden(s) {
    // Explicit confirmation: step 8 completes before fast actions/resolution resume.
    const contest = s.hidden, shown = contest.revealed, continuation = contest.continuation, winner = contest.comparison?.kind === 'winner' ? contest.comparison.player : null, group = `${contest.id}:ended`, offers = hiddenTriggersAfterContest(s, contest, winner);
    const oldIds = new Set((contest.stackedAbilities ?? []).filter(a => a.kind !== 'rule-return-aside').map(a => a.id));
    s.flow.stack = s.flow.stack.filter(a => !oldIds.has(a.id));
    s.hidden = null;
    s.finishingHidden = true;
    try {
        registerGroup(s, group);
        for (const a of offers) {
            a.group = group;
            if (a.kind === 'auto-ability')
                automationEngine.offerTrigger(s, a);
            else
                offerTrigger(s, a);
        }
        if (winner !== null && winner !== undefined)
            cardEvent(s, null, 'contest-won', { faceDown: false }, group, { contest: 'hidden', winner });
        cardEvent(s, null, 'hidden-ended', { faceDown: false }, group, { revealedRefs: shown.flatMap(row => (row.cards ?? [row]).map(c => ({ cardId: c.cardId, player: row.owner, zoneVersion: s.locations[c.cardId]?.zoneVersion }))) });
        if (winner !== null && winner !== undefined) {
            s.hiddenWins ??= {};
            s.hiddenWins[winner] = s.round;
        }
        if (continuation)
            automationEngine.completeHidden(s, continuation, winner, shown);
        environmentEngine.afterHidden(s);
    }
    finally {
        delete s.finishingHidden;
    }
    roundEngine.stateBased(s);
    log(s, '隐秘对抗结束。隐秘效果与本次对抗触发进入触发轮，展示牌回底规则能力在其下方。');
    if (s.status === 'playing' && !s.effectChoice && !s.hidden && !['claim-return', 'claim-lake'].includes(s.turn?.step))
        openWindow(s);
}
function startHidden(s, id, continuation = null) {
    need(!s.hidden, '隐秘对抗尚未结束');
    const r = beginHiddenContest(s.players, s.flow.priority, id);
    if (r.skipped) {
        log(s, '有玩家的手牌与牌库同时为空，不进行隐秘对抗。');
        return false;
    }
    const pending = (s.effects ?? []).filter(e => e.kind === 'next-hidden-bonus' && e.round === s.round), sumPending = (p, scope) => pending.filter(e => e.controller === p && (e.bonusScope ?? 'player') === scope).reduce((n, e) => n + e.amount, 0), pendingBonus = [0, 1].map(p => sumPending(p, 'player')), pendingCardBonus = [0, 1].map(p => sumPending(p, 'card'));
    s.effects = (s.effects ?? []).filter(e => e.kind !== 'next-hidden-bonus' || e.round !== s.round);
    s.players = r.players;
    s.hidden = { ...r.contest, pendingBonus, pendingCardBonus, continuation, multiSelections: [0, 1].map(p => researchMultiSelection(s, p)), firstSelectionPlayer: hiddenFirstSelectionPlayer(s) };
    s.flow.locked = true;
    s.flow.passed = [];
    for (const pl of s.players)
        for (const cardId of pl.hand)
            if (s.locations[cardId].zone === 'deck')
                setLocation(s, cardId, 'hand');
    log(s, '卡牌效果开启隐秘对抗：双方牌库顶牌置于手中，选择用于展示的手牌；第1至8步没有快速行动窗口。');
    return true;
}
function validateRoundTrigger(s, p, c, a) {
    if (a.kind === 'auto-ability')
        automationEngine.validateTrigger(s, p, c, structuredClone(a));
    else if (a.kind === 'abyss-ability')
        need(a.domains.includes(c.domain) && s.abyssUses?.[a.usageKeys[c.domain]] !== s.round, '该魔法领域本回合已发动');
    else if (a.kind === 'environment-ability')
        need((s.players[p].costPool ?? 0) + s.players[p].assets.filter(x => !x.tapped).length >= (a.cost ?? 0), '费用池及未横置资产不足');
}
function triggerUnavailable(s, a) {
    if (a.kind === 'auto-ability' && automationEngine.triggerUnavailable(s, a))
        return true;
    if (a.kind === 'abyss-ability' && a.domains.every(d => s.abyssUses?.[a.usageKeys[d]] === s.round))
        return true;
    if (a.plan?.oncePerRound && s.abilityUses?.[a.plan.usageKey]?.round === s.round && s.abilityUses[a.plan.usageKey].count >= a.plan.oncePerRound)
        return true;
    if (a.kind !== 'auto-ability' || ['none', 'hidden-up-to-two', 'characters-up-to-two'].includes(a.plan?.target) || a.plan?.optionalTarget)
        return false;
    if (a.plan?.target === 'gray-biology' && (false ?? 0) < 3)
        return false;
    const opts = automationEngine.options(s, a.controller, a.plan);
    if (['permanent-and-district', 'disaster-and-district', 'district-and-player'].includes(a.plan?.target))
        return !opts.some(o => o.slot === 'subject') || !opts.some(o => o.slot === 'district');
    if (['two-roles-or-attachments', 'sadikin-pair'].includes(a.plan?.target))
        return opts.length < 2;
    if (a.plan.fixedTarget)
        return !opts.some(o => o.id === a.plan.fixedTarget);
    return !opts.length;
}
export function viewFor(s, p, revision, code, { libraryScoreOnly = false } = {}) {
    migrateLegacyDeterChoice(s);
    const view = { code, revision, mode: s.mode, rulesVersion: s.rulesVersion, status: s.status, worldCardCount: s.worldCardCount ?? 29,
        bot: s.bot ? { id: s.bot.id, seat: s.bot.seat, difficulty: s.bot.difficulty ?? 'normal', name: s.seats[s.bot.seat].name, deckName: s.deckSelections?.[s.bot.seat]?.name, pending: !!s.bot.pending, undoPaused: !!s.bot.undoPaused, blocked: s.bot.blocked ?? null, ...(p === s.bot.seat ? { actionKeys: s.bot.actionKeys ?? [], libraryNames: botLibraryNames(s, p) } : {}) } : null,
        triggerTiming: s.triggerTiming ?? 'legacy', triggerRound: (() => { const r = triggerRoundView(s, p); return r ? { ...r, abilities: r.abilities.map(a => ({ ...a, unavailable: !libraryScoreOnly && !a.pending && triggerUnavailable(s, a) })) } : null; })(), deathCostChoice: deathCostView(s, p), triggerOrderChoice: triggerOrderView(s), ...keeperEngine.view(s, p), ...roundEngine.view(s, p), ...uniqueEngine.view(s), damageChoice: s.damageChoice ?? null, ...environmentEngine.view(s, p),
        canResumeTriggerWindow: canResumeTriggerWindow(s), characterCosts: !libraryScoreOnly && s.players[p] ? Object.fromEntries([...s.players[p].hand, ...graveCards(s, p), ...s.players[p].assets.map(a => a.id), ...Object.keys(s.locations).filter(id => s.locations[id].zone === 'sealed')].filter(id => castSourceStatus(s, p, id).allowed).map(id => [id, deathCharacterCostOptions(s, p, id, 'play')]).filter(([, v]) => v).map(([id, v]) => [id, { ...v, cards: v.cards.map(x => identity(s, x)) }])) : {}, revealExtraCosts: !libraryScoreOnly && s.players[p] ? Object.fromEntries(s.players[p].play.filter(id => s.locations[id].faceDown).map(id => [id, deathCharacterCostOptions(s, p, id, 'reveal')]).filter(([, v]) => v).map(([id, v]) => [id, { ...v, cards: v.cards.map(x => identity(s, x)) }])) : {},
        ...(!libraryScoreOnly ? { ...automationEngine.view(s, p), ...cardInspectionView(s, p), ...abyssEngine.view(s, p), ...zoneActionEngine.view(s, p), ...manualView(s, p, (...args) => automationEngine.options(...args)) } : {}), ...(s.deathContinuation ? { effectChoice: null, environmentChoice: null, triggerOrderChoice: null, roundChoice: null } : {}),
        result: s.result ?? null, createdAt: s.createdAt ?? null, endedAt: s.endedAt ?? null, canDelete: s.status === 'finished' && p === 0, logCount: s.logs.length, recordComplete: !s.logs.length || s.logs[0].id === 1,
        ...(s.status === 'finished' ? { finishedInformation: finishedInformation(s) } : {}),
        deckSelections: s.seats.map((_, i) => { const d = s.deckSelections?.[i]; return d ? { name: d.name, count: d.cards?.length ?? 0, society: d.society, catalogRevision: d.catalogRevision, deckRevision: d.deckRevision } : null; }), deckRequired: !!s.deckRequired,
        currentTargets: currentTargetingView(s, p), entryDestinations: stackEntryDestinations(s),
        seat: p, seats: s.seats.map(x => x ? { name: x.name, ready: x.ready } : null), round: s.round,
        flow: { ...s.flow, locked: s.flow.locked || responseBlocked(s) || !!currentTriggerRound(s), responseBlocked: responseBlocked(s), stack: s.flow.stack.map(a => {
                if (a.kind === 'trigger')
                    a = { ...a, displayName: triggerDisplayName(s, a) };
                a = { ...a, abilityDescription: abilityDescriptionView(s, a, p), responseEffect: stackResponseInformation(a, printedRulesCard(s, a.cardId ?? a.sourceId)) };
                if (s.locations[a.cardId]?.secretPlan && a.controller !== p)
                    return { id: a.id, kind: a.kind, cardId: a.cardId, controller: a.controller, displayName: '秘密计划', ...(a.kind === 'play-spell' ? { cardType: 'attachment' } : {}) };
                if (['environment-ability', 'abyss-ability'].includes(a.kind))
                    return { id: a.id, kind: a.kind, cardId: a.cardId, controller: a.controller, displayName: a.displayName, abilityDescription: a.abilityDescription, responseEffect: a.responseEffect };
                if (!['play-spell', 'auto-ability'].includes(a.kind))
                    return { ...a, canBeTerminated: [0, 1].includes(a.controller) && !!canTerminate(s, a) };
                const { targets, plan, ...publicAbility } = a;
                return { ...publicAbility, ...(a.controller === p ? { actionIndex: plan?.actionIndex, sourceZoneVersion: plan?.sourceZoneVersion, sourceDistrict: plan?.sourceDistrict } : {}), modeLabels: plan?.multiMode ? (plan.selectedModes ?? []).map(id => plan.modes.find(m => m.id === id)?.label ?? id) : undefined, canBeTerminated: [0, 1].includes(a.controller) && !!canTerminate(s, a), cardType: a.kind === 'play-spell' ? s.cards[a.cardId].type : undefined, targetCount: targets.length, targetIds: targets.map(t => t.cardId ? (s.locations[t.cardId]?.faceDown && controllerOf(s, t.cardId) !== p ? `hidden:${s.locations[t.cardId].hiddenHandle}` : t.cardId) : t.district !== undefined ? `district:${t.district}` : t.player !== undefined ? `player:${t.player}` : null).filter(Boolean), damageEffect: plan?.effect === 'damage' || plan?.operation === 'damage' };
            }) },
        pendingTriggers: s.pendingTriggers.map(a => ({ ...a, displayName: triggerDisplayName(s, a), abilityDescription: abilityDescriptionView(s, a, p) })),
        triggerChoices: (s.deathContinuation ? [] : s.triggerChoices).filter(a => a.controller === p && !['environment-ability', 'abyss-ability'].includes(a.kind)).map(a => ({ ...a, displayName: triggerDisplayName(s, a), abilityDescription: abilityDescriptionView(s, a, p), limitReached: !!(a.plan?.oncePerRound && s.abilityUses?.[a.plan.usageKey]?.round === s.round && s.abilityUses[a.plan.usageKey].count >= a.plan.oncePerRound) })), pendingChoiceCount: s.triggerChoices.length, battle: s.battle,
        hidden: s.hidden ? { cardBonus: s.hidden.cardBonus ? { ...s.hidden.cardBonus } : null, multiSelection: !!s.hidden.multiSelections?.[p], canSelect: s.hidden.firstSelectionPlayer === undefined || !!s.hidden.selections[s.hidden.firstSelectionPlayer] || s.hidden.firstSelectionPlayer === p, rewardKind: s.hidden.rewardKind, earlyRevealed: s.hidden.earlyRevealed ? { player: s.hidden.earlyRevealed.player, cards: s.hidden.earlyRevealed.cardIds.map(id => cardIdentityView(s, id)) } : null, step: s.hidden.step, committed: s.hidden.selections.map(Boolean), ownSelection: s.hidden.selections[p],
            revealed: s.hidden.revealed?.map(x => ({ ...x, printedCost: x.printedCost ?? s.cards[x.cardId].printedCost, modifier: x.modifier ?? x.value - s.cards[x.cardId].printedCost, card: s.cards[x.cardId], cards: (x.cards ?? [x]).map(c => ({ ...c, card: s.cards[c.cardId] })) })) ?? null, comparison: s.hidden.comparison } : null,
        players: s.players.map((a, i) => ({ deckCount: a.deck.length, barrierNow: playerHasBarrier(s, i), ignoreLoyalty: !!a.ignoreLoyalty, handCount: a.hand.length, honor: a.honor ?? 0, coreArea: coreArea(s, i) ? { ...cardIdentityView(s, coreArea(s, i).id), ...coreArea(s, i), cards: (a.core ?? []).map(id => ({ ...cardIdentityView(s, id), cost: castingCost(s, i, s.cards[id]), keywordStates: [{ keyword: '混乱', present: cardHasKeyword(s, id, '混乱') }], castAllowed: id === s.selectedCoreIds?.[i] && s.locations[id]?.corePlayer === i })), skipAdditionalCoreReturn: s.playerPreferences?.[i]?.skipAdditionalCoreReturn ?? true, selectedCoreId: s.selectedCoreIds?.[i] } : null, markers: a.markers, effectiveMarkers: effectiveSocietyMarkers(s, i), handLimit: playerHandLimit(s, i), costPool: a.costPool ?? 0, scoreCards: (a.scoreCards ?? []).map(c => ({ ...c, ...splitCardRules(c.text, c.faq) })), score: (a.scoreCards ?? []).reduce((n, c) => n + scoreValue(c), 0), victoryThreshold: victoryThreshold(s, i), actionsUsed: { asset: actionUsed(s, i, 'asset') >= actionAllowance(s, i, 'asset'), secret: actionUsed(s, i, 'secret') >= actionAllowance(s, i, 'secret') }, actionCounts: a.actionCounts, actionAllowance: { asset: actionAllowance(s, i, 'asset'), secret: actionAllowance(s, i, 'secret') } ?? { asset: false, secret: false }, secretDeploymentBlocked: secretDeploymentBlocked(s, i), secretDeploymentBaseCost: Math.max(0, 1 - secretDeploymentDiscount(s, i)), assets: a.assets.map(v => assetView(s, v)), loyalty: assetLoyalty(loyaltyAssets(s, i)), autoPass: autoPassState(s, i),
            hand: i === p ? a.hand.map(id => ({ ...cardIdentityView(s, id), ...(s.cards[id].spell ? { spell: effectiveCastPlan(s, p, s.cards[id]) } : printedRulesCard(s, id).attachment ? { attachment: effectiveCastPlan(s, p, s.cards[id]) } : {}), costsWaived: lotusFreeCast(s, p, s.cards[id]), castAllowed: castSourceStatus(s, p, id).allowed, nonAssetNow: cannotBuildAsset(s, p, printedRulesCard(s, id)), publicNow: cardHasKeyword(s, id, '公开'), concealedOnlyNow: cardHasKeyword(s, id, '隐匿') })) : [], graveyard: a.graveyard.map(id => cardIdentityView(s, id)), headquartersActive: !!a.headquartersActive, headquarters: (a.headquarters ?? []).map(id => cardIdentityView(s, id)),
            play: a.play.map(id => hiddenCardView(s, id, p)), aside: a.aside.map(id => cardIdentityView(s, id)) })),
        sealed: sealedView(s, p), logs: s.logs };
    return s.status === 'finished' ? finishedRoomView(view) : view;
}
// Rules modules use this relocation primitive through their context.
export { move as moveCard };
