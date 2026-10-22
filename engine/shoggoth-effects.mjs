import { changeHonor } from './player-resources.mjs';
import { rememberHardDeckCards } from './hard-bot-library.mjs';
import { resetCard } from './reset.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { addWounds } from './wounds.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { scoredTasks, adjacentDistricts } from './task-districts.mjs';
import { unusedCommandModes } from './multi-mode.mjs';
import { simultaneousChoice, commitChoice, withSimultaneousDepartures } from './simultaneous-choice.mjs';
import { RuleError, societyMarkers } from './core.mjs';
import { uuid, randomValues } from './random.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { controllerOf } from './ownership.mjs';
import { hasCardType } from './card-types.mjs';
import { coreRole, coreRoles, coreArea, coreRest, shoggothSociety } from './shoggoth-rules.mjs';
import { cardHasKeyword, sacrificeEffectBlocked, enterTapped, takeControl, effectiveSubtypes } from './derived.mjs';
import { tapCard } from './field-events.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { districtTraits, relocate } from './district-rules.mjs';
import { graveCards, inGrave } from './graveyard-rules.mjs';
import { continuousDecision } from './death-costs.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const chars = (s, p) => s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character'));
const field = (s, p) => s.players[p].play.filter(id => s.locations[id]?.zone === 'play');
const rand = n => {
    const limit = 0x100000000 - 0x100000000 % n;
    let x;
    do {
        x = randomValues(new Uint32Array(1))[0];
    } while (x >= limit);
    return x % n;
};
export function createShoggothEffects(ctx) {
    const { move, event, draw, choose, finishSpell, emit, log, options, prepare, live, destroy, hurt, librarySearchBlocked, shuffle, deter, stateBased, observeTargets } = ctx;
    const honor = (s, p, n) => { changeHonor(s, p, n); log(s, `${s.seats[p].name}获得${n}名誉点。`); };
    const districts = s => s.districts.flatMap((d, i) => d ? [i] : []);
    const markedDistricts = (s, p) => [...new Set(chars(s, p).filter(id => coreRole(s, id, p) || s.cards[id].name === '触手').map(id => s.locations[id].district))];
    const sacrifice = (s, p) => chars(s, p).filter(id => !sacrificeEffectBlocked(s, id));
    const coreAvailable = (s, p) => { const id = s.selectedCoreIds?.[p], l = s.locations[id]; return id && ((l?.zone === 'core' && l.corePlayer === p) || (l?.zone === 'play' && !l.faceDown && controllerOf(s, id) === p)) && !abilitiesSuppressed(s, id) ? id : null; };
    function initialize(s) {
        s.coreAreas = [null, null];
        s.selectedCoreIds = [null, null];
        for (const p of [0, 1])
            if (shoggothSociety(s, p)) {
                const def = s.deckSelections?.[p]?.core ?? s.automationCards.find(c => c.catalogId === (s.deckSelections?.[p]?.choices?.coreId ?? s.labCoreIds?.[p]));
                need(def?.subtitle === '修格斯' && def.automation?.coreAbility, '请选择已接入的修格斯核心角色');
                const areaId = `core-area:${p}`, template = s.reserveTemplates.find(c => c.catalogId === 'TK011') ?? s.automationCards.find(c => c.catalogId === 'TK011');
                need(template, '缺少修格斯核心区资料');
                const area = { ...structuredClone(template), id: areaId, owner: p, type: 'core-area' };
                s.cards[areaId] = area;
                s.locations[areaId] = { zone: 'core-area', zoneVersion: 0, controller: p, counters: { rest: 0 } };
                s.coreAreas[p] = s.locations[areaId];
                s.coreAreas[p].id = areaId;
                s.players[p].core = [];
                const id = uuid();
                s.cards[id] = { ...structuredClone(def), id, owner: p };
                s.locations[id] = { zone: 'core', zoneVersion: 0, corePlayer: p };
                s.players[p].core.push(id);
                s.selectedCoreIds[p] = id;
                log(s, `${s.seats[p].name}的核心角色${def.name}放入核心区。`);
            }
    }
    function enter(s, id, p, d, group) {
        if (!s.districts[d])
            return false;
        if (!move(s, id, 'play', { controller: p, district: d, tapped: enterTapped(s, id, d) }))
            return false;
        event(s, id, 'entry', s.locations[id], group, { method: 'effect-placement' });
        return true;
    }
    function spawn(s, p, d, group) { const t = s.reserveTemplates.find(c => c.catalogId === 'TK010') ?? s.automationCards.find(c => c.name === '触手'); need(t?.name === '触手', '缺少触手指示物资料'); const id = uuid(); s.cards[id] = { ...structuredClone(t), id, owner: p }; s.locations[id] = { zone: 'reserve', zoneVersion: 0 }; enter(s, id, p, d, group); return id; }
    function invocation(s, a, count = 1, optional = false) {
        const id = coreAvailable(s, a.controller);
        if (!id) {
            log(s, '核心角色不在本方场上或核心区，本次不能发动核心能力。');
            finishSpell(s, a);
            return;
        }
        const plan = { ...printedRulesCard(s, id).automation.coreAbility, sourceId: id, sourceZoneVersion: s.locations[id].zoneVersion, sourceDistrict: s.locations[id].district, abilityLabel: '核心能力' };
        const choices = options(s, a.controller, plan);
        if (plan.target !== 'none' && !choices.length) {
            if (count > 1)
                invocation(s, a, count - 1);
            else
                finishSpell(s, a);
            return;
        }
        choose(s, a, 'shoggoth-invoke', a.controller, [], { coreId: id, coreVersion: s.locations[id].zoneVersion, corePlan: plan, options: choices, remainingCore: count, canSkip: optional, choiceLabel: `${s.cards[id].name} · 发动核心能力`, public: true });
    }
    function finishInvocation(s, a, remaining) {
        if (remaining > 1)
            invocation(s, a, remaining - 1);
        else {
            if ((a.plan.modeTargets?.[a.mode]?.deterAfter ?? a.plan.deterAfter) && deter(s, a, a.plan.modeTargets?.[a.mode]?.deterAfter ?? a.plan.deterAfter))
                return;
            finishSpell(s, a);
        }
    }
    function missionMove(s, a, plan) {
        const d = plan.sourceDistrict;
        if (s.districts[d]?.id !== plan.sourceDistrictCardId)
            return false;
        const ids = coreRoles(s, a.controller).filter(id => s.locations[id].district !== d);
        return pick(s, a, 'mission-move', ids, { destination: d, destinationCardId: plan.sourceDistrictCardId, canSkip: true, choiceLabel: '是否将一个本方核心角色移动至任务地区' });
    }
    function pick(s, a, kind, ids, extra = {}) {
        if (!ids.length && !extra.force)
            return false;
        choose(s, a, `shoggoth-${kind}`, extra.controller ?? a.controller, ids, { public: true, ...extra });
        return true;
    }
    function buff(s, id, kind, extra = {}) { s.effects.push({ kind, targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: 'until-end-of-round', ...extra }); }
    function counter(s, id, key, n = 1) { const l = s.locations[id]; l.counters ??= {}; setCardMarker(s, l, "counter", key, (l.counters[key] ?? 0) + n); }
    function effect(s, a, plan, targets) {
        const p = a.controller, id = targets[0]?.cardId, d = targets[0]?.district, op = plan.operation;
        if (op === 'replace-core') {
            const core = s.selectedCoreIds?.[p], l = s.locations[core];
            if (l?.zone === 'core' && l.corePlayer === p) {
                const options = s.automationCards.filter(c => hasCardType(c, 'character') && c.subtitle === '修格斯' && c.automation?.coreAbility && !c.token && c.catalogId !== s.cards[core].catalogId).map(c => ({ id: c.catalogId, name: c.name, text: c.text }));
                if (options.length) {
                    choose(s, a, 'shoggoth-replace-core', p, [], { oldCoreId: core, oldCoreVersion: l.zoneVersion, options, public: true, choiceLabel: '古语专家佩德罗 · 选择新的核心角色' });
                    return true;
                }
            }
        }
        else if (op === 'pedro-honor-draw') {
            choose(s, a, 'shoggoth-pay-honor', p, [], { choiceLabel: '古语专家佩德罗 · 是否支付1名誉并抓牌' });
            return true;
        }
        else if (op === 'basic-core-move' || op === 'basic-core-defense') {for(const id of coreRoles(s,p)){if(op==='basic-core-move'){resetCard(s,id);relocate(s,id,d,{event,group:a.id});}else buff(s,id,'modify-defense',{amount:1});}if(op==='basic-core-defense')draw(s,[p],1);}
        else if (op === 'task-influence') {
            const inf = s.districts[d].influence;
            if (inf[1 - p])
                inf[1 - p]--;
            else
                inf[p]++;
        }
        else if (op === 'gas-station-move') {
            if (s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId)
                relocate(s, id, plan.sourceDistrict, { event, group: a.id });
        }
        else if (op === 'hideout-place-core') {
            const core = s.selectedCoreIds?.[p], l = s.locations[core];
            if (l?.zone === 'core' && l.corePlayer === p && s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId)
                enter(s, core, p, plan.sourceDistrict, a.id);
        }
        else if (op === 'hideout-core-hand') {
            const core = s.selectedCoreIds?.[p], l = s.locations[core];
            if (l?.zone === 'core' && l.corePlayer === p) {
                choose(s, a, 'shoggoth-core-hand', p, [core], { coreVersion: l.zoneVersion, canSkip: true, choiceLabel: '佩德罗的藏身处 · 是否将核心区中的核心置于手中' });
                return true;
            }
        }
        else if (op === 'mask-mill') {
            for (const cardId of s.players[p].deck.slice(0, 2))
                move(s, cardId, 'graveyard');
        }
        else if (op === 'research-zombies') {
            const ids = field(s, p).filter(id => !s.locations[id].faceDown && !s.locations[id].tapped && hasCardType(printedRulesCard(s, id), 'attachment') && effectiveSubtypes(s, id).includes('研究'));
            choose(s, a, 'shoggoth-research-zombies', p, ids, { destination: targets[0], max: ids.length, choiceLabel: '失控的小镇 · 选择横置的本方研究附属', public: true });
            return true;
        }
        else if (op === 'undead-influence') {
            const n = chars(s, p).filter(id => s.locations[id].district === d && effectiveSubtypes(s, id).includes('不死生物')).length, inf = s.districts[d].influence, remove = Math.min(n, inf[1 - p]);
            inf[1 - p] -= remove;
            inf[p] += n - remove;
        }
        else if (op === 'mission-search') {
            if (librarySearchBlocked(s)) {
                shuffle(s.players[p].deck);
                return false;
            }
            const ids = s.players[p].deck.filter(id => hasCardType(s.cards[id], 'task'));
            if (pick(s, a, 'mission-search', ids, { public: false, canFail: true, choiceLabel: '接头线人 · 检索任务牌放置进场' }))
                return true;
            shuffle(s.players[p].deck);
        }
        else if (op === 'mission-move') {
            if (missionMove(s, a, plan))
                return true;
        }
        else if (op === 'mission-hidden') {
            if (ctx.startHidden(s, a.id, a))
                return true;
        }
        else if (op === 'mission-contact') {
            const l = s.locations[plan.sourceId], d = s.districts[plan.eventDistrict];
            if (l?.zone === 'play' && l.zoneVersion === plan.sourceZoneVersion && !sacrificeEffectBlocked(s, plan.sourceId) && d?.id === plan.eventDistrictCardId) {
                if (move(s, plan.sourceId, 'graveyard', { cause: 'sacrifice' }) && s.locations[plan.sourceId].zone !== 'play') {
                    const inf = d.influence;
                    if (inf[1 - p])
                        inf[1 - p]--;
                    else
                        inf[p]++;
                }
            }
        }
        else if (op === 'mission-core-one') {
            const id = s.selectedCoreIds?.[p], l = s.locations[id];
            if (l?.zone === 'core' && l.corePlayer === p && s.districts[0]) {
                choose(s, a, 'shoggoth-mission-place-core', p, [], { enterId: id, enterVersion: l.zoneVersion, choiceLabel: '冰封古陵寝 · 是否从核心区放置进场' });
                return true;
            }
            const ids = coreRoles(s, p);
            if (pick(s, a, 'mission-shield', ids, { choiceLabel: '冰封古陵寝 · 给一个本方核心角色放护盾' }))
                return true;
        }
        else if (op === 'copy-command') {
            const original = s.flow.stack.find(x => x.id === targets[0]?.entryId);
            if (original) {
                const modes = unusedCommandModes(original), corePlan = { ...original.plan, modes };
                choose(s, a, 'shoggoth-copy-command', p, [], { corePlan, originalEntryId: original.id, options: options(s, p, { ...corePlan, selectedMode: null }), choiceLabel: '潜能激发 · 选择原命令未选的另一项', public: true });
                return true;
            }
        }
        else if (op === 'hugo-return') {
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && l.zoneVersion === plan.sourceZoneVersion) {
                if (move(s, plan.sourceId, 'deck') && s.locations[plan.sourceId]?.zone === 'deck') {
                    const owner = s.cards[plan.sourceId].owner;
                    s.players[owner].deck = s.players[owner].deck.filter(id => id !== plan.sourceId);
                    s.players[owner].deck.unshift(plan.sourceId);
                }
            }
        }
        else if (op === 'hugo-damage') {
            if (s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId) {
                for (const role of s.players.flatMap(pl => [...pl.play]))
                    if (s.locations[role]?.district === plan.sourceDistrict && !s.locations[role].faceDown && hasCardType(s.cards[role], 'character'))
                        hurt(s, role, 1);
            }
        }
        else if (op === 'hugo-destroy') {
            if (s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId)
                s.districts[plan.sourceDistrict].destroyed = 1;
        }
        else if (op === 'hugo-assets') {
            const choices = [0, 1].map(controller => ({ controller, cardIds: s.players[controller].assets.map(c => c.id).filter(id => !sacrificeEffectBlocked(s, id)), min: 1, max: 1 }));
            if (simultaneousChoice(s, choose, a, 'shoggoth-assets', choices, { choiceLabel: '双方同时选择牺牲一个资产' }))
                return true;
        }
        else if (op === 'time-apparatus') {
            const top = s.players[p].deck[0];
            if (top) {
                log(s, `${s.seats[p].name}展示牌库顶牌：${s.cards[top].name}。`);
                rememberHardDeckCards(s, [top]);
                if (hasCardType(s.cards[top], 'character')) {
                    choose(s, a, 'shoggoth-time-apparatus', p, [top], { destination: targets[0], cardVersion: s.locations[top].zoneVersion, choiceLabel: '雨果的溯时装置 · 是否将展示角色放置进场', public: true });
                    return true;
                }
            }
        }
        else if (op === 'pitt-pay' || op === 'steal-secrecy') {
            choose(s, a, 'shoggoth-pay-two', op === 'pitt-pay' ? 1 - p : targets[0].player, [], { operation: op, choiceLabel: op === 'pitt-pay' ? '皮特·冈萨雷斯 · 是否额外支付2' : '数据窃取者 · 是否支付2', public: true });
            return true;
        }
        else if (op === 'self-conceal') {
            const l = s.locations[a.cardId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.sourceZoneVersion)
                ctx.conceal(s, a.cardId, a.id);
        }
        else if (op === 'species-control') {
            const l = s.locations[plan.subjectId];
            if (s.locations[a.cardId]?.zone === 'play' && s.locations[a.cardId].zoneVersion === plan.sourceZoneVersion && !sacrificeEffectBlocked(s, a.cardId)) {
                const before = s.locations[a.cardId].zoneVersion;
                if (move(s, a.cardId, 'graveyard', { cause: 'sacrifice' }) && s.locations[a.cardId].zoneVersion !== before && l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.subjectZoneVersion && s.cards[plan.subjectId].printedCost > s.players[controllerOf(s, plan.subjectId)].assets.length)
                    destroy(s, plan.subjectId);
            }
        }
        else if (op === 'mind-sync') {const host=plan.hostAttachment,l=s.locations[host];if(l?.zone==='play'&&!l.faceDown&&l.zoneVersion===plan.hostAttachmentVersion){if(a.mode==='control'){if((l.counters?.locked??0)>0&&!cardHasKeyword(s,host,'永恒'))takeControl(s,host,p,{sourceId:a.cardId,sourceZoneVersion:plan.sourceZoneVersion,shoggothControl:true});}else {counter(s,host,'locked');event(s,host,'locked',l,a.id,{operator:p});}}if(a.mode!=='control')draw(s,[p],1);}
        else if (op === 'cluster-search') {
            if (!librarySearchBlocked(s)) {
                const n = plan.chosenX ?? 0, ids = s.players[p].deck.filter(id => hasCardType(s.cards[id], 'character') && s.cards[id].printedCost === n && s.cards[id].subtypes?.some(t => ['士兵', '工程师', '机械'].includes(t)));
                choose(s, a, 'shoggoth-cluster-search', p, ids, { canFail: true, public: false, sourceDistrict: plan.sourceDistrict, sourceDistrictCardId: plan.sourceDistrictCardId, choiceLabel: `伊尔级战斗集群 · 检索印刷费用${n}的角色` });
                return true;
            }
            shuffle(s.players[p].deck);
        }
        else if (op === 'mission-victory') {
            ctx.finish(s, p, '赢得三张或更多任务牌');
            return true;
        }
        if (op === 'invoke-core') {
            invocation(s, a, plan.count ?? 1);
            return true;
        }
        if (op === 'core-return') {
            const l = s.locations[plan.subjectId];
            if (!s.cards[plan.subjectId].token && l && l.zoneVersion === plan.departedVersion && l.zone !== 'core' && coreArea(s, p)) {
                move(s, plan.subjectId, 'core', { corePlayer: p });
                setCardMarker(s, coreArea(s, p), "counter", "rest", (coreRest(s, p)) + 1);
                log(s, '核心角色返回核心区，放置一个休整标志。');
            }
        }
        else if (op === 'red-counter') {
            const st = s.societyStates[p];
            setCardMarker(s, st, "counter", '失控', Math.min(3, (st.counters['失控'] ?? 0) + 1));
        }
        else if (op === 'honor')
            honor(s, p, plan.count ?? 1);
        else if (op === 'mission-honor') {
            draw(s, [p], 1);
            honor(s, p, 1);
        }
        else if (op === 'spawn-random') {
            const ds = districts(s);
            if (ds.length)
                spawn(s, p, ds[rand(ds.length)], a.id);
        }
        else if (op === 'core-sacrifice') {
            if (pick(s, a, 'sacrifice', sacrifice(s, p), { operation: op, after: plan.after, choiceLabel: '核心能力 · 选择本方角色牺牲' }))
                return true;
        }
        else if (op === 'damage')
            hurt(s, id, plan.amount ?? 1);
        else if (op === 'district-lock') {
            if (s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId)
                for (const id of [...field(s, 1 - p)])
                    if (s.locations[id].district === plan.sourceDistrict && (s.locations[id].faceDown || hasCardType(s.cards[id], 'character'))) {
                        counter(s, id, 'locked');
                        event(s, id, 'locked', s.locations[id], a.id, { operator: p });
                    }
        }
        else if (op === 'hidden-sentinel-lock') {
            if (s.societies?.[p]?.name === '哨兵') {
                counter(s, id, 'locked');
                event(s, id, 'locked', s.locations[id], a.id, { operator: p });
            }
        }
        else if (op === 'lock-only') {
            counter(s, id, 'locked');
            event(s, id, 'locked', s.locations[id], a.id, { operator: p });
        }
        else if (op === 'core-lock') {
            counter(s, id, 'locked');
            event(s, id, 'locked', s.locations[id], a.id, { operator: p });
            if (deter(s, a, 1))
                return true;
        }
        else if (op === 'core-predict') {
            choose(s, a, 'predict', p, s.players[p].deck.slice(0, 3), { choiceLabel: '核心能力 · 预测3' });
            return true;
        }
        else if (op === 'spike-core') {
            if (a.mode === 'control') {
                if (s.locations[id].markers >= 3 && !cardHasKeyword(s, id, '永恒'))
                    takeControl(s, id, p, { duration: 'until-end-of-round' });
            }
            else
                setCardMarker(s, s.locations[id], "markers", null, (s.locations[id].markers ?? 0) + 1);
        }
        else if (op === 'deck-bottom-hand') {
            const id = s.players[p].deck.at(-1);
            if (id)
                move(s, id, 'hand');
        }
        else if (op === 'locked-execution') {
            if (id) {
                destroy(s, id);
                honor(s, p, 1);
            }
        }
        else if (op === 'ebeniya-sacrifice') {
            const q = 1 - p, ids = field(s, q).filter(id => !s.locations[id].faceDown && ['character', 'attachment'].some(t => hasCardType(s.cards[id], t)) && !sacrificeEffectBlocked(s, id));
            if (pick(s, a, 'enemy-sacrifice', ids, { controller: q, choiceLabel: '牺牲一个本方角色或附属' }))
                return true;
        }
        else if (op === 'remove-rest') {
            const area = coreArea(s, p);
            if (area)
                setCardMarker(s, area, "counter", "rest", Math.max(0, coreRest(s, p) - 1));
        }
        else if (op === 'corrector-barrier') {
            if (s.locations[a.cardId]?.zone === 'play' && s.locations[a.cardId].zoneVersion === plan.sourceZoneVersion)
                buff(s, a.cardId, 'barrier');
        }
        else if (op === 'core-reset-knife') {for(const core of coreRoles(s,p)){resetCard(s,core);counter(s,core,'battle');}}
        else if (op === 'sacrifice-honor') {
            if (pick(s, a, 'sacrifice', sacrifice(s, p), { after: 'honor4', choiceLabel: '吞噬蔓延 · 牺牲一个本方角色' }))
                return true;
        }
        else if (op === 'core-mobility') {
            for (const id of chars(s, p))
                if (coreRole(s, id, p) || s.cards[id].name === '触手')
                    buff(s, id, 'grant-keyword', { keyword: '机动' });
            honor(s, p, 1);
        }
        else if (op === 'spawn-target') {
            spawn(s, p, d, a.id);
            if (plan.missionInfluence && s.districts[d].owner === p && hasCardType(s.districts[d], 'task')) {
                const inf = s.districts[d].influence;
                if (inf[1 - p])
                    inf[1 - p]--;
                else
                    inf[p]++;
            }
        }
        else if (op === 'genesis') {
            const n = plan.sourceCounters?.progress ?? 0, ids = s.players[p].deck.slice(0, n);
            choose(s, a, 'shoggoth-genesis', p, ids, { eligibleIds: ids.filter(id => hasCardType(s.cards[id], 'character') && s.cards[id].printedCost <= n), destination: a.targets[0], public: false, choiceLabel: '计划：创世纪 · 可放置一个角色，其余随机置底' });
            return true;
        }
        else if (op === 'rampage') {
            const ds = markedDistricts(s, p);
            for (const id of [...field(s, 0), ...field(s, 1)])
                if (ds.includes(s.locations[id].district) && (s.locations[id].faceDown || hasCardType(s.cards[id], 'character')) && !coreRole(s, id))
                    destroy(s, id);
            if (s.societyStates?.[p])
                setCardMarker(s, s.societyStates[p], "counter", '失控', 3);
        }
        else if (op === 'place-core-random') {
            const id = s.selectedCoreIds?.[p], l = s.locations[id], ds = districts(s);
            if (l?.zone === 'core' && l.corePlayer === p && ds.length)
                enter(s, id, p, ds[rand(ds.length)], a.id);
        }
        else if (op === 'core-shield')
            {for(const core of coreRoles(s,p))counter(s,core,'shield');}
        else if (op === 'lock-draw') {
            counter(s, id, 'locked');
            event(s, id, 'locked', s.locations[id], a.id, { operator: p });
            draw(s, [p], 1);
        }
        else if (op === 'eye-predict') {
            counter(s, id, 'investigation');
            choose(s, a, 'predict', p, s.players[p].deck.slice(0, 2), { choiceLabel: '信息灌注 · 预测2' });
            return true;
        }
        else if (op === 'hidden-command' || op === 'iteration-hidden') {
            if (!ctx.startHidden(s, a.id, a)) {
                finishSpell(s, a);
                return true;
            }
            if (s.hidden)
                s.hidden.cardBonus = { controller: p, ...(plan.bonusSubtype ? { subtypes: [plan.bonusSubtype] } : { faction: '灰' }), amount: plan.bonus ?? 3 };
            if (plan.honor)
                honor(s, p, plan.honor);
            return true;
        }
        else if (op === 'myth-conceal' || op === 'myth-return') {
            const ds = markedDistricts(s, p);
            for (const id of [...field(s, 0), ...field(s, 1)])
                if (ds.includes(s.locations[id].district)) {
                    if (op === 'myth-conceal' && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character'))
                        ctx.conceal(s, id, a.id);
                    else if (op === 'myth-return' && s.locations[id].faceDown)
                        move(s, id, 'hand');
                }
            if (deter(s, a, 1))
                return true;
        }
        else if (op === 'core-plan') {if(s.locations[plan.sourceId]?.zone==='play'&&s.locations[plan.sourceId].zoneVersion===plan.sourceZoneVersion)move(s,plan.sourceId,'graveyard',{cause:'sacrifice'});const id=s.selectedCoreIds?.[p];if(s.locations[id]?.zone==='core'&&s.locations[id].corePlayer===p&&enter(s,id,p,d,a.id)){choose(s,a,'shoggoth-shield-optional',p,[],{roleId:id,roleVersion:s.locations[id].zoneVersion,choiceLabel:'计划：修格斯 · 是否放置一个护盾标志'});return true;}}
        else if (op === 'officer') {const n=s.societyStates?.[p]?.counters['失控']??0;if(n>0){if(s.locations[a.cardId]?.zone==='play'&&s.locations[a.cardId].zoneVersion===plan.sourceZoneVersion)addWounds(s,a.cardId,1,{event,group:a.id});setCardMarker(s,s.societyStates[p],"counter",'失控',n-1);choose(s,a,'shoggoth-draw-optional',p,[],{choiceLabel:'决绝的士官 · 是否抓一张牌'});return true;}}
        else if (op === 'enemy-conceal') {
            const q = targets[0]?.player, ids = chars(s, q);
            if (pick(s, a, 'conceal', ids, { controller: q, choiceLabel: '选择一个本方角色潜伏' }))
                return true;
            honor(s, p, 1);
        }
        else if (op === 'core-protect') {for(const core of coreRoles(s,p)){buff(s,core,'modify-defense',{amount:1});buff(s,core,'barrier');}}
        else if (op === 'water-lock') {
            for (const id of field(s, 1 - p))
                if (districtTraits(s, s.locations[id].district).includes('水域') && (s.locations[id].faceDown || hasCardType(s.cards[id], 'character'))) {
                    counter(s, id, 'locked');
                    event(s, id, 'locked', s.locations[id], a.id, { operator: p });
                }
            honor(s, p, 2);
        }
        else if (op === 'synchronise-counters') {
            const ids = coreRoles(s, p);
            if (pick(s, a, 'copy-counters', ids, { choiceLabel: '迭代测试 · 选择核心角色' }))
                return true;
        }
        else if (op === 'iteration-return') {
            const ids = Object.keys(s.locations).filter(id => ['play', 'asset', 'society'].includes(s.locations[id].zone) && controllerOf(s, id) === p && (s.locations[id].markers ?? 0) > 0);
            choose(s, a, 'shoggoth-remove-time', p, ids, { min: 0, max: 2, choiceLabel: '迭代测试 · 移除至多两个时间标志' });
            return true;
        }
        else if (op === 'support-lock-honor') {
            const ds = plan.eventDistrict;
            if (s.districts[ds]?.id === plan.eventDistrictCardId) {
                const inf = s.districts[ds].influence;
                if (inf[1 - p])
                    inf[1 - p]--;
                else
                    inf[p]++;
            }
            honor(s, p, 1);
        }
        else if (op === 'guardian-move') {
            const ids = coreRoles(s, p).filter(id => s.locations[id].district === plan.eventDistrict);
            if (pick(s, a, 'claim-move', ids, { sourceDistrict: plan.eventDistrict, choiceLabel: '控制小组 · 可移动赢取地区的核心角色' }))
                return true;
        }
        else if (op === 'hq-entry-influence') {
            if (s.locations[a.cardId]?.zone === 'play' && s.locations[a.cardId].zoneVersion === plan.sourceZoneVersion) {
                move(s, a.cardId, 'graveyard', { cause: 'sacrifice' });
                const inf = s.districts[plan.eventDistrict]?.influence;
                if (inf) {
                    if (inf[1 - p])
                        inf[1 - p]--;
                    else
                        inf[p]++;
                }
            }
        }
        else if (op === 'core-barrier') {for(const core of coreRoles(s,p))buff(s,core,'barrier');}
        finishSpell(s, a);
        return true;
    }
    function choice(s, p, c, x) {
        const a = x.spell, ap = a.controller;
        if (x.kind === 'shoggoth-replace-core') {
            const old = x.oldCoreId, l = s.locations[old], def = s.automationCards.find(t => t.catalogId === c.cardId);
            need(s.selectedCoreIds[p] === old && l?.zone === 'core' && l.corePlayer === p && l.zoneVersion === x.oldCoreVersion, '原核心已离开核心区或已经被替换');
            need(x.options.some(o => o.id === c.cardId) && hasCardType(def, 'character') && def.subtitle === '修格斯' && def.automation?.coreAbility && !def.token, '请选择另一张修格斯核心角色');
            move(s, old, 'removed');
            const id = uuid();
            s.cards[id] = { ...structuredClone(def), id, owner: p };
            s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
            move(s, id, 'core', { corePlayer: p });
            s.selectedCoreIds[p] = id;
            s.coreChanges ??= [];
            s.coreChanges.push({ player: p, oldCoreId: old, newCoreId: id, round: s.round });
            log(s, `${s.cards[old].name}移出游戏；${def.name}成为${s.seats[p].name}的新核心，核心区的休整及其他标志保留。`);
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'shoggoth-pay-honor') {
            need(typeof c.pay === 'boolean', '请选择是否支付1名誉');
            if (c.pay) {
                need((s.players[p].honor ?? 0) >= 1, '名誉点不足');
                changeHonor(s, p, -1);
                draw(s, [p], 1);
            }
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'shoggoth-basic-core') {
            need(x.cardIds.includes(c.cardId) && coreRole(s, c.cardId, p) && s.locations[c.cardId]?.zone === 'play' && !s.locations[c.cardId].faceDown, '请选择仍在场的本方核心角色');
            if (x.operation === 'basic-core-move') {
                const t = x.destination;
                if (t && s.districts[t.district]?.id === t.cardId) {
                    resetCard(s, c.cardId);
                    relocate(s, c.cardId, t.district, { event, group: a.id });
                }
            }
            else {
                buff(s, c.cardId, 'modify-defense', { amount: 1 });
                draw(s, [p], 1);
            }
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'shoggoth-core-hand') {
            const id = x.cardIds[0], l = s.locations[id];
            if (c.skip !== true) {
                need(c.cardId === id && l?.zone === 'core' && l.corePlayer === p && l.zoneVersion === x.coreVersion, '核心已离开核心区');
                move(s, id, 'hand');
            }
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'shoggoth-research-zombies') {
            const ids = c.cardIds ?? [], t = x.destination;
            need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => x.cardIds.includes(id) && s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && !s.locations[id].tapped && controllerOf(s, id) === p && hasCardType(printedRulesCard(s, id), 'attachment') && effectiveSubtypes(s, id).includes('研究')), '请选择未横置的本方研究附属');
            if (t && s.districts[t.district]?.id === t.cardId) {
                for (const id of ids)
                    tapCard(s, id);
                const def = s.reserveTemplates.find(c => c.catalogId === 'TK001') ?? s.automationCards.find(c => c.catalogId === 'TK001');
                need(def, '缺少行尸指示物资料');
                for (const unused of ids) {
                    const id = uuid();
                    s.cards[id] = { ...structuredClone(def), id, owner: p };
                    s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
                    enter(s, id, p, t.district, a.id);
                }
            }
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'shoggoth-mission-search') {
            need(c.fail === true || x.cardIds.includes(c.cardId) && s.players[p].deck.includes(c.cardId), '请选择一张任务牌或未找到');
            if (!c.fail) {
                if (move(s, c.cardId, 'play', { controller: p, tapped: false }))
                    event(s, c.cardId, 'entry', s.locations[c.cardId], a.id, { method: 'effect-placement' });
            }
            shuffle(s.players[p].deck);
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'shoggoth-mission-move') {
            if (c.skip !== true) {
                need(x.cardIds.includes(c.cardId) && coreRole(s, c.cardId, p) && s.districts[x.destination]?.id === x.destinationCardId, '核心角色或任务地区已失效');
                const id = c.cardId, old = s.locations[id].district;
                if (relocate(s, id, x.destination) && old !== s.locations[id].district)
                    event(s, id, 'entry', s.locations[id], a.id, { method: 'movement' });
            }
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'shoggoth-mission-place-core') {
            need(typeof c.enter === 'boolean', '请选择是否放置进场');
            const id = x.enterId;
            if (c.enter && s.locations[id]?.zone === 'core' && s.locations[id].zoneVersion === x.enterVersion)
                enter(s, id, p, 0, a.id);
            const ids = coreRoles(s, p);
            if (pick(s, a, 'mission-shield', ids, { choiceLabel: '冰封古陵寝 · 给一个本方核心角色放护盾' }))
                return;
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'shoggoth-mission-shield') {
            need(x.cardIds.includes(c.cardId) && coreRoles(s, p).includes(c.cardId), '请选择一个本方核心角色');
            counter(s, c.cardId, 'shield');
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'shoggoth-scored-core-draw') {
            need(typeof c.draw === 'boolean', '请选择是否抓牌');
            if (c.draw)
                draw(s, [p], 1);
            if (x.remainingDraws > 1)
                choose(s, a, x.kind, p, [], { remainingDraws: x.remainingDraws - 1, remainingCore: x.remainingCore, choiceLabel: '水没镇区 · 是否抓一张牌' });
            else
                finishInvocation(s, a, x.remainingCore);
            return;
        }
        if (x.kind === 'shoggoth-copy-command') {
            const original = s.flow.stack.find(a => a.id === x.originalEntryId);
            need(original && x.corePlan.modes.some(m => m.id === c.mode) && unusedCommandModes(original).some(m => m.id === c.mode), '原命令或复制模式已失效');
            const plan = { ...original.plan, selectedMode: c.mode, ...(original.plan.multiMode ? { selectedModes: [c.mode] } : {}) }, targets = prepare(s, p, { ...c, modes: [c.mode] }, plan), copy = { ...structuredClone(original), id: uuid(), copied: true, controller: p, mode: c.mode, plan, targets, targetsObserved: false, displayName: `${original.displayName} · 复制` };
            delete copy.hallucination;
            s.flow.stack.push(copy);
            observeTargets?.(s, copy);
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'shoggoth-assets') {
            const ready = commitChoice(x, p, c, (own, c) => need(own.cardIds.includes(c.cardId) && s.players[p].assets.some(a => a.id === c.cardId) && !sacrificeEffectBlocked(s, c.cardId), '请选择仍可牺牲的本方资产'));
            if (!ready)
                return;
            const ids = ready.map(r => r.command.cardId);
            withSimultaneousDepartures(s, ids, () => {
                for (const id of ids)
                    move(s, id, 'graveyard', { cause: 'sacrifice' });
            });
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'shoggoth-time-apparatus') {
            need(typeof c.enter === 'boolean', '请选择是否放置进场');
            const id = x.cardIds[0], t = x.destination;
            if (c.enter && s.players[p].deck[0] === id && s.locations[id].zoneVersion === x.cardVersion && s.districts[t.district]?.id === t.cardId && enter(s, id, p, t.district, a.id)) {
                const l = s.locations[id];
                s.effects.push({ kind: 'round-end-conceal', targetId: id, targetZoneVersion: l.zoneVersion, controller: p, displayName: '雨果的溯时装置' });
            }
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'shoggoth-invoke') {
            if (x.canSkip && c.skip === true) {
                finishSpell(s, a);
                return;
            }
            need(coreAvailable(s, p) === x.coreId && s.locations[x.coreId].zoneVersion === x.coreVersion, '核心能力来源已改变');
            const plan = { ...x.corePlan }, targets = prepare(s, p, c, plan);
            if (plan.modes)
                need(plan.modes.some(m => m.id === c.mode), '请选择核心能力模式');
            const entry = { id: uuid(), kind: 'auto-ability', event: 'core', cardId: x.coreId, controller: p, displayName: s.cards[x.coreId].name, plan, targets, mode: c.mode };
            s.flow.stack.push(entry);
            observeTargets?.(s, entry);
            event(s, x.coreId, 'core', s.locations[x.coreId], a.id, { player: p });
            log(s, `${s.cards[x.coreId].name}的核心能力进入堆叠。`);
            const n = scoredTasks(s, p, 'BQ115').length;
            if (n)
                choose(s, a, 'shoggoth-scored-core-draw', p, [], { remainingDraws: n, remainingCore: x.remainingCore, choiceLabel: '水没镇区 · 是否抓一张牌' });
            else
                finishInvocation(s, a, x.remainingCore);
            return;
        }
        if (x.kind === 'shoggoth-pay-two') {
            need(typeof c.pay === 'boolean', '请选择是否支付2');
            if (c.pay)
                ctx.pay(s, p, 2);
            else if (x.operation === 'pitt-pay') {
                choose(s, a, 'shoggoth-draw-optional', ap, [], { choiceLabel: '皮特·冈萨雷斯 · 是否抓一张牌' });
                return;
            }
            else if (effectiveSocietyMarkers(s, p).hidden > 0) {
                s.players[p].markers.hidden--;
                const m = s.players[ap].markers;
                setCardMarker(s, s.players[ap], 'markers', null, societyMarkers(m.hidden, m.exposed, 1, 0));
            }
        }
        else if (x.kind === 'shoggoth-cluster-search') {
            need(c.fail === true || x.cardIds.includes(c.cardId) && s.players[p].deck.includes(c.cardId), '请选择合法检索牌或未找到');
            if (!c.fail && s.districts[x.sourceDistrict]?.id === x.sourceDistrictCardId)
                enter(s, c.cardId, p, x.sourceDistrict, a.id);
            shuffle(s.players[p].deck);
        }
        else if (x.kind === 'shoggoth-shield-optional') {
            need(typeof c.shield === 'boolean', '请选择是否放置护盾');
            if (c.shield && s.locations[x.roleId]?.zone === 'play' && s.locations[x.roleId].zoneVersion === x.roleVersion)
                counter(s, x.roleId, 'shield');
        }
        else if (x.kind === 'shoggoth-hidden-time') {
            const ids = c.cardIds ?? [];
            need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.length <= 2 && ids.every(id => x.options.some(o => o.id === id)), '至多选择两个角色');
            for (const id of ids)
                setCardMarker(s, s.locations[id], "markers", null, (s.locations[id].markers ?? 0) + 1);
        }
        else if (x.kind === 'shoggoth-draw-optional') {
            need(typeof c.draw === 'boolean', '请选择是否抓牌');
            if (c.draw)
                draw(s, [p], 1);
        }
        else if (x.kind === 'shoggoth-sacrifice' || x.kind === 'shoggoth-enemy-sacrifice') {
            need(x.cardIds.includes(c.cardId) && sacrifice(s, p).includes(c.cardId) || x.kind === 'shoggoth-enemy-sacrifice' && x.cardIds.includes(c.cardId) && s.locations[c.cardId]?.zone === 'play' && !sacrificeEffectBlocked(s, c.cardId), '请选择仍可牺牲的本方牌');
            move(s, c.cardId, 'graveyard', { cause: 'sacrifice' });
            if (x.after === 'honor4')
                honor(s, ap, 4);
            else if (x.after === 'hidden') {
                const m = s.players[ap].markers;
                setCardMarker(s, s.players[ap], 'markers', null, societyMarkers(m.hidden, m.exposed, 1, 0));
            }
            else if (x.after === 'draw-deter') {
                draw(s, [ap], 1);
                if (deter(s, a, 1))
                    return;
            }
        }
        else if (x.kind === 'shoggoth-execution') {
            need(x.cardIds.includes(c.cardId) && s.locations[c.cardId]?.zone === 'play' && (s.locations[c.cardId].counters?.locked ?? 0) > 0, '所选锁定角色已失效');
            destroy(s, c.cardId);
            honor(s, ap, 1);
        }
        else if (x.kind === 'shoggoth-conceal') {
            need(x.cardIds.includes(c.cardId) && chars(s, p).includes(c.cardId), '请选择本方角色');
            ctx.conceal(s, c.cardId, a.id);
            honor(s, ap, 1);
        }
        else if (x.kind === 'shoggoth-copy-counters') {
            need(x.cardIds.includes(c.cardId) && coreRole(s, c.cardId, p) && coreArea(s, p), '请选择核心角色');
            const l = s.locations[c.cardId], area = coreArea(s, p);
            setCardMarker(s, area, "markers", null, (area.markers ?? 0) + (l.markers ?? 0));
            setCardMarker(s, area, "wounds", null, (area.wounds ?? 0) + (l.wounds ?? 0));
            for (const [k, n] of Object.entries(l.counters ?? {}))
                if (k !== 'rest' && Number.isFinite(n))
                    counter(s, area.id, k, n);
        }
        else if (x.kind === 'shoggoth-remove-time') {
            const payments = c.timePayments ?? [];
            need(Array.isArray(payments) && new Set(payments.map(x => x.cardId)).size === payments.length && payments.every(v => x.cardIds.includes(v.cardId) && Number.isSafeInteger(v.count) && v.count > 0 && v.count <= s.locations[v.cardId].markers), '请选择实际存在的时间标志');
            const n = payments.reduce((n, v) => n + v.count, 0);
            need(n <= 2, '至多移除两个时间标志');
            for (const v of payments)
                setCardMarker(s, s.locations[v.cardId], "markers", null, (s.locations[v.cardId].markers) - (v.count));
            const ids = graveCards(s, p, a.cardId).filter(id => s.cards[id].subtypes?.some(t => ['命令', '研究'].includes(t)));
            if (n && ids.length) {
                choose(s, a, 'shoggoth-grave-return', p, ids, { min: 0, max: Math.min(n, ids.length), public: true, choiceLabel: '每个移除的时间标志可将一张墓地命令或研究牌回手' });
                return;
            }
        }
        else if (x.kind === 'shoggoth-grave-return') {
            const ids = c.cardIds ?? [];
            need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.length <= x.max && ids.every(id => x.cardIds.includes(id) && inGrave(s, id, a.cardId)), '请选择合法墓地牌');
            for (const id of ids)
                move(s, id, 'hand');
        }
        else if (x.kind === 'shoggoth-genesis') {
            need(x.cardIds.every((id, i) => s.players[p].deck[i] === id), '牌库已经改变');
            need(c.skip === true || x.eligibleIds.includes(c.cardId), '请选择合法角色或跳过');
            const id = c.skip ? null : c.cardId, t = x.destination;
            if (id && t && s.districts[t.district]?.id === t.cardId)
                enter(s, id, p, t.district, a.id);
            const rest = x.cardIds.filter(i => s.locations[i]?.zone === 'deck' && s.players[p].deck.includes(i));
            shuffle(rest);
            for (const i of rest)
                move(s, i, 'deck');
        }
        else if (x.kind === 'shoggoth-claim-move') {
            if (c.skip !== true) {
                need(x.cardIds.includes(c.cardId) && coreRole(s, c.cardId, p) && s.locations[c.cardId].district === x.sourceDistrict, '核心角色已离开原地区');
                const ds = adjacentDistricts(s, x.sourceDistrict);
                need(ds.includes(c.district), '请选择相邻地区');
                relocate(s, c.cardId, c.district, { event, group: a.id });
            }
        }
        else if (x.kind === 'shoggoth-place-core') {
            const id = x.enterId;
            need(x.options.some(o => o.id === c.cardId) && s.locations[id]?.zone === 'core' && s.locations[id].corePlayer === p, '请选择合法核心进场地区');
            if (enter(s, id, p, Number(c.cardId.slice(9)), a.id) && c.shield === true)
                counter(s, id, 'shield');
        }
        finishSpell(s, a);
    }
    function departed(s, id, loc) {
        const p = loc.controller ?? s.cards[id].owner;
        if (loc.faceDown || s.cards[id].token || !coreArea(s, p) || !coreRole(s, id, p, loc) || id !== s.selectedCoreIds?.[p] && (s.playerPreferences?.[p]?.skipAdditionalCoreReturn ?? true))
            return null;
        return { player: p, departedVersion: loc.zoneVersion + 1 };
    }
    function completeDeparture(s, id, departure) {
        if (!departure)
            return;
        const p = departure.player, l = s.locations[id];
        if (!l || l.zoneVersion !== departure.departedVersion || l.zone === 'core' || !coreArea(s, p))
            return;
        const fire = continuousDecision(s, `core-return:${id}:${l.zoneVersion}`, { kind: 'shoggoth-core-return', controller: p, sourceName: '修格斯的核心区', hostName: s.cards[id].name });
        if (fire && move(s, id, 'core', { corePlayer: p })) {
            setCardMarker(s, coreArea(s, p), 'counter', 'rest', coreRest(s, p) + 1);
            log(s, '核心区持续能力：核心角色返回核心区，放置一个休整标志。');
        }
    }
    function entered(s, id, loc) {
        if (loc.entryFromZone !== 'core' || !coreArea(s, controllerOf(s, id)))
            return;
        const area = coreArea(s, controllerOf(s, id));
        setCardMarker(s, loc, "markers", null, (loc.markers ?? 0) + (area.markers ?? 0));
        setCardMarker(s, loc, "wounds", null, (loc.wounds ?? 0) + (area.wounds ?? 0));
        delete area.markers;
        delete area.wounds;
        for (const [k, n] of Object.entries(area.counters))
            if (k !== 'rest') {
                counter(s, id, k, n);
                delete area.counters[k];
            }
    }
    function watch(s, id, name, loc, group, details) {
        if (name === 'entry' && !loc.faceDown && details.method !== 'movement')
            entered(s, id, loc);
        for (const p of [0, 1])
            if (coreArea(s, p)) {
                if (name === 'cast' && details.player === p && s.cards[id]?.faction?.split('·')[0] === '红')
                    emit(s, s.societies[p].id, { mandatory: true, target: 'none', effect: 'shoggoth', operation: 'red-counter' }, name, s.locations[s.societies[p].id], group, { sourceSilenced: false });
                if (name === 'region-won' && details.winner === p && shoggothSociety(s, p) && (s.players[p].scoreCards ?? []).filter(c => hasCardType(c, 'task')).length + Number(hasCardType(s.districts[details.district], 'task')) >= 3)
                    emit(s, s.societies[p].id, { target: 'none', effect: 'shoggoth', operation: 'mission-victory' }, name, s.locations[s.societies[p].id], group, { sourceSilenced: false });
                if (name === 'region-won' && details.winner === p)
                    emit(s, coreArea(s, p).id, { target: 'none', effect: 'shoggoth', operation: 'honor', count: 2 }, name, { zone: 'core-area', zoneVersion: 0, controller: p }, group, { sourceSilenced: false });
            }
        if (name === 'region-claimed') {
            const d = details.claimedDistrict, def = d?.automation?.taskWin;
            if (def)
                emit(s, d.id, def, 'region-won', { ...s.locations[d.id], controller: details.winner }, group, { sourceSilenced: false });
        }
        if (name === 'contest-won' && details.contest === 'hidden')
            for (const c of scoredTasks(s, details.winner, 'BQ113')) {
                s.scoredTaskInvokes ??= [];
                s.scoredTaskInvokes.push({ id: uuid(), kind: 'auto-ability', cardId: c.id, controller: details.winner, plan: { target: 'none', effect: 'shoggoth', operation: 'score-hidden-core' }, targets: [] });
            }
        for (const source of s.players.flatMap(pl => pl.play)) {
            const sl = s.locations[source], plan = printedRulesCard(s, source)?.automation, p = controllerOf(s, source);
            if (sl.zone !== 'play' || sl.faceDown || abilitiesSuppressed(s, source))
                continue;
            if (name === 'cast' && details.method !== 'paid-reveal' && details.player === 1 - p && hasCardType(s.cards[id], 'attachment') && plan?.shoggothStatic === 'pitt')
                emit(s, source, { target: 'none', effect: 'shoggoth', operation: 'pitt-pay' }, name, sl, group);
            if (name === 'entry' && !loc.faceDown && hasCardType(s.cards[id], 'character') && plan?.shoggothStatic === 'species-control' && s.cards[id].printedCost > s.players[controllerOf(s, id)].assets.length)
                emit(s, source, { mandatory: true, target: 'none', effect: 'shoggoth', operation: 'species-control' }, name, sl, group, { subjectId: id, subjectZoneVersion: loc.zoneVersion });
            if (name === 'entry' && coreRole(s, id, p) && !loc.faceDown && hasCardType(s.districts[loc.district], 'task') && plan?.shoggothStatic === 'mission-contact')
                emit(s, source, { mandatory: true, target: 'none', effect: 'shoggoth', operation: 'mission-contact' }, name, sl, group, { eventDistrict: loc.district, eventDistrictCardId: s.districts[loc.district]?.id });
            if (name === 'entry' && coreRole(s, id, p) && !loc.faceDown && plan?.shoggothStatic === 'detective')
                emit(s, source, { target: 'character-or-hidden', effect: 'shoggoth', operation: 'core-lock' }, name, sl, group);
            if (name === 'locked' && details.operator === p && controllerOf(s, id) !== p && (loc.faceDown || hasCardType(s.cards[id], 'character')) && plan?.shoggothStatic === 'support')
                emit(s, source, { target: 'none', effect: 'shoggoth', operation: 'support-lock-honor' }, name, sl, group, { eventDistrict: sl.district, eventDistrictCardId: s.districts[sl.district]?.id });
            if (name === 'region-won' && details.winner === p && plan?.shoggothStatic === 'mission-core' && hasCardType(s.districts[details.district], 'task'))
                emit(s, source, { target: 'none', effect: 'shoggoth', operation: 'mission-honor' }, name, sl, group);
            if (name === 'region-won' && details.winner === p && plan?.shoggothStatic === 'control-team')
                emit(s, source, { target: 'none', effect: 'shoggoth', operation: 'guardian-move' }, name, sl, group, { eventDistrict: details.district });
        }
        if (name === 'death' && details.cause === 'sacrifice') {
            const batch = s.deathBatch?.group === group ? s.deathBatch : null;
            const sources = batch?.sources ?? s.players.flatMap(pl => pl.play).map(id => ({ id, card: printedRulesCard(s, id), loc: s.locations[id], silenced: abilitiesSuppressed(s, id) }));
            const subjectController = batch?.subjects[id]?.controller ?? loc.controller ?? controllerOf(s, id);
            for (const source of sources) {
                const sl = source.loc, p = sl.controller ?? source.card.owner;
                if (sl.zone !== 'play' || sl.faceDown || source.silenced || source.card.automation?.shoggothStatic !== 'ebeniya' || subjectController !== p)
                    continue;
                emit(s, source.id, { target: 'none', triggerCost: true, cost: Math.max(0, 3 - (s.societyStates?.[p]?.counters['失控'] ?? 0)), effect: 'shoggoth', operation: 'ebeniya-sacrifice' }, name, sl, group, { sourceSilenced: false });
            }
        }
    }
    function conditions(s, group = uuid()) {
        if (s.scoredTaskInvokes?.length && !s.finishingHidden && !s.hidden && !s.effectChoice && !s.ruleChoice && !s.damageChoice) {
            const a = s.scoredTaskInvokes.shift();
            invocation(s, a, 1, true);
        }
        s.shoggothTimes ??= {};
        for (const id of Object.keys(s.shoggothTimes))
            if (!['play', 'core'].includes(s.locations[id]?.zone) || s.locations[id].faceDown || true)
                delete s.shoggothTimes[id];
        for (const id of Object.keys(s.locations)) {
            const l = s.locations[id];
            if (!['play', 'core'].includes(l.zone) || l.faceDown || true)
                continue;
            const n = l.markers ?? 0, old = s.shoggothTimes[id];
            if (old?.version === l.zoneVersion && old.count !== n)
                emit(s, id, { target: 'none', effect: 'shoggoth', operation: 'honor', count: 1 }, 'time-change', l, group);
            s.shoggothTimes[id] = { version: l.zoneVersion, count: n };
        }
        for (const id of s.players.flatMap(pl => pl.play)) {
            const l = s.locations[id], c = l.secretPlan ? s.cards[id] : printedRulesCard(s, id), p = controllerOf(s, id);
            if (c?.automation?.shoggothStatic !== 'core-plan')
                continue;
            const core = s.cards[s.selectedCoreIds?.[p]];
            if (core && (l.counters?.progress ?? 0) >= core.printedCost && !l.shoggothPlanFired) {
                l.shoggothPlanFired = true;
                emit(s, id, { mandatory: true, target: 'district', effect: 'shoggoth', operation: 'core-plan' }, 'state-condition', l, group);
            }
        }
    }
    function afterHidden(s, a, winner) {
        if ((a.plan.modeTargets?.[a.mode]?.operation ?? a.plan.operation) === 'iteration-hidden' && winner === a.controller) {
            for (const t of a.targets)
                if (live(s, a.controller, { target: 'character' }, t))
                    setCardMarker(s, s.locations[t.cardId], "markers", null, (s.locations[t.cardId].markers ?? 0) + 1);
        }
        finishSpell(s, a);
    }
    return { initialize, effect, choice, watch, conditions, departed, completeDeparture, afterHidden, entered };
}
