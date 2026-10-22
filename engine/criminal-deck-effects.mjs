import { removeRegionInfluence } from './club-influence.mjs';
import { resetCard } from './reset.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { RuleError } from './core.mjs';
import { graveCards, inGrave } from './graveyard-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { controllerOf } from './ownership.mjs';
import { effectiveSubtypes, enterTapped, graveyardLocked, takeControl, attachmentHostLegal, cardHasKeyword } from './derived.mjs';
import { sealHost } from './sealing.mjs';
import { secrecyLevel } from './discard-deck-effects.mjs';
import { discardMany } from './discard-events.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function createCriminalDeckEffects(ctx) {
    const { move, event, seal, draw, choose, finishSpell, log, shuffle, destroy, startHidden, emit, uuid, options, deter } = ctx;
    const districtLive = (s, plan) => s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId;
    const role = (s, id) => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(printedRulesCard(s, id), 'character');
    function place(s, a, id, hidden = false, tapped = false) {
        if (!districtLive(s, a.plan) || inGrave(s, id, id) && graveyardLocked(s, id, s.cards[id].owner, s.locations[id].zone))
            return false;
        if (!move(s, id, 'play', { controller: a.controller, district: a.plan.sourceDistrict, tapped: hidden ? tapped : tapped || enterTapped(s, id, a.plan.sourceDistrict), faceDown: hidden, ...(hidden ? { hiddenHandle: uuid() } : {}) }))
            return false;
        event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
        return true;
    }
    function murderOptions(s, plan) {
        if (!districtLive(s, plan))
            return [];
        const ids = Object.keys(s.locations).filter(id => role(s, id) && s.locations[id].district === plan.sourceDistrict), n = Math.min(...ids.map(id => printedRulesCard(s, id).printedCost));
        return ids.filter(id => printedRulesCard(s, id).printedCost === n);
    }
    function undertakerFinish(s, a, t) {
        const l = s.locations[t.cardId];
        if (l?.zone === 'play' && l.zoneVersion === t.zoneVersion) {
            s.effects.push({ kind: 'barrier', targetId: t.cardId, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' });
            const d = s.districts[l.district];
            if (d)
                removeRegionInfluence(s, l.district, controllerOf(s, t.cardId));
        }
        const id = s.players[a.controller].deck.at(-1);
        if (id)
            move(s, id, (a.mode ?? a.plan.selectedMode) === 'grave' ? 'graveyard' : 'hand');
        finishSpell(s, a);
    }
    function kormirCards(s, a) {
        const ids = (a.plan.shownCards ?? []).filter(x => s.locations[x.cardId]?.zone === 'aside' && s.locations[x.cardId].zoneVersion === x.zoneVersion && hasCardType(s.cards[x.cardId], 'character') && effectiveSubtypes(s, x.cardId).includes('罪犯')).map(x => x.cardId);
        if (!ids.length) {
            finishSpell(s, a);
            return;
        }
        choose(s, a, 'criminal-kormir-shown', a.controller, ids, { canSkip: true, public: true, choiceLabel: '科米尔 · 可将展示的罪犯角色置墓或以暗藏者进场' });
    }
    function reattachOptions(s, p, id) {
        const c = printedRulesCard(s, id), target = c.attachment?.target;
        if (!target)
            return [];
        return options(s, p, { ...c.attachment, cardId: id, nonTargeted: true }).filter(o => {
            // A new attachment relation is a resolution choice, not a new targeted effect.
            // Host options already check owner-based barrier; then validate the printed restriction.
            const old = s.locations[id], t = o.id;
            let extra;
            if (t.startsWith('district:')) {
                const d = Number(t.slice(9));
                extra = { attachedTo: `district-host:${s.districts[d].id}`, hostVersion: s.districts[d].id, district: d };
            }
            else if (t.startsWith('society:')) {
                const p2 = Number(t.slice(8));
                extra = { attachedTo: t, hostVersion: s.societyVersions?.[p2] ?? 0, district: undefined };
            }
            else
                extra = { attachedTo: t, hostVersion: s.locations[t]?.zoneVersion, district: s.locations[t]?.district };
            s.locations[id] = { ...old, ...extra };
            try {
                return attachmentHostLegal(s, id);
            }
            finally {
                s.locations[id] = old;
            }
        });
    }
    function effect(s, a, plan, targets) {
        const p = a.controller, op = plan.operation;
        if (op === 'murder') {
            const ids = murderOptions(s, plan);
            if (ids.length === 1)
                destroy(s, ids[0]);
            else if (ids.length > 1) {
                choose(s, a, 'criminal-murder', p, ids, { public: true, choiceLabel: '嗜杀怪客 · 选择费用最低的角色（非指定目标）' });
                return true;
            }
            return false;
        }
        if (op === 'murder-return') {
            const l = s.locations[a.cardId];
            if (inGrave(s, a.cardId, a.cardId) && l.zoneVersion === plan.sourceZoneVersion && !graveyardLocked(s, a.cardId, p, l.zone)) {
                const ds = s.districts.flatMap((d, i) => d ? [i] : []);
                if (ds.length) {
                    const d = ds[0];
                    if (move(s, a.cardId, 'play', { controller: p, district: d, tapped: enterTapped(s, a.cardId, d), faceDown: false }))
                        event(s, a.cardId, 'entry', s.locations[a.cardId], a.id, { method: 'effect-placement' });
                }
            }
            return false;
        }
        if (op === 'hidden-start') {
            if (startHidden(s, a.id, { ...a, plan })) {
                if (plan.bonus)
                    s.hidden.cardBonus = { controller: p, amount: plan.bonus, subtypes: plan.bonusSubtypes, type: plan.bonusType };
                return true;
            }
            return false;
        }
        if (op === 'undertaker') {
            const t = targets[0];
            if ((a.mode ?? plan.selectedMode) === 'grave') {
                const ids = graveyardLocked(s, plan.sourceId, p) ? [] : graveCards(s, p, plan.sourceId);
                if (ids.length) {
                    choose(s, a, 'criminal-undertaker-grave', p, ids, { public: true, target: t, choiceLabel: '送葬人 · 选择一张墓地牌封印' });
                    return true;
                }
            }
            else {
                const id = s.players[p].deck[0];
                if (id)
                    seal(s, id, sealHost(s, t.cardId), { zone: 'deck', zoneVersion: s.locations[id].zoneVersion });
            }
            undertakerFinish(s, a, t);
            return true;
        }
        if (op === 'containment') {
            move(s, targets[0].cardId, 'hand');
            const l = s.locations[plan.sourceId];
            if (effectiveSocietyMarkers(s, p).hidden > 0 && l?.zone === 'play' && l.zoneVersion === plan.sourceZoneVersion)
                resetCard(s, plan.sourceId);
            return false;
        }
        if (op === 'kormir-hidden') {
            const t = targets[0], l = s.locations[a.cardId];
            if (plan.hiddenWon && l?.zone === 'aside' && l.zoneVersion === plan.sourceVersion && s.districts[t.district]?.id === t.cardId)
                move(s, a.cardId, 'play', { controller: p, district: t.district, faceDown: true, tapped: false, hiddenHandle: uuid() });
            return false;
        }
        if (op === 'carmen') {
            if (!plan.sourceSnapshot?.optionalExtraPaid && !plan.sourceSnapshot?.waivedOptionalExtraCosts && secrecyLevel(s, p) <= secrecyLevel(s, 1 - p))
                return false;
            const id = targets[0].cardId;
            if (cardHasKeyword(s, id, '永恒'))
                return false;
            takeControl(s, id, p);
            if (controllerOf(s, id) !== p)
                return false;
            const opts = reattachOptions(s, p, id);
            if (opts.length) {
                s.locations[id].pendingReattachment = true;
                choose(s, a, 'criminal-carmen-host', p, [], { options: opts, attachmentId: id, attachmentVersion: s.locations[id].zoneVersion, canSkip: true, choiceLabel: '卡门 · 可重新选择结附对象（非指定目标）' });
                return true;
            }
            return false;
        }
        if (op === 'blackmarket-restrain')
            return deter(s, a, 2);
        return false;
    }
    function afterHidden(s, a, winner, shown) {
        const p = a.controller;
        a = { ...a, plan: { ...a.plan, shownCards: (shown ?? []).filter(x => x.owner === p).map(x => ({ cardId: x.cardId, zoneVersion: s.locations[x.cardId]?.zoneVersion })) } };
        if (winner === p && a.plan.hiddenAfter === 'sebastian') {
            const t = a.targets[0];
            if (t && inGrave(s, t.cardId, a.cardId) && s.locations[t.cardId].zoneVersion === t.zoneVersion)
                place(s, a, t.cardId, false, true);
        }
        if (winner === p && a.plan.hiddenAfter === 'kormir') {
            if (!draw(s, [p], 1)) {
                finishSpell(s, a);
                return;
            }
            if (s.players[p].hand.length) {
                choose(s, a, 'criminal-kormir-discard', p, [...s.players[p].hand], { choiceLabel: '科米尔 · 抓一张后弃一张' });
                return;
            }
            kormirCards(s, a);
            return;
        }
        finishSpell(s, a);
    }
    function watch(s, id, eventName, loc, group, details) {
        if (eventName !== 'contest-won' || details.contest !== 'hidden' || ![0, 1].includes(details.winner))
            return;
        const p = details.winner;
        for (const source of graveCards(s, p)) {
            const c = printedRulesCard(s, source), l = s.locations[source], def = c.automation?.graveHiddenWin;
            if (def && !abilitiesSuppressed(s, source) && !graveyardLocked(s, source, p, l.zone))
                emit(s, source, def, 'contest-won', l, group);
        }
    }
    function choice(s, p, c, x) {
        const a = x.spell, plan = a.plan;
        if (x.kind === 'criminal-carmen-host') {
            delete s.locations[x.attachmentId]?.pendingReattachment;
            if (c.skip === true) {
                need(x.canSkip, '原结附对象已经不合法，请重新结附');
            }
            else {
                need(x.options.some(o => o.id === c.cardId) && s.locations[x.attachmentId]?.zone === 'play' && s.locations[x.attachmentId].zoneVersion === x.attachmentVersion, '结附选择已经失效');
                const l = s.locations[x.attachmentId], id = c.cardId;
                if (id.startsWith('district:')) {
                    const d = Number(id.slice(9));
                    Object.assign(l, { attachedTo: `district-host:${s.districts[d].id}`, hostVersion: s.districts[d].id, district: d });
                }
                else if (id.startsWith('society:')) {
                    Object.assign(l, { attachedTo: id, hostVersion: s.societyVersions?.[Number(id.slice(8))] ?? 0 });
                    delete l.district;
                }
                else
                    Object.assign(l, { attachedTo: id, hostVersion: s.locations[id].zoneVersion, district: s.locations[id].district });
                need(attachmentHostLegal(s, x.attachmentId), '结附对象不合法');
                event(s, x.attachmentId, 'attached', l, a.id, { host: sealHost(s, l.attachedTo) });
            }
        }
        else if (x.kind === 'criminal-kormir-shown') {
            if (c.skip === true) {
                finishSpell(s, a);
                return;
            }
            need(x.cardIds.includes(c.cardId) && ['grave', 'hidden'].includes(c.mode), '请选择展示牌及其去向');
            const snap = plan.shownCards.find(t => t.cardId === c.cardId);
            need(s.locations[c.cardId]?.zone === 'aside' && s.locations[c.cardId].zoneVersion === snap.zoneVersion, '展示牌已离开一旁');
            if (c.mode === 'grave')
                move(s, c.cardId, 'graveyard');
            else
                place(s, a, c.cardId, true);
            const rest = x.cardIds.filter(id => id !== c.cardId);
            if (rest.length) {
                kormirCards(s, a);
                return;
            }
        }
        else {
            need(x.cardIds.includes(c.cardId), '请选择合法卡牌');
            if (x.kind === 'criminal-murder') {
                need(murderOptions(s, plan).includes(c.cardId), '所选角色已不是本地区费用最低的角色');
                destroy(s, c.cardId);
            }
            if (x.kind === 'criminal-undertaker-grave') {
                need(inGrave(s, c.cardId, plan.sourceId), '墓地牌已改变');
                if (!graveyardLocked(s, plan.sourceId, p))
                    seal(s, c.cardId, sealHost(s, x.target.cardId), { zone: s.locations[c.cardId].zone, zoneVersion: s.locations[c.cardId].zoneVersion });
                undertakerFinish(s, a, x.target);
                return;
            }
            if (x.kind === 'criminal-kormir-discard') {
                need(s.players[p].hand.includes(c.cardId), '手牌已改变');
                discardMany(s, [c.cardId], move, event, { cause: 'discard', effectController: p });
                kormirCards(s, a);
                return;
            }
        }
        finishSpell(s, a);
    }
    return { effect, afterHidden, choice, watch };
}
