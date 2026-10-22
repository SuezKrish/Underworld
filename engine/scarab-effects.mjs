import { placeRegionInfluence } from './club-influence.mjs';
import { resetCard } from './reset.mjs';
import { RuleError } from './core.mjs';
import { uuid } from './random.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { controllerOf } from './ownership.mjs';
import { effectiveSubtypes } from './derived.mjs';
import { hasCardType } from './card-types.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { sourceLive } from './batch-rules.mjs';
import { liveSealHost } from './sealing.mjs';
import { graveCards, inGrave, graveZones, graveEventName } from './graveyard-rules.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function createScarabEffects({ move, event, draw, choose, finishSpell, emit, log }) {
    function effect(s, a, plan, targets) {
        const p = a.controller, id = targets[0]?.cardId;
        if (plan.operation === 'generate-corpse') {
            const template = s.automationCards.find(c => c.catalogId === 'XQ46') ?? s.reserveTemplates.find(c => c.catalogId === 'XQ46');
            need(template, '房间缺少无名尸体资料');
            const id = uuid();
            s.cards[id] = { ...structuredClone(template), id, owner: p, token: false };
            s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
            move(s, id, 'graveyard');
            log(s, '从游戏外生成一张无名尸体，置于本方墓地区域。');
        }
        else if (plan.operation === 'mill-self-one') {
            const id = s.players[p].deck[0];
            if (id)
                move(s, id, 'graveyard');
        }
        else if (plan.operation === 'return-corpse') {
            const ids = graveCards(s, p, a.cardId).filter(id => s.cards[id].name === '无名尸体');
            if (ids.length) {
                choose(s, a, 'scarab-return', p, ids, { public: true, choiceLabel: '将一张无名尸体置于手中' });
                return true;
            }
        }
        else if (plan.operation === 'sealed-host-eye') {
            const h = plan.eventHost;
            if (liveSealHost(s, h) && h.kind === 'card')
                s.effects.push({ kind: 'modify-icons', icon: 'investigation', amount: 1, targetId: h.hostId, targetZoneVersion: s.locations[h.hostId].zoneVersion, duration: 'until-end-of-round' });
        }
        else if (plan.operation === 'discard-lab') {
            const l = s.locations[plan.sourceId];
            if (inGrave(s, plan.sourceId, plan.sourceId) && l.zoneVersion === plan.sourceZoneVersion && s.districts[0]) {
                move(s, plan.sourceId, 'play', { controller: p, district: 0, tapped: false, attachedTo: `district-host:${s.districts[0].id}`, hostVersion: s.districts[0].id });
                event(s, plan.sourceId, 'entry', s.locations[plan.sourceId], a.id, { method: 'effect-placement' });
            }
        }
        else if (plan.operation === 'mimic-reset') {
            const l = s.locations[plan.subjectId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.subjectZoneVersion)
                resetCard(s, plan.subjectId);
        }
        else if (plan.operation === 'mimic-influence') {
            const d = s.districts[plan.eventDistrict];
            if (d?.id === plan.eventDistrictCardId) {
                placeRegionInfluence(s, plan.eventDistrict, p);
            }
        }
        else if (plan.operation === 'create-headquarters') {
            const player = s.players[p];
            if (!player.headquartersActive) {
                player.headquarters ??= [];
                // Both the destination replacement and expanded references apply before
                // migration, so its grave-leave and headquarters-entry events are observed.
                player.headquartersActive = true;
                for (const id of [...player.graveyard])
                    move(s, id, 'headquarters');
                log(s, '集团总部：启用本方墓地或集团总部区引用，迁移原墓地并发动离墓及入墓触发。');
            }
            else
                log(s, '集团总部已建立，本次结算不再产生实际效果。');
        }
        finishSpell(s, a);
        return true;
    }
    function choice(s, p, c, x) {
        const a = x.spell;
        if (x.kind === 'scarab-subtype') {
            need(x.options.some(o => o.id === c.cardId), '请选择食尸鬼、行尸或骷髅');
            if (sourceLive(s, a.plan)) {
                const l = s.locations[a.plan.sourceId];
                l.extraSubtypes = [...new Set([...(l.extraSubtypes ?? []), c.cardId])];
            }
        }
        else {
            need(x.cardIds.includes(c.cardId) && inGrave(s, c.cardId, a.cardId), '所选墓地牌已经失效');
            move(s, c.cardId, 'hand');
        }
        finishSpell(s, a);
    }
    function watch(s, id, eventName, loc, group, details) {
        const card = s.cards[id];
        if (!card)
            return;
        for (const source of s.players.flatMap(pl => pl.play)) {
            const sl = s.locations[source], sc = printedRulesCard(s, source), p = controllerOf(s, source), e = graveEventName(s, eventName, details, source);
            if (sl?.zone !== 'play' || sl.faceDown || sc.automation?.scarabStatic !== 'mimic' || abilitiesSuppressed(s, source))
                continue;
            const sub = effectiveSubtypes(s, source), extra = { subjectId: id, subjectZoneVersion: loc.zoneVersion, eventDistrict: loc.district, eventDistrictCardId: s.districts[loc.district]?.id };
            if (e === 'grave-entry' && card.owner === p && card.name === '无名尸体' && sub.includes('食尸鬼'))
                emit(s, source, { target: 'none', effect: 'draw', count: 1 }, e, sl, group, extra);
            if (e === 'entry' && controllerOf(s, id) === p && hasCardType(card, 'character')) {
                if (!loc.faceDown && loc.tapped && effectiveSubtypes(s, id).includes('不死生物') && sub.includes('行尸'))
                    emit(s, source, { target: 'none', effect: 'scarab', operation: 'mimic-reset' }, e, sl, group, extra);
                if (graveZones(s, card.owner, source).includes(loc.entryFromZone) && (loc.faceDown ? card.magicDomains ?? [] : effectiveMagicDomains(s, id)).includes('死亡') && sub.includes('骷髅'))
                    emit(s, source, { target: 'none', effect: 'scarab', operation: 'mimic-influence' }, e, sl, group, extra);
            }
        }
    }
    return { effect, choice, watch };
}
