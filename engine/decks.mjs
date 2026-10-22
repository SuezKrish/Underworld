import { environmentStatus } from './environment-definitions.mjs';
import societySources from '../data/society-construction.json' with { type: 'json' };
import { validateDeck as validate } from './deck-rules.mjs';
export * from './deck-rules.mjs';
export function validateDeck(input, catalog, implementedIds = new Set()) { return validate(input, catalog, implementedIds, { societySources, environmentStatus }); }
