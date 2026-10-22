import { abilityDescriptionView } from './ability-description.mjs';
import { withDeckShuffleEvents } from './deck-shuffle-events.mjs';
import { graveCards } from './graveyard-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { graveyardLocked } from './derived.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { sealHost } from './sealing.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { cardHasKeyword } from './derived.mjs';
import { controllerOf } from './ownership.mjs';
import { undoSnapshot, restoreTemplateFields, undoCatalogKeys } from './manual.mjs';
import { withRandomTranscript } from './random.mjs';
import { RuleError } from './core.mjs';
let active = null;
class CostChoice extends Error {
    constructor(choice) { super('死亡触发费用选择'); this.choice = choice; }
}
export const isCostChoice = error => error instanceof CostChoice;
function cancelPasses(s, job, log) {
    if (job.cancelApplied)
        return;
    for (const p of job.canceledPasses ?? [])
        s.players[p].autoPass = { mode: 'none', stepKey: null };
    for (const text of job.cancelTexts ?? [])
        log(s, text);
    job.cancelApplied = true;
}
function restore(s, snapshot, logCount) {
    const keep = Object.fromEntries(['lastActivityAt', 'undoFrames', 'logs', 'recentCommands', 'seats', 'manualRequest', 'privateInspections', ...undoCatalogKeys].filter(k => Object.hasOwn(s, k)).map(k => [k, s[k]]));
    for (const k of Object.keys(s))
        delete s[k];
    Object.assign(s, keep, structuredClone(snapshot));
    s.logs = s.logs.slice(0, logCount);
    restoreTemplateFields(s);
}
// The host remains in play until every attached death-cost ability has been
// accepted or declined. Paying the attachment sacrifice precedes host departure.
export function deathAttachmentCosts(s, hostId, loc, group, { move, seal, pay, trigger, registerGroup, log, defer }) {
    const first = s.flow.stepOwner ?? s.turn?.firstPlayer ?? 0;
    for (const sourceId of [first, 1 - first].flatMap(p => s.players[p].play)) {
        const sl = s.locations[sourceId], card = printedRulesCard(s, sourceId), def = card?.automation?.deathCost;
        ;
        if (!def || sl?.zone !== 'play' || sl.faceDown || sl.attachedTo !== hostId || sl.hostVersion !== loc.zoneVersion || abilitiesSuppressed(s, sourceId) || cardHasKeyword(s, sourceId, '永恒'))
            continue;
        if (defer) {
            const controller = controllerOf(s, sourceId), plan = { cost: 0, sacrificeSelf: true, target: 'none', effect: 'batch', operation: 'cross-return', chooseTriggerOrder: true, subjectId: hostId, subjectZoneVersion: loc.zoneVersion, sourceId, sourceZoneVersion: sl.zoneVersion, sourceSnapshot: structuredClone(sl), eventDistrict: loc.district, eventDistrictCardId: s.districts[loc.district]?.id };
            registerGroup(s, group);
            defer({ id: active.command.id + ':cross:' + hostId + ':' + sourceId, kind: 'auto-ability', event: 'death', cardId: sourceId, controller, displayName: card.name, group, mandatory: false, targets: [], plan });
            continue;
        }
        const key = `${hostId}:${loc.zoneVersion}:${sourceId}:${sl.zoneVersion}`, decision = active?.decisions[key];
        if (decision === undefined) {
            if (!active)
                throw new RuleError('该死亡需要通过对局操作完成触发费用选择');
            throw new CostChoice({ id: `death:${active.command.id}:${key}`, key, controller: controllerOf(s, sourceId), sourceId, hostId, sourceVersion: sl.zoneVersion, hostVersion: loc.zoneVersion, sourceName: card.name, hostName: s.cards[hostId].name });
        }
        if (key === active?.lastChoiceKey)
            cancelPasses(s, active, log);
        if (!decision) {
            log(s, `${s.seats[controllerOf(s, sourceId)].name}选择不发动${card.name}的死亡触发。`);
            continue;
        }
        const plan = { target: 'none', effect: 'batch', operation: 'cross-return', chooseTriggerOrder: true, subjectId: hostId, subjectZoneVersion: loc.zoneVersion, sourceId, district: loc.district, eventDistrict: loc.district, eventDistrictCardId: s.districts[loc.district]?.id };
        const controller = controllerOf(s, sourceId);
        log(s, `死亡触发额外费用：牺牲${card.name}；${s.cards[hostId].name}此时仍在场上，费用不能被响应。`);
        move(s, sourceId, 'graveyard', { cause: 'sacrifice' });
        registerGroup(s, group);
        trigger(s, { id: active.command.id + ':' + key, kind: 'auto-ability', event: 'death', cardId: sourceId, controller, displayName: card.name, group, mandatory: false, targets: [], plan });
    }
}
export function runDeathCommand(s, p, c, apply) {
    let job = s.deathContinuation;
    if (job) {
        // Undo is allowed while a payment or continuous choice has suspended play.
        // Its consent request must not be interpreted as an answer to that choice.
        if (c.type === 'manual-request' && c.operation === 'undo' || ['manual-confirm', 'manual-cancel'].includes(c.type) && s.manualRequest?.operation === 'undo')
            return apply(s, p, c);
        if (s.manualRequest?.operation === 'undo')
            throw new RuleError('撤销申请等待对手确认，请先同意、拒绝或取消');
        if (['end-room', 'concede'].includes(c.type)) {
            delete s.deathContinuation;
            return apply(s, p, c);
        }
        if (c.type === 'auto-pass' && c.mode === 'none' && [0, 1].includes(p) && s.players[p]) {
            s.players[p].autoPass = { mode: 'none', stepKey: null };
            job.canceledPasses = [...new Set([...(job.canceledPasses ?? []), p])];
            const text = `${s.seats[p].name}取消自动让过优先权。`;
            job.cancelTexts = [...(job.cancelTexts ?? []), text];
            s.logs.push({ id: (s.logs.at(-1)?.id ?? 0) + 1, round: s.round, text });
            return;
        }
        const choice = job.choice;
        if (['influence-cancellation', 'influence-removal'].includes(choice.kind)) {
            const own = choice.playerChoices.find(x => x.controller === p), picks = c.allocations;
            if (c.type !== 'influence-choice' || c.choiceId !== choice.id || !own || Object.hasOwn(choice.committed, p) || !Array.isArray(picks) || new Set(picks.map(x => x?.id)).size !== picks.length || !picks.every(x => x && Number.isSafeInteger(x.amount) && x.amount > 0 && own.options.some(o => o.id === x.id && x.amount <= o.count)) || picks.reduce((n, x) => n + x.amount, 0) !== own.count)
                throw new RuleError('请选择恰好所需数量的本方势力标志；当前没有快速行动窗口');
            const committed = { ...choice.committed, [p]: structuredClone(picks) };
            if (choice.playerChoices.some(x => !Object.hasOwn(committed, x.controller))) {
                job.choice = { ...choice, committed };
                return;
            }
            const partial = structuredClone(s);
            job = { ...job, lastChoiceKey: choice.key, cancelApplied: false, decisions: { ...job.decisions, [choice.key]: committed } };
            restore(s, job.before, job.logCount);
            if (job.command.type === 'manual-confirm')
                s.manualRequest = structuredClone(job.manualRequest);
            try {
                return attempt(s, job, apply);
            }
            catch (e) {
                for (const k of Object.keys(s))
                    delete s[k];
                Object.assign(s, partial);
                throw e;
            }
        }
        else if (['well-capture', 'command-post-order', 'grave-continuous-order'].includes(choice.kind)) {
            if (c.type !== 'continuous-source-choice' || p !== choice.controller || c.choiceId !== choice.id || !choice.sources.some(x => x.id === c.sourceId))
                throw new RuleError('请先选择持续能力来源；当前没有快速行动窗口');
        }
        else if (['shoggoth-core-return', 'dragon-blood-seal'].includes(choice.kind)) {
            if (c.type !== 'continuous-choice' || p !== choice.controller || c.choiceId !== choice.id || typeof c.fire !== 'boolean')
                throw new RuleError('请完成持续能力选择；当前没有快速行动窗口');
        }
        else if (choice.kind === 'silence-pay') {
            if (c.type !== 'continuous-choice' || p !== choice.controller || c.choiceId !== choice.id || typeof c.fire !== 'boolean' || c.fire && !Array.isArray(c.cardIds))
                throw new RuleError('请完成缄默的横置费用选择');
        }
        else if (choice.kind === 'silence-order') {
            if (c.type !== 'continuous-source-choice' || p !== choice.controller || c.choiceId !== choice.id || !choice.sources.some(x => x.id === c.sourceId))
                throw new RuleError('请选择先适用的缄默');
        }
        else if (choice.kind === 'mage-tap-cost') {
            if (c.type !== 'continuous-choice' || p !== choice.controller || c.choiceId !== choice.id || !Array.isArray(c.cardIds))
                throw new RuleError('请完成德莫斯提尼的横置额外费用选择');
        }
        else if (choice.kind === 'trigger-cost-batch') {
            if (c.type !== 'trigger-cost-batch-choice' || p !== choice.controller || c.choiceId !== choice.id || !Array.isArray(c.decisions))
                throw new RuleError('请一次确认本批触发费用；当前没有快速行动窗口');
        }
        else if (choice.kind === 'trigger-cost') {
            if (c.type !== 'trigger-cost-choice' || p !== choice.controller || c.choiceId !== choice.id || typeof c.fire !== 'boolean')
                throw new RuleError('请先决定是否支付触发费用；当前没有快速行动窗口');
        }
        else if (choice.kind === 'command-post-tax') {
            if (c.type !== 'continuous-choice' || p !== choice.controller || c.choiceId !== choice.id || typeof c.fire !== 'boolean')
                throw new RuleError('请先选择是否支付锁定费用；当前没有快速行动窗口');
        }
        else if (choice.kind === 'reset-tax') {
            if (c.type !== 'reset-tax-choice' || p !== choice.controller || c.choiceId !== choice.id || typeof c.fire !== 'boolean')
                throw new RuleError('请先选择是否支付重置费用；当前没有快速行动窗口');
        }
        else if (choice.kind === 'death-destination') {
            if (c.type !== 'continuous-choice' || p !== choice.controller || c.choiceId !== choice.id || typeof c.fire !== 'boolean')
                throw new RuleError('请先选择死亡去向；当前没有快速行动窗口');
        }
        else if (choice.kind === 'draw-replacement') {
            const source = choice.sources.find(x => x.id === c.sourceId);
            if (c.type !== 'draw-replacement-choice' || p !== choice.controller || c.choiceId !== choice.id || !(c.sourceId === null || source && (source.cardIds.length ? source.cardIds.includes(c.cardId) : c.cardId === null)))
                throw new RuleError('请先完成心脑系统重塑实验室的抓牌替代选择');
        }
        else if (choice.kind === 'discard-replacement') {
            if (c.type !== 'discard-replacement-choice' || p !== choice.controller || c.choiceId !== choice.id || !(c.cardId === null || choice.cardIds.includes(c.cardId) && ['top', 'bottom'].includes(c.destination ?? 'top')))
                throw new RuleError('请先完成卡迪纳家族的弃牌替代选择');
        }
        else if (c.type !== 'death-cost-choice' || p !== choice.controller || c.choiceId !== choice.id || typeof c.fire !== 'boolean')
            throw new RuleError('请先完成辟邪十字架死亡触发的费用选择；当前没有快速行动窗口');
        const partial = structuredClone(s);
        job = { ...job, lastChoiceKey: choice.key, cancelApplied: false, decisions: { ...job.decisions, [choice.key]: ['well-capture', 'command-post-order', 'grave-continuous-order'].includes(choice.kind) || choice.kind === 'silence-order' ? c.sourceId : ['mage-tap-cost'].includes(choice.kind) ? structuredClone(c.cardIds) : choice.kind === 'silence-pay' ? { fire: c.fire, cardIds: structuredClone(c.cardIds ?? []) } : choice.kind === 'draw-replacement' ? (c.sourceId === null ? null : { sourceId: c.sourceId, cardId: c.cardId }) : ['trigger-cost', 'trigger-cost-batch'].includes(choice.kind) ? structuredClone(c) : choice.kind === 'discard-replacement' ? (c.cardId === null ? null : { cardId: c.cardId, destination: c.destination ?? 'top' }) : c.fire } };
        restore(s, job.before, job.logCount);
        // Consent is consumed before a draw can pause. Replay must restore the
        // already-approved request, without asking the opponent a second time.
        if (job.command.type === 'manual-confirm')
            s.manualRequest = structuredClone(job.manualRequest);
        try {
            return attempt(s, job, apply);
        }
        catch (e) {
            for (const k of Object.keys(s))
                delete s[k];
            Object.assign(s, partial);
            throw e;
        }
    }
    job = { player: p, command: structuredClone(c), manualRequest: structuredClone(s.manualRequest ?? null), before: null, logCount: s.logs.length, tape: [], decisions: {} };
    return attempt(s, job, apply);
}
function attempt(s, job, apply) {
    const previous = active;
    active = job;
    job.influenceOrdinal = 0;
    try {
        return withDeckShuffleEvents(s, () => withRandomTranscript(job.tape, () => {
            try {
                const result = apply(s, job.player, job.command, job);
                cancelPasses(s, job, (s, text) => s.logs.push({ id: (s.logs.at(-1)?.id ?? 0) + 1, round: s.round, text }));
                return result;
            }
            catch (e) {
                if (!(e instanceof CostChoice))
                    throw e;
                job.before ??= undoSnapshot(s);
                job.choice = e.choice;
                s.deathContinuation = job;
                s.flow.locked = true;
            }
        }));
    }
    finally {
        active = previous;
    }
}
export function deathCostView(s, viewer) {
    const a = s.deathContinuation?.choice;
    ;
    if (a && ['silence-pay', 'silence-order'].includes(a.kind))
        return { id: a.id, kind: a.kind, controller: a.controller, sourceName: a.sourceName, ...(viewer === a.controller ? { groups: a.groups, sources: a.sources } : {}) };
    ;
    if (a?.kind === 'mage-tap-cost')
        return { id: a.id, kind: a.kind, controller: a.controller, sourceName: a.sourceName, ...(viewer === a.controller ? { max: a.max, cards: a.cards } : {}) };
    if (a && ['influence-cancellation', 'influence-removal'].includes(a.kind)) {
        const own = a.playerChoices.find(x => x.controller === viewer), done = Object.hasOwn(a.committed, viewer);
        return { id: a.id, kind: a.kind, sourceName: a.sourceName, district: a.district, districtNumber: a.districtNumber, controller: own && !done ? viewer : null, done, waitingPlayers: a.playerChoices.filter(x => !Object.hasOwn(a.committed, x.controller)).map(x => x.controller), ...(own && !done ? { count: own.count, options: own.options } : {}) };
    }
    ;
    if (a?.kind === 'trigger-cost-batch')
        return { id: a.id, kind: a.kind, controller: a.controller, sourceName: a.sourceName, ...(viewer === a.controller ? { abilities: a.abilities.map(x => ({ ...x, abilityDescription: abilityDescriptionView(s, x, viewer) })), available: a.available } : {}) };
    if (a?.kind === 'trigger-cost')
        return { id: a.id, kind: a.kind, controller: a.controller, sourceName: a.sourceName, ...(viewer === a.controller ? { ability: { ...a.ability, abilityDescription: abilityDescriptionView(s, a.ability, viewer) }, available: a.available, targetOptions: a.targetOptions } : {}) };
    return a ? { id: a.id, kind: a.kind, controller: a.controller, sourceName: a.sourceName, hostName: a.hostName, ...(a.kind === 'death-destination' && a.fallbackLabel ? { fallbackLabel: a.fallbackLabel } : {}), ...(a.kind === 'command-post-tax' ? { sourceId: a.sourceId, sourceController: a.sourceController, amount: a.amount, available: a.available, cannotTerminate: a.cannotTerminate, paid: a.paid, total: a.total } : {}), ...(['well-capture', 'command-post-order', 'grave-continuous-order'].includes(a.kind) ? { sources: a.sources } : {}), ...(a.kind === 'reset-tax' ? { paid: a.paid, total: a.total, available: a.available } : {}), ...({}), ...(a.kind === 'draw-replacement' ? { count: a.count, memoryPending: !!a.memoryPending, sources: a.sources.map(x => ({ id: x.id, name: s.cards[x.id]?.name ?? x.name, cards: x.cardIds.map(id => ({ id, name: s.cards[id].name, text: s.cards[id].text })) })) } : {}), ...({}), ...(a.kind === 'discard-replacement' ? { cards: a.cardIds.map(id => ({ id, name: s.cards[id].name, text: s.cards[id].text })), player: a.player } : {}) } : null;
}
// Discard replacements share the existing deterministic command replay, so a
// decision pauses the original effect without opening a response window.
export function discardReplacementDecision(s, key, choice) {
    const answer = active?.decisions[key];
    if (answer !== undefined)
        return answer;
    if (!active)
        throw new RuleError('弃牌替代需要通过对局操作完成');
    throw new CostChoice({ id: `discard:${active.command.id}:${key}`, key, kind: 'discard-replacement', ...choice });
}
export function drawReplacementDecision(s, key, choice) {
    const answer = active?.decisions[key];
    if (answer !== undefined)
        return answer;
    if (!active)
        throw new RuleError('抓牌替代需要通过对局操作完成');
    throw new CostChoice({ id: `draw:${active.command.id}:${key}`, key, kind: 'draw-replacement', ...choice });
}
// Immediate continuous abilities use the same replay boundary as extra costs.
// The original effect resumes with every earlier random result and choice fixed.
export function continuousDecision(s, key, choice) {
    const answer = active?.decisions[key];
    if (answer !== undefined)
        return answer;
    if (!active)
        throw new RuleError('持续能力选择需要通过对局操作完成');
    throw new CostChoice({ id: `continuous:${active.command.id}:${key}`, key, ...choice });
}
// An ordinal distinguishes identical cancellations repeated inside one effect.
// It resets on replay, while submitted allocations remain on the command job.
export function influenceDecision(s, choice) {
    if (!active)
        throw new RuleError('势力抵消或移除选择需要通过对局操作完成');
    const key = `influence:${++active.influenceOrdinal}:${choice.districtCardId}:${choice.kind}`;
    return continuousDecision(s, key, choice);
}
// A paid trigger is committed at its event; stack placement waits for its round.
export function triggerCostDecision(s, ability, targetOptions = []) { return continuousDecision(s, `trigger-cost:${ability.id}`, { kind: "trigger-cost", controller: ability.controller, sourceName: ability.displayName, ability: structuredClone(ability), targetOptions, reservedRefs: structuredClone(s.costSacrificeReservations ?? []), available: (s.players[ability.controller].costPool ?? 0) + s.players[ability.controller].assets.filter(a => !a.tapped).length }); }
export function triggerCostBatchDecision(s, abilities) { return continuousDecision(s, `trigger-cost-batch:${abilities.map(a => a.id).join('|')}`, { kind: 'trigger-cost-batch', controller: abilities[0].controller, sourceName: '牺牲 · 批量触发费用', abilities: structuredClone(abilities), reservedRefs: structuredClone(s.costSacrificeReservations ?? []), available: (s.players[abilities[0].controller].costPool ?? 0) + s.players[abilities[0].controller].assets.filter(a => !a.tapped).length }); }
