import { uuid } from './random.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { hasCardType, hasAnyCardType } from './card-types.mjs';
import { effectiveKeyword, effectiveSubtypes } from './derived.mjs';
import { RuleError } from './core.mjs';
import { controllerOf, identity } from './ownership.mjs';
import { uniqueIdentity } from './card-names.mjs';
export { uniqueIdentity } from './card-names.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function hasKeyword(s, id, keyword) { const l = s.locations[id]; return effectiveKeyword(s, id, keyword) && l?.zone === 'play' && !l.faceDown; }
export function createUniqueEngine({ move, log, resume }) {
    function conflicts(s) {
        const out = [];
        for (const p of [s.turn?.firstPlayer ?? 0, 1 - (s.turn?.firstPlayer ?? 0)]) {
            const ids = s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasAnyCardType(s.cards[id], ['character', 'attachment'])), groups = new Map();
            for (const id of ids) {
                const key = s.locations[id].secretPlan ? null : uniqueIdentity(s.cards[id]);
                if (key) {
                    if (!groups.has(key))
                        groups.set(key, []);
                    groups.get(key).push(id);
                }
            }
            for (const [identity, cardIds] of groups)
                if (cardIds.length > 1)
                    out.push({ controller: p, kind: 'unique', identity, cardIds });
            const leaders = ids.filter(id => hasKeyword(s, id, '领袖'));
            if (leaders.length > 1)
                out.push({ controller: p, kind: 'leader', identity: '领袖', cardIds: leaders });
            const paths = s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(s.cards[id], 'attachment') && effectiveSubtypes(s, id).includes('道途'));
            if (paths.length > 1)
                out.push({ controller: p, kind: 'path', identity: '道途', cardIds: paths });
        }
        return out;
    }
    function check(s) {
        if (s.status !== 'playing' || !s.players.length || s.effectChoice || s.keeperQueue?.length || s.triggerChoices.length)
            return;
        const all = conflicts(s);
        if (s.ruleChoice) {
            const a = s.ruleChoice, live = all.find(c => c.kind === a.kind && c.controller === a.controller && c.identity === a.identity);
            if (live && live.cardIds.length === a.cardIds.length && live.cardIds.every(id => a.cardIds.includes(id) && s.locations[id].zoneVersion === a.references[id]))
                return;
            s.ruleChoice = null;
        }
        const conflict = all[0];
        if (!conflict)
            return;
        s.ruleChoice = { id: uuid(), ...conflict, count: conflict.cardIds.length - 1, references: Object.fromEntries(conflict.cardIds.map(id => [id, s.locations[id].zoneVersion])) };
        s.flow.passed = [];
        log(s, `规则动作：${s.seats[conflict.controller].name}须为${conflict.kind === 'unique' ? `独有身份「${conflict.identity}」` : conflict.kind === 'path' ? '道途限制' : '领袖限制'}选择牺牲${s.ruleChoice.count}张牌，直到只操控一个。`);
    }
    function command(s, p, c) {
        if (c.type !== 'rule-sacrifice')
            return false;
        const a = s.ruleChoice;
        need(a && a.controller === p && a.id === c.choiceId, '当前没有属于你的规则性牺牲选择');
        const ids = c.cardIds;
        need(Array.isArray(ids) && ids.length === a.count && new Set(ids).size === ids.length && ids.every(id => typeof id === 'string' && a.cardIds.includes(id) && s.locations[id]?.zone === 'play' && s.locations[id].zoneVersion === a.references[id] && controllerOf(s, id) === p), '请选择规定数量的不同角色牺牲');
        s.ruleChoice = null;
        beginEventGroup(s, uuid());
        for (const id of ids) {
            log(s, `规则动作：${s.seats[p].name}牺牲${s.cards[id].name}（拥有者：${s.seats[s.cards[id].owner].name}）。`);
            move(s, id, 'graveyard', { cause: 'sacrifice' });
        }
        endEventGroup(s);
        resume(s);
        return true;
    }
    function view(s) { const a = s.ruleChoice; return { ruleChoice: a ? { id: a.id, kind: a.kind, controller: a.controller, identity: a.identity, count: a.count, cards: a.cardIds.map(id => ({ ...identity(s, id), district: s.locations[id].district })) } : null }; }
    return { check, command, view };
}
