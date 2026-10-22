import { graveZones } from './graveyard-rules.mjs';
import { continuousDecision } from './death-costs.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { controllerOf } from './ownership.mjs';
import { sealHost } from './sealing.mjs';
import { canTerminate } from './holy-deck-rules.mjs';
import { settleTerminatedCard } from './terminated-card.mjs';
import { RuleError } from './core.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const available = (s, p) => (s.players[p].costPool ?? 0) + s.players[p].assets.filter(a => !a.tapped).length;
function fieldSources(s, key) { const first = s.flow.stepOwner ?? s.turn?.firstPlayer ?? 0; return [first, 1 - first].flatMap(p => s.players[p].play).filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && printedRulesCard(s, id)?.automation?.[key]); }
function chooseSource(s, key, kind, sources) {
    if (sources.length === 1)
        return sources[0];
    const controller = controllerOf(s, sources[0]), options = sources.filter(id => controllerOf(s, id) === controller);
    if (options.length === 1)
        return options[0];
    const sourceId = continuousDecision(s, key, { kind, controller, sourceName: ['well-capture', 'grave-continuous-order'].includes(kind) ? '枯井' : '临时指挥部', sources: options.map(id => ({ id, name: s.cards[id].name, district: s.locations[id].district })) });
    need(options.includes(sourceId), '请选择当前仍可适用的持续能力来源');
    return sourceId;
}
// Taxes happen after normal payment/announcement, before any response window.
// Refusing terminates the pending paid flip, never an effect-driven reveal.
export function commandPostTax(s, entry, { pay, move, log }) {
    if (!entry || entry.kind !== 'reveal-character')
        return;
    const l = s.locations[entry.cardId], amount = l?.counters?.locked ?? 0;
    if (!(amount > 0))
        return;
    let remaining = fieldSources(s, 'paidRevealLockTax'), index = 0;
    while (remaining.length && s.flow.stack.some(a => a.id === entry.id)) {
        const sourceId = chooseSource(s, `command-order:${entry.id}:${index}`, 'command-post-order', remaining), version = s.locations[sourceId].zoneVersion;
        const fire = continuousDecision(s, `command-tax:${entry.id}:${sourceId}:${version}`, { kind: 'command-post-tax', sourceId, sourceController: controllerOf(s, sourceId), controller: entry.controller, sourceName: s.cards[sourceId].name, hostName: s.cards[entry.cardId].name, amount, available: available(s, entry.controller), cannotTerminate: !canTerminate(s, entry), paid: index, total: remaining.length + index });
        if (fire) {
            pay(s, entry.controller, amount);
            log(s, `${s.seats[entry.controller].name}支付${amount}点锁定费用（${s.cards[sourceId].name}）。`);
        }
        else if (canTerminate(s, entry)) {
            s.flow.stack = s.flow.stack.filter(a => a.id !== entry.id);
            settleTerminatedCard(s, entry, move);
            log(s, `临时指挥部：未支付${amount}点锁定费用，终止本次付费翻面。`);
        }
        else
            log(s, '临时指挥部：未支付锁定费用，但本次付费翻面不能被终止。');
        remaining = remaining.filter(id => id !== sourceId);
        index++;
    }
}
export function wellCaptureSources(s, id, { from, player, cause, zone, rumor }) {
    if (!rumor)
        return [];
    const discard = from === 'hand' && ['discard', 'cost', 'hand-limit'].includes(cause), mill = from === 'deck' && ['graveyard', 'headquarters'].includes(zone);
    if (!discard && !mill)
        return [];
    return fieldSources(s, 'capturesEnemyRumor').filter(well => controllerOf(s, well) !== player && (discard || graveZones(s, s.cards[id].owner, well).includes(zone)));
}
export function captureWithWell(s, id, refs, key, { seal, log, immediateEntry }) {
    const sources = refs.filter(ref => s.locations[ref.id]?.zone === 'play' && !s.locations[ref.id].faceDown && s.locations[ref.id].zoneVersion === ref.version && printedRulesCard(s, ref.id)?.automation?.capturesEnemyRumor).map(ref => ref.id);
    if (!sources.length)
        return false;
    const l = s.locations[id], version = l?.zoneVersion;
    if (!['graveyard', 'headquarters'].includes(l?.zone))
        return true;
    let source;
    if (immediateEntry && (printedRulesCard(s, id)?.automation?.reincarnates)) {
        const first = s.flow.stepOwner ?? s.turn?.firstPlayer ?? 0, ordered = [id, ...sources].sort((a, b) => (controllerOf(s, a) === first ? 0 : 1) - (controllerOf(s, b) === first ? 0 : 1));
        source = chooseSource(s, `entry-order:${key}`, 'grave-continuous-order', ordered);
        if (source === id) {
            immediateEntry();
            if (s.locations[id]?.zoneVersion !== version)
                return true;
            source = null;
        }
    }
    source ??= chooseSource(s, `well:${key}`, 'well-capture', sources);
    if (seal(s, id, sealHost(s, source), { zone: l.zone, zoneVersion: l.zoneVersion }))
        log(s, `枯井持续能力：${s.cards[id].name}入墓后封印，不能发动本次传闻。`);
    return true;
}
