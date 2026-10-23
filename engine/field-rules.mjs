import { projectionRead } from './projection-read-cache.mjs';
import { statusSources } from './veiled-status-rules.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { printedRulesCard, allAbilitiesLost } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
export function transactionsBlocked(s) {
    return s.players.flatMap(p => p.play).some(id => { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && !l.tapped && printedRulesCard(s, id).automation?.static === 'untapped-no-transactions'; });
}
export function abilitiesSuppressed(s, id, loc = s.locations[id]) {
    if (loc === s.locations[id] && s.cards[id])
        return projectionRead(s, 'suppressed:' + id, () => computeAbilitiesSuppressed(s, id, loc));
    return computeAbilitiesSuppressed(s, id, loc);
}
function computeAbilitiesSuppressed(s, id, loc) {
    if (allAbilitiesLost(s, id, loc))
        return true;
    if (loc?.zone !== 'play' || loc.faceDown || !hasCardType(s.cards[id], 'character'))
        return false;
    return s.players.flatMap(p => p.play).some(source => {
        const l = s.locations[source];
        return l?.zone === 'play' && !l.faceDown && !l.tapped && l.district === loc.district && printedRulesCard(s, source).automation?.static === 'district-role-silence';
    });
}
export function secretDeploymentBlocked(s, p) {
    if (effectiveSocietyMarkers(s, p).exposed >= 2 && statusSources(s, 'behind-veil').length)
        return true;
    return s.players[1 - p].play.some(source => {
        const l = s.locations[source];
        return l?.zone === 'play' && !l.faceDown && !l.tapped && printedRulesCard(s, source).automation?.static === 'enemy-secret-deploy-block';
    });
}
export function cageRestricts(s, id) {
    const host = s.locations[id];
    if (host?.zone !== 'play' || host.faceDown || !hasCardType(s.cards[id], 'character'))
        return false;
    return s.players.flatMap(p => p.play).some(aid => { const l = s.locations[aid]; return l?.zone === 'play' && !l.faceDown && l.attachedTo === id && l.hostVersion === host.zoneVersion && printedRulesCard(s, aid).attachment?.static === 'cage-host'; });
}
