import { dreamContext } from './continuing-cost-rules.mjs';
import { printedRulesBlank } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { sealedOn } from './sealing.mjs';
// Keep printed domains intact: suppression changes battlefield characteristics,
// never the card's catalog definition or its domains in another zone.
export function effectiveMagicDomains(s, id) {
    const card = s.cards[id], loc = s.locations[id];
    if (!card)
        return [];
    if (loc?.zone === 'play' && !loc.faceDown && hasCardType(card, 'character') && Object.entries(s.locations).some(([source, l]) => l.zone === 'play' && !l.faceDown && l.attachedTo === id && l.hostVersion === loc.zoneVersion && s.cards[source].automation?.static === 'blank-host-text' && !printedRulesBlank(s, source)))
        return [];
    if (loc?.zone === 'play' && !loc.faceDown && hasCardType(card, 'character') && sealedOn(s, id).length && s.players.flatMap(p => p.play).some(source => {
        const l = s.locations[source];
        return l?.zone === 'play' && !l.faceDown && !l.tapped && controllerOf(s, source) !== controllerOf(s, id) && s.cards[source].automation?.static === 'sealed-enemy-no-domains';
    }))
        return [];
    const domains = card.magicDomains ?? [];
    if (loc?.zone === 'play' && !loc.faceDown && card.automation?.dreamContextHoly && dreamContext(s, id) && !printedRulesBlank(s, id))
        return [...new Set([...domains, '神圣'])];
    if (!domains.length && Object.entries(s.locations).some(([source, l]) => false))
        return ['神圣'];
    if (loc?.zone === 'play' && !loc.faceDown && hasCardType(card, 'character') && !domains.length && s.players[controllerOf(s, id)].play.some(source => s.locations[source]?.zone === 'play' && !s.locations[source].faceDown && s.cards[source].automation?.static === 'domainless-mind-battle'))
        return ['心灵'];
    return domains;
}
