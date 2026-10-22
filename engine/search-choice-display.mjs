const byName = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });
export function searchChoiceDisplay(choice) {
    if (!choice?.cards)
        return choice;
    const search = choice.kind === 'secrecy-batch-deep-seal' || choice.kind === 'search' || choice.kind?.endsWith('-search') || ['search', 'simultaneous-search', 'setup-secret'].includes(choice.mode);
    if (!search)
        return choice;
    return { ...choice, cards: [...choice.cards].sort((a, b) => byName.compare(a.name ?? '', b.name ?? '')) };
}
