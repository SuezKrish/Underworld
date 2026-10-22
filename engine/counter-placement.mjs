import { starsCounterRemoved } from './star-transfer.mjs';
import { recordFieldEvent, recordPlayerEvent } from './field-events.mjs';
function placed(s, loc, field, key, amount, origin) {
    if (field === 'counter' && key === 'locked')
        ;
    if (!Number.isFinite(amount) || amount <= 0 || loc?.zone !== 'play' || loc.faceDown)
        return;
    const id = Object.keys(s.locations).find(id => s.locations[id] === loc);
    if (!id)
        return;
    recordFieldEvent(s, id, 'counter-added', { markerField: field, markerKey: key, count: amount, markerOrigin: origin });
}
// Actual mutation sites report positive additions before rule deaths or later
// operations. A removed counter or a restored undo snapshot is not a placement.
export function setCardMarker(s, loc, field, key, value, { origin } = {}) {
    const old = field === 'counter' ? loc.counters?.[key] : loc[field];
    if (field === 'counter' && key === 'influence')
        starsCounterRemoved(s, loc, (old ?? 0) - value);
    if (field === 'counter') {
        loc.counters ??= {};
        loc.counters[key] = value;
    }
    else
        loc[field] = value;
    if (field === 'markers' && typeof value === 'object') {
        const player = s.players.indexOf(loc);
        if (player >= 0 && (old?.exposed ?? 0) > (value?.exposed ?? 0))
            recordPlayerEvent(s, player, 'exposure-decreased', { before: old.exposed, after: value.exposed, amount: old.exposed - value.exposed });
    }
    if (field === 'markers' && value !== (old ?? 0) && loc?.zone === 'play' && !loc.faceDown) {
        const id = Object.keys(s.locations).find(id => s.locations[id] === loc);
        if (id)
            recordFieldEvent(s, id, 'time-change', { before: old ?? 0, after: value });
    }
    placed(s, loc, field, key, value - (Number.isFinite(old) ? old : 0), origin);
    return value;
}
export function setCardCounters(s, loc, value, { origin } = {}) {
    const old = loc.counters ?? {};
    starsCounterRemoved(s, loc, (old.influence ?? 0) - (value?.influence ?? 0));
    loc.counters = value;
    for (const [key, n] of Object.entries(value ?? {}))
        placed(s, loc, 'counter', key, n - (Number.isFinite(old[key]) ? old[key] : 0), origin);
    return value;
}
