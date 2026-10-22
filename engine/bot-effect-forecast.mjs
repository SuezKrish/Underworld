import { hasCardType } from './card-types.mjs';
import { fieldResponseRules, responseFilter, selectedEffectPlans, removalEffects, counterEffects } from './response-effect-semantics.mjs';
const live = c => c && !c.faceDown && !c.printedTextBlank && !c.abilitiesSuppressed;
const cardGain = (v, p) => { const n = v.players[p].handCount ?? v.players[p].hand?.length ?? 0; return n < 3 ? 5 : n < 6 ? 3 : 1; };
function outputValue(plan, v, p) { return selectedEffectPlans(plan).reduce((n, x) => n + (['draw', 'search-filtered', 'grave-to-hand', 'bottom-to-hand'].includes(x.effect) ? (x.count ?? 1) * cardGain(v, p) : 0), 0); }
function enginePayoff(v, c) {
    const a = c.automation ?? {}, p = c.controller, pl = v.players[p];
    if (!pl || !live(c))
        return 0;
    const hand = pl.handCount ?? pl.hand?.length ?? 0, repeat = Math.min(2, hand), discount = a.castingDiscount || a.revealDiscount ? Math.min(3, hand) : 0;
    const triggers = (a.watch ?? []).filter(w => w.own && ['cast', 'entry'].includes(w.event)).reduce((n, w) => n + outputValue(w, v, p) * repeat, 0);
    return Math.min(8, discount + triggers + Math.max(0, ...(a.actions ?? (a.action ? [a.action] : [])).filter(x => !x.used && (x.cost ?? 0) <= ((pl.costPool ?? 0) + (pl.assets ?? []).filter(a => !a.tapped).length)).map(x => outputValue(x, v, p) - (x.cost ?? 0)))) * 0.5;
}
function scene(v) { return { cards: new Map(v.players.flatMap(p => [...(p.play ?? []), ...(p.assets ?? []).map(c => ({ ...c, type: 'asset' }))]).map(c => [c.id, { ...c }])), seals: (v.sealed ?? []).map(c => ({ ...c })), stack: [...(v.flow?.stack ?? [])], events: [] }; }
function keyword(c, k, h) { return c.forecastKeywords?.includes(k) || (c.forecastLostKeywords?.includes(k) ? false : (h.keyword?.(c, k) ?? c.keywords?.includes(k) ?? false)); }
function rulesFor(s) { return [...s.cards.values()].filter(live).flatMap(source => fieldResponseRules(source).map(rule => ({ source, rule }))); }
function applies(v, s, source, r, c, h) {
    if (r.own && source.controller !== c.controller || r.enemy && source.controller === c.controller || r.otherOnly && source.id === c.id || r.sameDistrict && source.district !== c.district)
        return false;
    if (!responseFilter(c, r.filter, (x, k) => keyword(x, k, h)))
        return false;
    if (r.filter?.chosenSubtype && (!source.chosenSubtype || !c.subtypes?.includes(source.chosenSubtype)))
        return false;
    if (r.condition === 'grave-seven' && (v.players[source.controller].graveyard ?? []).length < 7)
        return false;
    if (r.condition === 'mind-assets-two' && (v.players[source.controller].assets ?? []).filter(x => x.magicDomains?.includes('心灵')).length < 2)
        return false;
    if (r.condition && !['grave-seven', 'mind-assets-two'].includes(r.condition))
        return false; // unresolved condition is not a guaranteed grant
    if (r.attachmentName || r.attachmentSubtypesAny) {
        const attached = [...s.cards.values()].filter(a => a.attachedTo === c.id && live(a));
        if (!attached.some(a => r.attachmentName ? a.name === r.attachmentName : r.attachmentSubtypesAny.some(t => a.subtypes?.includes(t))))
            return false;
    }
    return true;
}
function granted(v, s, c, k, h) { return keyword(c, k, h) || rulesFor(s).some(({ source, rule: r }) => r.kind === 'aura' && r.grantKeywords?.includes(k) && applies(v, s, source, r, c, h)); }
function canTerminate(s, c, plan) { return !plan?.cannotTerminate && !c?.automation?.cannotTerminate && !rulesFor(s).some(({ source, rule: r }) => r.kind === 'cannot-terminate' && source.controller === c?.controller); }
function targetTax(v, s, c, plan, t, h, isCard) {
    let tax = 0, blocked = false;
    for (const { source, rule: r } of rulesFor(s)) {
        if (r.kind !== 'targeted' || !applies(v, s, source, r, t, h))
            continue;
        if (r.selfOnly && source.id !== t.id || r.hostSubject && source.attachedTo !== t.id || r.subjectTypes && !r.subjectTypes.some(k => hasCardType(t, k)) || r.targetingHoly && !c.magicDomains?.includes('神圣'))
            continue;
        const actor = c.controller ?? v.seat, owner = c.owner ?? actor;
        if (r.enemyCard && (!isCard || owner === source.controller) || r.enemyTransaction && (!isCard || !c.spell || owner === source.controller) || r.enemyTargetingSource && (isCard ? owner : actor) === source.controller || r.enemyEffect && actor === source.controller)
            continue;
        if (r.transactionOnly && (!isCard || !c.spell) || r.subjectKeyword && !keyword(t, r.subjectKeyword, h) || r.targetUnique && !t.unique || r.targetingUnique && !c.unique)
            continue;
        const sign = source.controller === v.seat ? -1 : 1;
        for (const p of selectedEffectPlans(r))
            if (p.effect === 'draw')
                tax += sign * (p.count ?? 1) * cardGain(v, source.controller);
        // Conditional termination is a public option, not an assertion that the
        // opponent will take it. Retain a strong risk penalty when they can pay.
        if (r.operation === 'vampire-protection' && isCard && canTerminate(s, c, plan) && [...s.cards.values()].some(a => a.controller === source.controller && a.attachedTo === t.id && live(a) && hasCardType(a, 'attachment') && !granted(v, s, a, '永恒', h) && !a.cannotSacrifice))
            blocked = true;
    }
    return { tax, blocked };
}
function sealedReturn(v, s, id) { return s.seals.filter(c => c.hostId === id).reduce((n, c) => n + (c.owner === v.seat ? 1 : -1) * cardGain(v, c.owner), 0); }
function defense(c) { return Math.max(0, (c.effectiveDefense ?? c.defense ?? 1) + (c.forecastDefense ?? 0)); }
function utility(v, s, c, plan, ids, h, isCard) {
    let value = 0, blocked = false, supported = false;
    for (const p of selectedEffectPlans(plan)) {
        const effect = p.effect;
        if (counterEffects.has(effect)) {
            supported = true;
            for (const id of ids) {
                const a = s.stack.find(a => a.id === id.replace(/^stack:/, ''));
                if (a && a.canBeTerminated !== false) {
                    const threatened = (a.targetIds ?? []).map(id => s.cards.get(id)).filter(t => t?.controller === v.seat).reduce((n, t) => n + h.value(t) + enginePayoff(v, t), 0);
                    value += (a.controller === v.seat ? -1 : 1) * Math.max(threatened, 8 + (a.responseEffect?.removesTargets ? 8 : 0));
                }
            }
            continue;
        }
        if (!removalEffects.has(effect) && !['tap', 'untap', 'prevent-damage', 'grant-target-keywords', 'grant-icons-keyword', 'heal', 'remove-wounds'].includes(effect) && p.operation !== 'blink')
            continue;
        supported = true;
        for (const id of ids) {
            const t = s.cards.get(id);
            if (!t)
                continue;
            const enemy = t.controller !== v.seat, initiator = isCard ? (c.owner ?? v.seat) : (c.controller ?? v.seat), barrier = granted(v, s, t, '屏障', h) && initiator !== t.controller;
            if (barrier) {
                blocked = true;
                continue;
            }
            const tax = targetTax(v, s, c, plan, t, h, isCard);
            if (tax.blocked) {
                blocked = true;
                value -= tax.tax;
                continue;
            }
            const worth = h.value(t), damage = (t.damage ?? 0) + (t.wounds ?? 0), sign = enemy ? 1 : -1;
            if (removalEffects.has(effect)) {
                if (granted(v, s, t, '永恒', h))
                    continue;
                if (effect === 'destroy-if-sealed' && !s.seals.some(a => a.hostId === id))
                    continue;
                let fraction = effect === 'conceal' ? 0.65 : 1;
                if (['damage', 'wound'].includes(effect)) {
                    const n = p.amount ?? p.count ?? 1;
                    fraction = damage + n >= defense(t) ? 1 : Math.min(0.45, n / Math.max(1, defense(t)) * 0.5);
                }
                value += sign * worth * fraction + (fraction === 1 ? sealedReturn(v, s, id) + sign * enginePayoff(v, t) : 0) - tax.tax;
            }
            else if (effect === 'tap')
                value += (t.tapped ? 0 : sign * (2 + Object.values(t.effectiveIcons ?? t.icons ?? {}).reduce((a, b) => a + b, 0))) - tax.tax;
            else if (effect === 'untap')
                value += (t.tapped ? -sign * (2 + worth * 0.25) : 0) - tax.tax;
            else if (['heal', 'remove-wounds'].includes(effect))
                value += -sign * Math.min(damage, p.count ?? p.amount ?? damage) * 2 - tax.tax;
            else {
                const threat = s.stack.filter(a => a.controller !== t.controller && a.targetIds?.includes(id) && !a.responseEffect?.returnsTargetsToHand).some(a => a.responseEffect?.removesTargets || a.responseEffect?.damage);
                const protection = effect === 'prevent-damage' || p.operation === 'blink' || p.grantKeywords?.some(k => ['屏障', '永恒'].includes(k) || k.startsWith('护盾'));
                value += (!enemy && threat && protection ? worth + 6 : 0) + (p.icons ? -sign * Object.values(p.icons).reduce((n, x) => n + x, 0) : 0) - tax.tax;
            }
        }
    }
    return { value, blocked, supported };
}
function remove(s, id) {
    s.cards.delete(id);
    for (const [aid, a] of s.cards)
        if (a.attachedTo === id)
            remove(s, aid);
    s.seals = s.seals.filter(c => c.hostId !== id);
}
function futureTarget(plan, c, v, source) {
    const t = plan.target;
    // Only use target classes whose legality can be established from public
    // data. More involved targets retain their engine-supplied current options.
    const characterTargets = ['character', 'own-character', 'enemy-character', 'unique-character', 'magic-character', 'filtered-character', 'own-filtered-character'];
    if (characterTargets.includes(t))
        return hasCardType(c, 'character') && !c.faceDown && (!t.startsWith('own-') || c.controller === v.seat) && (!t.startsWith('enemy-') || c.controller !== v.seat) && (t !== 'unique-character' || c.unique) && (t !== 'magic-character' || c.magicDomains?.length) && responseFilter(c, plan.filter);
    if (t === 'role-or-attachment')
        return !c.faceDown && (hasCardType(c, 'character') || hasCardType(c, 'attachment'));
    return false;
}
function opportunityCost(v, c, plan, h, isCard) {
    const player = v.players[v.seat], perishing = isCard && (player.hand ?? []).some(x => x.id === c.id) && (v.flow?.stack ?? []).some(a => (a.responseEffect?.handDiscards ?? []).some(x => x.player === v.seat && x.count >= player.hand.length));
    const mana = isCard ? v.castingCosts?.[c.id] ?? Number(c.printedCost ?? 0) : plan.cost ?? 0;
    const manaPrice = (v.round ?? 1) <= 4 ? 1.25 : 0.8, handPrice = perishing ? 0 : isCard ? cardGain(v, v.seat) : 0;
    const tapPrice = plan.tap && !c.tapped ? Object.values(c.effectiveIcons ?? c.icons ?? {}).reduce((n, x) => n + x, 0) * 0.65 : 0;
    return { direct: mana * manaPrice + handPrice + tapPrice + (plan.sacrificeSelf ? h.value(c) : 0), mana };
}
function developmentLost(v, c, mana, h) {
    if (mana <= 0)
        return 0;
    const p = v.seat, pl = v.players[p], available = h.pool ? h.pool(v) : (pl.costPool ?? 0) + (pl.assets ?? []).filter(a => !a.tapped).length, turn = v.turn ?? {};
    const ownActionAhead = ['start', 'setup'].includes(turn.phase) || turn.phase === 'action' && (v.flow.stepOwner === p || turn.firstPlayer !== p && turn.step === 'first-action');
    const options = [];
    if (ownActionAhead)
        for (const x of pl.hand ?? [])
            if (x.id !== c.id && x.castAllowed !== false && (!h.loyalty || h.loyalty(v, x))) {
                if (hasCardType(x, 'character') || hasCardType(x, 'attachment'))
                    options.push({ cost: v.castingCosts?.[x.id] ?? Number(x.printedCost ?? 0), value: h.value(x) * 0.65 + enginePayoff(v, { ...x, controller: p }) + outputValue(x.automation?.entry, v, p) });
                else if (outputValue(x.spell, v, p) > 0)
                    options.push({ cost: v.castingCosts?.[x.id] ?? Number(x.printedCost ?? 0), value: outputValue(x.spell, v, p) });
            }
    for (const x of pl.play ?? [])
        if (x.id !== c.id && x.faceDown && !x.paidRevealBlocked && (!h.loyalty || h.loyalty(v, x))) {
            const up = h.faceUp ? h.faceUp(v, x) : { ...x, faceDown: false };
            options.push({ cost: v.revealCosts?.[x.id] ?? Number(x.printedCost ?? 0), value: h.value(up) * 0.6 + enginePayoff(v, up) + outputValue(up.automation?.entry ?? up.automation?.reveal, v, p) });
        }
    // A small knapsack compares feasible development with the same public mana
    // before and after this action. It does not just penalize an expensive card.
    const best = budget => {
        let states = new Map([[0, 0]]);
        for (const o of options.filter(x => x.cost <= available).sort((a, b) => b.value - a.value).slice(0, 12)) {
            const next = new Map(states);
            for (const [used, value] of states)
                if (used + o.cost <= budget)
                    next.set(used + o.cost, Math.max(next.get(used + o.cost) ?? 0, value + o.value));
            states = next;
        }
        return Math.max(...states.values());
    };
    return Math.max(0, best(available) - best(Math.max(0, available - mana))) * 0.7;
}
function advance(v, s, a, h) {
    const r = a.responseEffect ?? {};
    for (const id of r.terminatesEntries ?? []) {
        const target = s.stack.find(x => x.id === id);
        if (target?.canBeTerminated !== false)
            s.stack = s.stack.filter(x => x.id !== id);
    }
    if (r.enteringCard)
        s.cards.set(r.enteringCard.id, { ...r.enteringCard, responseRules: undefined });
    for (const seal of r.pendingSeals ?? [])
        if (s.cards.has(seal.hostId))
            s.seals.push(seal);
    if (r.drinkBloodPlayer !== undefined) {
        const p = r.drinkBloodPlayer, available = [...(v.players[p].graveyard ?? []), ...(v.players[p].headquarters ?? []), ...(v.sealed ?? []).filter(c => c.hostId === `society:${p}`)].filter(c => c.name === '鲜血');
        for (const [i, id] of (r.attachmentHosts ?? []).entries())
            if (i < available.length && s.cards.has(id))
                s.cards.set(`forecast-attachment:${a.id}:${i}`, { ...available[i], id: `forecast-attachment:${a.id}:${i}`, type: 'attachment', controller: p, attachedTo: id, faceDown: false });
    }
    for (const x of r.targetChanges ?? [])
        for (const id of x.targetIds) {
            const c = s.cards.get(id);
            if (!c || granted(v, s, c, '屏障', h) && (a.controller !== c.controller))
                continue;
            if (removalEffects.has(x.effect) && !['damage', 'wound', 'sacrifice-character'].includes(x.effect)) {
                if (!granted(v, s, c, '永恒', h))
                    remove(s, id);
                continue;
            }
            if (['damage', 'wound'].includes(x.effect)) {
                c.damage = (c.damage ?? 0) + (x.amount ?? x.count ?? 1);
                if (c.damage + (c.wounds ?? 0) >= defense(c) && !granted(v, s, c, '永恒', h))
                    remove(s, id);
            }
            if (x.effect === 'tap')
                c.tapped = true;
            if (x.effect === 'untap')
                c.tapped = false;
            if (x.grantKeywords?.length)
                c.forecastKeywords = [...(c.forecastKeywords ?? []), ...x.grantKeywords];
            if (x.defense)
                c.forecastDefense = (c.forecastDefense ?? 0) + x.defense;
        }
    s.stack = s.stack.filter(x => x.id !== a.id);
    s.events.push(a.id);
}
// Compare each visible resolution boundary, not a guessed next enemy play.
// Future choices stay conditional; no opponent private cards or FAQ are read.
export function actionEffectForecast(v, c, plan, targetIds, h, { isCard = !!c?.spell || !!c?.attachment } = {}) {
    c = { ...c, controller: c?.controller ?? v.seat };
    const s = scene(v), ids = targetIds ?? [], now = utility(v, s, c, plan, ids, h, isCard), boundaries = [];
    const payment = opportunityCost(v, c, plan, h, isCard), developmentCost = developmentLost(v, c, payment.mana, h), spending = payment.direct + developmentCost;
    for (const a of [...s.stack].reverse()) {
        if (!s.stack.some(x => x.id === a.id))
            continue;
        advance(v, s, a, h);
        const after = utility(v, s, c ?? {}, plan, ids, h, isCard);
        let alternative = after.value, alternativeId;
        if (ids.length === 1 && removalEffects.has(plan.effect))
            for (const t of s.cards.values())
                if (!ids.includes(t.id) && futureTarget(plan, t, v, c)) {
                    const u = utility(v, s, c, plan, [t.id], h, isCard);
                    if (!u.blocked && u.value > alternative) {
                        alternative = u.value;
                        alternativeId = t.id;
                    }
                }
        if (after.supported)
            boundaries.push({ after: after.value, blocked: after.blocked, entryId: a.id, alternative, alternativeId });
    }
    const future = boundaries.find(x => x.blocked !== now.blocked || Math.abs(x.after - now.value) >= 0.75), after = future?.after ?? now.value, delta = after - now.value;
    const bestLater = Math.max(now.value, ...boundaries.map(x => x.alternative)), preferAlternative = bestLater > now.value + Math.max(2, now.value * 0.35);
    return { now: now.value, after, delta, spending, developmentCost, netNow: now.value - spending, profitable: now.value - spending >= 1, supported: now.supported, blocked: now.blocked,
        urgent: !!(now.supported && !now.blocked && now.value > 0 && (delta < -0.75 || future?.blocked)),
        wait: !!(now.supported && (delta > 0.75 && !future?.blocked || preferAlternative)), entryId: future?.entryId, boundaries };
}
