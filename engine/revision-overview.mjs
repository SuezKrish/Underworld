import { revisionTextDiff } from './card-revision-history.mjs';
import { splitCardRules } from './card-text-format.mjs';
import displayPolicy from '../data/revision-display-policy.json' with { type: 'json' };
// Historical entries remain intact. This is the single original/final public view.
export function revisionOverview(card) {
    const rows = card.revisions ?? [], groups = new Map();
    const add = (key, row) => {
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(row);
    };
    for (const row of rows) {
        if (row.field) {
            add(row.field, row);
            continue;
        }
        const before = splitCardRules(row.before), after = splitCardRules(row.after);
        if (before.text !== after.text)
            add('正文', { ...row, before: before.text, after: after.text });
    }
    return [...groups].flatMap(([field, entries]) => {
        let before, after;
        if (field === '正文') {
            after = card.latest.text;
            const source = entries.find(r => r.kind === '来源对照');
            before = source ? source.before : after;
            if (!source)
                for (const r of [...entries].reverse())
                    if (before.includes(r.after))
                        before = r.after ? before.replace(r.after, r.before) : r.before;
            const original = displayPolicy.originalClauses[card.id];
            if (original && after.includes(original.current))
                before = after.replace(original.current, original.original);
        }
        else {
            before = entries[0].before;
            after = entries.at(-1).after;
        }
        if (before === after)
            return [];
        return [{ field, before, after, kinds: [...new Set(entries.map(r => r.kind === '来源对照' ? '正文修订' : r.kind))], diff: revisionTextDiff(before, after) }];
    });
}
