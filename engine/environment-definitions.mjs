import { deckWasShuffled } from './deck-shuffle-events.mjs';
import { effectiveSubtypes } from './derived.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { randomValues } from './random.mjs';
import { hasCardType } from './card-types.mjs';
import { realitySubtypes } from './reality-rules.mjs';
import manifest from '../data/environment-manifest.json' with { type: 'json' };
import { comparableCardRules } from './card-text-format.mjs';
const plain = comparableCardRules;
export function environmentStatus(c) {
    const spec = manifest.find(x => x.id === c.id);
    if (!spec)
        return null;
    const changed = Object.keys(spec.source).filter(k => k === 'text' ? ![spec.source.text, ...(spec.textAliases ?? [])].some(text => plain(c.text) === plain(text)) : c[k] !== spec.source[k]);
    return { implemented: !changed.length && spec.plan.complete, plan: changed.length ? { kind: spec.plan.kind, complete: false, pending: ['文本或规则属性已修改，运行能力需重审。'] } : spec.plan, reason: changed.length ? '环境卡资料已修改，需重新审核' : spec.plan.complete ? '本版本已实现并通过针对性测试' : (spec.plan.pending ?? []).join('；') };
}
export function compileEnvironment(cards) {
    return cards.filter(c => c.type === '地区' || c.type === '秘社').map(c => {
        const status = environmentStatus(c), plan = status?.plan ?? { kind: c.type === '地区' ? 'district' : 'society', complete: false, pending: ['运行能力尚未接入。'] };
        const [threshold, points] = c.iconsDefense.split('/').map(Number);
        if (c.type === '地区' && (!Number.isSafeInteger(threshold) || threshold < 1 || c.id !== 'DQ12' && (!Number.isSafeInteger(points) || points < 0)))
            throw Error(`${c.name}的势力值或分数无效`);
        return { catalogId: c.id, name: c.name, displayName: c.displayName, text: c.text, subtitle: c.subtitle, flavorText: c.flavorText, type: plan.kind, initialSelectable: c.type === '秘社' && !/^ZH/.test(c.id) && !/不能作为初始秘社牌/.test(plain(c.text)) && /初始手牌[：:]\s*\d+/.test(plain(c.text)), traits: c.typeLine.split(/[-/]/).slice(1), faction: c.faction, plan, initialHand: c.type === '秘社' ? Number(plain(c.text).match(/初始手牌[：:]\s*(\d+)/)?.[1] ?? 0) : undefined, ...(c.type === '地区' ? { threshold, points: c.id === 'DQ12' ? 0 : points } : {}) };
    });
}
export function societyPlan(s, p) { return s.societies?.[p]?.plan ?? {}; }
;
export function playerHandLimit(s, p) { const m = s.players[p].markers; return Math.max(0, 7 + m.hidden + (societyPlan(s, p).exposedHandBonus ? m.exposed : -m.exposed)); }
export function environmentKeywords(s, id) {
    const l = s.locations[id], c = s.cards[id];
    if (l?.zone !== 'play' || l.faceDown || !hasCardType(c, 'character'))
        return [];
    const out = s.districts?.[l.district]?.plan?.grantSpirit ? ['灵体'] : [];
    const plan = societyPlan(s, l.controller ?? c.owner);
    for (const g of plan.roleKeywords ?? [])
        if (g.subtypesAny.some(t => effectiveSubtypes(s, id).includes(t)))
            out.push(...g.keywords);
    return out;
}
export function societySubtypes(s, id) {
    const c = s.cards[id], l = s.locations[id], p = l?.controller ?? c.owner, plan = societyPlan(s, p), out = [...realitySubtypes(s, id)];
    if (l?.zone === 'play' && !l.faceDown && hasCardType(c, 'character')) {
        if (plan.scholarsAreMonks && c.subtypes?.includes('学者'))
            out.push('僧侣');
        if (plan.cheapHumansAreSlaves && c.printedCost <= 2 && c.subtypes?.includes('人类'))
            out.push('奴仆');
    }
    if (s.societyStates?.[c.owner]?.ghostTypes && hasCardType(c, 'character') && c.subtypes?.some(t => ['吸血鬼', '法师'].includes(t)))
        out.push('阴魂');
    return out;
}
export function loyaltyAssets(s, p) {
    const a = s.players[p].assets.map(a => ({ ...a, magicDomains: effectiveMagicDomains(s, a.id) }));
    if (!societyPlan(s, p).sealedLoyalty)
        return a;
    return [...a, ...Object.keys(s.locations).filter(id => s.locations[id].zone === 'sealed' && s.locations[id].hostId === `society:${p}`).map(id => ({ id, magicDomains: effectiveMagicDomains(s, id) }))];
}
export function shuffleCards(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const bound = i + 1, limit = 0x100000000 - 0x100000000 % bound;
        let n;
        do {
            n = randomValues(new Uint32Array(1))[0];
        } while (n >= limit);
        const j = n % bound;
        [a[i], a[j]] = [a[j], a[i]];
    }
    deckWasShuffled(a);
    return a;
}
