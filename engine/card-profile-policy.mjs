import ids from '../data/card-ids.json' with { type: 'json' };
const allowed = new Set(ids);
export const offlineCardAllowed = card => allowed.has(card.id);
export const usesOfflineCards = () => true;
