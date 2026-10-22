import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { sealedOn } from './sealing.mjs';
import { cardHasKeyword, effectiveSubtypes, attachmentHostLegal } from './derived.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
// All simultaneous draws in one instruction share the skip, and every waiting
// memory effect is consumed together. A skipped draw emits no draw event.
export function skipMemoryDraw(s, counts, { drawStep = false } = {}) {
    const waiting = (s.effects ?? []).filter(e => e.kind === 'memory-skip-draw' && e.round === s.round);
    if (drawStep || s.turn?.step === 'draw' || !waiting.length || !Object.values(counts).some(n => n > 0))
        return false;
    for (const p of Object.keys(counts))
        counts[p] = 0;
    s.effects = s.effects.filter(e => !waiting.includes(e));
    return true;
}
export function statusSources(s, kind) { return s.players.flatMap(p => p.play).filter(id => { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && !l.secretPlan && printedRulesCard(s, id).automation?.static === kind && (!hasCardType(s.cards[id], 'attachment') || attachmentHostLegal(s, id)); }); }
export function hasIndicator(s, id) { const l = s.locations[id]; return (l?.markers ?? 0) > 0 || (l?.wounds ?? 0) > 0 || Object.entries(l?.counters ?? {}).some(([k, n]) => !['influence', '势力'].includes(k) && Number.isFinite(n) && n > 0); }
export function markedKeyword(s, id, k) { return k === '声望' ? hasIndicator(s, id) : k === '屏障' ? sealedOn(s, id).length > 0 : false; }
export function statusKeywordSources(s, id, k) {
    const l = s.locations[id], c = printedRulesCard(s, id);
    if (l?.zone !== 'play' || l.faceDown || !hasCardType(c, 'character'))
        return [];
    const out = [];
    if (c.automation?.static === 'marked-politician' && markedKeyword(s, id, k))
        out.push(id);
    if (k === '声望' && cardHasKeyword(s, id, '公开'))
        out.push(...statusSources(s, 'alpha-reputation').filter(a => controllerOf(s, a) === controllerOf(s, id)));
    return out;
}
export function markedRoundKeyword(s, id, k) { return s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(printedRulesCard(s, id), 'character') && markedKeyword(s, id, k) && (s.effects ?? []).some(e => e.kind === 'marked-role-keywords' && e.round === s.round); }
export function reputationSuppressedSources(s, id) { return s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character') ? statusSources(s, 'alpha-reputation').filter(a => controllerOf(s, a) !== controllerOf(s, id)) : []; }
export function hiddenBoxBlankSources(s) { return statusSources(s, 'untapped-hidden-blank').filter(id => !s.locations[id].tapped); }
export function shikigamiSupported(s, id) { const l = s.locations[id], p = controllerOf(s, id); return l?.zone === 'play' && !l.faceDown && s.players[p].play.some(a => { const al = s.locations[a], c = printedRulesCard(s, a); return al.zone === 'play' && !al.faceDown && al.district === l.district && (hasCardType(c, 'character') && effectiveSubtypes(s, a).includes('阴阳师') || hasCardType(c, 'attachment') && effectiveSubtypes(s, a).includes('神社')); }); }
export function secretDeploymentDiscount(s, p) { return effectiveSocietyMarkers(s, p).hidden >= 2 ? statusSources(s, 'behind-veil').length : 0; }
export function assetReputationCastSources(s, p, id) { return s.locations[id]?.zone === 'asset' && controllerOf(s, id) === p && hasCardType(printedRulesCard(s, id), 'character') && cardHasKeyword(s, id, '声望') ? statusSources(s, 'asset-reputation-casting').filter(a => controllerOf(s, a) === p) : []; }
export function handDiscardProtection(s, p, actor) { return actor === 1 - p ? statusSources(s, 'protect-hand-discard').filter(a => controllerOf(s, a) === p) : []; }
