// Card names retain their bold identity spans. All other card text is plain.
export const plainCardText = text => String(text ?? '').replaceAll('**', '');
export const normalizeActionCostNotation = text => String(text ?? '').replace(/行动[，,]\s*((?:\*\*)?[0-9０-９]+(?:\*\*)?)/g, '行动$1');
export const normalizeCardTerminology = text => normalizeActionCostNotation(text).replaceAll('付费现身', '付费翻面').replace(/正面打出或(?:付费)?翻面/g, '打出或付费翻面').replaceAll('副名称', '副名').replaceAll('你的资产区', '本方资产区').replaceAll('你的秘社', '本方秘社').replaceAll('控制权', '操控权').replaceAll('记分区', '计分区');
export function splitCardRules(text, faq) {
    const value = String(text ?? ''), match = /^[ \t]*FAQ\s*[：:]\s*/im.exec(value);
    return { text: (match ? value.slice(0, match.index) : value).trim(), faq: faq === undefined ? (match ? value.slice(match.index + match[0].length).trim() : '') : String(faq).trim() };
}
// FAQ remains verbatim. Keep operative restrictions outside the reminder text.
export function cleanCardRules(text, { normalizeTerminology = true } = {}) {
    const plain = normalizeTerminology ? normalizeCardTerminology(plainCardText(text)) : plainCardText(text), faq = plain.search(/^[ \t]*FAQ\s*[：:]/im), body = faq < 0 ? plain : plain.slice(0, faq), tail = faq < 0 ? '' : plain.slice(faq), definitions = [];
    const protectedBody = body.replace(/（哲人石标志具有效果：[^（）]+）/g, value => { definitions.push(value); return `\uE000${definitions.length - 1}\uE001`; });
    const prepared = protectedBody.replace(/任意张(?:[（(]至少1张[）)]|至少1张)/g, '任意数量且至少1张').replace(/所有(?:[（(]至少一个[）)]|至少一个)势力标志/g, '全部势力标志且实际移除至少一个').replace(/[（(]不能小于1[）)]/g, '且X不能小于1').replace('X，且X不能小于1', 'X且X不能小于1').replace(/[（(]但仍需满足忠诚需求[）)]/g, '，但仍需满足忠诚需求').replace(/[（(]不能选择血肉之屋自身[）)]/g, '不能选择血肉之屋自身。');
    let result = '', depth = 0;
    for (const ch of prepared) {
        if (ch === '（' || ch === '(') {
            depth++;
            continue;
        }
        if ((ch === '）' || ch === ')') && depth) {
            depth--;
            continue;
        }
        if (!depth)
            result += ch;
    }
    const cleaned = result.replace(/\uE000(\d+)\uE001/g, (_, i) => definitions[Number(i)]).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return cleaned + (tail ? (cleaned ? '\n\n' : '') + tail : '');
}
export const comparableCardRules = text => splitCardRules(cleanCardRules(text)).text;
export function plainCatalogText(catalog) {
    const tree = structuredClone(catalog.tree), root = tree.find(n => n.cockatrice_carddatabase).cockatrice_carddatabase;
    const nodes = root.find(n => n.cards).cards;
    for (const node of nodes) {
        if (!node.card)
            continue;
        for (const entry of node.card) {
            if (entry.text)
                entry.text = [{ '#text': cleanCardRules(catalogValue(entry.text)) }];
            if (entry.prop)
                for (const prop of entry.prop)
                    for (const key of ['subtitle', 'flavortext'])
                        if (key in prop)
                            prop[key] = [{ '#text': plainCardText(catalogValue(prop[key])) }];
        }
    }
    return { ...catalog, tree, cards: catalog.cards.map(card => ({ ...card, text: cleanCardRules(card.text), subtitle: plainCardText(card.subtitle), flavorText: plainCardText(card.flavorText), properties: { ...card.properties, subtitle: plainCardText(card.subtitle), flavortext: plainCardText(card.flavorText) } })) };
}
function catalogValue(nodes) { return (nodes ?? []).map(n => n['#text'] ?? (n['#cdata'] ? catalogValue(n['#cdata']) : '')).join(''); }
