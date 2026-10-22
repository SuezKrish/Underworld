import { uuid } from './random.mjs';
const profile = c => JSON.stringify([c.catalogId, c.icons, c.temporaryIcons, c.automation?.static, c.copyOrigin]);
const active = (s, id, e) => e.kind === 'remove-existing-stars' && e.targetId === id && e.targetZoneVersion === s.locations[id]?.zoneVersion;
const starEffect = (id, e) => e.kind === 'modify-icons' && e.icon === 'influence' && e.targetId === id;
export function starSnapshot(s) {
    const field = Object.fromEntries(Object.entries(s.locations).filter(([, l]) => ['play', 'asset', 'sealed'].includes(l.zone)).map(([id, l]) => [id, { version: l.zoneVersion, profile: profile(s.cards[id]), influence: l.counters?.influence ?? 0 }]));
    return { field, scoreIds: s.players.map(p => p.scoreCards.map(c => c.id)) };
}
// Removing an old counter consumes that captured contribution. A later counter
// is a new grant, even when the total has returned to its previous number.
export function starsCounterRemoved(s, loc, amount) {
    if (!(amount > 0))
        return;
    const id = Object.keys(s.locations).find(id => s.locations[id] === loc);
    if (!id)
        return;
    for (const e of s.effects ?? []) {
        const ref = e.kind === 'remove-existing-stars' ? e.starSnapshot?.field[id] : null;
        if (ref?.version === loc.zoneVersion)
            ref.influence = Math.max(0, ref.influence - amount);
    }
}
function baseState(s, id, snapshot) {
    const effects = (s.effects ?? []).filter(e => e.kind !== 'remove-existing-stars' && !starEffect(id, e));
    const projected = { ...s, effects, starTransferProjection: true };
    if (!snapshot)
        return projected;
    const locations = { ...s.locations }, cards = { ...s.cards };
    for (const [key, l] of Object.entries(locations))
        if (['play', 'asset', 'sealed'].includes(l.zone)) {
            const ref = snapshot.field[key], same = ref?.version === l.zoneVersion;
            if (!same && key !== id) {
                locations[key] = { ...l, zone: 'removed' };
                continue;
            }
            locations[key] = { ...l, counters: { ...l.counters, influence: Math.min(l.counters?.influence ?? 0, same ? ref.influence : 0) } };
            if (key === id && (!same || ref.profile !== profile(cards[key])))
                cards[key] = { ...cards[key], icons: { ...cards[key].icons, influence: 0 }, temporaryIcons: { ...cards[key].temporaryIcons, influence: 0 }, automation: undefined };
            else if (!same || ref.profile !== profile(cards[key]))
                locations[key] = { ...locations[key], zone: 'removed' };
        }
    return { ...projected, cards, locations, players: s.players.map((p, i) => ({ ...p, play: p.play.filter(k => k === id || locations[k]?.zone === 'play'), assets: p.assets.filter(a => locations[a.id]?.zone === 'asset'), scoreCards: p.scoreCards.filter(c => snapshot.scoreIds[i].includes(c.id)) })) };
}
const colors = (s, id, raw) => { const black = raw(s, id, false, true).influence, all = raw(s, id, true).influence; return { black, white: Math.max(0, all - black) }; };
export function transferredStars(s, id, raw) {
    const losses = (s.effects ?? []).filter(e => active(s, id, e));
    if (!losses.length)
        return null;
    // A later conversion to battle uses the stars that survived the removal.
    const state = { ...s, effects: (s.effects ?? []).filter(e => !(e.kind === 'stars-to-battle' && e.targetId === id && e.targetZoneVersion === s.locations[id].zoneVersion)) };
    const basis = snapshot => colors(baseState(state, id, snapshot), id, raw);
    let previous = basis(losses[0].starSnapshot), n = { ...previous };
    const add = delta => {
        for (const k of ['black', 'white'])
            n[k] = Math.max(0, n[k] + delta[k]);
    };
    for (const e of state.effects ?? []) {
        if (active(s, id, e)) {
            const next = basis(e.starSnapshot);
            add({ black: next.black - previous.black, white: next.white - previous.white });
            previous = next;
            for (const k of ['black', 'white'])
                n[k] = Math.max(0, n[k] - e[k]);
        }
        else if (starEffect(id, e) && (e.targetZoneVersion === undefined || e.targetZoneVersion === s.locations[id].zoneVersion)) {
            // Evaluate the actual colored contribution, including white-to-black and
            // doubling effects, using the same icon calculator as contests and the UI.
            const zero = baseState(state, id), withGrant = { ...zero, effects: [...zero.effects, { ...e, amount: Math.abs(e.amount) }] }, before = colors(zero, id, raw), after = colors(withGrant, id, raw), sign = e.amount < 0 ? -1 : 1;
            add({ black: (after.black - before.black) * sign, white: (after.white - before.white) * sign });
        }
    }
    const full = basis();
    add({ black: full.black - previous.black, white: full.white - previous.white });
    const current = colors({ ...state, starTransferProjection: true }, id, raw);
    return { ...n, removed: Math.max(0, current.black + current.white - n.black - n.white) };
}
export function removeExistingStars(s, id, black, white) {
    if (!(black > 0 || white > 0))
        return;
    s.effects.push({ id: uuid(), kind: 'remove-existing-stars', targetId: id, targetZoneVersion: s.locations[id].zoneVersion, black, white, starSnapshot: starSnapshot(s), duration: 'until-end-of-round' });
}
