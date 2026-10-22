import { splitCardRules, normalizeCardTerminology, cleanCardRules } from './card-text-format.mjs';
import expansionRulings from '../data/expansion-text-rulings.json' with { type: 'json' };
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import revisions from '../data/card-revisions.json' with { type: 'json' };
const options = { preserveOrder: true, ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, trimValues: false };
const children = (nodes, key) => nodes.find(n => key in n)?.[key];
const content = nodes => (nodes ?? []).map(n => n['#text'] ?? (n['#cdata'] ? content(n['#cdata']) : '')).join('');
const get = (nodes, key) => content(children(nodes, key));
function cleanWhitespace(nodes) {
    const hasElements = nodes.some(n => Object.keys(n).some(k => k !== ':@' && k !== '#text' && k !== '#cdata'));
    for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (hasElements && typeof n['#text'] === 'string' && !n['#text'].trim()) {
            nodes.splice(i, 1);
            continue;
        }
        for (const [k, v] of Object.entries(n))
            if (k !== ':@' && Array.isArray(v))
                cleanWhitespace(v);
    }
}
function set(nodes, key, value) {
    let n = nodes.find(n => key in n);
    if (!n) {
        n = { [key]: [] };
        nodes.push(n);
    }
    n[key] = [{ '#text': value }];
}
function uniqueValue(value) {
    const v = value === undefined ? '0' : String(value).trim();
    if (!['0', '1'].includes(v))
        throw Error('unique 独有属性只能为0或1');
    return Number(v);
}
function displayNameValue(value, name) {
    const v = value || name;
    if (typeof v !== 'string' || v.length > 300 || v.replace(/\*\*/g, '') !== name || v.includes('\n') || (v !== name && !/^(?:[^*]|\*\*[^*\n]+\*\*)*$/.test(v)))
        throw Error('显示牌名只能在原牌名中增加 **加粗** 标记');
    return v;
}
export function simplified(text) { return text.split(/^\s*[-—_=─━－]{5,}\s*$/m, 1)[0].trim(); }
export function parseCatalog(xml) {
    if (typeof xml !== 'string' || new TextEncoder().encode(xml).length > 1700000)
        throw Error('XML 文件不得超过1.7 MB');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml))
        throw Error('不支持包含 DTD 或实体声明的 XML');
    if (XMLValidator.validate(xml) !== true)
        throw Error('XML 格式无效');
    const tree = new XMLParser(options).parse(xml);
    cleanWhitespace(tree);
    const root = tree.find(n => n.cockatrice_carddatabase);
    const nodes = children(root?.cockatrice_carddatabase ?? [], 'cards');
    if (!nodes)
        throw Error('文件需要包含 cockatrice_carddatabase/cards');
    const cards = [], seen = new Set(), counts = new Map();
    let removed = 0;
    for (const node of nodes) {
        if (!node.card)
            continue;
        const c = node.card, p = children(c, 'prop');
        if (!p)
            throw Error('卡牌缺少 prop 属性');
        const originalName = get(c, 'name').trim();
        if (!originalName)
            throw Error('卡牌名称不能为空');
        const code = originalName.split(/\s/)[0], count = (counts.get(code) ?? 0) + 1;
        counts.set(code, count);
        const id = get(p, 'hwid').trim() || (count === 1 ? code : `${code}--${count}`);
        if (seen.has(id) || id.length > 120)
            throw Error('hwid 重复或过长：' + id);
        seen.add(id);
        const loose = c.filter(n => typeof n['#text'] === 'string' && n['#text'].trim()).map(n => n['#text'].trim()).join('\n\n');
        const raw = get(c, 'text'), base = simplified(raw), text = base + (loose ? '\n\n' + simplified(loose) : '') + (get(c, 'faq').trim() && !/^[ \t]*FAQ\s*[：:]/im.test(base) ? '\n\nFAQ：' + (get(c, 'faq').trim().startsWith(':') ? '' : '\n') + get(c, 'faq').trim() : '');
        if (base !== raw.trim())
            removed++;
        for (let i = c.length - 1; i >= 0; i--)
            if ('#text' in c[i])
                c.splice(i, 1);
        set(c, 'text', text);
        if (p.filter(n => 'unique' in n).length > 1)
            throw Error('unique 独有属性不能重复');
        const unique = uniqueValue(p.some(n => 'unique' in n) ? get(p, 'unique') : undefined);
        set(p, 'unique', String(unique));
        const name = originalName.replace(/^\S+\s+/, '');
        set(p, 'displayname', displayNameValue(get(p, 'displayname'), name));
        set(p, 'hwid', id);
        set(p, 'subtitle', get(p, 'subtitle'));
        set(p, 'flavortext', get(p, 'flavortext'));
        set(p, 'textformat', 'markdown');
        const props = Object.fromEntries(p.filter(n => !('#text' in n)).map(n => { const k = Object.keys(n).find(k => k !== ':@'); return [k, content(n[k])]; }));
        cards.push({ id, code, name, displayName: props.displayname, originalName, text, unique, subtitle: props.subtitle, flavorText: props.flavortext, textFormat: 'markdown', type: props.maintype || props.type, typeLine: props.type, cost: props.manacost, printedCost: props.cmc, faction: props.colors, magic: props.coloridentity, iconsDefense: props.pt || '', side: props.side, layout: props.layout, token: get(c, 'token') === '1', sets: c.filter(n => n.set).map(n => ({ name: content(n.set), number: n[':@']?.['@_num'] || '' })), related: c.filter(n => n.related).map(n => content(n.related)), properties: props });
    }
    if (!cards.length || cards.length > 2000)
        throw Error('卡牌数量需要在1至2000之间');
    root[':@'] = { ...root[':@'], '@_hiddenworldSchema': '1' };
    const sets = children(root.cockatrice_carddatabase, 'sets') ?? [];
    return { tree, cards, removed, sets: sets.filter(n => n.set).map(n => ({ name: get(n.set, 'name'), longName: get(n.set, 'longname') })) };
}
export function catalogXml(catalog) {
    const tree = structuredClone(catalog.tree), root = tree.find(n => n.cockatrice_carddatabase).cockatrice_carddatabase;
    for (const node of children(root, 'cards') ?? []) {
        if (!node.card)
            continue;
        const parts = splitCardRules(get(node.card, 'text'));
        set(node.card, 'text', parts.text);
        if (parts.faq)
            set(node.card, 'faq', parts.faq);
        else
            for (let i = node.card.length - 1; i >= 0; i--)
                if (node.card[i].faq)
                    node.card.splice(i, 1);
    }
    return new XMLBuilder({ ...options, format: true, suppressEmptyNode: false }).build(tree);
}
// Keep XML exports consistent with projected text and type variants, without
// modifying the canonical catalog used by the owner editor.
export function mapCatalogCards(catalog, variant) {
    const tree = structuredClone(catalog.tree), cards = catalog.cards.map(variant), byId = new Map(cards.map(card => [card.id, card]));
    const root = tree.find(n => n.cockatrice_carddatabase).cockatrice_carddatabase;
    for (const node of children(root, 'cards') ?? []) {
        if (!node.card)
            continue;
        const props = children(node.card, 'prop'), card = byId.get(get(props, 'hwid'));
        if (!card)
            continue;
        set(node.card, 'text', card.text);
        set(props, 'type', card.typeLine);
    }
    return { ...catalog, tree, cards };
}
export function catalogSubset(catalog, ids) {
    const tree = structuredClone(catalog.tree), root = tree.find(n => n.cockatrice_carddatabase).cockatrice_carddatabase, nodes = children(root, 'cards'), allowed = catalog.cards.filter(c => ids.has(c.id)), names = new Set(allowed.flatMap(c => [c.id, c.code, c.name, c.originalName])), setNames = new Set(allowed.flatMap(c => c.sets.map(s => s.name)));
    for (let i = nodes.length - 1; i >= 0; i--) {
        const c = nodes[i].card;
        if (!c || !ids.has(get(children(c, 'prop'), 'hwid'))) {
            nodes.splice(i, 1);
            continue;
        }
        for (let j = c.length - 1; j >= 0; j--)
            if (c[j].related && !names.has(content(c[j].related)))
                c.splice(j, 1);
    }
    const sets = children(root, 'sets') ?? [];
    for (let i = sets.length - 1; i >= 0; i--)
        if (sets[i].set && !setNames.has(get(sets[i].set, 'name')))
            sets.splice(i, 1);
    return { ...catalog, tree, cards: allowed.map(c => ({ ...c, related: c.related.filter(r => names.has(r)) })), sets: catalog.sets.filter(s => setNames.has(s.name)) };
}
export function editCatalog(catalog, id, patch) {
    const card = catalog.cards.find(c => c.id === id);
    if (!card)
        throw Error('卡牌不存在');
    for (const [key, max] of [['text', 24000], ['subtitle', 200], ['flavorText', 4000]])
        if (typeof patch[key] !== 'string' || patch[key].length > max)
            throw Error('卡牌字段无效或过长');
    const nodes = children(catalog.tree.find(n => n.cockatrice_carddatabase).cockatrice_carddatabase, 'cards');
    const c = nodes.find(n => n.card && get(children(n.card, 'prop'), 'hwid') === id).card, p = children(c, 'prop');
    set(p, 'unique', String(uniqueValue(patch.unique === undefined ? card.unique : patch.unique)));
    set(p, 'displayname', displayNameValue(patch.displayName === undefined ? card.displayName : patch.displayName, card.name));
    if (patch.faq !== undefined && (typeof patch.faq !== 'string' || patch.faq.length > 24000))
        throw Error('FAQ 字段无效或过长');
    const parts = splitCardRules(patch.text, patch.faq);
    set(c, 'text', parts.text + (parts.faq ? '\n\nFAQ：' + (parts.faq.startsWith(':') ? '' : '\n') + parts.faq : ''));
    set(p, 'subtitle', patch.subtitle);
    set(p, 'flavortext', patch.flavorText);
    return parseCatalog(catalogXml(catalog));
}
// Owner rulings for known historical values. Newer unrelated values are kept.
export function applyRulings(xml) {
    const catalog = parseCatalog(xml), nodes = children(catalog.tree.find(n => n.cockatrice_carddatabase).cockatrice_carddatabase, 'cards');
    let changed = false;
    for (const node of nodes) {
        if (!node.card)
            continue;
        const c = node.card, p = children(c, 'prop'), id = get(p, 'hwid');
        const revision = revisions.find(r => r.id === id && r.oldName === get(c, 'name'));
        if (revision) {
            const updated = parseCatalog(`<cockatrice_carddatabase><cards>${revision.xml}</cards></cockatrice_carddatabase>`);
            node.card = children(updated.tree.find(n => n.cockatrice_carddatabase).cockatrice_carddatabase, 'cards').find(n => n.card).card;
            changed = true;
            continue;
        }
        for (const ruling of expansionRulings.filter(r => r.id === id)) {
            if (ruling.property) {
                if (get(p, ruling.property) === ruling.old) {
                    set(p, ruling.property, ruling.text);
                    changed = true;
                }
                continue;
            }
            const text = get(c, 'text'), plain = text.replace(/\*\*/g, ''), nextPlain = ruling.text.replace(/\*\*/g, '');
            if (plain === ruling.old || cleanCardRules(text) === cleanCardRules(ruling.old)) {
                set(c, 'text', ruling.text);
                changed = true;
                continue;
            }
            if (plain.includes(nextPlain))
                continue;
            if (ruling.old.includes('\n'))
                continue;
            const lines = text.split('\n'), i = lines.findIndex(line => line.replace(/\*\*/g, '') === ruling.old);
            if (i >= 0) {
                lines[i] = ruling.text;
                set(c, 'text', lines.join('\n'));
                changed = true;
            }
        }
        if (id === 'BH58' && get(p, 'displayname') === '荒**郊加油站**') {
            set(p, 'displayname', '**荒郊加油站**');
            changed = true;
        }
        ;
        ;
        ;
        ;
        ;
        ;
        ;
        ;
        if (id === 'BQ087') {
            if (get(p, 'pt') === '［白眼］［白眼］［白眼］［黑刀］［黑星］/1') {
                set(p, 'pt', '［白眼］［白眼］［白眼］［黑刀］［黑星］/5');
                changed = true;
            }
            const text = get(c, 'text');
            if (/能力图标\/防御力：[^\n]+\/1(?=\n|$)/.test(text)) {
                set(c, 'text', text.replace(/(能力图标\/防御力：[^\n]+)\/1(?=\n|$)/, '$1/5'));
                changed = true;
            }
        }
        ;
        ;
        if (id === 'DQ15') {
            const text = get(c, 'text');
            if (text.replace(/\*\*/g, '').startsWith('进场强制触发：每位玩家各将其牌库顶牌封印在该地区上。')) {
                set(c, 'text', '**持续**：本地区翻开时，每位玩家各将其牌库顶牌封印在该地区上。\n**持续**：当你赢取本地区时，你可以将封印在其上的所有牌洗入其拥有者的牌库。');
                changed = true;
            }
        }
        ;
        if (id === 'MSBQ01') {
            const text = get(c, 'text');
            const next = text.replace(/^触发：(每当一个本方角色离场时|本方角色离场时)[^\n]*/m, '持续：当一个本方角色离场时，若有名为鲜血的附属结附于其上，你可以将该附属封印在龙之欢宴上，而非置于墓地。');
            if (next !== text) {
                set(c, 'text', next);
                changed = true;
            }
        }
        if (['DQ14', 'DQ19'].includes(id)) {
            const text = get(c, 'text');
            const next = text.replace('每回合只能发动一次', '每位玩家每回合各只能发动一次').replace('每回合只能各发动一次', '每位玩家每回合各只能发动一次');
            if (next !== text) {
                set(c, 'text', next);
                changed = true;
            }
        }
        if (id === 'DQ12') {
            const text = get(c, 'text');
            if (text.replace(/\*\*/g, '').includes('赢取触发：本局游戏中，你获胜所需的分数减少2。')) {
                set(c, 'text', text.replace(/(?:\*\*)?赢取触发(?:\*\*)?：本局游戏中，你获胜所需的分数减少2。/, '持续：当你赢取武陵源时，本局游戏中你获胜所需的分数减少2。'));
                changed = true;
            }
        }
    }
    for (const node of nodes) {
        if (!node.card)
            continue;
        for (const key of ['text', 'faq']) {
            const text = get(node.card, key), next = normalizeCardTerminology(text);
            if (next !== text) {
                set(node.card, key, next);
                changed = true;
            }
        }
    }
    return changed ? catalogXml(catalog) : xml;
}
