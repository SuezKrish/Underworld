import {compareCardOrder} from './card-order.mjs';
import { printedSealedFace } from './sealed-face.mjs';
import { splitCardRules } from './card-text-format.mjs';
import { scoreValue } from './scoring.mjs';
// A record combines information available to either seat, never the server's
// complete state. Libraries expose counts only, including after a game ends.
const cardFields = ['id', 'catalogId', 'name', 'displayName', 'type', 'subtypes', 'subtitle', 'faction', 'color', 'unique', 'token', 'printedCost', 'printedCostText', 'loyalty', 'magicDomains', 'icons', 'temporaryIcons', 'defense', 'text', 'faq', 'flavorText', 'keywords', 'traits', 'points', 'threshold', 'destroyed', 'influence'];
const locationFields = ['zone', 'controller', 'district', 'faceDown', 'secretPlan', 'tapped', 'counters', 'markers', 'timeMarkers', 'damage', 'wounds', 'attachedTo', 'hostId', 'hostVersion', 'zoneVersion', 'clubInfluence'];
const pick = (value, fields) => Object.fromEntries(fields.filter(k => value?.[k] !== undefined).map(k => [k, structuredClone(value[k])]));
export function knownInformation(s) {
    const zones = ['hand', 'play', 'graveyard', 'headquarters', 'assets', 'aside', 'core', 'scoreCards'];
    const known = new Set();
    const know = value => {
        const c = typeof value === 'string' ? s.cards[value] : s.cards[value?.id] ?? value;
        if (c?.id && !['deck', 'world-deck'].includes(s.locations?.[c.id]?.zone))
            known.add(c.id);
    };
    for (const p of s.players)
        for (const zone of zones)
            for (const value of p[zone] ?? [])
                know(value);
    for (const c of [...s.societies ?? [], ...s.districts ?? []].filter(Boolean))
        know(c);
    for (const [i, c] of (s.coreAreas ?? []).entries())
        if (c)
            know(c.id ?? `core-area:${i}`);
    for (const [id, l] of Object.entries(s.locations ?? {}))
        if (l.zone === 'sealed' && (!l.faceDown || [0, 1].includes(s.cards[id]?.owner)))
            know(id);
    for (const a of s.flow?.stack ?? [])
        if (['play-spell', 'play-character', 'reveal-character'].includes(a.kind) && [0, 1].includes(a.controller))
            know(a.cardId);
    const card = (value, extra = {}) => {
        const c = typeof value === 'string' ? s.cards[value] : value;
        if (!c)
            return null;
        if (!known.has(c.id))
            return null;
        const face = printedSealedFace(c), loc = s.locations?.[c.id], controller = loc?.controller ?? c.owner;
        return { ...pick(face, cardFields), ...splitCardRules(face.text ?? '', face.faq), ...pick(loc, locationFields), owner: c.owner, ownerName: s.seats[c.owner]?.name, controller, controllerName: s.seats[controller]?.name, ...extra };
    };
    const list = values => (values ?? []).map(v => card(typeof v === 'string' ? v : s.cards[v.id] ?? v, typeof v === 'object' ? pick(v, [...cardFields, ...locationFields]) : {})).filter(Boolean);
    return {
        players: s.players.map((p, i) => ({ name: s.seats[i]?.name, markers: structuredClone(p.markers), honor: p.honor ?? 0, costPool: p.costPool ?? 0, score: (p.scoreCards ?? []).reduce((n, c) => n + scoreValue(c), 0), deckCount: p.deck.length, coreArea: s.coreAreas?.[i] ? card(s.coreAreas[i].id ?? `core-area:${i}`) : null, ...Object.fromEntries(zones.map(zone => [zone, list(p[zone])])) })),
        societies: (s.societies ?? []).map((c, i) => card(c, pick(s.societyStates?.[i], locationFields))).filter(Boolean), districts: list((s.districts ?? []).filter(Boolean)), worldDeckCount: s.worldDeck?.length ?? 0,
        sealed: Object.keys(s.locations ?? {}).filter(id => s.locations[id].zone === 'sealed').map(id => card(id)).filter(Boolean),
        cards: [...known].map(id => card(s.cards[id] ?? [...s.societies ?? [], ...s.districts ?? [], ...s.players.flatMap(p => p.scoreCards ?? [])].find(c => c?.id === id))).filter(Boolean).sort(compareCardOrder),
        stack: (s.flow?.stack ?? []).map(a => ({ id: a.id, kind: a.kind, controller: a.controller, cardId: known.has(a.cardId) ? a.cardId : undefined, sourceId: known.has(a.sourceId) ? a.sourceId : undefined, displayName: a.displayName, targets: (a.targets ?? []).map(t => pick(t, ['kind', 'cardId', 'district', 'player', 'entryId'])), abilityLabel: a.plan?.abilityLabel, card: card(a.cardId ?? a.sourceId) })),
    };
}
export function finishedInformation(s) { return s.status === 'finished' ? knownInformation(s) : null; }
export function finishedRoomView(view) {
    // Old rooms can still have ordered inspections or interrupted choices. Use
    // a read-only allowlist rather than forwarding those windows or Bot memory.
    const fields = ['code', 'revision', 'mode', 'rulesVersion', 'triggerTiming', 'status', 'worldCardCount', 'worldDeckCount', 'result', 'createdAt', 'endedAt', 'canDelete', 'logCount', 'recordComplete', 'deckSelections', 'deckRequired', 'seat', 'seats', 'round', 'players', 'societies', 'districts', 'logs', 'finishedInformation', 'manualWithoutConsent', 'undoAvailable', 'undoLabel'];
    const turn = view.turn ? pick(view.turn, ['phase', 'phaseLabel', 'step', 'stepLabel', 'extraBattle', 'firstPlayer', 'privilegeUsed', 'district', 'districtNumber', 'kind', 'contestLabel', 'lastContest', 'priorityStepKey', 'priorityStepLabel']) : null;
    const publicView = pick(view, fields);
    for (const [i, p] of (publicView.players ?? []).entries()) {
        const known = view.finishedInformation?.players[i], reveal = card => ({ ...card, recordFaceDown: card.faceDown, recordSecretPlan: card.secretPlan, faceDown: false, secretPlan: false });
        p.hand = (known?.hand ?? p.hand ?? []).map(reveal);
        p.play = (p.play ?? []).map(({ hiddenHandle, ...card }, j) => reveal({ ...card, ...known?.play[j] }));
    }
    return { ...publicView, logs: view.logs, bot: view.bot ? pick(view.bot, ['id', 'seat', 'difficulty', 'name', 'deckName']) : null, turn: turn ? { ...turn, standardAllowed: false, returnCardIds: [] } : null,
        flow: { ...pick(view.flow, ['priority', 'stepOwner']), locked: true, stack: (view.finishedInformation?.stack ?? []).map(a => ({ ...a, canBeTerminated: false })) },
        currentTargets: [], pendingChoiceCount: 0, triggerChoices: [], pendingTriggers: [], publicActions: [], environmentTriggers: [], districtActions: [], abyssHandActions: [], abyssFieldActions: [], abyssTriggers: [], zoneActions: [], monitorTargets: [], ownedReturnCandidates: [],
        triggerRound: null, deathCostChoice: null, keeperChoice: null, roundChoice: null, ruleChoice: null, effectChoice: null, environmentChoice: null, triggerOrderChoice: null, damageChoice: null, hidden: null, battle: null, inspection: null, cardInspection: null, manualRequest: null, manualSelection: null };
}
export function roomRecord(s, code, createdAt = s.createdAt ?? null) {
    return { format: 'under-world-record', version: 2, code, status: s.status, players: s.seats.map(p => p ? { name: p.name } : null), createdAt, endedAt: s.endedAt ?? null, result: s.result ?? null, rulesVersion: s.rulesVersion, triggerTiming: s.triggerTiming ?? 'legacy', complete: !s.logs.length || s.logs[0].id === 1, logs: s.logs, information: finishedInformation(s) };
}
