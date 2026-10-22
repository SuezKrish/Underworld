import { hasCardType } from './card-types.mjs';
import { libraryNameCount, copyIndex } from './bot-dynamic-planning.mjs';
import { endHandForecast } from './bot-resource-planning.mjs';
export const lockingBot = v => v.bot?.id === 'shoggoth-locking';
const mine = v => v.players[v.seat], own = v => mine(v).play.filter(c => !c.faceDown), foes = v => v.players[1 - v.seat].play.filter(c => c.faceDown || hasCardType(c, 'character'));
const support = v => own(v).filter(c => c.catalogId === 'BH29');
const coreId = v => mine(v).coreArea?.selectedCoreId;
const core = v => own(v).find(c => c.id === coreId(v));
const coreAvailable = v => !!core(v) || mine(v).coreArea?.cards.some(c => c.id === coreId(v));
const task = d => hasCardType(d, 'task');
const markNeed = (v, i) => Math.max(0, (v.districts[i]?.threshold ?? 99) - (v.districts[i]?.influence?.[v.seat] ?? 0) + (v.districts[i]?.influence?.[1 - v.seat] ?? 0));
const loss = v => v.societies?.[v.seat]?.counters?.['失控'] ?? 0;
const openingContact = v => lockingBot(v) && mine(v).coreArea?.cards.some(c => c.id === coreId(v)) && (libraryNameCount(v, '佩德罗的藏身处') ?? 1) > 0 && !own(v).some(c => c.catalogId === 'BQ066');
const firstContact = v => mine(v).hand.find(c => c.catalogId === 'BQ066');
// Establish the mission/core engine before collecting a second expensive
// support. This is an opening plan, not an unlimited preference for contacts.
export function lockingAssetAllowed(v, c) { return !lockingBot(v) || c.id !== coreId(v) && (!openingContact(v) || c.id !== firstContact(v)?.id); }
export function lockingLibraryBonus(v, c, context) {
    if (!openingContact(v) || context.kind !== 'hand')
        return 0;
    const contact = firstContact(v);
    if (!contact) {
        const next = v.hardInfo?.ownDeck.filter(x => x.catalogId === 'BQ066' && !Object.hasOwn(v.hardInfo.libraryKnown ?? {}, x.id)).sort((a, b) => a.id.localeCompare(b.id))[0];
        return c.id === next?.id ? 160 : 0;
    }
    // One grey asset suffices for the contact. If it is our only grey card,
    // draw a different grey card for the asset rather than consume the tutor.
    if (!(mine(v).loyalty?.factions?.灰 > 0) && !mine(v).hand.some(x => x.id !== contact.id && x.faction?.startsWith('灰') && !x.nonAssetNow) && c.faction?.startsWith('灰') && !c.nonAssetNow)
        return 90;
    return 0;
}
function edictRisk(v) { const e = v.players[1 - v.seat], now = (e.costPool ?? 0) + e.assets.filter(a => !a.tapped).length, available = v.turn.phase === 'end' ? Math.max(now, e.assets.length) : now; return e.handCount > 0 && available >= 2 && (e.loyalty?.factions?.黑 ?? 0) > 0; }
const otherBodies = v => own(v).filter(c => hasCardType(c, 'character') && c.id !== coreId(v));
// Closing paid flips at three loss counters can strand the only core in front
// of an edict. Harvesting honor is not worth losing the core/next action step.
export function lockingReveal(v, c, h) {
    if (!lockingBot(v) || !['BH29', 'BQ058'].includes(c.catalogId))
        return undefined;
    const up = h.faceUp(v, c);
    if (h.lethalBattleRisk(v, up, c.district))
        return null;
    const missing = c.catalogId === 'BH29' && support(v).length < 2;
    if (missing && (v.turn.phase === 'end' || v.turn.standardAllowed))
        return 135;
    if (c.catalogId === 'BQ058' && !own(v).some(x => x.catalogId === 'BQ058') && (v.turn.phase === 'end' || v.turn.standardAllowed))
        return 85;
    return undefined;
}
export function lockingRevealBonus(v, c) { return lockingBot(v) && core(v) && !otherBodies(v).length && loss(v) === 2 && edictRisk(v) && c.id !== coreId(v) ? 55 : 0; }
export function lockingCommandAllowed(v, c, mode) {
    if (!lockingBot(v) || !core(v) || !c?.subtypes?.includes('命令'))
        return true;
    const others = otherBodies(v).length, hidden = mine(v).play.some(x => x.faceDown && hasCardType(x, 'character') && x.id !== coreId(v));
    if (c.catalogId === 'BQ049' && mode === 'spawn')
        return true;
    if (c.catalogId === 'BQ049' && mode === 'sacrifice' && others <= 1 && (edictRisk(v) || loss(v) === 2 && hidden))
        return false;
    return !(loss(v) === 2 && c.faction?.startsWith('红') && !others && hidden);
}
// These weights operate on public board data and the bot's own hand only.
export function lockingHandBonus(v, c) {
    if (!lockingBot(v))
        return 0;
    if (c.catalogId === 'BH29') {
        const copies = copyIndex(v, c);
        return copies === 0 ? 55 : copies === 1 ? core(v) && support(v).length && mine(v).honor >= 2 ? 22 : -12 : -45;
    }
    return c.catalogId === 'BQ058' && !mine(v).play.some(x => x.catalogId === 'BQ058') ? 24 : c.catalogId === 'BH27' && !own(v).some(x => x.catalogId === 'BH27') ? 7 : c.catalogId === 'BQ066' ? 35 : 0;
}
export function lockingDistrictBonus(v, d, c) {
    if (!lockingBot(v))
        return 0;
    let n = 0;
    if (task(v.districts[d]))
        n += c.catalogId === 'BH29' ? 14 : 5;
    if (c.catalogId === 'BH29')
        n += Math.max(0, 12 - markNeed(v, d)) * 0.7;
    if (c.catalogId === 'CQ18')
        n += foes(v).filter(x => x.district === d).length * 5;
    return n;
}
export function lockingAssetBonus(v, c) {
    if (!lockingBot(v))
        return 0;
    const color = c.faction?.split('·')[0], have = mine(v).loyalty?.factions ?? {};
    let n = (color === '灰' && !(have.灰 > 0) ? -300 : color === '灰' && (have.灰 ?? 0) < 2 ? -80 : color === '红' && (have.红 ?? 0) < 2 ? -25 : 0);
    if (c.catalogId === 'BH29' && support(v).length < 2)
        n += 130;
    if (c.catalogId === 'BQ066' && !v.districts.some(task))
        n += 100;
    if (c.catalogId === 'BQ058' && !own(v).some(x => x.catalogId === 'BQ058'))
        n += 55;
    return n;
}
export function lockingMulligan(v, h) {
    if (!lockingBot(v))
        return null;
    const hand = mine(v).hand, keep = new Set();
    for (const color of ['灰', '红'])
        for (const c of h.sorted(hand.filter(c => !c.nonAssetNow && c.faction?.startsWith(color)), c => h.handValue(v, c), false).slice(0, color === '灰' ? 2 : 1))
            keep.add(c.id);
    for (const id of ['BQ066', 'BQ058', 'BH29', 'BH27']) {
        const choices = hand.filter(c => c.catalogId === id).slice(0, id === 'BH29' ? 2 : 1);
        for (const c of choices)
            keep.add(c.id);
    }
    if (!hand.some(c => ['BQ066', 'BQ058'].includes(c.catalogId))) {
        for (const mission of hand.filter(c => ['BQ112', 'BQ114'].includes(c.catalogId)))
            keep.add(mission.id);
    }
    return [{ type: 'mulligan', cardIds: hand.filter(c => !keep.has(c.id)).map(c => c.id) }];
}
function lockScore(v, h, o) {
    const c = h.lookup(v, o.id) ?? o;
    if (c.controller !== 1 - v.seat)
        return -100;
    return h.value(c) + (c.counters?.locked ? 0 : 4);
}
export function lockingChoice(v, a, h) {
    const b = { type: 'effect-choice', choiceId: a.id }, cards = a.cards ?? [];
    if (a.kind === 'shoggoth-invoke') {
        const plan = a.corePlan ?? {};
        if (plan.operation === 'core-lock')
            return h.sorted(cards, o => lockScore(v, h, o)).map(o => ({ ...b, targetIds: [o.id] })).concat(a.canSkip ? [{ ...b, skip: true }] : []);
        return plan.target === 'none' ? [{ ...b, targetIds: [] }] : cards.map(c => ({ ...b, targetIds: [c.id] }));
    }
    if (['shoggoth-draw-optional', 'shoggoth-scored-core-draw'].includes(a.kind))
        return [{ ...b, draw: mine(v).deckCount > h.drawReserve(v) }];
    if (a.kind === 'shoggoth-shield-optional')
        return [{ ...b, shield: true }];
    if (a.kind === 'shoggoth-mission-place-core')
        return [{ ...b, enter: true }];
    if (a.kind === 'shoggoth-core-hand')
        return cards.map(c => ({ ...b, cardId: c.id })).concat({ ...b, skip: true });
    if (a.kind === 'shoggoth-mission-move')
        return cards.filter(c => !h.lethalBattleRisk(v, c, a.destination)).map(c => ({ ...b, cardId: c.id })).concat({ ...b, skip: true });
    if (a.kind === 'shoggoth-execution')
        return h.sorted(cards, c => { const x = h.lookup(v, c.id) ?? c; return (x.controller === v.seat ? -1 : 1) * h.value(x); }).map(c => ({ ...b, cardId: c.id }));
    if (a.kind === 'shoggoth-claim-move') {
        const indexes = v.districts.flatMap((d, i) => d ? [i] : []), at = indexes.indexOf(a.sourceDistrict), ds = [indexes[at - 1], indexes[at + 1]].filter(d => d !== undefined);
        const c = cards[0];
        return c ? [...ds.sort((a, b) => h.districtScore(v, b, c) - h.districtScore(v, a, c)).map(d => ({ ...b, cardId: c.id, district: d })), { ...b, skip: true }] : [{ ...b, skip: true }];
    }
    if (a.kind === 'shoggoth-mission-search' || lockingBot(v) && a.kind === 'search' && cards.some(c => hasCardType(c, 'task'))) {
        const full = endHandForecast(v).projected >= (mine(v).handLimit ?? 7), preferred = full ? 'BQ114' : 'BQ112';
        return h.sorted(cards, c => (c.catalogId === 'BH59' && mine(v).coreArea?.cards.length ? 200 : c.catalogId === preferred ? 120 : ['BQ112', 'BQ114'].includes(c.catalogId) ? 70 : 0) - (mine(v).scoreCards.some(x => x.catalogId === c.catalogId) ? 50 : 0)).map(c => ({ ...b, cardId: c.id })).concat(a.canFail ? [{ ...b, fail: true }] : []);
    }
    if (a.kind === 'shoggoth-place-core')
        return cards.map(c => ({ ...b, cardId: c.id, shield: true }));
    if (a.kind === 'shoggoth-basic-core' || a.kind === 'shoggoth-mission-shield')
        return cards.map(c => ({ ...b, cardId: c.id }));
    if (a.kind === 'shoggoth-pay-two')
        return [{ ...b, pay: false }];
    if (a.kind === 'shoggoth-copy-command') {
        const plan = a.corePlan;
        return (plan?.modes ?? []).flatMap(m => { const t = plan.modeTargets?.[m.id]; return t?.target === 'none' ? [{ ...b, mode: m.id, targetIds: [] }] : cards.filter(c => c.modes?.includes(m.id)).map(c => ({ ...b, mode: m.id, targetIds: [c.id] })); });
    }
    return null;
}
export function lockingTactics(v, h, add) {
    if (!lockingBot(v))
        return;
    const p = v.seat, available = h.pool(v), standard = v.turn.standardAllowed && v.flow.stepOwner === p && !v.flow.stack.length, sp = support(v), honor = mine(v).honor ?? 0, eligible = foes(v).filter(c => !c.barrierNow && !c.untargetableNow), active = coreAvailable(v), combo = sp.length && eligible.length && active;
    const lockPayoff = sp.reduce((n, c) => n + 5 + (markNeed(v, c.district) <= sp.filter(x => x.district === c.district).length ? 35 : 0), 0);
    // Building the second asset is part of the two-mana tutor line. Secretly
    // deploying another support first would spend one mana and break that line.
    if (standard && (openingContact(v) && firstContact(v) || mine(v).hand.some(c => c.id === coreId(v))) && !mine(v).actionsUsed.asset && mine(v).assets.length < 8) {
        const needsGrey = !mine(v).ignoreLoyalty && !(mine(v).loyalty?.factions?.灰 > 0);
        const materials = h.sorted(mine(v).hand.filter(c => !c.nonAssetNow && lockingAssetAllowed(v, c) && (!needsGrey || c.faction?.startsWith('灰'))), c => h.assetValue(v, c), false);
        for (const c of materials)
            add({ type: 'build-asset', cardId: c.id }, 160);
    }
    if (standard)
        for (const c of own(v))
            for (const [i, a] of (c.availableActions ?? c.automation?.actions ?? []).entries()) {
                if (a.tap && c.tapped || available < (a.cost ?? 0) || honor < (a.honorCost ?? 0))
                    continue;
                const base = { type: 'activate', cardId: c.id, actionIndex: i, targetIds: [] };
                if (c.catalogId === 'BH29' && combo)
                    add(base, 55 + lockPayoff);
                if (c.catalogId === 'BQ045' && !(sp.length >= 2 && honor >= 2)) {
                    const taps = v.abilityTaps?.[`${c.id}:${i}`] ?? [], targets = v.abilityTargets?.[`${c.id}:${i}`] ?? [];
                    if (taps.length)
                        for (const o of targets) {
                            const x = h.lookup(v, o.id);
                            if (x?.controller === 1 - p)
                                add({ ...base, targetIds: [o.id], tapIds: [h.sorted(taps, h.value, false)[0].id] }, 36 + h.value(x));
                        }
                }
                if (c.catalogId === 'BQ052' && !core(v) && mine(v).coreArea?.cards.length) {
                    const ids = (v.abilitySacrifices?.[`${c.id}:${i}`] ?? []).slice(0, 3);
                    if (ids.length === 3)
                        add({ ...base, sacrificeIds: ids.map(c => c.id) }, 40);
                }
            }
    if (standard)
        for (const c of mine(v).hand.filter(c => ['BH29', 'BQ058', 'BH27'].includes(c.catalogId))) {
            const price = v.castingCosts?.[c.id] ?? h.cost(c), up = h.faceUp(v, c), want = c.catalogId === 'BH29' ? support(v).length < 2 : c.catalogId === 'BQ058' ? !own(v).some(x => x.catalogId === 'BQ058') : loss(v) > 0;
            if (!want || c.castAllowed === false)
                continue;
            if (price <= available && h.loyalty(v, c))
                for (const d of h.districts(v, up))
                    if (!h.lethalBattleRisk(v, up, d))
                        add({ type: 'play', cardId: c.id, district: d }, c.catalogId === 'BH29' ? 130 : h.value(c) + 45);
            if (c.catalogId === 'BH29' && !mine(v).play.some(x => x.faceDown && x.catalogId === 'BH29') && !mine(v).actionsUsed.secret && available >= 1 && !c.publicNow)
                for (const d of h.districts(v, { ...c, faceDown: true, effectiveIcons: undefined }))
                    add({ type: 'secret-deploy', cardId: c.id, district: d }, 110 + h.districtScore(v, d, { ...c, faceDown: true, effectiveIcons: undefined }));
        }
    if (standard)
        for (const c of mine(v).coreArea?.cards ?? []) {
            if (!c.castAllowed || !h.loyalty(v, c) || core(v))
                continue;
            const rest = mine(v).coreArea.counters?.rest ?? 0, need = Math.max(0, Math.ceil(((c.cost ?? h.cost(c)) + rest * 2 - available) / 2)), honorRest = Math.min(rest, need);
            if (honorRest * 2 > honor || (c.cost ?? h.cost(c)) + (rest - honorRest) * 2 > available)
                continue;
            for (const d of h.districts(v, c))
                if (!h.lethalBattleRisk(v, c, d))
                    add({ type: 'play', cardId: c.id, district: d, honorRest }, 26 + h.districtScore(v, d, c) + (own(v).some(x => x.catalogId === 'BQ058') ? 15 : 0));
        }
    if (standard && !core(v))
        for (const c of mine(v).hand.filter(c => c.id === coreId(v) && c.castAllowed !== false && h.loyalty(v, c) && (v.castingCosts?.[c.id] ?? h.cost(c)) <= available))
            for (const d of h.districts(v, c))
                if (!h.lethalBattleRisk(v, c, d))
                    add({ type: 'play', cardId: c.id, district: d }, 145 + h.districtScore(v, d, c));
    for (const c of mine(v).hand) {
        if (c.castAllowed === false || !h.loyalty(v, c) || h.duplicate(v, c))
            continue;
        const plan = c.spell ?? c.attachment;
        if (!plan)
            continue;
        if (plan.timing !== 'fast' && !standard)
            continue;
        const price = v.castingCosts?.[c.id] ?? h.cost(c);
        if (price > available)
            continue;
        const opts = v.spellTargets?.[c.id] ?? [], base = { type: 'play', cardId: c.id }, targets = mode => opts.filter(o => !o.modes || o.modes.includes(mode));
        if (hasCardType(c, 'task') && standard) {
            const full = endHandForecast(v).projected >= (mine(v).handLimit ?? 7), preferred = full ? 'BQ114' : 'BQ112';
            if (c.catalogId === 'BH59' || core(v))
                add({ ...base, targetIds: [] }, c.catalogId === 'BH59' && mine(v).coreArea?.cards.length ? 150 : c.catalogId === preferred ? 165 : 90);
        }
        if (['BQ066', 'BQ052'].includes(c.catalogId) && standard)
            add({ ...base, targetIds: [`society:${p}`] }, c.catalogId === 'BQ066' ? (openingContact(v) ? 180 : 48) : own(v).some(x => x.catalogId === 'BQ052') ? 12 : 34);
        if (c.catalogId === 'WM043') {
            if (combo)
                for (const o of targets('lock').filter(o => eligible.some(c => c.id === o.id)))
                    add({ ...base, mode: 'lock', targetIds: [o.id] }, 35 + lockPayoff);
            for (const o of targets('destroy')) {
                const x = h.lookup(v, o.id);
                if (x?.controller === 1 - p && !h.targetedByUs(v, o.id) && !h.keyword(x, '永恒'))
                    add({ ...base, mode: 'destroy', targetIds: [o.id] }, 30 + h.value(x));
            }
        }
        if (c.catalogId === 'BH31') {
            const watery = eligible.filter(c => v.districts[c.district]?.traits?.includes('水域'));
            if (watery.length)
                add({ ...base, mode: 'lock', targetIds: [] }, 25 + watery.length * (8 + sp.length * 5));
            const x = core(v);
            if (x && h.lethalBattleRisk(v, x, x.district))
                add({ ...base, mode: 'protect', targetIds: [x.id] }, 55);
        }
        if (c.catalogId === 'BQ048') {
            if (combo)
                add({ ...base, mode: 'core', targetIds: [] }, 34 + lockPayoff);
            const x = core(v);
            if (x?.tapped)
                add({ ...base, mode: 'reset', targetIds: [x.id] }, 36 + h.districtScore(v, x.district, x));
            for (const o of targets('damage')) {
                const x = h.lookup(v, o.id);
                if (x?.controller === 1 - p && (x.effectiveDefense ?? x.defense ?? 1) - (x.damage ?? 0) <= 1 && !h.targetedByUs(v, o.id))
                    add({ ...base, mode: 'damage', targetIds: [o.id] }, 38 + h.value(x));
            }
        }
        if (c.catalogId === 'BQ049') {
            if (combo && honor === 1)
                add({ ...base, mode: 'mobility', targetIds: [] }, 100 + lockPayoff);
            const fodder = h.sorted(own(v).filter(x => hasCardType(x, 'character') && x.id !== coreId(v) && x.catalogId !== 'BH29' && !h.keyword(x, '永恒')), h.value, false)[0];
            if (combo && honor < 2 && fodder && h.value(fodder) < 8)
                add({ ...base, mode: 'sacrifice', targetIds: [] }, 58);
            for (const o of targets('spawn')) {
                const d = Number(o.id.slice(9));
                add({ ...base, mode: 'spawn', targetIds: [o.id] }, 16 + h.districtScore(v, d, { icons: { investigation: 1, battle: 1, influence: 1 } }) + (task(v.districts[d]) ? 10 : 0));
            }
        }
        if (c.catalogId === 'BQ109') {
            const x = core(v);
            if (x && mine(v).deckCount > h.drawReserve(v) && !h.targetedByUs(v, x.id))
                add({ ...base, mode: 'defense', targetIds: [] }, 23);
            for (const o of targets('influence')) {
                const d = Number(o.id.slice(9));
                if (markNeed(v, d) <= 1)
                    add({ ...base, mode: 'influence', targetIds: [o.id] }, 75);
            }
            if (x?.tapped)
                for (const o of targets('move'))
                    add({ ...base, mode: 'move', targetIds: [o.id] }, 30 + h.districtScore(v, Number(o.id.slice(9)), x));
        }
        if (c.catalogId === 'BQ064' && standard && (v.societies[p].counters?.['失控'] ?? 0) > 0)
            add({ ...base, targetIds: [] }, 55 + (v.societies[p].counters['失控'] ?? 0) * 10);
        if (c.catalogId === 'BQ061' && standard)
            for (const o of opts) {
                const x = h.lookup(v, o.id);
                if (x)
                    add({ ...base, targetIds: [o.id] }, 18 + h.handValue(v, x));
            }
        if (c.catalogId === 'BQ050' && standard) {
            for (const o of targets('damage')) {
                const x = h.lookup(v, o.id);
                if (x?.controller === 1 - p && (x.effectiveDefense ?? x.defense ?? 1) - (x.damage ?? 0) <= 1)
                    add({ ...base, modes: ['damage'], targetIds: [o.id] }, 30 + h.value(x));
            }
            for (const o of targets('attachment'))
                if (h.lookup(v, o.id)?.controller === 1 - p)
                    add({ ...base, modes: ['attachment'], targetIds: [o.id] }, 28 + h.value(h.lookup(v, o.id)));
        }
    }
}
