import { hasCardType } from './card-types.mjs';
import { printedSealedFace } from './sealed-face.mjs';
import { sealHost, liveSealHost } from './sealing.mjs';
import { enterTapped } from './derived.mjs';
import { districtNumber } from './task-districts.mjs';
import { uuid } from './random.mjs';
import { RuleError } from './core.mjs';
export const placementOperations = ['to-asset', 'seal', 'put-face-up', 'put-face-down'];
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const face = (s, id) => printedSealedFace(s.cards[id]);
export function placementEligible(s, id, op) { const l = s.locations[id], c = face(s, id); return op === 'to-asset' ? l.zone !== 'asset' : op === 'seal' ? true : l.zone !== 'play' && (op === 'put-face-down' ? hasCardType(c, 'character') : hasCardType(c, 'character') || hasCardType(c, 'attachment')); }
export function placementOptions(s, p, id, op, targetOptions) {
    if (op === 'to-asset')
        return [];
    if (op === 'seal')
        return [...s.players.map((_, p) => sealHost(s, `society:${p}`)), ...s.districts.filter(Boolean).map(d => sealHost(s, `district-host:${d.id}`)), ...Object.keys(s.locations).filter(x => x !== id && ['play', 'asset'].includes(s.locations[x].zone)).map(x => sealHost(s, x))].filter(Boolean).map(ref => ({ id: ref.hostId, name: ref.name, ref }));
    const c = face(s, id);
    if (op === 'put-face-down' || hasCardType(c, 'character'))
        return s.districts.flatMap((d, i) => d ? [{ id: `district:${i}`, name: `地区${districtNumber(s, i)} · ${d.name}`, district: i, districtId: d.id }] : []);
    if (!c.attachment || !targetOptions)
        return [];
    // A private sealed face supplies only the manual placement form, never a
    // normal casting permission or a public view of that face.
    const old = s.cards[id];
    s.cards[id] = c;
    try {
        return targetOptions(s, p, { ...c.attachment, cardId: id, nonTargeted: true }).map(o => o.id.startsWith('district:') ? { ...o, district: Number(o.id.slice(9)), districtId: s.districts[Number(o.id.slice(9))].id } : { ...o, ref: sealHost(s, o.id) }).filter(o => o.district !== undefined || o.ref);
    }
    finally {
        s.cards[id] = old;
    }
}
export function validatePlacement(s, p, r, targetOptions) {
    for (const id of r.cardIds) {
        need(placementEligible(s, id, r.operation), '这张牌不符合当前放置方式');
        if (r.operation === 'to-asset')
            continue;
        const dest = r.destinations[id], o = placementOptions(s, p, id, r.operation, targetOptions).find(o => o.id === dest?.id);
        need(o && (dest.ref ? liveSealHost(s, dest.ref) && o.ref?.version === dest.ref.version : s.districts[dest.district]?.id === dest.districtId), '所选放置位置或封印宿主已失效');
    }
}
export function executePlacement(s, r, { move, seal, event, targetOptions }) {
    const p = r.requester;
    validatePlacement(s, p, r, targetOptions);
    for (const id of r.cardIds) {
        const d = r.destinations?.[id];
        if (r.operation === 'to-asset') {
            move(s, id, 'asset', { controller: p, tapped: false });
            continue;
        }
        if (r.operation === 'seal') {
            need(seal(s, id, d.ref, { zone: s.locations[id].zone, zoneVersion: s.locations[id].zoneVersion }), '无法将所选牌封印在该对象上');
            continue;
        }
        const hidden = r.operation === 'put-face-down', c = face(s, id), attachment = !hidden && !hasCardType(c, 'character');
        const original = s.cards[id];
        s.cards[id] = c;
        let tapped;
        try {
            tapped = hidden ? false : enterTapped(s, id, d.district);
        }
        finally {
            s.cards[id] = original;
        }
        const extra = { controller: p, tapped, ...(hidden ? { faceDown: true, hiddenHandle: uuid() } : {}), ...(attachment ? { attachedTo: d.ref?.hostId ?? `district-host:${d.districtId}`, hostVersion: d.ref?.version ?? d.districtId, ...(d.district !== undefined ? { district: d.district } : s.locations[d.ref?.hostId]?.district !== undefined ? { district: s.locations[d.ref.hostId].district } : {}) } : { district: d.district }) };
        if (move(s, id, 'play', extra) && !hidden) {
            event?.(s, id, 'entry', s.locations[id], r.id, { method: 'effect-placement' });
            if (attachment)
                event?.(s, id, 'attached', s.locations[id], r.id, { host: sealHost(s, s.locations[id].attachedTo) });
        }
    }
}
