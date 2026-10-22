// Point modifiers were applied during the comparison. Every remaining hidden
// effect is offered with ordinary end-of-contest triggers, above the return rule.
export function hiddenTriggersAfterContest(s, hidden, winner) {
    return (hidden.triggeredAbilities ?? hidden.stackedAbilities ?? []).filter(a => a.kind !== 'rule-return-aside').flatMap(a => {
        const p = a.controller, sourceId = a.sourceId ?? a.cardId, card = s.cards[sourceId], loc = s.locations[sourceId];
        if (a.onlyWinner && p !== winner || a.condition === 'assets-yellow' && !s.players[p].assets.some(x => (x.factionColors ?? [x.faction?.split('·')[0]]).includes('黄')))
            return [];
        const plan = { ...a.plan };
        if (plan.requiredSocietyName && s.societies?.[p]?.name !== plan.requiredSocietyName || plan.requiredYellowAssets !== undefined && s.players[p].assets.filter(x => (x.factionColors ?? [x.faction?.split('·')[0]]).includes('黄')).length < plan.requiredYellowAssets)
            return [];
        if (!a.plan)
            return [{ ...a, cardId: sourceId, effect: a.effect ?? { kind: 'hidden-legacy' }, event: 'hidden-ended' }];
        delete plan.hiddenTargetSelection;
        if (plan.hiddenActivationCost !== undefined) {
            plan.cost = plan.hiddenActivationCost;
            plan.triggerCost = true;
            delete plan.hiddenActivationCost;
        }
        return [{ ...a, kind: 'auto-ability', cardId: sourceId, sourceId, event: 'hidden-ended', displayName: `${card?.name ?? a.displayName} · 隐秘能力`,
                plan: { ...plan, hiddenAbility: true, abilityLabel: '隐秘能力', sourceId, sourceVersion: plan.sourceVersion ?? loc?.zoneVersion, sourceZoneVersion: loc?.zoneVersion, sourceSnapshot: loc ? { ...loc, controller: p } : undefined, hiddenWon: p === winner }, targets: [] }];
    });
}
