import { nonDrawEffectBlocked } from './bot-draw-lock-planning.mjs';
import { hasCardType } from './card-types.mjs';
import { districtConcession } from './bot-resource-planning.mjs';
import { investigationRelief } from './bot-library-safety.mjs';
import { criminalNeedsRemoval, blackHandBonus } from './bot-dynamic-planning.mjs';
import { rumorTriggerChoices } from './bot-rumor-planning.mjs';
export const criminalBot = v => v.bot?.id === 'black-purple-criminals';
const mine = v => v.players[v.seat], enemy = v => v.players[1 - v.seat];
const own = v => mine(v).play.filter(c => !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed);
const grave = v => [...mine(v).graveyard, ...(mine(v).headquarters ?? [])];
const live = (v, id) => own(v).some(c => c.catalogId === id);
const staged = (v, id) => mine(v).play.some(c => c.catalogId === id);
const big = c => hasCardType(c, 'character') && (c.printedCost ?? 0) >= 5;
const fuel = v => grave(v).filter(big);
const millSources = v => own(v).filter(c => ['BQ091', 'XG28'].includes(c.catalogId));
export function criminalLibraryUse(v, a) {
    if (!criminalBot(v))
        return 0;
    const count = plan => !plan || nonDrawEffectBlocked(v) && plan.effect === 'draw' ? 0 : plan.effect === 'sequence' ? (plan.steps ?? []).reduce((n, p) => n + count(p), 0) : ['draw', 'mill-self-one'].includes(plan.effect) ? plan.count ?? 1 : plan.operation === 'liliel-discard' ? 1 : 0;
    return count(a.plan);
}
export function criminalLibraryBudget(v, h) {
    // Keep upcoming compulsory draws and a small recovery margin. Already
    // queued draws/mills spend the same budget as this window's new triggers.
    const queued = (v.flow?.stack ?? []).filter(a => a.controller === v.seat).reduce((n, a) => n + criminalLibraryUse(v, a), 0);
    return Math.max(0, mine(v).deckCount - Math.max(3, h.drawReserve(v)) - queued);
}
function bidStrength(v, c, h, entry) {
    const bonus = entry ?? v.hidden?.cardBonus;
    return h.hiddenStrength(c, v) + (bonus && (bonus.controller === undefined || bonus.controller === v.seat) && (!bonus.type || hasCardType(c, bonus.type)) && (!bonus.subtypes || bonus.subtypes.some(t => c.subtypes?.includes(t))) && (!bonus.magic || (c.effectiveMagicDomains ?? c.magicDomains)?.includes(bonus.magic)) && (!bonus.colors || bonus.colors.includes(c.faction?.split('·')[0])) && (!bonus.faction || bonus.faction === c.faction?.split('·')[0]) ? bonus.amount ?? bonus.bonus ?? 0 : 0);
}
// YZLARRY3 T5: a nightmare printed at four plus Rigoletto's two was
// worth using. Do not require an unmodified eight for these entry contests.
const strongBid = (v, h, entry, exclude) => mine(v).hand.some(c => c.id !== exclude && bidStrength(v, c, h, entry) >= (entry ? 6 : 8));
const entryBid = (v, h, code, exclude) => strongBid(v, h, { amount: 2, ...(code === 'CQ32' ? { subtypes: ['梦魇'] } : {}) }, exclude);
const recoverable = (v, id) => (v.sealed ?? []).filter(c => c.hostId === id && c.owner === v.seat);
const cacheValue = (v, id, h) => recoverable(v, id).reduce((n, c) => n + Math.min(12, Math.max(2, h.handValue(v, c) * 0.45)) + (c.catalogId === 'WM089' ? 6 : 0), 0);
const graveDream = v => grave(v).some(c => c.subtypes?.includes('梦魇'));
const noRepeat = (v, key) => !v.bot.actionKeys?.includes(key);
const needsDeter = v => v.districts.some(d => d && (d.influence?.[1 - v.seat] ?? 0) >= Math.max(2, (d.threshold ?? 7) - 2));
export function criminalMarketDeterAllowed(v, discard, h) {
    const p = v.seat, q = 1 - p, regions = v.districts.map((r, d) => ({ r, d })).filter(({ r }) => r && (r.influence?.[q] ?? 0) > 0);
    // The opponent chooses which counters to remove. A locked claim cannot
    // be stopped, and postponing an advantageous clear is not a useful trade.
    if (!regions.length || regions.some(({ r, d }) => r.pendingWinner !== null && r.pendingWinner !== undefined || (r.influence[q] ?? 0) >= (r.threshold ?? 99) || districtConcession(v, d, h) > 0))
        return false;
    const urgent = regions.some(({ r, d }) => h.contestPending(v, d, 'influence') && h.total(v, q, d, 'influence') > h.total(v, p, d, 'influence') &&
        (r.influence[q] ?? 0) + h.total(v, q, d, 'influence') - h.total(v, p, d, 'influence') >= (r.threshold ?? 99) &&
        (enemy(v).score ?? 0) + Math.max(0, (r.points ?? 0) - (r.destroyed ?? 0)) >= (enemy(v).victoryThreshold ?? 8));
    if (urgent)
        return true;
    if (mine(v).hand.length <= 3 || !noRepeat(v, `criminal-market-deter:${v.round}`))
        return false;
    const nearClaim = regions.some(({ r }) => r.influence[q] >= Math.max(2, (r.threshold ?? 7) - 2));
    const payload = big(discard) && !fuel(v).length && (staged(v, 'BQ082') || mine(v).hand.some(c => c.catalogId === 'BQ082'));
    return nearClaim && (payload || mine(v).hand.length >= 5);
}
const wantsMarket = v => mine(v).hand.filter(c => c.catalogId === 'WM089').length >= 2 || needsDeter(v) && mine(v).hand.some(c => hasCardType(c, 'character'));
const murderPlans = v => [...(v.flow?.stack ?? []), ...(v.triggerChoices ?? []), ...(v.triggerRound?.abilities ?? [])].flatMap(a => {
    if (a.controller !== v.seat)
        return [];
    if (a.plan?.operation === 'murder')
        return [a];
    const source = [...mine(v).play, ...grave(v)].find(c => c.id === a.cardId);
    return a.event === 'entry' && source?.catalogId === 'CQ31' && a.sourceDistrict !== undefined ? [{ ...a, plan: { operation: 'murder', sourceDistrict: a.sourceDistrict } }] : [];
});
const roles = (v, d) => v.players.flatMap(p => p.play).filter(c => !c.faceDown && hasCardType(c, 'character') && c.district === d);
const minRoles = (v, d, without) => { const cs = roles(v, d).filter(c => c.id !== without), n = Math.min(...cs.map(c => c.printedCost ?? 0)); return cs.filter(c => (c.printedCost ?? 0) === n); };
function killValue(v, c, h) {
    if (c.controller !== v.seat)
        return h.keyword(c, '永恒') ? -4 : h.value(c) * 3 + cacheValue(v, c.id, h);
    const cycle = c.catalogId === 'CQ31' ? (live(v, 'WM060') && (live(v, 'CQ32') || staged(v, 'BQ082')) ? 36 : live(v, 'WM060') || live(v, 'CQ32') || staged(v, 'BQ082') ? 24 : 0) : 0;
    return investigationRelief(v, c, h) - h.value(c) * 3 + cycle + (v.sealed ?? []).filter(x => x.hostId === c.id && x.owner === v.seat).length * 6;
}
const bestKill = (v, cs, h) => cs.length ? Math.max(...cs.map(c => killValue(v, c, h))) : 0;
function murderEntryValue(v, c, d, h) {
    const projected = { ...v, players: v.players.map((p, i) => i === v.seat ? { ...p, play: [...p.play, { ...c, controller: i, district: d }] } : p) }, copies = own(projected).filter(x => x.catalogId === 'CQ31');
    if (copies.length < 2)
        return bestKill(projected, minRoles(projected, d), h);
    // The unique sacrifice happens before the queued entry resolves. Keeping
    // either copy is legal; estimate the best resulting destruction in each
    // possible random destination without knowing which will be chosen.
    return Math.max(...copies.map(keep => { const after = { ...projected, players: projected.players.map((p, i) => i === v.seat ? { ...p, play: p.play.filter(x => x.catalogId !== 'CQ31' || x.id === keep.id) } : p) }; return bestKill(after, minRoles(after, d), h); }));
}
const returnPending = (v, id) => [...(v.flow?.stack ?? []), ...(v.triggerRound?.abilities ?? []), ...(v.triggerChoices ?? [])].some(a => a.controller === v.seat && a.cardId === id && (a.plan?.operation === 'murder-return' || a.kind === 'auto-ability' && a.event === 'contest-won' && grave(v).some(c => c.id === id && c.catalogId === 'CQ31')));
function recoveryChance(v, host, h) {
    if (h.keyword(host, '永恒'))
        return 0;
    if (murderPlans(v).some(a => minRoles(v, a.plan.sourceDistrict).some(c => c.id === host.id)))
        return 1;
    if (mine(v).hand.some(c => c.catalogId === 'JZ55' && h.loyalty(v, c) && (v.castingCosts?.[c.id] ?? h.cost(c)) <= h.pool(v) && (v.spellTargets?.[c.id] ?? []).some(o => o.id === host.id)))
        return 1;
    const damage = h.total(v, v.seat, host.district, 'battle') - h.total(v, 1 - v.seat, host.district, 'battle');
    if (h.contestPending(v, host.district, 'battle') && !host.battleDamagePrevented && damage >= (host.effectiveDefense ?? host.defense ?? 1) - (host.damage ?? 0) && damage > 0)
        return 0.85;
    // Chaos is not known in advance. A pending return only supplies a chance
    // to reach this host's region; never inspect the random destination.
    const returns = grave(v).filter(c => c.catalogId === 'CQ31' && returnPending(v, c.id));
    if (returns.length && (host.printedCost ?? 0) <= 4 && minRoles(v, host.district).some(c => c.id === host.id))
        return 1 / Math.max(1, v.districts.filter(Boolean).length);
    return 0;
}
function captureValue(v, host, h) {
    if (host.controller === v.seat)
        return 0;
    const timely = ['start', 'action'].includes(v.turn.phase) || h.contestPending(v, host.district, 'influence');
    if (!timely)
        return 0;
    const icons = host.tapped ? {} : host.effectiveIcons ?? host.icons ?? {}, eye = icons.investigation ?? 0;
    const swing = h.contestPending(v, host.district, 'investigation') && h.total(v, v.seat, host.district, 'investigation') <= h.total(v, 1 - v.seat, host.district, 'investigation') && h.total(v, v.seat, host.district, 'investigation') + eye > h.total(v, 1 - v.seat, host.district, 'investigation') - eye;
    return h.value(host) * (host.tapped ? 0.65 : 1.6) + eye * 4 + (icons.battle ?? 0) * 1.5 + (swing ? 16 : 0);
}
function payloadValue(v, c, h) {
    const inHand = id => mine(v).hand.some(x => x.catalogId === id);
    if (c.catalogId === 'JZ55')
        return inHand('JZ55') ? 18 : 48;
    if (c.catalogId === 'WM089')
        return inHand('WM089') ? 14 : 42;
    if (c.catalogId === 'BQ082')
        return !staged(v, 'BQ082') && !inHand('BQ082') ? 38 : 8;
    if (c.catalogId === 'WM060')
        return !staged(v, 'WM060') && !inHand('WM060') ? (staged(v, 'BQ082') && entryBid(v, h, 'BQ082') ? -12 : 35) : 4;
    if (c.catalogId === 'CQ32')
        return !staged(v, 'CQ32') && !inHand('CQ32') ? 28 : 5;
    if (['BQ087', 'BQ086'].includes(c.catalogId))
        return live(v, c.catalogId) ? 3 : -18;
    if (c.catalogId === 'CQ31')
        return -40;
    return Math.max(2, Math.min(14, h.handValue(v, c) * 0.5));
}
function rigoPlan(v, h, cards = grave(v), hosts = enemy(v).play.filter(c => !c.faceDown && hasCardType(c, 'character') && !c.barrierNow)) {
    let best = null;
    for (const host of hosts)
        for (const card of cards) {
            const chance = recoveryChance(v, host, h), nightmare = card.subtypes?.includes('梦魇'), capture = nightmare ? captureValue(v, host, h) : 0;
            const cost = card.catalogId === 'CQ31' ? (live(v, 'WM060') && grave(v).filter(c => c.catalogId === 'CQ31').length === 1 ? 20 : 10) : Math.max(0, reviveScore(v, card, h)) * 0.08;
            // Monster is a control payment, not the default card to lock away. Other
            // missing pieces can be cached even without immediate removal in hand.
            const score = card.catalogId === 'CQ31' ? capture - cost - 8 : payloadValue(v, card, h) * (0.45 + chance * 0.55) + capture * 0.6 - cost;
            if (score > 0 && (!best || score > best.score || score === best.score && card.id.localeCompare(best.card.id) < 0))
                best = { host, card, score, beforeMonster: card.catalogId !== 'CQ31' };
        }
    return best;
}
export function criminalOrder(v, abilities, h) {
    if (!criminalBot(v))
        return abilities;
    // Push the destruction first: draw/discard and its induced rumor round
    // resolve above it, so a doomed host can return the discarded rumor.
    // Rigoletto caches another card before the planned kill, or waits below
    // the monster's return/entry when spending that monster to steal a role.
    const rank = a => {
        if (a.plan?.operation === 'rigoletto-seal' && h) {
            const refs = a.targets?.length ? a.targets : v.abilityTargets?.[a.id], hosts = refs?.map(o => h.lookup(v, o.cardId ?? o.id)).filter(Boolean);
            return rigoPlan(v, h, grave(v), hosts)?.beforeMonster ? 3 : -1;
        }
        return a.plan?.operation === 'murder' ? 0 : a.plan?.steps?.some(s => s.effect === 'discard-own') ? 2 : 1;
    };
    return [...abilities].sort((a, b) => rank(a) - rank(b));
}
export function criminalRuleSacrifice(v, a, h) {
    if (!criminalBot(v) || !a.cards.every(c => c.catalogId === 'CQ31'))
        return null;
    const base = { ...v, players: v.players.map(p => ({ ...p, play: p.play.filter(c => !a.cards.some(x => x.id === c.id)) })) };
    const score = c => murderPlans(v).reduce((n, t) => n + bestKill(v, minRoles(v, t.plan.sourceDistrict, c.id), h), 0) + a.cards.filter(x => x.id !== c.id).reduce((n, x) => n + h.districtScore(base, x.district, h.lookup(v, x.id) ?? x), 0);
    return h.sorted(a.cards, score).slice(0, a.count).map(c => c.id);
}
// Hand economy is different from battlefield value: expensive resurrection
// material can be the best discard without being a good asset or sacrifice.
export function criminalHandBonus(v, c) {
    if (!criminalBot(v))
        return 0;
    if (c.catalogId === 'WM060')
        return -35;
    if (c.catalogId === 'WM063' && !live(v, 'WM063'))
        return wantsMarket(v) ? 22 : 0;
    if (c.catalogId === 'BQ086')
        return -25;
    if (c.catalogId === 'BQ087')
        return -11;
    if (c.catalogId === 'BQ082')
        return fuel(v).length ? 16 : 2;
    if (c.catalogId === 'CQ32')
        return graveDream(v) ? 10 : 2;
    if (['BQ091', 'XG28'].includes(c.catalogId))
        return own(v).some(x => ['BQ091', 'XG28'].includes(x.catalogId)) ? 0 : 11;
    if (c.catalogId === 'XQ36' && grave(v).length < 7)
        return 9;
    if (c.catalogId === 'WM089')
        return live(v, 'CQ32') || staged(v, 'BQ082') ? 12 : 3;
    return 0;
}
export function criminalAssetBonus(v, c) {
    if (!criminalBot(v))
        return 0;
    const color = c.faction?.split('·')[0], have = mine(v).loyalty?.factions ?? {};
    // Two black assets unlock Sebastian. Establish the first purple next,
    // rather than locking Rigoletto and Curtain out for another full round.
    let n = (color === '黑' && (have.黑 ?? 0) < 2 ? -60 : color === '紫' && !(have.紫 > 0) ? (have.黑 >= 2 ? -70 : -38) : color === '黑' && (have.黑 ?? 0) < 3 ? -30 : 0);
    if (c.catalogId === 'WM063' && !live(v, 'WM063') && wantsMarket(v))
        n += 60;
    // Extra mills and extra engine copies are useful assets after their first
    // copies are established. Never lock every black card away as future fuel.
    if (['BQ091', 'XG28'].includes(c.catalogId) && millSources(v).length >= 2)
        n -= 22;
    if (big(c) && !['WM060', 'BQ086'].includes(c.catalogId) && !fuel(v).length && mine(v).hand.some(x => x.catalogId === 'BQ082' || x.catalogId === 'WM063' && wantsMarket(v)))
        n += 36;
    if (c.catalogId === 'BQ082' && fuel(v).length && !staged(v, 'BQ082'))
        n += 22;
    if (['BQ091', 'XG28', 'XQ36'].includes(c.catalogId) && !grave(v).length && !own(v).some(x => ['BQ091', 'XG28'].includes(x.catalogId)))
        n += 23;
    return n;
}
export function criminalPreferHidden(v, c) { return criminalBot(v) && !c.publicNow && ['WM060', 'BQ082', 'CQ32'].includes(c.catalogId); }
export function criminalDistrictBonus(v, d, c) {
    if (!criminalBot(v) || !c.faceDown || !['WM060', 'BQ082', 'CQ32'].includes(c.catalogId) || v.round > 3 || mine(v).play.some(x => x.id === c.id))
        return 0;
    const region = v.districts[d];
    if (!region)
        return 0;
    const stars = p => v.players[p].play.filter(x => x.district === d && !x.tapped && !x.nonBattleParticipationBlocked).reduce((n, x) => n + (x.effectiveIcons?.influence ?? (x.faceDown ? 1 : (x.icons?.influence ?? 0) + (v.turn.firstPlayer === p ? x.temporaryIcons?.influence ?? 0 : 0))), 0);
    const rounds = Math.max(1, (v.revealCosts?.[c.id] ?? c.printedCost ?? 0) - mine(v).assets.length), delta = stars(v.seat) + 1 - stars(1 - v.seat), influence = region.influence ?? [0, 0];
    // A hidden engine returned to the deck by an early claim never produces
    // its entry payoff. Prefer a region likely to remain contested until ready.
    return delta > 0 && influence[v.seat] + delta * rounds - influence[1 - v.seat] >= region.threshold || delta < 0 && influence[1 - v.seat] - delta * rounds - influence[v.seat] >= region.threshold ? -30 : 0;
}
export function criminalDeployAllowed(v, c) {
    if (!criminalBot(v))
        return true;
    if (['WM060', 'BQ086'].includes(c.catalogId) && (staged(v, 'BQ082') || mine(v).hand.some(x => x.catalogId === 'BQ082')))
        return false;
    if (['WM060', 'BQ082', 'CQ32'].includes(c.catalogId) && mine(v).play.some(x => x.catalogId === c.catalogId && x.faceDown))
        return false;
    // These are primarily resurrection payloads. Do not spend the first few
    // turns filling districts with several six/seven-cost hidden cards.
    if (['BQ087', 'BQ086'].includes(c.catalogId) && (mine(v).costPool ?? 0) + mine(v).assets.filter(a => !a.tapped).length < (v.castingCosts?.[c.id] ?? c.printedCost))
        return false;
    return true;
}
export function criminalReserve(v) {
    if (!criminalBot(v) || !['start', 'action', 'contest'].includes(v.turn.phase))
        return 0;
    const seb = mine(v).play.find(c => c.faceDown && c.catalogId === 'BQ082' && !c.paidRevealBlocked), bid = mine(v).hand.some(c => (c.printedCost ?? 0) + (c.hiddenAbilities ?? []).filter(a => a.kind === 'point-modifier').reduce((n, a) => n + (a.amount ?? 0), 0) + 2 >= 6);
    if (seb && fuel(v).length && bid) {
        const price = v.revealCosts?.[seb.id] ?? seb.printedCost ?? 0;
        if (price <= mine(v).assets.length + Number(!mine(v).actionsUsed.asset && mine(v).hand.some(c => !c.nonAssetNow)))
            return Math.min(price, (mine(v).costPool ?? 0) + mine(v).assets.filter(a => !a.tapped).length);
    }
    const d = mine(v).play.find(c => c.faceDown && c.catalogId === 'WM060' && !c.paidRevealBlocked);
    const price = d ? (v.revealCosts?.[d.id] ?? 5) : 0;
    const nextAsset = !mine(v).actionsUsed.asset && mine(v).hand.some(c => !c.nonAssetNow) ? 1 : 0;
    // The fifth asset is free to establish during our action step. Do not
    // spend two of the four existing assets just before that reveal turn.
    return d && !live(v, 'WM060') && v.round >= 3 && mine(v).assets.length + nextAsset >= price ? Math.min(price, mine(v).assets.length) : 0;
}
// A staged resurrection needs both its reveal mana and a card to display.
// Spending the last usable display card can silently cancel the entire line.
export function criminalCommitmentPenalty(v, command, h) {
    if (!criminalBot(v) || !['start', 'action'].includes(v.turn.phase) || !fuel(v).length)
        return 0;
    const source = mine(v).play.find(c => c.faceDown && c.catalogId === 'BQ082' && !c.paidRevealBlocked);
    if (!source || h.pool(v) < (v.revealCosts?.[source.id] ?? source.printedCost ?? 4))
        return 0;
    const removed = new Set([...(command.discardIds ?? []), ...(['play', 'secret-deploy', 'build-asset'].includes(command.type) ? [command.cardId] : [])]);
    if (!removed.size)
        return 0;
    const bids = mine(v).hand.filter(c => bidStrength(v, c, h, { amount: 2 }) >= 6);
    if (!bids.length || bids.some(c => !removed.has(c.id)))
        return 0;
    // Keep emergency responses and decisive scoring available when their
    // evaluated benefit outweighs preserving the resurrection engine.
    return 100;
}
export function criminalMulligan(v, h) {
    if (!criminalBot(v))
        return null;
    const hand = mine(v).hand, keep = new Set();
    for (const id of [...(wantsMarket(v) ? ['WM063'] : []), 'BQ091', 'XQ36']) {
        const c = hand.find(c => c.catalogId === id);
        if (c)
            keep.add(c.id);
    }
    if (!hand.some(c => ['BQ091', 'XQ36'].includes(c.catalogId))) {
        const mill = hand.find(c => c.catalogId === 'XG28');
        if (mill)
            keep.add(mill.id);
    }
    for (const color of ['黑', '紫']) {
        const c = h.sorted(hand.filter(c => !c.nonAssetNow && !keep.has(c.id) && c.faction?.startsWith(color)), c => h.handValue(v, c), false)[0];
        if (c)
            keep.add(c.id);
    }
    const seb = hand.find(c => c.catalogId === 'BQ082');
    if (seb && hand.some(big))
        keep.add(seb.id);
    return [{ type: 'mulligan', cardIds: hand.filter(c => !keep.has(c.id)).map(c => c.id) }];
}
function discardScore(v, c, h) {
    let n = -h.handValue(v, c);
    if (c.catalogId === 'BQ087' && !live(v, 'BQ087') && !grave(v).some(x => x.catalogId === 'BQ087'))
        n += 70;
    if (c.catalogId === 'BQ086' && !grave(v).some(x => x.catalogId === 'BQ086'))
        n += 48;
    if (c.catalogId === 'WM060' && !live(v, 'WM060') && (staged(v, 'BQ082') || mine(v).hand.some(x => x.catalogId === 'BQ082')) && !grave(v).some(x => x.catalogId === 'WM060'))
        n += 120;
    if (c.catalogId === 'CQ31')
        n += grave(v).some(x => x.catalogId === 'CQ31') ? 8 : 30;
    if (c.catalogId === 'WM089')
        n += murderPlans(v).length ? 85 : strongBid(v, h) && mine(v).hand.filter(x => x.catalogId === 'WM089').length > 1 ? 34 : live(v, 'CQ32') || staged(v, 'BQ082') ? -28 : 14;
    if (['BQ091', 'XG28'].includes(c.catalogId) && own(v).some(x => ['BQ091', 'XG28'].includes(x.catalogId)))
        n += 8;
    return n;
}
function reviveScore(v, c, h) {
    let n = h.value(c);
    if (c.catalogId === 'WM060')
        n += live(v, 'WM060') ? -35 : mine(v).hand.length <= 4 ? 110 : 65;
    if (c.catalogId === 'BQ087')
        n += live(v, c.catalogId) ? -35 : 65;
    if (c.catalogId === 'WM060' && !live(v, 'WM060') && [...grave(v), ...mine(v).hand, ...own(v)].some(x => x.catalogId === 'CQ31'))
        n += 40;
    if (c.catalogId === 'BQ086')
        n += live(v, 'BQ086') ? -20 : criminalNeedsRemoval(v) ? 190 : 30;
    if (c.catalogId === 'BQ082')
        n += fuel(v).some(x => x.id !== c.id) && entryBid(v, h, 'BQ082') ? 30 : -22;
    if (c.catalogId === 'CQ32')
        n += enemy(v).play.some(x => !x.faceDown) && graveDream(v) && entryBid(v, h, 'CQ32') ? 24 : 0;
    return n;
}
export function criminalReveal(v, c, h) {
    if (!criminalBot(v))
        return undefined;
    if (!['WM060', 'BQ082', 'CQ32', 'BQ087', 'BQ086'].includes(c.catalogId))
        return undefined;
    if (c.tapped || h.lethalBattleRisk(v, h.faceUp(v, c), c.district))
        return null;
    if (c.catalogId === 'BQ082') {
        if (v.turn.phase === 'action' && v.turn.firstPlayer === v.seat && !v.flow.stack.some(a => a.controller !== v.seat && a.targetIds?.includes(c.id)))
            return null;
        return fuel(v).length && entryBid(v, h, 'BQ082') ? 100 : null;
    }
    if (c.catalogId === 'CQ32')
        return entryBid(v, h, 'CQ32') && (grave(v).some(x => x.catalogId === 'CQ31') || rigoPlan(v, h)) ? 82 : null;
    if (c.catalogId === 'WM060') {
        if (v.turn.phase === 'end')
            return 85;
        if (v.turn.firstPlayer === v.seat && h.contestPending(v, c.district, 'investigation'))
            return 92;
        if (mine(v).hand.some(x => x.id !== c.id && x.subtypes?.includes('罪犯') && (v.castingCosts?.[x.id] ?? h.cost(x)) <= h.pool(v) - (v.revealCosts?.[c.id] ?? h.cost(c))))
            return 75;
        return null;
    }
    return v.turn.phase === 'end' || !h.lethalBattleRisk(v, h.faceUp(v, c), c.district) ? 70 : null;
}
export function criminalHiddenScore(v, c, h) {
    if (!criminalBot(v))
        return undefined;
    const value = bidStrength(v, c, h), payoff = live(v, 'CQ32') && graveDream(v) || grave(v).some(c => c.catalogId === 'CQ31') || v.hidden?.cardBonus?.controller === v.seat;
    return value * (payoff ? 5 : 2.5) - h.handValue(v, c) * 0.5;
}
export function criminalTrigger(v, a, h) {
    if (!criminalBot(v))
        return null;
    const base = { type: 'trigger-choice', triggerId: a.id }, plan = a.plan ?? {}, opts = v.abilityTargets?.[a.id] ?? [];
    if (!a.mandatory && criminalLibraryUse(v, a) > criminalLibraryBudget(v, h))
        return [{ ...base, fire: false }];
    if (plan.target === 'sadikin-pair') {
        const corpse = opts.find(o => grave(v).some(c => c.id === o.id)), research = h.sorted(opts.filter(o => own(v).some(c => c.id === o.id)), o => h.value(h.lookup(v, o.id) ?? o))[0];
        return corpse && research ? [{ ...base, fire: true, targetIds: [corpse.id, research.id] }, { ...base, fire: false }] : [{ ...base, fire: false }];
    }
    if (a.effect?.kind === 'seal-from-graveyard') {
        const source = h.lookup(v, a.cardId);
        const doomed = murderPlans(v).flatMap(t => minRoles(v, t.plan.sourceDistrict)).filter(c => !h.keyword(c, '永恒') && (c.controller === v.seat || !c.barrierNow));
        if (!doomed.length && (source?.catalogId === 'BQ087' && !live(v, 'BQ087') || source?.catalogId === 'CQ32' && live(v, 'CQ32') && !grave(v).some(c => c.id !== source.id && c.subtypes?.includes('梦魇'))))
            return [{ ...base, fire: false }];
        // T7 of the replay stores rumors on Shrouder, then clears it with Curtain.
        // Only plan this immediate recovery when the removal is actually in hand,
        // affordable and already offers that enemy as a legal target.
        const recover = enemy(v).play.filter(c => !c.faceDown && hasCardType(c, 'character') && !c.barrierNow && !h.keyword(c, '永恒') && mine(v).hand.some(spell => spell.catalogId === 'JZ55' && h.loyalty(v, spell) && (v.castingCosts?.[spell.id] ?? h.cost(spell)) <= h.pool(v) && (v.spellTargets?.[spell.id] ?? []).some(o => o.id === c.id)));
        const cycler = own(v).find(c => c.catalogId === 'CQ31' && !h.keyword(c, '永恒'));
        return rumorTriggerChoices(v, a, h, c => (doomed.some(x => x.id === c.id) ? 28 + Math.max(0, Math.min(10, killValue(v, c, h) * 0.1)) : 0) +
            (recover.some(x => x.id === c.id) ? 26 + Math.min(5, cacheValue(v, c.id, h)) : 0) +
            (c.id === cycler?.id && live(v, 'WM060') && (live(v, 'CQ32') || staged(v, 'BQ082')) ? 22 : 0));
    }
    if (plan.hiddenAfter === 'sebastian')
        return entryBid(v, h, 'BQ082') ? h.sorted(opts, o => reviveScore(v, h.lookup(v, o.id) ?? o, h)).map(o => ({ ...base, fire: true, targetIds: [o.id] })).concat({ ...base, fire: false }) : [{ ...base, fire: false }];
    if (plan.operation === 'hidden-start' && h.lookup(v, a.cardId)?.catalogId === 'CQ32' && !entryBid(v, h, 'CQ32'))
        return [{ ...base, fire: false }];
    if (plan.operation === 'rigoletto-seal') {
        const hosts = opts.map(o => h.lookup(v, o.id)).filter(Boolean), plan = rigoPlan(v, h, grave(v), hosts);
        return plan ? [{ ...base, fire: true, targetIds: [plan.host.id] }, { ...base, fire: false }] : [{ ...base, fire: false }];
    }
    // The hand is the next deployment resource; leaving a seven-cost revival
    // payload in the grave is often better than retrieving it just for value.
    if (plan.effect === 'grave-to-hand')
        return h.sorted(opts, o => retrieveScore(v, h.lookup(v, o.id) ?? o, h)).map(o => ({ ...base, fire: true, targetIds: [o.id] })).concat({ ...base, fire: false });
    if (plan.effect === 'grave-random-enter')
        return h.sorted(opts, o => reviveScore(v, h.lookup(v, o.id) ?? o, h)).map(o => ({ ...base, fire: true, targetIds: [o.id] })).concat({ ...base, fire: false });
    return null;
}
export function criminalChoice(v, a, h) {
    if (!criminalBot(v))
        return null;
    const base = { type: 'effect-choice', choiceId: a.id }, cards = a.cards ?? [];
    if (a.kind === 'reality-liliel-discard' && a.canSkip && criminalLibraryBudget(v, h) < 1)
        return [{ ...base, skip: true }];
    if (a.kind === 'criminal-murder')
        return h.sorted(cards, c => killValue(v, c, h)).map(c => ({ ...base, cardId: c.id }));
    if (a.kind === 'discard-deck-rigoletto') {
        const host = h.lookup(v, a.rigolettoHostId), plan = rigoPlan(v, h, cards, host ? [host] : undefined);
        // If a target changed or an earlier effect consumed the desired payload,
        // reassess the remaining public graveyard without preempting a live return.
        return h.sorted(cards, c => (c.id === plan?.card.id ? 200 : payloadValue(v, c, h)) - (returnPending(v, c.id) ? 300 : 0)).map(c => ({ ...base, cardId: c.id }));
    }
    if (a.kind === 'death-deck-upkeep')
        return [{ ...base, cardIds: h.sorted(cards, c => reviveScore(v, c, h), false).slice(0, a.count ?? 1).map(c => c.id) }];
    if (a.kind === 'discard' || a.kind?.endsWith('-discard'))
        return h.sorted(cards, c => discardScore(v, c, h)).map(c => ({ ...base, cardId: c.id })).concat(a.canSkip ? [{ ...base, skip: true }] : []);
    return null;
}
function retrieveScore(v, c, h) {
    let n = h.handValue(v, c);
    if (['BQ087', 'BQ086'].includes(c.catalogId))
        n -= 45;
    if (c.catalogId === 'BQ082' && fuel(v).length && entryBid(v, h, 'BQ082'))
        n += 35;
    if (c.catalogId === 'CQ32' && graveDream(v) && entryBid(v, h, 'CQ32'))
        n += 25;
    if (c.catalogId === 'WM060')
        n += staged(v, 'WM060') ? -45 : mine(v).assets.length >= 5 ? 20 : -45;
    if (c.catalogId === 'XQ36' && grave(v).length < 7)
        n += 15;
    return n;
}
export function criminalTactics(v, h, add) {
    if (!criminalBot(v))
        return;
    const p = v.seat, available = h.pool(v), standard = v.turn.standardAllowed && v.flow.stepOwner === p && !v.flow.stack.length;
    const carmenTarget = enemy(v).play.some(x => !x.faceDown && hasCardType(x, 'attachment') && (x.printedCost ?? 0) <= 3);
    if (carmenTarget)
        for (const c of mine(v).play.filter(c => c.faceDown && c.catalogId === 'CQ24' && !c.paidRevealBlocked && h.loyalty(v, c) && (v.revealCosts?.[c.id] ?? h.cost(c)) + 3 <= available))
            if (!h.lethalBattleRisk(v, h.faceUp(v, c), c.district))
                add({ type: 'reveal', cardId: c.id, payOptionalExtra: true }, 140);
    if (standard) {
        for (const c of mine(v).hand) {
            if (c.castAllowed === false || !h.loyalty(v, c) || h.duplicate(v, c))
                continue;
            const plan = c.spell ?? c.attachment, price = v.castingCosts?.[c.id] ?? h.cost(c);
            if (plan && price <= available) {
                if (c.catalogId === 'WM063' && !live(v, 'WM063') && wantsMarket(v) && available - criminalReserve(v) >= price)
                    add({ type: 'play', cardId: c.id, targetIds: [`society:${p}`] }, 49);
                if (['BQ091', 'XG28'].includes(c.catalogId) && mine(v).deckCount > h.drawReserve(v) + millSources(v).length + 1 && available - criminalReserve(v) >= price)
                    for (const o of v.spellTargets?.[c.id] ?? []) {
                        const d = Number(o.id.slice(9)), count = millSources(v).length;
                        // Establish the graveyard before spending the only first-turn mana on a
                        // hidden five-cost engine. Spread the asylum's future eyes among regions.
                        const projected = c.catalogId === 'BQ091' ? { ...c, effectiveIcons: { investigation: 1, battle: 0, influence: 0 } } : c;
                        add({ type: 'play', cardId: c.id, targetIds: [o.id] }, (count === 0 ? 62 : count === 1 ? 45 : 18) + blackHandBonus(v, c) + h.districtScore(v, d, projected) - millSources(v).filter(x => x.district === d && x.catalogId === 'BQ091').length * 5);
                    }
            }
        }
        for (const c of mine(v).hand.filter(c => c.catalogId === 'BQ082' && c.castAllowed !== false && h.loyalty(v, c))) {
            if (v.turn.firstPlayer === p)
                continue;
            const price = v.castingCosts?.[c.id] ?? h.cost(c);
            if (price <= available && fuel(v).length && entryBid(v, h, 'BQ082', c.id))
                for (const d of h.districts(v, h.faceUp(v, c)))
                    if (!h.lethalBattleRisk(v, h.faceUp(v, c), d))
                        add({ type: 'play', cardId: c.id, district: d }, 76 + h.districtScore(v, d, h.faceUp(v, c)));
        }
        for (const c of mine(v).hand.filter(c => c.catalogId === 'XQ36' && c.castAllowed !== false && h.loyalty(v, c))) {
            const price = v.castingCosts?.[c.id] ?? h.cost(c);
            if (grave(v).length < 7 && mine(v).deckCount > h.drawReserve(v) + 4 && price <= available - criminalReserve(v))
                for (const d of h.districts(v, h.faceUp(v, c)))
                    if (!h.lethalBattleRisk(v, h.faceUp(v, c), d))
                        add({ type: 'play', cardId: c.id, district: d }, 57 + h.districtScore(v, d, h.faceUp(v, c)));
        }
        for (const c of mine(v).hand.filter(c => c.catalogId === 'CQ24' && c.castAllowed !== false && h.loyalty(v, c))) {
            if (!carmenTarget || (v.castingCosts?.[c.id] ?? h.cost(c)) + 3 > available)
                continue;
            for (const d of h.districts(v, h.faceUp(v, c)))
                if (!h.lethalBattleRisk(v, h.faceUp(v, c), d))
                    add({ type: 'play', cardId: c.id, district: d, payOptionalExtra: true }, 130 + h.districtScore(v, d, c));
        }
        // Chaos randomizes the destination. Evaluate all public districts rather
        // than assuming the requested district will be used.
        for (const c of mine(v).hand.filter(c => c.catalogId === 'CQ31' && c.castAllowed !== false && h.loyalty(v, c))) {
            const price = v.castingCosts?.[c.id] ?? h.cost(c), ds = h.districts(v, c), gain = ds.reduce((n, d) => n + murderEntryValue(v, c, d, h), 0) / Math.max(1, ds.length);
            if (price <= available && gain + (live(v, 'WM060') ? 18 : 0) > 3)
                add({ type: 'play', cardId: c.id, district: ds[0] }, 55 + gain + (live(v, 'WM060') ? 20 : 0));
        }
        const society = v.societies?.[p], action = society?.actions?.find(a => a.id === 'draw-conceal');
        if (action && !society.tapped && !action.used && available >= action.cost && mine(v).deckCount > h.drawReserve(v)) {
            const discard = h.sorted(mine(v).hand, c => discardScore(v, c, h))[0], criminal = h.sorted(own(v).filter(c => hasCardType(c, 'character') && c.subtypes?.includes('罪犯') && !c.tapped && !c.cannotTap), c => h.value(c) - (c.catalogId === 'BQ082' && fuel(v).length ? 20 : 0), false)[0];
            if (discard && criminal && (big(discard) || discard.catalogId === 'CQ31' || v.turn.firstPlayer !== p || h.lethalBattleRisk(v, criminal, criminal.district)))
                add({ type: 'society-action', abilityId: action.id, discardIds: [discard.id], tapIds: [criminal.id], targetIds: [] }, 45 + Math.max(0, discardScore(v, discard, h)));
        }
        for (const c of own(v))
            for (const [i, a] of (c.availableActions ?? []).entries()) {
                if (a.used || a.tap && (c.tapped || c.cannotTap) || available < (a.cost ?? 0))
                    continue;
                const base = { type: 'activate', cardId: c.id, actionIndex: i, targetIds: [] };
                if (c.catalogId === 'WM063') {
                    const candidates = mine(v).hand.filter(x => hasCardType(x, a.discardFilter?.type ?? 'character')), discard = h.sorted(candidates, x => discardScore(v, x, h))[0];
                    if (!discard)
                        continue;
                    if (i === 0 && mine(v).deckCount > h.drawReserve(v) && (discard.catalogId !== 'WM089' || mine(v).hand.filter(x => x.catalogId === 'WM089').length > 1 || !staged(v, 'BQ082') && !live(v, 'CQ32')) && available - criminalReserve(v) >= 2)
                        add({ ...base, discardIds: [discard.id] }, 28 + Math.max(0, discardScore(v, discard, h)));
                    if (i === 1 && criminalMarketDeterAllowed(v, discard, h) && available - criminalReserve(v) >= 1)
                        add({ ...base, discardIds: [discard.id] }, 35 + Math.max(0, discardScore(v, discard, h)), `criminal-market-deter:${v.round}`);
                    if (i === 2)
                        for (const o of v.abilityTargets?.[`${c.id}:${i}`] ?? []) {
                            const host = h.lookup(v, o.id);
                            if (host?.controller === p && !host.faceDown && h.contestPending(v, host.district, 'battle') && h.total(v, 1 - p, host.district, 'battle') >= h.total(v, p, host.district, 'battle') && available - criminalReserve(v) >= 1)
                                add({ ...base, discardIds: [discard.id], targetIds: [o.id] }, 20 + h.value(host));
                        }
                }
                if (c.catalogId === 'XG28' && available - criminalReserve(v) >= 2 && mine(v).hand.length < 7) {
                    const key = `criminal-retrieve:${v.round}:${v.turn.priorityStepKey}:${c.id}`;
                    const immediateBody = mine(v).hand.some(x => hasCardType(x, 'character') && !criminalPreferHidden(v, x) && h.loyalty(v, x) && !h.duplicate(v, x) && (v.castingCosts?.[x.id] ?? h.cost(x)) <= available && h.districts(v, h.faceUp(v, x)).some(d => !h.lethalBattleRisk(v, h.faceUp(v, x), d) && h.districtScore(v, d, h.faceUp(v, x)) >= 8));
                    if (noRepeat(v, key))
                        for (const o of v.abilityTargets?.[`${c.id}:${i}`] ?? []) {
                            const target = h.lookup(v, o.id), score = retrieveScore(v, target, h);
                            if (!target)
                                continue;
                            const castAfter = h.loyalty(v, target) && !h.duplicate(v, target) && (v.castingCosts?.[target.id] ?? h.cost(target)) <= available - 2;
                            // Do not spend the turn's deployment budget retrieving a role that
                            // cannot be used while an investigation body is already in hand.
                            if (immediateBody && !castAfter)
                                continue;
                            if (score > 0 && (!big(target) || castAfter || fuel(v).length > 1))
                                add({ ...base, targetIds: [o.id] }, 15 + score, key);
                        }
                }
            }
    }
    for (const c of mine(v).hand)
        if (c.catalogId === 'JZ55' && h.loyalty(v, c) && (v.castingCosts?.[c.id] ?? h.cost(c)) <= available - criminalReserve(v))
            for (const o of v.spellTargets?.[c.id] ?? []) {
                const enemy = h.lookup(v, o.id), cache = cacheValue(v, o.id, h);
                if (enemy?.controller === 1 - p && !h.targetedByUs(v, o.id) && !h.keyword(enemy, '永恒') && (cache > 0 || h.value(enemy) >= 7 || v.turn.step === 'contest-before' && enemy.district === v.turn.district))
                    add({ type: 'play', cardId: c.id, targetIds: [o.id] }, 34 + h.value(enemy) + cache);
            }
}
