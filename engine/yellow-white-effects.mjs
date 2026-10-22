import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { RuleError } from './core.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { effectiveSubtypes, attachmentHostLegal, cardHasKeyword } from './derived.mjs';
import { sourceLive } from './batch-rules.mjs';
import { sealHost, liveSealHost } from './sealing.mjs';
import { librarySearchBlocked } from './library-search.mjs';
import { tapCard } from './field-events.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const operations = new Set(['relic-domain', 'note-borrow', 'note-collect', 'note-return', 'storage-permission', 'storage-sacrifice']);
export function createYellowWhiteEffects(ctx) {
    const { choose, finishSpell, move, seal, shuffle, log, castDuringResolution } = ctx;
    function borrowedHost(s, plan) {
        const l = s.locations[plan.hostAttachment];
        return l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.hostAttachmentVersion ? plan.hostAttachment : null;
    }
    function eligible(s, a, id, borrow) {
        if (!s.players[a.controller].deck.includes(id) || s.locations[id]?.zone !== 'deck' || librarySearchBlocked(s))
            return false;
        const sub = effectiveSubtypes(s, id);
        if (!borrow)
            return sub.includes('法器');
        const host = borrowedHost(s, a.plan), domains = host ? effectiveMagicDomains(s, host) : [];
        return sub.includes('法术') && effectiveMagicDomains(s, id).some(d => domains.includes(d));
    }
    function completeSearch(s, a, borrow) {
        shuffle(s.players[a.controller].deck);
        if (borrow && sourceLive(s, a.plan))
            tapCard(s, a.plan.sourceId);
        finishSpell(s, a);
    }
    function effect(s, a, plan) {
        const p = a.controller;
        if (plan.operation === 'relic-domain') {
            choose(s, a, 'batch-spells-domain', p, [], { options: ['心灵', '神圣', '星辰', '死亡', '鲜血'].map(id => ({ id, name: id })), choiceLabel: '磁欧石残片遗物 · 选择魔法领域' });
            return true;
        }
        ;
        ;
        if (plan.operation === 'storage-permission') {
            const subject = s.locations[plan.subjectId];
            // The permission must resolve before the original spell leaves the stack.
            if (sourceLive(s, plan) && subject?.zone === 'stack' && subject.zoneVersion === plan.subjectZoneVersion) {
                s.effects.push({ kind: 'spell-finish-seal', subjectId: plan.subjectId, subjectZoneVersion: subject.zoneVersion, host: sealHost(s, plan.sourceId) });
                log(s, '瓦伦丁的储存卡：已建立本次法术正常结算后的封印许可。');
            }
            else
                log(s, '瓦伦丁的储存卡：法术已结束或原储存卡失效，未建立封印许可。');
            return false;
        }
        if (plan.operation === 'storage-sacrifice') {
            if (sourceLive(s, plan) && effectiveSocietyMarkers(s, p).hidden > 0 && !cardHasKeyword(s, plan.sourceId, '永恒'))
                move(s, plan.sourceId, 'graveyard', { cause: 'sacrifice' });
            return false;
        }
    }
    function choice(s, p, c, x) {
        const a = x.spell, plan = a.plan;
        if (x.kind === 'batch-spells-domain') {
            need(x.options.some(o => o.id === c.cardId), '请选择魔法领域');
            if (sourceLive(s, plan)) {
                s.locations[plan.sourceId].chosenMagicDomain = c.cardId;
                log(s, `磁欧石残片遗物选择${c.cardId}。`);
            }
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'batch-spells-cast') {
            if (c.skip !== true)
                castDuringResolution(s, p, { ...c, type: 'play', id: crypto.randomUUID() }, x);
            finishSpell(s, a);
            return;
        }
        if (c.fail === true || librarySearchBlocked(s) || x.borrow && (!sourceLive(s, plan) || !borrowedHost(s, plan))) {
            completeSearch(s, a, x.borrow);
            return;
        }
        need(x.cardIds.includes(c.cardId) && eligible(s, a, c.cardId, x.borrow) && s.locations[c.cardId].zoneVersion === x.versions[c.cardId], '请选择仍在牌库的合法检索牌');
        const id = c.cardId;
        if (x.borrow) {
            const host = sourceLive(s, plan) ? sealHost(s, plan.sourceId) : null;
            if (liveSealHost(s, host) && borrowedHost(s, plan) && attachmentHostLegal(s, plan.sourceId))
                seal(s, id, host, { zone: 'deck', zoneVersion: x.versions[id] });
            completeSearch(s, a, true);
            return;
        }
        log(s, `玛格丽特的学习笔记展示${printedRulesCard(s, id).name}，置于手中。`);
        move(s, id, 'hand');
        shuffle(s.players[p].deck);
        choose(s, a, 'batch-spells-cast', p, [id], { castSourceZone: 'hand', fastCast: true, cardVersion: s.locations[id].zoneVersion, canSkip: true, choiceLabel: '学习笔记 · 可立即付费打出检索到的法器' });
    }
    return { handles: op => operations.has(op), effect, choice };
}
