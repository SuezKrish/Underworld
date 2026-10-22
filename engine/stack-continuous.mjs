export const stackSources = (s, rule, p) => s.flow.stack.filter(a => a.kind === 'play-spell' && false === rule && (p === undefined || a.controller === p));
export const stackCastRestriction = () => null;
export const stackResponsesBlocked = s => s.flow.stack.some(a => a.plan?.noResponse);
export const prepareRepeatedResolution = (s, a) => a;
