import { allAbilitiesLost } from './printed-rules.mjs';
import { inGrave } from './graveyard-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { enterTapped, graveyardLocked } from './derived.mjs';
import { PHILOSOPHER_STONE } from './philosopher-stone-definitions.mjs';
export { PHILOSOPHER_STONE } from './philosopher-stone-definitions.mjs';
// The counter supplies the ability. There is no reference to its placer.
export function philosopherStoneCount(s, id, loc) {
    const count = loc.counters?.[PHILOSOPHER_STONE] ?? 0;
    return !allAbilitiesLost(s, id, loc) && loc.zone === 'play' && !loc.faceDown && hasCardType(s.cards[id], 'character') && Number.isSafeInteger(count) && count > 0 ? count : 0;
}
export function revivePhilosopherStone(s, a, { move, event, log }) {
    const id = a.cardId, plan = a.plan, loc = s.locations[id], district = plan.sourceDistrict;
    // Returning to this graveyard a second time is a different object.
    if (!inGrave(s, id, id) || loc.zoneVersion !== plan.sourceZoneVersion + 1) {
        log(s, '哲人石标志：死亡角色已不在原墓地对象中，复活无效。');
        return;
    }
    if (!s.districts[district] || s.districts[district].id !== plan.sourceDistrictCardId) {
        log(s, '哲人石标志：原地区已离场，复活无效。');
        return;
    }
    if (graveyardLocked(s)) {
        log(s, '镇魂曲禁止哲人石标志将角色从墓地放置进场。');
        return;
    }
    const owner = s.cards[id].owner;
    if (move(s, id, 'play', { controller: owner, district, tapped: enterTapped(s, id, district) })) {
        event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
        log(s, `哲人石标志：${s.cards[id].name}在原地区${district + 1}复活，由其拥有者${s.seats[owner].name}操控。`);
    }
}
