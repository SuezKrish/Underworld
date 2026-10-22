// Win-rate cohorts always exclude only the new Anglican society action.
// Live test-mode games retain that branch; all other societies remain active.
export const BOT_EVALUATION_SOCIETY_POLICY = 'disable-new-anglican-action';
const anglicanAction = id => ['anglican-influence', 'anglican-offline-influence'].includes(id);
export const evaluationSocietyActions = actions => actions?.map(a => anglicanAction(a.id) ? { ...a, botDisabled: true } : a);
export function evaluationBotPolicy(policy) {
    return view => {
        const societies = view.societies?.map(s => s ? { ...s, actions: evaluationSocietyActions(s.actions) } : s);
        return policy({ ...view, societies }).filter(c => c.type !== 'society-action' || !anglicanAction(c.abilityId));
    };
}
