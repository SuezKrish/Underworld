import { projectedClaimOutcome } from './bot-claim-outcome.mjs';
import { hasCardType } from './card-types.mjs';
import { knownOpponentOptions, opponentColors } from './bot-matchup-planning.mjs';
import { responseFilter, counterEffects, removalEffects } from './response-effect-semantics.mjs';
const icons = (c, k, first) => (c.effectiveIcons?.[k] ?? ((c.icons?.[k] ?? 0) + (first ? (c.temporaryIcons?.[k] ?? 0) : 0)));
const total = (v, p, d, k) => v.players[p].play.filter(c => c.district === d && !c.tapped && !c.faceDown).reduce((n, c) => n + icons(c, k, v.turn.firstPlayer === p), 0);
const score = c => (c.printedCost ?? 0) + Object.values(c.effectiveIcons ?? c.icons ?? {}).reduce((n, x) => n + x, 0) + 2;
export function entryTapTempo(v, c, d) {
    const entry = c.automation?.entry;
    if (entry?.effect !== 'tap' || entry.target !== 'district-eye-character')
        return 0;
    const p = v.seat, q = 1 - p, first = v.turn.firstPlayer === p;
    const enemies = v.players[q].play.filter(x => x.district === d && !x.faceDown && !x.tapped && !x.barrierNow && !x.cannotTap && hasCardType(x, 'character') && ((x.icons?.investigation ?? 0) + (x.temporaryIcons?.investigation ?? 0) > 0));
    if (!enemies.length)
        return 0;
    const ours = total(v, p, d, 'investigation') + icons(c, 'investigation', first), theirs = total(v, q, d, 'investigation');
    const won = (own, enemy) => own > enemy || own > 0 && own === enemy && first;
    const pending = kind => contestStillPending(v, d, kind);
    const room = Math.max(0, (v.players[p].handLimit ?? 7) - v.players[p].hand.length);
    let gain = Math.max(...enemies.map(x => {
        const removed = icons(x, 'investigation', !first), after = theirs - removed;
        let n = 0;
        // Compare the same deployed body with and without its entry effect. A
        // larger inspection is not another draw for each removed eye icon.
        if (pending('investigation')) {
            if (!won(ours, theirs) && won(ours, after))
                n += room > 0 ? 17 : 6;
            if ((theirs > ours || theirs > 0 && theirs === ours && !first) && !(after > ours || after > 0 && after === ours && !first))
                n += 10;
            n += Math.min(3, removed);
        }
        if (pending('battle')) {
            const own = icons(c, 'battle', first) + total(v, p, d, 'battle'), enemy = total(v, q, d, 'battle'), after = enemy - icons(x, 'battle', !first);
            if (own <= enemy && own > after)
                n += 8;
        }
        if (pending('influence'))
            n += Math.min(6, icons(x, 'influence', !first) * 3);
        return n;
    }));
    if (v.hardInfo) {
        const threats = knownOpponentOptions(v).filter(x => x.available && x.origin === 'hand' && x.card.spell?.timing === 'fast');
        const hit = threats.some(({ card }) => {
            const a = card.spell;
            if (a.actionPhaseOnly && v.turn.phase !== 'action')
                return false;
            if (a.filter && !responseFilter(c, a.filter))
                return false;
            if (counterEffects.has(a.effect))
                return ['stack-card', 'stack-character', 'stack-any', 'stack'].includes(a.target);
            if (!removalEffects.has(a.effect))
                return false;
            if (a.target === 'battle-icon-character' && !(icons(c, 'battle', true) > 0))
                return false;
            if (!['character', 'enemy-character', 'battle-icon-character', 'filtered-character', 'role-or-attachment'].includes(a.target))
                return false;
            return !['damage', 'wound'].includes(a.effect) || (a.amount ?? a.count ?? 1) >= (c.defense ?? 1);
        });
        if (hit)
            gain -= 26;
    }
    else {
        const qMana = (v.players[q].costPool ?? 0) + v.players[q].assets.filter(a => !a.tapped).length;
        if (qMana >= 2) {
            const colors = opponentColors(v);
            gain -= 10 * ((colors.shares.白 ?? 0) + (colors.shares.黑 ?? 0) + (colors.shares.蓝 ?? 0));
        }
    }
    return Math.max(0, gain);
}
export const bestEntryTapTempo = (v, c) => Math.max(0, ...(v.districts ?? []).map((r, d) => r ? entryTapTempo(v, c, d) : 0));
export function contestStillPending(v, d, kind) {
    const t = v.turn;
    if (['setup', 'start', 'action'].includes(t.phase))
        return true;
    if (t.phase !== 'contest' || !['contest-before', 'contest-after', 'contest-resolve', 'contest-triggers', 'contest-start', 'mobility-first', 'mobility-second'].includes(t.step))
        return false;
    if (t.district === null || t.district < d)
        return true;
    if (t.district > d)
        return false;
    const order = ['investigation', 'battle', 'influence'];
    return order.indexOf(t.kind) < order.indexOf(kind) || t.kind === kind && t.step === 'contest-before';
}
// An untapped mutant may use its own icons in an earlier region before paying
// the tap cost to stop a later region's investigation or influence contest.
export function mutantSealTempo(v, source, target) {
    const p = v.seat, hidden = (v.players[p].effectiveMarkers ?? v.players[p].markers)?.hidden > 0;
    const threatened = (v.flow?.stack ?? []).some(a => a.controller !== p && a.targetIds?.includes(source.id) && a.responseEffect?.removesTargets);
    if (!hidden)
        return threatened ? 15 : 0;
    const relevant = ['investigation', 'battle', 'influence'];
    const targetNow = v.turn.phase === 'contest' && v.turn.step === 'contest-before' && v.turn.district === target.district && icons(target, v.turn.kind, v.turn.firstPlayer === target.controller) > 0;
    if (!threatened && !targetNow)
        return 0;
    const lost = relevant.filter(k => contestStillPending(v, source.district, k)).reduce((n, k) => n + icons(source, k, v.turn.firstPlayer === p) * (k === 'influence' ? 6 : 4), 0);
    const gain = target.tapped || target.cannotTap ? 0 : relevant.filter(k => contestStillPending(v, target.district, k)).reduce((n, k) => n + icons(target, k, v.turn.firstPlayer === target.controller) * (k === 'investigation' ? 5 : 6), 0);
    const draw = v.players[p].deckCount > 3 ? ((v.players[p].hand.length < (v.players[p].handLimit ?? 7)) ? 9 : 3) : 0;
    return Math.max(0, gain + draw - lost + (threatened ? 12 : 0));
}
// All candidate generators must preserve a currently winning influence line.
// Sealing the source removes its icons even when the optional tap is unavailable.
export function mutantForfeitsWinningClaim(v, source, target, h) {
    const p = v.seat, d = source?.district, r = v.districts?.[d];
    if (!r || source.tapped || !h.contestPending(v, d, 'influence') || r.pendingWinner !== null && r.pendingWinner !== undefined)
        return false;
    if ((v.flow?.stack ?? []).some(a => a.controller !== p && a.targetIds?.includes(source.id) && a.responseEffect?.removesTargets))
        return false;
    const own = h.total(v, p, d, 'influence'), enemy = h.total(v, 1 - p, d, 'influence');
    const balance = (r.influence?.[p] ?? 0) - (r.influence?.[1 - p] ?? 0);
    if (own <= enemy || balance + own - enemy < r.threshold || !projectedClaimOutcome(v, p, d, h).wins)
        return false;
    const hidden = (v.players[p].effectiveMarkers ?? v.players[p].markers)?.hidden > 0;
    const targetLoss = hidden && target?.district === d && !target.tapped && !target.cannotTap ? icons(target, 'influence', v.turn.firstPlayer === target.controller) : 0;
    const afterOwn = own - icons(source, 'influence', v.turn.firstPlayer === p) - (target?.controller === p ? targetLoss : 0);
    const afterEnemy = enemy - (target?.controller !== p ? targetLoss : 0);
    return afterOwn <= afterEnemy || balance + afterOwn - afterEnemy < r.threshold;
}
