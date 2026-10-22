import { normalizeCardTerminology } from './card-text-format.mjs';
// Construction rules are independent of runtime card automation.
const plainText = text => normalizeCardTerminology(text).replace(/\*\*/g, '');
export const deckName = c => c.name.replace(/\*\*/g, '').trim();
export const factionColor = c => (c.faction ?? '').split('·')[0];
export const subtypes = c => (c.typeLine ?? '').split(/[-/]/).slice(1);
export const isCharacter = c => (c.type ?? '').split('/').includes('角色');
export const isAttachment = c => (c.type ?? '').split('/').includes('附属');
export const isShoggothCoreCandidate = c => !c.token && !/^ZH|^TK/.test(c.id) && isCharacter(c) && c.subtitle === '修格斯';
export const isMainCard = c => !isShoggothCoreCandidate(c) && !c.token && !/^ZH|^TK/.test(c.id) && ['角色', '附属', '事务', '角色/附属', '任务/地区'].includes(c.type);
export const startingHand = c => { const n = plainText(c.text).match(/初始手牌[：:]\s*(\d+)/)?.[1]; return n === undefined ? null : Number(n); };
export const isInitialSociety = c => c.type === '秘社' && !/^ZH/.test(c.id) && !/不能作为初始秘社牌/.test(plainText(c.text)) && startingHand(c) !== null;
export function normalizeDeck(input) {
    if (!input || typeof input !== 'object' || typeof input.name !== 'string' || input.name.trim().length < 1 || input.name.trim().length > 80)
        throw Error('卡组名称需要1至80个字符');
    if (!Array.isArray(input.cards) || input.cards.length > 2000)
        throw Error('主牌条目格式无效');
    const counts = new Map();
    for (const row of input.cards) {
        if (typeof row?.cardId !== 'string' || row.cardId.length > 120 || !Number.isSafeInteger(row.count) || row.count < 1 || row.count > 10000)
            throw Error('卡牌数量必须为1至10000的整数');
        const n = (counts.get(row.cardId) ?? 0) + row.count;
        if (n > 10000)
            throw Error('同一记录数量过大');
        counts.set(row.cardId, n);
    }
    const choices = input.choices ?? {};
    if ((typeof choices.color === 'string' && choices.color.length > 20) || (typeof choices.coreId === 'string' && choices.coreId.length > 120) || typeof input.societyId !== 'string' || input.societyId.length > 120 || !Array.isArray(choices.anchorNames ?? []) || (choices.anchorNames ?? []).length > 3 || (choices.anchorNames ?? []).some(x => typeof x !== 'string' || x.length > 200))
        throw Error('秘社选择无效');
    return { schemaVersion: 1, name: input.name.trim(), societyId: input.societyId, cards: [...counts].map(([cardId, count]) => ({ cardId, count })), choices: { color: typeof choices.color === 'string' ? choices.color : '', anchorNames: [...new Set(choices.anchorNames ?? [])], coreId: typeof choices.coreId === 'string' ? choices.coreId : '' } };
}
const typesAny = (c, a) => subtypes(c).some(x => a.includes(x));
const keyword = (c, k) => new RegExp(`(?:^|[\\s　])${k}(?=$|[\\s　])`).test(plainText(c.text).split(/FAQ/)[0]);
export function copyLimit(c, society, choices = {}) {
    c = { ...c, text: plainText(c.text) };
    society = society ? { ...society, text: plainText(society.text) } : society;
    const name = deckName(c);
    if (choices.anchorNames?.includes(name) || keyword(c, '唯一'))
        return 1;
    if (name === '无知路人' && c.text.includes('名称为无知路人的牌，构筑时在牌组中的数量没有限制') || society?.text.includes(`名称为${name}的牌，构筑时在牌组中的数量没有限制`) || society && c.text.includes(`若本方秘社为${society.name}，则名为${name}的牌，构筑时在牌组中的数量没有限制`))
        return Infinity;
    return 3;
}
export function cardAllowed(c, society, choices = {}) {
    c = { ...c, text: plainText(c.text) };
    if (!isMainCard(c))
        return false;
    if (!society)
        return true;
    const exclusive = c.text.split(/FAQ/)[0].match(/(?:【([^】]+)】|([\u4e00-\u9fff]+))秘社限定/);
    if (exclusive && (exclusive[1] ?? exclusive[2]) !== society.name)
        return false;
    const color = factionColor(c), any = a => typesAny(c, a), char = isCharacter(c), att = isAttachment(c), magic = ['心灵', '神圣', '星辰', '死亡', '鲜血'].includes(c.magic), base = a => a.includes(color);
    switch (society.id) {
        case 'MSBQ01': return base(['蓝', '绿', '中立']);
        case 'MSBQ02': return base(['灰', '红', '中立']);
        case 'MSBQ03': return base(['黑', '白', '中立']);
        case 'MSBQ04': return color === '中立' || color === choices.color;
        case 'MSCQ01': return base(['黄', '中立']) || any(['法师', '法术']);
        case 'MSCQ02': return base(['红', '中立']) || any(['灾难', '时间', '命运']);
        case 'MSJC10': return base(['黄', '中立']) || c.magic === '星辰';
        case 'MSJC11': return base(['绿', '中立']) || char && any(['人类']) && c.iconsDefense.includes('［黑刀］');
        case 'MSJC12': return base(['蓝', '中立']) || char && any(['吸血鬼', '奴仆']);
        case 'MSJC14': return base(['灰', '中立']) || !magic;
        case 'MSJC16': return base(['黑', '中立']) || c.magic === '死亡';
        case 'MSJC17': return base(['紫', '中立']) || any(['梦境']) || char && keyword(c, '灵体');
        case 'MSJZ02': return color === '绿' || any(['仙灵']);
        case 'MSJZ04': return base(['红', '紫', '中立']);
        case 'MSLC01': return base(['黄', '中立']);
        case 'MSLC02': return base(['绿', '中立']);
        case 'MSLC03': return base(['灰', '中立']);
        case 'MSLC04': return base(['白', '中立']);
        case 'MSLC05': return base(['白', '中立']) || c.magic === '星辰';
        case 'MSLC06': return color === '中立';
        case 'MSWM01': return base(['蓝', '黄', '中立']) || any(['吸血鬼', '阴魂']);
        case 'MSWM02': return base(['灰', '黄', '中立']) || any(['特工', '媒体', '互联网']);
        case 'MSWM04': return color === '紫';
        default: return true;
    }
}
export function constructionRules(s) { return plainText(s.text).split('\n').filter(l => /构筑|组牌|初始手牌|不能作为初始秘社/.test(l)); }
export function validateDeck(input, catalog, implementedIds = new Set(), options = {}) {
    const deck = normalizeDeck(input), byId = new Map(catalog.map(c => [c.id, c])), society = byId.get(deck.societyId), errors = [], warnings = [], pending = [], byName = new Map();
    let total = 0;
    const fail = (code, message, cardId) => errors.push({ code, message, ...(cardId ? { cardId } : {}) });
    const rows = deck.cards.map(r => ({ ...r, card: byId.get(r.cardId) }));
    for (const r of rows) {
        total += r.count;
        if (!r.card) {
            fail('missing-card', `卡牌记录 ${r.cardId} 当前不可用或已移除`, r.cardId);
            continue;
        }
        const name = deckName(r.card);
        byName.set(name, (byName.get(name) ?? 0) + r.count);
        if (!isMainCard(r.card))
            fail('main-zone', `${name}不能加入主牌组`, r.cardId);
        if (!implementedIds.has(r.cardId))
            pending.push({ cardId: r.cardId, name, count: r.count });
    }
    if (!society || !isInitialSociety(society))
        fail('society', '请选择可作为初始秘社的秘社牌');
    else {
        const source = options.societySources?.find(s => s.id === society.id) ?? society.constructionRuleSource;
        if (!source || source.name !== society.name || source.faction !== society.faction || JSON.stringify(source.rules.map(plainText)) !== JSON.stringify(constructionRules(society).map(plainText)))
            fail('society-unreviewed', '秘社构筑文字或规则资料已修改，需要重新接入校验后才能进入测试');
    }
    const min = 50;
    if (total < min)
        fail('minimum', `主牌组至少${min}张，目前${total}张；秘社与备牌不计入`);
    const usedNames = new Set();
    for (const r of rows) {
        if (!r.card)
            continue;
        const name = deckName(r.card);
        if (!usedNames.has(name)) {
            usedNames.add(name);
            const same = rows.filter(x => x.card && deckName(x.card) === name), limit = Math.min(...same.map(x => copyLimit(x.card, society, deck.choices)));
            if (byName.get(name) > limit)
                fail('copies', `${name}同名版本合计${byName.get(name)}张，最多${limit}张`, r.cardId);
        }
        if (society && !cardAllowed(r.card, society, deck.choices))
            fail('society-card', `${deckName(r.card)}不符合${society.name}的派系/类别限制`, r.cardId);
        const limited = plainText(r.card.text).split(/FAQ/)[0].match(/(?:【([^】]+)】|([\u4e00-\u9fff]+))秘社限定/);
        if (limited && society && limited[1] !== society.name && limited[2] !== society.name)
            fail('society-exclusive', `${name}仅限${limited[1] ?? limited[2]}秘社`, r.cardId);
    }
    const count = f => rows.reduce((n, r) => n + (r.card && f(r.card) ? r.count : 0), 0);
    const atLeast = (n, f, label) => {
        const actual = count(f);
        if (actual < n)
            fail('quota', `${label}至少${n}张，目前${actual}张`);
    };
    const outside = (a, max = 12) => {
        const actual = count(c => !a.includes(factionColor(c)));
        if (actual > max)
            fail('outside-quota', `非${a.join('/')}派系至多${max}张，目前${actual}张`);
    };
    if (society) {
        const id = society.id;
        if (/^MSJC0[1-8]$/.test(id))
            atLeast(25, c => factionColor(c) === factionColor(society), factionColor(society) + '派系牌');
        ;
        ;
        if (id === 'MSBQ02') {
            atLeast(12, c => typesAny(c, ['命令']), '命令牌');
            const core = byId.get(deck.choices.coreId);
            if (!core || !isShoggothCoreCandidate(core))
                fail('core', '请选择副名为修格斯的角色作为核心角色');
        }
        if (id === 'MSJZ01')
            atLeast(15, c => ['“猛禽”战术小组', '猛禽战术小组'].includes(c.subtitle), '副名为“猛禽”战术小组的牌');
        if (['MSJC13', 'MSJC15', 'MSWM03'].includes(id))
            outside([factionColor(society), '中立']);
        ;
        if (id !== 'MSBQ02' && deck.choices.coreId)
            fail('core-society', '只有修格斯秘社可以选择核心角色');
        if (id === 'MSBQ04' && !['黄', '绿', '蓝', '红', '灰', '白', '黑', '紫'].includes(deck.choices.color))
            fail('color', '天闻山庄需要选择一个颜色派系');
        if (deck.choices.anchorNames.length)
            fail('anchor-society', '只有西德尔档案馆可以指定锚定牌名');
        if (startingHand(society) === null)
            fail('initial-hand', '秘社缺少起始手牌资料');
    }
    const anchorCount = rows.reduce((n, r) => n + (0), 0);
    if (society && anchorCount > (startingHand(society) ?? 0))
        fail('anchor-hand', '锚定牌数量不能超过秘社的初始手牌数；初始手牌数为0时不能再加入锚定牌');
    if (pending.length)
        warnings.push(`有${pending.reduce((n, r) => n + r.count, 0)}张牌的对局能力尚未接入自动结算，可保存构筑草稿。`);
    if (society && !(options.environmentStatus?.(society) ?? society.environmentAudit)?.implemented)
        warnings.push(`本秘社尚有未接入能力：${(options.environmentStatus?.(society) ?? society.environmentAudit)?.reason ?? '运行能力尚未接入'}。已接入的能力可测试；世界牌库使用29张真实地区。`);
    if (rows.some(r => r.card?.id === 'XQ52'))
        warnings.push('无知路人（女）的XML牌名与不限数量文本不一致，当前按其XML名称最多3张，待确认是否合并牌名。');
    return { deck, total, min, society: society ? { id: society.id, name: society.name, text: society.text, initialHand: Math.max(0, (startingHand(society) ?? 0) - anchorCount), baseInitialHand: startingHand(society), anchorCount, faction: society.faction, rules: constructionRules(society) } : null, errors, warnings, pending, constructionLegal: errors.length === 0, playable: errors.length === 0 && pending.length === 0, countsByName: Object.fromEntries(byName) };
}
