import { currentCatalog } from './catalog-store';
import { currentPoolSettings } from './pool-settings-store';
import { parseCatalog } from '../engine/catalog.mjs';
import { playCardContext } from '../engine/play-card-profile.mjs';
export async function playCatalog() { const [doc, policy] = await Promise.all([currentCatalog(), currentPoolSettings()]); return { doc, policy, ...playCardContext(parseCatalog(doc.xml).cards, policy.settings) }; }
