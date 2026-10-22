import { placeRegionInfluence } from './club-influence.mjs';
import { controllerOf } from './ownership.mjs';
import { effectiveSubtypes } from './derived.mjs';
import { sealHost } from './sealing.mjs';
export function continuingCardEffect(s, a, plan, { seal, shuffle, log }) {
    const p = a.controller;
    if (plan.operation === 'vision') {
        // Snapshot the affected library: cards shuffled back by immediate abilities
        // during this operation are not a second set of cards to seal.
        const cards = s.players[p].deck.map(id => ({ id, version: s.locations[id].zoneVersion })), host = sealHost(s, `society:${p}`);
        for (const c of cards)
            seal(s, c.id, host, { zone: 'deck', zoneVersion: c.version });
        s.players[p].cannotDraw = true;
        log(s, `${s.seats[p].name}的愿景结算：本局游戏中不能抓牌。`);
    }
    if (plan.operation === 'dahlia-influence') {
        const d = s.districts[plan.sourceDistrict];
        if (d?.id !== plan.sourceDistrictCardId)
            return;
        const n = s.players[p].play.filter(id => id !== plan.sourceId && s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && s.locations[id].district === plan.sourceDistrict && controllerOf(s, id) === p && effectiveSubtypes(s, id).includes('罪犯')).length;
        placeRegionInfluence(s, plan.sourceDistrict, p, n);
        log(s, `多情达莉娅：在地区${plan.sourceDistrict + 1}放置${n}个本方势力标志。`);
    }
    ;
}
