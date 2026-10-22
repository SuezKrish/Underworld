export function effectDraftCosts(command) {
    const scalar = ['sacrificeId', 'discardId', 'assetId', 'timeCardId', 'costCardId', 'costId'];
    const lists = ['costIds', 'sacrificeIds', 'discardIds', 'tapIds', 'sealIds', 'hadesIds', 'revealIds'];
    const payments = ['timePayments', 'progressPayments', 'actionPayments'];
    return [...new Set([...scalar.map(k => command?.[k]), ...lists.flatMap(k => command?.[k] ?? []), ...payments.flatMap(k => (command?.[k] ?? []).filter(p => (p.count ?? p.amount ?? 0) > 0).map(p => p.cardId))].filter(Boolean))];
}
export function effectDraftTargets(command) { return [...new Set([...(command?.targetIds ?? []), ...Object.values(command?.modeTargetIds ?? {}).flat(), ...(command?.distribution ?? []).map(x => x.targetId)].filter(Boolean))]; }
export function previewCardId(id, aliases = {}) { return aliases[id] ?? (id?.startsWith('district-host:') ? id.slice(14) : id); }
export function entryDestinationClass(id, destinations = {}, aliases = {}) { return destinations[previewCardId(id, aliases)]?.length ? 'pending-entry-district' : ''; }
export function effectPreviewClasses(id, preview, aliases = {}) {
    if (!preview)
        return '';
    const card = previewCardId(id, aliases), classes = [];
    if (card === previewCardId(preview.sourceId, aliases))
        classes.push('pending-trigger-source');
    if ((preview.targetIds ?? []).some(target => previewCardId(target, aliases) === card))
        classes.push('draft-effect-target');
    if ((preview.costIds ?? []).some(cost => previewCardId(cost, aliases) === card))
        classes.push('draft-cost-object');
    return classes.join(' ');
}
