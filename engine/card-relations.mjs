export const RETIRED_CARD_IDS = new Set([]);
export const catalogCardVisible = card => !RETIRED_CARD_IDS.has(card.id) && !['TK011'].includes(card.id);
export function relatedCardsFor(card, catalog) {
    if (!card)
        return [];
    const id = card.catalogId ?? card.id, source = catalog.find(c => c.id === id) ?? card;
    const byReference = new Map();
    for (const c of catalog)
        for (const key of [c.id, c.code, c.originalName, c.name])
            if (key)
                byReference.set(key, c);
    const seen = new Set();
    return (source.related ?? []).flatMap(reference => {
        const target = byReference.get(reference) ?? byReference.get(String(reference).split(/\s+/)[0]);
        if (!target || target.id === id || seen.has(target.id) || RETIRED_CARD_IDS.has(target.id) || target.id === 'TK011' && id !== 'MSBQ02')
            return [];
        seen.add(target.id);
        return [target];
    });
}
