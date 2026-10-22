import { RuleError } from './core.mjs';
import { hasCardType } from './card-types.mjs';
import { cardHasKeyword } from './derived.mjs';
import { controllerOf } from './ownership.mjs';
import { graveCards } from './graveyard-rules.mjs';
import { tapCard } from './field-events.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { simultaneousChoice, commitChoice, withSimultaneousDepartures } from './simultaneous-choice.mjs';
import { influenceRemovalOptions, removeSelectedInfluence } from './club-influence.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const modes = [
    { id: 'sacrifice', name: '牺牲一个附属，然后抓一张牌' },
    { id: 'asset', name: '将一个本方角色横置并置于本方资产区' },
    { id: 'recover', name: '移除两个本方势力标志，然后回收一张本方墓地角色牌' }
];
const refs = (s, ids) => Object.fromEntries(ids.map(id => [id, { zone: s.locations[id].zone, version: s.locations[id].zoneVersion }]));
const same = (s, id, versions) => s.locations[id]?.zone === versions[id]?.zone && s.locations[id]?.zoneVersion === versions[id]?.version;
const candidates = (s, p, type) => s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && !(type === 'character' && s.locations[id].secretPlan) && controllerOf(s, id) === p && hasCardType(s.cards[id], type) && !cardHasKeyword(s, id, '永恒'));
export function createFateEffects({ move, draw, choose, finishSpell, log }) {
    function available(s, p) { return modes.filter(m => m.id === 'sacrifice' ? candidates(s, p, 'attachment').length : m.id === 'asset' ? candidates(s, p, 'character').length : s.districts.reduce((n, d) => n + (d?.influence[p] ?? 0), 0) >= 2); }
    function stage(s, a, index) {
        if (s.status !== 'playing') {
            finishSpell(s, a);
            return;
        }
        for (; index < 3; index++) {
            const selected = [0, 1].filter(p => a.fateModes[p].includes(modes[index].id));
            const choices = selected.flatMap(controller => {
                if (index === 2) {
                    const options = influenceRemovalOptions(s, controller);
                    if (options.reduce((n, o) => n + o.count, 0) < 2)
                        return [];
                    return [{ controller, cardIds: [], options, min: 2, max: 2, versions: refs(s, options.filter(o => o.id.startsWith('club:')).map(o => o.id.slice(5))) }];
                }
                const cardIds = candidates(s, controller, index === 0 ? 'attachment' : 'character');
                return cardIds.length ? [{ controller, cardIds, versions: refs(s, cardIds) }] : [];
            });
            const kind = ['fate-sacrifice', 'fate-asset', 'fate-influence'][index];
            if (simultaneousChoice(s, choose, a, kind, choices, { fateStage: index, choiceLabel: `命运无常 · 第${index + 1}项 · ${['牺牲附属', '角色变资产', '移除势力'][index]}` }))
                return;
        }
        finishSpell(s, a);
    }
    function recover(s, a, players) {
        const choices = players.flatMap(controller => { const cardIds = graveCards(s, controller, a.cardId).filter(id => hasCardType(s.cards[id], 'character')); return cardIds.length ? [{ controller, cardIds, versions: refs(s, cardIds) }] : []; });
        if (!simultaneousChoice(s, choose, a, 'fate-hand', choices, { choiceLabel: '命运无常 · 第3项 · 回收角色牌' }))
            finishSpell(s, a);
    }
    function effect(s, a) {
        const choices = [0, 1].map(controller => ({ controller, cardIds: [], options: available(s, controller), min: 1, max: 3 }));
        if (!simultaneousChoice(s, choose, a, 'fate-modes', choices, { choiceLabel: '命运无常 · 秘密选择项目' }))
            finishSpell(s, a);
        return true;
    }
    function choice(s, p, c, x) {
        const a = x.spell;
        const selections = commitChoice(x, p, c, (own, c) => {
            if (x.kind === 'fate-modes') {
                need(Array.isArray(c.modes) && c.modes.length >= 1 && new Set(c.modes).size === c.modes.length && c.modes.every(id => own.options.some(o => o.id === id)), '请选择至少一个可执行的不同项目');
                return;
            }
            if (x.kind === 'fate-influence') {
                const current = influenceRemovalOptions(s, p), allocations = c.allocations;
                need(Array.isArray(allocations) && new Set(allocations.map(o => o?.id)).size === allocations.length && allocations.every(o => o && Number.isSafeInteger(o.amount) && o.amount > 0 && own.options.some(v => v.id === o.id && o.amount <= v.count) && current.some(v => v.id === o.id && o.amount <= v.count)) && allocations.reduce((n, o) => n + o.amount, 0) === 2, '请选择恰好两个本方势力标志');
                return;
            }
            const type = x.kind === 'fate-sacrifice' ? 'attachment' : 'character', allowed = x.kind === 'fate-hand' ? graveCards(s, p, a.cardId).filter(id => hasCardType(s.cards[id], 'character')) : candidates(s, p, type);
            need(own.cardIds.includes(c.cardId) && allowed.includes(c.cardId) && same(s, c.cardId, own.versions), '请选择仍在原区域的合法本方卡牌');
        });
        if (!selections)
            return;
        if (x.kind === 'fate-modes') {
            const fateModes = [[], []];
            for (const item of selections)
                fateModes[item.player] = modes.filter(m => item.command.modes.includes(m.id)).map(m => m.id);
            for (const p of [0, 1])
                log(s, `${s.seats[p].name}选择命运无常：${fateModes[p].map(id => modes.find(m => m.id === id).name).join('；') || '没有可执行的项目'}。`);
            stage(s, { ...a, fateModes }, 0);
            return;
        }
        if (x.kind === 'fate-influence') {
            const removed = [];
            for (const item of selections) {
                const current = influenceRemovalOptions(s, item.player), picks = item.command.allocations;
                if (!picks.every(o => { const old = item.choice.options.find(v => v.id === o.id), now = current.find(v => v.id === o.id); return now && now.districtCardId === old.districtCardId && now.count >= o.amount && (!o.id.startsWith('club:') || same(s, o.id.slice(5), item.choice.versions)); }))
                    continue;
                for (const o of picks)
                    for (let i = 0; i < o.amount; i++)
                        removeSelectedInfluence(s, item.player, o.id);
                removed.push(item.player);
                log(s, `${s.seats[item.player].name}移除两个本方势力标志。`);
            }
            recover(s, a, removed);
            return;
        }
        const eligible = selections.filter(item => same(s, item.command.cardId, item.choice.versions)), drawPlayers = [];
        beginEventGroup(s, a.id);
        try {
            withSimultaneousDepartures(s, eligible.map(item => item.command.cardId), () => {
                for (const item of eligible) {
                    const id = item.command.cardId, p = item.player;
                    if (x.kind === 'fate-sacrifice') {
                        if (candidates(s, p, 'attachment').includes(id) && move(s, id, 'graveyard', { cause: 'sacrifice' })) {
                            drawPlayers.push(p);
                            log(s, `${s.seats[p].name}牺牲${s.cards[id].name}。`);
                        }
                    }
                    else if (x.kind === 'fate-asset') {
                        if (candidates(s, p, 'character').includes(id)) {
                            tapCard(s, id);
                            move(s, id, 'asset', { controller: p, tapped: true });
                            log(s, `${s.seats[p].name}将${s.cards[id].name}横置置于本方资产区。`);
                        }
                    }
                    else if (x.kind === 'fate-hand' && graveCards(s, p, a.cardId).includes(id)) {
                        move(s, id, 'hand');
                        log(s, `${s.seats[p].name}将${s.cards[id].name}从本方墓地置于手中。`);
                    }
                }
            });
        }
        finally {
            endEventGroup(s);
        }
        if (x.kind === 'fate-sacrifice' && drawPlayers.length && !draw(s, drawPlayers, 1)) {
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'fate-hand')
            finishSpell(s, a);
        else
            stage(s, a, x.fateStage + 1);
    }
    return { effect, choice };
}
