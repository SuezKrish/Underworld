import { yellowHiddenCard } from './yellow-gray-rules.mjs';
import { abilityInformation } from './ability-information.mjs';
import { entropyHiddenCard } from './entropy-effects.mjs';
import { cleanCardRules, splitCardRules } from './card-text-format.mjs';
import { printedRulesBlank } from './printed-rules.mjs';
import { realityCard } from './reality-rules.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { effectiveSubtypes } from './derived.mjs';
export const controllerOf = (s, id) => s.locations[id]?.controller ?? s.cards[id]?.owner;
export function identity(s, id) { const { cardForm, copyProfile, sealedFace, ...c } = s.cards[id], controller = controllerOf(s, id); const named = printedRulesCard(s, id); return { ...c, clubInfluenceNames: s.locations[id]?.clubInfluence ? s.seats.map(p => p?.name ?? '') : undefined, ...abilityInformation(s, id), ...splitCardRules(cleanCardRules(named?.text ?? c.text)), automation: named?.automation, spell: named?.spell, attachment: named?.attachment, icons: named?.icons, temporaryIcons: named?.temporaryIcons, keywords: named?.keywords, hiddenAbilities: yellowHiddenCard(s, entropyHiddenCard(s, id))?.hiddenAbilities, chosenMagicDomain: s.locations[id]?.chosenMagicDomain, printedTextBlank: printedRulesBlank(s, id), isReal: realityCard(s, id), subtypes: effectiveSubtypes(s, id), name: named?.name ?? c.name, displayName: named?.displayName ?? c.displayName, ...(s.locations[id]?.faceDown ? {} : { effectiveMagicDomains: effectiveMagicDomains(s, id) }), controller, ownerName: s.seats[c.owner]?.name ?? '', controllerName: s.seats[controller]?.name ?? '' }; }
export function transferControl(s, id, controller) {
    const l = s.locations[id];
    if (!l || !['play', 'asset'].includes(l.zone) || ![0, 1].includes(controller))
        return false;
    if (l.zone === 'play') {
        for (const p of s.players)
            p.play = p.play.filter(x => x !== id);
        s.players[controller].play.push(id);
    }
    else {
        const a = s.players.flatMap(p => p.assets).find(a => a.id === id);
        if (!a)
            return false;
        for (const p of s.players)
            p.assets = p.assets.filter(a => a.id !== id);
        s.players[controller].assets.push(a);
    }
    l.controller = controller;
    return true;
}
