// Summaries of public announced effects only. Never infer from FAQ text,
// private searches, hidden selections or a player's unrevealed cards.
const entryEffects = new Set(['grave-enter', 'grave-random-enter', 'abyss-enter', 'zone-enter', 'zone-spawn', 'spawn-token', 'spawn']);
const entryOperations = new Set(['grave-source-enter', 'guinevere-return', 'death-return', 'curse-revive', 'ghost-revive', 'murder-return', 'nameless-return', 'return-corpse', 'vortex-revive', 'source-direct-reveal', 'target-direct-reveal', 'vampire-direct-reveal', 'spawn-random', 'spawn-target', 'mother-play', 'hugo-device']);
const exits = new Set(['destroy', 'destroy-if-sealed', 'destroy-low-total-icons', 'bounce', 'return-hand', 'shuffle-owner', 'bottom-owner', 'bottom', 'seal', 'conceal', 'control', 'mode-conceal-bounce', 'tap-or-bounce']);
const returnHand = new Set(['bounce', 'return-hand', 'bounce-district-clear-counters', 'return-source-hand']);
const sourceExits = new Set(['conceal-source', 'blink-source', 'source-blink', 'return-source-hand']);
const sourceExitOperations = new Set(['self-conceal', 'conceal-source-rest', 'hugo-return']);
export function stackResponseInformation(a, card) {
    const out = {};
    const entering = ['play-character', 'reveal-character'].includes(a.kind) || a.kind === 'play-spell' && ['attach', 'attach-society', 'attach-district'].includes(a.plan?.effect);
    if (entering && card) {
        if (['play-character', 'reveal-character'].includes(a.kind))
            out.characterEntry = true;
        const { id, name, owner, type, subtypes, faction, magicDomains, printedCost, icons, temporaryIcons, keywords, defense, automation, unique } = card;
        out.enteringCard = { id: a.cardId ?? id, name, owner, controller: a.controller, type, subtypes, faction, magicDomains, printedCost, icons, temporaryIcons, keywords, defense, automation, unique, district: a.district ?? a.plan?.sourceDistrict, attachedTo: a.plan?.effect === 'attach' ? (a.targets ?? [])[0]?.cardId : undefined };
    }
    if (a.effect?.kind === 'seal-from-graveyard' && a.targetId)
        out.pendingSeals = [{ id: a.sourceId ?? a.cardId, owner: card?.owner ?? a.controller, hostId: a.targetId }];
    function visit(plan) {
        if (!plan || typeof plan !== 'object')
            return;
        if (plan.operation === 'vampire-protection')
            out.attachmentProtection = { subjectId: plan.subjectId, subjectZoneVersion: plan.subjectZoneVersion, targetedEntryId: plan.targetedEntryId };
        if (plan.operation === 'hidden-start')
            out.hiddenContest = true;
        if (plan.target?.includes('grave'))
            out.graveyardUse = true;
        if (entryEffects.has(plan.effect) || entryOperations.has(plan.operation) || plan.kind === 'spawn-token')
            out.characterEntry = true;
        if (exits.has(plan.effect) || plan.operation === 'locked-execution')
            out.removesTargets = true;
        if (returnHand.has(plan.effect))
            out.returnsTargetsToHand = true;
        if (sourceExits.has(plan.effect) || sourceExitOperations.has(plan.operation)) {
            out.sourceDeparture = true;
            out.sourceDepartureId = plan.sourceId ?? a.cardId;
        }
        if (['damage', 'wound'].includes(plan.effect)) {
            out.damage = true;
            if (Number.isFinite(plan.count ?? plan.amount))
                out.damageAmount = plan.count ?? plan.amount;
        }
        if (plan.effect === 'sacrifice-character')
            out.sacrificeCharacter = true;
        if (['terminate', 'counter', 'counter-card', 'counter-ability'].includes(plan.effect))
            out.terminatesEntries = (a.targets ?? []).map(t => t.entryId).filter(Boolean);
        if (plan.effect === 'discard-player' || ['informant', 'discard-one', 'name-discard', 'draw-discard-repeat'].includes(plan.operation) || plan.kind === 'discard') {
            const target = (a.targets ?? []).find(t => Number.isInteger(t.player))?.player;
            const player = plan.kind === 'discard' ? plan.player === 'winner' || plan.player === 'self' || plan.player === undefined ? a.controller : plan.player === 'other' ? 1 - a.controller : plan.player : target;
            if (player !== undefined)
                (out.handDiscards ??= []).push({ player, count: plan.count ?? 1 });
        }
        if (['drink-blood', 'conditional-drink'].includes(plan.operation)) {
            const ids = plan.drinkTarget ? (a.targets ?? []).map(t => t.cardId).filter(Boolean) : [plan.sourceId ?? a.cardId].filter(Boolean);
            if (ids.length) {
                out.attachmentHosts = [...new Set([...(out.attachmentHosts ?? []), ...ids])];
                out.drinkBloodPlayer = a.controller;
            }
        }
        if (['attach', 'reattach', 'attach-district'].includes(plan.effect))
            out.attachmentHosts = [...new Set([...(out.attachmentHosts ?? []), ...(a.targets ?? []).map(t => t.cardId).filter(Boolean)])];
        const ownPlayer = plan.player === undefined || plan.player === 'self' || plan.player === 'winner' || plan.player === a.controller;
        if (['draw', 'bottom-to-hand', 'seal-top', 'seal-search', 'mill-self-one', 'top-select-hand'].includes(plan.effect) || plan.operation === 'liliel-discard' || plan.kind === 'draw-both' || plan.kind === 'draw' && ownPlayer)
            out.libraryUse = (out.libraryUse ?? 0) + (plan.count ?? 1);
        if (['draw', 'bottom-to-hand'].includes(plan.effect) || plan.kind === 'draw-both' || plan.kind === 'draw' && ownPlayer)
            out.handGain = (out.handGain ?? 0) + (plan.count ?? 1);
        if (['grant-keyword', 'grant-target-keywords', 'grant-icons-keyword', 'destroy-enemy-attached-then-barrier'].includes(plan.effect) || ['barrier', 'shield', 'cannot-destroy'].some(k => String(plan.operation ?? '').includes(k)))
            out.protectsTargets = true;
        if (['rigoletto-seal'].includes(plan.operation))
            out.removesTargets = true;
        if (plan.operation === 'locked-execution' || plan.effect && (exits.has(plan.effect) || ['damage', 'wound', 'tap', 'untap', 'grant-target-keywords', 'grant-icons-keyword'].includes(plan.effect))) {
            const targetIds = (a.targets ?? []).map(t => t.cardId).filter(Boolean);
            if (targetIds.length)
                (out.targetChanges ??= []).push({ effect: plan.operation === 'locked-execution' ? 'destroy' : plan.effect, targetIds, ...(plan.count !== undefined ? { count: plan.count } : {}), ...(plan.amount !== undefined ? { amount: plan.amount } : {}), ...(plan.grantKeywords ? { grantKeywords: plan.grantKeywords } : {}), ...(plan.defense ? { defense: plan.defense } : {}) });
        }
        for (const child of plan.steps ?? [])
            visit(child);
        for (const child of plan.ops ?? [])
            visit(child);
        if (plan.modeTargets) {
            const chosen = plan.selectedModes ?? (plan.selectedMode ? [plan.selectedMode] : a.mode ? [a.mode] : []);
            for (const id of chosen)
                visit(plan.modeTargets[id]);
        }
    }
    visit(a.plan);
    for (const op of a.ops ?? [])
        visit(op);
    return out;
}
