import { sealHost, liveSealHost } from './sealing.mjs';
// The permit follows one sealed object and one host incarnation. Merely owning
// the card, or having another permanent cast permission, does not extend it.
export function sealedCastRef(s, id) { const l = s.locations[id], host = l && sealHost(s, l.hostId); return l?.zone === 'sealed' && !l.faceDown && host && host.version === l.hostVersion && liveSealHost(s, host) ? { cardId: id, zoneVersion: l.zoneVersion, hostId: l.hostId, hostVersion: l.hostVersion } : null; }
export function liveSealedCastRef(s, p, ref) { const now = ref && sealedCastRef(s, ref.cardId); return !!now && s.cards[ref.cardId]?.owner === p && ['zoneVersion', 'hostId', 'hostVersion'].every(k => now[k] === ref[k]); }
export function sealedResolutionPermit(s, p, id) {
    const active = s.resolutionCasting;
    if (active?.player === p && active.cardId === id && active.castSourceZone === 'sealed' && liveSealedCastRef(s, p, active.sealedRef))
        return active;
    const x = null;
    return x?.controller === p && x.cardIds[0] === id && liveSealedCastRef(s, p, x.sealedRef) ? x : null;
}
