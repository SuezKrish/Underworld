import { blockedDrawInvestment } from './bot-draw-lock-planning.mjs';
import { endHandForecast, libraryReserve } from './bot-resource-planning.mjs';
const live = c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed;
function refill(plan) {
    if (!plan || typeof plan !== 'object')
        return 0;
    if (Array.isArray(plan))
        return plan.reduce((n, p) => n + refill(p), 0);
    const own = plan.player === undefined || plan.player === 'self';
    const n = own && ['draw', 'bottom-to-hand', 'top-select-hand', 'search-filtered', 'grave-to-hand'].includes(plan.effect) ? Math.min(3, plan.count ?? 1) : 0;
    return n + (plan.steps ?? []).reduce((n, p) => n + refill(p), 0);
}
export function refillEngineStrength(c) {
    if (!live(c))
        return 0;
    const a = c.automation ?? {};
    return Math.min(3, refill(a.watch) + refill(a.action) + refill(a.actions) + refill(a.prepare ?? a.prepareTrigger) + refill(a.end ?? a.endTrigger));
}
const forecasts = new WeakMap();
// Discount only the refill investment. Body, combat, control and denial value
// remain in their own scores. This is shared by every preset and difficulty.
export function refillInvestmentPenalty(v, c, h = {}) {
    const blocked = blockedDrawInvestment(v, c), strength = refillEngineStrength(c);
    if (!strength)
        return blocked;
    let f = forecasts.get(v);
    if (!f) {
        f = endHandForecast(v, h);
        forecasts.set(v, f);
    }
    const m = v.players[v.seat], existing = m.play.filter(x => x.id !== c.id).reduce((n, x) => n + refillEngineStrength(x), 0);
    const spare = Math.max(0, f.projected + Math.min(2, existing) - Math.max(3, f.limit - 2));
    const stocked = Math.min(1, spare / 3), repeat = Math.min(2, existing);
    const risk = (m.deckCount ?? 50) <= libraryReserve(v, h) ? 8 : 0;
    return blocked + Math.min(24, stocked * (5 + repeat * 5) * Math.min(1.5, strength) + risk);
}
