import { cardTypes, hasAnyCardType } from './card-types.mjs';
import { splitCardRules } from './card-text-format.mjs';
const domainAliases = { 心: '心灵', 心灵: '心灵', 圣: '神圣', 神圣: '神圣', 星: '星辰', 星辰: '星辰', 死: '死亡', 死亡: '死亡', 血: '鲜血', 鲜血: '鲜血', 无: '无' };
const clean = value => String(value ?? '').replace(/\*\*/g, '').trim().toLowerCase();
export function printedCostForSearch(card) { const n = Number(String(card.printedCost ?? '').trim()); return Number.isFinite(n) ? n : 0; }
export function mainTypesForSearch(card) { return cardTypes(card).map(t => t === '遭遇角色' ? 'character' : t); }
export function magicDomainsForSearch(card) { const raw = card.magicDomains ?? String(card.magic ?? '').split(/[／/、,，\s]+/); return [...new Set(raw.filter(x => x && x !== '无').map(x => domainAliases[x] ?? x))]; }
function valuesFor(card, key) {
    if (key === 't')
        return mainTypesForSearch(card);
    if (key === 's')
        return (card.subtypes ?? String(card.typeLine ?? '').split('-').slice(1).join('-').split(/[／/、,，]/)).map(clean);
    if (key === 'm') {
        const domains = magicDomainsForSearch(card);
        return domains.length ? domains : ['无'];
    }
    if (key === 'c')
        return card.factionColors ?? [String(card.faction ?? '中立').split(/[·・]/)[0]];
    if (key === 'f')
        return [String(card.faction ?? '').split(/[·・]/).slice(1).join('·')];
    return [];
}
function alternativeMatches(card, key, value) {
    if (key === 'o')
        return printedCostForSearch(card) === Number(value);
    if (key === 'u')
        return (card.unique === true || Number(card.unique) === 1 ? 1 : 0) === Number(value);
    if (key === 't') {
        const types = mainTypesForSearch({ type: value });
        return types.length > 0 && types.every(type => valuesFor(card, key).includes(type));
    }
    if (key === 'm')
        value = domainAliases[value.replace(/[【】［］\[\]]/g, '')] ?? value;
    return valuesFor(card, key).some(actual => clean(actual) === clean(value));
}
export function parseCardSearch(query = '') {
    const text = String(query).replaceAll('：', ':').replaceAll('！', '!'), filters = [], errors = [], free = [];
    const pattern = /(^|\s)([tsmcfou])\s*([:!<>])\s*((?:"[^"]*"|'[^']*'|[^\s|｜]+)(?:\s*[|｜]\s*(?:"[^"]*"|'[^']*'|[^\s|｜]+))*)/gi;
    let end = 0;
    for (const match of text.matchAll(pattern)) {
        free.push(text.slice(end, match.index));
        end = match.index + match[0].length;
        const key = match[2].toLowerCase(), operator = match[3], values = match[4].split(/[|｜]/).map(x => clean(x.replace(/^(["'])(.*)\1$/, '$2')));
        if ((operator === '<' || operator === '>') && key !== 'o')
            errors.push('< 和 > 仅适用于印刷费用 o');
        if (key === 'o' && (values.some(x => !/^\d+(?:\.\d+)?$/.test(x)) || ['<', '>'].includes(operator) && values.length !== 1))
            errors.push('印刷费用需要填写数字；比较条件只接受一个数字');
        if (key === 'u' && values.some(x => !/^[01]$/.test(x)))
            errors.push('独有筛选 u 只接受1（独有）或0（非独有）');
        if (values.some(x => !x))
            errors.push('筛选条件不能为空');
        filters.push({ key, operator, values });
    }
    free.push(text.slice(end));
    const terms = free.join(' ').trim().split(/\s+/).filter(Boolean).map(clean);
    if (terms.some(t => /^[tsmcfou]\s*[:!<>]$/i.test(t)))
        errors.push('请在筛选符号后填写条件');
    return { filters, terms, errors };
}
export function matchesCardSearch(card, search) {
    const parsed = typeof search === 'string' ? parseCardSearch(search) : search;
    if (parsed.errors.length)
        return false;
    const haystack = clean([card.name, card.id, card.code, card.subtitle, card.flavorText, splitCardRules(card.text).text, card.typeLine, card.faction, card.magic].join(' '));
    return parsed.terms.every(term => haystack.includes(term)) && parsed.filters.every(({ key, operator, values }) => {
        if (operator === '<')
            return printedCostForSearch(card) < Number(values[0]);
        if (operator === '>')
            return printedCostForSearch(card) > Number(values[0]);
        const matched = values.some(value => alternativeMatches(card, key, value));
        return operator === '!' ? !matched : matched;
    });
}
export function hasAbilityIconCounts(card) {
    if (hasAnyCardType(card, ['spell', 'task']))
        return false;
    return [card.effectiveIcons ?? card.icons, card.effectiveTemporaryIcons ?? card.temporaryIcons].some(icons => ['investigation', 'battle', 'influence'].some(key => (icons?.[key] ?? 0) > 0));
}
export function canReadCardText(card, viewer) { return !card.faceDown || typeof viewer === 'number' && (card.zone === 'sealed' ? card.owner === viewer : card.controller === viewer); }
