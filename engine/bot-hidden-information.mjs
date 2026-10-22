import { hasCardType } from './card-types.mjs';
export function announcedHiddenBonus(v, c, p = v.seat) {
    const b = v.hidden?.cardBonus;
    if (b?.controller !== p)
        return 0;
    const domains = c.effectiveMagicDomains ?? c.magicDomains ?? [], colors = c.factionColors ?? [c.faction?.split('·')[0]], types = c.subtypes ?? [];
    if (b.type && !hasCardType(c, b.type) || b.magic && !domains.includes(b.magic) || b.faction && !colors.includes(b.faction) || b.colors && !b.colors.some(x => colors.includes(x)) || b.subtypes && !b.subtypes.some(x => types.includes(x)))
        return 0;
    return b.amount ?? 0;
}
