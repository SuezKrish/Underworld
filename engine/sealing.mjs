import { printedRulesCard } from './printed-rules.mjs';
import { printedSealedFace } from './sealed-face.mjs';
import { silenceSealFace } from './seal-replacement.mjs';
import { shuffleCards } from './environment-definitions.mjs';
import { districtHostVersion } from './task-districts.mjs';
import { uuid } from './random.mjs';
import { identity, controllerOf } from './ownership.mjs';
export const isFieldZone = z => ['play', 'asset'].includes(z);
export function sealedOn(s, hostId) { return Object.keys(s.locations).filter(id => s.locations[id].zone === 'sealed' && s.locations[id].hostId === hostId); }
// A target reference belongs to this incarnation. Leaving and re-entering must
// not allow an old effect to seal onto the replacement incarnation.
export function sealHost(s, id) {
    if (id?.startsWith('society:')) {
        const p = Number(id.slice(8));
        return [0, 1].includes(p) && s.players[p] ? { hostId: id, kind: 'society', owner: p, version: s.societyVersions?.[p] ?? 0, name: `${s.seats[p].name}的${s.societies?.[p]?.name ?? s.deckSelections?.[p]?.society.name ?? '秘社'}` } : null;
    }
    if (id?.startsWith('district-host:')) {
        const d = s.districts?.find(d => d?.id === id.slice(14));
        return d ? { hostId: id, kind: 'district', version: districtHostVersion(d), name: d.name } : null;
    }
    const l = s.locations[id], c = s.cards[id];
    if (!c || !l || !isFieldZone(l.zone) || l.faceDown)
        return null;
    return { hostId: id, kind: 'card', version: l.fieldVersion ?? l.zoneVersion, name: c.name, owner: c.owner, controller: controllerOf(s, id) };
}
export function liveSealHost(s, ref) { const now = ref && sealHost(s, ref.hostId); return !!now && now.version === ref.version && now.kind === ref.kind; }
export function sealedView(s, viewer) {
    return Object.keys(s.locations).filter(id => s.locations[id].zone === 'sealed').map(id => {
        const l = s.locations[id], host = sealHost(s, l.hostId);
        if (l.faceDown && s.cards[id].owner !== viewer)
            return { id: `sealed:${l.hiddenHandle ?? id}`, name: '背面封印牌', faceDown: true, owner: s.cards[id].owner, ownerName: s.seats[s.cards[id].owner].name, hostId: l.hostId, hostName: host?.name ?? '原宿主' };
        const visible = l.faceDown && s.cards[id].sealedFace ? identity({ ...s, cards: { ...s.cards, [id]: printedSealedFace(s.cards[id]) } }, id) : identity(s, id);
        return { ...visible, zone: 'sealed', faceDown: !!l.faceDown, hostId: l.hostId, hostName: l.keeperHostName ?? host?.name ?? '原宿主', hostType: host?.kind, hostVersion: l.hostVersion, inPlay: false };
    });
}
export function createSealingEngine({ move, log, event }) {
    function release(s, hostId) {
        const ids = sealedOn(s, hostId).filter(id => !s.locations[id].keeperHoldId), l = s.locations[hostId], well = l?.zone === 'play' && !l.faceDown && printedRulesCard(s, hostId)?.automation?.releaseEnemySealsToDeck, controller = well ? controllerOf(s, hostId) : null, shuffled = new Set();
        for (const id of ids) {
            const hidden = s.locations[id].faceDown, p = s.cards[id].owner;
            if (well && p !== controller) {
                if (move(s, id, 'deck'))
                    shuffled.add(p);
                log(s, `枯井持续能力：${hidden ? '一张背面封印牌' : s.cards[id].name}洗入其拥有者牌库，而非返回手中。`);
            }
            else {
                move(s, id, 'hand');
                log(s, `规则动作：${hidden ? '一张背面封印牌' : s.cards[id].name}解除封印，返回${s.seats[p].name}手中。`);
            }
        }
        for (const p of shuffled)
            shuffleCards(s.players[p].deck);
        return ids.length;
    }
    function seal(s, id, ref, sourceRef = null, { faceDown = false, cause = 'effect' } = {}) {
        const l = s.locations[id];
        if (!l || !liveSealHost(s, ref) || id === ref.hostId || sourceRef && (l.zone !== sourceRef.zone || l.zoneVersion !== sourceRef.zoneVersion))
            return false;
        // Removing an attachment host would also remove its descendant attachment;
        // that descendant cannot simultaneously be the surviving seal host.
        let ancestor = ref.hostId;
        const seen = new Set();
        while (s.locations[ancestor]?.attachedTo && !seen.has(ancestor)) {
            seen.add(ancestor);
            ancestor = s.locations[ancestor].attachedTo;
            if (ancestor === id)
                return false;
        }
        faceDown = silenceSealFace(s, id, faceDown, { log });
        const from = { ...l };
        if (!move(s, id, 'sealed', { cause, hostId: ref.hostId, hostVersion: ref.version, faceDown, ...(faceDown ? { hiddenHandle: uuid() } : {}) }) || s.locations[id].zone !== 'sealed')
            return false;
        log(s, `${faceDown ? '一张牌背面朝上' : s.cards[id].name + '正面朝上'}封印在${ref.name}上（拥有者：${s.seats[s.cards[id].owner].name}）。`);
        event?.(s, id, 'sealed', s.locations[id], s.eventGroup ?? uuid(), { from, host: ref });
        return true;
    }
    function cleanup(s) {
        for (const hostId of new Set(Object.values(s.locations).filter(l => l.zone === 'sealed').map(l => l.hostId)))
            if (!sealHost(s, hostId))
                release(s, hostId);
    }
    return { seal, release, cleanup };
}
