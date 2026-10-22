import { settleTerminatedCard } from './terminated-card.mjs';
import { rememberHardDeckCards } from './hard-bot-library.mjs';
import { loyaltyMet } from './loyalty.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { RuleError } from './core.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { effectiveSubtypes, enterTapped } from './derived.mjs';
import { loyaltyAssets } from './environment-definitions.mjs';
import { hasCardType } from './card-types.mjs';
import { canTerminate } from './holy-deck-rules.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const addShield = (s, id) => {
    const l = s.locations[id];
    if (l?.zone === 'play') {
        l.counters ??= {};
        setCardMarker(s, l, "counter", "shield", (l.counters.shield ?? 0) + 1);
    }
};
export const meetsLoyalty = loyaltyMet;
export function createHolyDeckEffects(ctx) {
    const { move, event, choose, finishSpell, log, shuffle, prepare, options } = ctx;
    function guideIds(s, p) { return s.players[p].deck.filter(id => hasCardType(s.cards[id], 'character') && effectiveSubtypes(s, id).includes('法师') && effectiveMagicDomains(s, id).includes('神圣') && (s.players[p].ignoreLoyalty || meetsLoyalty(s, p, s.cards[id].loyalty, s.cards[id]))); }
    function effect(s, a, plan, targets) {
        const p = a.controller;
        if (plan.operation === 'shield-entry') {
            const l = s.locations[plan.sourceId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.sourceZoneVersion)
                for (let i = 0; i < plan.count; i++)
                    addShield(s, plan.sourceId);
        }
        else if (plan.operation === 'shield-counter') {
            const l = s.locations[plan.sourceId], original = s.flow.stack.find(a => a.id === plan.targetedEntryId);
            if (l?.zone === 'play' && l.zoneVersion === plan.sourceZoneVersion && l.counters?.shield > 0) {
                setCardMarker(s, l, "counter", "shield", (l.counters.shield) - 1);
                if (canTerminate(s, original)) {
                    s.flow.stack = s.flow.stack.filter(a => a !== original);
                    settleTerminatedCard(s, original, move);
                    log(s, '护盾标志强制触发：移除一个护盾，终止' + (original.displayName ?? '原效果') + '。');
                }
                else
                    log(s, original ? '护盾标志强制触发：移除一个护盾；原效果不能被终止，仍留在堆叠中。' : '护盾标志强制触发：移除一个护盾；原效果已不在堆叠中。');
            }
        }
        else if (plan.operation === 'shield-target')
            addShield(s, targets[0]?.cardId);
        else if (plan.operation === 'guide-end') {
            const l = s.locations[plan.roleId];
            if (l?.zone === 'play' && l.zoneVersion === plan.roleVersion) {
                if (l.counters?.shield > 0) {
                    choose(s, a, 'holy-guide-end', p, [], { options: [{ id: 'shield', name: '移除一个护盾，留在场上' }, { id: 'return', name: '返回拥有者手中' }], roleId: plan.roleId, roleVersion: plan.roleVersion, choiceLabel: '天火的指引 · 回合结束' });
                    return true;
                }
                move(s, plan.roleId, 'hand');
            }
        }
        else if (plan.operation === 'hidden-tap') {
            const assets = loyaltyAssets(s, p);
            if (assets.some(a => (a.factionColors ?? [a.faction?.split('·')[0]]).includes('黄')) || assets.filter(a => a.magicDomains.includes('心灵')).length >= 2)
                ctx.tapCard(s, targets[0]?.cardId);
        }
        return false;
    }
    function choice(s, p, c, x) {
        const a = x.spell, plan = a.plan;
        if (x.kind === 'holy-guide-search') {
            need(s.players[p].deck.includes(c.cardId) && guideIds(s, p).includes(c.cardId), '请选择牌库中符合当前忠诚的神圣法师');
            const t = a.targets[0];
            log(s, `${s.seats[p].name}展示检索到的${s.cards[c.cardId].name}。`);
            if (s.districts[t.district]?.id === t.cardId && !ctx.librarySearchBlocked(s)) {
                if (move(s, c.cardId, 'play', { controller: p, district: t.district, tapped: enterTapped(s, c.cardId, t.district) })) {
                    event(s, c.cardId, 'entry', s.locations[c.cardId], a.id, { method: 'effect-placement' });
                    s.effects.push({ kind: 'guide-end', roleId: c.cardId, roleVersion: s.locations[c.cardId].zoneVersion, controller: p, sourceId: a.cardId });
                }
            }
            shuffle(s.players[p].deck);
        }
        else if (x.kind === 'holy-guide-end') {
            need(['shield', 'return'].includes(c.cardId), '请选择移除护盾或返回手牌');
            const l = s.locations[x.roleId];
            if (l?.zone === 'play' && l.zoneVersion === x.roleVersion) {
                if (c.cardId === 'shield') {
                    need(l.counters?.shield > 0, '该角色已没有护盾');
                    setCardMarker(s, l, "counter", "shield", (l.counters.shield) - 1);
                }
                else
                    move(s, x.roleId, 'hand');
            }
        }
        else if (x.kind === 'holy-gabriel-name') {
            need(x.options.some(o => o.id === c.cardId), '只能说出一张具有印刷神圣图标的牌');
            const name = c.cardId, top = s.players[p].deck[0];
            log(s, `${s.seats[p].name}说出${name}；${top ? '展示牌库顶：' + s.cards[top].name : '牌库为空'}。`);
            if (top)
                rememberHardDeckCards(s, [top]);
            if (top && s.cards[top].name === name)
                move(s, top, 'hand');
            else if (ctx.librarySearchBlocked(s)) {
                shuffle(s.players[p].deck);
            }
            else {
                const ids = s.players[p].deck.filter(id => s.cards[id].name === name);
                choose(s, a, 'holy-gabriel-search', p, ids, { canFail: true, choiceLabel: `加百列 · 寻找${name}，洗牌后展示置顶` });
                return;
            }
        }
        else if (x.kind === 'holy-gabriel-search') {
            need(s.players[p].deck.includes(c.cardId) && x.cardIds.includes(c.cardId), '请选择所说出的牌');
            if (!ctx.librarySearchBlocked(s)) {
                move(s, c.cardId, 'aside');
                shuffle(s.players[p].deck);
                move(s, c.cardId, 'deck');
                s.players[p].deck = s.players[p].deck.filter(id => id !== c.cardId);
                s.players[p].deck.unshift(c.cardId);
                log(s, `${s.seats[p].name}展示${s.cards[c.cardId].name}并将其置于洗牌后的牌库顶。`);
            }
            else
                shuffle(s.players[p].deck);
        }
        else if (x.kind === 'holy-hidden-tap') {
            a.targets = prepare(s, p, { targetIds: [c.cardId] }, { target: 'character' });
            ctx.tapCard(s, a.targets[0].cardId);
        }
        finishSpell(s, a);
    }
    return { effect, choice };
}
