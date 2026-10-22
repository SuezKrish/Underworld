import { enabledCards } from './card-pool.mjs';
import { compileSupported } from './automation.mjs';
import { compileEnvironment } from './environment-definitions.mjs';
import { catalogSubset } from './catalog.mjs';
import { cardRevisionHistory } from './card-revision-history.mjs';
export const profileCardVariant = card => card;
export const profileCompiledCards = cards => compileSupported(cards);
export function playCardContext(allCards, settings = {}) { const cards = enabledCards(allCards, settings); return { sourceCards: cards, cards, allCards, compiled: compileSupported(cards), environment: compileEnvironment(cards) }; }
export function playerCatalog(catalog, settings) { return catalogSubset(catalog, new Set(enabledCards(catalog.cards, settings).map(c => c.id))); }
export const profileRevisionHistory = cards => cardRevisionHistory(cards);
