import { nonDrawEffectBlocked } from './bot-draw-lock-planning.mjs';
import { copyIndex, engineCanStart } from './bot-dynamic-planning.mjs';
import { hasCardType } from './card-types.mjs';
import { wheelDisruptionPending, wantsStarRelic, readyRelics } from './spell-graveyard-planning.mjs';
const fuelIds = new Set(['BQ010', 'JC005', 'WM090', 'BQ009']);
export const spellFuel = c => fuelIds.has(c.catalogId);
function targetedThreat(v, role) {
    return v.flow.stack.some(a => {
        if (a.controller === v.seat || !a.targetIds?.includes(role.id))
            return false;
        const r = a.responseEffect ?? {};
        return !r.returnsTargetsToHand && (r.removesTargets || r.enteringCard?.automation?.controlHost ||
            r.damage && !role.battleDamagePrevented && (r.damageAmount ?? 1) >= (role.effectiveDefense ?? role.defense ?? 1) - (role.damage ?? 0) - (role.wounds ?? 0));
    });
}
export function spellSilverRescue(v, source, options, h) {
    if (v.bot?.id !== 'yellow-white-spells' || !['JZ05', 'JC006'].includes(source.catalogId))
        return [];
    const own = v.players[v.seat], bodies = own.play.filter(c => !c.faceDown && hasCardType(c, 'character') && !h.keyword(c, '永恒') && !c.cannotSacrifice);
    const sacrifice = v.flow.stack.some(a => a.controller !== v.seat && a.responseEffect?.sacrificeCharacter && a.targetIds?.includes(`player:${v.seat}`));
    return own.play.filter(c => !c.faceDown && c.catalogId === 'XG01' && options.some(o => o.id === c.id) && !h.targetedByUs(v, c.id) && !h.keyword(c, '永恒')).flatMap(c => {
        const target = targetedThreat(v, c), forcedSacrifice = sacrifice && bodies.length === 1 && bodies[0].id === c.id;
        if (!target && !(source.catalogId === 'JC006' && forcedSacrifice))
            return [];
        const price = v.castingCosts?.[source.id] ?? h.cost(source), reset = (c.counters?.battle ?? 0) * 2;
        return [{ targetId: c.id, score: (source.catalogId === 'JZ05' ? 132 - reset : 118 - h.cost(c) * 2) + h.value(c) - price * 2 }];
    });
}
function opposingActionAhead(v) { return v.turn?.phase === 'action' && v.turn.firstPlayer === v.seat && v.turn.step === 'first-action'; }
export function spellBlinkHold(v, c, h) {
    if (v.bot?.id !== 'yellow-white-spells' || c.catalogId !== 'JZ05' || !opposingActionAhead(v))
        return false;
    const own = v.players[v.seat], foe = v.players[1 - v.seat];
    if (!own.play.some(x => !x.faceDown && x.catalogId === 'XG01') || (foe.handCount ?? foe.hand.length) === 0 || !(foe.costPool + (foe.assets ?? []).filter(a => !a.tapped).length > 0))
        return false;
    return !own.hand.some(x => x.id !== c.id && ['JZ05', 'WM008', 'XQ04'].includes(x.catalogId) && h.loyalty(v, x) && x.castAllowed !== false && (v.castingCosts?.[x.id] ?? h.cost(x)) <= h.pool(v));
}
export function spellProtectionReserve(v, h) {
    if (v.bot?.id !== 'yellow-white-spells' || !opposingActionAhead(v) || !v.players[v.seat].play.some(c => !c.faceDown && c.catalogId === 'XG01'))
        return 0;
    const own = v.players[v.seat], foe = v.players[1 - v.seat];
    if ((foe.handCount ?? foe.hand.length) === 0 || !(foe.costPool + (foe.assets ?? []).filter(a => !a.tapped).length > 0))
        return 0;
    const protection = own.hand.filter(c => ['JZ05', 'WM008', 'XQ04', 'JC006'].includes(c.catalogId) && c.castAllowed !== false && h.loyalty(v, c));
    return protection.length ? Math.min(...protection.map(c => v.castingCosts?.[c.id] ?? h.cost(c))) : 0;
}
export function spellCombatReserve(v, c) {
    if (v.bot?.id !== 'yellow-white-spells' || c.catalogId !== 'BH03')
        return 0;
    const own = v.players[v.seat], started = own.play.some(x => x.catalogId === 'XG01' && (!x.faceDown || v.round >= 3));
    if (!started)
        return 0;
    const held = own.hand.filter(x => x.catalogId === 'BH03');
    return held.length && held[0].id === c.id ? 55 : 0;
}
// Pump a surviving friendly body before its battle. Repeated storage cycles
// can build a lethal damage budget even when the next two knives alone do
// not kill the largest enemy. Do not spend this combat tool as a defense-mode
// cantrip, or blink away the body carrying its accumulated icons.
export function spellCombatPump(v, source, options, h) {
    if (v.bot?.id !== 'yellow-white-spells' || source.catalogId !== 'BH03')
        return null;
    const p = v.seat, own = v.players[p], foe = v.players[1 - p], silver = own.play.some(c => !c.faceDown && c.catalogId === 'XG01');
    const standard = v.turn.standardAllowed && v.flow.stepOwner === p && !v.flow.stack.length;
    const beforeBattle = v.turn.step === 'contest-before' && v.turn.kind === 'battle';
    if (!standard && !beforeBattle)
        return null;
    const price = v.castingCosts?.[source.id] ?? h.cost(source);
    // The combat margin is still provisional during standard actions. Paid
    // pumps wait for the actual battle; a free engine cantrip can develop now.
    if (standard && (price > 0 || !silver))
        return null;
    const candidates = own.play.filter(c => !c.faceDown && !c.tapped && hasCardType(c, 'character') && options.some(o => o.id === c.id) && h.contestPending(v, c.district, 'battle') && (!beforeBattle || v.turn.district === c.district));
    const rows = candidates.flatMap(c => {
        const d = c.district, margin = h.total(v, p, d, 'battle') - h.total(v, 1 - p, d, 'battle');
        const victims = foe.play.filter(x => x.district === d && !x.faceDown && hasCardType(x, 'character') && !x.battleDamagePrevented && !h.keyword(x, '永恒'));
        if (!victims.length)
            return [];
        const durable = Number(!h.lethalBattleRisk(v, { ...c, effectiveIcons: { ...(c.effectiveIcons ?? c.icons), battle: h.icons(v, c, 'battle') + 2 } }, d));
        const strength = x => Math.max(1, (x.effectiveDefense ?? x.defense ?? 1) - (x.damage ?? 0) - (x.wounds ?? 0));
        const kills = budget => {
            let n = 0;
            for (const x of h.sorted(victims, h.value)) {
                const need = strength(x);
                if (budget >= need) {
                    budget -= need;
                    n += h.value(x);
                }
            }
            return n;
        };
        const gain = kills(Math.max(0, margin + 2)) - kills(Math.max(0, margin));
        const work = margin < Math.max(...victims.map(strength));
        if (!gain && !(silver && standard && price === 0 && work))
            return [];
        return [{ targetId: c.id, score: 62 + gain * 3 + durable * 8 - price * 3, rank: gain * 3 + durable * 8 + (c.effectiveDefense ?? c.defense ?? 1) + h.value(c) * 0.1 }];
    }).sort((a, b) => b.rank - a.rank || a.targetId.localeCompare(b.targetId));
    return rows[0] ?? null;
}
export function spellLibraryBonus(v, c) {
    if (v.bot?.id !== 'yellow-white-spells')
        return 0;
    const own = v.players[v.seat], field = own.play.filter(c => !c.faceDown), held = own.hand;
    const engines = nonDrawEffectBlocked(v) ? 0 : field.filter(c => c.catalogId === 'XG01').length, hidden = own.play.filter(c => c.faceDown && c.catalogId === 'XG01').length;
    const relics = field.filter(c => c.catalogId === 'XG06' && !c.tapped).length;
    const count = id => held.filter(c => c.catalogId === id).length, ready = !nonDrawEffectBlocked(v) && (engines > 0 || hidden > 0 && v.round >= 3);
    const fuel = held.filter(spellFuel).length;
    if (c.catalogId === 'XQ02' && wheelDisruptionPending(v) && !count('XQ02'))
        return 250;
    if (c.catalogId === 'BH03' && engines && !count('BH03'))
        return 65;
    if (c.catalogId === 'XG03' && !count('XQ02') && own.assets.some(c => c.catalogId === 'XQ02') && !v.hardInfo?.ownDeck.some(c => c.catalogId === 'XQ02'))
        return 80;
    if (c.catalogId === 'XG01') {
        const n = copyIndex(v, c), canStart = engineCanStart(v, c);
        return n >= 2 ? -20 : n === 1 ? canStart ? 12 : -12 : canStart ? 24 : v.round <= 2 ? -10 : 10;
    }
    if (c.catalogId === 'XG06')
        return wantsStarRelic(v) && readyRelics(v).length < 3 && !count('XG06') ? 65 : relics + count('XG06') < 2 ? 18 : -22;
    if (c.catalogId === 'WM055')
        return field.some(c => c.catalogId === 'WM055') || count('WM055') ? fuel < 2 ? -22 : 0 : ready ? 16 : 3;
    if (c.catalogId === 'BH36' && engines && relics >= 2 && !count('BH36') && !field.some(c => c.catalogId === 'BH36') && fuel > 0)
        return 45;
    if (c.catalogId === 'XQ28' && engines && fuel >= 2 && field.reduce((n, c) => n + ((c.effectiveIcons ?? c.icons ?? {}).investigation ?? 0), 0) < 2)
        return 20;
    if (spellFuel(c) && ready)
        return (fuel < 2 ? 40 : fuel < 4 ? 24 : 8) + (c.catalogId === 'BQ010' ? 8 : c.catalogId === 'JC005' && relics >= 2 ? 6 : 0) - count(c.catalogId) * 5;
    if (c.catalogId === 'XQ49' && own.graveyard.some(t => ['XQ02', 'XG01', 'XG06', 'WM055', 'BH03'].includes(t.catalogId)) && !count('XQ49'))
        return own.deckCount <= 10 ? 40 : 12;
    if (c.catalogId === 'XQ02' && own.deckCount <= 12 && own.graveyard.length >= 3 && !count('XQ02'))
        return 50;
    return 0;
}
