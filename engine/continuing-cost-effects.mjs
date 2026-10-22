import { placeRegionInfluence } from './club-influence.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { RuleError } from './core.mjs';
import { effectiveIcons } from './rounds.mjs';
import { secrecyLevel } from './secrecy-counts.mjs';
import { societyMarkers } from './core.mjs';
import { hasCardType } from './card-types.mjs';
import { sourceDistrictLive } from './batch-rules.mjs';
export function createContinuingCostEffects({ deter, log, draw, choose, finishSpell, hurt, live }) {
    function effect(s, a, plan, targets) {
        const p = a.controller;
        if (plan.operation === 'bang') {
            const t = targets.find(t => t.kind === 'card'), d = targets.find(t => t.kind === 'district');
            if (!t || !d || s.locations[t.cardId].district !== d.district)
                return false;
            const ids = s.players[p].play.filter(id => { const l = s.locations[id]; return l.zone === 'play' && !l.faceDown && hasCardType(s.cards[id], 'character') && l.district === d.district; });
            if (!ids.length)
                return false;
            choose(s, a, 'continuing-cost-shooter', p, ids, { versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])), target: t, district: d.district, districtId: d.cardId, choiceLabel: '砰！ · 选择本方角色计算白刀与黑刀' });
            return true;
        }
        if (plan.operation === 'committee-clear') {
            const removed = s.players.reduce((n, pl) => n + pl.markers.exposed, 0);
            for (const pl of s.players)
                setCardMarker(s, pl, 'markers', null, { ...pl.markers, exposed: 0 });
            log(s, `心理审察委员移除${removed}个暴露标志。`);
            return deter(s, a, removed);
        }
        if (plan.operation === 'committee-heal') {
            const pl = s.players[p];
            setCardMarker(s, pl, 'markers', null, societyMarkers(pl.markers.hidden, pl.markers.exposed, 0, 1));
            if (sourceDistrictLive(s, plan))
                for (const id of pl.play) {
                    const l = s.locations[id];
                    if (l.zone === 'play' && !l.faceDown && hasCardType(s.cards[id], 'character') && l.district === plan.sourceDistrict)
                        setCardMarker(s, l, "wounds", null, 0);
                }
        }
        if (plan.operation === 'mana')
            s.players[p].costPool = (s.players[p].costPool ?? 0) + 1;
        if (plan.operation === 'reputation-switch') {
            const t = targets[0];
            s.effects.push({ kind: (a.mode ?? plan.selectedMode) === 'grant' ? 'grant-keyword' : 'remove-keyword', keyword: '声望', sourceId: plan.sourceId, targetId: t.cardId, targetZoneVersion: t.zoneVersion, duration: 'until-end-of-round' });
        }
        if (plan.operation === 'enemy-exposure') {
            const q = 1 - p, m = s.players[q].markers;
            setCardMarker(s, s.players[q], 'markers', null, societyMarkers(m.hidden, m.exposed, 0, 1));
        }
        if (plan.operation === 'tsunami') {
            if (sourceDistrictLive(s, plan))
                s.districts[plan.sourceDistrict].destroyed = 1;
            if (secrecyLevel(s, p) > secrecyLevel(s, 1 - p))
                draw(s, [p], 1);
        }
        if (plan.operation === 'next-hidden')
            s.effects.push({ kind: 'next-hidden-bonus', bonusScope: plan.bonusScope ?? 'player', controller: p, amount: plan.amountFrom === 'progress' ? (plan.sourceCounters?.progress ?? 0) : (plan.amount ?? 1), round: s.round, duration: 'until-end-of-round', sourceId: plan.sourceId });
        if (plan.operation === 'source-district-influence' && sourceDistrictLive(s, plan)) {
            placeRegionInfluence(s, plan.sourceDistrict, p);
        }
        return false;
    }
    function choice(s, p, c, x) {
        const id = c.cardId, l = s.locations[id];
        if (x.kind !== 'continuing-cost-shooter' || !x.cardIds.includes(id) || l?.zone !== 'play' || l.faceDown || l.zoneVersion !== x.versions[id] || l.district !== x.district || s.districts[x.district]?.id !== x.districtId)
            throw new RuleError('请选择原地区内仍在场的本方角色');
        if (live(s, p, x.spell.plan, x.target))
            hurt(s, x.target.cardId, effectiveIcons(s, id, true).battle);
        finishSpell(s, x.spell);
    }
    return { effect, choice };
}
