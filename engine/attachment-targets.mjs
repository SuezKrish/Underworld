// Establishing an attachment relation is not a targeting event. Its legal host
// still respects barrier according to the attachment's owner, not its controller.
export function establishesAttachment(plan = {}) {
    return ['attach', 'reattach', 'attach-society', 'attach-district', 'attach-entropy'].includes(plan.effect)
        || plan.operation === 'attach-modal';
}
export function attachmentSelectionOwner(s, p, plan = {}) {
    if (!establishesAttachment(plan))
        return p;
    return s.cards[plan.cardId ?? plan.sourceId]?.owner ?? p;
}
