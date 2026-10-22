import { effectiveMagicDomains } from "./magic-domains.mjs";
import { hasCardType } from "./card-types.mjs";
import { printedRulesCard } from "./printed-rules.mjs";
import { abilitiesSuppressed } from "./field-rules.mjs";
import { hasKeyword } from "./unique.mjs";
import { nonBattleBlocked } from "./green-black-rules.mjs";
export function assetDomains(s, p) { return [...new Set(s.players[p].assets.flatMap(a => effectiveMagicDomains(s, a.id)))]; }
export function reputationParticipants(s, district) { return s.players.map(pl => pl.play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(printedRulesCard(s, id), 'character') && s.locations[id].district === district && !s.locations[id].tapped && hasKeyword(s, id, '声望') && !abilitiesSuppressed(s, id) && !nonBattleBlocked(s, id, 'influence'))); }
export function reputationTriggerCount(s, p, district, { districtBonus = true } = {}) { return 1 + (districtBonus && s.districts[district]?.plan?.extraReputation ? 1 : 0) + (s.effects ?? []).filter(e => e.kind === 'extra-reputation' && e.controller === p && e.round === s.round).length; }
export const currentAsset = (s, id) => s.players.flatMap(p => p.assets).find(a => a.id === id);
export const currentAssetTapped = (s, id) => !!currentAsset(s, id)?.tapped;
