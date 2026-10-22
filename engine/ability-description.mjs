import { splitCardRules, plainCardText } from './card-text-format.mjs';
import { keywordReference } from './keywords.mjs';
// Display only rules, never FAQ. Prefer a saved ability text so an ability
// keeps its description after its source leaves or changes its printed text.
const body = text => splitCardRules(text).text.trim();
const heading = text => plainCardText(text).split(/[：:]/)[0].replace(/\s/g, '');
function blocks(text) {
    const out = [];
    let current = null;
    for (const line of body(text).split('\n')) {
        const plain = plainCardText(line).trim();
        if (/^能力图标\s*[/／]/.test(plain)) {
            current = null;
            continue;
        }
        if (/^[^：:]*?(?:触发|持续|行动[^：:]*|隐秘)[：:]/.test(plain) || /^(?:快速|手牌|墓地|核心区)?行动/.test(plain)) {
            current = { heading: heading(line), text: line };
            out.push(current);
        }
        else if (current && plain)
            current.text += '\n' + line;
    }
    return out;
}
const eventHeads = { entry: '进场触发', reveal: '现身触发', death: '死亡触发', prepare: '准备步骤触发', prepareTrigger: '准备步骤触发', end: '结束步骤触发', endTrigger: '结束步骤触发', graveHiddenWin: '墓地触发', graveHiddenEnd: '墓地触发', 'region-win': '赢取触发' };
const samePlan = (def, plan) => def && plan && ['operation', 'effect', 'target'].every(k => def[k] === undefined || def[k] === plan[k]);
function sourceCard(s, a) {
    const id = a.plan?.grantedBy ?? a.grantedBy ?? a.cardId ?? a.sourceId ?? a.plan?.sourceId;
    return s.cards[id] ?? s.societies?.find(c => c.id === id) ?? s.districts?.find(c => c?.id === id) ?? s.players.flatMap(p => p.scoreCards ?? []).find(c => c.id === id);
}
export function abilityDescription(s, a) {
    if (!a)
        return '';
    for (const text of [a.abilityDescription, a.abilityText, a.plan?.abilityText])
        if (text?.trim())
            return body(text);
    const plan = a.plan ?? {}, label = plan.abilityLabel ?? a.keyword;
    const key = a.event === 'reputation' ? '声望' : a.event === 'keyword-influence' ? a.keyword : a.effect?.kind === 'seal-from-graveyard' ? '传闻' : label;
    if (key) {
        const reference = keywordReference.find(({ name }) => name === key || name === key + 'X');
        if (reference)
            return `${reference.name}：${reference.meaning}`;
        if (key === '护盾标志')
            return '强制触发：当此牌成为敌方卡牌或能力的目标时，移除一个护盾标志，然后终止该效果。';
    }
    if (a.kind === 'rule-return-aside')
        return '将本次隐秘对抗展示后仍置于一旁的牌，置于其拥有者的牌库底。';
    if (a.kind === 'rule-return-region')
        return '将该地区的角色和附属置于其拥有者的牌库底，然后将地区置于赢取者的计分区；非任务地区翻开新地区。';
    const card = sourceCard(s, a);
    if (!card)
        return '';
    const parts = blocks(card.text);
    if (a.kind === 'hidden-effect' || plan.hiddenAbility || a.event === 'hidden-ended') {
        const hidden = parts.filter(b => b.heading === '隐秘');
        if (hidden.length)
            return hidden.map(b => b.text).join('\n');
    }
    const actions = parts.filter(b => b.heading.includes('行动') && !b.heading.includes('触发'));
    if (plan.actionIndex !== undefined && actions[plan.actionIndex])
        return actions[plan.actionIndex].text;
    if (a.kind === 'play-spell')
        return body(card.text);
    const hooks = card.automation ?? {};
    const eventKey = Object.entries(eventHeads).find(([key]) => samePlan(hooks[key], plan))?.[0];
    const expected = eventHeads[eventKey ?? a.event];
    if (expected) {
        const found = parts.filter(b => b.heading === expected || expected === '赢取触发' && b.heading.includes('赢取'));
        if (found.length === 1)
            return found[0].text;
    }
    const generic = parts.filter(b => /^(?:强制)?触发$/.test(b.heading) || b.heading === '墓地触发');
    if (generic.length === 1)
        return generic[0].text;
    // Ambiguous old records show the source's rules rather than invent a
    // description or silently display a different ability.
    return body(card.text).replace(/\n能力图标\s*[/／][\s\S]*$/, '').trim();
}
export function abilityDescriptionView(s, a, viewer) {
    const id = a.cardId ?? a.sourceId ?? a.plan?.sourceId, l = s.locations[id];
    if (a.controller !== viewer && (l?.secretPlan || l?.faceDown) && /^(?:暗藏者|秘密计划)/.test(a.displayName ?? ''))
        return '背面卡牌的能力。';
    return abilityDescription(s, a);
}
