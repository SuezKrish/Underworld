import { hasCardType } from './card-types.mjs';
import { matchesCardNameFilter } from './card-names.mjs';
// These are engine mechanics, not card identities or natural-language guesses.
// The same automation on a renamed card must produce the same forecast.
export function fieldResponseRules(c) {
    const a = c?.automation ?? {}, rules = [];
    if (a.static === 'reputation-defense-barrier')
        rules.push({ kind: 'aura', own: true, filter: { type: 'character', keyword: '声望' }, grantKeywords: ['屏障'] });
    if (a.scarabStatic === 'attachment-asset-barrier')
        rules.push({ kind: 'aura', own: true, filter: { typesAny: ['attachment', 'asset'] }, grantKeywords: ['屏障'] });
    if (a.static === 'uncounterable-own-effects')
        rules.push({ kind: 'cannot-terminate', own: true });
    for (const aura of a.auras ?? [])
        rules.push({ kind: 'aura', ...aura });
    for (const watch of a.watch ?? [])
        if (watch.event === 'targeted')
            rules.push({ kind: 'targeted', ...watch });
    return rules;
}
export function responseFilter(c, f = {}, keyword = (c, k) => c.keywords?.includes(k)) {
    return !!c && (!f.type || hasCardType(c, f.type)) && (!f.typesAny || f.typesAny.some(t => hasCardType(c, t))) &&
        (!f.unique || c.unique) && (!f.nonToken || !hasCardType(c, 'token')) && (!f.requireSubtype || c.subtypes?.includes(f.requireSubtype)) &&
        (!f.subtypesAny || f.subtypesAny.some(t => c.subtypes?.includes(t))) && (!f.excludeSubtype || !c.subtypes?.includes(f.excludeSubtype)) &&
        (!f.keyword || keyword(c, f.keyword)) && (!f.magic || c.magicDomains?.includes(f.magic)) && (!f.anyDomain || c.magicDomains?.length) &&
        (!f.noPrintedDomain || !c.magicDomains?.length) && (!f.faction || c.faction?.split('·')[0] === f.faction) &&
        (!f.factionGroup || c.faction?.split('·').includes(f.factionGroup)) && (!f.subtitle || c.subtitle === f.subtitle) &&
        (f.exactCost === undefined || Number(c.printedCost) === f.exactCost) && (f.minCost === undefined || Number(c.printedCost) >= f.minCost) &&
        (f.maxCost === undefined || Number(c.printedCost) <= f.maxCost) && matchesCardNameFilter(c, f);
}
export function selectedEffectPlans(plan, mode) {
    if (!plan || typeof plan !== 'object')
        return [];
    const out = [plan];
    for (const child of [...plan.steps ?? [], ...plan.ops ?? []])
        out.push(...selectedEffectPlans(child, mode));
    const selected = plan.selectedModes ?? (plan.selectedMode ? [plan.selectedMode] : mode ? [mode] : []);
    for (const id of selected)
        out.push(...selectedEffectPlans(plan.modeTargets?.[id], mode));
    return out;
}
export const removalEffects = new Set(['destroy', 'destroy-if-sealed', 'destroy-low-total-icons', 'damage', 'wound', 'shuffle-owner', 'bottom-owner', 'bounce', 'return-hand', 'conceal', 'seal', 'seal-to-society', 'seal-to-owner-society', 'sacrifice-character']);
export const counterEffects = new Set(['terminate', 'counter', 'counter-card', 'counter-ability']);
