import { hasCardType } from './card-types.mjs';
import { libraryBudget, resourcePriorities } from './bot-resource-planning.mjs';
const own = v => v.players[v.seat].play.filter(c => !c.faceDown && !c.abilitiesSuppressed);
const handCount = (v, p) => v.players[p].handCount ?? v.players[p].hand?.length ?? 0;
const engine = c => ['BQ030', 'BQ036', 'BQ034', 'BQ031', 'BQ035', 'CQ07'].includes(c.catalogId) || c.catalogId === 'BH16';
export const blueBot = v => v.bot?.id === 'blue-dragon-feast';
const informed = v => v.bot?.difficulty === 'hard';
const arbiters = v => own(v).filter(c => c.catalogId === 'BQ030' && !c.printedTextBlank);
const bloodSources = v => [...v.players[v.seat].graveyard, ...(v.players[v.seat].headquarters ?? []), ...(v.sealed ?? []).filter(c => c.hostId === `society:${v.seat}`)].filter(c => c.name === '鲜血');
const heartPath = v => own(v).some(c => c.catalogId === 'JC034' && !c.printedTextBlank);
const characterAttachment = c => c.attachment?.effect === 'attach';
const firstCopy = (v, c) => !v.players[v.seat].hand.some(x => x.catalogId === c.catalogId) || v.players[v.seat].hand.find(x => x.catalogId === c.catalogId)?.id === c.id;
const blades = c => c.tapped ? 0 : c.effectiveIcons?.battle ?? c.icons?.battle ?? 0;
function attachmentFuel(v) {
    const m = v.players[v.seat], soon = m.assets.length + 1;
    const fromHand = m.hand.filter(c => characterAttachment(c) && (v.castingCosts?.[c.id] ?? c.printedCost ?? 0) <= soon && (c.catalogId !== 'JC036' || (v.spellTargets?.[c.id] ?? []).some(o => v.players[1 - v.seat].play.some(x => x.id === o.id)))).length;
    const bats = m.hand.filter(c => c.catalogId === 'BQ026').length + own(v).filter(c => c.catalogId === 'BQ026' && !c.attachedTo).length;
    const drink = bloodSources(v).length && own(v).some(c => c.catalogId === 'BQ027' || c.catalogId === 'XG10' && !c.tapped);
    return fromHand + bats + Number(!!drink);
}
export function blueSecretDeployAllowed(v, c) {
    if (!blueBot(v) || !informed(v))
        return true;
    const m = v.players[v.seat];
    if (['BQ030', 'BQ036', 'BQ035'].includes(c.catalogId) && m.play.some(x => x.faceDown && x.catalogId === c.catalogId))
        return false;
    if (c.catalogId === 'BQ036' && m.assets.length < 3)
        return false;
    return true;
}
export function blueHiddenDistrictBonus(v, c, d, h) {
    if (!blueBot(v) || !informed(v) || !['BQ030', 'BQ036', 'BQ035'].includes(c.catalogId))
        return 0;
    const region = v.districts[d], m = v.players[v.seat], price = v.revealCosts?.[c.id] ?? c.printedCost ?? 0;
    const wait = Math.max(1, price - m.assets.length), ours = h.total(v, v.seat, d, 'influence') + 1, theirs = h.total(v, 1 - v.seat, d, 'influence');
    const delta = ours - theirs, owner = delta >= 0 ? v.seat : 1 - v.seat, lead = Math.abs(delta) * wait + (region.influence[owner] ?? 0) - (region.influence[1 - owner] ?? 0);
    return delta && lead >= region.threshold ? -32 : 0;
}
function battleLine(v, d, h, prospect) {
    const roles = own(v).filter(c => c.district === d && hasCardType(c, 'character') && !c.tapped && c.id !== prospect?.id);
    const existing = own(v).find(c => c.id === prospect?.id && c.district === d), gain = prospect && !prospect.faceDown ? blades(prospect) : 0;
    if (prospect && !prospect.faceDown && !prospect.tapped && hasCardType(prospect, 'character'))
        roles.push(prospect);
    const ours = h.total(v, v.seat, d, 'battle') - (existing ? blades(existing) : 0) + gain, theirs = h.total(v, 1 - v.seat, d, 'battle');
    const wins = ours > 0 && (ours > theirs || ours === theirs && v.turn.firstPlayer === v.seat && h.pool(v) >= 1);
    return { roles, wins };
}
// Count rewards by won battle, rather than by possible kills. Empty enemy
// districts can still make the opponent discard through a participating host.
export function blueBattleDiscards(v, d, h, prospect, { includePath = heartPath(v) } = {}) {
    if (!blueBot(v) || !h.contestPending(v, d, 'battle'))
        return 0;
    const { roles, wins } = battleLine(v, d, h, prospect);
    if (!wins)
        return 0;
    const path = includePath && roles.some(c => c.subtypes?.includes('吸血鬼')) ? 1 : 0;
    const eyes = own(v).filter(c => c.catalogId === 'BQ039' && !c.printedTextBlank && roles.some(host => host.id === c.attachedTo)).length;
    return Math.min(handCount(v, 1 - v.seat), path + eyes);
}
export function blueBattleDistrictBonus(v, c, d, h) {
    if (!blueBot(v) || c.faceDown || !hasCardType(c, 'character'))
        return 0;
    const before = blueBattleDiscards(v, d, h), after = blueBattleDiscards(v, d, h, c);
    return (after - before) * 12;
}
export function blueHeartPathPlayScore(v, h) {
    if (!blueBot(v) || heartPath(v))
        return undefined;
    const extra = (v.districts ?? []).reduce((n, d, i) => n + (d ? Math.max(0, blueBattleDiscards(v, i, h, undefined, { includePath: true }) - blueBattleDiscards(v, i, h)) : 0), 0);
    const vampires = own(v).some(c => c.subtypes?.includes('吸血鬼'));
    return 38 + (vampires ? 8 : 0) + Math.min(handCount(v, 1 - v.seat), extra) * 12;
}
export function blueMulligan(v, h) {
    if (!blueBot(v))
        return null;
    const hand = v.players[v.seat].hand, keep = new Set();
    for (const code of ['BQ030', 'JC034']) {
        const c = hand.find(c => c.catalogId === code);
        if (c)
            keep.add(c.id);
    }
    // Preserve the first two engines as spells; spare blood-domain cards fund
    // them. A second Path is an asset candidate while the first stays in hand.
    for (const c of h.sorted(hand.filter(c => !keep.has(c.id) && !c.nonAssetNow && c.magicDomains?.includes('鲜血')), h.value, false).slice(0, 2))
        keep.add(c.id);
    const cheap = hand.filter(c => hasCardType(c, 'character') && (c.printedCost ?? 0) <= 2);
    let bodies = cheap.filter(c => keep.has(c.id)).length;
    for (const c of h.sorted(cheap, h.value))
        if (!keep.has(c.id) && bodies < 2) {
            keep.add(c.id);
            bodies++;
        }
    return [{ type: 'mulligan', cardIds: hand.filter(c => !keep.has(c.id)).map(c => c.id) }];
}
function stagedEngine(v, h) {
    const m = v.players[v.seat], futureMana = h.pool(v) + (!m.actionsUsed?.asset && m.hand.some(c => !c.nonAssetNow) ? 1 : 0);
    const fuel = informed(v) ? attachmentFuel(v) : m.hand.some(characterAttachment) || own(v).some(c => c.catalogId === 'BQ026' && !c.attachedTo) || bloodSources(v).length && own(v).some(c => c.catalogId === 'BQ027');
    return m.play.filter(c => c.faceDown && !c.paidRevealBlocked && h.loyalty(v, c) && (v.revealCosts?.[c.id] ?? c.printedCost ?? 0) <= futureMana).filter(c => c.catalogId === 'BQ030' && !arbiters(v).length && fuel || c.catalogId === 'BQ036' && !own(v).some(c => c.catalogId === 'BQ036') && (informed(v) || m.hand.length <= 3 || arbiters(v).length && m.hand.filter(c => c.attachment).length < 2)).sort((a, b) => Number(a.catalogId !== 'BQ030') - Number(b.catalogId !== 'BQ030'))[0];
}
export function blueRevealReserve(v, h) {
    if (!blueBot(v) || resourcePriorities(v, h).critical)
        return 0;
    const c = stagedEngine(v, h);
    return c ? v.revealCosts?.[c.id] ?? c.printedCost ?? 0 : 0;
}
export function blueEngineRevealScore(v, c, h) {
    if (!blueBot(v) || !['BQ030', 'BQ036'].includes(c.catalogId) || stagedEngine(v, h)?.id !== c.id)
        return undefined;
    const up = h.faceUp(v, c), price = v.revealCosts?.[c.id] ?? c.printedCost ?? 0, after = h.pool(v) - price;
    if (after < 0 || h.lethalBattleRisk(v, up, c.district))
        return undefined;
    if (v.turn.phase === 'end')
        return 106;
    if (informed(v) && c.catalogId === 'BQ036' && (v.turn.standardAllowed && v.flow.stepOwner === v.seat && !v.flow.stack.length || v.turn.phase === 'contest' && v.turn.step === 'contest-before' && v.turn.kind === 'investigation' && v.turn.district === c.district))
        return 108;
    const m = v.players[v.seat], combo = m.hand.some(a => characterAttachment(a) && (v.castingCosts?.[a.id] ?? a.printedCost ?? 0) <= after) || own(v).some(a => a.catalogId === 'BQ026' && !a.attachedTo && a.district !== c.district) || bloodSources(v).length && own(v).some(a => a.catalogId === 'BQ027');
    if (v.turn.standardAllowed && v.flow.stepOwner === v.seat && !v.flow.stack.length && (combo || m.costPool >= price))
        return 106;
    return undefined;
}
// Usage and already announced triggers are public information. A once-per-
// round discard cannot be treated as another reward for every new attachment.
export function blueReadyDiscarders(v) {
    const pending = [...(v.flow?.stack ?? []), ...(v.pendingTriggers ?? []), ...(v.triggerChoices ?? []), ...(v.triggerRound?.abilities ?? [])];
    return own(v).filter(c => c.catalogId === 'BQ031' && !c.printedTextBlank).filter(c => {
        const i = c.automation?.watch?.findIndex(w => w.event === 'attached' && w.operation === 'discard-one') ?? -1;
        return i >= 0 && (c.triggerUsage?.[i] ?? 0) < 1 && !pending.some(a => a.cardId === c.id && a.event === 'attached');
    });
}
function attachmentIncome(v, h) { return Math.min(arbiters(v).length, libraryBudget(v, h)); }
export function blueHandBonus(v, c, h) {
    if (!blueBot(v))
        return 0;
    const m = v.players[v.seat], drawEngines = arbiters(v).length, staged = m.play.some(c => c.faceDown && c.catalogId === 'BQ030');
    let n = c.catalogId === 'BQ030' ? (informed(v) ? !drawEngines && !staged ? 12 : drawEngines >= 2 ? -8 : staged ? -6 : 0 : !drawEngines ? 12 : 0) : 0;
    if (informed(v) && c.unique && m.play.some(x => x.faceDown && x.catalogId === c.catalogId))
        n -= 16;
    if (c.catalogId === 'JC034' && !heartPath(v) && firstCopy(v, c))
        n += 22;
    if (c.catalogId === 'BQ039' && handCount(v, 1 - v.seat) > 0 && own(v).some(c => hasCardType(c, 'character')))
        n += 5;
    if (c.attachment && own(v).some(c => c.subtypes?.includes('吸血鬼')))
        n += 3;
    if (c.catalogId === 'BQ036' && !own(v).some(c => c.catalogId === 'BQ036'))
        n += 5;
    if (c.catalogId === 'WM021' && !own(v).some(c => c.catalogId === 'WM021') && v.players[v.seat].hand.some(x => x.id !== c.id && x.subtypes?.includes('吸血鬼')))
        n += 5;
    if (c.catalogId === 'BQ027' && blueReadyDiscarders(v).length && bloodSources(v).length)
        n += 8;
    if (c.catalogId === 'BQ035' && !own(v).some(c => c.catalogId === 'BQ035') && own(v).some(a => a.name === '鲜血'))
        n += 8;
    if (informed(v) && c.catalogId === 'BQ026' && (drawEngines || staged || m.hand.some(x => x.catalogId === 'BQ030')))
        n += 8;
    if (informed(v) && drawEngines && (c.catalogId === 'BQ026' || characterAttachment(c) && c.catalogId !== 'JC036') && (v.castingCosts?.[c.id] ?? c.printedCost ?? 0) <= m.assets.length)
        n += Math.min(drawEngines, libraryBudget(v, h)) * 12;
    if (informed(v) && ['BH16', 'JC030', 'BQ031', 'BQ035'].includes(c.catalogId) && !own(v).some(x => hasCardType(x, 'character') && blades(x) > 0))
        n += (c.printedCost ?? 0) <= m.assets.length + 1 ? 6 : 1;
    return n;
}
export function bluePlayBonus(v, c, h) {
    if (!blueBot(v))
        return 0;
    if (informed(v) && c.catalogId === 'BQ026' && arbiters(v).length)
        return 16;
    if (informed(v) && ['BH16', 'JC030', 'BQ031'].includes(c.catalogId) && !own(v).some(x => hasCardType(x, 'character') && blades(x) > 0))
        return 10;
    if (c.catalogId === 'BQ035' && !own(v).some(x => x.catalogId === 'BQ035'))
        return 8 + Math.min(3, own(v).filter(a => a.name === '鲜血').length) * 5;
    if (c.catalogId !== 'BQ030' || resourcePriorities(v, h).critical)
        return 0;
    const fuel = informed(v) ? attachmentFuel(v) : v.players[v.seat].hand.filter(x => x.id !== c.id && characterAttachment(x)).length + own(v).filter(x => x.catalogId === 'BQ026' && !x.attachedTo).length + bloodSources(v).length;
    if (!arbiters(v).length)
        return fuel ? 30 : 10;
    const after = h.pool(v) - (v.castingCosts?.[c.id] ?? c.printedCost ?? 0);
    return informed(v) ? !fuel || arbiters(v).length >= 2 ? -10 : after >= 1 && fuel >= 1 ? 10 : 0 : after >= 1 && fuel >= 2 && arbiters(v).length < 2 ? 14 : 0;
}
export function blueAttachmentScore(v, source, target, h) {
    const attachments = own(v).filter(a => a.attachedTo === target.id), priest = target.catalogId === 'BH16' && !attachments.length;
    let n = h.value(target) + h.total(v, v.seat, target.district, 'investigation') * 0.25 + (priest ? 22 : 0) - attachments.length;
    if (source.catalogId === 'BQ039' && handCount(v, 1 - v.seat) > 0 && h.contestPending(v, target.district, 'battle')) {
        const line = battleLine(v, target.district, h);
        n += line.wins && !target.tapped && handCount(v, 1 - v.seat) > blueBattleDiscards(v, target.district, h) ? 30 : -18;
    }
    if (source.catalogId === 'BQ026' && engine(target) && !attachments.some(a => a.catalogId === 'BQ026'))
        n += 12;
    if (source.catalogId === 'BQ040') {
        const protectedTarget = { ...target, effectiveDefense: (target.effectiveDefense ?? target.defense ?? 1) + 1, effectiveIcons: { ...(target.effectiveIcons ?? target.icons), battle: (target.effectiveIcons?.battle ?? target.icons?.battle ?? 0) + 1 } };
        if (h.lethalBattleRisk(v, target, target.district) && !h.lethalBattleRisk(v, protectedTarget, target.district))
            n += 22;
        if (informed(v))
            n += (blueBattleDiscards(v, target.district, h, protectedTarget) - blueBattleDiscards(v, target.district, h)) * 14;
        if (informed(v) && target.tapped && h.contestPending(v, target.district, 'battle'))
            n -= 16;
        if (own(v).some(c => c.catalogId === 'BQ035') && !attachments.some(a => a.name === '鲜血'))
            n += v.turn.phase === 'action' ? 14 : 7;
    }
    if (h.lethalBattleRisk(v, target, target.district))
        n -= 12;
    if (v.turn.step === 'claim-before' && target.district === v.turn.district)
        n -= 24;
    return n;
}
export function blueBloodSearch(v, source, options, h) {
    const targets = options.map(o => h.lookup(v, o.id)).filter(c => c?.controller === v.seat && c.subtypes?.includes('吸血鬼'));
    const ranked = targets.map(host => {
        // The patrol taps as a cost. Giving itself a knife will not win a battle
        // this round, whereas an untapped other host can immediately use the blood.
        const target = { ...host, tapped: host.tapped || host.id === source.id }, attachments = own(v).filter(c => c.attachedTo === target.id);
        const buff = { ...target, effectiveIcons: { ...(target.effectiveIcons ?? target.icons), battle: blades(target) + 1 }, effectiveDefense: (target.effectiveDefense ?? target.defense ?? 1) + 1 };
        const discardGain = blueBattleDiscards(v, target.district, h, buff) - blueBattleDiscards(v, target.district, h), income = attachmentIncome(v, h), denial = handCount(v, 1 - v.seat) > 0 && blueReadyDiscarders(v).length;
        const priest = target.catalogId === 'BH16' && !attachments.length && !target.tapped;
        const saves = h.lethalBattleRisk(v, target, target.district) && !h.lethalBattleRisk(v, buff, target.district);
        const swing = !target.tapped && h.contestPending(v, target.district, 'battle') && h.total(v, v.seat, target.district, 'battle') <= h.total(v, 1 - v.seat, target.district, 'battle') && h.total(v, v.seat, target.district, 'battle') + 1 > h.total(v, 1 - v.seat, target.district, 'battle');
        return { targetId: host.id, rank: blueAttachmentScore(v, { catalogId: 'BQ040' }, target, h) - (!informed(v) && target.tapped ? 16 : 0), score: informed(v) ? 16 + income * 12 + (denial ? 12 : 0) + discardGain * 12 + (priest ? 12 : 0) + (saves ? 16 : 0) + (swing ? 8 : 0) : 42 + arbiters(v).length * 10 };
    }).sort((a, b) => b.rank - a.rank || a.targetId.localeCompare(b.targetId));
    return ranked[0] ?? null;
}
export function blueBatAttachTargets(v, source, options, h) {
    const targets = options.map(o => h.lookup(v, o.id)).filter(c => c?.controller === v.seat && hasCardType(c, 'character'));
    const staged = v.players[v.seat].hand.some(engine) || v.players[v.seat].play.some(c => c.faceDown && engine(c));
    return targets.filter(c => engine(c) || h.value(c) >= 7 || !staged).sort((a, b) => blueAttachmentScore(v, source, b, h) - blueAttachmentScore(v, source, a, h) || a.id.localeCompare(b.id)).map(c => c.id);
}
export function blueBatMobility(v, source, options, h) {
    if (source.catalogId !== 'BQ026' || source.attachedTo)
        return null;
    const choices = options.flatMap(o => {
        const d = Number(o.id.slice(9)), hosts = own(v).filter(c => c.id !== source.id && c.district === d && c.subtypes?.includes('吸血鬼'));
        const ids = blueBatAttachTargets(v, source, hosts.map(c => ({ id: c.id })), h);
        if (!ids.length)
            return [];
        const host = h.lookup(v, ids[0]), draw = attachmentIncome(v, h), discard = blueReadyDiscarders(v).length && handCount(v, 1 - v.seat) > 0;
        return [{ id: o.id, score: blueAttachmentScore(v, source, host, h) + draw * 8 + (discard ? 12 : 0) }];
    });
    choices.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return choices.length ? choices.map(c => c.id) : null;
}
export function blueDistrictBonus(v, c, d, h) {
    if (!blueBot(v))
        return 0;
    const bats = own(v).filter(x => x.id !== c.id && x.catalogId === 'BQ026' && !x.attachedTo && !x.cannotMove);
    if (engine(c) && c.subtypes?.includes('吸血鬼'))
        return bats.some(b => b.district !== d) ? 10 : 0;
    if (c.catalogId !== 'BQ026')
        return 0;
    const hosts = own(v).filter(x => x.district === d && x.subtypes?.includes('吸血鬼') && engine(x));
    if (hosts.length)
        return 14 + attachmentIncome(v, h) * 6;
    const future = v.players[v.seat].hand.find(x => x.id !== c.id && engine(x) && x.subtypes?.includes('吸血鬼'));
    if (!future)
        return 0;
    const goal = h.districts(v, future).sort((a, b) => h.districtScore(v, b, future) - h.districtScore(v, a, future) || a - b)[0];
    return d === goal ? -22 : 0;
}
export function blueBloodSacrifice(v, source, options, h) {
    if (!blueBot(v) || source.catalogId !== 'BQ027')
        return null;
    const available = bloodSources(v).length || own(v).some(a => a.name === '鲜血' && a.attachedTo === source.id);
    if (!available)
        return null;
    const targets = options.map(o => h.lookup(v, o.id)).filter(c => c?.controller === v.seat && c.id !== source.id && c.subtypes?.includes('吸血鬼'));
    if (!targets.length)
        return null;
    const discarders = blueReadyDiscarders(v), enemyCards = handCount(v, 1 - v.seat);
    const afterDraw = v.turn.step === 'draw' || v.turn.phase === 'action' && v.turn.step === 'first-action' && v.turn.firstPlayer === v.seat;
    const emergency = source.tapped && v.turn.step !== 'prepare' || v.turn.step === 'claim-before' && source.district === v.turn.district || v.turn.step === 'contest-before' && v.turn.kind === 'battle' && v.turn.district === source.district && h.lethalBattleRisk(v, source, source.district) || v.flow.stack.some(a => a.controller !== v.seat && a.targetIds?.includes(source.id) && a.responseEffect?.removesTargets);
    const income = attachmentIncome(v, h);
    // Wait through preparation. Strip the fresh draw before the opponent can
    // spend it; when several cards remain, the opponent still chooses the discard.
    if (!(afterDraw && !v.flow.stack.length && discarders.length && enemyCards > 0) && !emergency)
        return null;
    const target = targets.sort((a, b) => blueAttachmentScore(v, { catalogId: 'BQ040' }, b, h) - blueAttachmentScore(v, { catalogId: 'BQ040' }, a, h) || a.id.localeCompare(b.id))[0];
    const denial = afterDraw && discarders.length && enemyCards > 0;
    return { targetId: target.id, score: denial ? 94 + income * 5 + (enemyCards <= discarders.length ? 24 : 8) : 30 + h.value(target) + income * 4 };
}
export function blueMobilityRevealScore(v, c, h) {
    if (!blueBot(v) || c.catalogId !== 'BQ035' || v.turn.phase !== 'action' || v.turn.step !== 'second-action' || v.flow.stack.length)
        return undefined;
    const m = v.players[v.seat], up = h.faceUp(v, c), eligible = own(v).filter(host => host.subtypes?.includes('吸血鬼') && own(v).some(a => a.name === '鲜血' && a.attachedTo === host.id));
    if (up.tapped || !eligible.length)
        return undefined;
    if (v.flow.stepOwner !== v.seat && !v.flow.passed?.includes(1 - v.seat))
        return undefined;
    return 75 + Math.min(3, eligible.length) * 8;
}
export function bluePhoenixContest(v, source, options, h) {
    if (!blueBot(v) || source.catalogId !== 'BQ036' || !options.length)
        return null;
    const m = v.players[v.seat], unused = handCount(v, 1 - v.seat) > 0 ? blueReadyDiscarders(v).length : 0, draw = attachmentIncome(v, h);
    if (m.markers.hidden > 0 && !unused && !draw)
        return null;
    if (resourcePriorities(v, h).critical)
        return null;
    const show = m.hand.filter(c => c.id !== source.id).sort((a, b) => h.hiddenStrength(b, v) - h.hiddenStrength(a, v))[0];
    if (!show || h.hiddenStrength(show, v) + 2 < 6)
        return null;
    // A normal Bot does not inspect unknown enemy cards. Hard mode can compare
    // its legitimately supplied privileged hand, without changing ordinary play.
    const known = v.hardInfo ? v.players[1 - v.seat].hand : [];
    if (known.length && h.hiddenStrength(show, v) + 2 < Math.max(...known.map(c => (c.printedCost ?? 0) + (c.hiddenAbilities ?? []).filter(a => a.kind === 'point-modifier').reduce((n, a) => n + (a.amount ?? 0), 0))))
        return null;
    const payments = options.filter(a => a.id !== source.id).sort((a, b) => h.value(a) - h.value(b) || a.id.localeCompare(b.id));
    if (!payments.length)
        return null;
    const cheap = payments.find(a => a.name === '鲜血') ?? payments[0];
    if (h.value(cheap) > 6 && m.markers.hidden > 0)
        return null;
    return { costCardId: cheap.id, score: 32 + draw * 7 + (unused ? 10 : 0) };
}
