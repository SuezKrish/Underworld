import { RuleError } from './core.mjs';
// Keep commitments on the server. Projections expose only a player's own prompt.
export function simultaneousChoice(s, choose, spell, kind, choices, extra = {}) {
    const participants = choices.filter(x => x.cardIds?.length || x.options?.length || x.min === 0 || x.freeChoice);
    if (!participants.length)
        return false;
    const first = participants[0];
    choose(s, spell, kind, first.controller, first.cardIds ?? [], { ...first, ...extra, simultaneous: true, playerChoices: structuredClone(participants), committed: {}, public: false });
    return true;
}
export function seatChoice(choice, p) {
    if (!choice?.simultaneous)
        return choice;
    const own = choice.playerChoices.find(x => x.controller === p), done = Object.hasOwn(choice.committed, p);
    const common = { ...choice };
    for (const key of new Set(choice.playerChoices.flatMap(x => Object.keys(x))))
        delete common[key];
    return { ...common, ...own, id: own?.id ?? choice.id, controller: own && !done ? p : null, cardIds: own && !done ? own.cardIds ?? [] : [], options: own && !done ? own.options : undefined, public: false, allowed: !!own && !done, done };
}
export function choicePending(choice, p) { return !choice?.simultaneous ? choice?.controller === p : choice.playerChoices.some(x => x.controller === p) && !Object.hasOwn(choice.committed, p); }
export function commitChoice(choice, p, command, validate) {
    if (!choicePending(choice, p))
        throw new RuleError('你已锁定选择，或没有属于你的选择');
    const own = choice.playerChoices.find(x => x.controller === p);
    validate(own, command);
    choice.committed[p] = structuredClone(command);
    const next = choice.playerChoices.find(x => !Object.hasOwn(choice.committed, x.controller));
    if (next) {
        Object.assign(choice, { ...next, controller: next.controller, cardIds: next.cardIds ?? [] });
        return null;
    }
    return choice.playerChoices.map(x => ({ choice: x, command: choice.committed[x.controller], player: x.controller }));
}
export function withSimultaneousDepartures(s, ids, apply) {
    const previous = s.simultaneousDepartureIds;
    s.simultaneousDepartureIds = [...new Set([...(previous ?? []), ...ids])];
    try {
        return apply();
    }
    finally {
        if (previous)
            s.simultaneousDepartureIds = previous;
        else
            delete s.simultaneousDepartureIds;
    }
}
