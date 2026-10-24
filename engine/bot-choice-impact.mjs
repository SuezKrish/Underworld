// Choice kinds are engine operations, not names of cards. A negative choice
// must not fall into the same value-maximizing fallback as search/recovery.
const discard = new Set(['discard', 'discard-deck-multiple', 'reality-crow-discard', 'reality-liliel-discard', 'criminal-kormir-discard', 'discard-deck-discard', 'discard-deck-named-discard']);
const sacrifice = new Set(['sacrifice', 'gray-sacrifice', 'batch-priest-sacrifice', 'batch-sacrifice-hidden', 'batch-sacrifice', 'discard-deck-plan-sacrifice', 'death-deck-sacrifice', 'fate-sacrifice']);
export function negativeChoiceImpact(choice) {
    if (choice.impact?.beneficiary === 'self' && choice.impact?.direction === 'loss')
        return choice.impact;
    if (discard.has(choice.kind))
        return { kind: 'discard' };
    if (sacrifice.has(choice.kind))
        return { kind: 'sacrifice' };
    if (['seal-hand', 'cq-house-seal', 'discard-deck-hallucination'].includes(choice.kind))
        return { kind: 'seal' };
    if (choice.kind === 'starlight-torment')
        return { kind: 'wound', amount: 1, afterHidden: true };
    if (choice.kind === 'batch-ambusher-wound')
        return { kind: 'wound', amount: 1 };
    return null;
}
