import { splitCardRules } from './card-text-format.mjs';
// A paired exchange ends for both objects as soon as either leaves. Later
// re-entry never revives it, even though the physical card id is unchanged.
export function printedExchangeActive(s, e) { return e.pair.every(t => { const l = s.locations[t.cardId]; return l?.zone === 'play' && !l.faceDown && l.zoneVersion === t.zoneVersion; }); }
export function exchangedPrintedCard(s, id, card = s.cards[id]) {
    let c = card;
    for (const e of s.effects ?? [])
        if (e.kind === 'printed-exchange' && printedExchangeActive(s, e)) {
            const i = e.pair.findIndex(t => t.cardId === id);
            if (i >= 0) {
                const faq = splitCardRules(c.text ?? '').faq, stats = splitCardRules(c.text ?? '').text.split('\n').find(line => /^能力图标\/防御力[：:]/.test(line)), profile = e.profiles[1 - i];
                c = { ...c, ...profile };
                if (Object.hasOwn(profile, 'text')) {
                    if (stats)
                        c.text += '\n' + stats;
                    if (faq)
                        c.text += '\n\nFAQ：\n' + faq;
                }
            }
        }
    return c;
}
export const printedTextFields = ['text', 'keywords', 'conditionalKeywords', 'automation', 'action', 'attachment', 'spell', 'hiddenAbilities', 'cannotMove', 'noEquipment', 'noAttachments', 'assetAbility'];
