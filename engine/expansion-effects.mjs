import { setCardMarker } from './counter-placement.mjs';
import { resetCard } from './reset.mjs';
import { addWounds } from './wounds.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { adjacentDistricts, districtNumber } from './task-districts.mjs';
import { RuleError, societyMarkers } from './core.mjs';
import { hasCardType } from './card-types.mjs';
import { sourceLive } from './batch-rules.mjs';
import { effectiveSubtypes } from './derived.mjs';
import { effectiveIcons } from './rounds.mjs';
import { relocate, canMoveToDistrict } from './district-rules.mjs';
import { librarySearchBlocked } from './library-search.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
const need = (value, message) => {
    if (!value)
        throw new RuleError(message);
};
const operations = new Set(['reset-self', 'all-exposed', 'eye-wounds', 'society-remove-counter', 'hidden-if-none', 'gatekeeper-markers', 'top-filter-hand', 'conceal-adjacent', 'three-self']);
export function createExpansionEffects({ move, conceal, event, draw, choose, finishSpell, log, filterCard, shuffle }) {
    function effect(s, a, plan, targets) {
        const p = a.controller;
        if (plan.operation === 'reset-self') {
            if (sourceLive(s, plan))
                resetCard(s, plan.sourceId);
        }
        else if (plan.operation === 'all-exposed')
            for (const pl of s.players) {
                const m = pl.markers;
                if (a.mode === 'add')
                    setCardMarker(s, pl, 'markers', null, societyMarkers(m.hidden, m.exposed, 0, 1));
                else
                    setCardMarker(s, pl, 'markers', null, { ...m, exposed: Math.max(0, m.exposed - 1) });
            }
        else if (plan.operation === 'eye-wounds') {
            // Snapshot every quantity before any wounds can kill an icon-granting source.
            const rows = s.players.flatMap(pl => pl.play).filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character')).map(id => ({ id, count: effectiveIcons(s, id, true).investigation })).filter(x => x.count > 0);
            beginEventGroup(s, a.id);
            try {
                for (const { id, count } of rows) {
                    const l = s.locations[id];
                    addWounds(s, id, count + 1, { event, group: a.id });
                }
            }
            finally {
                endEventGroup(s);
            }
        }
        else if (plan.operation === 'society-remove-counter') {
            s.societyStates ??= [0, 1].map(() => ({ tapped: false, counters: {}, uses: {} }));
            const counters = s.societyStates[p].counters ??= {};
            const n = Math.min(counters[plan.counter] ?? 0, plan.all ? Infinity : plan.count ?? 1);
            counters[plan.counter] = Math.max(0, (counters[plan.counter] ?? 0) - n);
            log(s, `${s.seats[p].name}从本方秘社移除${n}个${plan.counter}标志。`);
            if (plan.drawRemoved && n > 0 && !draw(s, [p], n))
                return true;
        }
        else if (plan.operation === 'hidden-if-none') {
            const m = s.players[p].markers;
            if (effectiveSocietyMarkers(s, p).hidden === 0)
                setCardMarker(s, s.players[p], 'markers', null, societyMarkers(m.hidden, m.exposed, 1, 0));
        }
        else if (plan.operation === 'top-filter-hand') {
            if (librarySearchBlocked(s)) {
                log(s, '稻荷神社童子：跳过牌库检索，牌库仍洗牌。');
                shuffle(s.players[p].deck);
                return false;
            }
            const top = s.players[p].deck.slice(0, plan.count), eligible = top.filter(id => filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id) }, plan.filter));
            choose(s, a, 'batch-expansion-top-hand', p, top, { eligibleIds: eligible, min: 0, max: eligible.length, versions: Object.fromEntries(top.map(id => [id, s.locations[id].zoneVersion])), choiceLabel: `${s.cards[a.cardId].name} · 选择梦魇牌置于手中，其余洗回牌库` });
            return true;
        }
        else if (plan.operation === 'conceal-adjacent') {
            const id = targets[0].cardId;
            conceal(s, id, a.id);
            const l = s.locations[id];
            if (l?.zone === 'play') {
                const options = [{ id: 'stay', name: '不移动' }, ...s.districts.flatMap((d, i) => d && adjacentDistricts(s, l.district).includes(i) && canMoveToDistrict(s, id, i) ? [{ id: `district:${i}`, name: `移动到地区${districtNumber(s, i)} · ${d.name}`, districtCardId: d.id }] : [])];
                choose(s, a, 'batch-expansion-conceal-move', p, [], { options, roleId: id, roleVersion: l.zoneVersion, roleDistrict: l.district, choiceLabel: '跑路 · 是否移动到相邻地区' });
                return true;
            }
        }
        return false;
    }
    function choice(s, p, c, x) {
        const a = x.spell;
        if (x.kind === 'batch-expansion-top-hand') {
            const ids = c.cardIds;
            need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => typeof id === 'string' && x.eligibleIds.includes(id)), '只能选择检视牌中的梦魇牌，可选择任意数量');
            need(x.cardIds.every((id, i) => s.players[p].deck[i] === id && s.locations[id].zoneVersion === x.versions[id]), '检视的牌库已改变');
            if (librarySearchBlocked(s))
                log(s, '检索限制已生效，检视牌不移出牌库。');
            else {
                for (const id of ids)
                    move(s, id, 'hand');
                log(s, `${s.seats[p].name}展示${ids.map(id => s.cards[id].name).join('、') || '0张牌'}并置于手中。`);
            }
            shuffle(s.players[p].deck);
        }
        else if (x.kind === 'batch-expansion-conceal-move') {
            const o = x.options.find(o => o.id === c.cardId);
            need(o, '请选择相邻地区或不移动');
            const l = s.locations[x.roleId];
            if (c.cardId !== 'stay' && l?.zone === 'play' && l.zoneVersion === x.roleVersion && l.district === x.roleDistrict) {
                const d = Number(c.cardId.slice(9));
                if (s.districts[d]?.id === o.districtCardId && Math.abs(d - l.district) === 1 && relocate(s, x.roleId, d))
                    event(s, x.roleId, 'move', l, a.id, { district: d });
            }
        }
        else
            throw new RuleError('未接入的扩展选择');
        finishSpell(s, a);
    }
    return { handles: op => operations.has(op), effect, choice };
}
