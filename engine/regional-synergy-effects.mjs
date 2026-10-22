import { influenceRemovalOptions, removeSelectedInfluence, placeRegionInfluence } from './club-influence.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { RuleError } from './core.mjs';
import { sourceDistrictLive } from './batch-rules.mjs';
import { adjacentDistricts } from './task-districts.mjs';
import { hasCardType } from './card-types.mjs';
import { cardHasKeyword, effectiveSubtypes } from './derived.mjs';
import { tapCard } from './field-events.mjs';
import { secrecyLevel } from './secrecy-counts.mjs';
import { controllerOf } from './ownership.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function createRegionalSynergyEffects({ choose, finishSpell, conceal, draw, drink, options, event }) {
    function effect(s, a, plan, targets) {
        const p = a.controller;
        if (plan.operation === 'drink-targets') {
            if (!targets.length)
                return false;
            const step = t => ({ effect: 'discard-deck', operation: 'drink-blood', target: plan.target, ownTarget: plan.ownTarget, requiredSubtype: plan.requiredSubtype, drinkTarget: true, targets: [t] });
            const entry = { ...a, sequenceBase: plan, sequence: targets.slice(1).map(step), sequenceTargets: targets };
            drink(s, entry, { ...plan, operation: 'drink-blood', drinkTarget: true }, [targets[0]]);
            return true;
        }
        if (plan.operation === 'vlad-drink') {
            // These are two nontargeted drinks inside one resolving entry. Choosing a
            // blood card opens no response window and the entry event fixes both roles.
            const second = { effect: 'discard-deck', operation: 'drink-blood', target: 'none', sourceId: plan.sourceId, sourceZoneVersion: plan.sourceZoneVersion };
            const entry = { ...a, sequenceBase: plan, sequence: [second, ...(a.sequence ?? [])], sequenceTargets: [] };
            drink(s, entry, { ...plan, operation: 'drink-blood', sourceId: plan.subjectId, sourceZoneVersion: plan.subjectZoneVersion }, []);
            return true;
        }
        if (plan.operation === 'move-nearby-influence') {
            if (!sourceDistrictLive(s, plan))
                return false;
            const options = influenceRemovalOptions(s, p).filter(o => adjacentDistricts(s, plan.sourceDistrict).includes(o.district));
            if (options.length) {
                choose(s, a, 'regional-synergy-influence', p, [], { options, choiceLabel: '赃物贩子 · 选择相邻地区的本方势力' });
                return true;
            }
        }
        if (plan.operation === 'revival-touch') {
            const id = targets[0].cardId;
            tapCard(s, id);
            if (s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && controllerOf(s, id) === p && effectiveSubtypes(s, id).includes('梦魇')) {
                choose(s, a, 'regional-synergy-revival', p, [], { options: [{ id: 'yes', name: '放置一个复苏标志' }, { id: 'no', name: '不放置' }], choiceLabel: '贝兰丹娜的抚触 · 可放置复苏标志' });
                return true;
            }
        }
        if (plan.operation === 'reattach-vampire') {
            const l = s.locations[plan.sourceId];
            if (l?.zone !== 'play' || l.faceDown || l.zoneVersion !== plan.sourceZoneVersion)
                return false;
            const candidates = options(s, p, { ...plan, target: 'vampire-character', effect: 'reattach', otherHost: true, cardId: plan.sourceId });
            if (candidates.length) {
                choose(s, a, 'regional-synergy-reattach', p, [], { options: candidates, choiceLabel: '兽形变化 · 选择另一个合法吸血鬼宿主' });
                return true;
            }
        }
        if (plan.operation === 'secrecy-draw' && secrecyLevel(s, p) > secrecyLevel(s, 1 - p))
            draw(s, [p], 1);
        if (plan.operation === 'destroy-source-region' && sourceDistrictLive(s, plan))
            s.districts[plan.sourceDistrict].destroyed = 1;
        if (plan.operation === 'plan-hide-three' && (plan.sourceCounters?.progress ?? 0) >= 3) {
            const ids = s.players[p].play.filter(id => { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && hasCardType(s.cards[id], 'character') && !cardHasKeyword(s, id, '永恒'); });
            if (ids.length) {
                choose(s, a, 'regional-synergy-hide', p, ids, { min: 0, max: Math.min(3, ids.length), versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])), choiceLabel: '计划：避世密约 · 至多三个本方角色潜伏' });
                return true;
            }
        }
        return false;
    }
    function choice(s, p, c, x) {
        const a = x.spell, plan = a.plan;
        if (x.kind === 'regional-synergy-influence') {
            const o = x.options.find(o => o.id === c.cardId), d = o?.district ?? Number(c.cardId?.slice(9));
            need(o, '请选择相邻地区');
            if (sourceDistrictLive(s, plan) && s.districts[d]?.id === o.districtCardId && adjacentDistricts(s, plan.sourceDistrict).includes(d) && s.districts[d].influence[p] > 0) {
                need(removeSelectedInfluence(s, p, c.cardId), '势力标志已改变');
                placeRegionInfluence(s, plan.sourceDistrict, p);
            }
        }
        else if (x.kind === 'regional-synergy-revival') {
            need(['yes', 'no'].includes(c.cardId), '请选择是否放置复苏标志');
            if (c.cardId === 'yes') {
                s.societyStates[p].counters ??= {};
                setCardMarker(s, s.societyStates[p], "counter", '复苏', (s.societyStates[p].counters['复苏'] ?? 0) + 1);
            }
        }
        else if (x.kind === 'regional-synergy-reattach') {
            need(x.options.some(o => o.id === c.cardId), '请选择另一个合法宿主');
            const l = s.locations[plan.sourceId], h = s.locations[c.cardId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.sourceZoneVersion && options(s, p, { ...plan, target: 'vampire-character', effect: 'reattach', otherHost: true, cardId: plan.sourceId }).some(o => o.id === c.cardId)) {
                l.attachedTo = c.cardId;
                l.hostVersion = h.zoneVersion;
                l.district = h.district;
                event(s, plan.sourceId, 'attached', l, a.id, { host: { kind: 'card', hostId: c.cardId, version: h.zoneVersion } });
            }
        }
        else if (x.kind === 'regional-synergy-hide') {
            const ids = c.cardIds;
            need(Array.isArray(ids) && ids.length <= x.max && new Set(ids).size === ids.length && ids.every(id => x.cardIds.includes(id)), '请选择至多三个不同的本方角色');
            for (const id of ids)
                if (s.locations[id]?.zone === 'play' && s.locations[id].zoneVersion === x.versions[id] && controllerOf(s, id) === p && !s.locations[id].faceDown)
                    conceal(s, id, a.id);
        }
        else
            throw new RuleError('未接入的地区配套选择');
        finishSpell(s, a);
    }
    return { effect, choice };
}
