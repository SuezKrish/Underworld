import { matchesSpecifiedName } from './card-names.mjs';
import { graveCards, inGrave } from './graveyard-rules.mjs';
import { librarySearchBlocked } from './library-search.mjs';
import { hasCardType } from './card-types.mjs';
import { effectiveSubtypes, enterTapped, graveyardLocked } from './derived.mjs';
import { attachmentHostReference } from './attachment-host-reference.mjs';
import { RuleError } from './core.mjs';
const need = (value, message) => {
    if (!value)
        throw new RuleError(message);
};
// Searching never moves a card until the chosen attachment and its host have
// both been validated. A graveyard search does not inspect or shuffle the deck.
export function createAttachmentSearch(ctx) {
    const { choose, finishSpell, options, prepare, live, move, event, shuffle, log } = ctx;
    function hostOptions(s, a, id) {
        const plan = { ...s.cards[id].attachment, cardId: id };
        const all = options(s, a.controller, plan);
        if (a.targets.length)
            return all.filter(o => a.targets.some(t => t.kind === 'card' && t.cardId === o.id && live(s, a.controller, a.plan, t)));
        return all;
    }
    function eligible(s, a, id, zone) {
        const card = s.cards[id], loc = s.locations[id];
        return (zone === 'graveyard' ? inGrave(s, id, a.cardId) : loc?.zone === zone) && hasCardType(card, 'attachment') && card.attachment && !card.attachment.modes &&
            (!a.plan.searchSubtype || effectiveSubtypes(s, id).includes(a.plan.searchSubtype)) &&
            (!a.plan.searchName || matchesSpecifiedName(card, a.plan.searchName)) &&
            (zone !== 'graveyard' || !graveyardLocked(s)) && (zone !== 'deck' || !librarySearchBlocked(s)) && hostOptions(s, a, id).length > 0;
    }
    function search(s, a, zone) {
        if (zone === 'deck' && librarySearchBlocked(s)) {
            log(s, '稻荷神社童子：跳过牌库检索，牌库仍洗牌。');
            complete(s, a, zone);
            return;
        }
        const ids = (zone === 'graveyard' ? graveCards(s, a.controller, a.cardId) : s.players[a.controller][zone]).filter(id => eligible(s, a, id, zone));
        choose(s, a, 'batch-attachment-card', a.controller, ids, {
            searchZone: zone, canFail: zone === 'deck' || !ids.length,
            versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])),
            choiceLabel: `${s.cards[a.cardId].name} · 从${zone === 'deck' ? '牌库' : '墓地'}检索${a.plan.searchName ?? a.plan.searchSubtype ?? '附属'}`
        });
    }
    function start(s, a) {
        const zones = a.plan.searchZones ?? ['deck'];
        if (zones.length === 1)
            search(s, a, zones[0]);
        else
            choose(s, a, 'batch-attachment-zone', a.controller, [], {
                options: zones.map(id => ({ id, name: `从${id === 'deck' ? '牌库' : '墓地'}检索` })),
                choiceLabel: `${s.cards[a.cardId].name} · 选择检索区域`
            });
        return true;
    }
    function complete(s, a, zone) {
        if (zone === 'deck')
            shuffle(s.players[a.controller].deck);
        finishSpell(s, a);
    }
    function attach(s, a, id, zone, version, target) {
        const plan = { ...s.cards[id].attachment, cardId: id }, loc = s.locations[id];
        if (!(zone === 'graveyard' ? inGrave(s, id, a.cardId) : loc?.zone === zone) || loc.zoneVersion !== version || !eligible(s, a, id, zone) || !live(s, a.controller, plan, target)) {
            log(s, '检索到的附属或结附目标已失效，卡牌留在原区域。');
            complete(s, a, zone);
            return;
        }
        const host = attachmentHostReference(s, target);
        const district = target.kind === 'district' ? target.district : target.kind === 'card' ? s.locations[target.cardId].district : undefined;
        if (move(s, id, 'play', { controller: a.controller, tapped: enterTapped(s, id, district), attachedTo: host.hostId, hostVersion: target.kind === 'card' ? target.zoneVersion : host.version, ...(district !== undefined ? { district } : {}) })) {
            log(s, `${s.cards[id].name}从${zone === 'deck' ? '牌库' : '墓地'}放置进场，结附于${host.name}。`);
            event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
            event(s, id, 'attached', s.locations[id], a.id, { host });
        }
        complete(s, a, zone);
    }
    function choice(s, p, c, x) {
        const a = x.spell;
        if (x.kind === 'batch-attachment-zone') {
            need(x.options.some(o => o.id === c.cardId), '请选择牌库或墓地');
            search(s, a, c.cardId);
            return;
        }
        if (x.kind === 'batch-attachment-card') {
            if (c.fail === true) {
                need(x.canFail, '墓地有合法附属，请选择一张');
                complete(s, a, x.searchZone);
                return;
            }
            need(x.cardIds.includes(c.cardId) && eligible(s, a, c.cardId, x.searchZone) && s.locations[c.cardId].zoneVersion === x.versions[c.cardId], '请选择仍在检索区域的合法附属');
            const id = c.cardId, all = hostOptions(s, a, id);
            if (a.targets.length) {
                attach(s, a, id, x.searchZone, x.versions[id], a.targets[0]);
                return;
            }
            log(s, `${s.cards[a.cardId].name}展示检索到的${s.cards[id].name}，选择结附目标。`);
            choose(s, a, 'batch-attachment-host', p, [], {
                options: all, public: true, attachmentId: id, attachmentVersion: x.versions[id], searchZone: x.searchZone,
                choiceLabel: `${s.cards[id].name} · 选择结附目标`
            });
            return;
        }
        need(x.options.some(o => o.id === c.cardId), '请选择合法结附目标');
        const targets = prepare(s, p, { targetIds: [c.cardId] }, { ...s.cards[x.attachmentId].attachment, cardId: x.attachmentId });
        attach(s, a, x.attachmentId, x.searchZone, x.attachmentVersion, targets[0]);
    }
    return { start, choice };
}
