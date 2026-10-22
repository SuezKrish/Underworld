import { sealedOn, sealHost, liveSealHost } from './sealing.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { controllerOf } from './ownership.mjs';
export function doubledAnchorSources(s, p) {
    return s.players[p].play.filter(id => {
        const l = s.locations[id];
        return l?.zone === 'play' && !l.faceDown && controllerOf(s, id) === p && printedRulesCard(s, id)?.automation?.static === 'double-society-anchors' && !abilitiesSuppressed(s, id);
    });
}
// Physical cards stay distinct. Only numerical counts and selected-card costs
// use the doubled weight; moving a card still moves that one physical card.
export function sealedCardWeight(s, hostId, id) {
    const l = s.locations[id], p = hostId?.startsWith('society:') ? Number(hostId.slice(8)) : null, host = sealHost(s, hostId);
    return [0, 1].includes(p) && l?.zone === 'sealed' && l.hostId === hostId && host?.version === l.hostVersion && liveSealHost(s, host) && matchesSpecifiedName(s.cards[id], '精神锚点') && doubledAnchorSources(s, p).length ? 2 : 1;
}
export function sealedCount(s, hostId, ids = sealedOn(s, hostId)) { return ids.reduce((n, id) => n + sealedCardWeight(s, hostId, id), 0); }
export function sealedCostPaid(s, hostId, ids, n) { return ids.length <= n && sealedCount(s, hostId, ids) >= n; }
