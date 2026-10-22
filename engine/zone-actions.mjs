import { unstableSacrificeDiscount } from './entropy-effects.mjs';
import { effectObjectsLog } from './action-log.mjs';
import { sealedResolutionPermit } from './sealed-resolution-cast.mjs';
import { tapCostCards } from './tap-costs.mjs';
import { stackCastRestriction } from './stack-continuous.mjs';
import { changeHonor } from './player-resources.mjs';
import { relocate } from './district-rules.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { palaceSources, sealedCastMethods } from './bq-rules.mjs';
import { assetReputationCastSources } from './veiled-status-rules.mjs';
import { coreArea } from './shoggoth-rules.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
import { graveCards, inGrave } from './graveyard-rules.mjs';
import { requiresHades, hadesCosts, nativeGraveCast } from './plan-rules.mjs';
import { destroyedTotal } from './entropy-effects.mjs';
import { discardMany } from './discard-events.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { meetsLoyalty } from './holy-deck-effects.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { societyAllowsCast, effectiveCastPlan, lotusFreeCast } from './casting-rules.mjs';
import { fateSealedPermission } from './reality-rules.mjs';
import { transactionsBlocked } from './field-rules.mjs';
import { canTapCard } from './field-events.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { withSimultaneousDepartures } from './simultaneous-choice.mjs';
import { RuleError, pushAbility } from './core.mjs';
import { hasCardType } from './card-types.mjs';
import { identity, controllerOf } from './ownership.mjs';
import { graveyardLocked, enterTapped, castingCost, effectiveSubtypes, sacrificeCostBlocked } from './derived.mjs';
import { sealHost, liveSealHost } from './sealing.mjs';
import { shuffleCards } from './environment-definitions.mjs';
import { sealedCount, sealedCardWeight, sealedCostPaid } from './sealed-counts.mjs';
import { printedHandActionCost } from './abyss.mjs';
const need = (value, message) => {
    if (!value)
        throw new RuleError(message);
};
const publicSource = (s, id) => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown;
export function castSourceStatus(s, p, id, { ignorePalace = false, ignoreHeartfire = false } = {}) {
    const card = printedRulesCard(s, id), loc = s.locations[id];
    if (!card || !loc || !(loc.zone === 'hand' ? s.players[p].hand.includes(id) : loc.zone === 'core' ? loc.corePlayer === p : loc.zone === 'asset' ? controllerOf(s, id) === p : card.owner === p))
        return { allowed: false, reason: '只能打出自己手中或自己拥有且获得区域许可的牌' };
    const restricted = stackCastRestriction(s, p, card);
    if (restricted)
        return { allowed: false, reason: restricted };
    if (!societyAllowsCast(s, p, card))
        return { allowed: false, reason: s.societies?.[p]?.plan?.disasterOnly ? '末日钟禁止打出非灾难牌' : '修格斯失控限制禁止打出该牌' };
    if (hasCardType(card, 'spell') && transactionsBlocked(s))
        return { allowed: false, reason: '未横置的州议员贝伦·希恩斯禁止双方打出事务牌' };
    if (card.automation?.noNormalPlay || card.spell?.noNormalPlay)
        return { allowed: false, reason: '该牌不能正面打出，只能秘密派遣或由效果放置进场' };
    if (card.attachment?.graveOnly && !inGrave(s, id, id))
        return { allowed: false, reason: '免疫体样本只能从本方墓地或集团总部区打出' };
    const field = s.players[p].play.filter(source => publicSource(s, source));
    if (loc.zone === 'core')
        return { allowed: !!coreArea(s, p) && s.selectedCoreIds?.[p] === id, reason: '只有当前选定的核心角色可以从核心区打出' };
    if (loc.zone === 'hand')
        return hasCardType(card, 'character') && field.some(source => printedRulesCard(s, source).automation?.static === 'grave-death-casting') ? { allowed: false, reason: '大维齐尔迈哈穆德在场时，不能从手牌正面打出角色' } : { allowed: true };
    if (inGrave(s, id, id)) {
        if (graveyardLocked(s, id, card.owner))
            return { allowed: false, reason: '镇魂曲禁止在墓地发动能力或将角色从墓地放置进场' };
        if (nativeGraveCast(s, p, id))
            return { allowed: true };
        if (requiresHades(s, p, id) && (hadesCosts(s, p, id).length >= 2 || lotusFreeCast(s, p, card)))
            return { allowed: true };
        if (s.resolutionCasting?.cardId === id && s.resolutionCasting.player === p && s.resolutionCasting.zoneVersion === loc.zoneVersion || card.automation?.castFromGrave || card.attachment?.castFromGrave || card.spell?.castFromGrave || hasCardType(card, 'character') && card.magicDomains?.includes('死亡') && field.some(source => printedRulesCard(s, source).automation?.static === 'grave-death-casting' && inGrave(s, id, source)))
            return { allowed: true };
    }
    if (assetReputationCastSources(s, p, id).length)
        return { allowed: true };
    if (!ignoreHeartfire && [].length)
        return { allowed: true };
    if (loc.zone === 'asset' && card.spell?.castFromAssetCondition === 'controls-psychic' && field.some(source => hasCardType(printedRulesCard(s, source), 'character') && effectiveSubtypes(s, source).includes('超能力者')))
        return { allowed: true };
    if (sealedResolutionPermit(s, p, id))
        return { allowed: true };
    if (fateSealedPermission(s, p, id))
        return { allowed: true };
    if (loc.zone === 'sealed' && !loc.faceDown && card.automation?.castWhileSealed) {
        const host = sealHost(s, loc.hostId);
        if (host?.version === loc.hostVersion && liveSealHost(s, host) && (true || host.kind === 'society' && host.owner === p) && (!card.automation.sealedRoleAttachmentSociety || host.kind === 'society' && host.owner === p || host.kind === 'card' && s.locations[host.hostId]?.zone === 'play' && !s.locations[host.hostId].faceDown && ['character', 'attachment'].some(t => hasCardType(printedRulesCard(s, host.hostId), t))))
            return { allowed: true };
    }
    if (!ignorePalace && palaceSources(s, p, id).length)
        return { allowed: true };
    return { allowed: false, reason: '当前区域没有打出此牌的许可' };
}
export function fieldTimeMarkers(s) { return Object.values(s.locations).reduce((n, l) => n + (['play', 'asset', 'society'].includes(l.zone) && !l.faceDown ? (l.markers ?? 0) : 0), 0) + (s.districts ?? []).reduce((n, d) => n + (d?.counters?.time ?? 0), 0); }
export function createZoneActionEngine(ctx) {
    const payCostBatch = ctx.payCostBatch ?? ((s, ids, apply) => withSimultaneousDepartures(s, ids, apply));
    const { move, seal, draw, log, pay, checkLoyalty, hasPriority, standardAction, announce, stateBased, event, targetOptions, targetRefs } = ctx;
    function cardLoyaltyMet(s, p, id) {
        try {
            checkLoyalty(s, p, printedRulesCard(s, id));
            return true;
        }
        catch (e) {
            if (e instanceof RuleError)
                return false;
            throw e;
        }
    }
    function spawnAttachment(s, p, code, d, group) {
        const template = s.reserveTemplates.find(c => c.catalogId === code), district = s.districts[d];
        if (!template || !district)
            return;
        const id = crypto.randomUUID();
        s.cards[id] = { ...structuredClone(template), id, owner: p };
        s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
        if (move(s, id, 'play', { controller: p, district: d, faceDown: false, tapped: enterTapped(s, id, d), attachedTo: `district-host:${district.id}`, hostVersion: district.id }))
            event(s, id, 'entry', s.locations[id], group, { method: 'effect-placement' });
    }
    function actions(s, p, id) {
        const c = printedRulesCard(s, id), l = s.locations[id];
        if (!c || !l || l.faceDown || !(l.zone === 'hand' ? s.players[p].hand.includes(id) : l.zone === 'asset' ? controllerOf(s, id) === p : c.owner === p))
            return [];
        return (c.automation?.zoneActions ?? []).filter(a => (a.zone === 'graveyard' ? inGrave(s, id, id) : a.zone === l.zone) && (!a.ownSocietyOnly || l.hostId === `society:${p}` && liveSealHost(s, sealHost(s, l.hostId)) && l.hostVersion === sealHost(s, l.hostId).version) && (!a.sealedCharacterHost || s.locations[l.hostId]?.zone === 'play' && !s.locations[l.hostId].faceDown && s.locations[l.hostId].zoneVersion === l.hostVersion && hasCardType(printedRulesCard(s, l.hostId), 'character'))).map(a => a.sealedCharacterHost ? { ...a, sourceDistrict: s.locations[l.hostId].district, sourceDistrictCardId: s.districts[s.locations[l.hostId].district]?.id } : a);
    }
    const key = (s, id, index) => `${id}:${s.locations[id].zoneVersion}:zone:${index}`;
    const used = (s, id, index) => s.zoneActionUses?.[key(s, id, index)] === s.round;
    function costs(s, p, id, a) {
        if (a.shuffleSeals)
            return Object.keys(s.locations).filter(id => { const l = s.locations[id], h = sealHost(s, `society:${p}`); return l.zone === 'sealed' && l.hostId === h.hostId && l.hostVersion === h.version; });
        if (a.discardCost)
            return s.players[p].hand.filter(x => !a.discardCost.magic || effectiveMagicDomains(s, x).includes(a.discardCost.magic));
        if (a.sacrificeCost)
            return s.players[p].play.filter(x => publicSource(s, x) && hasCardType(s.cards[x], 'character') && !sacrificeCostBlocked(s, x) && (!a.sacrificeCost.subtype || effectiveSubtypes(s, x).includes(a.sacrificeCost.subtype)));
        if (a.bottomSeals)
            return Object.keys(s.locations).filter(x => s.locations[x].zone === 'sealed' && s.locations[x].hostId === `society:${p}` && liveSealHost(s, sealHost(s, `society:${p}`)) && effectiveMagicDomains(s, x).includes(a.bottomSeals.magic));
        if (a.sealCost)
            return graveCards(s, p).filter(x => x !== id && !s.cards[x].token && (a.sealCost.anyType || hasCardType(s.cards[x], 'character')) && (!a.sealCost.magic || effectiveMagicDomains(s, x).includes(a.sealCost.magic)) && (!a.sealCost.name || matchesSpecifiedName(s.cards[x], a.sealCost.name)));
        if (a.tapAttachments)
            return s.players[p].play.filter(x => publicSource(s, x) && canTapCard(s, x) && hasCardType(s.cards[x], 'attachment') && (!a.tapAttachments.name || matchesSpecifiedName(printedRulesCard(s, x), a.tapAttachments.name)));
        if (a.tapCost)
            return s.players[p].play.filter(x => publicSource(s, x) && canTapCard(s, x) && hasCardType(s.cards[x], 'character') && (!a.tapCost.name || matchesSpecifiedName(s.cards[x], a.tapCost.name)) && (!a.tapCost.subtype || effectiveSubtypes(s, x).includes(a.tapCost.subtype)));
        return [];
    }
    function available(s, p, id, a, index) {
        if (a.honorCost && (s.players[p].honor ?? 0) < a.honorCost)
            return { allowed: false, reason: '名誉点不足' };
        if (a.loyaltyCondition && !meetsLoyalty(s, p, a.loyaltyCondition))
            return { allowed: false, reason: '资产区缺少所需忠诚' };
        if (a.zone === 'graveyard' && graveyardLocked(s, id, p))
            return { allowed: false, reason: '镇魂曲禁止墓地能力' };
        if (a.prepareOnly && s.turn?.step !== 'prepare')
            return { allowed: false, reason: '只能在准备步骤发动' };
        if (a.minimumTime !== undefined && fieldTimeMarkers(s) < a.minimumTime)
            return { allowed: false, reason: `场上需要至少${a.minimumTime}个时间标志` };
        if (a.shuffleSeals && (sealedCount(s, `society:${p}`, costs(s, p, id, a)) < a.shuffleSeals || graveCards(s, p, id).length < a.shuffleGrave))
            return { allowed: false, reason: '需要秘社上的三张封印牌和墓地中的三张牌' };
        if (a.oncePerRound && used(s, id, index))
            return { allowed: false, reason: '本回合此对象已发动过该能力' };
        if ((a.sealCost || a.tapCost || a.tapAttachments || a.bottomSeals || a.sacrificeCost || a.discardCost) && (a.bottomSeals ? sealedCount(s, `society:${p}`, costs(s, p, id, a)) : costs(s, p, id, a).length) < (a.sealCost?.count ?? a.tapCost?.count ?? a.tapAttachments?.count ?? a.bottomSeals?.count ?? a.sacrificeCost?.count ?? a.discardCost?.count ?? 1))
            return { allowed: false, reason: '没有可以支付额外费用的牌' };
        return { allowed: true };
    }
    function command(s, p, c) {
        if (s.mode !== 'automation-play' || c.type !== 'zone-activate')
            return false;
        hasPriority(s, p);
        need(!s.triggerChoices.length && !s.effectChoice, '请先完成当前选择');
        const card = printedRulesCard(s, c.cardId), loc = s.locations[c.cardId], index = c.actionIndex ?? 0;
        need(Number.isSafeInteger(index) && index >= 0, '请选择有效的区域能力编号');
        const plan = actions(s, p, c.cardId)[index];
        need(plan, '当前区域没有这项手牌或墓地能力');
        const status = available(s, p, c.cardId, plan, index);
        need(status.allowed, status.reason);
        if (plan.timing !== 'fast' && !plan.prepareOnly)
            standardAction(s, p);
        const targets = targetRefs(s, p, c, { ...plan, sourceId: card.id });
        const destinationDistrict = plan.target === 'district' ? targets[0]?.district : plan.districtFromCost ? s.locations[c.costIds?.[0]]?.district : plan.district ?? 0;
        if (plan.effect === 'zone-enter')
            need(!!s.districts[destinationDistrict], '效果放置进场的地区不存在');
        const costIds = c.costIds ?? [];
        need(Array.isArray(costIds) && new Set(costIds).size === costIds.length, '额外费用选择无效');
        if (plan.modes)
            need(plan.modes.some(m => m.id === c.mode), '请选择放置标志的类别');
        if (plan.shuffleSeals) {
            const grave = c.graveCostIds;
            need(sealedCostPaid(s, `society:${p}`, costIds, plan.shuffleSeals) && costIds.every(id => costs(s, p, card.id, plan).includes(id)), '请选择规定数量的本方秘社封印牌');
            need(Array.isArray(grave) && grave.length === plan.shuffleGrave && new Set(grave).size === grave.length && grave.every(id => graveCards(s, p, card.id).includes(id)), '请选择三张不同的本方墓地牌');
        }
        else if (plan.sealCost || plan.tapCost || plan.tapAttachments || plan.bottomSeals || plan.sacrificeCost || plan.discardCost)
            need((plan.bottomSeals ? sealedCostPaid(s, `society:${p}`, costIds, plan.bottomSeals.count) : costIds.length === (plan.sealCost?.count ?? plan.tapCost?.count ?? plan.tapAttachments?.count ?? plan.sacrificeCost?.count ?? plan.discardCost?.count ?? 1)) && costIds.every(id => costs(s, p, card.id, plan).includes(id)), '请选择规定数量的合法额外费用牌');
        else
            need(!costIds.length, '该能力没有额外费用牌');
        if (plan.districtChoice)
            need(Number.isInteger(c.district) && s.districts[c.district], '请选择有效进场地区');
        const sourceRef = { zone: loc.zone, zoneVersion: loc.zoneVersion }, destination = plan.effect === 'zone-enter' ? { district: destinationDistrict, id: s.districts[destinationDistrict].id } : plan.districtChoice ? { district: c.district, id: s.districts[c.district].id } : null;
        const amount = Math.max(0, (plan.zone === 'hand' ? printedHandActionCost(s, p, card.id, plan.cost ?? 0) : plan.cost ?? 0) - unstableSacrificeDiscount(s, plan.sacrificeCost ? costIds : [])), costGroup = `cost:${c.id}`;
        pay(s, p, amount);
        if (plan.honorCost)
            changeHonor(s, p, -plan.honorCost);
        if (plan.oncePerRound) {
            s.zoneActionUses ??= {};
            s.zoneActionUses[key(s, card.id, index)] = s.round;
        }
        s.flow = pushAbility(s.flow, p, { id: c.id, kind: 'zone-ability', cardId: card.id, controller: p, displayName: card.name, plan, sourceRef, destination, targets, mode: c.mode });
        beginEventGroup(s, costGroup);
        if (plan.shuffleSeals) {
            const owners = new Set();
            for (const id of [...costIds, ...c.graveCostIds]) {
                need(move(s, id, 'deck', { cause: 'cost' }), '不能将所选费用牌洗回牌库');
                owners.add(s.cards[id].owner);
            }
            for (const owner of owners)
                shuffleCards(s.players[owner].deck);
        }
        if (plan.sealSelf) {
            need(!card.token, '指示物不能支付封印费用');
            need(seal(s, card.id, sealHost(s, `society:${p}`), sourceRef, { cause: 'cost' }), '无法将来源牌封印作为费用');
        }
        payCostBatch(s, plan.sacrificeCost ? costIds : [], () => {
            if (plan.discardCost) {
                discardMany(s, costIds, move, event, { cause: 'cost' });
                return;
            }
            tapCostCards(s, p, plan.tapCost || plan.tapAttachments ? costIds : []);
            for (const id of (plan.shuffleSeals ? [] : costIds))
                if (plan.sacrificeCost)
                    move(s, id, 'graveyard', { cause: 'sacrifice' });
                else if (plan.bottomSeals) {
                    move(s, id, 'deck');
                }
                else if (plan.sealCost) {
                    const before = { zone: s.locations[id].zone, zoneVersion: s.locations[id].zoneVersion };
                    need(seal(s, id, sealHost(s, `society:${p}`), before, { cause: 'cost' }) || s.locations[id].zoneVersion !== before.zoneVersion, '封印费用不能支付');
                }
                else { /* Taps were paid together above. */ }
            ;
        });
        if (plan.discardSelf)
            discardMany(s, [card.id], move, event, { cause: 'cost' });
        endEventGroup(s);
        if (plan.revealSelf)
            log(s, `${s.seats[p].name}发动先兆，展示手牌${card.name}；此牌仍留在手中。`);
        log(s, `${card.name}发动${({ hand: '手牌', graveyard: '墓地', sealed: '封印区' })[plan.zone] ?? plan.zone}${plan.timing === 'fast' ? '快速' : ''}行动${amount > 0 ? `，支付${amount}点费用` : ''}${costIds.length ? '，支付额外费用' : ''}${effectObjectsLog(s, targets)}，能力进入堆叠。`);
        announce(s, p, null, c.id, costIds.length || plan.discardSelf ? costGroup : null);
        return true;
    }
    function resolve(s, a) {
        if (a.kind !== 'zone-ability')
            return false;
        const { plan, sourceRef } = a, p = a.controller, loc = s.locations[a.cardId], sameSource = loc?.zone === sourceRef.zone && loc.zoneVersion === sourceRef.zoneVersion;
        if (plan.effect === 'zone-spawn') {
            const t = a.targets[0], template = s.reserveTemplates.find(c => c.catalogId === plan.catalogId);
            if (template && s.districts[t.district]?.id === t.cardId && true && meetsLoyalty(s, p, plan.loyaltyCondition)) {
                const id = crypto.randomUUID();
                s.cards[id] = { ...structuredClone(template), id, owner: p };
                s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
                if (move(s, id, 'play', { controller: p, district: t.district, tapped: enterTapped(s, id, t.district) }))
                    event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
            }
            stateBased(s);
            return true;
        }
        if (plan.effect === 'zone-blink') {
            if (!plan.requireHidden || effectiveSocietyMarkers(s, p).hidden > 0)
                ctx.resolveEffect(s, { ...a, kind: 'auto-ability', plan: { ...plan, sourceId: a.cardId, sourceZoneVersion: sourceRef.zoneVersion, effect: 'batch', operation: 'blink' } });
            else
                stateBased(s);
            return true;
        }
        if (plan.effect === 'zone-hidden-contest') {
            ctx.startHidden(s, a.id, a);
            return true;
        }
        if (plan.effect === 'zone-enter') {
            if (sameSource && (!plan.loyaltyCondition || meetsLoyalty(s, p, plan.loyaltyCondition)) && (!plan.cardLoyaltyCondition || cardLoyaltyMet(s, p, a.cardId)) && s.districts[a.destination.district]?.id === a.destination.id && !(sourceRef.zone === 'graveyard' && graveyardLocked(s))) {
                beginEventGroup(s, a.id);
                if (move(s, a.cardId, 'play', { controller: p, district: a.destination.district, tapped: !!plan.tapped || enterTapped(s, a.cardId, a.destination.district), faceDown: !!plan.faceDown, ...(plan.faceDown ? { hiddenHandle: crypto.randomUUID() } : {}) })) {
                    // move() announces hidden entry itself; do not announce it a second time.
                    if (!plan.faceDown)
                        event(s, a.cardId, 'entry', s.locations[a.cardId], a.id, { method: 'effect-placement' });
                    if (plan.spawnAfterEntry)
                        spawnAttachment(s, p, plan.spawnAfterEntry, a.destination.district, a.id);
                }
                endEventGroup(s);
            }
        }
        else if (plan.effect === 'zone-ghost-pull') {
            const t = a.targets[0], l = s.locations[t?.cardId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === t.zoneVersion && s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId && targetOptions(s, p, plan).some(o => o.id === t.cardId)) {
                if (relocate(s, t.cardId, plan.sourceDistrict))
                    event(s, t.cardId, 'move', s.locations[t.cardId], a.id, { district: plan.sourceDistrict });
            }
        }
        else if (plan.effect === 'zone-seal') {
            const t = a.targets[0], l = s.locations[t?.cardId];
            if (sameSource && l?.zone === 'play' && !l.faceDown && l.zoneVersion === t.zoneVersion && targetOptions(s, p, plan).some(o => o.id === t.cardId))
                seal(s, a.cardId, sealHost(s, t.cardId), sourceRef);
        }
        else if (plan.effect === 'zone-seal-self-draw') {
            if (sameSource && inGrave(s, a.cardId, a.cardId) && !graveyardLocked(s, a.cardId, p, loc.zone) && seal(s, a.cardId, sealHost(s, `society:${p}`), sourceRef))
                draw(s, [p], 1);
        }
        else if (plan.effect === 'zone-return') {
            if (sameSource && !graveyardLocked(s))
                move(s, a.cardId, 'hand');
        }
        else if (plan.effect === 'zone-prevent') {
            const t = a.targets[0], l = s.locations[t?.cardId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === t.zoneVersion && targetOptions(s, p, plan).some(o => o.id === t.cardId))
                s.effects.push({ kind: 'prevent-damage', targetId: t.cardId, targetZoneVersion: t.zoneVersion, controller: p, duration: 'until-end-of-round' });
        }
        log(s, `${s.cards[a.cardId].name}的${({ hand: '手牌', graveyard: '墓地', sealed: '封印区' })[sourceRef.zone] ?? sourceRef.zone}能力结算完成。`);
        stateBased(s);
        return true;
    }
    function view(s, p) {
        if (s.mode !== 'automation-play' || !s.players[p])
            return {};
        const zoneActions = Object.keys(s.cards).flatMap(id => actions(s, p, id).map((plan, index) => ({ ...identity(s, id), actionIndex: index, zone: plan.zone, plan, cost: plan.zone === 'hand' ? printedHandActionCost(s, p, id, plan.cost ?? 0) : plan.cost ?? 0, targets: targetOptions(s, p, { ...plan, sourceId: id }), costCards: costs(s, p, id, plan).map(id => ({ ...((plan.shuffleSeals && s.locations[id].faceDown && s.cards[id].owner !== p) ? { id, name: '背面封印牌', ownerName: s.seats[s.cards[id].owner].name } : identity(s, id)), costWeight: plan.bottomSeals || plan.shuffleSeals ? sealedCardWeight(s, `society:${p}`, id) : 1 })), ...(plan.shuffleSeals ? { graveCostCards: graveCards(s, p, id).map(id => identity(s, id)) } : {}), ...available(s, p, id, plan, index) })));
        const zoneCasts = Object.keys(s.cards).filter(id => (inGrave(s, id, id) || ['sealed', 'asset'].includes(s.locations[id]?.zone)) && castSourceStatus(s, p, id).allowed).map(id => ({ ...identity(s, id), ...(s.cards[id].spell ? { spell: effectiveCastPlan(s, p, s.cards[id]) } : s.cards[id].attachment ? { attachment: effectiveCastPlan(s, p, s.cards[id]) } : {}), costsWaived: lotusFreeCast(s, p, s.cards[id]), fastCast: fateSealedPermission(s, p, id), zone: s.locations[id].zone, cost: castingCost(s, p, s.cards[id]), targets: targetOptions(s, p, { ...(effectiveCastPlan(s, p, s.cards[id]) ?? { target: 'none' }), cardId: id }) }));
        return { zoneActions, zoneCasts, sealedCastingMethods: Object.fromEntries(zoneCasts.filter(c => c.zone === 'sealed').map(c => [c.id, sealedCastMethods(s, p, c.id, castSourceStatus(s, p, c.id, { ignorePalace: true }).allowed)])) };
    }
    return { command, resolve, view };
}
