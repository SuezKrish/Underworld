// Rules use the blank face in every query, including legacy name/type checks.
// The private printed face is restored on departure, never sent as rule data.
const blank = { name: '', displayName: '背面封印牌', subtitle: '', text: '', type: '', subtypes: [], traits: [], keywords: [], conditionalKeywords: {}, hiddenAbilities: [], automation: undefined, attachment: undefined, spell: undefined, action: undefined, assetAbility: undefined, prepareTrigger: undefined, endTrigger: undefined, cannotMove: false, noEquipment: false, noAttachments: false };
export function maskSealedFace(s, id) {
    const c = s.cards[id];
    if (!c || c.sealedFace)
        return;
    const original = {}, missing = [];
    for (const key of Object.keys(blank)) {
        if (Object.hasOwn(c, key))
            original[key] = structuredClone(c[key]);
        else
            missing.push(key);
    }
    c.sealedFace = { original, missing };
    for (const [key, value] of Object.entries(blank)) {
        if (value === undefined)
            delete c[key];
        else
            c[key] = structuredClone(value);
    }
}
export function printedSealedFace(card) {
    if (!card?.sealedFace)
        return card;
    const { sealedFace, ...c } = card;
    for (const key of sealedFace.missing)
        delete c[key];
    return { ...c, ...structuredClone(sealedFace.original) };
}
export function restoreSealedFace(s, id) {
    const c = s.cards[id];
    if (!c?.sealedFace)
        return false;
    s.cards[id] = printedSealedFace(c);
    return true;
}
