// A form changes this battlefield object, not the catalog template. Preserve
// every overwritten field so departure and round expiry restore the same card.
export function applyCardForm(s, id, patch, { duration } = {}) {
    const card = s.cards[id], loc = s.locations[id];
    if (!card || !['play', 'society'].includes(loc?.zone) || loc.faceDown)
        return false;
    card.cardForm ??= { original: {}, missing: [], zoneVersion: loc.zoneVersion };
    const form = card.cardForm;
    for (const [key, value] of Object.entries(patch)) {
        if (!Object.hasOwn(form.original, key) && !form.missing.includes(key)) {
            if (Object.hasOwn(card, key))
                form.original[key] = structuredClone(card[key]);
            else
                form.missing.push(key);
        }
        if (value === undefined)
            delete card[key];
        else
            card[key] = structuredClone(value);
    }
    form.duration = duration;
    return true;
}
export function restoreCardForm(s, id) {
    const card = s.cards[id], form = card?.cardForm;
    if (!form)
        return false;
    for (const key of form.missing)
        delete card[key];
    Object.assign(card, structuredClone(form.original));
    delete card.cardForm;
    return true;
}
export function expireCardForms(s, duration) {
    for (const [id, card] of Object.entries(s.cards))
        if (card.cardForm?.duration === duration)
            restoreCardForm(s, id);
}
// Transformation uses an alternate printed face for the same physical card.
// In particular, the face template's token flag never turns a real card into a token.
export function transformCard(s, id, face) {
    const fields = face.type === 'society' ? ['catalogId', 'name', 'displayName', 'text', 'subtitle', 'flavorText', 'type', 'traits', 'faction', 'plan', 'initialHand', 'initialSelectable'] : ['catalogId', 'name', 'displayName', 'type', 'subtitle', 'flavorText', 'text', 'printedCost', 'printedCostText', 'faction', 'magicDomains', 'loyalty', 'icons', 'temporaryIcons', 'defense', 'subtypes', 'unique', 'keywords', 'conditionalKeywords', 'automation', 'attachment', 'spell', 'action', 'hiddenAbilities', 'cannotMove', 'noEquipment', 'noAttachments'];
    return applyCardForm(s, id, Object.fromEntries(fields.map(k => [k, face[k]])));
}
