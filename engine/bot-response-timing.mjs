import { hasCardType } from './card-types.mjs';
import { removalEngineTempoBonus } from './bot-resource-planning.mjs';
import { actionEffectForecast } from './bot-effect-forecast.mjs';
const removals = new Set(['destroy', 'destroy-if-sealed', 'damage', 'wound', 'shuffle-owner', 'bounce', 'return-hand', 'conceal', 'sacrifice-character']);
export function pendingCharacterEntry(v, player) { return v.flow.stack.some(a => a.controller === player && (a.responseEffect?.characterEntry || ['play-character', 'reveal-character'].includes(a.kind))); }
export function actionWindowClosing(v) { return v.turn?.phase === 'action' && v.turn.step === 'second-action' && !v.flow.stack.length && v.flow.passed?.includes(1 - v.seat); }
export function pendingTargetThreat(v, id) {
    return [...v.flow.stack].reverse().find(a => a.controller !== v.seat && a.targetIds?.includes(id) && !a.responseEffect?.returnsTargetsToHand && (a.responseEffect?.removesTargets || a.responseEffect?.damage || a.damageEffect));
}
// Only an announced discard that can consume the whole current hand makes
// every held fast card perishable. Do not guess an opponent's hidden discard.
export function imminentHandLoss(v, c) {
    if (!(v.players[v.seat].hand ?? []).some(x => x.id === c?.id))
        return false;
    return v.flow.stack.some(a => a.controller !== v.seat && (a.responseEffect?.handDiscards ?? []).some(d => {
        const seat = d.player === 'first' ? v.turn.firstPlayer : d.player === 'second' ? 1 - v.turn.firstPlayer : d.player;
        return seat === v.seat && d.count >= v.players[v.seat].hand.length;
    }));
}
export function transactionProtectionRisk(v, c, plan, targetIds, h) { return !!c?.spell && actionEffectForecast(v, c, plan, targetIds, h, { isCard: true }).blocked; }
export function protectionWindowClosing(v, targetIds, h, c = { controller: v.seat, owner: v.seat, spell: {}, type: 'spell' }, plan = { effect: 'destroy', timing: 'fast' }) { return actionEffectForecast(v, c, plan, targetIds, h, { isCard: !!c.spell }).urgent; }
function contestMatters(v, targets, h) {
    if (v.turn?.step !== 'contest-before')
        return false;
    const d = v.turn.district, k = v.turn.kind;
    if (!['investigation', 'battle', 'influence'].includes(k))
        return false;
    return targets.some(c => c.district === d && !c.tapped && (c.effectiveIcons ?? c.icons ?? {})[k] > 0) && h.total(v, 1 - v.seat, d, k) >= h.total(v, v.seat, d, k);
}
// A fast removal keeps its option value until an announced effect can dilute
// the sacrifice, take away a target, grant protection, or close its last window.
// Own combo targets and spell-engine cycling remain deliberate proactive uses.
export function fastRemovalDue(v, c, plan, targetIds, h) {
    if (plan?.actionPhaseOnly && v.turn?.phase !== 'action')
        return false;
    if (plan?.timing !== 'fast' || !removals.has(plan.effect))
        return true;
    const p = v.seat, q = 1 - p, targets = (targetIds ?? []).map(id => h.lookup(v, id)).filter(Boolean), enemyTargets = targets.filter(c => c.controller === q);
    if (plan.effect === 'sacrifice-character') {
        if (!(targetIds ?? []).includes(`player:${q}`))
            return true;
        const choices = v.players[q].play.filter(x => !x.faceDown && hasCardType(x, 'character') && !h.keyword(x, '永恒'));
        if (!choices.length)
            return false;
        if (v.flow.stack.some(a => a.controller === p && a.responseEffect?.sacrificeCharacter && a.targetIds?.includes(`player:${q}`)))
            return false;
        if (imminentHandLoss(v, c) || pendingCharacterEntry(v, q) || contestMatters(v, choices, h) || v.turn.phase === 'end' && Math.min(...choices.map(h.value)) >= 5)
            return true;
        return v.players[q].handCount === 0 && !v.flow.stack.length && Math.min(...choices.map(h.value)) >= 8;
    }
    if (!enemyTargets.length)
        return true;
    const forecast = actionEffectForecast(v, c, plan, targetIds, h, { isCard: !!c?.spell });
    if (forecast.wait && !imminentHandLoss(v, c))
        return false;
    if (imminentHandLoss(v, c) || forecast.urgent)
        return true;
    if (v.bot?.id === 'yellow-white-spells' && v.turn.standardAllowed && v.players[p].play.some(x => !x.faceDown && x.catalogId === 'XG01') && (v.castingCosts?.[c.id] ?? h.cost(c)) === 0)
        return true;
    const changing = v.flow.stack.some(a => a.controller === q && a.targetIds?.some(id => enemyTargets.some(c => c.id === id)) && (a.responseEffect?.removesTargets || a.responseEffect?.protectsTargets));
    if (changing || contestMatters(v, enemyTargets, h) || v.turn.phase === 'end' && enemyTargets.some(c => h.value(c) >= 7))
        return true;
    if (plan.actionPhaseOnly && actionWindowClosing(v))
        return true;
    if (v.turn.step === 'claim-before' && enemyTargets.some(c => c.district === v.turn.district))
        return true;
    // Recurring draw, support and growth can justify spending the action window
    // even without an immediate threat. A discount also acts during cost payment,
    // so waiting to respond to the next spell would already be too late.
    return v.turn.phase === 'action' && enemyTargets.some(c => removalEngineTempoBonus(v, c, h) > 0);
}
// A paid flip is also a fast action. Retain hidden information and mana until
// a contest, response, immediate engine follow-up or the end window needs it.
export function paidRevealDue(v, c, h) {
    const p = v.seat, mine = v.players[p], up = h.faceUp(v, c), a = c.automation ?? {}, stack = v.flow.stack;
    if (v.turn.phase === 'end')
        return true;
    if (stack.some(x => x.controller !== p && x.targetIds?.includes(c.id)))
        return true;
    const actions = a.actions ?? (a.action ? [a.action] : []), after = h.pool(v) - (v.revealCosts?.[c.id] ?? h.cost(c));
    const ownWindow = v.turn.standardAllowed && v.flow.stepOwner === p && !stack.length;
    if (ownWindow) {
        const follow = mine.hand.filter(x => x.castAllowed !== false && h.loyalty(v, x) && (v.castingCosts?.[x.id] ?? h.cost(x)) <= after);
        if (v.bot?.id === 'purple-matriarch' && ['JZ64', 'WM066'].includes(c.catalogId) && follow.some(x => ['BH51', 'XQ44'].includes(x.catalogId)))
            return true;
        if (a.castingDiscount && follow.length || a.revealDiscount && mine.play.some(x => x.faceDown && x.id !== c.id && (v.revealCosts?.[x.id] ?? h.cost(x)) <= after))
            return true;
        if (a.watch?.some(w => w.own && ['cast', 'entry', 'sealed'].includes(w.event)) && follow.some(x => a.watch.some(w => w.event === 'cast' && x.subtypes?.includes(w.filter?.requireSubtype) || w.event === 'entry' && hasCardType(x, 'character') && (!w.filter?.requireSubtype || x.subtypes?.includes(w.filter.requireSubtype)))))
            return true;
        if (actions.some(x => !x.used && (x.cost ?? 0) <= after && (!x.tap || !up.tapped) && (x.effect === 'search-filtered' && x.filter?.name && h.libraryHasName(v, x.filter.name) ||
            x.operation === 'clock-recover' && mine.graveyard.some(x => x.subtypes?.some(t => ['法术', '灾难'].includes(t))) ||
            x.operation === 'invoke-core' && (mine.honor ?? 0) >= 2)))
            return true;
        if (c.catalogId === 'BH23' && follow.some(x => x.catalogId === 'BH24') && mine.hand.some(x => x.faction?.startsWith('红') && x.catalogId !== 'BH24' && h.hiddenStrength(x, v) + 3 >= 6))
            return true;
        if (c.catalogId === 'BQ058' && mine.hand.some(x => x.subtypes?.includes('命令')))
            return true;
        // Mana already in the pool is lost at a step boundary. Spend it only in
        // the final empty window, rather than exposing the card at its first chance.
        if (mine.costPool > 0 && v.flow.passed?.includes(1 - p))
            return true;
    }
    if (v.turn.phase === 'contest') {
        if (v.turn.district === c.district && v.turn.step === 'contest-before')
            return true;
        if (v.turn.district === c.district && v.turn.step === 'contest-after' && v.turn.kind === 'influence' && v.turn.reputationPending)
            return true;
        // An entry interaction can be needed before a remote threat resolves.
        if (stack.some(x => x.controller !== p && (x.responseEffect?.characterEntry || x.responseEffect?.removesTargets)) && (a.entry || a.reveal))
            return true;
    }
    return false;
}
