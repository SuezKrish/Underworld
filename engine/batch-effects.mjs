import { hardDeckCards, rememberHardDeckCards } from './hard-bot-library.mjs';
import { changeHonor } from './player-resources.mjs';
import { influenceRemovalOptions, removeSelectedInfluence, swapRegionInfluence, placeRegionInfluence } from './club-influence.mjs';
import { resetCard } from './reset.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { addWounds } from './wounds.mjs';
import { simultaneousChoice, commitChoice, withSimultaneousDepartures } from './simultaneous-choice.mjs';
import { createYellowWhiteEffects } from './yellow-white-effects.mjs';
import { graveCards, inGrave, isGraveZone } from './graveyard-rules.mjs';
import { inEffectDistrict } from './holy-deck-rules.mjs';
import { uuid } from './random.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { switchSociety } from './society-switch.mjs';
import { scoredCard } from './scoring.mjs';
import { relocate, districtTraits, chaosEntryDistricts, canMoveToDistrict } from './district-rules.mjs';
import { loyaltyAssets } from './environment-definitions.mjs';
import { librarySearchBlocked } from './library-search.mjs';
import { tapCard, canTapCard } from './field-events.mjs';
import { discardMany } from './discard-events.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { hasCardType } from './card-types.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { applyCardForm, transformCard } from './card-forms.mjs';
import { districtTimeMarkers } from './time-markers.mjs';
import { sourceLive, sourceDistrictLive, cannotFlip } from './batch-rules.mjs';
import { effectiveIcons } from './rounds.mjs';
import { effectiveSubtypes, enterTapped, graveyardLocked, cardHasKeyword } from './derived.mjs';
import { controllerOf } from './ownership.mjs';
import { liveSealHost, sealHost, sealedOn } from './sealing.mjs';
import { RuleError } from './core.mjs';
import { createAttachmentSearch } from './attachment-search.mjs';
import { createExpansionEffects } from './expansion-effects.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function createBatchEffects(ctx) {
    const expansion = createExpansionEffects(ctx);
    const spells = createYellowWhiteEffects(ctx);
    const { move, conceal, setLocation, event, seal, draw, choose, finishSpell, log, filterCard, shuffle, destroy, hurt, live, pay } = ctx;
    const attachmentSearch = createAttachmentSearch(ctx);
    function place(s, id, p, d, hidden = false) {
        if (!s.districts[d])
            return false;
        if (!move(s, id, 'play', { controller: p, district: d, tapped: !hidden && enterTapped(s, id, d), faceDown: hidden, ...(hidden ? { hiddenHandle: uuid() } : {}) }))
            return false;
        if (!hidden)
            event(s, id, 'entry', s.locations[id], s.eventGroup, { method: 'effect-placement' });
        return true;
    }
    function flip(s, id, group) {
        const l = s.locations[id];
        if (l?.zone !== 'play' || !l.faceDown || cannotFlip(s, id) || cardHasKeyword(s, id, '混乱') && !chaosEntryDistricts(s, id).length)
            return false;
        for (const sealed of sealedOn(s, id))
            move(s, sealed, 'hand');
        setLocation(s, id, 'play', { controller: controllerOf(s, id), district: l.district, tapped: l.tapped || enterTapped(s, id), faceDown: false, fieldVersion: l.zoneVersion + 1, ...(l.baseController !== undefined ? { baseController: l.baseController } : {}) });
        event(s, id, 'entry', s.locations[id], group, { method: 'effect-reveal' });
        event(s, id, 'reveal', s.locations[id], group);
        return true;
    }
    function blink(s, id, group) {
        const l = s.locations[id];
        if (l?.zone !== 'play' || l.faceDown || !hasCardType(s.cards[id], 'character') || cannotFlip(s, id))
            return false;
        for (const aid of [...s.players.flatMap(pl => pl.play)]) {
            const al = s.locations[aid], c = printedRulesCard(s, aid);
            if (al?.zone !== 'play' || al.faceDown || al.attachedTo !== id || al.hostVersion !== l.zoneVersion || c.automation?.static !== 'borrowed-scroll')
                continue;
            const p = controllerOf(s, aid), col = c.automation.collectionPlan;
            applyCardForm(s, aid, { attachment: col, automation: col });
            al.attachedTo = `society:${p}`;
            al.hostVersion = s.societyVersions?.[p] ?? 0;
            delete al.district;
            event(s, aid, 'attached', al, group, { host: sealHost(s, al.attachedTo) });
            log(s, '咒法古卷持续替代：立即改为收藏并结附于本方秘社，不进入墓地。');
            draw(s, [p], 2);
        }
        if (conceal(s, id, group))
            return flip(s, id, group);
        return false;
    }
    function deter(s, a, count) {
        const player = 1 - a.controller, options = influenceRemovalOptions(s, player);
        if (count > 0 && options.length) {
            choose(s, a, 'batch-deter', player, [], { options, remaining: count });
            return true;
        }
        return false;
    }
    function lossOptions(s, p, kind) {
        if (kind === 'discard')
            return [...s.players[p].hand];
        if (kind === 'asset')
            return s.players[p].assets.map(a => a.id);
        return s.players[p].play.filter(id => { const l = s.locations[id]; return l.zone === 'play' && controllerOf(s, id) === p && (kind === 'hidden' ? l.faceDown : !l.faceDown && hasCardType(s.cards[id], kind)) && !cardHasKeyword(s, id, '永恒'); });
    }
    function orderedLoss(s, a, queue) {
        const names = { discard: '弃一张手牌', character: '牺牲一个角色', attachment: '牺牲一个附属', hidden: '牺牲一个暗藏者', asset: '牺牲一个资产' };
        while (queue.length) {
            const kind = queue[0].kind, end = queue.findIndex(x => x.kind !== kind), steps = end < 0 ? queue : queue.slice(0, end), rest = end < 0 ? [] : queue.slice(end);
            if (simultaneousChoice(s, choose, a, 'batch-ordered-loss', steps.map(step => ({ controller: step.player, cardIds: lossOptions(s, step.player, kind), step })), { remainingSteps: rest, choiceLabel: `${s.cards[a.cardId].name} · ${names[kind]}` }))
                return true;
            queue = rest;
        }
        return false;
    }
    function scapegoatRemove(s, a, p, remaining) {
        const options = influenceRemovalOptions(s, p);
        if (remaining > 0 && options.length) {
            choose(s, a, 'batch-scapegoat-remove', p, [], { options, remaining, choiceLabel: `替罪羊 · 还需移除${remaining}个本方势力标志` });
            return true;
        }
        return false;
    }
    function autumnTransform(s, p) {
        const society = s.societies?.[p], face = s.environmentCatalog?.find(c => c.catalogId === 'ZHMSJZ02');
        if (society?.name === '盛夏王廷' && face && transformCard(s, society.id, face)) {
            s.societies[p] = s.cards[society.id];
            log(s, '秋日之歌：盛夏王廷转变为凛冬王廷，保留同一秘社对象与全部状态。');
        }
    }
    function effect(s, a, plan, targets) {
        const p = a.controller, id = targets[0]?.cardId, op = plan.operation;
        if (spells.handles(op))
            return spells.effect(s, a, plan, targets);
        if (expansion.handles(op))
            return expansion.effect(s, a, plan, targets);
        if (op === 'all-sacrifice-attachment')
            return orderedLoss(s, a, [s.turn.firstPlayer, 1 - s.turn.firstPlayer].map(player => ({ kind: 'attachment', player })));
        if (op === 'attach-modal') {
            const t = targets[0], host = t.kind === 'host' ? t.ref : sealHost(s, t.cardId), district = t.kind === 'card' ? s.locations[t.cardId].district : undefined;
            const selected = { ...plan };
            delete selected.modes;
            delete selected.modeTargets;
            delete selected.cardId;
            if (move(s, a.cardId, 'play', { controller: p, tapped: false, attachedTo: host.hostId, hostVersion: host.version, ...(district !== undefined ? { district } : {}) })) {
                applyCardForm(s, a.cardId, { attachment: selected, automation: selected });
                event(s, a.cardId, 'entry', s.locations[a.cardId], a.id, { method: 'play' });
                event(s, a.cardId, 'attached', s.locations[a.cardId], a.id, { host });
            }
        }
        else if (op === 'cross-return') {
            const l = s.locations[plan.subjectId], district = plan.eventDistrict;
            if (isGraveZone(s, l.zone) && l.zoneVersion === plan.subjectZoneVersion + 1 && s.districts[district]?.id === plan.eventDistrictCardId && !graveyardLocked(s) && move(s, plan.subjectId, 'play', { controller: p, district, tapped: true }))
                event(s, plan.subjectId, 'entry', s.locations[plan.subjectId], a.id, { method: 'effect-placement' });
        }
        else if (op === 'switch-doom-society') {
            const face = s.environmentCatalog?.find(c => c.catalogId === 'MSJZ03');
            if (face && switchSociety(s, p, face))
                log(s, '秘社切换为末日钟，重置横置状态并保留标志、封印牌和结附牌。');
        }
        else if (op === 'lotus-seal-pair') {
            if (sourceLive(s, plan)) {
                const host = sealHost(s, plan.sourceId);
                for (const role of [...s.players[p].play]) {
                    const l = s.locations[role];
                    if (l?.zone === 'play' && !l.faceDown && hasCardType(s.cards[role], 'character') && ['江莲', '江月'].includes(s.cards[role].name))
                        seal(s, role, host, { zone: 'play', zoneVersion: l.zoneVersion });
                }
            }
        }
        else if (op === 'lotus-grave-return') {
            for (const id of [...graveCards(s, p)])
                if ((s.cards[id].subtypes ?? []).some(t => ['法术', '阴'].includes(t)))
                    move(s, id, 'hand');
        }
        else if (op === 'blood-sacrifice-time') {
            const t = targets[0], n = plan.sacrificedCount ?? 0, district = t.kind === 'district' ? t.district : s.locations[t.cardId].district;
            if (t.kind === 'district') {
                const d = s.districts[district];
                d.counters ??= {};
                setCardMarker(s, d, "counter", "time", (d.counters.time ?? 0) + n);
            }
            else
                setCardMarker(s, s.locations[t.cardId], "markers", null, (s.locations[t.cardId].markers ?? 0) + n);
            if (s.districts[district] && districtTimeMarkers(s, district) >= 4)
                s.districts[district].destroyed = 1;
        }
        else if (op === 'priest-sacrifice-destroy') {
            if (sourceDistrictLive(s, plan)) {
                const ids = lossOptions(s, p, 'character').filter(id => id !== plan.sourceId && inEffectDistrict(s, id, plan.sourceDistrict));
                if (ids.length) {
                    choose(s, a, 'batch-priest-sacrifice', p, ids, { public: true, versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])), choiceLabel: '主祭伊兹帕帕洛特 · 牺牲另一个本方角色' });
                    return true;
                }
                s.districts[plan.sourceDistrict].destroyed = 1;
            }
        }
        else if (op === 'shrike-retreat') {
            if (sourceLive(s, plan)) {
                const l = s.locations[plan.sourceId], options = s.districts.flatMap((d, i) => d && i !== l.district && canMoveToDistrict(s, plan.sourceId, i) ? [{ id: `district:${i}`, name: `地区${i + 1} · ${d.name}`, districtCardId: d.id }] : []);
                if (options.length) {
                    choose(s, a, 'batch-shrike-retreat', p, [], { options, choiceLabel: '伯劳 · 移动到另一个地区并潜伏' });
                    return true;
                }
            }
        }
        else if (op === 'next-investigation-draw') {
            s.effects.push({ kind: 'next-investigation-draw', controller: p, sourceId: plan.sourceId, sourceSnapshot: { zone: 'play', zoneVersion: plan.sourceZoneVersion, controller: p, district: plan.sourceDistrict, attachedTo: plan.hostAttachment, hostVersion: plan.hostAttachmentVersion }, duration: 'until-end-of-round' });
        }
        else if (op === 'fairy-sacrifice-search') {
            if (librarySearchBlocked(s)) {
                log(s, '稻荷神社童子：跳过牌库检索，牌库仍洗牌。');
                shuffle(s.players[p].deck);
                autumnTransform(s, p);
            }
            else {
                choose(s, a, 'batch-search-place', p, s.players[p].deck.filter(id => filterCard(s.cards[id], { type: 'character', requireSubtype: '仙灵', maxCost: plan.sacrificedCount ?? 0 })), { canFail: true, hidden: false, postTransform: true });
                return true;
            }
        }
        else if (op === 'transform-source') {
            if (sourceLive(s, plan) && s.cards[plan.sourceId].catalogId === plan.sourceFace) {
                const face = s.automationCards.find(c => c.catalogId === plan.toFace);
                if (face && transformCard(s, plan.sourceId, face))
                    log(s, `转变：${s.cards[plan.sourceId].name}成为${face.subtitle || face.name}，保持同一对象、状态、标志和封印。`);
            }
        }
        else if (op === 'district-nonspirit-wounds') {
            if (sourceDistrictLive(s, plan))
                for (const target of s.players.flatMap(pl => pl.play)) {
                    const l = s.locations[target];
                    if (l.zone === 'play' && !l.faceDown && l.district === plan.sourceDistrict && hasCardType(s.cards[target], 'character') && !cardHasKeyword(s, target, '灵体')) {
                        addWounds(s, target, 1, { event, group: a.id });
                    }
                }
        }
        else if (op === 'grant-own-other-keywords') {
            s.effects.push({ kind: 'subtype-keywords', controller: p, keywords: plan.grantKeywords, excludeId: plan.sourceId, excludeVersion: plan.sourceZoneVersion, duration: 'until-end-of-round' });
        }
        else if (op === 'conceal-source-rest') {
            if (sourceLive(s, plan) && conceal(s, plan.sourceId, a.id)) {
                const l = s.locations[plan.sourceId];
                if (l?.zone === 'play' && l.faceDown && l.zoneVersion === plan.sourceZoneVersion + 1) {
                    l.counters ??= {};
                    setCardMarker(s, l, "counter", '休整', (l.counters['休整'] ?? 0) + 1);
                }
            }
        }
        else if (op === 'rest-reveal') {
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && l.faceDown && l.zoneVersion === plan.sourceZoneVersion && (l.counters?.['休整'] ?? 0) > 0)
                flip(s, plan.sourceId, a.id);
        }
        else if (op === 'scapegoat') {
            const enemy = targets[0].player, total = s.districts.reduce((n, d) => n + (d?.influence[enemy] ?? 0), 0), options = [...(total >= 3 ? [{ id: 'remove', name: '移除三个本方势力标志' }] : []), { id: 'sacrifice', name: lossOptions(s, enemy, 'character').length ? '牺牲一个本方角色' : '不移除势力（没有可牺牲的角色）' }];
            choose(s, a, 'batch-scapegoat', enemy, [], { options, choiceLabel: '替罪羊 · 移除势力或牺牲角色' });
            return true;
        }
        else if (op === 'kadran-loss') {
            const players = [s.turn.firstPlayer, 1 - s.turn.firstPlayer], queue = ['discard', 'character', 'attachment', 'hidden', 'asset'].flatMap(kind => players.map(player => ({ kind, player })));
            if (orderedLoss(s, a, queue))
                return true;
        }
        else if (op === 'choose-undead-subtype') {
            choose(s, a, 'batch-undead-subtype', p, [], { options: ['食尸鬼', '行尸', '骷髅'].map(id => ({ id, name: id })) });
            return true;
        }
        else if (op === 'wine-ritual') {
            s.effects.push({ kind: 'stars-to-battle', targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: 'until-end-of-round' }, { kind: 'grant-keyword', keyword: '灵体', targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: 'until-end-of-round' });
        }
        else if (op === 'transfer-markers') {
            if (targets.length === 2 && controllerOf(s, targets[0].cardId) === controllerOf(s, targets[1].cardId)) {
                const from = s.locations[targets[0].cardId], to = s.locations[targets[1].cardId];
                for (const k of ['markers', 'wounds'])
                    if (from[k]) {
                        if (k === 'markers') {
                            setCardMarker(s, to, k, null, (to[k] ?? 0) + from[k]);
                            setCardMarker(s, from, k, null, 0);
                        }
                        else {
                            to[k] = (to[k] ?? 0) + from[k];
                            from[k] = 0;
                        }
                    }
                // District influence is stored separately. A role's influence counter
                // grants a black-star icon and is an ordinary transferable counter.
                to.counters ??= {};
                for (const [key, n] of Object.entries(from.counters ?? {}))
                    if (key !== '势力' && Number.isFinite(n) && n > 0) {
                        setCardMarker(s, to, "counter", key, (to.counters[key] ?? 0) + n);
                        delete from.counters[key];
                    }
            }
        }
        else if (op === 'seal-dead-subject-paid') {
            const l = s.locations[plan.subjectId];
            if (isGraveZone(s, l.zone) && l.zoneVersion === plan.subjectZoneVersion + 1 && !graveyardLocked(s))
                seal(s, plan.subjectId, sealHost(s, targets[0].cardId), { zone: l.zone, zoneVersion: l.zoneVersion });
        }
        // Older room snapshots retain their original payment during resolution.
        else if (op === 'seal-dead-subject') {
            const l = s.locations[plan.subjectId];
            if (isGraveZone(s, l.zone) && l.zoneVersion === plan.subjectZoneVersion + 1 && !graveyardLocked(s)) {
                choose(s, a, 'batch-pay-seal-dead', p, [], { options: [{ id: 'pay', name: '支付2费用并封印墓地中的角色' }, { id: 'decline', name: '不支付，不封印' }] });
                return true;
            }
        }
        else if (op === 'grave-source-enter') {
            const l = s.locations[plan.sourceId];
            if (isGraveZone(s, l.zone) && l.zoneVersion === plan.sourceZoneVersion && !graveyardLocked(s) && sourceDistrictLive(s, plan))
                place(s, plan.sourceId, p, plan.sourceDistrict);
        }
        else if (op === 'seal-source-grave') {
            const l = s.locations[plan.sourceId];
            if (isGraveZone(s, l.zone) && l.zoneVersion === plan.sourceZoneVersion && !graveyardLocked(s))
                seal(s, plan.sourceId, sealHost(s, 'district-host:' + targets[0].cardId), { zone: l.zone, zoneVersion: l.zoneVersion });
        }
        else if (op === 'district-barrier-lock') {
            if (sourceDistrictLive(s, plan))
                for (const role of s.players.flatMap(pl => pl.play)) {
                    const l = s.locations[role];
                    if (l.zone === 'play' && !l.faceDown && l.district === plan.sourceDistrict && hasCardType(s.cards[role], 'character'))
                        s.effects.push({ kind: 'barrier-lock', targetId: role, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' });
                }
        }
        else if (op === 'target-direct-reveal') {
            if (!plan.revealSubtype || effectiveSubtypes(s, id).includes(plan.revealSubtype))
                flip(s, id, a.id);
        }
        else if (op === 'vampire-direct-reveal') {
            if (effectiveSubtypes(s, id).includes('吸血鬼'))
                flip(s, id, a.id);
        }
        else if (op === 'source-direct-reveal') {
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && l.faceDown && l.zoneVersion === plan.sourceZoneVersion)
                flip(s, plan.sourceId, a.id);
        }
        else if (op === 'reveal-until-end') {
            if (flip(s, id, a.id)) {
                const l = s.locations[id];
                s.effects.push({ kind: 'round-end-conceal', targetId: id, targetZoneVersion: l.zoneVersion, controller: p, displayName: s.cards[id].name });
                log(s, `${s.cards[id].name}因临时征召现身；此对象在回合结束时潜伏。`);
            }
        }
        else if (op === 'discard-each') {
            if (orderedLoss(s, a, [s.turn.firstPlayer, 1 - s.turn.firstPlayer].map(player => ({ kind: 'discard', player }))))
                return true;
        }
        else if (op === 'search-attach')
            return attachmentSearch.start(s, { ...a, plan, targets });
        else if (op === 'source-seal') {
            if (sourceLive(s, plan))
                seal(s, plan.sourceId, sealHost(s, id), { zone: 'play', zoneVersion: plan.sourceZoneVersion });
        }
        else if (op === 'sealed-host-defense') {
            const host = plan.eventHost;
            if (liveSealHost(s, host) && host.kind === 'card' && s.locations[host.hostId]?.zone === 'play' && !s.locations[host.hostId].faceDown && hasCardType(s.cards[host.hostId], 'character'))
                s.effects.push({ kind: 'modify-defense', amount: -1, targetId: host.hostId, targetZoneVersion: s.locations[host.hostId].zoneVersion, duration: 'until-end-of-round' });
        }
        else if (op === 'sealed-host-tap') {
            const host = plan.eventHost;
            if (liveSealHost(s, host) && host.kind === 'card' && s.locations[host.hostId]?.zone === 'play' && !s.locations[host.hostId].faceDown && hasCardType(s.cards[host.hostId], 'character')) {
                if (a.mode === 'tap')
                    tapCard(s, host.hostId);
                else
                    resetCard(s, host.hostId);
            }
        }
        else if (op === 'tap-host-wound') {
            const host = s.locations[plan.hostAttachment];
            if (host?.zone === 'play' && !host.faceDown && host.zoneVersion === plan.hostAttachmentVersion)
                tapCard(s, plan.hostAttachment);
            addWounds(s, id, 1, { event, group: a.id });
        }
        else if (op === 'score-source') {
            if (sourceLive(s, plan)) {
                const card = printedRulesCard(s, plan.sourceId);
                move(s, plan.sourceId, 'score', { controller: p });
                s.players[p].scoreCards.push(scoredCard(s, p, { ...card, points: plan.points ?? 1 }));
            }
        }
        else if (op === 'garden-gnome') {
            if (sourceLive(s, plan))
                applyCardForm(s, plan.sourceId, { type: 'character/attachment', subtypes: ['地精'], icons: { investigation: 0, battle: 1, influence: 1 }, temporaryIcons: { investigation: 1, battle: 0, influence: 0 }, defense: 1 }, { duration: 'until-end-of-round' });
        }
        else if (op === 'slave-blood-return') {
            const source = plan.sourceId, l = s.locations[source], target = targets[0];
            if (isGraveZone(s, l.zone) && l.zoneVersion === plan.sourceAfterCostVersion && !graveyardLocked(s)) {
                const attachment = { kind: 'attachment', timing: 'standard', target: 'vampire-character', effect: 'attach', bonus: { defense: 1, battle: 1 } };
                if (move(s, source, 'play', { controller: p, district: s.locations[id].district, tapped: false, attachedTo: id, hostVersion: target.zoneVersion })) {
                    applyCardForm(s, source, { name: '鲜血', displayName: '鲜血', type: 'attachment', subtypes: [], text: '结附于目标吸血鬼角色\n持续：受此结附的角色获得1防御力和［黑刀］。', icons: { investigation: 0, battle: 0, influence: 0 }, temporaryIcons: { investigation: 0, battle: 0, influence: 0 }, defense: undefined, keywords: [], conditionalKeywords: {}, noEquipment: false, noAttachments: false, cannotMove: false, action: undefined, spell: undefined, attachment, automation: attachment, hiddenAbilities: [] });
                    event(s, source, 'entry', s.locations[source], a.id, { method: 'effect-placement' });
                    event(s, source, 'attached', s.locations[source], a.id, { host: sealHost(s, id) });
                }
            }
        }
        else if (op === 'cursed-hourglass') {
            if (sourceLive(s, plan)) {
                const l = s.locations[plan.sourceId];
                setCardMarker(s, l, "markers", null, (l.markers ?? 0) + 1);
            }
            if (sourceDistrictLive(s, plan)) {
                const count = districtTimeMarkers(s, plan.sourceDistrict);
                for (const role of s.players.flatMap(pl => pl.play))
                    if (!s.locations[role].faceDown && s.locations[role].district === plan.sourceDistrict && hasCardType(s.cards[role], 'character'))
                        hurt(s, role, count);
                if (count >= 3 && sourceLive(s, plan))
                    move(s, plan.sourceId, 'graveyard', { cause: 'sacrifice' });
            }
        }
        else if (op === 'next-discount')
            s.effects.push({ kind: 'next-cost-discount', controller: p, amount: plan.amountFrom === 'paid-time' ? plan.paidTime : plan.amount ?? 1, filter: plan.filter ?? {}, playOnly: !!plan.playOnly, duration: 'until-end-of-round' });
        else if (op === 'jiang-reveal-time') {
            choose(s, a, 'batch-domain-reveal-time', p, [...s.players[p].hand], { min: 0, max: s.players[p].hand.length, choiceLabel: '江敬寒 · 展示同领域或均无领域的手牌' });
            return true;
        }
        else if (op === 'jiang-book-discount') {
            const iconId = uuid();
            if (sourceLive(s, plan))
                s.effects.push({ id: iconId, kind: 'modify-icons', white: true, icon: 'investigation', amount: 1, targetId: plan.sourceId, targetZoneVersion: plan.sourceZoneVersion, duration: 'until-end-of-round' });
            s.effects.push({ kind: 'next-cost-discount', controller: p, amount: 1, filter: { any: [{ subtype: '法器' }, { subtype: '书籍' }] }, playOnly: true, linkedIconEffectId: iconId, duration: 'until-end-of-round' });
        }
        else if (op === 'vampire-icon-discard') {
            const l = s.locations[plan.subjectId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.subjectZoneVersion) {
                l.counters ??= {};
                setCardMarker(s, l, "counter", "battle", (l.counters.battle ?? 0) + 1);
            }
            const player = targets[0]?.player;
            if ([0, 1].includes(player) && s.players[player].hand.length) {
                choose(s, a, 'discard', player, [...s.players[player].hand]);
                return true;
            }
        }
        else if (op === 'dust-hidden-destroy') {
            if (loyaltyAssets(s, p).some(a => (a.factionColors ?? [a.faction?.split('·')[0]]).includes('黄')) && targets[0])
                destroy(s, targets[0].cardId);
        }
        else if (op === 'destroy-all-attachments') {
            const ids = s.players.flatMap(pl => pl.play).filter(id => !s.locations[id].faceDown && hasCardType(s.cards[id], 'attachment'));
            beginEventGroup(s, a.id);
            for (const id of ids)
                if (s.locations[id]?.zone === 'play')
                    destroy(s, id);
            endEventGroup(s);
        }
        else if (op === 'grave-hidden-at-death') {
            const id = plan.sourceId, l = s.locations[id], d = plan.eventDistrict;
            if (inGrave(s, id, id) && l.zoneVersion === plan.sourceZoneVersion && s.districts[d]?.id === plan.eventDistrictCardId && !graveyardLocked(s, id, p, l.zone))
                place(s, id, p, d, true);
        }
        else if (op === 'destroy-conditional-attachment') {
            const l = s.locations[id];
            if (hasCardType(s.cards[l.attachedTo], 'character') || s.players[p].assets.some(x => x.magicDomains?.includes('心灵')))
                destroy(s, id);
        }
        else if (op === 'tap-destroy-seals') {
            tapCard(s, id);
            for (const sealed of sealedOn(s, id))
                move(s, sealed, 'graveyard', { cause: 'destroy' });
        }
        else if (op === 'source-bounce') {
            if (sourceLive(s, plan))
                move(s, plan.sourceId, 'hand');
        }
        else if (op === 'grave-top') {
            move(s, id, 'deck');
            const owner = s.cards[id].owner;
            s.players[owner].deck = s.players[owner].deck.filter(x => x !== id);
            s.players[owner].deck.unshift(id);
        }
        else if (op === 'deter') {
            if (deter(s, a, plan.amountFrom === 'humans' ? s.players.flatMap(pl => pl.play).filter(id => !s.locations[id].faceDown && inEffectDistrict(s, id, plan.sourceDistrict) && hasCardType(s.cards[id], 'character') && effectiveSubtypes(s, id).includes('人类')).length : plan.amountFrom === 'discard-count' ? plan.eventCount ?? 0 : plan.count ?? 1))
                return true;
        }
        else if (op === 'seal-deter') {
            if (seal(s, id, plan.hostRef, { zone: 'play', zoneVersion: targets[0].zoneVersion }) && deter(s, a, 1))
                return true;
        }
        else if (op === 'source-influence') {
            if (sourceDistrictLive(s, plan))
                placeRegionInfluence(s, plan.sourceDistrict, p, plan.amountFrom === 'draw-count' ? plan.eventCount ?? 0 : plan.count ?? 1);
        }
        else if (op === 'source-swap-influence') {
            if (sourceDistrictLive(s, plan)) {
                swapRegionInfluence(s, plan.sourceDistrict, p);
            }
        }
        else if (op === 'target-time') {
            setCardMarker(s, s.locations[id], "markers", null, (s.locations[id].markers ?? 0) + (plan.amount ?? 1));
        }
        else if (op === 'source-time') {
            if (sourceLive(s, plan)) {
                const l = s.locations[plan.sourceId];
                setCardMarker(s, l, "markers", null, (l.markers ?? 0) + 1);
            }
        }
        else if (op === 'counter') {
            const l = s.locations[id];
            l.counters ??= {};
            setCardMarker(s, l, "counter", plan.counter, (l.counters[plan.counter] ?? 0) + (plan.amount ?? 1));
        }
        else if (op === 'target-time-destroy-region') {
            const l = s.locations[id];
            setCardMarker(s, l, "markers", null, (l.markers ?? 0) + 1);
            const district = l.district, d = s.districts[district];
            if (d && districtTimeMarkers(s, district) >= 4) {
                d.destroyed = 1;
                log(s, `蚀刻头骨：目标所在地区${district + 1}的时间标志达到四个，毁灭${d.name}。`);
            }
        }
        else if (op === 'time-adjust') {
            choose(s, a, 'batch-time-adjust', p, [], { options: [{ id: 'add', name: '放置一个时间标志' }, { id: 'remove', name: '移除一个时间标志' }] });
            return true;
        }
        else if (op === 'host-icons') {
            const id = plan.hostAttachment, l = s.locations[id];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.hostAttachmentVersion)
                for (const [icon, amount] of Object.entries(plan.icons))
                    s.effects.push({ kind: 'modify-icons', icon, amount, targetId: id, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' });
        }
        else if (op === 'host-barrier-predict') {
            const id = plan.hostAttachment, l = s.locations[id];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.hostAttachmentVersion)
                s.effects.push({ kind: 'barrier', targetId: id, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' });
            choose(s, a, 'predict', p, s.players[p].deck.slice(0, 1));
            return true;
        }
        else if (op === 'hand-elf-place') {
            const max = effectiveIcons(s, plan.sourceId, true).battle;
            const eligible = s.players[p].hand.filter(id => hasCardType(s.cards[id], 'character') && effectiveSubtypes(s, id).includes('仙灵') && (s.cards[id].icons?.battle ?? 0) + (s.cards[id].temporaryIcons?.battle ?? 0) <= max);
            if (eligible.length) {
                choose(s, a, 'batch-hand-place', p, eligible);
                return true;
            }
        }
        else if (op === 'printed-defense-one') {
            for (const id of s.players.flatMap(pl => pl.play)) {
                const l = s.locations[id];
                if (l.zone === 'play' && !l.faceDown && l.district === plan.sourceDistrict && hasCardType(s.cards[id], 'character') && effectiveMagicDomains(s, id).length)
                    s.effects.push({ kind: 'printed-defense', value: 1, targetId: id, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' });
            }
        }
        else if (op === 'move-target') {
            const l = s.locations[id], d = a.district;
            if (l.zone === 'play' && s.districts[d]?.id === plan.destinationCardId && d !== l.district && relocate(s, id, d)) {
                event(s, id, 'move', l, a.id, { district: d });
                if (plan.elfBonus && effectiveSubtypes(s, id).includes('仙灵'))
                    s.effects.push({ kind: 'modify-icons', icon: 'battle', amount: 1, targetId: id, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' });
            }
        }
        else if (op === 'blink') {
            blink(s, id, a.id);
        }
        else if (op === 'inspect-hidden') {
            choose(s, a, 'batch-inspect', p, [id]);
            return true;
        }
        else if (op === 'inspect-hand') {
            choose(s, a, 'batch-inspect', p, [...s.players[targets[0].player].hand]);
            return true;
        }
        else if (op === 'poison-hidden') {
            if (sourceDistrictLive(s, plan) && loyaltyAssets(s, p).filter(a => (a.factionColors ?? [a.faction?.split('·')[0]]).includes('蓝')).length >= 2) {
                const ids = s.players[1 - p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && inEffectDistrict(s, id, plan.sourceDistrict) && hasCardType(s.cards[id], 'character'));
                if (ids.length) {
                    const min = Math.min(...ids.map(id => s.cards[id].printedCost)), lowest = ids.filter(id => s.cards[id].printedCost === min);
                    shuffle(lowest);
                    destroy(s, lowest[0]);
                }
            }
        }
        else if (op === 'ambusher-hidden') {
            if (sourceDistrictLive(s, plan)) {
                const ids = s.players[plan.operator].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && inEffectDistrict(s, id, plan.sourceDistrict) && hasCardType(s.cards[id], 'character'));
                if (ids.length) {
                    choose(s, a, 'batch-ambusher-wound', plan.operator, ids, { public: true, district: plan.sourceDistrict, districtCardId: plan.sourceDistrictCardId, versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])) });
                    return true;
                }
            }
        }
        else if (op === 'wanted-name') {
            const names = [...new Set(s.characterNames ?? [...s.automationCards, ...s.reserveTemplates ?? []].filter(c => hasCardType(c, 'character')).map(c => c.name))].sort();
            choose(s, a, 'batch-wanted-name', p, [], { options: names.map(name => ({ id: name, name })), choiceLabel: '通缉令 · 说出一个角色牌名称' });
            return true;
        }
        else if (op === 'wanted-destroy') {
            if (sourceLive(s, plan))
                move(s, plan.sourceId, 'graveyard', { cause: 'sacrifice' });
            const l = s.locations[plan.subjectId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.subjectZoneVersion)
                destroy(s, plan.subjectId);
        }
        else if (op === 'inspect-top') {
            const player = targets[0].player;
            choose(s, a, 'batch-inspect', p, hardDeckCards(s, player, 1));
            return true;
        }
        else if (op === 'shuffle-player')
            shuffle(s.players[targets[0].player].deck);
        else if (op === 'asset-bounce-source-asset') {
            move(s, id, 'hand');
            if (sourceLive(s, plan))
                move(s, plan.sourceId, 'asset', { controller: p, tapped: true });
        }
        else if (op === 'top-hidden') {
            if (librarySearchBlocked(s)) {
                log(s, '稻荷神社童子：跳过牌库检索，牌库仍洗牌。');
                shuffle(s.players[p].deck);
            }
            else {
                const ids = s.players[p].deck.slice(0, plan.count), eligible = ids.filter(id => filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id) }, plan.searchFilter ?? plan.filter));
                choose(s, a, 'batch-top-place', p, ids, { eligibleIds: eligible, min: 0, max: plan.max ?? 1, hidden: plan.hidden !== false });
                return true;
            }
        }
        else if (op === 'search-hidden-district') {
            if (librarySearchBlocked(s)) {
                log(s, '稻荷神社童子：跳过牌库检索，牌库仍洗牌。');
                shuffle(s.players[p].deck);
            }
            else {
                choose(s, a, 'batch-search-place', p, s.players[p].deck.filter(id => filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id) }, plan.filter)), { canFail: true, hidden: true });
                return true;
            }
        }
        else if (op === 'search-many') {
            if (librarySearchBlocked(s)) {
                log(s, '稻荷神社童子：跳过牌库检索，牌库仍洗牌。');
                shuffle(s.players[p].deck);
            }
            else {
                choose(s, a, 'batch-top-place', p, [...s.players[p].deck], { eligibleIds: s.players[p].deck.filter(id => filterCard(s.cards[id], plan.filter)), min: 0, max: plan.max, search: true });
                return true;
            }
        }
        else if (op === 'own-sacrifice-destroy') {
            destroy(s, id);
        }
        else if (op === 'conceal-influence') {
            if (conceal(s, id, a.id) && sourceDistrictLive(s, plan))
                placeRegionInfluence(s, plan.sourceDistrict, p);
        }
        else if (op === 'all-grave-shuffle') {
            const player = targets[0].player, ids = [...graveCards(s, player), a.cardId];
            for (const id of ids)
                if (inGrave(s, id) || id === a.cardId && s.locations[id]?.zone === 'stack')
                    move(s, id, 'deck');
            for (const owner of new Set(ids.map(id => s.cards[id].owner)))
                shuffle(s.players[owner].deck);
            if (deter(s, a, 1))
                return true;
        }
        else if (op === 'wound-district') {
            const d = targets[0].district;
            for (const id of s.players.flatMap(pl => pl.play))
                if (s.locations[id].district === d && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character')) {
                    addWounds(s, id, 1, { event, group: a.id });
                }
        }
        else if (op === 'damage-destroyed') {
            for (const id of s.players.flatMap(pl => pl.play))
                if (!s.locations[id].faceDown && hasCardType(s.cards[id], 'character') && s.districts[s.locations[id].district]?.destroyed)
                    hurt(s, id, 1);
        }
        else if (op === 'destroy-all') {
            const ids = [...s.players.flatMap(pl => pl.play)].sort((a, b) => Number(hasCardType(s.cards[b], 'character')) - Number(hasCardType(s.cards[a], 'character')));
            beginEventGroup(s, a.id);
            for (const id of ids)
                if (s.locations[id].zone === 'play')
                    destroy(s, id);
            endEventGroup(s);
            for (const d of s.districts)
                if (d)
                    d.destroyed = 1;
        }
        else if (op === 'shuffle-battle-district') {
            const owners = new Set();
            for (const id of [...s.players.flatMap(pl => pl.play)])
                if (!s.locations[id].faceDown && inEffectDistrict(s, id, targets[0].district) && hasCardType(s.cards[id], 'character') && effectiveIcons(s, id, true).battle > 0) {
                    owners.add(s.cards[id].owner);
                    move(s, id, 'deck');
                }
            for (const owner of owners)
                shuffle(s.players[owner].deck);
        }
        else if (op === 'locked-or-damage') {
            if (s.locations[id].counters?.locked)
                hurt(s, id, 1);
            else {
                s.locations[id].counters ??= {};
                setCardMarker(s, s.locations[id], "counter", "locked", 1);
            }
        }
        else if (op === 'inspect-lock') {
            choose(s, a, 'batch-inspect-lock', p, [id]);
            return true;
        }
        else if (op === 'sacrifice-hidden-deter') {
            const enemy = 1 - p, ids = s.players[enemy].play.filter(id => s.locations[id].faceDown && inEffectDistrict(s, id, targets[0].district));
            if (ids.length) {
                choose(s, a, 'batch-sacrifice-hidden', enemy, [], { options: ids.map(id => ({ id, name: `自己的暗藏者 · ${s.cards[id].name}` })) });
                return true;
            }
            if (deter(s, a, 1))
                return true;
        }
        else if (op === 'enemy-district-sacrifice') {
            const enemy = 1 - p, ids = s.players[enemy].play.filter(id => !s.locations[id].faceDown && hasCardType(s.cards[id], 'character') && inEffectDistrict(s, id, plan.sourceDistrict));
            if (s.players[enemy].hand.length <= 3 && ids.length) {
                choose(s, a, 'batch-sacrifice', enemy, ids, { public: true });
                return true;
            }
        }
        else if (op === 'grave-district-attachment') {
            if (sourceDistrictLive(s, plan) && move(s, id, 'play', { controller: p, district: plan.sourceDistrict, tapped: false, attachedTo: `district-host:${plan.sourceDistrictCardId}`, hostVersion: plan.sourceDistrictCardId }))
                event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
        }
        else if (op === 'dead-saints-return') {
            for (const id of Object.keys(s.locations))
                if (inGrave(s, id) && s.cards[id].faction?.split('·')[0] === '白' && s.deathsThisRound?.includes(id))
                    move(s, id, 'hand');
        }
        else if (op === 'predict-counters') {
            choose(s, a, 'predict', p, s.players[p].deck.slice(0, plan.sourceCounters?.time ?? 0));
            return true;
        }
        else if (op === 'seal-grave-predict') {
            if (seal(s, id, plan.hostRef, { zone: s.locations[id].zone, zoneVersion: targets[0].zoneVersion })) {
                choose(s, a, 'predict', p, s.players[p].deck.slice(0, 1));
                return true;
            }
        }
        else if (op === 'destroy-attachment-cost') {
            for (const id of [...s.players.flatMap(pl => pl.play)])
                if (!s.locations[id].faceDown && hasCardType(s.cards[id], 'attachment') && s.cards[id].printedCost <= plan.paidAssetCost)
                    destroy(s, id);
        }
        else if (op === 'destroy-cost-x')
            destroy(s, id);
        else if (op === 'encounter-move') {
            const d = a.district;
            if (s.districts[d]?.id === plan.destinationCardId)
                for (const t of targets) {
                    const l = s.locations[t.cardId];
                    if (l.district === d || !relocate(s, t.cardId, d))
                        continue;
                    event(s, t.cardId, 'move', l, a.id, { district: d });
                }
        }
        else if (op === 'death-discard') {
            const player = targets[0].player, hand = s.players[player].hand;
            if (hand.length) {
                if (plan.subjectSubtypes?.includes('吸血鬼')) {
                    const id = hand[Math.floor(Math.random() * hand.length)];
                    log(s, `${s.seats[player].name}随机弃掉${s.cards[id].name}。`);
                    move(s, id, 'graveyard', { cause: 'discard', effectController: p });
                }
                else {
                    choose(s, a, 'discard', player, [...hand]);
                    return true;
                }
            }
        }
        else if (op === 'source-asset') {
            if (sourceLive(s, plan))
                move(s, plan.sourceId, 'asset', { controller: p, tapped: false });
        }
        else if (op === 'duplicate-counter') {
            const l = s.locations[id], options = [];
            if (l.markers > 0)
                options.push({ id: 'time', name: '时间标志' });
            if (l.wounds > 0)
                options.push({ id: 'wound', name: '创伤标志' });
            for (const [k, n] of Object.entries(l.counters ?? {}))
                if (k !== '势力' && Number.isFinite(n) && n > 0)
                    options.push({ id: 'counter:' + k, name: k === 'locked' ? '锁定标志' : k });
            if (options.length) {
                choose(s, a, 'batch-duplicate-counter', p, [], { options });
                return true;
            }
        }
        else if (op === 'host-sacrifice-return') {
            const ids = s.players[p].play.filter(id => !s.locations[id].faceDown && hasCardType(s.cards[id], 'character') && effectiveSubtypes(s, id).includes('宿主') && !cardHasKeyword(s, id, '永恒'));
            const saved = ids.map(id => ({ id, district: s.locations[id].district, districtId: s.districts[s.locations[id].district]?.id, version: s.locations[id].zoneVersion }));
            beginEventGroup(s, a.id);
            for (const { id } of saved)
                move(s, id, 'graveyard', { cause: 'sacrifice' });
            for (const t of saved)
                if (inGrave(s, t.id) && s.locations[t.id].zoneVersion === t.version + 1 && s.districts[t.district]?.id === t.districtId && !graveyardLocked(s))
                    place(s, t.id, p, t.district);
            endEventGroup(s);
        }
        else if (op === 'skeleton-mill') {
            const player = targets[0].player;
            for (const id of hardDeckCards(s, player, 2, { kind: 'graveyard' }))
                move(s, id, 'graveyard');
            if (plan.sacrificedSubtypes?.includes('骷髅')) {
                choose(s, a, 'batch-optional-draw', p, [], { options: [{ id: 'yes', name: '抓一张牌' }, { id: 'no', name: '不抓牌' }] });
                return true;
            }
        }
        else if (op === 'amnesia-hand') {
            const hand = s.players[targets[0].player].hand;
            if (hand.length) {
                const id = hand[Math.floor(Math.random() * hand.length)], owner = s.cards[id].owner;
                log(s, `失忆展示${s.cards[id].name}并置于其拥有者牌库顶。`);
                if (move(s, id, 'deck')) {
                    s.players[owner].deck = s.players[owner].deck.filter(x => x !== id);
                    s.players[owner].deck.unshift(id);
                    rememberHardDeckCards(s, [id]);
                }
            }
        }
        else if (op === 'amnesia-shuffle') {
            if (s.players[p].play.some(id => !s.locations[id].faceDown && hasCardType(s.cards[id], 'character') && effectiveSubtypes(s, id).includes('梦魇'))) {
                choose(s, a, 'batch-optional-shuffle', p, [], { options: [{ id: 'yes', name: '令目标玩家洗牌' }, { id: 'no', name: '不洗牌' }] });
                return true;
            }
        }
        else if (op === 'remove-wound-predict') {
            setCardMarker(s, s.locations[id], "wounds", null, Math.max(0, (s.locations[id].wounds ?? 0) - 1));
            choose(s, a, 'predict', p, s.players[p].deck.slice(0, 1));
            return true;
        }
        else if (op === 'legislator-state') {
            if (sourceLive(s, plan)) {
                if (plan.selectedMode === 'tap')
                    tapCard(s, plan.sourceId);
                else if (plan.selectedMode === 'reset')
                    resetCard(s, plan.sourceId);
            }
        }
        else if (op === 'martial-upkeep') {
            if (sourceLive(s, plan)) {
                choose(s, a, 'batch-martial-upkeep', p, [], { options: [{ id: 'pay', name: '支付1费用' }, { id: 'sacrifice', name: '不支付，牺牲戒严' }] });
                return true;
            }
        }
        else if (op === 'argus-upkeep') {
            if (sourceLive(s, plan)) {
                choose(s, a, 'batch-argus-upkeep', p, [], { options: [{ id: 'pay', name: '支付1费用' }, { id: 'tap', name: '不支付，横置阿格斯IV' }] });
                return true;
            }
        }
        else if (op === 'source-counter') {
            if (sourceLive(s, plan)) {
                const l = s.locations[plan.sourceId];
                l.counters ??= {};
                setCardMarker(s, l, "counter", plan.counter, (l.counters[plan.counter] ?? 0) + 1);
            }
        }
        else if (op === 'damage-amount-wound') {
            const amount = plan.eventCount ?? 0;
            if (amount > 0) {
                const l = s.locations[id];
                addWounds(s, id, amount, { event, group: a.id });
            }
        }
        else if (op === 'host-wound') {
            const l = s.locations[plan.subjectId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.subjectZoneVersion) {
                addWounds(s, plan.subjectId, 1, { event, group: a.id });
            }
        }
        else if (op === 'pay-blink' || op === 'pay-vampire-icon-discard') {
            choose(s, a, 'batch-pay-event', p, [], { options: [{ id: 'pay', name: `支付${plan.payAmount}费用并执行效果` }, { id: 'decline', name: '不支付' }] });
            return true;
        }
        else if (op === 'tap-self-destroy') {
            if (sourceLive(s, plan) && canTapCard(s, plan.sourceId)) {
                choose(s, a, 'batch-tap-self-destroy', p, [], { options: [{ id: 'tap', name: '横置伊丽莎白并消灭目标' }, { id: 'decline', name: '不横置' }] });
                return true;
            }
        }
        else if (op === 'hound-move') {
            if (sourceLive(s, plan)) {
                const l = s.locations[plan.sourceId], d = s.locations[id].district;
                if (relocate(s, plan.sourceId, d)) {
                    s.effects.push({ kind: 'modify-icons', icon: 'investigation', amount: 1, targetId: plan.sourceId, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' });
                    if (d !== plan.sourceDistrict)
                        event(s, plan.sourceId, 'move', l, a.id, { district: d });
                }
            }
        }
        else if (op === 'hacker-hand') {
            const cards = [...s.players[targets[0].player].hand];
            log(s, `${s.seats[targets[0].player].name}展示手牌：${cards.map(id => s.cards[id].name).join('、') || '空'}。`);
            if (cards.length) {
                choose(s, a, 'batch-hacker-hand', p, cards, { public: true, canSkip: true, versions: Object.fromEntries(cards.map(id => [id, s.locations[id].zoneVersion])) });
                return true;
            }
        }
        else if (op === 'honor') {
            changeHonor(s, p, plan.amount ?? 2);
            log(s, `${s.seats[p].name}获得${plan.amount ?? 2}名誉点。`);
        }
        else if (op === 'optional-self-seal') {
            if (targets[0] && s.locations[a.cardId]?.zone === 'stack') {
                choose(s, a, 'batch-optional-self-seal', p, [], { options: [{ id: 'seal', name: '将远古先祖的回应封印在选定黄昏地区上' }, { id: 'decline', name: '不封印，结算后进入墓地' }] });
                return true;
            }
        }
        else
            throw new RuleError('未接入的卡牌结算操作');
        return false;
    }
    function choice(s, p, c, x) {
        if (x.kind.startsWith('batch-spells-'))
            return spells.choice(s, p, c, x);
        const a = x.spell, plan = a.plan;
        if (x.kind.startsWith('batch-expansion-')) {
            expansion.choice(s, p, c, x);
            return;
        }
        if (x.kind.startsWith('batch-attachment-')) {
            attachmentSearch.choice(s, p, c, x);
            return;
        }
        if (x.kind === 'batch-scapegoat') {
            need(x.options.some(o => o.id === c.cardId), '请选择移除势力或牺牲角色');
            if (c.cardId === 'remove') {
                need(s.districts.reduce((n, d) => n + (d?.influence[p] ?? 0), 0) >= 3, '本方势力不足三个');
                if (scapegoatRemove(s, a, p, 3))
                    return;
            }
            else if (orderedLoss(s, a, [{ player: p, kind: 'character' }]))
                return;
        }
        else if (x.kind === 'batch-scapegoat-remove') {
            need(x.options.some(o => o.id === c.cardId), '请选择具有本方势力的地区');
            need(removeSelectedInfluence(s, p, c.cardId), '势力标志已改变');
            if (scapegoatRemove(s, a, p, x.remaining - 1))
                return;
        }
        else if (x.kind === 'batch-ordered-loss') {
            if (x.simultaneous) {
                const selections = commitChoice(x, p, { cardId: c.cardId }, (own, c) => need(own.cardIds.includes(c.cardId) && lossOptions(s, p, own.step.kind).includes(c.cardId), '请选择仍然合法的本方卡牌'));
                if (!selections)
                    return;
                beginEventGroup(s, a.id);
                try {
                    withSimultaneousDepartures(s, selections.map(x => x.command.cardId), () => {
                        const discards = selections.filter(y => y.choice.step.kind === 'discard').map(y => y.command.cardId);
                        if (discards.length)
                            discardMany(s, discards, move, event, { cause: 'discard', effectController: a.controller });
                        for (const y of selections)
                            if (y.choice.step.kind !== 'discard' && lossOptions(s, y.player, y.choice.step.kind).includes(y.command.cardId))
                                move(s, y.command.cardId, 'graveyard', { cause: 'sacrifice' });
                    });
                }
                finally {
                    endEventGroup(s);
                }
            }
            else {
                need(x.cardIds.includes(c.cardId) && lossOptions(s, p, x.step.kind).includes(c.cardId), '请选择仍然合法的本方卡牌');
                beginEventGroup(s, a.id);
                try {
                    move(s, c.cardId, 'graveyard', { cause: x.step.kind === 'discard' ? 'discard' : 'sacrifice', effectController: a.controller });
                }
                finally {
                    endEventGroup(s);
                }
            }
            if (orderedLoss(s, a, x.remainingSteps))
                return;
        }
        else if (x.kind === 'batch-priest-sacrifice') {
            need(x.cardIds.includes(c.cardId) && s.locations[c.cardId]?.zone === 'play' && !s.locations[c.cardId].faceDown && s.locations[c.cardId].zoneVersion === x.versions[c.cardId] && controllerOf(s, c.cardId) === p && s.locations[c.cardId].district === plan.sourceDistrict && hasCardType(s.cards[c.cardId], 'character') && !cardHasKeyword(s, c.cardId, '永恒'), '请选择仍然合法的本方角色');
            if (sourceDistrictLive(s, plan)) {
                move(s, c.cardId, 'graveyard', { cause: 'sacrifice' });
                s.districts[plan.sourceDistrict].destroyed = 1;
            }
        }
        else if (x.kind === 'batch-shrike-retreat') {
            const option = x.options.find(o => o.id === c.cardId);
            need(option, '请选择合法移动地区');
            const d = Number(c.cardId.slice(9));
            if (sourceLive(s, plan) && s.districts[d]?.id === option.districtCardId && relocate(s, plan.sourceId, d)) {
                event(s, plan.sourceId, 'move', s.locations[plan.sourceId], a.id, { district: d });
                conceal(s, plan.sourceId, a.id);
            }
        }
        else if (x.kind === 'batch-undead-subtype') {
            need(['食尸鬼', '行尸', '骷髅'].includes(c.cardId), '请选择食尸鬼、行尸或骷髅');
            if (sourceLive(s, plan))
                s.locations[plan.sourceId].chosenSubtype = c.cardId;
        }
        else if (x.kind === 'batch-martial-upkeep') {
            need(['pay', 'sacrifice'].includes(c.cardId), '请选择支付或牺牲');
            if (sourceLive(s, plan)) {
                if (c.cardId === 'pay')
                    pay(s, p, 1);
                else
                    move(s, plan.sourceId, 'graveyard', { cause: 'sacrifice' });
            }
        }
        else if (x.kind === 'batch-argus-upkeep') {
            need(['pay', 'tap'].includes(c.cardId), '请选择支付或横置');
            if (sourceLive(s, plan)) {
                if (c.cardId === 'pay')
                    pay(s, p, 1);
                else
                    tapCard(s, plan.sourceId);
            }
        }
        else if (x.kind === 'batch-domain-reveal-time') {
            const ids = c.cardIds;
            need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => x.cardIds.includes(id) && s.players[p].hand.includes(id)), '请选择仍在手中的不同卡牌');
            const domains = ids.map(id => effectiveMagicDomains(s, id));
            need(!ids.length || domains.every(d => !d.length) || domains[0].some(d => domains.every(ds => ds.includes(d))), '所选手牌须共享一个魔法领域图标，或都不具有魔法领域图标');
            log(s, `${s.seats[p].name}因江敬寒展示${ids.length}张手牌：${ids.map(id => s.cards[id].name).join('、') || '无'}。`);
            if (sourceLive(s, plan)) {
                const l = s.locations[plan.sourceId];
                setCardMarker(s, l, "markers", null, (l.markers ?? 0) + Math.floor(ids.length / 2));
            }
        }
        else if (x.kind === 'batch-pay-event') {
            need(['pay', 'decline'].includes(c.cardId), '请选择是否支付费用');
            if (c.cardId === 'pay') {
                if (plan.operation === 'pay-blink') {
                    const t = a.targets[0];
                    if (live(s, p, plan, t)) {
                        pay(s, p, plan.payAmount);
                        blink(s, t.cardId, a.id);
                    }
                }
                else {
                    pay(s, p, plan.payAmount);
                    const l = s.locations[plan.subjectId];
                    if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.subjectZoneVersion) {
                        l.counters ??= {};
                        setCardMarker(s, l, "counter", "battle", (l.counters.battle ?? 0) + 1);
                    }
                    const player = a.targets[0].player, hand = s.players[player].hand;
                    if (hand.length) {
                        choose(s, a, 'discard', player, [...hand]);
                        return;
                    }
                }
            }
        }
        else if (x.kind === 'batch-tap-self-destroy') {
            need(['tap', 'decline'].includes(c.cardId), '请选择是否横置');
            const t = a.targets[0];
            if (c.cardId === 'tap' && sourceLive(s, plan) && live(s, p, plan, t) && tapCard(s, plan.sourceId))
                destroy(s, t.cardId);
        }
        else if (x.kind === 'batch-hacker-hand') {
            if (c.skip !== true) {
                need(x.cardIds.includes(c.cardId) && s.players[a.targets[0].player].hand.includes(c.cardId) && s.locations[c.cardId].zoneVersion === x.versions[c.cardId], '请选择仍在该玩家手中的展示牌');
                if (sourceLive(s, plan) && !cardHasKeyword(s, plan.sourceId, '永恒') && move(s, plan.sourceId, 'graveyard', { cause: 'sacrifice' }))
                    move(s, c.cardId, 'graveyard', { cause: 'discard', effectController: p });
            }
        }
        else if (x.kind === 'batch-optional-self-seal') {
            need(['seal', 'decline'].includes(c.cardId), '请选择是否封印');
            const t = a.targets[0];
            if (c.cardId === 'seal' && s.locations[a.cardId]?.zone === 'stack' && live(s, p, plan, t) && districtTraits(s, t.district).includes('黄昏'))
                seal(s, a.cardId, sealHost(s, 'district-host:' + t.cardId), { zone: 'stack', zoneVersion: s.locations[a.cardId].zoneVersion });
        }
        else if (x.kind === 'batch-duplicate-counter') {
            need(x.options.some(o => o.id === c.cardId), '请选择原有标志类别');
            const t = a.targets[0];
            if (live(s, p, plan, t)) {
                const l = s.locations[t.cardId];
                if (c.cardId === 'time' && l.markers > 0)
                    setCardMarker(s, l, "markers", null, (l.markers) + 1);
                else if (c.cardId === 'wound' && l.wounds > 0) {
                    addWounds(s, t.cardId, 1, { event, group: a.id });
                }
                else if (c.cardId.startsWith('counter:') && (l.counters?.[c.cardId.slice(8)] ?? 0) > 0)
                    setCardMarker(s, l, "counter", c.cardId.slice(8), (l.counters[c.cardId.slice(8)]) + 1);
            }
        }
        else if (x.kind === 'batch-optional-draw' || x.kind === 'batch-optional-shuffle') {
            need(['yes', 'no'].includes(c.cardId), '请选择是否执行');
            if (c.cardId === 'yes') {
                if (x.kind === 'batch-optional-draw')
                    draw(s, [p], 1);
                else
                    shuffle(s.players[a.targets[0].player].deck);
            }
        }
        else if (x.kind === 'batch-pay-seal-dead') {
            need(['pay', 'decline'].includes(c.cardId), '请选择是否支付2费用');
            if (c.cardId === 'pay') {
                const l = s.locations[plan.subjectId], t = a.targets[0];
                if (isGraveZone(s, l.zone) && l.zoneVersion === plan.subjectZoneVersion + 1 && !graveyardLocked(s) && live(s, a.controller, plan, t)) {
                    pay(s, p, 2);
                    seal(s, plan.subjectId, sealHost(s, t.cardId), { zone: l.zone, zoneVersion: l.zoneVersion });
                }
            }
        }
        else if (x.kind === 'batch-optional-influence') {
            need(['yes', 'no'].includes(c.cardId), '请选择是否放置势力');
            if (c.cardId === 'yes' && s.districts[x.district]?.id === x.districtCardId)
                placeRegionInfluence(s, x.district, p);
        }
        else if (x.kind === 'batch-deter') {
            need(x.options.some(o => o.id === c.cardId), '请选择具有本方势力的地区');
            if (x.legacyDeter && c.cardId === 'none') {
                need(!s.districts.some(d => d?.influence[p] > 0), '仍有本方势力标志');
            }
            else {
                need(removeSelectedInfluence(s, p, c.cardId), '势力标志已改变');
                if (deter(s, a, x.remaining - 1))
                    return;
            }
        }
        else if (x.kind === 'batch-time-adjust') {
            need(['add', 'remove'].includes(c.cardId), '请选择放置或移除');
            const t = a.targets[0];
            if (live(s, a.controller, plan, t)) {
                const l = s.locations[t.cardId];
                setCardMarker(s, l, "markers", null, Math.max(0, (l.markers ?? 0) + (c.cardId === 'add' ? 1 : -1)));
            }
        }
        else if (x.kind === 'batch-wanted-name') {
            need(x.options.some(o => o.id === c.cardId), '请选择有效角色牌名称');
            log(s, `通缉令指定名称：${c.cardId}。`);
            if (sourceLive(s, plan))
                s.locations[plan.sourceId].namedCharacter = c.cardId;
        }
        else if (x.kind === 'batch-ambusher-wound') {
            need(x.cardIds.includes(c.cardId) && s.locations[c.cardId]?.zone === 'play' && !s.locations[c.cardId].faceDown && s.locations[c.cardId].zoneVersion === x.versions[c.cardId] && s.locations[c.cardId].district === x.district && s.districts[x.district]?.id === x.districtCardId && controllerOf(s, c.cardId) === x.controller, '请选择该玩家仍操控且位于原地区的角色');
            addWounds(s, c.cardId, 1, { event, group: a.id });
        }
        else if (x.kind === 'batch-inspect' || x.kind === 'batch-inspect-lock') {
            need(c.confirm === true, '请确认检视完成');
            if (x.kind === 'batch-inspect-lock') {
                const t = a.targets[0];
                if (live(s, a.controller, plan, t) && s.cards[t.cardId].subtypes?.includes('罪犯')) {
                    const l = s.locations[t.cardId];
                    tapCard(s, t.cardId);
                    l.counters ??= {};
                    setCardMarker(s, l, "counter", "locked", (l.counters.locked ?? 0) + 1);
                }
            }
        }
        else if (x.kind === 'batch-top-place') {
            need(!librarySearchBlocked(s), '稻荷神社童子在场时不能检索牌库');
            const ids = c.cardIds;
            need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.length >= x.min && ids.length <= x.max && ids.every(id => x.eligibleIds.includes(id) && s.players[p].deck.includes(id)), '请选择规定数量的合格牌');
            need(x.search || x.cardIds.every((id, i) => s.players[p].deck[i] === id), '牌库已改变');
            if (sourceDistrictLive(s, plan)) {
                beginEventGroup(s, a.id);
                for (const id of ids) {
                    log(s, `${s.seats[p].name}展示${s.cards[id].name}并放置进场。`);
                    place(s, id, p, plan.sourceDistrict, !!x.hidden);
                }
                endEventGroup(s);
            }
            shuffle(s.players[p].deck);
        }
        else if (x.kind === 'batch-search-place') {
            need(!librarySearchBlocked(s), '稻荷神社童子在场时不能检索牌库');
            if (c.fail === true)
                need(x.canFail, '不能放弃');
            else {
                need(x.cardIds.includes(c.cardId) && s.players[p].deck.includes(c.cardId), '请选择检索牌');
                const d = a.targets[0];
                if (s.districts[d.district]?.id === d.cardId) {
                    log(s, `${s.seats[p].name}展示${s.cards[c.cardId].name}并放置进场。`);
                    place(s, c.cardId, p, d.district, !!x.hidden);
                }
            }
            shuffle(s.players[p].deck);
            if (x.postTransform)
                autumnTransform(s, p);
        }
        else if (x.kind === 'batch-hand-place') {
            need(x.cardIds.includes(c.cardId) && s.players[p].hand.includes(c.cardId), '请选择合格手牌');
            if (sourceDistrictLive(s, plan)) {
                log(s, `${s.seats[p].name}展示${s.cards[c.cardId].name}并放置进场。`);
                place(s, c.cardId, p, plan.sourceDistrict);
            }
        }
        else if (x.kind === 'batch-sacrifice' || x.kind === 'batch-sacrifice-hidden') {
            need((x.options ?? x.cardIds.map(id => ({ id }))).some(o => o.id === c.cardId) && s.players[p].play.includes(c.cardId), '请选择本方合法牺牲牌');
            move(s, c.cardId, 'graveyard', { cause: 'sacrifice' });
            if (x.kind === 'batch-sacrifice-hidden' && deter(s, a, 1))
                return;
        }
        finishSpell(s, a);
    }
    return { effect, choice, deter };
}
