export function revisionTextDiff(before, after) {
    const a = Array.from(before), b = Array.from(after);
    let start = 0, end = 0;
    while (start < a.length && start < b.length && a[start] === b[start])
        start++;
    while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end])
        end++;
    return { prefix: a.slice(0, start).join(''), removed: a.slice(start, a.length - end).join(''), added: b.slice(start, b.length - end).join(''), suffix: end ? a.slice(-end).join('') : '' };
}
import history from "../data/public-revisions.json" with { type: "json" };
export function cardRevisionHistory(cards) { const ids = new Set(cards.map(c => c.id)); const rows = history.cards.filter(c => ids.has(c.id)); return { ...history, cards: rows, cardCount: rows.length, revisionCount: rows.reduce((n, c) => n + c.revisions.length, 0), reviewedCards: cards.length }; }
