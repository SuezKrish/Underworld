import { virtualAttachments } from './cq-rules.mjs';
import { hiddenBoxBlankSources } from './veiled-status-rules.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { effectiveSubtypes, attachmentHostLegal } from './derived.mjs';
export function yellowSources(s, p, kind) { return (s.players[p]?.play ?? []).filter(id => { const l = s.locations[id]; return l?.zone === 'play' && !l.faceDown && !l.secretPlan && !abilitiesSuppressed(s, id) && printedRulesCard(s, id)?.automation?.static === kind && (!hasCardType(s.cards[id], 'attachment') || attachmentHostLegal(s, id)); }); }
export function networkCount(s, id) { const p = controllerOf(s, id); return s.players[p].play.filter(other => other !== id && s.locations[other]?.zone === 'play' && !s.locations[other].faceDown && !s.locations[other].secretPlan && effectiveSubtypes(s, other).some(t => ['互联网', '媒体', '工程师'].includes(t))).length + virtualAttachments(s, p).length; }
export function networkHiddenBonus(s, p) { return yellowSources(s, p, 'network-scaling').reduce((n, id) => n + networkCount(s, id), 0); }
export function researchMultiSelection(s, p) { return yellowSources(s, p, 'research-multi-hidden').length > 0; }
export function researchEyesConverted(s, id) { const l = s.locations[id], p = controllerOf(s, id); return l?.zone === 'play' && !l.faceDown && !l.secretPlan && effectiveSocietyMarkers(s, p).hidden > 0 && effectiveSubtypes(s, id).some(t => ['互联网', '媒体', '工程师'].includes(t)) && yellowSources(s, p, 'research-white-eyes').length > 0; }
export function yellowHiddenCard(s, card) {
    if (!card)
        return card;
    const blank = hiddenBoxBlankSources(s).length > 0, extra = hasCardType(card, 'character') && matchesSpecifiedName(card, '玛格丽特') && researchMultiSelection(s, card.owner) ? [{ kind: 'hidden-effect', grantedBy: yellowSources(s, card.owner, 'research-multi-hidden')[0], plan: { target: 'role-or-attachment', effect: 'yellow-gray', operation: 'margaret-bottom', hiddenTargetSelection: true, optionalHiddenCost: true } }] : [];
    return { ...card, hiddenAbilities: [...(card.hiddenAbilities ?? []).filter(a => (!blank || a.grantedBy) && (a.condition !== 'hermit-society' || s.societies?.[card.owner]?.name === '隐士') && (!a.condition?.assetSubtype || s.players[card.owner].assets.some(asset => effectiveSubtypes(s, asset.id).includes(a.condition.assetSubtype)))).map(a => a.condition === 'hermit-society' || a.condition?.assetSubtype ? { ...a, condition: undefined } : a), ...extra] };
}
export function hiddenFirstSelectionPlayer(s) {
    if (s.turn?.phase !== 'action')
        return undefined;
    const p = s.flow.stepOwner;
    return yellowSources(s, p, 'precognition-first').length ? 1 - p : undefined;
}
