import { influenceRemovalOptions, removeSelectedInfluence } from './club-influence.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { simultaneousChoice, commitChoice } from './simultaneous-choice.mjs';
import { graveCards, isGraveZone } from './graveyard-rules.mjs';
import { RuleError } from './core.mjs';
import { printedRulesCard, printedRulesBlank } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { progressCount, progressive } from './plan-rules.mjs';
import { cardHasKeyword, effectiveSubtypes, sacrificeCostBlocked, sacrificeEffectBlocked } from './derived.mjs';
import { transformCard } from './card-forms.mjs';
import { sealHost } from './sealing.mjs';
import { sourceLive } from './batch-rules.mjs';
import { uuid } from './random.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function createGrayEffects(ctx) {
    const { move, event, choose, finishSpell, log, shuffle, draw, pay, emit, options, prepare, live, destroy, hurt, conceal, librarySearchBlocked } = ctx;
    const field = s => s.players.flatMap(p => p.play);
    const rawPlan = (s, id) => s.cards[id]?.automation;
    const data = (s, id) => ({ ...printedRulesCard(s, id), subtypes: effectiveSubtypes(s, id) });
    const eligibleSacrifice = (s, p, asEffect = false) => [...s.players[p].assets.map(a => a.id), ...s.players[p].play.filter(id => s.locations[id].secretPlan && !(asEffect ? sacrificeEffectBlocked : sacrificeCostBlocked)(s, id))];
    function change(s, id, n, group) {
        const l = s.locations[id];
        if (!['play', 'asset', 'society'].includes(l?.zone))
            return;
        l.counters ??= {};
        setCardMarker(s, l, "counter", "progress", Math.max(0, (l.counters.progress ?? 0) + n));
        event(s, id, 'progress-change', l, group);
    }
    function run(s, a, steps) {
        a = { ...a, graySteps: steps };
        while (a.graySteps.length && s.status === 'playing') {
            const [o, ...rest] = a.graySteps;
            a = { ...a, graySteps: rest };
            const p = o.player ?? a.controller;
            if (o.op === 'draw') {
                if (!draw(s, [p], o.count ?? 1))
                    return;
            }
            else if (o.op === 'search') {
                if (librarySearchBlocked(s)) {
                    shuffle(s.players[p].deck);
                    continue;
                }
                const ids = s.players[p].deck.filter(id => { const c = data(s, id), f = o.filter ?? {}; return (!f.subtypesAny || f.subtypesAny.some(t => c.subtypes.includes(t))) && (!f.noDomain || !c.magicDomains?.length) && (!f.type || hasCardType(c, f.type)) && (f.cost === undefined || c.printedCost === f.cost); });
                choose(s, a, 'gray-search', p, ids, { canFail: true, destination: o.destination ?? 'hand', destinationDistrict: o.district, destinationDistrictId: o.districtId, choiceLabel: '检索并展示；完成后洗牌' });
                return;
            }
            else if (o.op === 'choose-card') {
                const ids = o.zone === 'hand' ? [...s.players[p].hand] : o.zone === 'graveyard' ? [...graveCards(s, p)] : o.zone === 'asset' ? s.players[p].assets.map(a => a.id) : o.sacrifice ? eligibleSacrifice(s, p, true) : [];
                if (ids.length) {
                    choose(s, a, 'gray-card', p, ids, { operation: o, choiceLabel: o.label, zone: o.zone, public: o.zone !== 'hand' });
                    return;
                }
            }
            else if (o.op === 'deter') {
                const enemy = 1 - a.controller, opts = influenceRemovalOptions(s, enemy);
                if (o.count > 0 && opts.length) {
                    choose(s, { ...a, graySteps: [{ ...o, count: o.count - 1 }, ...rest] }, 'gray-deter', enemy, [], { options: opts, choiceLabel: '遏制 · 移除一个本方势力标志' });
                    return;
                }
            }
            else if (o.op === 'return-self') {
                const l = s.locations[a.plan.sourceId];
                if (isGraveZone(s, l.zone) && l.zoneVersion === a.plan.sourceAfterCostVersion)
                    move(s, a.plan.sourceId, 'hand');
            }
            else if (o.op === 'bounce-hidden') {
                for (const id of [...field(s)])
                    if (s.locations[id]?.faceDown)
                        move(s, id, 'hand');
            }
            else if (o.op === 'target-bounce' || o.op === 'target-destroy') {
                if (o.target && live(s, a.controller, { target: o.op === 'target-bounce' ? 'character' : 'attachment' }, o.target) && !cardHasKeyword(s, o.target.cardId, '永恒'))
                    o.op === 'target-bounce' ? move(s, o.target.cardId, 'hand') : destroy(s, o.target.cardId);
            }
        }
        finishSpell(s, a);
    }
    function progressTrigger(s, id, group) {
        const l = s.locations[id], raw = rawPlan(s, id), hidden = l?.secretPlan, n = progressCount(s, id);
        if (!l || l.zone !== 'play' || l.faceDown)
            return;
        if (raw?.grayStatic === 'urban' && !hidden && !printedRulesBlank(s, id)) {
            if (l.observedProgress !== undefined && l.observedProgress !== n && l.progressDrawRound !== s.round) {
                l.progressDrawRound = s.round;
                emit(s, id, { target: 'none', effect: 'draw', count: 1 }, 'progress-change', l, group);
            }
            l.observedProgress = n;
        }
        const faux = false;
        const def = faux ? { mandatory: true, target: 'none', effect: 'gray', operation: 'secret-flip', amount: s.cards[id].printedCost, chooseTriggerOrder: true } : !printedRulesBlank(s, id) || hidden ? raw?.advanceTrigger : null;
        if (!def)
            return;
        if (n < def.amount) {
            delete l.advanceStamp;
            return;
        }
        const stamp = `${l.zoneVersion}:${s.cards[id].catalogId}:${def.operation}`;
        if (l.advanceStamp === stamp)
            return;
        l.advanceStamp = stamp;
        const target = def.target !== 'none' && !options(s, l.controller ?? s.cards[id].owner, { ...def, sourceId: id }).length ? 'none' : def.target;
        emit(s, id, { ...def, target, ...(def.operation.startsWith('score') ? { noResponse: true } : {}) }, 'progress-threshold', l, group);
    }
    function conditions(s, group = uuid()) {
        for (const id of field(s))
            progressTrigger(s, id, group);
    }
    function onEvent(s, id, ev, l, group, details) {
        if (ev === 'progress-change') {
            progressTrigger(s, id, group);
            return;
        }
        if (ev === 'asset-leave') {
            s.assetLeftRounds ??= {};
            s.assetLeftRounds[l.controller ?? s.cards[id].owner] = s.round;
        }
        const observed = details.subjectCard ?? data(s, id);
        for (const source of field(s)) {
            const sl = s.locations[source], sc = printedRulesCard(s, source), st = sc?.automation?.grayStatic, p = controllerOf(s, source);
            if (sl.zone !== 'play' || sl.faceDown || sl.secretPlan)
                continue;
            if (st === 'protocol' && (ev === 'asset-leave' && (l.controller ?? s.cards[id].owner) === p || ev === 'leave' && details.cause === 'sacrifice' && (l.controller ?? s.cards[id].owner) === p && hasCardType(observed, 'attachment') && (l.secretPlan || observed.subtypes?.includes('计划'))))
                emit(s, source, { cost: 1, target: 'none', effect: 'gray', operation: 'protocol-search' }, ev, sl, group);
            if (st === 'rivals' && ev === 'entry' && !l.faceDown && !l.secretPlan && hasCardType(observed, 'character') && sl.rivalSubtypes?.some(t => observed.subtypes?.includes(t)))
                emit(s, source, { mandatory: true, target: 'none', effect: 'gray', operation: 'rivals-pay', beneficiary: 1 - (l.controller ?? s.cards[id].owner), chooseTriggerOrder: true }, ev, sl, group);
            if (st === 'urban' && ev === 'reveal' && details.lockedBefore && (l.controller ?? s.cards[id].owner) !== p && progressCount(s, source) > 0)
                emit(s, source, { target: 'none', effect: 'gray', operation: 'urban-reveal', sourceProgressCost: 1, subjectId: id, subjectVersion: l.zoneVersion }, ev, sl, group);
        }
    }
    function score(s, a, plan) {
        if (!sourceLive(s, plan))
            return false;
        const id = plan.sourceId, c = s.cards[id];
        if (!move(s, id, 'score', { controller: a.controller, cause: 'rule-score' }))
            return false;
        s.players[a.controller].scoreCards.push({ ...structuredClone(c), id, points: 0, awardedPoints: 0 });
        log(s, `${c.name}进入${s.seats[a.controller].name}的计分区。`);
        return true;
    }
    function flip(s, a, targetId) {
        const id = a.plan.sourceId, l = s.locations[id];
        if (!sourceLive(s, a.plan) || !l.secretPlan) {
            finishSpell(s, a);
            return;
        }
        l.secretPlan = false;
        delete l.advanceStamp;
        l.counters ??= {};
        setCardMarker(s, l, "counter", "progress", 0);
        const plan = s.cards[id].attachment, opts = options(s, a.controller, { ...plan, cardId: id });
        if (!opts.length) {
            log(s, `${s.cards[id].name}翻正面，没有合法结附目标，按规则进入墓地。`);
            event(s, id, 'entry', l, a.id, { method: 'secret-attachment-flip' });
            move(s, id, 'graveyard', { cause: 'rule-attachment' });
            finishSpell(s, a);
            return;
        }
        if (targetId) {
            const refs = prepare(s, a.controller, { targetIds: [targetId] }, { ...plan, cardId: id }), t = refs[0];
            if (t.kind === 'host') {
                l.attachedTo = t.ref.hostId;
                l.hostVersion = t.ref.version;
                delete l.district;
            }
            else if (t.kind === 'district') {
                l.attachedTo = `district-host:${t.cardId}`;
                l.hostVersion = t.cardId;
                l.district = t.district;
            }
            else {
                l.attachedTo = t.cardId;
                l.hostVersion = t.zoneVersion;
                l.district = s.locations[t.cardId].district;
            }
            event(s, id, 'entry', l, a.id, { method: 'secret-attachment-flip' });
            event(s, id, 'attached', l, a.id, { host: sealHost(s, l.attachedTo) });
            finishSpell(s, a);
            return;
        }
        // Temporarily keep the society link legal while selecting the destination.
        l.pendingSecretHost = true;
        choose(s, a, 'gray-flip-host', a.controller, [], { options: opts, choiceLabel: '附属翻正面 · 选择合法结附目标' });
    }
    function mentor(s, a, t) {
        const plan = a.plan, p = a.controller;
        if (sourceLive(s, plan)) {
            const face = s.automationCards.find(c => c.catalogId === 'ZHBH05'), l = s.locations[plan.sourceId];
            if (face && transformCard(s, plan.sourceId, face)) {
                l.secretPlan = false;
                delete l.attachedTo;
                delete l.hostVersion;
                l.district = t.district;
                event(s, plan.sourceId, 'move', l, a.id, { district: t.district });
                draw(s, [p], 1);
            }
        }
        finishSpell(s, a);
    }
    function urbanDamage(s, a, t) {
        const ids = s.players[1 - a.controller].play.filter(id => s.locations[id].zone === 'play' && !s.locations[id].faceDown && s.locations[id].district === t.district && s.locations[id].counters?.locked > 0 && hasCardType(printedRulesCard(s, id), 'character'));
        if (ids.length) {
            choose(s, a, 'gray-damage', a.controller, ids, { choiceLabel: '分配至多4伤害', max: 4, district: t.district, districtId: t.cardId, versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])) });
            return;
        }
        finishSpell(s, a);
    }
    function effect(s, a, plan, targets) {
        const p = a.controller, id = plan.sourceId, source = s.locations[id], op = plan.operation;
        if (op === 'progress') {
            const subject = targets[0]?.cardId ?? id;
            if (progressive(s, subject))
                change(s, subject, plan.amount ?? 1, a.id);
            finishSpell(s, a);
            return true;
        }
        if (op === 'search') {
            run(s, a, [{ op: 'search', filter: plan.filter, destination: plan.destination }]);
            return true;
        }
        if (op === 'protocol-sacrifice' || op === 'headquarters-upkeep') {
            if (op === 'headquarters-upkeep' && s.assetLeftRounds?.[p] === s.round) {
                finishSpell(s, a);
                return true;
            }
            const ids = op === 'protocol-sacrifice' ? eligibleSacrifice(s, p, true) : [...s.players[p].assets.map(a => a.id), ...(sourceLive(s, plan) && !sacrificeEffectBlocked(s, id) ? [id] : [])];
            if (ids.length) {
                choose(s, a, 'gray-sacrifice', p, ids, { choiceLabel: '选择一张牌牺牲', public: true });
                return true;
            }
            finishSpell(s, a);
            return true;
        }
        if (op === 'protocol-asset') {
            if (sourceLive(s, plan))
                move(s, id, 'asset', { controller: p, tapped: true });
            finishSpell(s, a);
            return true;
        }
        if (op === 'protocol-search') {
            run(s, a, [{ op: 'deter', count: 1 }, { op: 'search', filter: { cost: 1 } }]);
            return true;
        }
        if (op === 'rivals-choose') {
            simultaneousChoice(s, choose, a, 'gray-subtype', [0, 1].map(controller => ({ controller, cardIds: [], freeChoice: true })), { choiceLabel: '远古宿敌 · 每位玩家选择一个角色类别' });
            return true;
        }
        if (op === 'rivals-pay') {
            const q = plan.beneficiary;
            choose(s, a, 'gray-pay', q, [], { amount: 1, choiceLabel: '远古宿敌 · 可以支付1并抓一张' });
            return true;
        }
        if (op === 'ban-number') {
            if (sourceLive(s, plan))
                choose(s, a, 'gray-number', p, [], { choiceLabel: '禁令 · 选择禁止打出与付费翻面的印刷费用' });
            else
                finishSpell(s, a);
            return true;
        }
        if (op === 'barrier') {
            if (targets[0])
                s.effects.push({ kind: 'barrier', targetId: targets[0].cardId, targetZoneVersion: targets[0].zoneVersion, duration: 'until-end-of-round' });
            finishSpell(s, a);
            return true;
        }
        if (op === 'bounce') {
            if (targets[0] && !cardHasKeyword(s, targets[0].cardId, '永恒'))
                move(s, targets[0].cardId, 'hand');
            finishSpell(s, a);
            return true;
        }
        if (op === 'gray-action') {
            const n = plan.sourceCounters?.progress ?? 0, steps = [];
            if (n >= 2)
                steps.push({ op: 'search', filter: { subtypesAny: ['阴谋', '局势'] } });
            if (n >= 4 && targets[0]?.kind === 'district')
                steps.push({ op: 'search', filter: { type: 'character', noDomain: true }, destination: 'hidden', district: targets[0].district, districtId: targets[0].cardId });
            if (n >= 6)
                steps.push({ op: 'return-self' });
            run(s, a, steps);
            return true;
        }
        if (op === 'biology') {
            const n = plan.sourceCounters?.progress ?? 0;
            run(s, a, [...(n >= 1 ? [{ op: 'draw' }] : []), ...(n >= 3 ? [{ op: 'target-bounce', target: a.targets.find(t => hasCardType(s.cards[t.cardId], 'character')) }] : []), ...(n >= 5 ? [{ op: 'target-destroy', target: a.targets.find(t => hasCardType(s.cards[t.cardId], 'attachment')) }] : [])]);
            return true;
        }
        if (op === 'counter-infiltration') {
            const n = plan.sourceCounters?.progress ?? 0;
            run(s, a, [...(n >= 1 ? [{ op: 'deter', count: field(s).filter(id => s.locations[id].faceDown).length }] : []), ...(n >= 3 ? [{ op: 'bounce-hidden' }] : [])]);
            return true;
        }
        if (op === 'dragomir') {
            for (const x of [...s.players[1 - p].play]) {
                const l = s.locations[x];
                if (l.zone !== 'play' || l.district !== plan.sourceDistrict || !l.faceDown && !hasCardType(printedRulesCard(s, x), 'character'))
                    continue;
                if ((a.mode ?? plan.selectedMode) === 'lock') {
                    l.counters ??= {};
                    setCardMarker(s, l, "counter", "locked", (l.counters.locked ?? 0) + 1);
                }
                else if (l.faceDown && l.counters?.locked > 0)
                    destroy(s, x);
            }
            finishSpell(s, a);
            return true;
        }
        if (op === 'urban-reveal') {
            const t = { kind: 'card', cardId: plan.subjectId, zoneVersion: plan.subjectVersion, faceDown: false };
            a = { ...a, targets: [t] };
            if (s.locations[t.cardId]?.zone === 'play' && !s.locations[t.cardId].faceDown && s.locations[t.cardId].zoneVersion === t.zoneVersion)
                choose(s, a, 'gray-urban-reveal', p, [t.cardId], { choiceLabel: '都市更新 · 放置锁定标志或造成1伤害' });
            else
                finishSpell(s, a);
            return true;
        }
        if (op === 'urban-damage') {
            if (sourceLive(s, plan))
                move(s, id, 'graveyard', { cause: 'sacrifice' });
            const t = targets[0];
            if (t) {
                urbanDamage(s, a, t);
                return true;
            }
            finishSpell(s, a);
            return true;
        }
        if (op === 'secret-flip') {
            flip(s, a);
            return true;
        }
        if (op === 'mentor') {
            if (!sourceLive(s, plan)) {
                finishSpell(s, a);
                return true;
            }
            if (targets[0])
                mentor(s, a, targets[0]);
            else
                finishSpell(s, a);
            return true;
        }
        if (op === 'new-order') {
            if (sourceLive(s, plan))
                move(s, id, 'graveyard', { cause: 'sacrifice' });
            for (const x of [...field(s)])
                if (!s.locations[x].faceDown && hasCardType(printedRulesCard(s, x), 'character') && !cardHasKeyword(s, x, '永恒'))
                    conceal(s, x, a.id);
            for (const pl of s.players) {
                for (const d of s.districts.flatMap((v, i) => v ? [i] : [])) {
                    const ids = pl.play.filter(x => s.locations[x].faceDown && s.locations[x].district === d);
                    shuffle(ids);
                    const positions = pl.play.map((x, i) => ids.includes(x) ? i : -1).filter(i => i >= 0);
                    for (let i = 0; i < ids.length; i++) {
                        pl.play[positions[i]] = ids[i];
                        s.locations[ids[i]].hiddenHandle = uuid();
                    }
                }
            }
            finishSpell(s, a);
            return true;
        }
        if (op === 'reorganize') {
            run(s, a, [{ op: 'draw' }, { op: 'choose-card', zone: 'asset', destination: 'deck', label: '资源重组 · 选择资产置于牌库底' }, { op: 'choose-card', zone: 'hand', destination: 'asset', label: '资源重组 · 选择手牌作为资产' }]);
            return true;
        }
        if (op === 'fragments') {
            const names = new Set(s.players[p].scoreCards.filter(c => c.subtypes?.includes('裂片')).map(c => c.name));
            if (names.size >= 3)
                for (const code of []) {
                    const t = s.automationCards.find(c => c.catalogId === code);
                    if (t) {
                        const fresh = uuid();
                        s.cards[fresh] = { ...structuredClone(t), id: fresh, owner: p, token: false };
                        s.locations[fresh] = { zone: 'reserve', zoneVersion: 0 };
                        s.players[p].reserve.push(fresh);
                        move(s, fresh, 'play', { controller: p, tapped: false, attachedTo: `society:${p}`, hostVersion: s.societyVersions?.[p] ?? 0 });
                        event(s, fresh, 'entry', s.locations[fresh], a.id, { method: 'effect-placement' });
                    }
                }
            finishSpell(s, a);
            return true;
        }
        if (op === 'score' || op === 'score-fragment') {
            if (score(s, a, plan) && op === 'score-fragment') {
                const code = s.cards[id].catalogId;
                ;
                ;
                ;
            }
            finishSpell(s, a);
            return true;
        }
        return false;
    }
    function choice(s, p, c, x) {
        const a = x.spell, plan = a.plan;
        if (x.kind === 'gray-subtype') {
            const validate = () => need(typeof c.subtype === 'string' && c.subtype.trim().length > 0 && c.subtype.length <= 40, '请输入一个角色类别');
            let values;
            if (x.simultaneous) {
                const selections = commitChoice(x, p, { subtype: c.subtype?.trim() }, validate);
                if (!selections)
                    return;
                values = selections.map(y => y.command.subtype);
            }
            else {
                validate();
                const chosen = { ...x.chosen, [p]: c.subtype.trim() };
                if (x.remainingPlayers.length) {
                    const [next, ...rest] = x.remainingPlayers;
                    choose(s, a, 'gray-subtype', next, [], { chosen, remainingPlayers: rest, choiceLabel: x.choiceLabel });
                    return;
                }
                values = Object.values(chosen);
            }
            if (sourceLive(s, plan))
                s.locations[plan.sourceId].rivalSubtypes = [...new Set(values)];
            log(s, '远古宿敌选择类别：' + values.join('、'));
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'gray-pay') {
            need(typeof c.pay === 'boolean', '请选择是否支付');
            if (c.pay) {
                pay(s, p, x.amount);
                draw(s, [p], 1);
            }
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'gray-number') {
            need(Number.isSafeInteger(c.number) && c.number >= 0 && c.number <= 1000, '请选择非负整数');
            if (sourceLive(s, plan))
                s.locations[plan.sourceId].bannedCost = c.number;
            log(s, `禁令选择印刷费用${c.number}。`);
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'gray-flip-host') {
            need(x.options.some(o => o.id === c.cardId), '请选择合法结附目标');
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && l.zoneVersion === plan.sourceZoneVersion) {
                l.secretPlan = true;
                delete l.pendingSecretHost;
                flip(s, a, c.cardId);
            }
            else
                finishSpell(s, a);
            return;
        }
        if (x.kind === 'gray-damage') {
            const payments = c.damage ?? [];
            need(Array.isArray(payments) && new Set(payments.map(x => x.cardId)).size === payments.length && payments.every(o => x.cardIds.includes(o.cardId) && Number.isSafeInteger(o.amount) && o.amount >= 0) && payments.reduce((n, o) => n + o.amount, 0) <= x.max, '请选择合法的伤害分配');
            if (s.districts[x.district]?.id === x.districtId)
                for (const o of payments)
                    if (s.locations[o.cardId]?.zone === 'play' && s.locations[o.cardId].zoneVersion === x.versions[o.cardId])
                        hurt(s, o.cardId, o.amount);
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'gray-urban-reveal') {
            need(['lock', 'damage'].includes(c.mode), '请选择锁定或伤害');
            const t = a.targets[0];
            if (s.locations[t.cardId]?.zone === 'play' && !s.locations[t.cardId].faceDown && s.locations[t.cardId].zoneVersion === t.zoneVersion) {
                const l = s.locations[t.cardId];
                if (c.mode === 'lock') {
                    l.counters ??= {};
                    setCardMarker(s, l, "counter", "locked", (l.counters.locked ?? 0) + 1);
                }
                else
                    hurt(s, t.cardId, 1);
            }
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'gray-search') {
            if (c.fail) {
                need(c.fail === true, '检索选择无效');
                shuffle(s.players[p].deck);
                run(s, a, a.graySteps);
                return;
            }
            need(x.cardIds.includes(c.cardId) && s.players[p].deck.includes(c.cardId), '请选择符合条件的牌');
            log(s, `${s.seats[p].name}展示${s.cards[c.cardId].name}。`);
            if (x.destination === 'top')
                move(s, c.cardId, 'aside');
            else if (x.destination === 'hidden') {
                if (s.districts[x.destinationDistrict]?.id === x.destinationDistrictId)
                    move(s, c.cardId, 'play', { controller: p, district: x.destinationDistrict, tapped: false, faceDown: true, hiddenHandle: uuid() });
            }
            else
                move(s, c.cardId, x.destination, { controller: p, tapped: x.destination === 'asset' });
            shuffle(s.players[p].deck);
            if (x.destination === 'top') {
                move(s, c.cardId, 'deck');
                s.players[p].deck = s.players[p].deck.filter(id => id !== c.cardId);
                s.players[p].deck.unshift(c.cardId);
            }
            run(s, a, a.graySteps);
            return;
        }
        if (x.kind === 'gray-sacrifice') {
            need(x.cardIds.includes(c.cardId) && ['play', 'asset'].includes(s.locations[c.cardId]?.zone) && !sacrificeEffectBlocked(s, c.cardId), '请选择可牺牲的牌');
            move(s, c.cardId, 'graveyard', { cause: 'sacrifice' });
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'gray-card') {
            need(x.cardIds.includes(c.cardId) && s.locations[c.cardId]?.zone === x.operation.zone, '所选牌已变更区域');
            move(s, c.cardId, x.operation.destination, { controller: p, tapped: false });
            run(s, a, a.graySteps);
            return;
        }
        if (x.kind === 'gray-deter') {
            need(x.options.some(o => o.id === c.cardId), '请选择有本方势力的地区');
            need(removeSelectedInfluence(s, p, c.cardId), '势力已改变');
            run(s, a, a.graySteps);
            return;
        }
        throw new RuleError('未知的计划结算选择');
    }
    return { effect, choice, conditions, event: onEvent, change, eligibleSacrifice };
}
