import { sealHost, liveSealHost } from './sealing.mjs';
// Attachment permissions are validated by targetOptions/live, not sealing rules.
// A hidden character is a legal host for some attachments, but never a seal host.
export function attachmentHostReference(s, target) {
    if (!target)
        return null;
    if (target.kind === 'host')
        return target.ref;
    if (target.kind === 'district')
        return sealHost(s, `district-host:${target.cardId}`);
    const l = s.locations[target.cardId], c = s.cards[target.cardId];
    if (target.faceDown && l?.zone === 'play' && l.faceDown && l.zoneVersion === target.zoneVersion && c)
        return { hostId: target.cardId, kind: 'card', version: l.fieldVersion ?? l.zoneVersion, hiddenHost: true, name: '暗藏者', owner: c.owner, controller: l.controller };
    return sealHost(s, target.cardId);
}
export function liveAttachmentHost(s, ref) {
    if (!ref?.hiddenHost)
        return liveSealHost(s, ref);
    const l = s.locations[ref.hostId];
    return !!l && l.zone === 'play' && !!l.faceDown && (l.fieldVersion ?? l.zoneVersion) === ref.version;
}
