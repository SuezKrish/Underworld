import { setCardMarker } from './counter-placement.mjs';
import { societyMarkers } from './core.mjs';
import { RuleError } from './core.mjs';
import { sealHost } from './sealing.mjs';
import { sourceLive } from './batch-rules.mjs';
import { tapCard } from './field-events.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
export function createVeiledStatusEffects({ seal, draw, choose, finishSpell }) {
    function effect(s, a, plan, targets) {
        const p = a.controller;
        if (plan.operation === 'memory-skip')
            s.effects.push({ kind: 'memory-skip-draw', controller: p, round: s.round, duration: 'until-end-of-round', sourceId: plan.sourceId });
        else if (plan.operation === 'both-exposure') {
            for (const pl of s.players)
                setCardMarker(s, pl, 'markers', null, societyMarkers(pl.markers.hidden, pl.markers.exposed, 0, 1));
        }
        else if (plan.operation === 'marked-death')
            s.effects.push({ kind: 'marked-role-keywords', round: s.round, duration: 'until-end-of-round', sourceId: plan.sourceId });
        else if (plan.operation === 'mutant-seal') {
            if (!sourceLive(s, plan) || !seal(s, plan.sourceId, sealHost(s, targets[0].cardId), { zone: 'play', zoneVersion: plan.sourceZoneVersion }))
                return false;
            if (effectiveSocietyMarkers(s, p).hidden > 0) {
                const t = targets[0];
                choose(s, a, 'veiled-status-mutant', p, [], { target: t, options: [{ id: 'yes', name: '横置该角色并抓一张牌' }, { id: 'no', name: '不横置、不抓牌' }], choiceLabel: '尖鸣突变体 · 是否横置并抓牌' });
                return true;
            }
        }
        else if (plan.operation === 'dakha-hidden') {
            s.effects.push({ kind: 'next-hidden-bonus', bonusScope: 'card', controller: 1 - p, amount: -1, round: s.round, duration: 'until-end-of-round', sourceId: plan.sourceId });
            finishSpell(s, { ...a, sequence: [{ target: 'none', effect: 'hidden-contest' }, ...(a.sequence ?? [])], sequenceTargets: a.sequenceTargets ?? [] });
            return true;
        }
        return false;
    }
    function choice(s, p, c, x) {
        if (x.kind !== 'veiled-status-mutant' || !['yes', 'no'].includes(c.cardId))
            throw new RuleError('请选择是否横置并抓牌');
        if (c.cardId === 'yes') {
            const l = s.locations[x.target.cardId];
            if (l?.zone === 'play' && l.zoneVersion === x.target.zoneVersion)
                tapCard(s, x.target.cardId);
            draw(s, [p], 1);
        }
        finishSpell(s, x.spell);
    }
    function event(s, event, details) {
        if (event === 'sealed' && details.host?.kind === 'society') {
            s.societySealedRound ??= {};
            s.societySealedRound[details.host.owner] = s.round;
        }
    }
    return { effect, choice, event };
}
