import { viewFor } from './match.mjs';
import { withProjectionReads } from './projection-read-cache.mjs';
export function cachedViewFor(...args) { return withProjectionReads(() => viewFor(...args)); }
