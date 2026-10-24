import { nonDrawEffectBlocked } from './bot-draw-lock-planning.mjs';
import { hasCardType } from './card-types.mjs';
import { rumorHostAssessment } from './bot-rumor-planning.mjs';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const field = v => v.players.flatMap(p => p.play).filter(c => !c.faceDown);
const enabled = c => !c.printedTextBlank && !c.abilitiesSuppressed;
const keyword = (c, k, h) => h.keyword?.(c, k) ?? c.keywordStates?.find(s => s.keyword === k)?.present ?? c.keywords?.includes(k) ?? false;
const value = (c, h) => h.value?.(c) ?? (c.printedCost ?? 0) + 2;
const hidden = (c) => Math.max(0, c.printedCost ?? 0) + (c.hiddenAbilities ?? []).filter(a => a.kind === 'point-modifier' && !a.condition).reduce((n, a) => n + (a.amount ?? 0), 0);
const ownHost = (v, host) => host?.controller === v.seat && (hasCardType(host, 'character') || hasCardType(host, 'attachment'));
const returnsToDeck = c => !!c.automation?.reincarnates || c.keywords?.includes('转生');
const purple = v => (v.players[v.seat].loyalty?.factions?.紫 ?? 0) > 0;
function condition(v, plan, host) {
    if (plan.hostOwnRoleOrAttachment && !ownHost(v, host))
        return false;
    if (!plan.condition)
        return true;
    if (plan.condition === 'purple-assets')
        return purple(v);
    if (plan.condition === 'sealed-to-character')
        return hasCardType(host ?? {}, 'character');
    return false;
}
// A card taken from the library is not already in hand. Discount its future
// return by timing and control, separately from any immediate seal triggers.
export function delayedSealValue(v, card, host, h = {}) {
    if (!host || returnsToDeck(card) || card.owner !== undefined && card.owner !== v.seat)
        return { utility: 0, recovery: 0 };
    const society = host.id?.startsWith('society:');
    const a = society ? { recovery: 0, failureRisk: 0, reason: 'society' } : rumorHostAssessment(v, host, h);
    if (h.sealCommitted)
        a.failureRisk = 0;
    const returnsElsewhere = host.automation?.releaseEnemySealsToDeck && host.controller !== v.seat;
    const discount = (returnsElsewhere ? 0 : society ? 0.04 : clamp(0.22 + a.recovery * 0.7, 0.05, 0.92)) * (1 - a.failureRisk);
    const own = v.players[v.seat], funds = (own.costPool ?? 0) + (own.assets ?? []).filter(x => !x.tapped).length;
    const duplicate = card.unique && [...own.hand, ...own.play].some(x => x.id !== card.id && x.catalogId === card.catalogId);
    const delay = Math.max(0, (card.printedCost ?? 0) - Math.max(funds, own.assets?.length ?? 0, v.societies?.[v.seat]?.counters?.revival ?? 0));
    const handWorth = clamp(8 + (h.handValue?.(v, card) ?? value(card, h)) * 0.15, 5, 14) * (duplicate ? 0.35 : 1) / (1 + delay * 0.12);
    // Casting from the sealed zone supplies an accessible card, even when the
    // host is likely to remain in play. It does not need to be recovered first.
    const domains = { 心: '心灵', 圣: '神圣', 星: '星辰', 死: '死亡', 血: '鲜血' };
    const legal = h.loyalty ? h.loyalty(v, card) : Object.entries(card.loyalty ?? {}).every(([k, n]) => own.ignoreLoyalty || k === '紫' && v.societies?.[v.seat]?.plan?.ignorePurpleLoyalty || (domains[k] ? own.loyalty?.domains?.[domains[k]] : own.loyalty?.factions?.[k]) >= n);
    const native = card.automation ?? {}, ownSociety = host.id === `society:${v.seat}`;
    const allowedHost = (!native.castSealedOwnSociety || ownSociety) && (!native.sealedRoleAttachmentSociety || ownSociety || hasCardType(host, 'character') || hasCardType(host, 'attachment'));
    const castable = enabled(card) && native.castWhileSealed && allowedHost && legal && !duplicate;
    const access = castable ? Math.max(0, 1 - Math.max(0, (card.printedCost ?? 0) - funds) * 0.2) : 0;
    return { utility: handWorth * discount + access * (18 * (1 - a.failureRisk) - handWorth * discount), recovery: discount, accessible: access, reason: a.reason, failureRisk: a.failureRisk };
}
export function sealPayloadAssessment(v, card, host, h = {}, ordinal = 0) {
    const p = v.seat, delayed = delayedSealValue(v, card, host, h);
    let draws = 0, tokens = 0, influence = 0, control = 0;
    function effect(plan, source, index) {
        if (!plan || !condition(v, plan, host))
            return;
        if (plan.effect === 'sequence') {
            for (const step of plan.steps ?? [])
                effect(step, source);
            return;
        }
        if (plan.effect === 'draw' && !nonDrawEffectBlocked(v) || plan.effect === 'bottom-to-hand')
            draws += plan.count ?? 1;
        if (plan.effect === 'spawn-token') {
            const n = plan.count ?? 1;
            tokens += n;
            // Nightmare tokens are Spirit characters: each entry is a separate
            // Whale event, in addition to the original card's sealing event.
            if (plan.catalogId === 'TK005')
                for (const watcher of field(v)) {
                    if (watcher.controller !== p || !enabled(watcher) || watcher.id === card.id)
                        continue;
                    for (const entry of watcher.automation?.watch ?? []) {
                        if (entry.event !== 'entry' || entry.filter?.type && entry.filter.type !== 'character' || entry.subjectKeyword && entry.subjectKeyword !== '灵体' || entry.condition)
                            continue;
                        if (entry.effect === 'bottom-to-hand' || entry.effect === 'draw' && !nonDrawEffectBlocked(v))
                            draws += n * (entry.count ?? 1);
                    }
                }
        }
        if (plan.operation === 'source-district-influence') {
            const used = source.triggerUseCounts?.[index] ?? 0;
            if (!plan.oncePerRound || used + ordinal < plan.oncePerRound)
                influence++;
        }
        if (plan.operation === 'calamity-blank' && purple(v) && hasCardType(host ?? {}, 'character') && host.controller !== p) {
            const liveIcons = Object.values(host.effectiveIcons ?? host.icons ?? {}).some(n => n > 0);
            if (!host.printedTextBlank || liveIcons)
                control += 8 + value(host, h);
        }
    }
    if (enabled(card))
        effect(card.automation?.sealed, card);
    for (const source of field(v)) {
        if (source.controller !== p || !enabled(source))
            continue;
        for (const [index, plan] of (source.automation?.watch ?? []).entries()) {
            if (plan.event !== 'sealed' || plan.otherOnly && source.id === card.id || plan.hostSource && host?.id !== source.id)
                continue;
            if (plan.filter?.type && !hasCardType(card, plan.filter.type) || plan.subjectKeyword && !keyword(card, plan.subjectKeyword, h))
                continue;
            effect(plan, source, index);
        }
    }
    const deck = v.players[p].deckCount ?? 0, reserve = h.drawReserve?.(v) ?? 2;
    const room = Math.max(0, (v.players[p].handLimit ?? 7) - v.players[p].hand.length - (h.sealDrawsAlready ?? 0));
    const libraryCost = returnsToDeck(card) ? 0 : 1;
    const spent = h.sealedLibrarySpent ?? ordinal;
    const safeDraws = Math.min(draws, Math.max(0, deck - reserve - libraryCost - spent));
    const drawValue = Math.min(room, safeDraws) * 9 + Math.max(0, safeDraws - room) * 3;
    // Unused top-seven cards go to the bottom, not to the graveyard. Only the
    // sealed cards and actual draws consume the library; optional draws can stop.
    const exhaustion = libraryCost && deck <= reserve + libraryCost + spent ? 18 : 0;
    const region = v.districts?.[host?.district], ours = region?.influence?.[p] ?? 0, enemy = region?.influence?.[1 - p] ?? 0;
    const finishing = influence && region && ours - enemy + influence + ordinal >= (region.threshold ?? Infinity) ? 12 : 0;
    const survival = 1 - (delayed.failureRisk ?? 0);
    return { utility: delayed.utility + survival * (drawValue + tokens * 10 + influence * 9 + finishing + control) - exhaustion,
        delayed: delayed.utility, recovery: delayed.recovery, draws: safeDraws, drawValue, tokens, influence, control, libraryCost };
}
export function rankSealPayloads(v, cards, host, h = {}, count = 2) {
    const left = [...cards], selected = [];
    let draws = 0, spent = 0, blanked = false;
    for (let ordinal = 0; ordinal < count && left.length; ordinal++) {
        const players = v.players.map((p, i) => i === v.seat ? { ...p, deckCount: p.deckCount - draws } : p), sv = { ...v, players };
        const ranked = left.map(card => {
            const result = sealPayloadAssessment(sv, card, host, { ...h, sealedLibrarySpent: spent, sealDrawsAlready: draws }, ordinal);
            if (blanked && result.control > 0)
                result.utility -= result.control;
            return { card, ...result };
        }).sort((a, b) => b.utility - a.utility);
        const best = ranked[0];
        selected.push(best);
        draws += best.draws;
        spent += best.libraryCost;
        blanked ||= best.control > 0;
        left.splice(left.findIndex(c => c.id === best.card.id), 1);
    }
    return selected;
}
export function giftAssessment(v, card, h = {}, hostOverride) {
    if (card?.spell?.operation !== 'hidden-gift')
        return null;
    const p = v.seat, own = v.players[p], foe = v.players[1 - p];
    const candidates = own.hand.filter(c => c.id !== card.id), ours = Math.max(-1, ...candidates.map(c => hidden(c) + ((c.effectiveMagicDomains ?? c.magicDomains ?? []).includes('星辰') ? 3 : 0)));
    const theirs = v.hardInfo ? Math.max(-1, ...foe.hand.map(hidden)) : 5;
    const win = !candidates.length ? 0 : !foe.handCount && !foe.hand.length ? 1 : clamp(0.5 + (ours - theirs) * 0.14 + (v.turn.firstPlayer === p ? 0.06 : -0.06), 0.05, 0.95);
    const price = h.giftCost ?? v.castingCosts?.[card.id] ?? card.printedCost ?? 0;
    const funds = (own.costPool ?? 0) + (own.assets ?? []).filter(a => !a.tapped).length;
    const after = { ...v, players: v.players.map((x, i) => i === p ? { ...x, costPool: Math.max(0, funds - price), assets: (x.assets ?? []).map(a => ({ ...a, tapped: true })), hand: x.hand.filter(c => c.id !== card.id) } : x) };
    const opts = v.spellTargets?.[card.id] ?? [];
    const hosts = hostOverride ? [hostOverride] : opts.map(o => field(v).find(c => c.id === o.id) ?? (o.id === `society:${p}` ? { id: o.id, controller: p } : null)).filter(Boolean);
    if (!hosts.length)
        return { utility: -100, host: null, win };
    let best = null;
    for (const host of hosts) {
        let cards = v.hardInfo?.ownDeck ? [...v.hardInfo.ownDeck] : null;
        if (cards && v.hardInfo.canControlLibrary) {
            const known = v.hardInfo.libraryKnown ?? {}, indices = cards.flatMap((c, i) => Object.hasOwn(known, c.id) ? [] : [i]);
            const values = new Map(indices.map(i => [cards[i].id, sealPayloadAssessment(after, cards[i], host, h).utility]));
            const ordered = indices.map(i => cards[i]).sort((a, b) => values.get(b.id) - values.get(a.id));
            indices.forEach((at, i) => cards[at] = ordered[i]);
        }
        const top = cards?.slice(0, 7);
        // Simple difficulty knows the public engines, not the library identities.
        const fallback = { type: 'unknown', owner: p, printedCost: 2, keywords: [] };
        const ranked = rankSealPayloads(after, top ?? [{ ...fallback, id: 'estimate:0' }, { ...fallback, id: 'estimate:1' }], host, h);
        const first = ranked[0] ?? { utility: 0 }, second = ranked[1] ?? { utility: 0 };
        const count = Math.min(2, own.deckCount ?? 0), secrecy = win * ((own.effectiveMarkers ?? own.markers)?.hidden ? 3 : 10);
        const utility = (count ? first.utility : 0) + (count > 1 ? second.utility * win : 0) + secrecy - (!candidates.length ? 6 : 0);
        const result = { utility, host, win, expectedSeals: count ? 1 + (count > 1 ? win : 0) : 0, first, second, payloadIds: cards ? ranked.map(c => c.card.id) : [], known: !!cards };
        if (!best || utility > best.utility)
            best = result;
    }
    return best;
}
