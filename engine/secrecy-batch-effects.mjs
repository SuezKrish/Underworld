import { sealedCount } from './sealed-counts.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { RuleError } from './core.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { effectiveSubtypes, enterTapped, attachmentHostLegal } from './derived.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { sealHost } from './sealing.mjs';
import { librarySearchBlocked } from './library-search.mjs';
import { relocate, canMoveToDistrict } from './district-rules.mjs';
import { adjacentDistricts, districtNumber } from './task-districts.mjs';
import { discardMany } from './discard-events.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function createSecrecyBatchEffects({ move, event, draw, choose, finishSpell, log, shuffle, seal, hurt: ctxDamage }) {
    const controlledNames = (s, p) => new Set(Object.entries(s.locations).filter(([id, l]) => ['play', 'asset', 'society'].includes(l.zone) && !l.faceDown && !l.secretPlan && controllerOf(s, id) === p).map(([id]) => printedRulesCard(s, id)?.name));
    const searchCards = (s, p, op) => { const names = controlledNames(s, p); return s.players[p].deck.filter(id => op === 'new-deal-search' ? effectiveSubtypes(s, id).some(t => ['政治', '政治家'].includes(t)) && !names.has(s.cards[id].name) : true); };
    function effect(s, a, plan, targets) {
        const p = a.controller, t = targets[0], id = t?.cardId;
        if (plan.operation === 'deep-seal-search') {
            if (librarySearchBlocked(s)) {
                log(s, '不能检索牌库，本次跳过检索并洗牌。');
                shuffle(s.players[p].deck);
                return false;
            }
            const ids = [...s.players[p].deck], count = Math.min(ids.length, effectiveSocietyMarkers(s, p).hidden > 0 ? 3 : 1);
            choose(s, a, 'secrecy-batch-deep-seal', p, ids, { count, min: count, max: count, hostRef: sealHost(s, `society:${p}`), choiceLabel: '藏于深层意识 · 选择' + count + '张牌封印' });
            return true;
        }
        if (plan.operation === 'ghost-assault') {
            for (const t of targets)
                ctxDamage(s, t.cardId, 1, { assault: { id: plan.sourceId, version: plan.sourceZoneVersion } });
        }
        if (plan.operation === 'dream-search-place') {
            if (librarySearchBlocked(s)) {
                log(s, '不能检索牌库，本次跳过检索并洗牌。');
                shuffle(s.players[p].deck);
                return false;
            }
            const max = sealedCount(s, `society:${p}`), ids = searchCards(s, p, plan.operation).filter(id => plan.operation !== 'dream-search-place' || hasCardType(s.cards[id], 'character') && effectiveSubtypes(s, id).includes('梦境') && s.cards[id].printedCost <= max);
            choose(s, a, 'secrecy-batch-search', p, ids, { canFail: true, operation: plan.operation, districtRef: t, maxPrintedCost: plan.operation === 'dream-search-place' ? max : undefined, choiceLabel: '梦境塑造师 · 检索梦境角色' });
            return true;
        }
        if (plan.operation === 'summer-gift') {
            const l = s.locations[id];
            for (const e of [{ kind: 'modify-icons', white: true, icon: 'battle', amount: 1 }, { kind: 'modify-icons', icon: 'battle', amount: 1 }, { kind: 'barrier' }])
                s.effects.push({ ...e, targetId: id, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' });
        }
        if (plan.operation === 'transcend') {
            const l = s.locations[id];
            s.effects.push({ kind: 'barrier', targetId: id, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' });
            if (Object.entries(s.locations).some(([aid, al]) => al.zone === 'play' && al.attachedTo === id && al.hostVersion === l.zoneVersion && hasCardType(s.cards[aid], 'attachment') && attachmentHostLegal(s, aid)))
                s.effects.push({ kind: 'prevent-destruction', targetId: id, targetZoneVersion: l.zoneVersion, duration: 'until-end-of-round' });
        }
        if (plan.operation === 'night-patrol') {
            const l = s.locations[id], options = adjacentDistricts(s, l.district).filter(d => canMoveToDistrict(s, id, d)).map(d => ({ id: 'district:' + d, name: `地区${districtNumber(s, d)} · ${s.districts[d].name}`, districtCardId: s.districts[d].id }));
            if (options.length) {
                choose(s, a, 'secrecy-batch-patrol', p, [], { options, roleId: id, roleVersion: l.zoneVersion, roleDistrict: l.district, choiceLabel: '夜巡 · 选择相邻地区' });
                return true;
            }
            draw(s, [p], 1);
        }
        if (plan.operation === 'rat-inspect') {
            const q = t.player, ids = [...s.players[q].hand];
            choose(s, a, 'secrecy-batch-rat', p, ids, { player: q, eligibleIds: ids.filter(id => hasCardType(s.cards[id], 'attachment')), canSkip: true, choiceLabel: '水沟鼠群密探 · 检视手牌，可选择一张附属弃掉' });
            return true;
        }
        return false;
    }
    function choice(s, p, c, x) {
        const a = x.spell;
        if (x.kind === 'secrecy-batch-deep-seal') {
            const ids = c.cardIds;
            need(Array.isArray(ids) && ids.length === x.count && new Set(ids).size === ids.length && ids.every(id => x.cardIds.includes(id) && s.players[p].deck.includes(id)), '请选择规定数量的不同牌库牌');
            if (!librarySearchBlocked(s))
                (() => {
                    for (const id of ids)
                        seal(s, id, x.hostRef, { zone: 'deck', zoneVersion: s.locations[id].zoneVersion });
                })();
            shuffle(s.players[p].deck);
        }
        else if (x.kind === 'secrecy-batch-search') {
            if (librarySearchBlocked(s))
                log(s, '检索限制已生效，所选牌不移动。');
            else if (c.fail === true)
                need(x.canFail, '不能放弃检索');
            else {
                need(x.cardIds.includes(c.cardId) && s.players[p].deck.includes(c.cardId), '请选择符合条件的牌库牌');
                {
                    const d = x.districtRef;
                    if (s.districts[d.district]?.id === d.cardId) {
                        log(s, `${s.seats[p].name}展示${s.cards[c.cardId].name}并放置进场。`);
                        if (move(s, c.cardId, 'play', { controller: p, district: d.district, tapped: enterTapped(s, c.cardId, d.district) }))
                            event(s, c.cardId, 'entry', s.locations[c.cardId], a.id, { method: 'effect-placement' });
                    }
                }
            }
            shuffle(s.players[p].deck);
        }
        else if (x.kind === 'secrecy-batch-patrol') {
            const o = x.options.find(o => o.id === c.cardId);
            need(o, '请选择一个相邻地区');
            const l = s.locations[x.roleId], d = Number(c.cardId.slice(9));
            if (l?.zone === 'play' && l.faceDown && l.zoneVersion === x.roleVersion && adjacentDistricts(s, l.district).includes(d) && s.districts[d]?.id === o.districtCardId && relocate(s, x.roleId, d))
                event(s, x.roleId, 'move', l, a.id, { district: d });
            draw(s, [p], 1);
        }
        else if (x.kind === 'secrecy-batch-rat') {
            if (c.skip !== true) {
                need(x.eligibleIds.includes(c.cardId) && s.players[x.player].hand.includes(c.cardId) && hasCardType(s.cards[c.cardId], 'attachment'), '只能选择检视手牌中的附属牌');
                discardMany(s, [c.cardId], move, event, { cause: 'discard', effectController: a.controller });
            }
        }
        else
            throw new RuleError('尚未接入的隐秘配套选择');
        finishSpell(s, a);
    }
    return { effect, choice };
}
