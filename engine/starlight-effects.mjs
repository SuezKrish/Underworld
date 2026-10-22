import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { withSimultaneousDepartures } from './simultaneous-choice.mjs';
import { sourceLive } from './batch-rules.mjs';
import { placeClubInfluence } from './club-influence.mjs';
import { effectiveSocietyMarkers, secrecyLevel } from './secrecy-counts.mjs';
import { controllerOf } from './ownership.mjs';
import { hasCardType } from './card-types.mjs';
import { addWounds } from './wounds.mjs';
import { RuleError } from './core.mjs';
export function createStarlightEffects(ctx) {
    const { choose, finishSpell, startHidden, destroy } = ctx;
    const roles = (s, p) => s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character'));
    function beginTorment(s, a) {
        const next = { ...a, plan: { ...a.plan, target: 'none', operation: 'torment-after-hidden' }, targets: [] };
        if (startHidden(s, a.id, next))
            return true;
        effect(s, next, next.plan, []);
        finishSpell(s, next);
        return true;
    }
    function effect(s, a, plan, targets) {
        const p = a.controller;
        if (plan.operation === 'club-influence') {
            if (sourceLive(s, plan))
                placeClubInfluence(s, plan.sourceId, plan.eventWinner ?? p);
        }
        else if (plan.operation === 'infiltration-battle') {
            const d = targets.find(t => t.kind === 'district');
            if (d) {
                ctx.effectBattle(s, a, d.district);
                return true;
            }
        }
        else if (plan.operation === 'infiltration-after-battle') {
            const t = targets.find(t => t.kind === 'card');
            if (t && effectiveSocietyMarkers(s, p).exposed === 0 && controllerOf(s, t.cardId) === p && plan.battleParticipants.some(x => x.id === t.cardId && x.version === t.zoneVersion))
                s.effects.push({ kind: 'modify-icons', icon: 'battle', amount: 1, targetId: t.cardId, targetZoneVersion: t.zoneVersion, duration: 'until-end-of-round', provenance: { name: a.displayName, abilityText: '额外战斗完成后的黑刀奖励' } });
        }
        else if (plan.operation === 'torment') {
            const ids = roles(s, targets[0].player);
            if (ids.length) {
                choose(s, a, 'starlight-torment', targets[0].player, ids, { choiceLabel: '精神折磨 · 选择一个本方角色受到1点创伤' });
                return true;
            }
            return beginTorment(s, a);
        }
        else if (plan.operation === 'torment-after-hidden') {
            if (secrecyLevel(s, p) > secrecyLevel(s, 1 - p)) {
                const ids = s.players.flatMap((_, p) => roles(s, p)).filter(id => (s.locations[id].wounds ?? 0) > 0);
                beginEventGroup(s, a.id);
                try {
                    withSimultaneousDepartures(s, ids, () => {
                        for (const id of ids)
                            destroy(s, id);
                    });
                }
                finally {
                    endEventGroup(s);
                }
            }
        }
        return false;
    }
    function choice(s, p, c, x) {
        if (x.kind !== 'starlight-torment' || !x.cardIds.includes(c.cardId) || !roles(s, p).includes(c.cardId))
            throw new RuleError('请选择仍由自己操控的正面角色');
        addWounds(s, c.cardId, 1, { event: ctx.event, group: x.spell.id });
        ctx.stateBased(s);
        s.effectChoice = null;
        beginTorment(s, x.spell);
    }
    return { effect, choice };
}
