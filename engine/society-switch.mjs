// Switching resets exhaustion but retains the society object and all links.
// Transformation has different exhaustion semantics and uses card-forms.mjs.
export function switchSociety(s, p, face) {
    const source = s.societies?.[p];
    if (!source || face?.type !== 'society')
        return false;
    const id = source.id, owner = source.owner;
    delete source.cardForm;
    Object.assign(source, structuredClone(face), { id, owner });
    s.cards[id] = source;
    if (s.societyStates?.[p])
        s.societyStates[p].tapped = false;
    if (s.locations[id])
        s.locations[id].tapped = false;
    return true;
}
