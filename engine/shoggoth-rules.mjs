import { changeHonor } from './player-resources.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { scoredTasks } from './task-districts.mjs';
import { RuleError } from './core.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { controllerOf } from './ownership.mjs';
import { hasCardType } from './card-types.mjs';
export const shoggothSociety = (s, p) => !!s.societies?.[p]?.plan?.shoggoth;
export const coreArea = (s, p) => s.coreAreas?.[p] ? s.locations[`core-area:${p}`] : null;
export const coreRest = (s, p) => coreArea(s, p)?.counters?.rest ?? 0;
export function coreRole(s, id, p = controllerOf(s, id), loc = s.locations[id]) {
    const c = s.cards[id];
    if (!c || !hasCardType(c, 'character') || !loc)
        return false;
    if (s.selectedCoreIds?.includes(id))
        return (loc.zone === 'core' ? loc.corePlayer : loc.controller ?? c.owner) === p;
    if (loc.zone === 'core')
        return loc.corePlayer === p;
    if (loc.zone === 'play' && !loc.faceDown && controllerOf(s, id) === p && c.subtypes?.includes('核心'))
        return true;
    if (loc.zone !== 'play' || loc.faceDown || controllerOf(s, id) !== p || !(loc.markers > 0))
        return false;
    return Object.entries(s.locations).some(([source, l]) => false);
}
export function coreRoles(s, p) { return s.players[p].play.filter(id => coreRole(s, id, p) && !s.locations[id].faceDown); }
export function shoggothAllowsCast(s, p, c) { return !shoggothSociety(s, p) || (s.societyStates[p].counters['失控'] ?? 0) < 3 || coreRole(s, c.id, p) || c.subtypes?.includes('命令'); }
export const coreNoResponse = (s, p, c) => coreRole(s, c.id, p) && scoredTasks(s, p, 'BQ116').length > 0;
export function shoggothDiscount(s, p, c, method) {
    let n = coreRole(s, c.id, p) ? scoredTasks(s, p, 'BQ116').length : 0;
    for (const id of s.players[p].play) {
        const l = s.locations[id];
        if (l?.zone === 'play' && !l.faceDown && printedRulesCard(s, id)?.automation?.shoggothStatic === 'core-discount' && coreRole(s, c.id, p))
            n++;
    }
    if (method === 'play' && c.spell?.ownCoreDiscount && coreRoles(s, p).length)
        n += c.spell.ownCoreDiscount;
    return n;
}
export function shoggothHiddenBonus(s, p) { return scoredTasks(s, p, 'BQ113').length + (coreRoles(s, p).length ? s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && printedRulesCard(s, id)?.automation?.shoggothStatic === 'core-discount').length * 3 : 0); }
export function shoggothKeyword(s, id, k) { return k === '混乱' && shoggothSociety(s, controllerOf(s, id)) && (s.societyStates[controllerOf(s, id)].counters['失控'] ?? 0) >= 3 && coreRole(s, id); }
export function coreCastPayment(s, p, id, c, pay) {
    if (s.locations[id]?.zone !== 'core')
        return;
    const rest = coreRest(s, p), honorRest = c.honorRest ?? 0;
    if (!Number.isSafeInteger(honorRest) || honorRest < 0 || honorRest > rest)
        throw new RuleError('请选择用名誉点支付的休整标志数量');
    const honor = honorRest * 2;
    if ((s.players[p].honor ?? 0) < honor)
        throw new RuleError('名誉点不足');
    pay(s, p, (rest - honorRest) * 2);
    changeHonor(s, p, -honor);
}
export function shoggothBonuses(s, id, white = false, blackOnly = false) {
    const l = s.locations[id], p = controllerOf(s, id), c = printedRulesCard(s, id), out = {};
    if (l?.zone !== 'play' || l.faceDown)
        return out;
    if (coreRole(s, id, p)) {
        const n = scoredTasks(s, p, 'BQ114').length;
        out.investigation = n;
        out.influence = n;
        out.battle = n * (s.societyStates?.[p]?.counters['失控'] ?? 0);
        out.defense = n + s.players[p].play.filter(x => s.locations[x]?.zone === 'play' && !s.locations[x].faceDown && printedRulesCard(s, x)?.automation?.shoggothStatic === 'tentacle').length;
        for (const x of s.players[p].play) {
            const a = printedRulesCard(s, x)?.automation;
            if (s.locations[x]?.zone !== 'play' || s.locations[x].faceDown)
                continue;
            if (a?.shoggothStatic === 'control-team') {
                out.investigation = (out.investigation ?? 0) + 1;
                out.battle = (out.battle ?? 0) + 1;
            }
            if (a?.shoggothStatic === 'mimic')
                out.defense += 1 + coreRest(s, p);
        }
    }
    if (c.automation?.shoggothStatic === 'corrector') {
        const n = effectiveSocietyMarkers(s, p).hidden;
        out.investigation = (out.investigation ?? 0) + n;
        out.defense = (out.defense ?? 0) + n;
    }
    if (c.automation?.shoggothStatic === 'tentacle' && (white || !blackOnly && s.turn?.firstPlayer === p) && coreRoles(s, p).some(x => s.locations[x].district === l.district))
        out.battle = 2;
    if (c.automation?.shoggothStatic === 'tentacle' && (coreRoles(s, p).length || effectiveSocietyMarkers(s, p).hidden > 0) && s.players[p].play.some(x => s.locations[x]?.zone === 'play' && !s.locations[x].faceDown && printedRulesCard(s, x)?.automation?.shoggothStatic === 'dictionary'))
        out.influence = 1;
    if (c.automation?.shoggothStatic === 'detective' && (white || !blackOnly && s.turn?.firstPlayer === p) && s.players[1 - p].play.some(x => s.locations[x]?.district === l.district && (s.locations[x].counters?.locked ?? 0) > 0 && (s.locations[x].faceDown || hasCardType(s.cards[x], 'character'))))
        out.investigation = 1;
    return out;
}
export function shoggothAuraKeyword(s, id, k) {
    if (k !== '机动' || !coreRole(s, id))
        return false;
    const p = controllerOf(s, id);
    return s.players[p].play.some(x => s.locations[x]?.zone === 'play' && !s.locations[x].faceDown && printedRulesCard(s, x)?.automation?.shoggothStatic === 'control-team');
}
