import { hardDeckCards, hardDeckShuffled } from './hard-bot-library.mjs';
import { chooseOpeningFirstPlayer } from './opening-order.mjs';
import { continuousDecision } from './death-costs.mjs';
import { tapCostCards } from './tap-costs.mjs';
import { contactSources, beginContactReward } from './expert-contact.mjs';
import { regionWinner, lockRegionWinner } from './region-claims.mjs';
import { payActionFee, ownActionPayment } from './action-payment.mjs';
import { triggerDisplayName } from './trigger-display.mjs';
import { transferredStars } from './star-transfer.mjs';
import { battleDamageRecipient } from './field-completion-rules.mjs';
import { resetCard, resetAssets } from './reset.mjs';
import { settleClubInfluence, regionInfluence, placeRegionInfluence } from './club-influence.mjs';
import { cqTaskIcons } from './cq-rules.mjs';
import { sealedCount } from './sealed-counts.mjs';
import { shikigamiSupported } from './veiled-status-rules.mjs';
import { tiagoSources } from './regional-synergy-rules.mjs';
import { addWounds, woundsPrevented } from './wounds.mjs';
import { participatesInContest, participatesInDistrictContest } from './contest-participation.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { destructionImmune } from './destruction-rules.mjs';
import { districtIndexes, districtNumber, isTaskDistrict, adjacentDistricts, districtHostVersion } from './task-districts.mjs';
import { reputationParticipants, reputationTriggerCount } from "./standard-shared.mjs";
import { nonBattleBlocked } from './green-black-rules.mjs';
import { splitCardRules } from './card-text-format.mjs';
import { networkCount, researchEyesConverted } from './yellow-gray-rules.mjs';
import { graveCards } from './graveyard-rules.mjs';
import { applyDrawReplacements } from './draw-replacements.mjs';
import { uuid, randomValues } from './random.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { scoreValue, scoredCard, victoryThreshold, upgradeVictoryReductions, recordClaimVictoryReduction } from './scoring.mjs';
import { reportAssaultDeath } from './assault.mjs';
import { districtTraits } from './district-rules.mjs';
import { canTapCard, flushFieldEvents } from './field-events.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { discardMany } from './discard-events.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { hasCardType } from './card-types.mjs';
import { dealDamage, resolveDamageQueue } from './damage.mjs';
import { switchSociety } from './society-switch.mjs';
import { expireCardForms } from './card-forms.mjs';
import { districtTimeMarkers } from './time-markers.mjs';
import { mediatorActive } from './derived.mjs';
import { batchStaticIcons, lockedInfluenceSuppressed } from './batch-rules.mjs';
import { sealedOn, sealHost } from './sealing.mjs';
import { attachmentBonus, updateControl, attachmentHostLegal, skipsResetStep, cardHasKeyword, effectiveSubtypes, keywordAmount, auraApplies, whiteIconsConverted, convertPrintedIconsToBattle } from './derived.mjs';
import { controllerOf, identity } from './ownership.mjs';
import { priorityStepKey, beginPriorityStep, resetAutoPassForRound } from './priority.mjs';
import { hasKeyword } from './unique.mjs';
import { playerHandLimit, societyPlan } from './environment-definitions.mjs';
import { RuleError, newPriority, pushAbility } from './core.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const kinds = ['investigation', 'battle', 'influence'];
export const contestNames = { investigation: '调查对抗', battle: '战斗对抗', influence: '势力对抗' };
const stepNames = { reset: '重置步骤', mulligan: '起始手牌与再调度', prepare: '准备步骤', draw: '抓牌步骤', 'first-action': '先手行动步骤', 'second-action': '后手行动步骤', 'mobility-first': '先手机动快速行动窗口', 'mobility-second': '后手机动快速行动窗口', 'contest-before': '对抗前快速行动窗口', 'contest-resolve': '对抗奖励结算', 'contest-triggers': '对抗触发选择', 'contest-after': '对抗后快速行动窗口', 'claim-before': '地区赢取 · 回底前快速行动窗口', 'claim-eternal': '永恒卡牌移动或重新结附', 'claim-return': '地区卡牌返回牌库底', 'claim-lake': '亚伯拉罕湖持续能力', 'world-preview': '开局世界牌库检视', 'society-setup': '秘社开局秘密选择', 'claim-after': '地区赢取后快速行动窗口', end: '结束步骤', recovery: '恢复步骤' };
const phaseNames = { setup: '游戏准备', start: '开始阶段', action: '行动阶段', contest: '对抗阶段', end: '结束阶段' };
const nonnegative = (n, m) => need(Number.isSafeInteger(n) && n >= 0, m);
const uniqueIds = (ids, m) => need(Array.isArray(ids) && ids.every(id => typeof id === 'string') && new Set(ids).size === ids.length, m);
function fairyCount(s, id) { return s.players[controllerOf(s, id)].play.filter(x => s.locations[x]?.zone === 'play' && !s.locations[x].faceDown && hasCardType(s.cards[x], 'character') && effectiveSubtypes(s, x).includes('仙灵')).length; }
function staticBonus(s, id, includeWhite = false, blackOnly = false) {
    const c = printedRulesCard(s, id), l = s.locations[id], kind = c.automation?.static;
    if (l.faceDown || l.zone !== 'play')
        return {};
    const p = controllerOf(s, id), white = includeWhite || !blackOnly && p === s.turn.firstPlayer;
    if (kind === 'ancient-statue') {
        const ds = [];
        return { battle: ds.includes('鲜血') ? 1 : 0, investigation: ds.includes('心灵') ? 1 : 0, influence: ds.includes('星辰') ? 1 : 0, defense: ds.includes('神圣') ? 1 : 0 };
    }
    if (kind === 'exposure-gawain') {
        const n = s.players.reduce((sum, pl) => sum + pl.markers.exposed, 0);
        return { battle: 2 * n, defense: n };
    }
    if (kind === 'shikigami-eye')
        return white && shikigamiSupported(s, id) ? { investigation: 1 } : {};
    if (kind === 'secrecy-white-eyes')
        return white ? { investigation: effectiveSocietyMarkers(s, p).hidden } : {};
    if (kind === 'water-battle')
        return districtTraits(s, l.district).includes('水域') ? { battle: 1 } : {};
    if (kind === 'society-seven-white-eyes')
        return white && sealedCount(s, `society:${p}`) >= 7 ? { investigation: 3 } : {};
    if (kind === 'society-seven-eye-star')
        return sealedCount(s, `society:${p}`) >= 7 ? { investigation: 1, influence: 1 } : {};
    if (kind === 'marked-enemy-eye')
        return s.players[1 - p].play.some(x => { const q = s.locations[x]; return q?.zone === 'play' && q.district === l.district && (q.faceDown || hasCardType(s.cards[x], 'character')) && ((q.counters?.locked ?? 0) > 0 || (q.wounds ?? 0) > 0); }) ? { investigation: 1 } : {};
    if (kind === 'network-scaling')
        return { defense: networkCount(s, id) };
    if (kind === 'fairy-scaling') {
        const n = fairyCount(s, id);
        return { battle: n, influence: n };
    }
    if (kind === 'grave-seven-eye-battle')
        return graveCards(s, controllerOf(s, id), id).length >= 7 ? { investigation: 1, battle: 1 } : {};
    if (kind === 'grave-seven-investigation')
        return graveCards(s, controllerOf(s, id), id).length >= 7 ? { investigation: 1 } : {};
    if (kind === 'death-assets-white-influence' && (includeWhite || !blackOnly && controllerOf(s, id) === s.turn.firstPlayer) && s.players[controllerOf(s, id)].assets.some(a => a.magicDomains?.includes('死亡')))
        return { influence: 1 };
    if (kind === 'mind-assets-battle')
        return { battle: s.players[controllerOf(s, id)].assets.filter(a => a.magicDomains?.includes('心灵')).length };
    if (kind === 'district-investigation') {
        const d = s.districts[l.district];
        return d && (c.automation.districtTraitsAny.some(t => districtTraits(s, l.district).includes(t)) || c.automation.destroyedDistrict && d.destroyed) ? { investigation: 1 } : {};
    }
    if (kind === 'own-hidden-investigation')
        return { investigation: s.players[controllerOf(s, id)].play.filter(id => s.locations[id].faceDown).length };
    if (kind === 'sealed-battle')
        return { battle: sealedOn(s, id).length };
    if (kind === 'sealed-investigation')
        return { investigation: sealedOn(s, id).length };
    if (kind === 'sealed-printed-icons') {
        const out = {};
        for (const sealed of sealedOn(s, id))
            if (hasCardType(s.cards[sealed], 'character'))
                for (const k of kinds)
                    out[k] = (out[k] ?? 0) + (s.cards[sealed].icons?.[k] ?? 0) + ((includeWhite || !blackOnly && controllerOf(s, id) === s.turn.firstPlayer) ? (s.cards[sealed].temporaryIcons?.[k] ?? 0) : 0);
        return out;
    }
    if (kind === 'neutral-mediator' && mediatorActive(s, id) && (includeWhite || !blackOnly && controllerOf(s, id) === s.turn.firstPlayer))
        return { investigation: 1 };
    if (kind === 'exposed-investigation' && effectiveSocietyMarkers(s, controllerOf(s, id)).exposed > 0)
        return { investigation: 1 };
    if (kind === 'mind-assets-investigation' && s.players[controllerOf(s, id)].assets.filter(a => a.magicDomains?.includes('心灵')).length >= 2 && (includeWhite || !blackOnly && controllerOf(s, id) === s.turn.firstPlayer))
        return { investigation: 1 };
    if (kind === 'other-criminal' && s.players[controllerOf(s, id)].play.some(other => other !== id && !s.locations[other].faceDown && s.locations[other].district === l.district && hasCardType(s.cards[other], 'character') && s.cards[other].subtypes?.includes('罪犯')))
        return { influence: 1, defense: 1 };
    if (kind === 'district-white-icons' && (includeWhite || !blackOnly && controllerOf(s, id) === s.turn.firstPlayer)) {
        const d = s.districts[l.district];
        return { influence: d?.influence[controllerOf(s, id)] > 0 ? 1 : 0, investigation: d?.influence[1 - controllerOf(s, id)] > 0 ? 1 : 0 };
    }
    return {};
}
function calculateIcons(s, id, includeWhite = false, blackOnly = false) {
    const c = printedRulesCard(s, id), l = s.locations[id];
    includeWhite = includeWhite || whiteIconsConverted(s, id);
    if (l.faceDown)
        return { investigation: 0, battle: 0, influence: lockedInfluenceSuppressed(s, id) || s.players[1 - controllerOf(s, id)].play.some(source => s.locations[source].zone === 'play' && !s.locations[source].faceDown && s.locations[source].district === l.district && printedRulesCard(s, source).automation?.static === 'enemy-hidden-no-influence') ? 0 : 1 };
    const out = {};
    for (const k of kinds) {
        const white = includeWhite || k === 'investigation' && (researchEyesConverted(s, id) || tiagoSources(s, id).length > 0);
        let n = (k === 'investigation' && c.automation?.static === 'mentor-progress-eyes' && (white || !blackOnly && controllerOf(s, id) === s.turn?.firstPlayer) ? l.counters?.progress ?? 0 : 0) + (k === 'influence' && l.zone === 'play' && hasCardType(c, 'attachment') && c.subtitle === '圣甲虫产业' && l.attachedTo === `district-host:${s.districts[l.district]?.id}` && attachmentHostLegal(s, id) && societyPlan(s, controllerOf(s, id)).industrySealedIcons ? sealedOn(s, id).filter(x => hasCardType(s.cards[x], 'character')).length : 0) + printedIcons(s, id, k, white, blackOnly);
        for (const e of s.effects ?? [])
            if (e.kind === 'modify-icons' && e.targetId === id && e.icon === k && (e.targetZoneVersion === undefined || e.targetZoneVersion === l.zoneVersion) && (!e.white || white || !blackOnly && controllerOf(s, id) === s.turn?.firstPlayer))
                n += e.amount;
        const a = attachmentBonus(s, id);
        out[k] = Math.max(0, n + (cqTaskIcons(s, id, white, blackOnly)[k] ?? 0) + (staticBonus(s, id, white, blackOnly)[k] ?? 0) + (a[k] ?? 0) + ((white || !blackOnly && controllerOf(s, id) === s.turn?.firstPlayer) ? (a['white' + k[0].toUpperCase() + k.slice(1)] ?? 0) : 0) + auraIcons(s, id, k, white, blackOnly));
    }
    for (const k of kinds) {
        out[k] = Math.max(0, out[k] + (l.counters?.[k] ?? 0) + (batchStaticIcons(s, id, includeWhite || k === 'investigation' && (researchEyesConverted(s, id) || tiagoSources(s, id).length > 0), blackOnly)[k] ?? 0));
        if (k === 'influence' && lockedInfluenceSuppressed(s, id))
            out[k] = 0;
    }
    return out;
}
function printedIcons(s, id, k, includeWhite, blackOnly = false) {
    ;
    const original = printedRulesCard(s, id), masked = (s.effects ?? []).some(e => e.kind === 'printed-battle-only' && e.targetId === id && e.targetZoneVersion === s.locations[id]?.zoneVersion), c = masked ? { ...original, icons: { battle: original.icons?.battle ?? 0 }, temporaryIcons: { battle: original.temporaryIcons?.battle ?? 0 } } : original;
    includeWhite = includeWhite || k === 'investigation' && (researchEyesConverted(s, id) || tiagoSources(s, id).length > 0);
    if (convertPrintedIconsToBattle(s, id)) {
        if (k !== 'battle')
            return 0;
        return (c.icons?.battle ?? 0) + ((includeWhite || !blackOnly && controllerOf(s, id) === s.turn?.firstPlayer) ? (c.temporaryIcons?.battle ?? 0) : 0) + (c.icons?.investigation ?? 0) + (c.icons?.influence ?? 0) + (c.temporaryIcons?.investigation ?? 0) + (c.temporaryIcons?.influence ?? 0);
    }
    return (c.icons?.[k] ?? 0) + ((includeWhite || !blackOnly && controllerOf(s, id) === s.turn?.firstPlayer) ? (c.temporaryIcons?.[k] ?? 0) : 0);
}
export function effectiveIcons(s, id, includeWhite = false, blackOnly = false) {
    const out = calculateIcons(s, id, includeWhite, blackOnly), l = s.locations[id];
    if (l.zone === 'play' && !l.faceDown && (s.effects ?? []).some(e => e.kind === 'lose-all-icons' && e.targetId === id && e.targetZoneVersion === l.zoneVersion) || Object.entries(s.locations).some(([aid, a]) => false))
        return { investigation: 0, battle: 0, influence: 0 };
    if (l.zone === 'play' && !l.faceDown && (s.effects ?? []).some(e => e.kind === 'stars-to-battle' && e.targetId === id && e.targetZoneVersion === l.zoneVersion)) {
        out.battle += calculateIcons(s, id, true).influence;
        out.influence = 0;
    }
    if (s.players[controllerOf(s, id)].play.some(a => s.locations[a].zone === 'play' && !s.locations[a].faceDown && printedRulesCard(s, a).automation?.static === 'own-no-battle-icons'))
        out.battle = 0;
    if (l.zone === 'play' && !l.faceDown && printedRulesCard(s, id).automation?.static === 'hammett-icons' && s.turn?.phase === 'contest' && effectiveSocietyMarkers(s, controllerOf(s, id)).exposed === 0) {
        out.investigation += out.battle;
        out.influence += out.battle;
    }
    if (l.zone === 'play' && !l.faceDown && printedRulesCard(s, id).automation?.static === 'water-double-icons' && districtTraits(s, l.district).includes('水域'))
        for (const k of kinds)
            out[k] *= 2;
    if (!s.starTransferProjection && l.zone === 'play' && !l.faceDown) {
        const stars = transferredStars(s, id, effectiveIcons);
        if (stars) {
            const converted = (s.effects ?? []).some(e => e.kind === 'stars-to-battle' && e.targetId === id && e.targetZoneVersion === l.zoneVersion);
            if (converted)
                out.battle = Math.max(0, out.battle - stars.removed);
            else
                out.influence = stars.black + ((includeWhite || !blackOnly && controllerOf(s, id) === s.turn?.firstPlayer) ? stars.white : 0);
        }
    }
    return out;
}
// Show possessed white icons even when the controller is not first player.
// Use the same calculation as contests so grants, conversions and losses agree.
export function effectiveTemporaryIcons(s, id) {
    const all = effectiveIcons(s, id, true), black = effectiveIcons(s, id, false, true);
    return Object.fromEntries(kinds.map(k => [k, Math.max(0, all[k] - black[k])]));
}
function auraIcons(s, id, k, includeWhite = false, blackOnly = false) {
    const c = printedRulesCard(s, id), l = s.locations[id], p = controllerOf(s, id);
    if (l.zone !== 'play' || l.faceDown)
        return 0;
    let n = 0;
    for (const source of s.players[p].play) {
        const sc = printedRulesCard(s, source), sl = s.locations[source];
        if (sl.zone !== 'play' || sl.faceDown)
            continue;
        for (const a of sc.automation?.auras ?? [])
            if (auraApplies(s, source, id, a))
                n += (a.icons?.[k] ?? 0) + ((includeWhite || !blackOnly && p === s.turn.firstPlayer) ? (a.icons?.['white' + k[0].toUpperCase() + k.slice(1)] ?? 0) : 0);
        if (sc.automation?.static === 'cultist-icons' && hasCardType(c, 'character') && effectiveSubtypes(s, id).includes('邪教徒')) {
            if (k === 'influence' && s.districts[l.district]?.destroyed)
                n++;
            if (k === 'investigation' && effectiveSocietyMarkers(s, p).hidden >= 2)
                n++;
        }
        if (sc.automation?.static === 'industry-attachment-icons' && hasCardType(c, 'attachment') && c.subtitle === '圣甲虫产业' && l.attachedTo === `district-host:${s.districts[l.district]?.id}` && attachmentHostLegal(s, id) && ['investigation', 'influence'].includes(k))
            n++;
    }
    return n;
}
function auraDefense(s, id) {
    const c = printedRulesCard(s, id), l = s.locations[id], p = controllerOf(s, id);
    if (l.zone !== 'play' || l.faceDown || !hasCardType(c, 'character'))
        return 0;
    let n = 0;
    for (const source of s.players.flatMap(pl => pl.play)) {
        const sc = printedRulesCard(s, source), sl = s.locations[source];
        if (sl.zone !== 'play' || sl.faceDown)
            continue;
        for (const aura of sc.automation?.auras ?? [])
            if (auraApplies(s, source, id, aura))
                n += (aura.defense ?? 0) + (aura.defensePerTimeMarker ?? 0) * (s.locations[id].markers ?? 0) * (aura.relativeController ? (controllerOf(s, source) === p ? 1 : -1) : 1);
        const a = sc.automation?.aura;
        if (a && (!a.own || controllerOf(s, source) === p) && (!a.otherOnly || source !== id) && (!a.sameDistrict || sl.district === l.district))
            n += a.defense ?? 0;
        if (controllerOf(s, source) === p && sc.automation?.static === 'reputation-defense-barrier' && hasKeyword(s, id, '声望'))
            n++;
        ;
    }
    return n;
}
function dynamicDefense(s, id) {
    const c = printedRulesCard(s, id), l = s.locations[id];
    if (l?.zone === 'play' && !l.faceDown && c.automation?.static === 'fairy-scaling')
        return fairyCount(s, id);
    if (l?.zone === 'play' && !l.faceDown && c.automation?.static === 'sealed-count-defense')
        return sealedOn(s, id).length;
    if (l?.zone === 'play' && !l.faceDown && c.automation?.static === 'own-influence-defense')
        return s.districts[l.district]?.influence[controllerOf(s, id)] ?? 0;
    return c.defense ?? 0;
}
export function effectiveDefense(s, id) { return Math.max(0, ((s.effects ?? []).filter(e => e.kind === 'printed-defense' && e.targetId === id && e.targetZoneVersion === s.locations[id].zoneVersion).at(-1)?.value ?? dynamicDefense(s, id)) + (s.locations[id].counters?.defense ?? 0) + (batchStaticIcons(s, id, false).defense ?? 0) + auraDefense(s, id) + (attachmentBonus(s, id).defense ?? 0) + (staticBonus(s, id).defense ?? 0) - (s.locations[id].wounds ?? 0) + (s.effects ?? []).filter(e => e.kind === 'modify-defense' && e.targetId === id && (e.targetZoneVersion === undefined || e.targetZoneVersion === s.locations[id].zoneVersion)).reduce((n, e) => n + e.amount, 0)); }
export function contestTotals(s, district, kind) { return s.players.map(p => p.play.reduce((n, id) => { const l = s.locations[id]; return l.zone === 'play' && participatesInDistrictContest(s, id, district, kind) && !nonBattleBlocked(s, id, kind) && !(kind === 'influence' && Object.entries(s.locations).some(([aid, al]) => false)) ? n + effectiveIcons(s, id)[kind] : n; }, 0)); }
// The scheduler supplies the complete 1v1 round sequence. Card definitions are
// explicitly synthetic until a real card catalogue is supplied.
export function createRoundEngine(ctx) {
    const { move, setLocation, seal, log, openWindow, pay, hasPriority, trigger, releaseSeals, cleanupSeals, phaseEvent, ruleActions, stateTriggers } = ctx;
    const active = s => ['round-play', 'automation-play'].includes(s.mode);
    const choiceId = s => `r${s.round}:${s.turn.step}:${s.turn.district ?? 0}:${s.turn.kind ?? ''}:${uuid()}`;
    function clearCosts(s) {
        for (const p of s.players)
            p.costPool = 0;
    }
    function finishGame(s, winner, reason) { s.status = 'finished'; s.endedAt = Date.now(); s.result = { winner, reason, round: s.round, kind: 'completed' }; s.flow.locked = true; s.keeperQueue = []; delete s.keeperContinuation; s.roundChoice = null; s.effectChoice = null; s.ruleChoice = null; s.damageChoice = null; s.damageQueue = []; log(s, winner === null ? `对局结束：${reason}` : `${s.seats[winner].name}获胜：${reason}`); }
    function checkVictory(s) {
        if (!active(s) || s.status !== 'playing')
            return;
        const fragmentWinners = s.players.flatMap((pl, p) => pl.scoreCards.filter(c => c.subtypes?.includes('碎片')).length >= 3 && pl.play.some(id => false) ? [p] : []);
        if (fragmentWinners.length) {
            finishGame(s, fragmentWinners.length === 1 ? fragmentWinners[0] : null, '神与人：计分区具有三张碎片');
            return;
        }
        const doomWinners = s.players.flatMap((player, p) => societyPlan(s, p).destroyedVictory && player.scoreCards.reduce((n, c) => n + (c.destroyed ?? 0), 0) >= societyPlan(s, p).destroyedVictory ? [p] : []);
        if (doomWinners.length) {
            finishGame(s, doomWinners.length === 1 ? doomWinners[0] : null, '末日钟计分区达到三个毁灭标志');
            return;
        }
        const scores = s.players.map(p => p.scoreCards.reduce((n, c) => n + scoreValue(c), 0));
        upgradeVictoryReductions(s);
        const thresholds = s.players.map((_, p) => victoryThreshold(s, p));
        const winner = scores[0] >= thresholds[0] && scores[0] > scores[1] ? 0 : scores[1] >= thresholds[1] && scores[1] > scores[0] ? 1 : null;
        if (winner !== null)
            finishGame(s, winner, `计分区达到获胜所需${thresholds[winner]}分且领先对手`);
    }
    function draw(s, players, count = 1, { drawStep = false, drawCounts } = {}) {
        if (count > 0 && !drawStep && s.turn?.step !== 'draw' && s.players.flatMap(p => p.play).some(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && printedRulesCard(s, id).automation?.static === 'block-non-draw')) {
            log(s, '沉眠的海拉忒密沃森：非抓牌步骤不能抓牌，抓牌动作未执行。');
            return true;
        }
        const counts = Object.fromEntries(players.map(p => [p, s.players[p].cannotDraw ? 0 : drawCounts?.[p] ?? count]));
        for (const p of players)
            if (s.players[p].cannotDraw)
                log(s, `${s.seats[p].name}受愿景限制，不能抓牌。`);
        const drawn = Object.fromEntries(players.map(p => [p, []]));
        const drawKey = uuid(), first = s.flow.stepOwner ?? s.turn?.firstPlayer ?? 0;
        applyDrawReplacements(s, counts, drawKey, { drawStep, move, log });
        for (let i = 0; i < Math.max(...Object.values(counts)); i++) {
            const drawing = players.filter(p => i < counts[p]), empty = drawing.filter(p => !s.players[p].deck.length);
            if (empty.length) {
                finishGame(s, empty.length === 2 ? null : 1 - empty[0], empty.length === 2 ? '双方同时无法抓牌' : '对手抓牌时牌库为空');
                return false;
            }
            for (const p of drawing) {
                const id = hardDeckCards(s, p, 1, { side: societyPlan(s, p).drawFromBottom ? 'bottom' : 'top', kind: 'hand' })[0];
                move(s, id, 'hand');
                drawn[p].push(id);
            }
        }
        const group = uuid();
        for (const p of players) {
            const id = s.players[p].hand.at(-1);
            if (id && counts[p])
                phaseEvent?.(s, id, 'draw', s.locations[id], group, { count: counts[p], player: p, drawStep });
        }
        for (const p of [first, 1 - first].filter(p => players.includes(p)))
            ;
        return true;
    }
    function offer(s, a) {
        a.displayName ??= triggerDisplayName(s, a);
        if (a.mandatory)
            trigger(s, a);
        else
            s.triggerChoices.push(a);
    }
    function phaseTriggers(s, event) {
        const group = `round:${s.round}:${event}`;
        const roster = s.turn.phaseTriggerRoster ?? s.players.flatMap(p => p.play.map(id => ({ id, zoneVersion: s.locations[id].zoneVersion, faceDown: !!s.locations[id].faceDown })));
        delete s.turn.phaseTriggerRoster;
        for (const r of roster) {
            const id = r.id, l = s.locations[id];
            if (l?.zone !== 'play' || l.zoneVersion !== r.zoneVersion || !!l.faceDown !== r.faceDown)
                continue;
            const c = printedRulesCard(s, id), a = c[event];
            // Only explicitly defined hidden-state abilities may observe this event.
            phaseEvent?.(s, id, event === 'prepareTrigger' ? 'prepare' : 'end', l, group);
            if (!l.faceDown && a && !abilitiesSuppressed(s, id))
                offer(s, { id: `${group}:${id}`, kind: 'trigger', event, sourceId: id, controller: controllerOf(s, id), group, mandatory: !!a.mandatory, effect: { ...a.effect, targetId: a.effect.targetId ?? id } });
        }
    }
    function window(s, phase, step) {
        const previous = priorityStepKey(s), oldPhase = s.turn.phase;
        if (s.turn.phaseTriggerPending === 'endTrigger')
            s.turn.phaseTriggerRoster = s.players.flatMap(p => p.play.map(id => ({ id, zoneVersion: s.locations[id].zoneVersion, faceDown: !!s.locations[id].faceDown })));
        s.turn.phase = phase;
        s.turn.step = step;
        s.flow.stepOwner = s.turn.claim?.resume?.stepOwner ?? (step === 'second-action' ? 1 - s.turn.firstPlayer : s.turn.firstPlayer);
        s.roundChoice = null;
        beginPriorityStep(s, previous);
        if (oldPhase !== phase && ctx.environment?.().phaseStart(s))
            return;
        phaseReady(s);
    }
    function phaseReady(s) {
        const pending = s.turn.phaseTriggerPending;
        delete s.turn.phaseTriggerPending;
        if (pending === 'mobility') {
            beginMobility(s);
            return;
        }
        if (pending === 'prepareTrigger')
            ctx.environment?.().prepare(s);
        if (pending)
            phaseTriggers(s, pending);
        stateBased(s);
        openWindow(s);
    }
    function beginRound(s) {
        const waitingStack = s.turn.step === 'recovery' ? [...s.flow.stack] : [];
        delete s.turn.roundEndProcessed;
        delete s.turn.roundEndQueue;
        resetAutoPassForRound(s);
        clearCosts(s);
        s.deathsThisRound = [];
        s.turn.reputationDone = [];
        s.turn.extraInfluenceUsed = [];
        s.turn.privilegeUsed = false;
        s.turn.actionClosed = false;
        s.turn.claim = null;
        s.turn.lastContest = null;
        s.turn.phase = 'start';
        s.turn.step = 'reset';
        s.flow = { ...newPriority(s.turn.firstPlayer), stack: waitingStack, locked: true };
        resetAssets(s);
        for (const p of s.players) {
            p.actionsUsed = { asset: false, secret: false };
            p.actionCounts = { asset: 0, secret: 0 };
        }
        for (const p of [s.turn.firstPlayer, 1 - s.turn.firstPlayer])
            for (const id of s.players[p].play)
                if (!skipsResetStep(s, id))
                    resetCard(s, id, p);
        log(s, `第${s.round}回合开始。${s.seats[s.turn.firstPlayer].name}持有先手标志；重置场上卡牌。`);
        s.turn.phaseTriggerRoster = s.players.flatMap(p => p.play.map(id => ({ id, zoneVersion: s.locations[id].zoneVersion, faceDown: !!s.locations[id].faceDown })));
        s.turn.phase = 'start';
        s.turn.step = 'prepare';
        s.flow = { ...newPriority(s.turn.firstPlayer), stack: waitingStack };
        s.turn.phaseTriggerPending = 'prepareTrigger';
        if (!ctx.environment?.().phaseStart(s))
            phaseReady(s);
    }
    function initialize(s) {
        s.effects = [];
        s.result = null;
        s.roundChoice = null;
        s.mulliganSelections = [null, null];
        for (const p of s.players) {
            p.assets = [];
            p.costPool = 0;
            p.scoreCards = [];
            p.permanentVictoryReduction = 0;
            p.mulliganDone = false;
        }
        s.turn = { phase: 'setup', step: 'mulligan', firstPlayer: null, privilegeUsed: false, actionClosed: false, district: 0, kind: 'investigation', claim: null, lastContest: null };
        s.flow.locked = true;
        if (ctx.environment?.().initialize(s)) {
            log(s, '世界牌库由29张地区洗混，先完成地区翻开与秘社开局能力，再抓起始手牌。');
            return;
        }
        s.worldDeck = Array.from({ length: 10 }, (_, i) => ({ id: `world-${i}`, name: `测试地区·${i + 1}`, threshold: 3, points: 2, winTrigger: i % 3 === 0 ? { effect: { kind: 'draw', count: 1 }, mandatory: false } : null }));
        // Random world layout; no official card names, text or illustrations invented.
        for (let i = s.worldDeck.length - 1; i > 0; i--) {
            const j = randomValues(new Uint32Array(1))[0] % (i + 1);
            [s.worldDeck[i], s.worldDeck[j]] = [s.worldDeck[j], s.worldDeck[i]];
        }
        s.districts = [0, 1, 2].map(() => ({ ...s.worldDeck.shift(), pendingWinner: null, influence: [0, 0] }));
        for (const p of s.players) {
            p.assets = [];
            p.costPool = 0;
            p.scoreCards = [];
            p.permanentVictoryReduction = 0;
            p.mulliganDone = false;
        }
        s.turn = { phase: 'setup', step: 'mulligan', firstPlayer: null, privilegeUsed: false, actionClosed: false, district: 0, kind: 'investigation', claim: null, lastContest: null };
        s.flow.locked = true;
        log(s, s.mode === 'automation-play' ? `双方就绪：真实卡牌自动化测试，支持${s.automationCards.length}条角色、事务、附属与备牌指示物记录，使用测试地区；不是完整正式牌组。${s.deckSelections?.some(Boolean) ? s.seats.map((seat, p) => `${seat.name}使用${s.deckSelections[p]?.name ?? '自动化测试牌组'}，起始手牌${s.deckSelections[p]?.society.initialHand ?? 6}张`).join('；') + '。秘社对局能力尚未接入。' : '各6张手牌。'}无起始资产。` : '双方就绪：各6张文字测试牌，无起始资产。各自保留手牌或进行一次再调度，随后随机确定先手。');
    }
    function contestSkipped(s, district, kind) { const d = s.districts[district]; return kind === 'battle' && districtTraits(s, district).includes('黄昏') && [0, 1].some(p => societyPlan(s, p).skipTwilightBattleWhenMoreHand && s.players[p].hand.length > s.players[1 - p].hand.length) || s.effects.some(e => e.kind === 'skip-contests' && e.district === district && e.districtCardId === d?.id && (!e.contest || e.contest === kind)) || kind === 'investigation' && Object.entries(s.locations).some(([id, l]) => l.zone === 'sealed' && !l.faceDown && l.hostId === `district-host:${d?.id}` && l.hostVersion === districtHostVersion(d) && printedRulesCard(s, id).automation?.sealedSkipInvestigation) || kind === 'investigation' && s.players.flatMap(pl => pl.play).some(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && s.locations[id].district === district && (printedRulesCard(s, id).automation?.static === 'skip-source-investigation' || printedRulesCard(s, id).automation?.static === 'untapped-skip-investigation' && !s.locations[id].tapped)); }
    function beforeContest(s, district, kind) {
        clearCosts(s);
        s.turn.district = district;
        s.turn.kind = kind;
        s.turn.lastContest = null;
        if (kind === 'influence' && !s.turn.contestIteration)
            s.turn.influenceDistrictCardId = s.districts[district]?.id;
        if (!s.districts[district] || contestSkipped(s, district, kind)) {
            log(s, `地区${districtNumber(s, district)} · ${contestNames[kind]}因空位或卡牌效果略过。`);
            nextContest(s);
            return;
        }
        window(s, 'contest', 'contest-before');
        log(s, `地区${districtNumber(s, district)} · ${contestNames[kind]}：开始前快速行动窗口。`);
    }
    function beginMobility(s) {
        if (s.turn.phase !== 'contest') {
            s.turn.phase = 'contest';
            s.turn.phaseTriggerPending = 'mobility';
            if (ctx.environment?.().phaseStart(s))
                return;
            delete s.turn.phaseTriggerPending;
        }
        s.turn.mobilityQueue = [0, 1].map(p => s.players[p].play.filter(id => hasCardType(s.cards[id], 'character') && !s.locations[id].tapped && hasKeyword(s, id, '机动') && !abilitiesSuppressed(s, id)).map(id => { const l = s.locations[id]; return { id: uuid(), kind: 'auto-ability', cardId: id, controller: p, displayName: s.cards[id].name, event: 'mobility', group: `mobility:${s.round}:${p}`, mandatory: false, targets: [], plan: { target: 'other-district', effect: 'move-source', sourceId: id, sourceDistrict: l.district, sourceZoneVersion: l.zoneVersion, sourceSnapshot: { zone: 'play', zoneVersion: l.zoneVersion, faceDown: false, controller: p, district: l.district } } }; }));
        mobilityWindow(s, s.turn.firstPlayer);
    }
    function mobilityWindow(s, p) {
        const queue = s.turn.mobilityQueue?.[p] ?? [];
        if (!queue.length) {
            if (p === s.turn.firstPlayer) {
                mobilityWindow(s, 1 - p);
                return;
            }
            delete s.turn.mobilityQueue;
            beforeContest(s, 0, kinds[0]);
            return;
        }
        s.turn.district = null;
        s.turn.kind = null;
        s.turn.mobilityPlayer = p;
        s.triggerChoices.push(...queue);
        s.turn.mobilityQueue[p] = [];
        window(s, 'contest', p === s.turn.firstPlayer ? 'mobility-first' : 'mobility-second');
        log(s, `${s.seats[p].name}选择机动触发；先手机动完成后再处理后手。`);
    }
    function nextInfluenceSource(s) {
        const d = s.districts[s.turn.district], used = s.turn.extraInfluenceUsed ?? [];
        if (!d || s.turn.influenceDistrictCardId && s.turn.influenceDistrictCardId !== d.id)
            return null;
        const sources = d.plan?.extraInfluence ? [`district:${d.id}`] : [];
        for (const p of [s.turn.firstPlayer, 1 - s.turn.firstPlayer])
            for (const id of s.players[p].play) {
                const l = s.locations[id];
                if (l?.zone === 'play' && !l.faceDown && l.district === s.turn.district && printedRulesCard(s, id).automation?.static === 'extra-influence-contest' && !abilitiesSuppressed(s, id))
                    sources.push(`card:${id}:${d.id}`);
            }
        return sources.find(id => !used.includes(id)) ?? null;
    }
    function afterContest(s, windowClosed = false) {
        const d = s.districts[s.turn.district], claiming = lockRegionWinner(d) !== null;
        let reputationOffered = false;
        // Compare reputation after the final influence contest's quick window, so
        // revealing here preserves hidden influence and may then earn reputation.
        // If a region is already won, its claim window replaces the ordinary window.
        if (!claiming && windowClosed && s.turn.kind === 'influence' && !nextInfluenceSource(s) && !(s.turn.reputationDone ?? []).includes(s.turn.district)) {
            s.turn.reputationDone ??= [];
            s.turn.reputationDone.push(s.turn.district);
            const ids = reputationParticipants(s, s.turn.district), counts = ids.map(a => a.length), p = counts[0] === counts[1] ? null : counts[0] > counts[1] ? 0 : 1;
            if (p !== null) {
                reputationOffered = true;
                const group = uuid();
                for (let i = 0; i < reputationTriggerCount(s, p, s.turn.district); i++)
                    offer(s, { id: uuid(), kind: 'trigger', event: 'reputation', sourceId: ids[p][0], controller: p, group, effect: { kind: 'place-influence', district: s.turn.district, districtCardId: s.districts[s.turn.district].id, count: 1 } });
            }
        }
        if (claiming) {
            beginClaim(s, s.turn.district);
        }
        else if (windowClosed && !reputationOffered) {
            s.turn.claim = null;
            nextContest(s);
        }
        else
            window(s, 'contest', 'contest-after');
    }
    function beginClaim(s, district, resume = null, forcedWinner = null) {
        const d = s.districts[district];
        s.turn.district = district;
        s.turn.claim = { district: s.turn.district, districtNumber: districtNumber(s, s.turn.district), cardId: d.id, winner: lockRegionWinner(d) ?? lockRegionWinner(d, forcedWinner), orders: [null, null], ...(resume ? { resume } : {}) };
        const winner = s.turn.claim.winner, group = choiceId(s);
        const reduction = recordClaimVictoryReduction(s, winner, d);
        if (reduction) {
            s.turn.claim.victoryReductionRecorded = true;
            log(s, `${d.name}持续能力：${s.seats[winner].name}本局游戏获胜所需分数减少${reduction}。`);
        }
        // This rule ability is below win triggers and every quick response.
        s.flow.stack.push({ id: uuid(), kind: 'rule-return-region', controller: winner, district: s.turn.district, districtCardId: d.id, displayName: '地区角色与附属返回拥有者牌库底' });
        phaseEvent?.(s, null, 'region-won', { faceDown: false }, group, { winner, district: s.turn.district });
        ctx.environment?.().claimEvent(s, d, winner);
        window(s, resume?.turn.phase ?? 'contest', 'claim-before');
        log(s, '赢取' + d.name + '：地区回底规则性能力进入堆叠，开启回底前快速行动窗口。');
    }
    function completeReward(s) {
        s.roundChoice = null;
        const result = s.turn.lastContest;
        if (result && result.outcome !== 'none' && !result.finished) {
            result.finished = true;
            phaseEvent?.(s, null, 'contest-finished', { faceDown: false }, choiceId(s), { contest: result.kind, winner: result.winner, district: result.district });
        }
        if (s.effectBattle && !s.damageChoice) {
            const battle = s.effectBattle;
            delete s.effectBattle;
            clearCosts(s);
            const privilegeUsed = s.turn.privilegeUsed;
            s.turn = battle.turn;
            s.turn.privilegeUsed = privilegeUsed;
            s.flow.stepOwner = battle.stepOwner;
            s.flow.locked = false;
            ctx.resolveEffectBattle(s, { ...battle.ability, plan: { ...battle.ability.plan, operation: battle.ability.plan.afterContestOperation ?? 'infiltration-after-battle', contestResult: result ? structuredClone(result) : null, battleParticipants: battle.participants } });
            return;
        }
        if (s.keeperQueue?.length) {
            s.turn.step = 'contest-triggers';
            s.flow.locked = true;
            return;
        }
        if (s.damageChoice) {
            s.turn.step = 'contest-triggers';
            s.flow.locked = true;
            return;
        }
        if (s.ruleChoice) {
            s.turn.step = 'contest-triggers';
            s.flow.locked = true;
            return;
        }
        if (s.triggerChoices.length) {
            s.turn.step = 'contest-triggers';
            s.flow.locked = true;
            return;
        }
        afterContest(s);
    }
    function battleTriggers(s, participants) {
        const group = choiceId(s);
        for (const id of participants) {
            const c = printedRulesCard(s, id);
            if (c.battleTrigger && !abilitiesSuppressed(s, id))
                offer(s, { id: `${group}:${id}`, kind: 'trigger', event: 'battle', mandatory: false, sourceId: id, controller: controllerOf(s, id), group, effect: { kind: 'place-markers', targetId: id, marker: 'time', count: 1 } });
        }
    }
    function award(s, result) {
        const p = result.winner, kind = s.turn.kind, district = s.turn.district;
        if (s.effectBattle && result.outcome === 'none')
            s.effectBattle.participants = [];
        if (p === null) {
            if (kind === 'battle' && result.outcome === 'tie')
                battleTriggers(s, s.players.flatMap(pl => pl.play).filter(id => s.locations[id].district === district && !s.locations[id].faceDown));
            completeReward(s);
            return;
        }
        phaseEvent?.(s, null, 'contest-won', { faceDown: false }, choiceId(s), { contest: kind, winner: p, district });
        const keyword = kind === 'investigation' ? '智谋' : kind === 'battle' ? '威名' : null;
        const source = keyword ? s.players[p].play.find(id => hasCardType(s.cards[id], 'character') && s.locations[id].district === district && participatesInContest(s, id) && hasKeyword(s, id, keyword) && !abilitiesSuppressed(s, id) && !nonBattleBlocked(s, id, kind)) : null;
        if (source) {
            const group = choiceId(s);
            offer(s, { id: `${group}:${keyword}`, kind: 'trigger', event: 'keyword-influence', keyword, sourceId: source, controller: p, mandatory: false, group, effect: { kind: 'place-influence', district, districtCardId: s.districts[district].id, count: 1 } });
        }
        if (kind === 'investigation') {
            const echoes = s.players[p].play.filter(id => false).map(id => ({ id, zoneVersion: s.locations[id].zoneVersion }));
            beginContactReward(s, p, result.margin, contactSources(s, p), log, echoes);
        }
        else if (kind === 'battle') {
            const participants = s.players.flatMap(pl => pl.play).filter(id => s.locations[id].district === district && !s.locations[id].faceDown);
            const targets = s.players[1 - p].play.filter(id => s.locations[id].district === district && battleDamageRecipient(s, id));
            const taskForceAlternative = s.players[p].play.some(id => s.locations[id].district === district && participatesInContest(s, id) && !s.locations[id].faceDown && printedRulesCard(s, id).automation?.static === 'execution-task-force');
            const lethal = s.players[p].play.filter(id => s.locations[id].district === district && !s.locations[id].faceDown && participatesInContest(s, id) && hasCardType(s.cards[id], 'character')).reduce((n, id) => n + keywordAmount(s, id, '杀伤'), 0);
            const woundBudget = s.players[p].play.filter(id => s.locations[id].district === district && !s.locations[id].faceDown && participatesInContest(s, id) && hasCardType(s.cards[id], 'character') && !abilitiesSuppressed(s, id)).reduce((n, id) => n + keywordAmount(s, id, '创伤'), 0);
            s.roundChoice = { id: choiceId(s), kind: 'damage', controller: p, budget: result.margin + lethal, woundBudget: Math.min(result.margin + lethal, woundBudget), targetIds: targets, participants, taskForceAlternative };
            if (!targets.length && !taskForceAlternative) {
                log(s, '战斗胜出，但该地区没有可受伤害的敌方角色。');
                battleTriggers(s, participants);
                completeReward(s);
            }
        }
        else {
            // Physical cancellation locations are selected before the reward finishes.
            placeRegionInfluence(s, district, p, result.margin);
            log(s, `${s.seats[p].name}赢得势力对抗，结算${result.margin}个势力标志的奖励。`);
            completeReward(s);
        }
    }
    function resolveContest(s) {
        if (contestSkipped(s, s.turn.district, s.turn.kind)) {
            log(s, '对抗结算前再次检查略过效果，本次对抗略过。');
            if (s.effectBattle) {
                s.effectBattle.participants = [];
                completeReward(s);
            }
            else
                nextContest(s);
            return;
        }
        s.turn.step = 'contest-resolve';
        s.flow.locked = true;
        const totals = contestTotals(s, s.turn.district, s.turn.kind), max = Math.max(...totals);
        const result = { kind: s.turn.kind, district: s.turn.district, totals, winner: totals[0] === totals[1] ? null : totals[0] > totals[1] ? 0 : 1, margin: Math.abs(totals[0] - totals[1]), outcome: max === 0 ? 'none' : totals[0] === totals[1] ? 'tie' : 'winner' };
        const reversed = s.turn.kind === 'investigation' && (s.effects ?? []).some(e => e.kind === 'reverse-investigation' && e.district === s.turn.district && e.districtCardId === s.districts[s.turn.district]?.id);
        if (reversed && result.outcome === 'winner')
            result.winner = 1 - result.winner;
        if (reversed)
            result.reversedInvestigation = true;
        s.turn.lastContest = result;
        log(s, `地区${districtNumber(s, s.turn.district)} · ${contestNames[s.turn.kind]}：图标 ${totals.join(' : ')}${result.outcome === 'none' ? '，未发生对抗' : result.outcome === 'tie' ? '，平局' : '。'}`);
        if (reversed)
            log(s, '诡辩家：本次调查由图标较少的一方获胜，奖励仍按双方图标差值结算。');
        if (result.outcome === 'tie' && !s.turn.privilegeUsed) {
            s.roundChoice = { id: choiceId(s), kind: 'privilege', controller: s.turn.firstPlayer };
            return;
        }
        award(s, result);
    }
    function nextContest(s) {
        const i = kinds.indexOf(s.turn.kind);
        if (i === 2) {
            const used = (s.turn.extraInfluenceUsed ??= []);
            // One extra contest per source in this region each round. Re-entering the
            // same physical card cannot renew its allowance; a newly revealed region
            // does not inherit unfinished extra contests from the region just won.
            {
                const source = nextInfluenceSource(s);
                if (source) {
                    const previous = priorityStepKey(s);
                    used.push(source);
                    s.turn.contestIteration = (s.turn.contestIteration ?? 0) + 1;
                    beginPriorityStep(s, previous);
                    beforeContest(s, s.turn.district, 'influence');
                    return;
                }
            }
        }
        s.turn.contestIteration = 0;
        if (i < 2)
            beforeContest(s, s.turn.district, kinds[i + 1]);
        else if (districtIndexes(s).some(i => i > s.turn.district))
            beforeContest(s, districtIndexes(s).find(i => i > s.turn.district), kinds[0]);
        else {
            clearCosts(s);
            s.turn.phaseTriggerPending = 'endTrigger';
            window(s, 'end', 'end');
            log(s, '对抗阶段结束，进入结束步骤。');
        }
    }
    function recover(s) {
        const previous = priorityStepKey(s);
        s.turn.phase = 'end';
        s.turn.step = 'recovery';
        beginPriorityStep(s, previous);
        s.flow.locked = true;
        s.roundChoice = null;
        s.effects = s.effects.filter(e => e.duration !== 'until-end-of-round');
        expireCardForms(s, 'until-end-of-round');
        for (const r of [...(s.temporarySocietyReturns ?? [])].reverse())
            if (r.round === s.round && s.societies[r.player]?.catalogId === r.switchedCatalogId)
                switchSociety(s, r.player, r.face);
        s.temporarySocietyReturns = (s.temporarySocietyReturns ?? []).filter(r => r.round !== s.round);
        for (const p of s.players)
            for (const id of p.play)
                if (!s.locations[id].faceDown) {
                    s.locations[id].damage = 0;
                    delete s.locations[id].lethalChange;
                }
        // Expiring effects may make a previously surviving character lethal.
        stateBased(s);
        log(s, '恢复步骤：移除伤害，终止直到回合结束的效果；超出手牌上限的玩家选择弃牌。');
        finishRecovery(s);
    }
    function finishRecovery(s) {
        if (s.damageChoice || s.ruleChoice || s.keeperQueue?.length || s.triggerChoices.length || s.effectChoice || !s.turn.roundEndProcessed && s.players.some((p, i) => p.hand.length > playerHandLimit(s, i)))
            return;
        if (!s.turn.roundEndProcessed) {
            s.turn.roundEndProcessed = true;
            s.turn.roundEndQueue = s.effects.filter(e => ['round-end-conceal', 'delayed-conceal', 'guide-end', 'lamb-watch'].includes(e.kind));
            s.effects = s.effects.filter(e => !s.turn.roundEndQueue.includes(e));
        }
        while (s.turn.roundEndQueue?.length) {
            const e = s.turn.roundEndQueue.shift(), group = uuid();
            s.flow.locked = true;
            if (e.kind === 'lamb-watch')
                ctx.resolveRoundEnd(s, { id: group, kind: 'auto-ability', cardId: e.sourceId, controller: e.controller, displayName: '羔羊之血 · 回合结束', targets: [], plan: { target: 'none', effect: 'veil-late', operation: 'lamb-return', sourceId: e.sourceId, district: e.district, districtCardId: e.districtCardId, deaths: e.deaths } });
            else if (e.kind === 'guide-end')
                ctx.resolveRoundEnd(s, { id: group, kind: 'auto-ability', cardId: e.sourceId, controller: e.controller, displayName: '天火的指引 · 回合结束', targets: [], plan: { target: 'none', effect: 'holy', operation: 'guide-end', roleId: e.roleId, roleVersion: e.roleVersion } });
            else {
                const l = s.locations[e.targetId];
                if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === e.targetZoneVersion) {
                    ctx.conceal(s, e.targetId, group);
                    log(s, `${e.displayName}：回合结束，${s.cards[e.targetId].name}直接潜伏。`);
                }
            }
            stateBased(s);
            if (s.status !== 'playing' || s.damageChoice || s.ruleChoice || s.keeperQueue?.length || s.triggerChoices.length || s.effectChoice)
                return;
        }
        s.round++;
        s.turn.firstPlayer = 1 - s.turn.firstPlayer;
        beginRound(s);
    }
    function returnIds(s, p) { return s.players.flatMap(x => x.play).filter(id => s.cards[id].owner === p && s.locations[id].district === s.turn.claim.district && !isTaskDistrict(s.cards[id]) && !hasKeyword(s, id, '永恒')); }
    function beginReturn(s) {
        s.turn.step = 'claim-return';
        s.flow.locked = true;
        s.roundChoice = null;
        // Winning was established before this rule ability entered the stack.
        const claim = s.turn.claim, d = s.districts[claim.district];
        if (d?.id !== claim.cardId) {
            const resume = claim.resume;
            if (resume) {
                s.turn = resume.turn;
                s.flow.stepOwner = resume.stepOwner;
                s.flow.priority = resume.stepOwner;
                s.flow.passed = [];
                stateBased(s);
                openWindow(s);
            }
            else {
                s.turn.claim = null;
                window(s, 'contest', 'contest-after');
            }
            return;
        }
        for (let p = 0; p < 2; p++)
            if (!returnIds(s, p).length)
                claim.orders[p] = [];
        finishReturn(s);
    }
    function finishReturn(s, lakeDone = false) {
        const claim = s.turn.claim;
        if (claim.orders.some(v => v === null))
            return;
        const old = s.districts[claim.district];
        if (old.plan?.recycleSealsOnClaim && !lakeDone) {
            s.turn.step = 'claim-lake';
            s.flow.locked = true;
            return;
        }
        if (!claim.cardsReturned) {
            const destinations = new Map(claim.orders.flat().map(id => [id, hasKeyword(s, id, '撤回') ? 'hand' : 'deck']));
            s.regionReturnIds = [...claim.orders.flat(), ...s.players.flatMap(p => p.play).filter(id => s.locations[id].district === claim.district && hasKeyword(s, id, '永恒'))];
            try {
                for (const ids of claim.orders)
                    for (const id of ids)
                        move(s, id, destinations.get(id));
            }
            finally {
                delete s.regionReturnIds;
            }
            claim.cardsReturned = true;
        }
        for (const id of s.players.flatMap(p => p.play)) {
            const l = s.locations[id];
            if (l.district !== claim.district || !hasKeyword(s, id, '永恒'))
                continue;
            const p = controllerOf(s, id), card = printedRulesCard(s, id), regional = hasCardType(card, 'character') || l.attachedTo === `district-host:${old.id}`;
            const options = regional ? adjacentDistricts(s, claim.district).map(d => ({ id: `district:${d}`, name: `地区${districtNumber(s, d)} · ${s.districts[d].name}` })) : !attachmentHostLegal(s, id) ? ctx.eternalAttachmentOptions(s, p, id) : [];
            if (options.length) {
                s.roundChoice = { id: uuid(), kind: 'eternal-region', controller: p, cardId: id, cardVersion: l.zoneVersion, regional, options };
                s.turn.step = 'claim-eternal';
                s.flow.locked = true;
                return;
            }
            if (hasCardType(card, 'attachment') && !attachmentHostLegal(s, id))
                move(s, id, 'graveyard');
        }
        releaseSeals?.(s, `district-host:${old.id}`);
        const task = isTaskDistrict(old);
        if (task)
            move(s, old.id, 'score', { controller: claim.winner });
        else if (s.locations[old.id])
            s.locations[old.id] = { zone: 'score', zoneVersion: s.locations[old.id].zoneVersion + 1, controller: claim.winner };
        s.players[claim.winner].scoreCards.push(scoredCard(s, claim.winner, { ...old, influence: undefined, ...(claim.victoryReductionRecorded ? { victoryReductionRecorded: true } : {}), ...(task ? { awardedPoints: Math.max(0, (old.points ?? 0) - (old.destroyed ?? 0)) } : {}) }));
        const noReplacement = task || old.noReplacement;
        const replacement = noReplacement ? null : s.environmentCatalog ? null : s.worldDeck.shift();
        // With ten 2-point fixture regions an 8-point winner exists before depletion.
        if (noReplacement)
            s.districts[claim.district] = null;
        else if (s.environmentCatalog)
            ctx.environment().reveal(s, claim.district);
        else
            s.districts[claim.district] = replacement ? { ...replacement, pendingWinner: null, influence: [0, 0] } : null;
        log(s, `${s.seats[claim.winner].name}赢取${old.name}，获得${scoreValue(s.players[claim.winner].scoreCards.at(-1))}分；具有撤回的牌回拥有者手中，其余牌按拥有者指定顺序回牌库底。`);
        checkVictory(s);
        if (s.status !== 'playing')
            return;
        const group = choiceId(s);
        phaseEvent?.(s, old.id, 'region-claimed', { ...s.locations[old.id], controller: claim.winner }, group, { winner: claim.winner, district: claim.district, claimedDistrict: old });
        ctx.environment?.().win(s, old, claim.winner, claim.district);
        if (old.winTrigger)
            offer(s, { id: group + ':win', kind: 'trigger', event: 'region-win', controller: claim.winner, mandatory: !!old.winTrigger.mandatory, sourceId: old.id, group, effect: old.winTrigger.effect });
        window(s, claim.resume?.turn.phase ?? 'contest', 'claim-after');
    }
    function stateBased(s) {
        // A cast at a death boundary cannot recursively process the still-dying host.
        // State actions resume when the enclosing departure and its operation finish.
        if (s.resolutionCasting?.deathBoundary)
            return;
        settleClubInfluence(s);
        if (!active(s) || s.status !== 'playing' || s.keeperQueue?.length || s.roundChoice?.kind === 'eternal-region')
            return;
        if (!resolveDamageQueue(s))
            return;
        flushFieldEvents(s, phaseEvent);
        stateTriggers?.(s);
        // Entry choices activate from the battlefield before rule actions.
        if (s.triggerChoices.some(a => a.event === 'entry'))
            return;
        cleanupSeals?.(s);
        for (;;) {
            if (s.keeperQueue?.length)
                return;
            updateControl(s);
            stateTriggers?.(s);
            for (const id of [...s.players.flatMap(p => p.play)]) {
                const l = s.locations[id], required = printedRulesCard(s, id).automation?.requiredSocietyName;
                if (l.zone === 'play' && !l.faceDown && required && (s.societies?.[controllerOf(s, id)]?.name ?? s.deckSelections?.[controllerOf(s, id)]?.society?.name) !== required) {
                    log(s, `${s.cards[id].name}的持续能力立即要求牺牲。`);
                    move(s, id, 'graveyard', { cause: 'sacrifice' });
                }
            }
            for (const [id, l] of Object.entries(s.locations))
                if (l.zone === 'play' && l.attachedTo) {
                    if (!attachmentHostLegal(s, id))
                        move(s, id, 'graveyard');
                }
            if (s.keeperQueue?.length)
                return;
            updateControl(s);
            stateTriggers?.(s);
            for (const id of s.players.flatMap(p => p.play))
                if ((s.locations[id].damage ?? 0) < effectiveDefense(s, id))
                    delete s.locations[id].lethalChange;
            const dead = s.players.flatMap(p => p.play).filter(id => battleDamageRecipient(s, id) && !cardHasKeyword(s, id, '永恒') && !destructionImmune(s, id) && (s.locations[id].damage ?? 0) >= effectiveDefense(s, id));
            if (!dead.length)
                break;
            beginEventGroup(s, uuid());
            for (const id of dead) {
                log(s, `${s.cards[id].name}受到致命伤害或防御力降至0，将被消灭。`);
                const reward = reportAssaultDeath(s, id, phaseEvent), version = s.locations[id].zoneVersion;
                move(s, id, 'graveyard', { cause: 'destroy', ruleDeath: true });
                if (reward && s.locations[id].zoneVersion !== version)
                    draw(s, [reward.player], 1);
            }
            endEventGroup(s);
            if (s.keeperQueue?.length)
                return;
        }
        delete s.assaultLethals;
        ruleActions?.(s);
        checkVictory(s);
        if (s.status === 'playing' && !s.effectBattle && !s.turn.claim && !s.effectChoice && !s.hidden && !s.ruleChoice && !s.roundChoice) {
            while (s.forcedRegionWins?.length) {
                const next = s.forcedRegionWins.shift();
                if (s.districts[next.district]?.id !== next.cardId)
                    continue;
                beginClaim(s, next.district, { turn: structuredClone(s.turn), stepOwner: s.flow.stepOwner, priorityStepKey: priorityStepKey(s) }, next.player);
                break;
            }
        }
        if (s.status === 'playing' && !s.effectBattle && s.turn.phase === 'action' && !s.turn.claim && !s.effectChoice && !s.hidden && !s.ruleChoice && !s.roundChoice) {
            const district = s.districts.findIndex(d => lockRegionWinner(d) !== null);
            if (district >= 0)
                beginClaim(s, district, { turn: structuredClone(s.turn), stepOwner: s.flow.stepOwner, priorityStepKey: priorityStepKey(s) });
        }
    }
    function advance(s) {
        need(active(s) && !s.roundChoice && !s.triggerChoices.length, '请先完成当前选择');
        const step = s.turn.step;
        if (step === 'prepare') {
            clearCosts(s);
            const drawCounts = [0, 1].map(p => 1 + (0)), bonuses = (s.nextDrawBonuses ?? []).filter(b => b.round <= s.round);
            s.nextDrawBonuses = (s.nextDrawBonuses ?? []).filter(b => !bonuses.includes(b));
            for (const b of bonuses)
                drawCounts[b.player] += b.count;
            if (draw(s, [0, 1], 1, { drawStep: true, drawCounts })) {
                log(s, `抓牌步骤：双方分别抓${drawCounts[0]}、${drawCounts[1]}张牌。`);
                window(s, 'start', 'draw');
            }
        }
        else if (step === 'draw') {
            clearCosts(s);
            s.turn.actionClosed = false;
            window(s, 'action', 'first-action');
        }
        else if (step === 'first-action') {
            clearCosts(s);
            s.turn.actionClosed = false;
            window(s, 'action', 'second-action');
        }
        else if (step === 'second-action')
            beginMobility(s);
        else if (step === 'mobility-first')
            mobilityWindow(s, 1 - s.turn.firstPlayer);
        else if (step === 'mobility-second') {
            delete s.turn.mobilityQueue;
            beforeContest(s, 0, kinds[0]);
        }
        else if (step === 'contest-before')
            resolveContest(s);
        else if (step === 'contest-after')
            afterContest(s, true);
        else if (step === 'claim-after') {
            const resume = s.turn.claim?.resume;
            if (resume) {
                s.turn = resume.turn;
                s.flow.stepOwner = resume.stepOwner;
                s.flow.priority = resume.stepOwner;
                s.flow.passed = [];
                log(s, '地区赢取流程结束，返回原行动步骤。');
                stateBased(s);
                openWindow(s);
            }
            else {
                s.turn.claim = null;
                nextContest(s);
            }
        }
        else if (step === 'claim-before')
            beginReturn(s);
        else if (step === 'end')
            recover(s);
        else
            throw new RuleError('当前步骤不能通过让过推进');
    }
    function choice(s, p, kind) { need(s.roundChoice?.kind === kind && s.roundChoice.controller === p, '当前没有属于你的该项选择'); return s.roundChoice; }
    function command(s, p, c) {
        if (!active(s))
            return false;
        if (c.type === 'concede') {
            finishGame(s, 1 - p, '对手认输');
            return true;
        }
        if (c.type === 'mulligan') {
            need(s.turn.step === 'mulligan' && !s.players[p].mulliganDone, '再调度只能在游戏准备时进行一次');
            uniqueIds(c.cardIds, '再调度牌选择无效');
            const pl = s.players[p];
            need(c.cardIds.every(id => pl.hand.includes(id)), '只能再调度自己的手牌');
            // Commit privately. Do not change hands, deck counts or public logs until
            // both players have locked their choices, including keeping zero cards.
            s.mulliganSelections ??= [null, null];
            s.mulliganSelections[p] = [...c.cardIds];
            pl.mulliganDone = true;
            log(s, `${s.seats[p].name}已锁定起始手牌选择。`);
            if (s.players.every(x => x.mulliganDone)) {
                const selections = s.mulliganSelections;
                delete s.mulliganSelections;
                // Set both selections aside before drawing, so replacements cannot be
                // the selected cards. Null supports rooms with an older completed seat.
                for (const ids of selections)
                    for (const id of ids ?? [])
                        move(s, id, 'aside');
                for (const who of [0, 1])
                    if (selections[who] && !draw(s, [who], selections[who].length))
                        return true;
                for (const who of [0, 1])
                    if (selections[who]) {
                        const ids = selections[who], player = s.players[who];
                        for (const id of ids)
                            move(s, id, 'deck');
                        if (ids.length)
                            for (let i = player.deck.length - 1; i > 0; i--) {
                                const j = randomValues(new Uint32Array(1))[0] % (i + 1);
                                [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
                            }
                        if (ids.length)
                            hardDeckShuffled(s, who);
                        log(s, `${s.seats[who].name}${ids.length ? `完成再调度（${ids.length}张）` : '保留起始手牌'}。`);
                    }
                s.turn.firstPlayer ??= chooseOpeningFirstPlayer(s);
                beginRound(s);
            }
            return true;
        }
        if (c.type === 'privilege') {
            choice(s, p, 'privilege');
            need(typeof c.use === 'boolean', '请明确选择是否使用先手特权');
            if (c.use) {
                need(!s.turn.privilegeUsed && p === s.turn.firstPlayer, '本回合先手特权已经使用');
                pay(s, p, 1);
                s.turn.privilegeUsed = true;
                Object.assign(s.turn.lastContest, { winner: p, margin: 1, outcome: 'privilege' });
                log(s, '先手玩家支付1点费用，将非零图标平局改为以1个图标胜出；此特权不进入堆叠。');
            }
            s.roundChoice = null;
            award(s, s.turn.lastContest);
            return true;
        }
        ;
        if (c.type === 'investigate') {
            const a = choice(s, p, 'investigation');
            uniqueIds(c.top, '牌库顶顺序无效');
            uniqueIds(c.bottom, '牌库底顺序无效');
            const all = [...c.top, ...c.bottom];
            need(all.length === a.cardIds.length && new Set(all).size === all.length && all.every(id => a.cardIds.includes(id)), '必须将所有检视牌各安排一次');
            const pl = s.players[p];
            need(a.cardIds.every((id, i) => pl.deck[i] === id), '牌库已改变，请重新同步');
            pl.deck = [...c.top, ...pl.deck.slice(a.cardIds.length), ...c.bottom];
            a.libraryOrderCommitted = true;
            log(s, `${s.seats[p].name}完成调查奖励的牌库顺序选择。`);
            const echoes = (a.echoes ?? []).filter(ref => s.locations[ref.id]?.zone === 'play' && s.locations[ref.id].zoneVersion === ref.zoneVersion && !s.locations[ref.id].faceDown);
            if (echoes.length) {
                const sourceId = echoes.length === 1 ? echoes[0].id : continuousDecision(s, `echo-reward:${a.id}`, { kind: 'echo-investigation', controller: p, sourceName: '山之宁芙厄科', sources: echoes.map(ref => ({ id: ref.id, name: s.cards[ref.id].name })) });
                const top = hardDeckCards(s, p, 1, { kind: 'seal' })[0];
                if (top)
                    seal(s, top, sealHost(s, sourceId));
                log(s, '山之宁芙厄科：调查奖励改为封印牌库顶牌。');
                completeReward(s);
            }
            else if (draw(s, [p]))
                completeReward(s);
            return true;
        }
        if (c.type === 'replace-battle-damage') {
            const a = choice(s, p, 'damage');
            need(a.taskForceAlternative, '当前没有执行部特遣组的战斗伤害替代');
            const ids = s.players.flatMap(pl => pl.play).filter(id => s.locations[id]?.zone === 'play' && s.locations[id].faceDown && s.locations[id].district === s.turn.district);
            const id = ids.find(id => `hidden:${s.locations[id].hiddenHandle}` === c.cardId);
            need(ids.length ? !!id : c.cardId === null, '请选择本地区一个暗藏者；没有合法暗藏者时可直接放弃伤害');
            if (id)
                move(s, id, 'graveyard', { cause: 'destroy', effectController: p });
            log(s, '执行部特遣组：放弃本次全部战斗伤害' + (id ? '，消灭所选暗藏者。' : '。'));
            battleTriggers(s, a.participants);
            stateBased(s);
            completeReward(s);
            return true;
        }
        if (c.type === 'assign-damage') {
            const a = choice(s, p, 'damage');
            need(Array.isArray(c.allocations), '伤害分配无效');
            uniqueIds(c.allocations.map(x => x.cardId), '不能重复分配同一个目标');
            const targetIds = a.targetIds.filter(id => battleDamageRecipient(s, id) && s.locations[id].district === s.turn.district && controllerOf(s, id) !== p);
            let sum = 0, wounds = 0;
            for (const x of c.allocations) {
                nonnegative(x.amount, '伤害点数必须是非负整数');
                nonnegative(x.wounds ?? 0, '创伤点数必须是非负整数');
                need(targetIds.includes(x.cardId), '只能伤害该地区当前合法的敌方角色');
                sum += x.amount + (x.wounds ?? 0);
                wounds += x.wounds ?? 0;
            }
            need(wounds <= (a.woundBudget ?? 0), '转换为创伤的数量超过参与角色提供的创伤额度');
            need(sum <= a.budget, '分配的伤害超过战斗奖励');
            need(sum === (targetIds.length ? a.budget : 0), '有合法受伤角色时，必须分配全部战斗伤害，可以超出角色防御力');
            const guards = targetIds.filter(id => keywordAmount(s, id, '护卫') > 0);
            if (c.allocations.some(x => x.amount + (x.wounds ?? 0) > 0 && !guards.includes(x.cardId)))
                for (const id of guards)
                    need(c.allocations.filter(x => x.cardId === id).reduce((n, x) => n + x.amount + (x.wounds ?? 0), 0) >= keywordAmount(s, id, '护卫'), '必须先向所有护卫分配规定伤害，才能分配给其他角色');
            beginEventGroup(s, a.id);
            try {
                for (const x of c.allocations) {
                    addWounds(s, x.cardId, x.wounds ?? 0, { event: phaseEvent, group: a.id, damageKind: 'battle' });
                    dealDamage(s, x.cardId, x.amount, 'battle');
                }
            }
            finally {
                endEventGroup(s);
            }
            log(s, `${s.seats[p].name}分配${sum}点战斗伤害，其中${wounds}点改为创伤。`);
            battleTriggers(s, a.participants);
            stateBased(s);
            completeReward(s);
            return true;
        }
        if (c.type === 'discard-excess') {
            need(s.turn.step === 'recovery', '只能在恢复步骤选择手牌上限弃牌');
            uniqueIds(c.cardIds, '弃牌选择无效');
            const pl = s.players[p], n = Math.max(0, pl.hand.length - playerHandLimit(s, p));
            need(n > 0 && c.cardIds.length === n && c.cardIds.every(id => pl.hand.includes(id)), '请选择恰好超出上限数量的自己的手牌');
            discardMany(s, c.cardIds, move, phaseEvent, { cause: 'hand-limit' });
            log(s, `${s.seats[p].name}因手牌上限弃掉${n}张牌；此弃牌不发动传闻。`);
            finishRecovery(s);
            return true;
        }
        if (c.type === 'eternal-region-move') {
            const a = choice(s, p, 'eternal-region'), id = a.cardId, l = s.locations[id];
            need(a.id === c.choiceId && l?.zone === 'play' && l.zoneVersion === a.cardVersion && a.options.some(o => o.id === c.targetId), '请选择合法的永恒牌去向');
            const t = ctx.eternalAttachmentTarget(s, p, id, c.targetId, a.regional), old = l.district;
            if (t.kind === 'district') {
                l.district = t.district;
                if (hasCardType(s.cards[id], 'attachment')) {
                    l.attachedTo = `district-host:${t.cardId}`;
                    l.hostVersion = t.cardId;
                }
            }
            else if (t.kind === 'host') {
                l.attachedTo = t.ref.hostId;
                l.hostVersion = t.ref.version;
                delete l.district;
            }
            else {
                l.attachedTo = t.cardId;
                l.hostVersion = t.zoneVersion;
                l.district = s.locations[t.cardId].district;
            }
            for (const [aid, al] of Object.entries(s.locations))
                if (al.zone === 'play' && al.attachedTo === id && al.hostVersion === l.zoneVersion)
                    al.district = l.district;
            s.roundChoice = null;
            s.turn.step = 'claim-return';
            log(s, `${s.cards[id].name}的永恒持续能力按规则移动或重新结附。`);
            finishReturn(s);
            return true;
        }
        if (c.type === 'return-district') {
            if (Array.isArray(c.cardIds))
                c = { ...c, cardIds: c.cardIds.map(id => typeof id === 'string' && id.startsWith('hidden:') ? Object.keys(s.locations).find(x => s.locations[x].hiddenHandle === id.slice(7)) : id) };
            need(s.turn.step === 'claim-return' && s.turn.claim.orders[p] === null, '当前没有属于你的地区回底顺序选择');
            uniqueIds(c.cardIds, '回底顺序无效');
            const ids = returnIds(s, p);
            need(ids.length === c.cardIds.length && c.cardIds.every(id => ids.includes(id)), '必须为本方该地区的所有牌指定回底顺序');
            s.turn.claim.orders[p] = [...c.cardIds];
            finishReturn(s);
            return true;
        }
        if (c.type === 'tap-asset') {
            hasPriority(s, p);
            need(!s.triggerChoices.length, '请先完成触发选择');
            const a = s.players[p].assets.find(a => a.id === c.assetId);
            need(a && !a.tapped, '该资产不可横置');
            a.tapped = true;
            s.players[p].costPool++;
            s.flow.passed = [];
            return true;
        }
        if (c.type === 'activate') {
            hasPriority(s, p);
            need(!s.triggerChoices.length, '请先完成触发选择');
            const card = printedRulesCard(s, c.cardId), loc = s.locations[c.cardId];
            need(!abilitiesSuppressed(s, c.cardId), '本地区禁音使阻止角色发动能力');
            need(card && controllerOf(s, c.cardId) === p && loc?.zone === 'play' && !loc.faceDown && card.action, '只能发动本方场上正面卡牌的行动能力');
            const a = card.action;
            if (a.timing !== 'fast')
                need(s.turn.phase === 'action' && s.flow.stepOwner === p && !s.turn.actionClosed && !s.flow.stack.length, '标准行动能力只能在自己的未结束行动步骤、空堆叠时发动');
            need(!a.tap || canTapCard(s, card.id), '该卡牌不能支付横置费用');
            s.flow = pushAbility(s.flow, p, { id: c.id, kind: 'card-action', sourceId: card.id, controller: p, displayName: card.name, effect: { ...a.effect, targetId: a.effect.targetId ?? card.id } });
            payActionFee(s, p, c, a.cost ?? 0, { pay, eligible: ownActionPayment(s, p, card.id), blockedIds: a.tap ? [card.id] : [], deferTap: true });
            tapCostCards(s, p, [...(a.tap ? [card.id] : []), ...(c.actionPayments ?? []).map(x => x.cardId)]);
            return true;
        }
        // Test-only initiators are kept in legacy lab rooms, never in full rounds.
        if (['hidden', 'battle', 'finish-battle', 'discard-rumor', 'move-aside'].includes(c.type))
            throw new RuleError('此机制测试按钮不用于回合对局');
        return false;
    }
    function resolveEffect(s, a) {
        if (!active(s))
            return false;
        if (a.kind === 'rule-return-region') {
            if (s.turn.claim?.cardId === a.districtCardId && s.turn.claim.district === a.district)
                beginReturn(s);
            return true;
        }
        if (a.effect?.kind === 'place-influence') {
            const d = s.districts[a.effect.district];
            if (d?.id === a.effect.districtCardId) {
                placeRegionInfluence(s, a.effect.district, a.controller, a.effect.count);
                if (['keyword-influence', 'reputation'].includes(a.event))
                    phaseEvent?.(s, null, 'keyword-influence-placed', { faceDown: false }, a.id, { winner: a.controller, district: a.effect.district, keyword: a.event === 'reputation' ? '声望' : a.keyword, count: a.effect.count });
            }
            return true;
        }
        if (a.effect?.kind === 'draw') {
            draw(s, [a.controller], a.effect.count ?? 1);
            return true;
        }
        if (['modify-icons', 'modify-defense'].includes(a.effect?.kind)) {
            if (s.locations[a.effect.targetId]?.zone === 'play' && !s.locations[a.effect.targetId].faceDown)
                s.effects.push({ ...a.effect, id: a.id });
            stateBased(s);
            return true;
        }
        return false;
    }
    function view(s, p) {
        if (!active(s) || !s.turn)
            return { turn: null, roundChoice: null, districts: null, result: null };
        const t = s.turn, pl = s.players[p];
        let publicChoice = null;
        if (s.roundChoice) {
            const a = s.roundChoice;
            publicChoice = { id: a.id, kind: a.kind, controller: a.controller, echoReward: !!a.echoes?.length, count: a.cardIds?.length, budget: a.budget, woundBudget: a.woundBudget ?? 0 };
            if (a.controller === p && ['investigation'].includes(a.kind))
                publicChoice.cards = a.cardIds.map(id => identity(s, id));
            ;
            if (a.kind === 'eternal-region')
                Object.assign(publicChoice, { cardId: a.cardId, cardName: s.cards[a.cardId].name, options: a.options });
            if (a.kind === 'damage') {
                publicChoice.taskForceAlternative = !!a.taskForceAlternative;
                publicChoice.replacementTargets = a.taskForceAlternative ? s.players.flatMap(pl => pl.play).filter(id => s.locations[id]?.zone === 'play' && s.locations[id].faceDown && s.locations[id].district === s.turn.district).map(id => ({ id: `hidden:${s.locations[id].hiddenHandle}`, name: `${s.seats[controllerOf(s, id)].name}的暗藏者 ` + (s.players[controllerOf(s, id)].play.filter(x => s.locations[x].faceDown && s.locations[x].district === s.turn.district).indexOf(id) + 1) })) : [];
                publicChoice.targets = a.targetIds.filter(id => battleDamageRecipient(s, id) && s.locations[id].district === s.turn.district && controllerOf(s, id) !== a.controller).map(id => ({ ...identity(s, id), ...s.locations[id], effectiveDefense: effectiveDefense(s, id), woundsPrevented: woundsPrevented(s, id), guardRequirement: keywordAmount(s, id, '护卫') }));
            }
        }
        return { turn: { phase: t.phase, phaseLabel: phaseNames[t.phase], step: t.step, stepLabel: s.effectBattle ? '额外' + contestNames[s.effectBattle.kind ?? 'battle'] + ' · ' + stepNames[t.step] : stepNames[t.step], extraBattle: !!s.effectBattle, firstPlayer: t.firstPlayer, privilegeUsed: t.privilegeUsed, actionClosed: t.actionClosed, district: t.phase === 'contest' || s.effectBattle || t.claim ? t.district : null, districtNumber: t.phase === 'contest' || s.effectBattle || t.claim ? (s.turn.claim?.districtNumber ?? districtNumber(s, t.district)) : null, kind: t.phase === 'contest' || s.effectBattle ? t.kind : null, contestLabel: t.phase === 'contest' || s.effectBattle ? contestNames[t.kind] : null, lastContest: t.lastContest,
                reputationPending: !t.claim && regionWinner(s.districts[t.district]) === null && t.phase === 'contest' && t.kind === 'influence' && !nextInfluenceSource(s) && !(t.reputationDone ?? []).includes(t.district),
                priorityStepKey: priorityStepKey(s), priorityStepLabel: (t.phase === 'contest' || s.effectBattle) && t.kind ? `地区${t.claim?.districtNumber ?? districtNumber(s, t.district)} · ${contestNames[t.kind]}` : stepNames[t.step], claimResume: t.claim?.resume ? { phase: t.claim.resume.turn.phase, step: t.claim.resume.turn.step, stepLabel: stepNames[t.claim.resume.turn.step] ?? '原步骤', stepOwner: t.claim.resume.stepOwner } : null, standardAllowed: t.phase === 'action' && ['first-action', 'second-action'].includes(t.step) && !t.actionClosed,
                discardRequired: t.step === 'recovery' ? s.players.map((x, i) => Math.max(0, x.hand.length - playerHandLimit(s, i))) : null,
                returnCardIds: t.claim ? returnIds(s, p).map(id => s.locations[id].faceDown && controllerOf(s, id) !== p ? `hidden:${s.locations[id].hiddenHandle}` : id) : [], returnDone: t.claim?.orders.map(x => x !== null) ?? null, claimWinner: t.claim?.winner ?? null },
            roundChoice: publicChoice, districts: s.districts.map((d, i) => d ? { id: d.id, number: districtNumber(s, i), grantedAbilities: [], catalogId: d.catalogId, name: d.name, displayName: d.displayName, type: isTaskDistrict(d) ? 'task/district' : 'district', owner: d.owner, ownerName: s.seats[d.owner]?.name, ...(isTaskDistrict(d) ? { printedCost: d.printedCost, printedCostText: d.printedCostText, loyalty: d.loyalty, faction: d.faction, magicDomains: d.magicDomains } : {}), ...splitCardRules(d.text, d.faq), subtitle: d.subtitle, flavorText: d.flavorText, traits: districtTraits(s, i), counters: d.counters, timeMarkers: districtTimeMarkers(s, i), roadMove: !!d.plan?.roadMove, destroyed: d.destroyed ?? 0, pending: d.plan?.pending ?? [], threshold: d.threshold, pendingWinner: d.pendingWinner ?? null, points: d.points, influence: [...d.influence], regionInfluence: regionInfluence(s, i), hasWinTrigger: !!d.winTrigger || !!d.plan?.win?.length || !!d.automation?.taskWin } : null), worldDeckCount: s.worldDeck.length, result: s.result,
            ownMulliganDone: pl.mulliganDone, mulliganDone: s.players.map(x => x.mulliganDone) };
    }
    function effectBattle(s, ability, district, kind = 'battle') {
        s.effectBattle = { ability, kind, turn: structuredClone(s.turn), stepOwner: s.flow.stepOwner, participants: s.players.flatMap(pl => pl.play).filter(id => s.locations[id]?.district === district && hasCardType(s.cards[id], 'character') && participatesInContest(s, id)).map(id => ({ id, version: s.locations[id].zoneVersion })) };
        clearCosts(s);
        s.turn = { ...s.turn, step: 'contest-resolve', district, kind, lastContest: null };
        s.flow.locked = true;
        log(s, `${ability.displayName}：地区${districtNumber(s, district)}进行额外${contestNames[kind]}。`);
        resolveContest(s);
    }
    return { effectBattle, claimDistrict: (s, player, district, cardId) => { s.forcedRegionWins ??= []; s.forcedRegionWins.push({ player, district, cardId }); }, active, initialize, advance, command, view, resolveEffect, checkVictory, stateBased, draw, finishGame, finishReturn, phaseReady, onTriggersChosen: s => {
            if (s.turn.step === 'contest-triggers')
                completeReward(s);
            else if (s.turn.step === 'recovery')
                finishRecovery(s);
        }, beginRound };
}
