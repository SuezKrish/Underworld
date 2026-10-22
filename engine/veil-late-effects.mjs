import { RuleError } from './core.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { inGrave } from './graveyard-rules.mjs';
import { enterTapped, graveyardLocked } from './derived.mjs';
import { sealHost } from './sealing.mjs';
import { sourceLive } from './batch-rules.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { addWounds } from './wounds.mjs';
import { simultaneousChoice, commitChoice } from './simultaneous-choice.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { relocate } from './district-rules.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function transferableMarkers(l = {}) {
    return { markers: l.markers ?? 0, wounds: l.wounds ?? 0, counters: Object.fromEntries(Object.entries(l.counters ?? {}).filter(([k, n]) => k !== '势力' && Number.isFinite(n) && n > 0)) };
}
function placeMarkers(s, id, snapshot) {
    const l = s.locations[id];
    if (!l || !snapshot)
        return;
    for (const k of ['markers', 'wounds'])
        if (snapshot[k] > 0)
            setCardMarker(s, l, k, null, (l[k] ?? 0) + snapshot[k]);
    for (const [k, n] of Object.entries(snapshot.counters ?? {}))
        if (n > 0)
            setCardMarker(s, l, 'counter', k, (l.counters?.[k] ?? 0) + n);
}
// Record the exact graveyard object after the normal death move. This is a
// delayed effect, not a second death trigger or a replacement of entering grave.
export function rememberLambDeath(s, id, old, { cause, ruleDeath, operator }) {
    if (cause !== 'destroy')
        return;
    const change = old.lethalChange;
    const effects = (s.effects ?? []).filter(e => e.kind === 'lamb-watch' && e.round === s.round && e.district === old.district && e.districtCardId === s.districts[old.district]?.id && e.controller === (old.controller ?? s.cards[id].owner));
    for (const e of effects) {
        const battleDeath = ruleDeath && change?.kind === 'damage' && change.damageKind === 'battle';
        const enemyEffect = !ruleDeath && operator === 1 - e.controller;
        if (!battleDeath && !enemyEffect)
            continue;
        e.deaths ??= [];
        const l = s.locations[id];
        if (!['graveyard', 'headquarters'].includes(l?.zone))
            continue;
        if (!e.deaths.some(r => r.id === id && r.version === l.zoneVersion))
            e.deaths.push({ id, version: l.zoneVersion, zone: l.zone, controller: old.controller ?? s.cards[id].owner });
    }
}
export function createVeilLateEffects({ move, event, choose, finishSpell, options, prepare, live, log }) {
    function equipmentPlan(s, id) { return { ...printedRulesCard(s, id).attachment, cardId: id, nonTargeted: true }; }
    function equipmentLive(s, a, id, version) { const l = s.locations[id]; return inGrave(s, id, a.cardId) && l.zoneVersion === version && !graveyardLocked(s, a.cardId, s.cards[id].owner, l.zone); }
    function effect(s, a, plan, targets) {
        if (plan.operation === 'command-car-move') {
            if (s.districts[a.district]?.id !== plan.destinationCardId)
                return false;
            const ids = [...(sourceLive(s, plan) ? [plan.sourceId] : []), ...targets.map(t => t.cardId)];
            beginEventGroup(s, a.id);
            for (const id of ids) {
                const l = s.locations[id];
                if (l?.zone === 'play' && l.district !== a.district && relocate(s, id, a.district)) {
                    event(s, id, 'move', l, a.id, { district: a.district });
                    log(s, `${s.cards[id].name}移动至地区${a.district + 1}。`);
                }
            }
            endEventGroup(s);
            return false;
        }
        if (plan.operation === 'reverse-investigation') {
            if (s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId)
                s.effects.push({ kind: 'reverse-investigation', district: plan.sourceDistrict, districtCardId: plan.sourceDistrictCardId, duration: 'until-end-of-round' });
            return false;
        }
        if (plan.operation === 'demon-wound') {
            const first = s.flow.stepOwner ?? s.turn.firstPlayer;
            const choices = [first, 1 - first].map(controller => { const cardIds = s.players[controller].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(printedRulesCard(s, id), 'character') && controllerOf(s, id) === controller); return { controller, cardIds, versions: Object.fromEntries(cardIds.map(id => [id, s.locations[id].zoneVersion])) }; });
            return simultaneousChoice(s, choose, a, 'veil-late-demon', choices, { choiceLabel: '凌虐恶魔 · 秘密选择一个本方角色' });
        }
        if (plan.operation === 'lamb-watch') {
            const t = targets[0];
            s.effects.push({ kind: 'lamb-watch', controller: a.controller, round: s.round, district: t.district, districtCardId: t.cardId, sourceId: a.cardId, deaths: [] });
            return false;
        }
        if (plan.operation === 'lamb-return') {
            if (s.districts[plan.district]?.id !== plan.districtCardId)
                return false;
            for (const ref of plan.deaths ?? []) {
                const l = s.locations[ref.id];
                if (l?.zone !== ref.zone || l.zoneVersion !== ref.version || !inGrave(s, ref.id, plan.sourceId) || graveyardLocked(s, plan.sourceId, s.cards[ref.id].owner, l.zone))
                    continue;
                if (move(s, ref.id, 'play', { controller: ref.controller, district: plan.district, faceDown: false, tapped: enterTapped(s, ref.id, plan.district) }))
                    event(s, ref.id, 'entry', s.locations[ref.id], a.id, { method: 'effect-placement' });
            }
            return false;
        }
        if (plan.operation === 'vase-collect') {
            if (!sourceLive(s, plan))
                return false;
            const key = plan.subjectId + ':' + plan.subjectZoneVersion;
            s.transferredDeathMarkers ??= {};
            if (!s.transferredDeathMarkers[key]) {
                s.transferredDeathMarkers[key] = true;
                placeMarkers(s, plan.sourceId, plan.subjectMarkers);
            }
            return false;
        }
        if (plan.operation === 'vase-release') {
            placeMarkers(s, targets[0].cardId, plan.sourceMarkers);
            return false;
        }
        if (plan.operation !== 'restore-equipment')
            return false;
        const t = targets[0], id = t.cardId, hosts = options(s, a.controller, equipmentPlan(s, id));
        if (!hosts.length) {
            log(s, '隔空御物：装备没有合法结附对象，留在墓地。');
            return false;
        }
        choose(s, a, 'veil-late-equipment-host', a.controller, [], { options: hosts, public: true, attachmentId: id, attachmentVersion: t.zoneVersion, choiceLabel: '隔空御物 · 选择合法结附对象' });
        return true;
    }
    function choice(s, p, c, x) {
        if (x.kind === 'veil-late-demon') {
            const selections = commitChoice(x, p, { cardId: c.cardId }, (own, c) => need(own.cardIds.includes(c.cardId) && s.locations[c.cardId]?.zone === 'play' && !s.locations[c.cardId].faceDown && s.locations[c.cardId].zoneVersion === own.versions[c.cardId] && controllerOf(s, c.cardId) === p && hasCardType(printedRulesCard(s, c.cardId), 'character'), '请选择仍在场的本方角色'));
            if (!selections)
                return;
            beginEventGroup(s, x.spell.id);
            try {
                for (const { choice, command } of selections)
                    if (s.locations[command.cardId]?.zoneVersion === choice.versions[command.cardId])
                        addWounds(s, command.cardId, 1, { event, group: x.spell.id });
            }
            finally {
                endEventGroup(s);
            }
            finishSpell(s, x.spell);
            return;
        }
        const a = x.spell, id = x.attachmentId, plan = equipmentPlan(s, id);
        need(x.options.some(o => o.id === c.cardId), '请选择合法结附对象');
        const t = prepare(s, p, { targetIds: [c.cardId] }, plan)[0];
        if (equipmentLive(s, a, id, x.attachmentVersion) && live(s, p, plan, t)) {
            const host = t.kind === 'host' ? t.ref : t.kind === 'district' ? sealHost(s, `district-host:${t.cardId}`) : sealHost(s, t.cardId);
            const district = t.kind === 'district' ? t.district : t.kind === 'card' ? s.locations[t.cardId].district : undefined;
            if (move(s, id, 'play', { controller: p, faceDown: false, tapped: enterTapped(s, id, district), attachedTo: host.hostId, hostVersion: host.version, ...(district !== undefined ? { district } : {}) })) {
                event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
                event(s, id, 'attached', s.locations[id], a.id, { host });
            }
        }
        finishSpell(s, a);
    }
    return { effect, choice };
}
