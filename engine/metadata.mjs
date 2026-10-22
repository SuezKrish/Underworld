import metadata from '../data/card-metadata.json' with { type: 'json' };
import { parseCatalog, catalogXml } from './catalog.mjs';
const child = (n, k) => n.find(x => k in x)?.[k], value = n => (n ?? []).map(x => x['#text'] ?? '').join('');
function set(n, k, v) {
    let entry = n.find(x => k in x);
    if (!entry) {
        entry = { [k]: [] };
        n.push(entry);
    }
    entry[k] = [{ '#text': String(v) }];
}
const rows = new Map(metadata.records.map(r => [r.id, r]));
// A source batch fills only matching historical fields. The saved batch marker
// protects later manual edits, including clearing an imported field.
export function applyMetadata(xml) {
    const catalog = parseCatalog(xml), nodes = child(catalog.tree.find(n => n.cockatrice_carddatabase).cockatrice_carddatabase, 'cards');
    let changed = false;
    for (const card of catalog.cards) {
        const row = rows.get(card.id);
        if (!row || card.name !== row.name || card.properties.metadatabatch === metadata.batch)
            continue;
        const node = nodes.find(n => n.card && value(child(child(n.card, 'prop'), 'hwid')) === card.id).card, props = child(node, 'prop');
        for (const [key, next] of Object.entries(row.patch ?? {})) {
            if (!Object.hasOwn(row.baseline, key) || card[key] !== row.baseline[key])
                continue;
            if (key === 'text')
                set(node, 'text', next);
            else {
                const tag = { unique: 'unique', displayName: 'displayname', subtitle: 'subtitle', flavorText: 'flavortext' }[key];
                if (tag)
                    set(props, tag, next);
            }
        }
        set(props, 'metadatabatch', metadata.batch);
        changed = true;
    }
    return changed ? catalogXml(parseCatalog(catalogXml(catalog))) : xml;
}
export function metadataReport() { return metadata; }
export function metadataFor(card) { const row = rows.get(card.id); return row && row.name === card.name ? { sources: row.sources, status: row.status, issues: row.issues, appliedFields: Object.keys(row.patch ?? {}), bodyComparison: row.bodyComparison } : null; }
