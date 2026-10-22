import { setCardMarker } from './counter-placement.mjs';
import { sourceLive } from './batch-rules.mjs';
import { controllerOf } from './ownership.mjs';
import { hasCardType } from './card-types.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { cardHasKeyword, currentSocietyName } from './derived.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
export function createTimeCultEffects({ move, destroy, hurt, draw, event, log }) {
    function fieldRoles(s) { return s.players.flatMap(p => p.play).filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(printedRulesCard(s, id), 'character')); }
    function time(s, id, n, version, group) {
        const l = s.locations[id];
        if (l?.zone !== 'play' || l.faceDown || l.zoneVersion !== version || n <= 0)
            return;
        setCardMarker(s, l, "markers", null, (l.markers ?? 0) + n);
        event(s, id, 'marker-put', l, group, { counter: 'time', amount: n });
    }
    function sacrificeSource(s, a) {
        if (sourceLive(s, a.plan) && controllerOf(s, a.plan.sourceId) === a.controller && !cardHasKeyword(s, a.plan.sourceId, '永恒'))
            move(s, a.plan.sourceId, 'graveyard', { cause: 'sacrifice' });
    }
    function effect(s, a, plan, targets) {
        const p = a.controller, id = plan.sourceId, t = targets[0], op = plan.operation;
        if (op === 'destroy-other-roles') {
            const ids = fieldRoles(s).filter(x => x !== id || s.locations[x].zoneVersion !== plan.sourceZoneVersion);
            beginEventGroup(s, a.id);
            try {
                for (const x of ids)
                    destroy(s, x);
            }
            finally {
                endEventGroup(s);
            }
            return false;
        }
        if (op === 'empty-time-sacrifice') {
            if (sourceLive(s, plan) && !(s.locations[id].markers > 0))
                sacrificeSource(s, a);
            return false;
        }
        if (op === 'entry-cultist-time') {
            if (effectiveSocietyMarkers(s, p).hidden > 0)
                time(s, plan.subjectId, 1, plan.subjectZoneVersion, a.id);
            return false;
        }
        if (op === 'host-time') {
            time(s, plan.hostAttachment, 1, plan.hostAttachmentVersion, a.id);
            return false;
        }
        if (op === 'destroyed-time') {
            if (t)
                time(s, t.cardId, s.districts.filter(d => d?.destroyed).length, t.zoneVersion, a.id);
            return false;
        }
        if (op === 'source-time') {
            time(s, id, 1, plan.sourceZoneVersion, a.id);
            return false;
        }
        if (op === 'source-counter') {
            if (sourceLive(s, plan) && (!plan.societyName || currentSocietyName(s, p) === plan.societyName)) {
                const l = s.locations[id];
                l.counters ??= {};
                setCardMarker(s, l, "counter", plan.counter, (l.counters[plan.counter] ?? 0) + 1);
                event(s, id, 'marker-put', l, a.id, { counter: plan.counter, amount: 1 });
            }
            return false;
        }
        if (op === 'transfer-source-time') {
            if (sourceLive(s, plan) && t) {
                const l = s.locations[id], n = l.markers ?? 0;
                if (n > 0 && t.cardId !== id) {
                    setCardMarker(s, l, "markers", null, 0);
                    time(s, t.cardId, n, t.zoneVersion, a.id);
                }
            }
            return false;
        }
        if (op === 'charge-damage') {
            if (t)
                hurt(s, t.cardId, plan.paidCounterCount ?? 0);
            return false;
        }
        if (op === 'remove-exposure-eye') {
            if (s.players[p].markers.exposed > 0) {
                setCardMarker(s, s.players[p], 'markers', null, { ...s.players[p].markers, exposed: s.players[p].markers.exposed - 1 });
                if (sourceLive(s, plan))
                    s.effects.push({ kind: 'modify-icons', icon: 'investigation', amount: 1, targetId: id, targetZoneVersion: plan.sourceZoneVersion, sourceId: id, sourceName: plan.sourceName, duration: 'until-end-of-round' });
            }
            return false;
        }
        if (op === 'plan-locked-draw' || op === 'plan-magic-destroy') {
            // Sacrificing the plan is an effect, not a cost or a prerequisite for the rest.
            beginEventGroup(s, a.id);
            try {
                sacrificeSource(s, a);
                if (op === 'plan-magic-destroy')
                    for (const x of fieldRoles(s).filter(x => effectiveMagicDomains(s, x).length > 0))
                        destroy(s, x);
            }
            finally {
                endEventGroup(s);
            }
            if (op === 'plan-locked-draw') {
                const n = s.players.flatMap(pl => pl.play).filter(x => { const l = s.locations[x]; return l?.zone === 'play' && (l.faceDown || hasCardType(printedRulesCard(s, x), 'character')) && (l.counters?.locked ?? 0) > 0; }).length;
                if (n && !draw(s, [p], n))
                    return true;
            }
            log(s, `${s.cards[a.cardId]?.name ?? '计划'}结算达成推进的效果。`);
            return false;
        }
        return false;
    }
    return { effect };
}
