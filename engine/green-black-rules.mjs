import { withProjectionDefenseLayer } from './projection-read-cache.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { effectiveDefense } from './rounds.mjs';
import { effectiveSubtypes } from './derived.mjs';
export function ownActionStep(s, p) { return s.turn?.phase === 'action' && ['first-action', 'second-action'].includes(s.turn.step) && s.flow.stepOwner === p; }
export function recordOutsideAction(s, id) {
    const l = s.locations[id];
    if (l?.zone === 'play' && !ownActionStep(s, controllerOf(s, id)))
        l.outsideActionRound = s.round;
}
export function firstAbilitiesActive(s, p) { return s.turn?.firstPlayer === p || (s.effects ?? []).some(e => e.kind === 'first-abilities' && e.controller === p); }
// Determine eligibility in the defense layer before applying Nisos's text layer.
// The guard is evaluation-local, never stored in game state or carried into undo.
const defenseLayer = new WeakSet();
export function nisosSources(s, id) {
    const l = s.locations[id];
    if (defenseLayer.has(s) || l?.zone !== 'play' || l.faceDown || !hasCardType(s.cards[id], 'character'))
        return [];
    const candidates = s.players.flatMap(p => p.play).filter(source => { const sl = s.locations[source]; return false; });
    if (!candidates.length)
        return [];
    defenseLayer.add(s);
    try {
        return withProjectionDefenseLayer(s, () => {
            if (effectiveSubtypes(s, id).includes('人类') || effectiveDefense(s, id) !== 1)
                return [];
            return candidates.filter(source => false);
        });
    }
    finally {
        defenseLayer.delete(s);
    }
}
export const nonBattleBlocked = (s, id, kind) => kind !== 'battle' && nisosSources(s, id).length > 0;
