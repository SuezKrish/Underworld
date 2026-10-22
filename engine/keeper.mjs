import { uuid } from './random.mjs';
import { restoreSealedFace } from './sealed-face.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { RuleError } from './core.mjs';
import { identity } from './ownership.mjs';
import { sealedOn } from './sealing.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
// A continuous death instruction holds the revealed seals until its choice is
// complete. It is neither a queued trigger nor a stack entry of its own.
export function createKeeperEngine({ log, move, prepareCast, castOptions, castStarted, announce, resume }) {
    const pending = s => !!s.keeperQueue?.length;
    const live = (s, a, r) => s.locations[r.id]?.zone === 'sealed' && s.locations[r.id].zoneVersion === r.version && s.locations[r.id].keeperHoldId === a.id;
    function death(s, id, old) {
        if (old.faceDown || !printedRulesCard(s, id)?.automation?.keeperDeathCast)
            return;
        const ids = sealedOn(s, id).filter(id => !s.locations[id].keeperHoldId);
        if (!ids.length)
            return;
        const a = { id: uuid(), sourceId: id, sourceName: s.cards[id].name, controller: old.controller ?? s.cards[id].owner,
            references: ids.map(id => ({ id, version: s.locations[id].zoneVersion })) };
        s.keeperQueue ??= [];
        s.keeperQueue.push(a);
        for (const child of ids) {
            restoreSealedFace(s, child);
            const l = s.locations[child];
            l.faceDown = false;
            delete l.hiddenHandle;
            l.keeperHoldId = a.id;
            l.keeperHostName = a.sourceName;
        }
        log(s, `${a.sourceName}的持续能力立即展示封印牌：${ids.map(id => s.cards[id].name).join('、')}。选择一张免费打出，或全部返回拥有者手中。`);
    }
    function block(s) {
        if (!pending(s))
            return false;
        s.flow.locked = true;
        s.flow.passed = [];
        return true;
    }
    function command(s, p, c) {
        if (c.type !== 'keeper-choice')
            return false;
        const a = s.keeperQueue?.[0];
        need(a && a.controller === p && a.id === c.choiceId, '当前没有属于你的守秘人选择');
        need(typeof c.skip === 'boolean', '请选择免费打出一张或全部回手');
        let entry = null;
        if (!c.skip) {
            const r = a.references.find(r => r.id === c.cardId);
            need(r && live(s, a, r), '只能打出本次展示且仍被保留的封印牌');
            need(typeof c.id === 'string' && !s.flow.stack.some(a => a.id === c.id), '堆叠条目编号无效');
            entry = prepareCast(s, p, c);
        }
        if (entry) {
            // Only this authenticated server choice grants free casting. Ordinary play
            // commands cannot opt into cost waivers or cast another owner's card.
            need(move(s, c.cardId, 'stack', { controller: p, waivedOptionalExtraCosts: true, chosenX: 0 }), '该牌无法打出');
            castStarted(s, p, c.cardId);
            s.flow.stack.push(entry);
            s.flow.passed = [];
            log(s, `${s.seats[p].name}通过${a.sourceName}免费打出${s.cards[c.cardId].name}，忽略全部费用、X为0，仍需忠诚；卡牌进入堆叠。`);
            announce(s, p, c.cardId, entry.id);
        }
        for (const r of a.references)
            if (live(s, a, r)) {
                move(s, r.id, 'hand');
                log(s, `${s.cards[r.id].name}返回其拥有者${s.seats[s.cards[r.id].owner].name}手中。`);
            }
        s.keeperQueue.shift();
        resume(s);
        return true;
    }
    function view(s, p) {
        const a = s.keeperQueue?.[0];
        if (!a)
            return { keeperChoice: null };
        return { keeperChoice: {
                id: a.id, controller: a.controller, sourceName: a.sourceName, queued: s.keeperQueue.length,
                cards: a.references.filter(r => live(s, a, r)).map(r => ({ ...identity(s, r.id), ...(p === a.controller ? castOptions(s, p, r.id) : {}) }))
            } };
    }
    return { death, block, pending, command, view };
}
