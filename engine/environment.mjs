import { attachmentHostReference, liveAttachmentHost } from './attachment-host-reference.mjs';
import { effectObjectsLog, paidCostsClause } from './action-log.mjs';
import { abilityDescription } from './ability-description.mjs';
import { tapCostCards } from './tap-costs.mjs';
import { payActionFee } from './action-payment.mjs';
import { changeHonor } from './player-resources.mjs';
import { earlyTriggerTiming, lateTriggerTiming } from './trigger-timing.mjs';
import { triggerCostDecision, continuousDecision } from './death-costs.mjs';
import { deferTriggerCost } from './trigger-cost-queue.mjs';
import { removeRegionInfluence, placeRegionInfluence } from './club-influence.mjs';
import { resetCard } from './reset.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { adjacentDistricts } from './task-districts.mjs';
import { createParallelEnvironment, pairedOperations } from './environment-simultaneous.mjs';
import { seatChoice } from './simultaneous-choice.mjs';
import { splitCardRules } from './card-text-format.mjs';
import { matchesCardNameFilter } from './card-names.mjs';
import { beginPrediction, finishPrediction, predictionView } from './prediction.mjs';
import { graveCards, inGrave } from './graveyard-rules.mjs';
import { uuid, randomValues } from './random.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { realityCard, realitySociety, realityModes } from './reality-rules.mjs';
import { observeHiddenInspection } from './card-inspection.mjs';
import { canMoveToDistrict, relocate, districtTraits } from './district-rules.mjs';
import { librarySearchBlocked } from './library-search.mjs';
import { canTapCard, tapCard } from './field-events.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { discardMany } from './discard-events.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { dealDamage } from './damage.mjs';
import { districtTimeMarkers } from './time-markers.mjs';
import { hasCardType, hasAnyCardType } from './card-types.mjs';
import { transformCard } from './card-forms.mjs';
import { RuleError, pushAbility, societyMarkers } from './core.mjs';
import { sealHost, sealedOn } from './sealing.mjs';
import { sealedCardWeight, sealedCostPaid } from './sealed-counts.mjs';
import { controllerOf, identity } from './ownership.mjs';
import { effectiveSubtypes, hasBarrier, playerHasBarrier, graveyardLocked, cardHasKeyword } from './derived.mjs';
import { effectiveIcons, effectiveDefense } from './rounds.mjs';
import { societyPlan, shuffleCards } from './environment-definitions.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const chars = (s, p) => s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character'));
const allChars = s => [...chars(s, 0), ...chars(s, 1)];
const unique = ids => Array.isArray(ids) && ids.every(x => typeof x === 'string') && new Set(ids).size === ids.length;
const ref = (s, id) => ({ id, version: s.locations[id]?.zoneVersion });
const still = (s, r) => r && s.locations[r.id]?.zoneVersion === r.version;
function matches(s, id, f = {}) { const c = printedRulesCard(s, id), types = effectiveSubtypes(s, id); return (!f.type || hasCardType(c, f.type)) && matchesCardNameFilter(c, f) && (!f.subtype || types.includes(f.subtype)) && (!f.subtypesAny || f.subtypesAny.some(x => types.includes(x))) && (!f.magic || effectiveMagicDomains(s, id).includes(f.magic)) && (!f.unique || c.unique === true || c.unique === 1) && (!f.factionName || c.faction?.split('·')[1] === f.factionName) && (!f.subtitle || c.subtitle === f.subtitle) && (!f.subtitleAny || f.subtitleAny.includes(c.subtitle)); }
export function createEnvironmentEngine(ctx) {
    const { move, setLocation, seal, releaseSeals, conceal, draw, log, trigger, registerGroup, pay, hasPriority, standardAction, announce, openWindow, stateBased, event, startHidden, onSetupDone, onPhaseDone, targetOptions, targetRefs } = ctx;
    function payOfferedTrigger(s, a) {
        const p = a.controller, targetOptions = a.claimMobileTarget ? claimMobile(s, p, a).map(id => ({ id, name: s.cards[id].name })) : [];
        if ((s.players[p].costPool ?? 0) + s.players[p].assets.filter(x => !x.tapped).length < (a.cost ?? 0) || a.claimMobileTarget && !targetOptions.length)
            return;
        const c = triggerCostDecision(s, a, targetOptions);
        if (!c.fire)
            return;
        const ids = c.targetIds ?? [];
        if (a.claimMobileTarget) {
            need(ids.length === 1 && targetOptions.some(o => o.id === ids[0]), '请选择本方机动角色');
            a.targets = [capture(s, { kind: 'card', cardId: ids[0] })];
        }
        pay(s, p, a.cost ?? 0);
        a.committed = true;
        a.prepaid = (a.cost ?? 0) > 0;
        trigger(s, a);
    }
    function emit(s, p, source, ops, group, mandatory = false, extra = {}) {
        registerGroup(s, group);
        const a = { id: uuid(), kind: 'environment-ability', event: extra.event ?? 'environment', cardId: source.id, sourceId: source.id, controller: p, displayName: source.name, group, mandatory, ops, ...(s.costTriggerParent ? { triggerAfter: s.costTriggerParent } : {}), sourceDistrict: extra.district, ...extra };
        a.abilityDescription = abilityDescription(s, a);
        if (lateTriggerTiming(s))
            s.triggerChoices.push(a);
        else if ((a.cost ?? 0) > 0 || earlyTriggerTiming(s) && (!mandatory || a.claimMobileTarget)) {
            if (!deferTriggerCost(s, a))
                payOfferedTrigger(s, a);
        }
        else {
            a.committed = earlyTriggerTiming(s);
            if (mandatory)
                trigger(s, a);
            else
                s.triggerChoices.push(a);
        }
    }
    function initialize(s) {
        if (!s.environmentCatalog)
            return false;
        s.societyStates = [0, 1].map(() => ({ tapped: false, counters: {}, uses: {} }));
        s.societies = [0, 1].map(p => { const selected = s.deckSelections?.[p]?.society?.id ?? s.labSocietyIds?.[p] ?? 'MSJC09', c = s.environmentCatalog.find(c => c.catalogId === selected); need(c?.type === 'society' && c.initialSelectable, '请选择可作为初始秘社的牌'); const society = { ...structuredClone(c), id: `society:${p}`, owner: p }; s.cards[society.id] = society; s.locations[society.id] = { zone: 'society', zoneVersion: 0, controller: p }; return society; });
        ctx.initializeCore?.(s);
        s.worldDeck = shuffleCards(s.environmentCatalog.filter(c => c.type === 'district').map(c => ({ ...structuredClone(c), id: `world:${c.catalogId}:${uuid()}` })));
        need(s.worldDeck.length === (s.worldCardCount ?? 29) && s.worldDeck.length >= 3, '世界牌库必须符合房间启用设置并至少包含3张地区记录');
        s.districts = [null, null, null];
        s.setup = { stage: 'before-world', choices: [null, null] };
        if ([0, 1].some(p => societyPlan(s, p).beforeWorldLook)) {
            s.turn.firstPlayer ??= randomValues(new Uint32Array(1))[0] % 2;
            s.setup.order = [s.turn.firstPlayer, 1 - s.turn.firstPlayer].filter(p => societyPlan(s, p).beforeWorldLook);
            s.setup.previewPlayer = s.setup.order[0];
        }
        if ([0, 1].some(p => societyPlan(s, p).beforeWorldLook)) {
            s.turn.step = 'world-preview';
            return true;
        }
        revealInitial(s);
        return true;
    }
    function reveal(s, index) {
        const card = s.worldDeck.shift();
        s.districts[index] = card ? { ...card, pendingWinner: null, influence: [0, 0], counters: {} } : null;
        if (!card) {
            log(s, `世界牌库为空，地区${index + 1}保留空位。`);
            return;
        }
        s.cards[card.id] = card;
        s.locations[card.id] = { zone: 'district', zoneVersion: 0, district: index };
        log(s, `翻开地区${index + 1}：${card.name}（势力值${card.threshold}，${card.points}分）。`);
        if (card.plan?.sealTopOnReveal) {
            const host = sealHost(s, `district-host:${card.id}`);
            for (const p of [0, 1]) {
                const id = s.players[p].deck[0];
                if (id)
                    seal(s, id, host, { zone: 'deck', zoneVersion: s.locations[id].zoneVersion });
            }
            log(s, '亚伯拉罕湖持续能力已立即完成封印，早于秘社开局与起始抓牌。');
        }
    }
    function revealInitial(s) {
        for (let d = 0; d < 3; d++)
            reveal(s, d);
        for (const p of [0, 1]) {
            const index = societyPlan(s, p).initialDestroyDistrict, d = s.districts[index];
            if (Number.isInteger(index) && d) {
                d.destroyed = 1;
                log(s, `${s.societies[p].name}持续能力：设置初始地区后，立即毁灭地区${index + 1}（${d.name}）。`);
            }
        }
        for (const p of [0, 1]) {
            const n = societyPlan(s, p).initialHonor ?? 0;
            if (n) {
                changeHonor(s, p, n);
                log(s, `${s.societies[p].name}：${s.seats[p].name}在游戏开始时获得${n}名誉点。`);
            }
        }
        s.setup.stage = 'before-hand';
        s.setup.choices = [null, null];
        s.turn.step = 'society-setup';
        for (const p of [0, 1])
            if (societyPlan(s, p).initialHidden) {
                const m = s.players[p].markers;
                setCardMarker(s, s.players[p], 'markers', null, societyMarkers(m.hidden, m.exposed, societyPlan(s, p).initialHidden, 0));
            }
        startSetup(s);
    }
    function startSetup(s) {
        const secrets = [0, 1].filter(p => societyPlan(s, p).beforeHandSecret);
        if (secrets.length && secrets.some(p => s.setup.choices[p] === null)) {
            s.effectChoice = { id: uuid(), kind: 'environment', mode: 'setup-secret', controller: null, controllers: secrets, cardIds: [], committed: s.setup.choices };
            return;
        }
        for (const p of secrets) {
            for (const id of s.setup.choices[p])
                seal(s, id, sealHost(s, `society:${p}`));
            shuffleCards(s.players[p].deck);
            log(s, `${s.seats[p].name}公布破茧者教团选择：${s.setup.choices[p].map(id => s.cards[id].name).join('、') || '未选择卡牌'}。`);
        }
        const ops = [0, 1].flatMap(p => (societyPlan(s, p).beforeHand ?? []).map(o => ({ ...o, player: p, hostId: `society:${p}` })));
        run(s, { id: uuid(), kind: 'environment-ability', controller: 0, cardId: s.societies[0].id, setup: true }, ops);
    }
    function end(s, a) {
        s.effectChoice = null;
        if (a.phaseBegin) {
            onPhaseDone?.(s);
            return;
        }
        if (a.setup) {
            s.setup = null;
            onSetupDone(s);
            return;
        }
        stateBased(s);
        if (ctx.repeatResolved?.(s, a))
            return;
        // The effect has finished. openWindow preserves the rule-choice gate while
        // clearing the old chooser lock, so rule sacrifice can resume this window.
        if (s.status === 'playing' && !s.hidden)
            openWindow(s);
    }
    function chooser(s, a, o, remaining, mode, ids = [], extra = {}) {
        s.flow.locked = true;
        if (['inspect', 'inspect-discard'].includes(mode))
            ids = ids;
        if (mode === 'inspect-discard' && !ids.length) {
            run(s, a, remaining);
            return;
        }
        s.effectChoice = { id: uuid(), kind: 'environment', controller: o.player ?? a.controller, cardIds: ids, mode, operation: o, job: a, remaining, ...extra };
        if (mode === 'predict')
            beginPrediction(s, s.effectChoice);
    }
    const parallel = createParallelEnvironment({ chooser, run, chars, matches, move, seal, draw, log, event, enter, setLocation, targetOptions, targetRefs });
    function actionCost(s, p, def) { return Math.max(0, (def.cost ?? 0) - (def.discountCounter ? s.societyStates[p].counters[def.discountCounter] ?? 0 : 0)); }
    function mostEnemyDistricts(s, p) { const counts = s.districts.map((d, i) => d ? chars(s, 1 - p).filter(id => s.locations[id].district === i).length : -1), max = Math.max(...counts); return counts.flatMap((n, i) => n === max && s.districts[i] ? [`district:${i}`] : []); }
    function claimMobile(s, p, a) { return s.districts[a.sourceDistrict]?.id === a.sourceDistrictCardId ? chars(s, p).filter(id => s.locations[id].district === a.sourceDistrict && cardHasKeyword(s, id, '机动')) : []; }
    function run(s, a, input) {
        let ops = [...input];
        while (ops.length && s.status === 'playing') {
            const o = { ...ops.shift() };
            if (o.player === 'target' && !liveTarget(s, a.targets?.[0]))
                continue;
            const p = o.player === 'winner' ? a.controller : o.player === 'other' ? 1 - a.controller : o.player === 'first' ? s.turn.firstPlayer : o.player === 'second' ? 1 - s.turn.firstPlayer : o.player === 'target' ? a.targets?.[0]?.player : o.player === 'self' ? a.controller : o.player ?? a.controller;
            if (pairedOperations(s, a, o, ops[0])) {
                parallel.open(s, a, [o, ops.shift()], ops);
                return;
            }
            o.player = p;
            const hostId = o.hostId ?? `society:${p}`, target = a.targets?.[0], second = a.targets?.[1];
            if (o.kind === 'mother-play') {
                ctx.resolveCardAbility(s, { ...a, kind: 'auto-ability', plan: { target: 'none', effect: 'late-non-qs', operation: 'mother-play', sourceId: a.cardId, maxCost: s.societyStates[p].counters.revival ?? 0 }, targets: [] });
                if (s.effectChoice)
                    return;
                continue;
            }
            if (o.kind === 'plan-progress') {
                if (liveTarget(s, target)) {
                    const l = s.locations[target.id];
                    l.counters ??= {};
                    setCardMarker(s, l, "counter", "progress", (l.counters.progress ?? 0) + (o.count ?? 1));
                    event(s, target.id, 'progress-change', l, a.id);
                }
                continue;
            }
            else if (o.kind === 'reality-phase') {
                const st = s.societyStates[p];
                if (st.realityRound !== s.round) {
                    st.realityRound = s.round;
                    st.realityUsed = [];
                }
                st.realityMode = null;
                st.realityPhase = s.turn.phase;
                const options = realityModes.filter(x => !st.realityUsed.includes(x.id));
                if (options.length) {
                    chooser(s, a, o, ops, 'reality-phase', [], { options });
                    return;
                }
                continue;
            }
            if (o.kind === 'reality-top-three') {
                if (librarySearchBlocked(s))
                    continue;
                const ids = s.players[p].deck.slice(0, 3);
                chooser(s, a, o, ops, 'reality-top-three', ids, { min: 0, max: 1, eligibleIds: ids.filter(id => realityCard(s, id) === true) });
                return;
            }
            if (o.firstOnly && s.turn.firstPlayer !== p || o.noExposed && effectiveSocietyMarkers(s, p).exposed)
                return run(s, a, ops);
            if (o.ifKeyword && !chars(s, p).some(id => cardHasKeyword(s, id, o.ifKeyword)))
                continue;
            if (o.ifMoreEnemyCharacters && chars(s, 1 - p).length <= chars(s, p).length)
                continue;
            if (o.ifEmptyOwnCharacters && (!liveTarget(s, target) || chars(s, p).some(id => s.locations[id].district === target.district)))
                continue;
            if (o.ifCity && (!liveTarget(s, target) || !districtTraits(s, target.district).includes('城市')))
                continue;
            if (o.kind === 'subtype-keywords') {
                s.effects.push({ kind: 'subtype-keywords', controller: p, subtype: o.subtype, keywords: o.keywords, duration: 'until-end-of-round', provenance: { name: s.societies[p].name, abilityText: '秘社行动能力' } });
                continue;
            }
            if (o.kind === 'clear-society-counter') {
                delete s.societyStates[p].counters[o.counter];
                continue;
            }
            if (o.kind === 'reset-society') {
                s.societyStates[p].tapped = false;
                log(s, `${s.seats[p].name}重置本方秘社。`);
                continue;
            }
            if (o.kind === 'police-honor') {
                const st = s.societyStates[p];
                if (s.players.reduce((n, pl) => n + pl.markers.exposed, 0) >= (st.counters.renown ?? 0)) {
                    changeHonor(s, p, 1);
                    setCardMarker(s, st, "counter", "renown", (st.counters.renown ?? 0) + 1);
                    log(s, `${s.seats[p].name}获得1名誉点，放置1个名望标志。`);
                }
                continue;
            }
            if (o.kind === 'police-recruit') {
                if (liveTarget(s, target)) {
                    const d = target.district, count = Number(districtTraits(s, d).includes('城市')) + Number(s.players[1 - p].play.some(id => s.locations[id].district === d && s.locations[id].faceDown)) + Number(!chars(s, p).some(id => s.locations[id].district === d));
                    const template = s.reserveTemplates.find(c => c.catalogId === 'TK003');
                    need(template || !count, '缺少警察指示物资料，请创建新版房间');
                    for (let i = 0; i < count; i++) {
                        const id = uuid();
                        s.cards[id] = { ...structuredClone(template), id, owner: p };
                        s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
                        enter(s, id, p, d, false, a.id);
                    }
                    log(s, `洛杉矶警察局：在${s.districts[d].name}生成${count}个警察。`);
                }
                continue;
            }
            if (o.kind === 'claim-mobile-return') {
                if (liveTarget(s, target) && claimMobile(s, p, a).includes(target.id))
                    move(s, target.id, 'hand');
                continue;
            }
            if (o.kind === 'transform-society') {
                const source = s.societies[p], l = s.locations[source.id], face = s.environmentCatalog.find(c => c.catalogId === o.toFace);
                if (source.id === a.cardId && l.zoneVersion === a.sourceVersion && source.catalogId === a.sourceFace && face && (!o.noCharacters || !allChars(s).length) && transformCard(s, source.id, face)) {
                    s.societies[p] = s.cards[source.id];
                    log(s, `秘社转变为${face.name}；保持横置状态、标志、封印与结附。`);
                }
            }
            else if (o.kind === 'spawn-token') {
                if (liveTarget(s, target)) {
                    const template = s.reserveTemplates.find(c => c.catalogId === o.catalogId);
                    if (template) {
                        const id = uuid();
                        s.cards[id] = { ...structuredClone(template), id, owner: p };
                        s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
                        if (template.attachment?.target === 'district') {
                            const host = s.districts[target.district];
                            if (move(s, id, 'play', { controller: p, district: target.district, tapped: false, attachedTo: `district-host:${host.id}`, hostVersion: host.id })) {
                                event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
                                event(s, id, 'attached', s.locations[id], a.id, { host: sealHost(s, `district-host:${host.id}`) });
                            }
                        }
                        else
                            enter(s, id, p, target.district, false, a.id);
                    }
                }
            }
            else if (o.kind === 'grant-keyword') {
                if (liveTarget(s, target))
                    s.effects.push({ kind: 'grant-keyword', keyword: o.keyword, targetId: target.id, targetZoneVersion: target.version, duration: 'until-end-of-round' });
            }
            else if (o.kind === 'district-keyword') {
                if (liveTarget(s, target))
                    for (const id of chars(s, p))
                        if (s.locations[id].district === target.district && effectiveIcons(s, id, false, true).battle > 0)
                            s.effects.push({ kind: 'grant-keyword', keyword: o.keyword, targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: 'until-end-of-round' });
            }
            else if (o.kind === 'next-command-discount')
                s.effects.push({ kind: 'next-cost-discount', controller: p, playOnly: true, filter: { subtype: '命令' }, amount: 1, duration: 'until-end-of-round' });
            else if (o.kind === 'next-equipment-discount')
                s.effects.push({ kind: 'next-cost-discount', controller: p, playOnly: true, filter: { type: 'attachment', subtype: '装备' }, hostSubtitle: o.hostSubtitle, amount: 1, duration: 'until-end-of-round' });
            else if (o.kind === 'sacrifice-character') {
                const ids = chars(s, p).filter(id => !cardHasKeyword(s, id, '永恒'));
                if (ids.length) {
                    chooser(s, a, o, ops, 'sacrifice-character', ids, { min: 1, max: 1, public: true });
                    return;
                }
            }
            else if (o.kind === 'next-draw') {
                s.nextDrawBonuses ??= [];
                s.nextDrawBonuses.push({ player: p, count: o.count, round: s.round + 1 });
            }
            else if (o.kind === 'shuffle-target') {
                if (liveTarget(s, target))
                    shuffleCards(s.players[target.player].deck);
            }
            else if (o.kind === 'inspect-discard') {
                if (liveTarget(s, target) && s.players[target.player].hand.length) {
                    const ids = [...s.players[target.player].hand];
                    observeHiddenInspection(s, a.controller, ids, event, a.id);
                    chooser(s, a, { ...o, player: a.controller }, ops, 'inspect-discard', ids, { min: 1, max: 1 });
                    return;
                }
            }
            else if (o.kind === 'draw') {
                draw(s, [p], o.count ?? 1);
            }
            else if (o.kind === 'draw-both')
                draw(s, [0, 1], o.count);
            else if (o.kind === 'markers-both') {
                for (const pl of s.players)
                    setCardMarker(s, pl, 'markers', null, societyMarkers(pl.markers.hidden, pl.markers.exposed, o.marker === 'hidden' ? o.count : 0, o.marker === 'exposed' ? o.count : 0));
            }
            else if (o.kind === 'clear-markers-both') {
                for (const pl of s.players)
                    setCardMarker(s, pl, "markers", null, { hidden: 0, exposed: 0 });
            }
            else if (o.kind === 'mill') {
                for (const id of s.players[p].deck.slice(0, o.count))
                    move(s, id, 'graveyard');
            }
            else if (o.kind === 'reset-subtype') {
                for (const id of chars(s, p))
                    if (effectiveSubtypes(s, id).includes(o.subtype))
                        resetCard(s, id);
            }
            else if (o.kind === 'ghost-types')
                s.societyStates[p].ghostTypes = true;
            else if (o.kind === 'society-counter') {
                const counters = s.societyStates[p].counters;
                counters[o.counter] = Math.min(o.max ?? Infinity, (counters[o.counter] ?? 0) + o.amount);
            }
            else if (o.kind === 'conceal-all') {
                for (const id of allChars(s))
                    if (!o.nonhuman || !effectiveSubtypes(s, id).includes('人类'))
                        conceal(s, id, a.id);
            }
            else if (o.kind === 'shuffle-hidden') {
                for (const pl of s.players)
                    for (const id of pl.play)
                        if (s.locations[id].faceDown)
                            s.locations[id].hiddenHandle = uuid();
            }
            else if (o.kind === 'damage-all') {
                for (const id of allChars(s))
                    dealDamage(s, id, o.count);
            }
            else if (o.kind === 'return-all-characters') {
                for (const id of allChars(s).filter(id => s.locations[id].district !== a.sourceDistrict))
                    move(s, id, 'hand');
            }
            else if (o.kind === 'destroy-district') {
                const d = s.districts[o.district];
                if (d)
                    d.destroyed = 1;
            }
            else if (o.kind === 'time-and-destroy-region') {
                if (liveTarget(s, target)) {
                    const district = target.kind === 'district' ? target.district : s.locations[target.id].district, d = s.districts[district];
                    if (target.kind === 'district') {
                        d.counters ??= {};
                        setCardMarker(s, d, "counter", "time", (d.counters.time ?? 0) + 1);
                    }
                    else
                        setCardMarker(s, s.locations[target.id], "markers", null, (s.locations[target.id].markers ?? 0) + 1);
                    if (districtTimeMarkers(s, district) >= 4) {
                        d.destroyed = 1;
                        log(s, `末日钟：${d.name}的时间标志达到四个，毁灭该地区。`);
                    }
                }
            }
            else if (o.kind === 'target-counter') {
                if (liveTarget(s, target)) {
                    const l = s.locations[target.id];
                    if (o.counter === 'time')
                        setCardMarker(s, l, "markers", null, (l.markers ?? 0) + o.amount);
                    else {
                        l.counters ??= {};
                        setCardMarker(s, l, "counter", o.counter, (l.counters[o.counter] ?? 0) + o.amount);
                    }
                }
            }
            else if (o.kind === 'destroy-time-draw') {
                const ids = Object.keys(s.locations).filter(id => s.locations[id].zone === 'play' && !s.locations[id].faceDown && hasAnyCardType(s.cards[id], ['character', 'attachment']) && (s.locations[id].markers ?? 0) >= 3);
                let count = 0;
                for (const id of ids) {
                    move(s, id, 'graveyard', { cause: 'destroy' });
                    if (s.locations[id].zone !== 'play')
                        count++;
                }
                draw(s, [p], count);
            }
            else if (o.kind === 'move-to-lock') {
                if (liveTarget(s, target) && liveTarget(s, second) && !printedRulesCard(s, target.id).cannotMove) {
                    const d = s.locations[second.id].district;
                    need(!!s.districts[d], '移动目标地区已失效');
                    if (relocate(s, target.id, d))
                        event(s, target.id, 'move', s.locations[target.id], a.id, { district: d });
                }
            }
            else if (o.kind === 'target-top') {
                if (liveTarget(s, target)) {
                    move(s, target.id, 'deck');
                    s.players[s.cards[target.id].owner].deck = s.players[s.cards[target.id].owner].deck.filter(id => id !== target.id);
                    s.players[s.cards[target.id].owner].deck.unshift(target.id);
                }
            }
            else if (o.kind === 'seal-top-to-target') {
                if (liveTarget(s, target)) {
                    const id = s.players[p].deck[0];
                    if (id)
                        seal(s, id, sealHost(s, target.id));
                }
            }
            else if (o.kind === 'target-grave-enter') {
                if (liveTarget(s, target) && liveTarget(s, second) && !graveyardLocked(s))
                    enter(s, target.id, p, second.district, false, a.id);
            }
            else if (o.kind === 'conceal-cost-criminal') {
                if (a.discardedCriminal && still(s, a.tappedCharacters?.[0]))
                    conceal(s, a.tappedCharacters[0].id, a.id);
            }
            else if (o.kind === 'seal-fixed-blood') {
                (() => {
                    for (const r of o.references)
                        if (still(s, r) && inGrave(s, r.id, a.cardId))
                            seal(s, r.id, sealHost(s, hostId));
                })();
            }
            else if (o.kind === 'hidden') {
                const bonus = o.bonus === 'divination' ? s.societyStates[p].counters.divination ?? 0 : o.bonus === 'discard-cost' ? a.discardedCost ?? 0 : 0;
                if (startHidden(s, a.id)) {
                    s.hidden.environmentBonus = { [p]: bonus };
                    s.hidden.environmentBonusScope = o.bonusScope ?? 'player';
                    s.environmentHidden = { job: a, ops };
                    return;
                }
            }
            else if (o.kind === 'simultaneous-search') {
                if (librarySearchBlocked(s)) {
                    log(s, '稻荷神社童子：跳过双方牌库检索，双方牌库仍洗牌。');
                    for (const who of [0, 1])
                        shuffleCards(s.players[who].deck);
                    continue;
                }
                chooser(s, a, o, ops, 'simultaneous-search', [], { controller: null, controllers: [0, 1], committed: [null, null] });
                return;
            }
            else if (['search', 'search-enter'].includes(o.kind)) {
                if (librarySearchBlocked(s)) {
                    log(s, '稻荷神社童子：跳过牌库检索，牌库仍洗牌。');
                    shuffleCards(s.players[p].deck);
                    continue;
                }
                const ids = s.players[p].deck.filter(id => matches(s, id, o.filter));
                chooser(s, a, o, ops, 'search', ids, { min: 0, max: 1 });
                return;
            }
            else if (o.kind === 'predict') {
                const count = o.count === 'investigation-plus-two' ? chars(s, p).reduce((n, id) => n + effectiveIcons(s, id, true).investigation, 2) : o.count;
                const ids = s.players[p].deck.slice(0, count);
                chooser(s, a, o, ops, 'predict', ids);
                return;
            }
            else if (['discard', 'discard-redraw', 'hand-bottom', 'seal-hand', 'hand-hidden-enter', 'hand-enter'].includes(o.kind)) {
                if (o.kind === 'hand-hidden-enter' && (!liveTarget(s, target) || s.players[p].hand.length < 4))
                    continue;
                const ids = s.players[p].hand.filter(id => matches(s, id, o.filter ?? {})).filter(id => !['hand-hidden-enter', 'hand-enter'].includes(o.kind) || hasCardType(s.cards[id], 'character') || o.kind === 'hand-enter' && hasCardType(s.cards[id], 'attachment'));
                const exact = o.kind === 'discard' ? Math.min(o.count, ids.length) : 1;
                if (!ids.length)
                    continue;
                chooser(s, a, o, ops, o.kind, ids, { min: o.kind === 'discard-redraw' || o.optional ? 0 : exact, max: o.kind === 'discard-redraw' ? ids.length : exact });
                return;
            }
            else if (['reveal', 'sacrifice-draw-defense', 'return-character'].includes(o.kind)) {
                const ids = o.kind === 'reveal' ? s.players[p].play.filter(id => s.locations[id].faceDown && !s.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === id)) : chars(s, p).filter(id => o.kind !== 'return-character' || s.locations[id].district !== a.sourceDistrict);
                if (!ids.length)
                    continue;
                chooser(s, a, o, ops, o.kind, ids, { min: o.optional ? 0 : 1, max: 1 });
                return;
            }
            else if (['grave-enter', 'host-death-release'].includes(o.kind)) {
                const ids = o.kind === 'grave-enter' ? graveCards(s, p).filter(id => hasCardType(s.cards[id], 'character') && !graveyardLocked(s)) : sealedOn(s, hostId).filter(id => matches(s, id, { type: 'character', subtype: '梦魇' }));
                const d = o.kind === 'host-death-release' ? o.district : a.memory?.[o.districtKey];
                if (!ids.length || !s.districts[d])
                    continue;
                chooser(s, a, { ...o, district: d }, ops, o.kind, ids, { min: o.kind === 'host-death-release' && !o.prepaid ? 0 : 1, max: 1 });
                return;
            }
            else if (o.kind === 'sealed-enter') {
                if (!liveTarget(s, target))
                    continue;
                const ids = sealedOn(s, hostId).filter(id => hasCardType(s.cards[id], 'character'));
                if (!ids.length)
                    continue;
                chooser(s, a, { ...o, district: target.district }, ops, 'sealed-enter', ids, { min: 1, max: 1 });
                return;
            }
            else if (o.kind === 'anchor-return') {
                const names = s.deckSelections?.[p]?.choices?.anchorNames ?? [];
                const ids = Object.keys(s.cards).filter(id => false);
                if (!ids.length)
                    continue;
                chooser(s, a, o, ops, 'anchor-return', ids, { min: 1, max: 1 });
                return;
            }
            else if (o.kind === 'seal-grave-corpse') {
                if (!liveTarget(s, target))
                    continue;
                const ids = graveCards(s, p).filter(id => s.cards[id].name === '无名尸体');
                if (!ids.length)
                    continue;
                chooser(s, a, o, ops, 'seal-grave-corpse', ids, { min: 1, max: 1 });
                return;
            }
            else if (o.kind === 'optional-seal-top' || o.kind === 'even-top-asset') {
                const id = s.players[p].deck[0];
                if (!id)
                    continue;
                log(s, `${s.seats[p].name}展示顶牌：${s.cards[id].name}。`);
                if (o.kind === 'even-top-asset' && s.cards[id].printedCost % 2 !== 0) {
                    shuffleCards(s.players[p].deck);
                    continue;
                }
                chooser(s, a, o, ops, o.kind, [id], { min: 0, max: 1, public: true });
                return;
            }
            else if (o.kind === 'inspect-target') {
                if (liveTarget(s, target)) {
                    let ids = target.kind === 'player' ? [...s.players[target.player].hand] : [target.id];
                    ids = observeHiddenInspection(s, p, ids, event, a.id);
                    chooser(s, a, o, ops, 'inspect', ids);
                    return;
                }
            }
            else if (o.kind === 'monk-empty-influence') {
                const ids = chars(s, p).filter(id => canTapCard(s, id) && effectiveSubtypes(s, id).includes('僧侣'));
                if (ids.length) {
                    chooser(s, a, o, ops, 'monk-empty-influence', ids, { min: 1, max: 1 });
                    return;
                }
            }
            else if (o.kind === 'remove-enemy-influence') {
                if (!liveTarget(s, target))
                    continue;
                const d = s.districts[target.district], enemy = 1 - p;
                if (!d.influence[enemy])
                    continue;
                removeRegionInfluence(s, target.district, enemy, 1);
                if (!d.influence[enemy]) {
                    const ids = chars(s, p).filter(id => canTapCard(s, id) && s.locations[id].district === target.district && effectiveSubtypes(s, id).includes('僧侣'));
                    if (ids.length) {
                        chooser(s, a, o, ops, 'monk-influence', ids, { min: 0, max: 1 });
                        return;
                    }
                }
            }
            else if (o.kind === 'choose-district') {
                chooser(s, a, o, ops, 'choose-district', [], { options: s.districts.flatMap((d, i) => d ? [{ id: String(i), name: d.name }] : []) });
                return;
            }
            else if (o.kind === 'optional') {
                chooser(s, a, o, ops, 'optional', [], { options: [{ id: 'yes', name: o.label }, { id: 'no', name: '不执行' }] });
                return;
            }
            else if (['mode', 'spirit-mode', 'permanent-buff-mode', 'clear-markers-mode'].includes(o.kind)) {
                chooser(s, a, o, ops, o.kind, [], { options: o.modes?.map(m => ({ id: m.id, name: m.label, ops: m.ops })) ?? (o.kind === 'clear-markers-mode' ? [{ id: 'hidden', name: '移除所有隐秘' }, { id: 'exposed', name: '移除所有暴露' }] : o.kind === 'spirit-mode' ? [{ id: 'grant', name: '获得灵体' }, { id: 'remove', name: '失去灵体' }] : [{ id: 'battle', name: '获得黑刀标志' }, { id: 'defense', name: '获得防御+1标志' }]) });
                return;
            }
            else
                throw new RuleError(`未接入环境效果：${o.kind}`);
        }
        if (s.status === 'playing')
            end(s, a);
    }
    function enter(s, id, p, d, hidden, group) {
        if (!s.districts[d])
            return;
        const c = printedRulesCard(s, id);
        const entered = move(s, id, 'play', { controller: p, district: d, tapped: !hidden && !!c.keywords?.includes('迟缓'), faceDown: hidden, ...(hidden ? { hiddenHandle: uuid() } : {}) });
        if (entered && !hidden)
            event(s, id, 'entry', s.locations[id], group, { method: 'effect-placement' });
    }
    function liveTarget(s, t) {
        if (!t)
            return false;
        if (t.kind === 'district')
            return s.districts[t.district]?.id === t.id;
        if (t.kind === 'society')
            return true;
        if (t.kind === 'player')
            return !Number.isInteger(t.filterPlayer) || t.player === t.filterPlayer || !playerHasBarrier(s, t.player);
        return still(s, t) && !!s.locations[t.id].faceDown === t.faceDown && (!t.filter || choices(s, t.filterPlayer, t.filter).some(x => x.cardId === t.id));
    }
    function choices(s, p, kind, district) {
        if (kind === 'player')
            return s.seats.flatMap((a, i) => i !== p && playerHasBarrier(s, i) ? [] : [{ id: `player:${i}`, kind: 'player', player: i, name: a.name }]);
        if (kind === 'role-attachment-or-district')
            return [...choices(s, p, 'character-or-attachment'), ...choices(s, p, 'district')];
        if (kind === 'district' || kind === 'city-district')
            return s.districts.flatMap((d, i) => d && true && (kind !== 'city-district' || districtTraits(s, i).includes('城市')) ? [{ id: `district:${i}`, name: d.name, kind: 'district', district: i, cardId: d.id }] : []);
        if (kind === 'society')
            return s.seats.map((a, i) => ({ id: `society:${i}`, name: `${a.name}的秘社`, kind: 'society', player: i }));
        if (kind === 'player-hidden-or-plan')
            return [...choices(s, p, 'player-or-hidden'), ...choices(s, p, 'secret-plan')];
        if (kind === 'player-or-hidden')
            return [...choices(s, p, 'player').map(o => ({ ...o, name: o.name + '的手牌' })), ...choices(s, p, 'enemy-hidden'), ...s.players[p].play.filter(id => s.locations[id].faceDown).map(id => cardOption(s, id, p))];
        return Object.keys(s.cards).filter(id => {
            const c = printedRulesCard(s, id), l = s.locations[id], own = controllerOf(s, id) === p;
            if (kind === 'own-death-grave-character' || kind === 'own-spirit-grave-character')
                return inGrave(s, id, p) && c.owner === p && hasCardType(c, 'character') && !graveyardLocked(s) && (kind === 'own-death-grave-character' ? c.magicDomains.includes('死亡') : c.keywords?.includes('灵体'));
            if (l.zone !== 'play')
                return false;
            if (kind === 'own-secret-plan')
                return own && !!l.secretPlan;
            if (kind === 'secret-plan')
                return !!l.secretPlan && (own || !hasBarrier(s, id));
            if (kind === 'enemy-hidden')
                return l.faceDown && !own && !s.flow.stack.some(a => a.kind === 'reveal-character' && a.cardId === id);
            if (kind === 'locked-character-or-hidden')
                return (l.faceDown || hasCardType(c, 'character')) && (l.counters?.locked ?? 0) > 0 && (l.faceDown || own || !hasBarrier(s, id));
            if (l.faceDown)
                return false;
            if (!own && hasBarrier(s, id))
                return false;
            if (kind === 'industry')
                return own && hasCardType(c, 'attachment') && c.subtitle === '圣甲虫产业';
            if (kind === 'character-or-attachment')
                return hasAnyCardType(c, ['character', 'attachment']);
            if (!hasCardType(c, 'character'))
                return false;
            return kind === 'character' || kind === 'own-character' && own || kind === 'own-nonmagic-human' && own && !effectiveMagicDomains(s, id).length && effectiveSubtypes(s, id).includes('人类');
        }).map(id => cardOption(s, id, p));
    }
    function cardOption(s, id, p) { const l = s.locations[id]; return { id: l.faceDown ? `hidden:${l.hiddenHandle}` : id, name: l.faceDown ? `${s.seats[controllerOf(s, id)].name}的暗藏者 · 地区${l.district + 1}` : l.secretPlan && controllerOf(s, id) !== p ? `${s.seats[controllerOf(s, id)].name}的秘密计划` : s.cards[id].name, kind: 'card', cardId: id }; }
    function capture(s, x) {
        if (x.kind === 'district')
            return { kind: x.kind, id: x.cardId, district: x.district };
        if (['society', 'player'].includes(x.kind))
            return { kind: x.kind, id: x.id, player: x.player };
        return { kind: 'card', cardId: x.cardId, zoneVersion: s.locations[x.cardId]?.zoneVersion, ...ref(s, x.cardId), faceDown: !!s.locations[x.cardId].faceDown };
    }
    function command(s, p, c) {
        if (c.type === 'environment-choice') {
            if (parallel.command(s, p, c))
                return true;
            const a = s.effectChoice;
            need(a?.kind === 'environment' && a.id === c.choiceId, '环境能力选择已变化');
            if (a.mode === 'setup-secret') {
                need(a.controllers.includes(p) && s.setup.choices[p] === null, '没有属于你的开局秘密选择');
                const def = societyPlan(s, p).beforeHandSecret, ids = c.cardIds ?? [];
                need(unique(ids) && ids.length <= def.max && ids.every(id => s.players[p].deck.includes(id) && matches(s, id, def.filter)) && (!def.distinctNames || new Set(ids.map(id => s.cards[id].name)).size === ids.length), '请选择至多五张不同名梦魇角色');
                s.setup.choices[p] = [...ids];
                if (a.controllers.every(i => s.setup.choices[i] !== null)) {
                    s.effectChoice = null;
                    startSetup(s);
                }
                return true;
            }
            if (a.mode === 'simultaneous-search') {
                need(!librarySearchBlocked(s), '稻荷神社童子在场时不能检索牌库');
                need(a.controllers.includes(p) && a.committed[p] === null, '你已完成此秘密检索');
                const ids = c.cardIds ?? [];
                need(unique(ids) && ids.length <= 1 && ids.every(id => s.players[p].deck.includes(id) && matches(s, id, a.operation.filter)), '请选择一张符合条件的牌或查找失败');
                a.committed[p] = ids;
                if (a.committed.every(x => x !== null)) {
                    for (const who of [0, 1]) {
                        for (const id of a.committed[who]) {
                            if (a.operation.reveal)
                                log(s, `${s.seats[who].name}展示${s.cards[id].name}。`);
                            move(s, id, a.operation.destination);
                        }
                        shuffleCards(s.players[who].deck);
                    }
                    s.effectChoice = null;
                    run(s, a.job, a.remaining);
                }
                return true;
            }
            need(a.controller === p, '只有该选择的玩家可以操作');
            const ids = c.cardIds ?? [];
            need(unique(ids), '选择不能重复');
            const job = a.job, o = a.operation ?? {}, target = job?.targets?.[0];
            if (a.mode === 'reality-phase') {
                need(a.options.some(x => x.id === c.option), '请选择本回合未使用的阶段选项');
                const st = s.societyStates[p];
                st.realityMode = c.option;
                st.realityUsed.push(c.option);
                log(s, `${s.seats[p].name}虚实交界：${a.options.find(x => x.id === c.option).name}，仅本阶段生效。`);
            }
            else if (a.mode === 'reality-top-three') {
                need(ids.length <= 1 && ids.every(id => a.eligibleIds.includes(id)) && a.cardIds.every((id, i) => s.players[p].deck[i] === id), '请选择检视牌中的至多一张实牌');
                const id = ids[0];
                if (id) {
                    need(realityCard(s, id) === true, '所选牌不再是实牌');
                    if (o.destination === 'graveyard')
                        move(s, id, 'graveyard');
                    else if (o.destination === 'society')
                        seal(s, id, sealHost(s, `society:${p}`));
                    else if (liveTarget(s, target))
                        seal(s, id, target.kind === 'district' ? sealHost(s, `district-host:${target.id}`) : sealHost(s, target.id));
                }
            }
            else if (a.mode === 'predict') {
                const all = [...(c.top ?? []), ...(c.bottom ?? [])];
                need(unique(all) && all.length === a.cardIds.length && all.every(id => a.cardIds.includes(id)) && a.cardIds.every((id, i) => s.players[p].deck[i] === id), '预测需为全部牌指定顶底顺序');
                finishPrediction(s, a, c, { event });
                s.players[p].deck = [...c.top, ...s.players[p].deck.slice(all.length), ...c.bottom];
            }
            else if (a.mode === 'search-most-enemies') {
                need(ids.length === 1 && a.cardIds.includes(ids[0]) && mostEnemyDistricts(s, p).includes(ids[0]), '请选择敌方角色最多的地区');
                enter(s, a.enterId, p, Number(ids[0].slice(9)), false, job.id);
                shuffleCards(s.players[p].deck);
            }
            else if (a.options) {
                need(a.options.some(x => x.id === c.option), '请选择合法选项');
                if (a.mode === 'optional' && c.option === 'yes')
                    a.remaining = [...o.ops.map(x => ({ ...x, player: p })), ...a.remaining];
                if (a.mode === 'mode')
                    a.remaining = [...o.modes.find(m => m.id === c.option).ops, ...a.remaining];
                if (a.mode === 'choose-district') {
                    job.memory ??= {};
                    job.memory[o.key] = Number(c.option);
                }
                if (a.mode === 'spirit-mode' && liveTarget(s, target))
                    s.effects.push({ kind: c.option === 'grant' ? 'grant-keyword' : 'remove-keyword', keyword: '灵体', targetId: target.id, targetZoneVersion: target.version, duration: 'until-end-of-round' });
                if (a.mode === 'permanent-buff-mode' && liveTarget(s, target))
                    s.effects.push({ kind: c.option === 'battle' ? 'modify-icons' : 'modify-defense', icon: 'battle', amount: 1, targetId: target.id, targetZoneVersion: target.version });
                if (a.mode === 'clear-markers-mode')
                    s.players[target.player].markers[c.option] = 0;
            }
            else if (a.mode === 'inspect-discard') {
                need(ids.length === 1 && a.cardIds.includes(ids[0]) && s.players[target.player].hand.includes(ids[0]), '请选择检视手牌中的一张');
                discardMany(s, ids, move, event, { cause: 'discard', effectController: job.controller });
            }
            else if (a.mode === 'inspect') {
                need(c.confirm === true, '请确认检视');
            }
            else if (a.mode === 'attachment-host') {
                need(ids.length === 1 && a.cardIds.includes(ids[0]), '请选择合法结附目标');
                const x = a.hostOptions.find(x => x.id === ids[0]), refs = targetRefs(s, p, { targetIds: [x.id] }, { ...s.cards[a.enterId].attachment, cardId: a.enterId });
                const t = refs[0], host = attachmentHostReference(s, t);
                need(liveAttachmentHost(s, host), '结附目标失效');
                move(s, a.enterId, 'play', { controller: p, tapped: false, attachedTo: host.hostId, hostVersion: host.version, ...(host.kind === 'card' ? { district: s.locations[host.hostId].district } : t.kind === 'district' ? { district: t.district } : {}) });
                event(s, a.enterId, 'entry', s.locations[a.enterId], job.id, { method: 'effect-placement' });
                event(s, a.enterId, 'attached', s.locations[a.enterId], job.id, { host });
            }
            else if (a.mode === 'enter-district') {
                need(ids.length === 1 && a.cardIds.includes(ids[0]), '请选择合法地区');
                const d = Number(ids[0].slice(9));
                enter(s, a.enterId, p, d, false, job.id);
            }
            else {
                need(ids.length >= (a.min ?? 0) && ids.length <= (a.max ?? 1) && ids.every(id => a.cardIds.includes(id)), '请选择规定数量的合法卡牌');
                const id = ids[0];
                if (a.mode === 'search') {
                    need(!librarySearchBlocked(s), '稻荷神社童子在场时不能检索牌库');
                    if (id) {
                        need(s.players[p].deck.includes(id), '牌库已改变');
                        if (o.reveal)
                            log(s, `${s.seats[p].name}展示${s.cards[id].name}。`);
                        if (o.kind === 'search-enter' && o.mostEnemies) {
                            const ds = mostEnemyDistricts(s, p);
                            chooser(s, job, o, a.remaining, 'search-most-enemies', ds, { min: 1, max: 1, enterId: id, public: true });
                            return true;
                        }
                        else if (o.kind === 'search-enter') {
                            if (liveTarget(s, target))
                                enter(s, id, p, target.district, false, job.id);
                        }
                        else if (o.destination === 'seal')
                            seal(s, id, sealHost(s, o.hostId ?? `society:${p}`));
                        else
                            move(s, id, o.destination === 'top' ? 'aside' : 'hand');
                    }
                    shuffleCards(s.players[p].deck);
                    if (id && o.destination === 'top') {
                        move(s, id, 'deck');
                        s.players[p].deck = s.players[p].deck.filter(x => x !== id);
                        s.players[p].deck.unshift(id);
                    }
                }
                else if (['discard', 'discard-redraw'].includes(a.mode)) {
                    need(ids.every(id => s.players[p].hand.includes(id)), '手牌已改变');
                    discardMany(s, ids, move, event, { cause: 'discard', effectController: job.controller });
                    if (a.mode === 'discard-redraw')
                        draw(s, [p], ids.length);
                }
                else if (a.mode === 'hand-bottom') {
                    need(s.players[p].hand.includes(id), '手牌已改变');
                    move(s, id, 'deck');
                }
                else if (a.mode === 'seal-hand') {
                    need(s.players[p].hand.includes(id), '手牌已改变');
                    seal(s, id, sealHost(s, `society:${p}`));
                }
                else if (a.mode === 'optional-seal-top') {
                    if (id && s.players[p].deck[0] === id)
                        seal(s, id, sealHost(s, `society:${p}`));
                }
                else if (a.mode === 'even-top-asset') {
                    if (id) {
                        need(s.players[p].deck[0] === id, '顶牌已改变');
                        move(s, id, 'asset', { controller: p, tapped: false });
                    }
                }
                else if (a.mode === 'reveal') {
                    if (id) {
                        need(s.players[p].play.includes(id) && s.locations[id].faceDown, '暗藏者已改变');
                        const d = s.locations[id].district;
                        if (setLocation(s, id, 'play', { controller: p, district: d, tapped: s.locations[id].tapped || printedRulesCard(s, id).keywords?.includes('迟缓'), faceDown: false, fieldVersion: s.locations[id].zoneVersion + 1 })) {
                            event(s, id, 'entry', s.locations[id], job.id, { method: 'reveal' });
                            event(s, id, 'reveal', s.locations[id], job.id);
                        }
                    }
                }
                else if (a.mode === 'sacrifice-character') {
                    need(chars(s, p).includes(id) && !cardHasKeyword(s, id, '永恒'), '请选择当前可被牺牲的本方角色');
                    const group = s.eventGroup;
                    s.eventGroup = job.id;
                    move(s, id, 'graveyard', { cause: 'sacrifice' });
                    if (group === undefined)
                        delete s.eventGroup;
                    else
                        s.eventGroup = group;
                }
                else if (a.mode === 'sacrifice-draw-defense') {
                    const count = effectiveDefense(s, id);
                    move(s, id, 'graveyard', { cause: 'sacrifice' });
                    draw(s, [p], count);
                }
                else if (a.mode === 'return-character' || a.mode === 'anchor-return')
                    move(s, id, 'hand');
                else if (a.mode === 'grave-enter') {
                    need(graveCards(s, p).includes(id) && !graveyardLocked(s), '墓地进场已被禁止');
                    enter(s, id, p, o.district, false, job.id);
                }
                else if (a.mode === 'host-death-release') {
                    if (id) {
                        if (!o.prepaid)
                            pay(s, p, 1);
                        enter(s, id, p, o.district, true, job.id);
                    }
                }
                else if (a.mode === 'sealed-enter')
                    enter(s, id, p, o.district, false, job.id);
                else if (a.mode === 'seal-grave-corpse') {
                    need(graveCards(s, p).includes(id), '墓地选择不合法');
                    if (liveTarget(s, target))
                        seal(s, id, sealHost(s, target.id));
                }
                else if (a.mode === 'hand-hidden-enter') {
                    if (id && liveTarget(s, target)) {
                        log(s, `${s.seats[p].name}展示${s.cards[id].name}，由隐士以暗藏者状态进场。`);
                        enter(s, id, p, target.district, true, job.id);
                    }
                }
                else if (a.mode === 'hand-enter') {
                    if (id) {
                        need(s.players[p].hand.includes(id), '手牌已改变');
                        if (hasCardType(s.cards[id], 'attachment') && s.cards[id].attachment) {
                            const options = targetOptions(s, p, { ...s.cards[id].attachment, cardId: id });
                            if (options.length) {
                                chooser(s, job, o, a.remaining, 'attachment-host', options.map(x => x.id), { min: 1, max: 1, enterId: id, hostOptions: options });
                                return true;
                            }
                            log(s, '没有合法结附目标，该附属留在手中。');
                        }
                        else {
                            const ids = s.districts.flatMap((d, i) => d ? [`district:${i}`] : []);
                            chooser(s, job, o, a.remaining, 'enter-district', ids, { min: 1, max: 1, enterId: id });
                            return true;
                        }
                    }
                }
                else if (a.mode === 'monk-influence') {
                    if (id && liveTarget(s, target)) {
                        need(chars(s, p).includes(id) && canTapCard(s, id) && s.locations[id].district === target.district && effectiveSubtypes(s, id).includes('僧侣'), '请选择该地区可横置的本方僧侣');
                        if (tapCard(s, id))
                            placeRegionInfluence(s, target.district, p);
                    }
                }
                else if (a.mode === 'monk-empty-influence') {
                    need(chars(s, p).includes(id) && canTapCard(s, id) && effectiveSubtypes(s, id).includes('僧侣'), '请选择可横置的本方僧侣');
                    const d = s.locations[id].district;
                    if (tapCard(s, id) && s.districts[d] && s.districts[d].influence.every(n => n === 0))
                        placeRegionInfluence(s, d, p);
                }
            }
            s.effectChoice = null;
            if (s.status === 'playing')
                run(s, job, a.remaining);
            return true;
        }
        if (c.type === 'world-preview') {
            const a = s.effectChoice;
            if (a?.mode === 'world-claim-preview') {
                need(a.controller === p, '只有赢取者可以检视');
                need(typeof c.bottom === 'boolean', '请选择保留或置底');
                if (c.bottom && s.worldDeck[0]?.id === a.previewId)
                    s.worldDeck.push(s.worldDeck.shift());
                s.effectChoice = null;
                end(s, a.job);
                return true;
            }
            need(s.setup?.stage === 'before-world' && s.setup.previewPlayer === p && s.setup.choices[p] === null, '当前没有你的世界牌库检视');
            need(typeof c.bottom === 'boolean', '请选择保留或置底');
            s.setup.choices[p] = c.bottom;
            if (c.bottom && s.worldDeck.length)
                s.worldDeck.push(s.worldDeck.shift());
            s.setup.order.shift();
            if (s.setup.order.length)
                s.setup.previewPlayer = s.setup.order[0];
            else
                revealInitial(s);
            return true;
        }
        if (c.type === 'lake-claim') {
            const claim = s.turn.claim, d = claim && s.districts[claim.district];
            need(s.turn.step === 'claim-lake' && claim.winner === p && d?.plan.recycleSealsOnClaim, '当前没有你的湖封印处理');
            need(typeof c.shuffle === 'boolean', '请选择是否洗回封印牌');
            if (c.shuffle) {
                for (const id of sealedOn(s, `district-host:${d.id}`))
                    move(s, id, 'deck');
                for (const pl of s.players)
                    shuffleCards(pl.deck);
            }
            ctx.finishRegionReturn(s);
            return true;
        }
        if (c.type === 'environment-trigger') {
            const a = s.triggerChoices.find(x => x.id === c.triggerId && x.controller === p && x.kind === 'environment-ability');
            need(a, '触发选择已改变');
            need(typeof c.fire === 'boolean', '请选择是否发动');
            if (c.fire) {
                const ids = c.targetIds ?? [];
                if (a.claimMobileTarget) {
                    need(ids.length === 1 && claimMobile(s, p, a).includes(ids[0]), '请选择赢取地区内的本方机动角色');
                    a.targets = [capture(s, { kind: 'card', cardId: ids[0] })];
                }
                else
                    need(ids.length === 0, '目标数量无效');
                pay(s, p, a.cost ?? 0);
                trigger(s, a);
            }
            s.triggerChoices = s.triggerChoices.filter(x => x.id !== a.id);
            ctx.resume(s);
            return true;
        }
        if (c.type === 'road-move') {
            hasPriority(s, p);
            standardAction(s, p);
            need(!s.effectChoice && !s.triggerChoices.length, '请完成当前选择');
            const l = s.locations[c.cardId];
            need(l?.zone === 'play' && !l.faceDown && hasCardType(s.cards[c.cardId], 'character') && controllerOf(s, c.cardId) === p && canTapCard(s, c.cardId) && !printedRulesCard(s, c.cardId).cannotMove && s.districts[l.district]?.plan.roadMove, '该角色没有可用的公路移动能力');
            need(Number.isInteger(c.district) && adjacentDistricts(s, l.district).includes(c.district) && s.districts[c.district], '只能选择相邻有效地区');
            need(canMoveToDistrict(s, c.cardId, c.district), '戒严禁止该角色移动进入目标地区');
            need(!abilitiesSuppressed(s, c.cardId), '本地区禁音使阻止角色发动能力');
            tapCard(s, c.cardId);
            s.flow = pushAbility(s.flow, p, { id: c.id, kind: 'environment-ability', controller: p, cardId: c.cardId, ops: [opRoadMove(c.cardId, l.zoneVersion, c.district)] });
            announce(s, p, null, c.id, c.id);
            return true;
        }
        if (c.type !== 'society-action' && c.type !== 'district-action')
            return false;
        hasPriority(s, p);
        need(!s.effectChoice && !s.triggerChoices.length, '请先完成当前选择');
        const source = c.type === 'society-action' ? s.societies?.[p] : s.districts[c.district], st = c.type === 'society-action' ? s.societyStates[p] : (source ? source.actionStates ??= {} : {});
        need(source, '能力来源不存在');
        const def = source.plan.actions?.find(a => a.id === c.abilityId);
        need(def, '能力尚未接入');
        if (def.timing !== 'fast')
            standardAction(s, p);
        const useKey = c.type === 'district-action' ? `${p}:${def.id}` : def.id, use = st.uses?.[useKey];
        need(!def.oncePerGame || !use, '该能力每局只能发动一次');
        need(!def.oncePerRound || use !== s.round, '该能力本回合已发动');
        if (def.actionPhaseOnly)
            need(s.turn.phase === 'action', '该能力只能在行动阶段发动');
        need(!def.tap || !st.tapped, '秘社已经横置');
        need(!def.requireCounter || (st.counters?.[def.requireCounter] ?? 0) > 0, '缺少所需秘社标志');
        need(!def.removeMarker || s.players[p].markers[def.removeMarker] > 0, '缺少额外费用标志');
        const targets = [def.target, def.secondTarget].filter(Boolean).map((kind, i) => { const options = choices(s, p, kind), x = options.find(x => x.id === c.targetIds?.[i]); need(x, '请选择合法目标'); return { ...capture(s, x), filter: kind, filterPlayer: p }; });
        need((c.targetIds ?? []).length === targets.length, '目标数量无效');
        const tapIds = c.tapIds ?? [], discardIds = c.discardIds ?? [], sealIds = c.sealIds ?? [];
        const costChars = def.tapDistrictCharacter ? allChars(s).filter(id => s.locations[id].district === c.district && canTapCard(s, id)) : def.tapCharacters ? chars(s, p).filter(id => canTapCard(s, id) && effectiveSubtypes(s, id).includes(def.tapCharacters.subtype)) : [];
        const tapCount = def.tapDistrictCharacter ? 1 : def.tapCharacters?.count ?? 0;
        need(unique(tapIds) && tapIds.length === tapCount && tapIds.every(id => costChars.includes(id)), '横置费用选择无效');
        need(unique(discardIds) && discardIds.length === (def.discard?.count ?? 0) && discardIds.every(id => s.players[p].hand.includes(id) && matches(s, id, def.discard)), '弃牌费用选择无效');
        const sealCount = def.sealedCost ?? def.graveSealCost ?? 0, sealCandidates = def.graveSealCost ? graveCards(s, p).filter(id => !s.cards[id].token) : sealedOn(s, `society:${p}`);
        need(unique(sealIds) && (def.graveSealCost ? sealIds.length === sealCount : sealedCostPaid(s, `society:${p}`, sealIds, sealCount)) && sealIds.every(id => sealCandidates.includes(id)), '封印/回底费用选择无效');
        if (def.sacrificeAsset)
            need(s.players[p].assets.some(a => a.id === c.assetId), '请选择牺牲资产');
        need((s.players[p].honor ?? 0) >= (def.honorCost ?? 0), '名誉点不足');
        const a = { id: c.id, kind: 'environment-ability', controller: p, cardId: source.id, displayName: source.name, ops: def.ops, targets, tappedCharacters: tapIds.map(id => ref(s, id)), discardedCost: discardIds.length ? s.cards[discardIds[0]].printedCost : 0, discardedCriminal: discardIds.some(id => effectiveSubtypes(s, id).includes('罪犯')) };
        s.flow = pushAbility(s.flow, p, a);
        const paidActionCost = actionCost(s, p, def);
        payActionFee(s, p, c, paidActionCost, { pay, eligible: c.type === 'society-action', blockedIds: tapIds, deferTap: true });
        changeHonor(s, p, -(def.honorCost ?? 0));
        const costGroup = `cost:${c.id}`;
        s.eventGroup = costGroup;
        if (def.tap)
            st.tapped = true;
        if (def.removeCounter)
            s.societyStates[p].counters[def.removeCounter]--;
        if (def.removeMarker)
            setCardMarker(s, s.players[p], 'markers', null, { ...s.players[p].markers, [def.removeMarker]: s.players[p].markers[def.removeMarker] - 1 });
        tapCostCards(s, p, [...tapIds, ...(c.actionPayments ?? []).map(x => x.cardId)]);
        discardMany(s, discardIds, move, event, { cause: 'cost' });
        (() => {
            for (const id of sealIds)
                def.graveSealCost ? seal(s, id, sealHost(s, `society:${p}`), null, { cause: 'cost' }) : move(s, id, 'deck', { cause: 'cost' });
        })();
        if (def.sacrificeAsset)
            move(s, c.assetId, 'graveyard', { cause: 'sacrifice' });
        delete s.eventGroup;
        st.uses ??= {};
        if (def.oncePerGame)
            st.uses[useKey] = true;
        if (def.oncePerRound)
            st.uses[useKey] = s.round;
        log(s, `${source.name}：${def.label}进入堆叠${paidCostsClause(s, paidActionCost, def, c)}${effectObjectsLog(s, targets)}。`);
        announce(s, p, null, c.id, tapIds.length || discardIds.length || sealIds.length || def.sacrificeAsset ? costGroup : null);
        return true;
    }
    function opRoadMove(id, version, district) { return { kind: 'road-move', id, version, district }; }
    function resolve(s, a) {
        if (a.kind !== 'environment-ability')
            return false;
        if (a.targets?.length && a.targets.every(t => !liveTarget(s, t))) {
            log(s, `${a.displayName}的全部目标失效，未产生效果。`);
            end(s, a);
            return true;
        }
        if (a.ops[0]?.kind === 'road-move') {
            const o = a.ops[0];
            if (s.locations[o.id]?.zone === 'play' && s.locations[o.id].zoneVersion === o.version && !s.locations[o.id].faceDown && !printedRulesCard(s, o.id).cannotMove && s.districts[o.district] && relocate(s, o.id, o.district))
                event(s, o.id, 'move', s.locations[o.id], a.id, { district: o.district });
            end(s, a);
            return true;
        }
        run(s, a, a.ops);
        return true;
    }
    function onEvent(s, id, ev, l, group) {
        if (!s.societies)
            return;
        for (const p of [0, 1]) {
            const source = s.societies[p], plan = source.plan;
            if (ev === 'prepare' && s.round === 1 && plan.firstPrepare && !s.societyStates[p].firstPrepared) {
                s.societyStates[p].firstPrepared = true;
                emit(s, p, source, plan.firstPrepare, group, false, { event: 'prepare' });
            }
            if (ev === 'prepare' && id === source.id && plan.prepare?.length)
                emit(s, p, source, plan.prepare, group, true, { event: 'prepare', sourceVersion: l.zoneVersion, sourceFace: source.catalogId, chooseTriggerOrder: true });
            if (ev === 'death' && !l.faceDown && hasCardType(s.cards[id], 'character') && (l.controller ?? s.cards[id].owner) === p && plan.hostDeathRelease && effectiveSubtypes(s, id).includes('宿主'))
                emit(s, p, source, [{ kind: 'host-death-release', district: l.district, prepaid: plan.hostDeathReleaseCost !== undefined }], group, false, { event: 'death', cost: plan.hostDeathReleaseCost ?? 0 });
            if (ev === 'cast' && controllerOf(s, id) === p && s.cards[id].subtypes?.includes('法术') && plan.castSpellPredict)
                emit(s, p, source, [{ kind: 'predict', count: s.societyStates[p].counters.divination ?? 0 }], group);
        }
    }
    function leaving(s, id, l, zone) {
        if (!s.societies || l.zone !== 'play' || l.faceDown || !hasCardType(s.cards[id], 'character'))
            return;
        const p = controllerOf(s, id), source = s.societies[p], group = s.eventGroup ?? uuid();
        if (source.plan.bloodLeaveReplacement || source.catalogId === 'MSBQ01') {
            const ids = Object.keys(s.locations).filter(aid => s.locations[aid].zone === 'play' && s.locations[aid].attachedTo === id && s.locations[aid].hostVersion === l.zoneVersion && s.cards[aid].name === '鲜血' && !s.regionReturnIds?.includes(aid));
            for (const aid of ids) {
                if (continuousDecision(s, `dragon-blood:${id}:${l.zoneVersion}:${aid}:${s.locations[aid].zoneVersion}`, { kind: 'dragon-blood-seal', controller: p, sourceName: source.name, hostName: s.cards[aid].name })) {
                    seal(s, aid, sealHost(s, `society:${p}`));
                }
            }
        }
    }
    function prepare(s) {
        if (!s.societies)
            return;
        for (const st of s.societyStates)
            st.tapped = false;
        const group = `round:${s.round}:prepareTrigger`;
        for (const p of [0, 1])
            onEvent(s, `society:${p}`, 'prepare', s.locations[`society:${p}`], group);
    }
    function claimEvent(s, d, winner) {
        if (!s.societies)
            return;
        const plan = societyPlan(s, winner);
        if (plan.drawDestroyedClaim && d.destroyed)
            emit(s, winner, s.societies[winner], [{ kind: 'draw', count: 1 }], uuid());
        if (plan.claimDrawCost !== undefined)
            emit(s, winner, s.societies[winner], [{ kind: 'draw', count: 1 }], uuid(), false, { event: 'region-won', cost: plan.claimDrawCost });
        if (plan.claimMobileReturn)
            emit(s, winner, s.societies[winner], [{ kind: 'claim-mobile-return' }], uuid(), false, { event: 'region-won', sourceDistrict: d && s.districts.indexOf(d), sourceDistrictCardId: d.id, cost: 1, claimMobileTarget: true });
        if (plan.beforeWorldLook && s.worldDeck.length)
            chooser(s, { id: uuid(), kind: 'environment-ability', controller: winner, cardId: s.societies[winner].id }, { player: winner }, [], 'world-claim-preview', [], { previewId: s.worldDeck[0].id });
    }
    function win(s, d, winner, district) {
        if (d.plan?.win?.length)
            emit(s, winner, d, d.plan.win, uuid(), !!d.plan.winMandatory, { district });
    }
    function afterHidden(s) {
        const a = s.environmentHidden;
        if (!a)
            return false;
        delete s.environmentHidden;
        run(s, a.job, a.ops);
        return true;
    }
    function conditions(s, group = uuid()) {
        if (!s.societies || s.status !== 'playing')
            return;
        for (const p of [0, 1]) {
            const source = s.societies[p], def = source?.plan?.stateTrigger;
            if (!def)
                continue;
            const st = s.societyStates?.[p], l = s.locations[source.id];
            if (!st || !l)
                continue;
            const stamp = source.catalogId + ':' + l.zoneVersion, met = chars(s, p).filter(id => effectiveSubtypes(s, id).includes(def.subtype)).length >= def.count;
            if (!met) {
                delete st.stateTriggerStamp;
                continue;
            }
            if (st.stateTriggerStamp === stamp)
                continue;
            st.stateTriggerStamp = stamp;
            emit(s, p, source, [{ kind: 'transform-society', toFace: def.toFace }], group, true, { event: 'state-condition', sourceVersion: l.zoneVersion, sourceFace: source.catalogId, chooseTriggerOrder: true });
        }
    }
    function stateActions(s) {
        if (s.societies?.some(c => c.plan.destroyAtFourTime))
            for (const [i, d] of s.districts.entries())
                if (d && districtTimeMarkers(s, i) >= 4)
                    d.destroyed = 1;
    }
    function view(s, p) {
        if (!s.societies)
            return {};
        const a = s.effectChoice?.kind === 'environment' ? seatChoice(s.effectChoice, p) : null;
        let decision = null;
        if (a) {
            const multi = a.controllers?.includes(p), done = a.simultaneous ? !!a.done : multi && (a.mode === 'setup-secret' ? s.setup.choices[p] !== null : a.committed[p] !== null), allowed = a.simultaneous ? !!a.allowed : a.controller === p || multi && !done;
            let ids = a.cardIds;
            if (a.mode === 'setup-secret')
                ids = s.players[p].deck.filter(id => matches(s, id, societyPlan(s, p).beforeHandSecret?.filter));
            if (a.mode === 'simultaneous-search')
                ids = s.players[p].deck.filter(id => matches(s, id, a.operation.filter));
            decision = { predictionObserver: predictionView(s, a, p), id: a.id, mode: a.mode, controller: a.controller, controllers: a.controllers, simultaneous: !!a.simultaneous, done, allowed, min: a.mode === 'setup-secret' || a.mode === 'simultaneous-search' ? 0 : a.min ?? 0, max: a.mode === 'setup-secret' ? 5 : a.mode === 'simultaneous-search' ? 1 : a.max ?? 1, options: a.options, distinctNames: a.mode === 'setup-secret', cards: allowed || a.public ? ids.map(id => id.startsWith('district:') ? { id, name: s.districts[Number(id.slice(9))].name } : a.mode === 'attachment-host' ? { id, name: a.hostOptions.find(x => x.id === id)?.name } : s.locations[id]?.faceDown && controllerOf(s, id) !== p && a.mode !== 'inspect' ? { id, name: '暗藏者', faceDown: true, ownerName: s.seats[s.cards[id].owner].name } : { ...identity(s, id), ...(a.mode === 'inspect' && s.locations[id]?.secretPlan ? { name: s.cards[id].name, displayName: s.cards[id].displayName, text: s.cards[id].text } : {}) }) : [], private: !a.public, eligibleIds: allowed ? a.eligibleIds : undefined };
        }
        const actions = (source, st, district) => source.plan.actions?.map(def => ({ ...def, cost: actionCost(s, p, def), targetOptions: def.target ? choices(s, p, def.target, district) : [], secondTargetOptions: def.secondTarget ? choices(s, p, def.secondTarget, district) : [], tapOptions: def.tapDistrictCharacter ? allChars(s).filter(id => s.locations[id].district === district && !s.locations[id].tapped).map(id => ({ id, name: s.cards[id].name })) : def.tapCharacters ? chars(s, p).filter(id => canTapCard(s, id) && effectiveSubtypes(s, id).includes(def.tapCharacters.subtype)).map(id => ({ id, name: s.cards[id].name })) : [], discardOptions: def.discard ? s.players[p].hand.filter(id => matches(s, id, def.discard)).map(id => ({ id, name: s.cards[id].name })) : [], sealOptions: def.sealedCost || def.graveSealCost ? (def.graveSealCost ? graveCards(s, p).filter(id => !s.cards[id].token) : sealedOn(s, `society:${p}`)).map(id => ({ id, name: s.cards[id].name, costWeight: def.graveSealCost ? 1 : sealedCardWeight(s, `society:${p}`, id) })) : [], used: !!(def.oncePerGame && st.uses?.[def.id] || def.oncePerRound && st.uses?.[district === undefined ? def.id : `${p}:${def.id}`] === s.round) })) ?? [];
        return { ownRealityTop: realitySociety(s, p) ? s.players[p].deck.slice(0, 7).map(id => ({ ...identity(s, id), isReal: realityCard(s, id) })) : undefined, societies: s.societies.map((c, i) => ({ ...c, ...splitCardRules(c.text, c.faq), tapped: s.societyStates[i].tapped, counters: s.societyStates[i].counters, pending: c.plan.pending ?? [], actions: i === p ? actions(c, s.societyStates[i]) : [] })), environmentChoice: decision, environmentTriggers: s.triggerChoices.filter(a => a.kind === 'environment-ability').map(a => ({ id: a.id, controller: a.controller, name: a.displayName, mandatory: a.mandatory, cost: a.cost ?? 0, ops: a.ops, targetOptions: a.claimMobileTarget && a.controller === p ? claimMobile(s, p, a).map(id => ({ id, name: s.cards[id].name })) : [], requiresTarget: !!a.claimMobileTarget })), districtActions: s.districts.flatMap((d, i) => d ? [{ district: i, name: d.name, actions: actions(d, d.actionStates ?? {}, i) }] : []), worldPreview: s.setup?.stage === 'before-world' && s.setup.previewPlayer === p && s.setup.choices[p] === null || a?.mode === 'world-claim-preview' && a.controller === p ? { name: s.worldDeck[0]?.name, text: s.worldDeck[0]?.text } : null, lakeClaim: s.turn.step === 'claim-lake' ? { winner: s.turn.claim.winner } : null };
    }
    function phaseStart(s) {
        const players = [s.turn.firstPlayer, 1 - s.turn.firstPlayer].filter(p => realitySociety(s, p));
        if (!players.length)
            return false;
        run(s, { id: uuid(), kind: 'environment-ability', cardId: s.societies[players[0]].id, controller: players[0], phaseBegin: true }, players.map(player => ({ kind: 'reality-phase', player })));
        return true;
    }
    return { payOfferedTrigger, initialize, reveal, resolve, command, view, phaseStart, event: onEvent, leaving, prepare, win, claimEvent, stateActions, conditions, afterHidden };
}
