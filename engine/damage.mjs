import { battleDamageRecipient } from './field-completion-rules.mjs';
import { uuid } from './random.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { noteAssaultLethal } from './assault.mjs';
import { effectiveDefense } from './rounds.mjs';
import { recordFieldEvent } from './field-events.mjs';
import { hasCardType } from './card-types.mjs';
import { spiritPreventsDamage, cardHasKeyword } from './derived.mjs';
import { controllerOf } from './ownership.mjs';
import { RuleError } from './core.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
function replacements(s, job) {
    const id = job.targetId, l = s.locations[id];
    if (l?.zone !== 'play' || l.faceDown || l.zoneVersion !== job.targetVersion)
        return [];
    const out = [], player = controllerOf(s, id);
    if (job.kind !== 'battle' && printedRulesCard(s, id).automation?.static === 'prevent-nonbattle-damage')
        out.push({ id: 'nonbattle:' + id + ':' + l.zoneVersion, controller: player, kind: 'prevent', label: '防止非战斗伤害' });
    if (job.kind !== 'battle')
        for (const source of [])
            out.push({ id: `thunder:${source}:${s.locations[source].zoneVersion}`, controller: player, kind: 'prevent', label: '建御雷神 · 防止非战斗伤害' });
    if (spiritPreventsDamage(s, id))
        out.push({ id: `spirit:${id}:${l.zoneVersion}`, controller: player, kind: 'prevent', label: `${s.cards[id].name}的灵体防伤` });
    for (const [i, e] of (s.effects ?? []).entries())
        if (e.kind === 'prevent-damage' && e.targetId === id && e.targetZoneVersion === l.zoneVersion)
            out.push({ id: `prevent:${i}`, controller: e.controller ?? player, kind: 'prevent', label: '防止本次伤害' });
    if (!cardHasKeyword(s, id, '灵体'))
        for (const source of s.players[player].play) {
            const sl = s.locations[source];
            if (sl.zone === 'play' && !sl.faceDown && sl.district === l.district && hasCardType(s.cards[source], 'character') && printedRulesCard(s, source).automation?.static === 'guardian-damage-redirect')
                out.push({ id: `guardian:${source}:${sl.zoneVersion}`, controller: player, kind: 'redirect', targetId: source, targetVersion: sl.zoneVersion, label: `将伤害改为对${s.cards[source].name}造成` });
        }
    for (const source of s.players.flatMap(p => p.play)) {
        const sl = s.locations[source];
        if (sl.zone === 'play' && !sl.faceDown && sl.attachedTo === id && sl.hostVersion === l.zoneVersion && printedRulesCard(s, source).automation?.static === 'attached-host-damage-redirect')
            out.push({ id: 'attached-guardian:' + source + ':' + sl.zoneVersion, controller: controllerOf(s, source), kind: 'redirect', targetId: source, targetVersion: sl.zoneVersion, label: '将伤害改为对' + s.cards[source].name + '造成' });
    }
    const unused = out.filter(x => !job.applied.includes(x.id) && (!job.unpreventable || x.kind !== 'prevent')), first = s.flow?.stepOwner ?? s.turn?.firstPlayer ?? 0;
    return unused.filter(x => x.controller === (unused.some(x => x.controller === first) ? first : 1 - first));
}
function apply(s, job, replacement) {
    job.applied.push(replacement.id);
    if (replacement.kind === 'prevent')
        job.amount = 0;
    else {
        job.targetId = replacement.targetId;
        job.targetVersion = replacement.targetVersion;
    }
}
export function resolveDamageQueue(s) {
    s.damageQueue ??= [];
    while (s.damageQueue.length) {
        const job = s.damageQueue[0], loc = s.locations[job.targetId];
        if (!job.amount || loc?.zone !== 'play' || loc.faceDown || loc.zoneVersion !== job.targetVersion) {
            s.damageQueue.shift();
            continue;
        }
        const options = replacements(s, job);
        if (options.length > 1) {
            s.damageChoice ??= { id: uuid(), controller: options[0].controller };
            s.damageChoice = { ...s.damageChoice, amount: job.amount, targetName: s.cards[job.targetId].name, options };
            s.flow.locked = true;
            return false;
        }
        if (options.length) {
            apply(s, job, options[0]);
            continue;
        }
        const before = effectiveDefense(s, job.targetId) - (loc.damage ?? 0);
        loc.damage = (loc.damage ?? 0) + job.amount;
        if (before > 0 && job.amount >= before)
            loc.lethalChange = { kind: 'damage', damageKind: job.kind };
        if (job.assault && before > 0)
            noteAssaultLethal(s, job.targetId, job.assault);
        recordFieldEvent(s, job.targetId, 'damaged', { amount: job.amount, damageKind: job.kind });
        s.damageQueue.shift();
    }
    s.damageChoice = null;
    return true;
}
export function dealDamage(s, id, amount, kind = 'effect', { unpreventable = false, assault } = {}) {
    if (amount <= 0)
        return;
    const l = s.locations[id];
    if (l?.zone !== 'play' || l.faceDown || !(hasCardType(s.cards[id], 'character') || kind === 'battle' && battleDamageRecipient(s, id)))
        return;
    s.damageQueue ??= [];
    s.damageQueue.push({ targetId: id, targetVersion: l.zoneVersion, amount, kind, unpreventable, assault, applied: [] });
    if (!s.damageChoice)
        resolveDamageQueue(s);
}
export function chooseDamageReplacement(s, p, c) { const choice = s.damageChoice; need(choice && choice.id === c.choiceId && choice.controller === p, '当前没有属于你的伤害替代选择'); const replacement = replacements(s, s.damageQueue[0]).find(x => x.id === c.replacementId); need(replacement, '所选替代效果不再合法'); apply(s, s.damageQueue[0], replacement); s.damageChoice = null; return resolveDamageQueue(s); }
