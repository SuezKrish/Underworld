import { matchesSpecifiedName } from './card-names.mjs';
import { sealedOn } from './sealing.mjs';
import { graveCards } from './graveyard-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { effectiveSubtypes, graveyardLocked } from './derived.mjs';
import { districtTraits } from './district-rules.mjs';
export function societyShuffleCosts(s, p, name) { return sealedOn(s, `society:${p}`).filter(id => !s.locations[id].faceDown && (!name || matchesSpecifiedName(s.cards[id], name))); }
export function graveBottomCosts(s, p, plan) { return graveCards(s, p, plan.sourceId ?? p).filter(id => hasCardType(s.cards[id], plan.graveBottomCost.type) && !graveyardLocked(s, plan.sourceId ?? p, s.cards[id].owner, s.locations[id].zone)); }
// Funeral grants only 不死生物. Excluding that domain-dependent grant here
// prevents the dream-subtype / granted-holy-domain query from recursing.
export function dreamContext(s, id) { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && (sealedOn(s, id).length > 0 || districtTraits(s, l.district).some(t => ['黄昏', '梦境'].includes(t)) || s.players.flatMap(p => p.play).some(x => s.locations[x]?.zone === 'play' && !s.locations[x].faceDown && s.locations[x].district === l.district && effectiveSubtypes(s, x, { skipDomainDependent: true }).includes('梦境'))); }
