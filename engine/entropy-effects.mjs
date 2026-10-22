import { placeRegionInfluence } from './club-influence.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { addWounds } from './wounds.mjs';
import { simultaneousChoice, commitChoice, withSimultaneousDepartures } from './simultaneous-choice.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
import { graveCards, isGraveZone } from './graveyard-rules.mjs';
import { RuleError } from './core.mjs';
import { hasCardType, hasAnyCardType } from './card-types.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { effectiveSubtypes, enterTapped, graveyardLocked, currentSocietyName } from './derived.mjs';
import { sealHost, liveSealHost, sealedOn } from './sealing.mjs';
import { transformCard } from './card-forms.mjs';
import { switchSociety } from './society-switch.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { districtTraits, relocate } from './district-rules.mjs';
import { uuid } from './random.mjs';
import { sacrificePaymentIds } from './sacrifice-payment.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function destroyedTotal(s) { return s.districts.reduce((n, d) => n + (d?.destroyed ?? 0), 0) + s.players.reduce((n, p) => n + p.scoreCards.reduce((m, d) => m + (d.destroyed ?? 0), 0), 0); }
export function wildOrDestroyed(s, d) { return !!s.districts[d]?.destroyed || districtTraits(s, d).some(t => ['荒野', '山脉'].includes(t)); }
export function unstableSacrificeDiscount(s, ids = []) { return [...new Set(ids)].filter(id => false).length; }
export function unstableAbilityDiscount(s, plan, c = {}) { return unstableSacrificeDiscount(s, sacrificePaymentIds(plan, c)); }
export function entropyHiddenCard(s, id) {
    const c = printedRulesCard(s, id);
    if (!c)
        return c;
    let hidden = [...(c.hiddenAbilities ?? [])];
    hidden = hidden.filter(a => a.condition !== 'destroyed-any' || s.districts.some(d => d?.destroyed) || s.players[c.owner].scoreCards.some(d => d.destroyed)).map(a => a.condition === 'destroyed-any' ? { ...a, condition: undefined } : a);
    if (String(c.text ?? '').split(/^[ \t]*FAQ\s*[：:]/im)[0].includes('末日钟'))
        for (const source of s.players[c.owner].play) {
            const l = s.locations[source];
            if (l.zone !== 'play' || l.faceDown || true)
                continue;
            hidden.push({ kind: 'point-modifier', amount: 1, grantedBy: source, abilityText: '隐秘：+1，若你赢得本次隐秘对抗，将目标灾难角色移动到目标地区。' }, { kind: 'hidden-effect', grantedBy: source, onlyWinner: true, plan: { effect: 'entropy', operation: 'disaster-move', target: 'disaster-and-district', hiddenTargetSelection: true } });
        }
    return { ...c, hiddenAbilities: hidden };
}
export function createEntropyEffects(ctx) {
    const { move, event, seal, choose, finishSpell, log, shuffle, destroy, draw, startHidden, librarySearchBlocked, live, conceal } = ctx;
    const front = (s, id) => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown;
    const roles = s => s.players.flatMap(p => p.play).filter(id => front(s, id) && hasCardType(printedRulesCard(s, id), 'character'));
    const sameDistrict = (s, d, id) => s.districts[d]?.id === id;
    function token(s, p, code, d, group) {
        const face = s.reserveTemplates.find(c => c.catalogId === code);
        if (!face || !s.districts[d])
            return;
        const id = uuid(), h = s.districts[d];
        s.cards[id] = { ...structuredClone(face), id, owner: p };
        s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
        const extra = hasCardType(face, 'attachment') ? { attachedTo: `district-host:${h.id}`, hostVersion: h.id } : {};
        if (move(s, id, 'play', { controller: p, district: d, faceDown: false, tapped: enterTapped(s, id, d), ...extra }))
            event(s, id, 'entry', s.locations[id], group, { method: 'effect-placement' });
    }
    function addTime(s, id, n, version) {
        const l = s.locations[id];
        if (front(s, id) && (version === undefined || l.zoneVersion === version))
            setCardMarker(s, l, "markers", null, (l.markers ?? 0) + n);
    }
    function effect(s, a, plan, targets) {
        const p = a.controller, op = plan.operation;
        if (op === 'time-entry') {
            addTime(s, plan.sourceId, plan.count, plan.sourceZoneVersion);
            return false;
        }
        if (op === 'entropy-entry') {
            addTime(s, plan.subjectId, 1, plan.subjectZoneVersion);
            if (!sameDistrict(s, plan.eventDistrict, plan.eventDistrictCardId))
                return false;
            const ids = [...(!librarySearchBlocked(s) ? s.players[p].deck : []), ...(!graveyardLocked(s) ? graveCards(s, p) : [])].filter(id => matchesSpecifiedName(s.cards[id], '熵力化身'));
            choose(s, a, 'entropy-search', p, ids, { canSkip: true, choiceLabel: '熵增 · 可从牌库或墓地放置熵力化身', private: true });
            return true;
        }
        if (op === 'entropy-sacrifice') {
            if (!draw(s, [p], 1))
                return true;
            if (sameDistrict(s, plan.eventDistrict, plan.eventDistrictCardId))
                token(s, p, 'TK014', plan.eventDistrict, a.id);
            for (const id of s.players[p].play)
                if (front(s, id) && hasCardType(s.cards[id], 'character') && effectiveSubtypes(s, id).some(t => ['熵', '时间'].includes(t)))
                    for (const k of Object.keys(s.abilityUses ?? {}))
                        if (k.startsWith(`${id}:${s.locations[id].zoneVersion}:action:`))
                            delete s.abilityUses[k];
            return false;
        }
        if (op === 'time-sealed-host') {
            const h = plan.eventHost;
            if (h?.kind === 'card' && liveSealHost(s, h) && hasAnyCardType(printedRulesCard(s, h.hostId), ['character', 'attachment']))
                addTime(s, h.hostId, 1);
            return false;
        }
        if (op === 'clock-recover') {
            const ids = graveyardLocked(s) ? [] : graveCards(s, p).filter(id => effectiveSubtypes(s, id).some(t => ['法术', '灾难'].includes(t)));
            if (ids.length) {
                choose(s, a, 'entropy-recover', p, ids, { public: true, choiceLabel: '钟楼怪客 · 选择墓地法术或灾难牌回手' });
                return true;
            }
            return false;
        }
        if (op === 'danger') {
            const l = s.locations[plan.hostAttachment];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.hostAttachmentVersion)
                addWounds(s, plan.hostAttachment, 1, { event, group: a.id });
            if (sameDistrict(s, plan.sourceDistrict, plan.sourceDistrictCardId) && s.districts[plan.sourceDistrict].destroyed)
                draw(s, [p], 1);
            return false;
        }
        if (op === 'destroyed-influence') {
            for (const d of s.districts)
                if (d?.destroyed) {
                    placeRegionInfluence(s, s.districts.indexOf(d), p);
                }
            return false;
        }
        if (op === 'verthandi-entry') {
            const t = targets[0];
            if (t) {
                if ((a.mode ?? plan.selectedMode) === 'influence') {
                    placeRegionInfluence(s, t.district, p);
                }
                else
                    s.districts[t.district].destroyed = 1;
            }
            return false;
        }
        if (op === 'verthandi-leave') {
            if (sameDistrict(s, plan.sourceDistrict, plan.sourceDistrictCardId)) {
                beginEventGroup(s, a.id);
                for (const id of roles(s))
                    if (id !== plan.sourceId && s.locations[id].district === plan.sourceDistrict && !effectiveSubtypes(s, id).includes('灾难'))
                        destroy(s, id);
                endEventGroup(s);
            }
            return false;
        }
        if (op === 'world-devourer') {
            if (sameDistrict(s, plan.sourceDistrict, plan.sourceDistrictCardId))
                s.districts[plan.sourceDistrict].destroyed = 1;
            if (currentSocietyName(s, p) === '末日钟') {
                sacrificeAssets(s, a, [s.turn.firstPlayer, 1 - s.turn.firstPlayer]);
                return true;
            }
            return false;
        }
        if (op === 'cataclysm') {
            const ids = [...s.players.flatMap(p => p.play)];
            beginEventGroup(s, a.id);
            for (const id of ids) {
                const l = s.locations[id];
                if (l.zone !== 'play' || l.district === undefined)
                    continue;
                const disaster = !l.faceDown && hasCardType(s.cards[id], 'character') && effectiveSubtypes(s, id).includes('灾难');
                if (disaster)
                    move(s, id, 'hand');
                else if (s.districts[l.district]?.destroyed && (l.faceDown || hasCardType(s.cards[id], 'character')))
                    destroy(s, id);
            }
            endEventGroup(s);
            const face = s.environmentCatalog?.find(c => c.catalogId === 'MSJZ03');
            if (face) {
                const previous = structuredClone(s.societies[p]);
                if (switchSociety(s, p, face)) {
                    s.temporarySocietyReturns ??= [];
                    s.temporarySocietyReturns.push({ player: p, face: previous, switchedCatalogId: face.catalogId, round: s.round });
                    log(s, '大灾变：秘社临时切换为末日钟直到回合结束，保留同一对象及所有链接。');
                }
            }
            return false;
        }
        if (op === 'killer-reveal') {
            const t = targets[0], top = s.players[p].deck[0];
            if (t && top)
                seal(s, top, sealHost(s, t.cardId), { zone: 'deck', zoneVersion: s.locations[top].zoneVersion });
            return false;
        }
        if (op === 'killer-wound') {
            const t = targets[0], n = s.locations[t.cardId].markers ?? 0;
            addWounds(s, t.cardId, n, { event, group: a.id });
            addTime(s, plan.sourceId, n, plan.sourceZoneVersion);
            const l = s.locations[plan.sourceId];
            if (front(s, plan.sourceId) && l.zoneVersion === plan.sourceZoneVersion && (l.markers ?? 0) >= 4) {
                const face = s.automationCards.find(c => false);
                if (face && transformCard(s, plan.sourceId, face))
                    log(s, '时间杀人魔转变，保留同一对象、状态与全部标志。');
            }
            return false;
        }
        if (op === 'killer-sweep') {
            const ids = roles(s).filter(id => (s.locations[id].markers ?? 0) > 0), max = Math.max(0, ...ids.map(id => s.locations[id].markers));
            beginEventGroup(s, a.id);
            for (const id of ids)
                if (s.locations[id].markers < max)
                    destroy(s, id);
            endEventGroup(s);
            return false;
        }
        if (op === 'disaster-move') {
            if (plan.hiddenWon) {
                const role = targets.find(t => t.kind === 'card'), d = targets.find(t => t.kind === 'district');
                if (role && d && relocate(s, role.cardId, d.district))
                    event(s, role.cardId, 'move', s.locations[role.cardId], a.id, { district: d.district });
            }
            return false;
        }
        if (['declare-hidden', 'timeflow-hidden', 'verthandi-hidden'].includes(op)) {
            if (startHidden(s, a.id, { ...a, plan })) {
                if (op === 'declare-hidden')
                    s.hidden.entropyDeclaration = plan.declaredSubtype;
                if (op === 'timeflow-hidden')
                    s.hidden.cardBonus = { controller: p, amount: 3, faction: '红' };
                return true;
            }
            return false;
        }
        return false;
    }
    function sacrificeAssets(s, a, players) {
        if (!simultaneousChoice(s, choose, a, 'entropy-assets', players.map(controller => ({ controller, cardIds: s.players[controller].assets.map(a => a.id), count: Math.min(4, s.players[controller].assets.length) })), { choiceLabel: '灭世魔 · 各自选择本方资产牺牲' }))
            finishSpell(s, a);
    }
    function choice(s, p, c, x) {
        const a = x.spell, plan = a.plan;
        if (x.kind === 'entropy-assets') {
            if (x.simultaneous) {
                const selections = commitChoice(x, p, { cardIds: c.cardIds }, (own, c) => need(Array.isArray(c.cardIds) && c.cardIds.length === own.count && new Set(c.cardIds).size === c.cardIds.length && c.cardIds.every(id => own.cardIds.includes(id) && s.players[p].assets.some(a => a.id === id)), '请选择规定数量的本方资产'));
                if (selections) {
                    beginEventGroup(s, a.id);
                    try {
                        withSimultaneousDepartures(s, selections.flatMap(x => x.command.cardIds), () => {
                            for (const y of selections)
                                for (const id of y.command.cardIds)
                                    if (s.players[y.player].assets.some(a => a.id === id))
                                        move(s, id, 'graveyard', { cause: 'sacrifice' });
                        });
                    }
                    finally {
                        endEventGroup(s);
                    }
                    finishSpell(s, a);
                }
            }
            else {
                const ids = c.cardIds;
                need(Array.isArray(ids) && ids.length === x.count && new Set(ids).size === ids.length && ids.every(id => x.cardIds.includes(id) && s.players[p].assets.some(a => a.id === id)), '请选择规定数量的本方资产');
                beginEventGroup(s, a.id);
                for (const id of ids)
                    move(s, id, 'graveyard', { cause: 'sacrifice' });
                endEventGroup(s);
                sacrificeAssets(s, a, x.remainingPlayers);
            }
            return;
        }
        if (x.kind === 'entropy-search' && c.skip === true) {
            finishSpell(s, a);
            return;
        }
        need(x.cardIds.includes(c.cardId), '请选择合法卡牌');
        const id = c.cardId;
        if (x.kind === 'entropy-recover') {
            need(graveCards(s, p).includes(id) && !graveyardLocked(s), '该牌已不在可用墓地');
            move(s, id, 'hand');
        }
        if (x.kind === 'entropy-search') {
            const l = s.locations[id], from = l.zone;
            need(from === 'deck' && !librarySearchBlocked(s) || isGraveZone(s, from) && !graveyardLocked(s), '该区域当前不能检索或进场');
            log(s, `熵增展示${s.cards[id].name}。`);
            if (sameDistrict(s, plan.eventDistrict, plan.eventDistrictCardId) && move(s, id, 'play', { controller: p, district: plan.eventDistrict, faceDown: false, tapped: enterTapped(s, id, plan.eventDistrict) }))
                event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
            if (from === 'deck')
                shuffle(s.players[p].deck);
        }
        finishSpell(s, a);
    }
    function afterHidden(s, a, winner) {
        const p = a.controller, plan = a.plan;
        ;
        if (plan.operation === 'timeflow-hidden') {
            const role = a.targets.find(t => t.kind === 'card'), d = a.targets.find(t => t.kind === 'district');
            if (role && live(s, p, plan, role))
                addTime(s, role.cardId, 2, role.zoneVersion);
            if (winner === p && d && sameDistrict(s, d.district, d.cardId))
                s.districts[d.district].destroyed = 1;
        }
        if (plan.operation === 'verthandi-hidden' && winner === p) {
            const l = s.locations[plan.sourceId];
            if (front(s, plan.sourceId) && l.zoneVersion === plan.sourceZoneVersion)
                ctx.blink(s, a, plan);
        }
        finishSpell(s, a);
    }
    function leaving(s, id) {
        if (true)
            return;
        const owners = new Set();
        for (const child of sealedOn(s, id)) {
            owners.add(s.cards[child].owner);
            move(s, child, 'deck');
        }
        for (const p of owners)
            shuffle(s.players[p].deck);
    }
    return { effect, choice, afterHidden, leaving };
}
