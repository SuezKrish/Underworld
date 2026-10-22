import {pendingGraveyardUse} from './bot-graveyard-uses.mjs';
import { hasCardType } from './card-types.mjs';
const ours = v => v.players[v.seat];
const field = v => ours(v).play.filter(c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed);
const mana = v => (ours(v).costPool ?? 0) + ours(v).assets.filter(c => !c.tapped).length;
const standard = v => v.turn?.standardAllowed && v.flow?.stepOwner === v.seat && !v.flow.stack.length;
const enabled = v => v.bot?.id === 'yellow-white-spells';
export const wheelStep = v => `${v.round}:${v.turn.priorityStepKey ?? v.turn.step}`;
export const wheelDisruptionKey = v => `wheel-disrupt:${wheelStep(v)}`;
export const wheelRefillKey = v => `refill:${wheelStep(v)}`;
export const wheelDisruptionPending = v => enabled(v) && v.bot.actionKeys?.includes(wheelDisruptionKey(v)) && !v.bot.actionKeys.includes(wheelRefillKey(v));
export const readyRelics = v => field(v).filter(c => c.catalogId === 'XG06' && !c.tapped);
const mindRelics = v => readyRelics(v).filter(c => c.chosenMagicDomain === '心灵').length;
const starRelics = v => readyRelics(v).filter(c => c.chosenMagicDomain === '星辰').length;
export const wheelPrice = v => Math.max(0, 3 - starRelics(v));
// Public graveyard text and visible recovery engines supply the evidence.
// Ordinary policies never inspect an opponent's hidden cards or deck order.
export function opposingGraveyardValue(v) {
    const q = 1 - v.seat, foe = v.players[q], grave = foe.graveyard ?? [];
    if (!grave.length || foe.deckCount <= 4)
        return 0; // Do not rescue an imminent deck-out.
    const visible = [...foe.play.filter(c => !c.faceDown || c.hardKnown), ...foe.hand.filter(c => c.name)];
    let value = 0;
    for (const c of grave) {
        const a = c.automation ?? {};
        if (a.graveHiddenWin)
            value += 18;
        if (a.castFromGrave || c.spell?.castFromGrave || c.attachment?.castFromGrave)
            value += 12;
        value += (a.zoneActions ?? []).filter(a => a.zone === 'graveyard').length * 8;
    }
    for (const c of visible) {
        if (c.printedTextBlank || c.abilitiesSuppressed)
            continue;
        const text = String(c.text ?? '').replaceAll('**', '').split('FAQ')[0];
        if (/墓地[^。\n]{0,80}(?:放置进场|打出|置于.*手|移回.*手)/.test(text)) {
            const roles = grave.filter(c => hasCardType(c, 'character'));
            value += Math.min(30, roles.reduce((n, c) => n + Math.min(6, c.printedCost ?? 0), 0));
        }
        if (grave.length >= 7 && /墓地[^。\n]{0,30}(?:七|7)张/.test(text))
            value += 10;
    }
    return value;
}
export function wantsStarRelic(v) {
    return enabled(v) && field(v).some(c => c.catalogId === 'XG01') && mindRelics(v) >= 2 && starRelics(v) === 0 && opposingGraveyardValue(v) >= 16;
}
export function spellRelicDomain(v) { return wantsStarRelic(v) ? '星辰' : '心灵'; }
// Once the first wheel has shuffled itself into our library, reserve enough
// mana to cast it again. Only this own-action recovery chain may draw through
// the ordinary safety reserve; batched draw budgeting still prevents overdraw.
export function wheelRecoveryDraw(v) {
    // Silver's cast trigger is chosen while the cantrip is still on the stack.
    // Retain the own standard-action step requirement, not an empty-stack gate.
    if (!wheelDisruptionPending(v) || !v.turn?.standardAllowed || v.flow?.stepOwner !== v.seat || ours(v).hand.some(c => c.catalogId === 'XQ02') || mana(v) < wheelPrice(v))
        return false;
    const known = v.bot?.libraryNames;
    return (known?.['轮回秘仪'] ?? v.hardInfo?.ownDeck.filter(c => c.catalogId === 'XQ02').length ?? 0) > 0;
}
export function wheelOpponentScore(v, card) {
    if (!enabled(v) || !standard(v) || !field(v).some(c => c.catalogId === 'XG01') || mindRelics(v) < 2 || v.bot.actionKeys?.includes(wheelDisruptionKey(v)) || v.bot.actionKeys?.includes(wheelRefillKey(v)))
        return null;
    const utility = opposingGraveyardValue(v);
    if (utility < 16)
        return null;
    const price = v.castingCosts?.[card.id] ?? wheelPrice(v), held = ours(v).hand.filter(c => c.catalogId === 'XQ02').length;
    const fuel = ours(v).hand.filter(c => c.id !== card.id && c.subtypes?.includes('法术') && (v.castingCosts?.[c.id] ?? c.printedCost ?? 0) === 0).length;
    // Another held copy is a direct fallback; otherwise require a small library
    // and multiple cantrips, not the hope of finding the wheel in forty cards.
    const reach = v.hardInfo ? 12 : Math.max(6, fuel * field(v).filter(c => c.catalogId === 'XG01').length + 2);
    if (mana(v) < price + wheelPrice(v) || held < 2 && (ours(v).deckCount > reach || fuel < 2))
        return null;
    if (ours(v).deckCount <= 2 && held < 2)
        return null;
    return 142 + Math.min(28, utility * 0.5) - price * 2;
}
export function spellRelicRebuild(v, c, target) {
    if (!enabled(v) || c.catalogId !== 'JC005' || !standard(v) || !wantsStarRelic(v) || mindRelics(v) < 3 || target.catalogId !== 'XG06' || target.controller !== v.seat || target.chosenMagicDomain !== '心灵' || target.tapped || v.bot.actionKeys?.includes(wheelRefillKey(v)))
        return null;
    const wheel = ours(v).hand.find(c => c.catalogId === 'XQ02');
    if (!wheel || ours(v).deckCount > 10 || ours(v).graveyard.length < 2 || mana(v) < (v.castingCosts?.[wheel.id] ?? wheelPrice(v)) + 1)
        return null;
    return 116;
}
// Funeral is an unaligned ritual: it does not trigger Silver Key or receive
// mind-spell discounts. It returns one actual grave card before its own draw.
// Funeral is an unaligned ritual: it does not trigger Silver Key or receive
// mind-spell discounts. It returns one actual grave card before its own draw.
export function spellFuneralScore(v, source, target, h) {
    if (!enabled(v) || !target)
        return null;
    const own = ours(v), p = v.seat, q = 1 - p, foe = v.players[q], price = v.castingCosts?.[source.id] ?? source.printedCost ?? 1;
    const graveOwner = v.players.findIndex(pl => pl.graveyard.some(c => c.id === target.id));
    if (graveOwner < 0)
        return null;
    const owner = target.owner ?? graveOwner, ourCard = owner === p;
    const incoming = pendingGraveyardUse(v, target.id, q);
    // A hostile grave return does not refill our library before the mandatory draw.
    if (!ourCard && own.deckCount <= 0)
        return null;
    if (!standard(v) && !incoming)
        return null;
    const live = field(v), held = own.hand.filter(c => c.id !== source.id), copies = code => live.concat(held).filter(c => c.catalogId === code).length;
    const engine = live.some(c => c.catalogId === 'XG01'), near = own.deckCount <= Math.max(8, live.filter(c => c.catalogId === 'XG01').length * 3), handRoom = Math.max(0, (own.handLimit ?? 7) - own.hand.length);
    let utility = 0;
    if (ourCard) {
        const code = target.catalogId;
        if (graveOwner !== p)
            return null;
        if (v.flow.stack.some(a => a.controller === p && a.targetIds?.includes(target.id)))
            return null;
        if (code === 'XQ02' && !held.some(c => c.catalogId === 'XQ02')) {
            const remaining = v.bot?.libraryNames?.[target.name] ?? v.hardInfo?.ownDeck.filter(c => c.catalogId === code).length ?? (own.deckCount === 0 ? 0 : undefined);
            if (remaining === 0)
                utility = near ? 105 : 35;
            else if (near)
                utility = 28;
        }
        if (code === 'XG01' && !copies(code))
            utility = near ? 62 : 25;
        if (code === 'XG06' && copies(code) < 2)
            utility = (near ? 48 : 20) - copies(code) * 5;
        if (engine && code === 'WM055' && !copies(code))
            utility = near ? 42 : 18;
        if (engine && code === 'BH03' && !copies(code))
            utility = near ? 34 : 12;
        if (engine && code === 'BH36' && !copies(code))
            utility = near ? 36 : 12;
        if (engine && target.subtypes?.includes('法术') && near && held.filter(c => c.subtypes?.includes('法术')).length < 2)
            utility = Math.max(utility, 22);
        // Only the bottom card can be reached by this draw when the library is empty.
        if (own.deckCount === 0 && utility < 30)
            return null;
    }
    else {
        // Keep the fast single-card answer for an announced graveyard use. A
        // proactive general graveyard reset belongs to the deck's wheel plan.
        if (!incoming)
            return null;
        const a = target.automation ?? {};
        if (a.graveHiddenWin)
            utility += 20;
        if (a.castFromGrave || target.spell?.castFromGrave || target.attachment?.castFromGrave)
            utility += 15;
        utility += (a.zoneActions ?? []).filter(a => a.zone === 'graveyard').length * 10;
        if (hasCardType(target, 'character') && foe.play.some(c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed && /墓地[^。\n]{0,80}(?:放置进场|打出|置于.*手|移回.*手)/.test(String(c.text ?? '').replaceAll('**', '').split('FAQ')[0])))
            utility += Math.min(25, h.value(target) * 1.5);
    }
    if (incoming)
        utility += 65 + Math.min(40, h.value(target) * 2);
    if (utility <= 0)
        return null;
    if (!incoming && utility < 50 && handRoom === 0 && !near)
        return null;
    const score = 18 + utility + Math.min(12, handRoom * 3) - price * 6;
    return score > 22 ? score : null;
}
