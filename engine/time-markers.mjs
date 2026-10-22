import { hasAnyCardType } from './card-types.mjs';
// Ordinary effects use the aggregate. Blood Sacrifice explicitly permits a
// district's own time counters, which contribute to the same total.
export function districtTimeMarkers(s, district) { return Object.entries(s.locations).reduce((total, [id, loc]) => total + (loc.zone === 'play' && !loc.faceDown && loc.district === district && hasAnyCardType(s.cards[id], ['character', 'attachment']) ? (loc.markers ?? 0) : 0), s.districts[district]?.counters?.time ?? 0); }
