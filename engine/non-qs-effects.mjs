import { effectiveIcons } from './rounds.mjs';
import { removeExistingStars } from './star-transfer.mjs';
import { removeRegionInfluence } from './club-influence.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { addWounds } from './wounds.mjs';
import { RuleError } from './core.mjs';
import { controllerOf } from './ownership.mjs';
import { hasCardType } from './card-types.mjs';
import { effectiveSubtypes, graveyardLocked, takeControl, enterTapped, cardHasKeyword } from './derived.mjs';
import { effectiveSocietyMarkers, secrecyLevel } from './secrecy-counts.mjs';
import { graveCards, inGrave } from './graveyard-rules.mjs';
import { sealHost } from './sealing.mjs';
import { sourceLive, sourceDistrictLive } from './batch-rules.mjs';
import { transformCard } from './card-forms.mjs';
import { tapCard } from './field-events.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function createNonQsEffects({ move, event, choose, finishSpell, seal, terminateTarget, startHidden, pay }) {
    function effect(s, a, plan, targets) {
        const p = a.controller, id = targets[0]?.cardId;
        if (plan.operation === 'command-post-lock') {
            if (!cardHasKeyword(s, id, '不能被锁定')) {
                const l = s.locations[id];
                setCardMarker(s, l, 'counter', 'locked', (l.counters?.locked ?? 0) + (plan.chosenX ?? 0));
            }
        }
        else if (plan.operation === 'siqi-stars') {
            const black = effectiveIcons(s, id, false, true).influence, white = Math.max(0, effectiveIcons(s, id, true).influence - black);
            removeExistingStars(s, id, black, white);
            if (sourceLive(s, plan))
                for (const [whiteIcon, amount] of [[false, black], [true, white]])
                    if (amount)
                        s.effects.push({ kind: 'modify-icons', icon: 'influence', white: whiteIcon, amount, targetId: plan.sourceId, targetZoneVersion: plan.sourceZoneVersion, duration: 'until-end-of-round' });
        }
        else if (plan.operation === 'siqi-mobility') {
            if (sourceLive(s, plan))
                s.effects.push({ kind: 'grant-keyword', keyword: '机动', targetId: plan.sourceId, targetZoneVersion: plan.sourceZoneVersion, duration: 'until-end-of-round' });
        }
        else if (plan.operation === 'sophia-protect') {
            if (sourceLive(s, plan)) {
                s.effects.push({ kind: 'barrier', targetId: plan.sourceId, targetZoneVersion: plan.sourceZoneVersion, duration: 'until-end-of-round' });
                tapCard(s, plan.sourceId);
            }
        }
        else if (plan.operation === 'track-mover') {
            const l = s.locations[plan.subjectId];
            if (l?.zone === 'play' && l.zoneVersion === plan.subjectZoneVersion) {
                l.counters ??= {};
                setCardMarker(s, l, "counter", "locked", (l.counters.locked ?? 0) + 1);
            }
            if (sourceLive(s, plan))
                s.effects.push({ kind: 'modify-icons', icon: 'investigation', amount: 1, targetId: plan.sourceId, targetZoneVersion: plan.sourceZoneVersion, duration: 'until-end-of-round' });
        }
        else if (plan.operation === 'discarded-attachment') {
            const l = s.locations[plan.sourceId], h = s.locations[id];
            if (inGrave(s, plan.sourceId, plan.sourceId) && l.zoneVersion === plan.sourceZoneVersion && !graveyardLocked(s, plan.sourceId, s.cards[plan.sourceId].owner, l.zone) && move(s, plan.sourceId, 'play', { controller: p, district: h.district, tapped: false, attachedTo: id, hostVersion: h.zoneVersion })) {
                event(s, plan.sourceId, 'entry', s.locations[plan.sourceId], a.id, { method: 'effect-placement' });
                event(s, plan.sourceId, 'attached', s.locations[plan.sourceId], a.id, { host: sealHost(s, id) });
            }
        }
        else if (plan.operation === 'protect-own-roles')
            s.effects.push({ kind: 'prevent-destruction', controller: p, allOwnRoles: true, duration: 'until-end-of-round' });
        else if (plan.operation === 'dawn') {
            for (const id of s.players.flatMap(pl => pl.play))
                if (s.locations[id].faceDown)
                    tapCard(s, id);
            s.effects.push({ kind: 'prevent-hidden-reveal', duration: 'until-end-of-round' });
        }
        else if (plan.operation === 'fairy-last-gift') {
            // A resolving grant applies to the current recipients, not later entrants.
            for (const id of s.players[p].play) {
                const l = s.locations[id];
                if (l.zone !== 'play' || l.faceDown || !hasCardType(s.cards[id], 'character') || !effectiveSubtypes(s, id).some(t => ['仙灵', '猎手'].includes(t)))
                    continue;
                s.effects.push({ kind: 'modify-icons', icon: 'battle', amount: 1, targetId: id, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' }, { kind: 'grant-trigger', event: 'death', definition: { target: 'none', effect: 'draw', count: 1, abilityText: '死亡触发：抓一张牌' }, sourceId: plan.sourceId, targetId: id, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' });
            }
        }
        else if (plan.operation === 'hound-counter') {
            const entry = s.flow.stack.find(x => x.id === targets[0]?.entryId);
            if (entry?.targets?.some(t => t.kind === 'card' && s.locations[t.cardId]?.zone === 'play' && !s.locations[t.cardId].faceDown && s.locations[t.cardId].zoneVersion === t.zoneVersion && controllerOf(s, t.cardId) === p && hasCardType(s.cards[t.cardId], 'character')))
                terminateTarget(s, entry);
        }
        else if (plan.operation === 'ghoul-upkeep') {
            const ids = graveCards(s, p, plan.sourceId).filter(id => !graveyardLocked(s, plan.sourceId, s.cards[id].owner, s.locations[id].zone));
            if (ids.length) {
                choose(s, a, 'non-qs-upkeep', p, ids, { versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])), choiceLabel: '亡嚎食尸鬼 · 选择一张墓地牌置于牌库底' });
                return true;
            }
            if (sourceLive(s, plan))
                move(s, plan.sourceId, 'graveyard', { cause: 'sacrifice' });
        }
        else if (plan.operation === 'ghoul-corpse') {
            if (sourceLive(s, plan)) {
                const l = s.locations[plan.sourceId];
                l.counters ??= {};
                for (const k of ['battle', 'defense'])
                    setCardMarker(s, l, "counter", k, (l.counters[k] ?? 0) + 1);
            }
        }
        else if (plan.operation === 'cecilia-anchors') {
            (() => {
                for (const id of [...graveCards(s, p, plan.sourceId)])
                    if (matchesSpecifiedName(s.cards[id], '精神锚点') && !graveyardLocked(s, plan.sourceId, s.cards[id].owner, s.locations[id].zone))
                        seal(s, id, sealHost(s, `society:${p}`), { zone: s.locations[id].zone, zoneVersion: s.locations[id].zoneVersion });
            })();
        }
        else if (plan.operation === 'cecilia-shown') {
            (() => {
                for (const ref of plan.revealedRefs ?? [])
                    if (ref.player === p)
                        seal(s, ref.cardId, sealHost(s, `society:${p}`), { zone: 'aside', zoneVersion: ref.zoneVersion });
            })();
        }
        else if (plan.operation === 'white-eye') {
            const l = s.locations[id];
            s.effects.push({ kind: 'modify-icons', icon: 'investigation', white: true, amount: 1, targetId: id, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' });
        }
        else if (plan.operation === 'remove-secrecy') {
            const q = targets[0].ref.owner, max = Math.min(2, s.players[q].markers.hidden);
            choose(s, a, 'non-qs-secrecy', p, [], { player: q, options: Array.from({ length: max + 1 }, (_, n) => ({ id: String(n), name: `移除${n}个隐秘标志` })), choiceLabel: '跟踪 · 选择移除数量' });
            return true;
        }
        else if (plan.operation === 'inspect-hand-top') {
            if (effectiveSocietyMarkers(s, p).hidden > 0) {
                const q = targets[0].player;
                choose(s, a, 'batch-inspect', p, [...s.players[q].hand, ...s.players[q].deck.slice(0, 1)], { choiceLabel: '灵能海豚基森 · 检视敌方手牌与牌库顶' });
                return true;
            }
        }
        else if (plan.operation === 'cut-causality') {
            if (startHidden(s, a.id, a))
                return true;
            counterAfterHidden(s, a);
        }
        else if (plan.operation === 'abydos-elegy') {
            s.effects.push({ kind: 'player-barrier', controller: p, duration: 'until-end-of-round' });
            for (const id of graveCards(s, p, a.cardId))
                s.effects.push({ kind: 'barrier', targetId: id, targetZoneVersion: s.locations[id].zoneVersion, duration: 'until-end-of-round' });
            if (startHidden(s, a.id, a))
                return true;
            return elegyAfterHidden(s, a);
        }
        else if (plan.operation === 'undercover-entry') {
            if (sourceLive(s, plan) && targets[0]?.kind === 'player')
                takeControl(s, plan.sourceId, targets[0].player);
        }
        else if (plan.operation === 'broker-inspect') {
            if (id) {
                choose(s, a, 'batch-inspect', p, [id], { choiceLabel: '信息掮客 · 私人检视' });
                return true;
            }
        }
        else if (plan.operation === 'chance-tax') {
            const entry = s.flow.stack.find(x => x.id === plan.targetedEntryId);
            if (entry) {
                choose(s, a, 'non-qs-chance-tax', entry.controller, [], { options: [{ id: 'pay', name: '支付1费用' }, { id: 'decline', name: '不支付，终止原卡牌' }], choiceLabel: '“弹簧刀”钱斯 · 原卡牌操控者选择' });
                return true;
            }
        }
        else if (plan.operation === 'clear-enemy-influence') {
            if (sourceDistrictLive(s, plan))
                removeRegionInfluence(s, plan.sourceDistrict, 1 - p);
        }
        else if (plan.operation === 'guinevere-return') {
            const id = plan.sourceId, l = s.locations[id], face = s.automationCards.find(c => c.catalogId === 'ZHWM026');
            if (face && sourceDistrictLive(s, plan) && inGrave(s, id, id) && l.zoneVersion === plan.sourceZoneVersion + 1 && !graveyardLocked(s, id, s.cards[id].owner, l.zone)) {
                if (move(s, id, 'play', { controller: p, district: plan.sourceDistrict, faceDown: false, tapped: enterTapped(s, id, plan.sourceDistrict) })) {
                    const version = s.locations[id].zoneVersion;
                    event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
                    if (s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && s.locations[id].zoneVersion === version)
                        transformCard(s, id, face);
                }
            }
        }
        else if (plan.operation === 'shadow-transfer') {
            const card = targets.find(t => t.slot === 'sealed'), host = targets.find(t => t.slot === 'host');
            if (card && host && seal(s, card.cardId, sealHost(s, host.cardId), { zone: 'sealed', zoneVersion: card.zoneVersion }) && effectiveSubtypes(s, card.cardId).includes('梦魇')) {
                const l = s.locations[host.cardId];
                addWounds(s, host.cardId, 1, { event, group: a.id });
            }
        }
        return false;
    }
    function counterAfterHidden(s, a) {
        if (secrecyLevel(s, a.controller) > secrecyLevel(s, 1 - a.controller)) {
            const target = s.flow.stack.find(x => x.id === a.targets[0]?.entryId);
            if (target)
                terminateTarget(s, target);
        }
    }
    function elegyAfterHidden(s, a) {
        if (secrecyLevel(s, a.controller) > secrecyLevel(s, 1 - a.controller)) {
            choose(s, a, 'predict', a.controller, s.players[a.controller].deck.slice(0, 1));
            return true;
        }
        return false;
    }
    function afterHidden(s, a) {
        if (a.plan.operation === 'abydos-elegy') {
            if (elegyAfterHidden(s, a))
                return;
        }
        else
            counterAfterHidden(s, a);
        finishSpell(s, a);
    }
    function choice(s, p, c, x) {
        const a = x.spell;
        if (x.kind === 'non-qs-upkeep') {
            need(x.cardIds.includes(c.cardId) && inGrave(s, c.cardId, a.plan.sourceId) && s.locations[c.cardId].zoneVersion === x.versions[c.cardId], '请选择原墓地中的牌');
            move(s, c.cardId, 'deck');
        }
        else if (x.kind === 'non-qs-secrecy') {
            need(x.options.some(o => o.id === c.cardId), '请选择移除数量');
            const n = Number(c.cardId);
            need(s.players[x.player].markers.hidden >= n, '隐秘标志不足');
            s.players[x.player].markers.hidden -= n;
        }
        else if (x.kind === 'non-qs-chance-tax') {
            need(['pay', 'decline'].includes(c.cardId), '请选择是否支付1费用');
            const entry = s.flow.stack.find(e => e.id === a.plan.targetedEntryId);
            if (entry) {
                if (c.cardId === 'pay')
                    pay(s, p, 1);
                else
                    terminateTarget(s, entry);
            }
        }
        else
            throw new RuleError('未知非 QS 卡牌选择');
        finishSpell(s, a);
    }
    return { effect, choice, afterHidden };
}
