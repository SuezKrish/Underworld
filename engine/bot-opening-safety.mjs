import { hasCardType } from './card-types.mjs';
const earlyBattleColors = new Set(['黑', '红', '绿', '蓝']);
const keyword = (c, k) => c.keywordStates?.find(x => x.keyword === k)?.present ?? c.keywords?.includes(k) ?? false;
// On the first initiative turn, a slow Matuta cannot defend herself. A normal
// Bot estimates the opponent's one-mana black blades from the public society;
// only a hard-information view may inspect the actual opposing hand.
export function openingBlackBladeRisk(v) {
    const q = 1 - v.seat;
    if (v.round !== 1 || v.turn?.phase !== 'action' || v.turn.firstPlayer !== v.seat)
        return false;
    if (v.bot?.difficulty === 'hard' && v.hardInfo) {
        return (v.players[q].hand ?? []).some(c => hasCardType(c, 'character') && Number(c.printedCost) <= 1 && (c.icons?.battle ?? 0) > 0 && c.castAllowed !== false && !c.concealedOnlyNow && !keyword(c, '迟缓'));
    }
    const society = v.societies?.[q] ?? v.deckSelections?.[q]?.society;
    const colors = society?.factionColors ?? (typeof society?.faction === 'string' ? [...society.faction.split('·')[0]] : null);
    // Legacy fixtures/records without society data have no evidence of safety.
    return !colors || colors.some(color => earlyBattleColors.has(color));
}
