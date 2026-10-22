// Unordered inventory of the BOT's own library; no positions or enemy cards.
export function botLibraryNames(s, p) {
    const counts = {};
    for (const id of s.players[p]?.deck ?? []) {
        const name = s.cards[id]?.name;
        if (name)
            counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
}
export const botLibraryHasName = (v, name) => v.bot?.libraryNames === undefined || (v.bot.libraryNames[name] ?? 0) > 0;
