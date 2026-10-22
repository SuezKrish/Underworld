import { RuleError } from './core.mjs';
import { hasCardType } from './card-types.mjs';
import { applyCardForm } from './card-forms.mjs';
import { sourceLive } from './batch-rules.mjs';
import { currentSocietyName, effectiveSubtypes, cardHasKeyword, enterTapped } from './derived.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { librarySearchBlocked } from './library-search.mjs';
import { sealHost } from './sealing.mjs';
import { fieldTimeMarkers } from './zone-actions.mjs';
import { scoredCard } from './scoring.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { attachmentHostLegal } from './derived.mjs';
import { participatesInContest } from './contest-participation.mjs';
import { controllerOf } from './ownership.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export function vampireOrHidden(s, p) { return effectiveSocietyMarkers(s, p).hidden > 0 || s.players[p].play.some(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && hasCardType(s.cards[id], 'character') && effectiveSubtypes(s, id).includes('吸血鬼')); }
export function createVeilToolsEffects({ choose, finishSpell, move, seal, event, log, shuffle, drink, draw }) {
    function contestWon(s, details) {
        if (details.contest !== 'influence')
            return;
        for (const id of s.players.flatMap(pl => pl.play)) {
            const l = s.locations[id], h = s.locations[l?.attachedTo];
            if (l?.zone === 'play' && !l.faceDown && printedRulesCard(s, id).automation?.static === 'hidden-host-win-draw' && controllerOf(s, id) === details.winner && attachmentHostLegal(s, id) && h?.faceDown && h.district === details.district && participatesInContest(s, l.attachedTo))
                draw(s, [details.winner], 1);
        }
    }
    function predictAfter(s, a) {
        if (currentSocietyName(s, a.controller) === '隐士') {
            const next = { ...a, sequence: [{ effect: 'predict', target: 'none', count: 1 }, ...(a.sequence ?? [])], sequenceTargets: a.sequenceTargets ?? [] };
            finishSpell(s, next);
        }
        else
            finishSpell(s, a);
    }
    function hiddenPlacement(s, a, id, d) {
        const region = s.districts[d];
        if (!region)
            return;
        log(s, `${s.seats[a.controller].name}展示${s.cards[id].name}并以暗藏者状态放置在地区${d + 1}。`);
        move(s, id, 'play', { controller: a.controller, district: d, faceDown: true, tapped: false, hiddenHandle: crypto.randomUUID() });
    }
    function effect(s, a, plan, targets) {
        const p = a.controller;
        if (plan.operation === 'apprentice-vampire' || plan.operation === 'apprentice-mage') {
            if (!sourceLive(s, plan) || plan.operation === 'apprentice-mage' && !effectiveSubtypes(s, plan.sourceId).includes('吸血鬼'))
                return false;
            const mage = plan.operation === 'apprentice-mage';
            applyCardForm(s, plan.sourceId, { subtypes: mage ? ['吸血鬼', '法师'] : ['吸血鬼'], icons: mage ? { investigation: 2, battle: 1, influence: 1 } : { investigation: 0, battle: 0, influence: 1 }, temporaryIcons: mage ? { investigation: 0, battle: 0, influence: 0 } : { investigation: 0, battle: 1, influence: 0 }, defense: mage ? 2 : 1 });
            if (mage) {
                finishSpell(s, { ...a, sequence: [{ effect: 'draw', target: 'none', count: 1 }, ...(a.sequence ?? [])], sequenceTargets: a.sequenceTargets ?? [] });
                return true;
            }
            drink(s, a, { ...plan, operation: 'drink-blood' }, []);
            return true;
        }
        if (plan.operation === 'hermit-placement') {
            const t = targets[0], ids = s.players[p].hand.filter(id => hasCardType(s.cards[id], 'character'));
            if (ids.length) {
                choose(s, a, 'veil-tools-hermit', p, ids, { destination: { district: t.district, id: t.cardId }, versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])), choiceLabel: '隐居 · 展示一张角色牌并秘密放置' });
                return true;
            }
            predictAfter(s, a);
            return true;
        }
        if (plan.operation === 'phantom-search') {
            const d = s.districts[0];
            if (!d)
                return false;
            if (librarySearchBlocked(s)) {
                shuffle(s.players[p].deck);
                return false;
            }
            const max = (plan.sourceCounters?.progress ?? 0) - 1, ids = s.players[p].deck.filter(id => hasCardType(s.cards[id], 'character') && s.cards[id].printedCost <= max && cardHasKeyword(s, id, '声望'));
            choose(s, a, 'veil-tools-phantom', p, ids, { canFail: true, maxCost: max, destination: { district: 0, id: d.id }, versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])), choiceLabel: '幻影英雄 · 检索小于推进数量的声望角色' });
            return true;
        }
        if (plan.operation === 'bottom-hand') {
            const ids = s.players[p].deck.slice(-2);
            for (const id of ids)
                move(s, id, 'hand');
            log(s, `戴森的计谋将牌库底${ids.length}张牌置于手中。`);
            return false;
        }
        if (plan.operation === 'optional-time-hidden' && fieldTimeMarkers(s) >= 4) {
            choose(s, a, 'veil-tools-hidden', p, [], { options: [{ id: 'yes', name: '进行一次隐秘对抗' }, { id: 'no', name: '不进行' }], choiceLabel: '戴森的计谋 · 是否进行隐秘对抗' });
            return true;
        }
        if (plan.operation === 'path-search' && vampireOrHidden(s, p)) {
            const q = 1 - p;
            if (librarySearchBlocked(s)) {
                shuffle(s.players[q].deck);
                return false;
            }
            const ids = s.players[q].deck.slice(0, 10);
            if (!ids.length) {
                shuffle(s.players[q].deck);
                return false;
            }
            choose(s, a, 'veil-tools-path', p, ids, { canFail: true, deckPlayer: q, versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])), choiceLabel: '阴影之道 · 从敌方牌库顶十张中封印一张，其余洗牌' });
            return true;
        }
        if (plan.operation === 'lighthouse-score' && sourceLive(s, plan) && effectiveSocietyMarkers(s, p).hidden >= 3) {
            const c = { ...s.cards[plan.sourceId], points: 1 };
            if (move(s, plan.sourceId, 'score', { controller: p })) {
                s.players[p].scoreCards.push(scoredCard(s, p, c));
                log(s, '灯塔看护人进入计分区，获得1分。');
            }
        }
        return false;
    }
    function choice(s, p, c, x) {
        const a = x.spell;
        if (x.kind === 'veil-tools-hidden') {
            need(['yes', 'no'].includes(c.cardId), '请选择是否进行隐秘对抗');
            if (c.cardId === 'yes') {
                finishSpell(s, { ...a, sequence: [{ effect: 'hidden-contest', target: 'none' }, ...(a.sequence ?? [])], sequenceTargets: a.sequenceTargets ?? [] });
                return;
            }
        }
        else if (x.kind === 'veil-tools-hermit') {
            const id = c.cardId;
            need(x.cardIds.includes(id) && s.players[p].hand.includes(id) && s.locations[id].zoneVersion === x.versions[id] && hasCardType(s.cards[id], 'character'), '请选择仍在手中的角色牌');
            if (s.districts[x.destination.district]?.id === x.destination.id)
                hiddenPlacement(s, a, id, x.destination.district);
            predictAfter(s, a);
            return;
        }
        else if (x.kind === 'veil-tools-phantom') {
            if (!c.fail) {
                const id = c.cardId;
                need(x.cardIds.includes(id) && s.players[p].deck.includes(id) && s.locations[id].zoneVersion === x.versions[id] && cardHasKeyword(s, id, '声望') && s.cards[id].printedCost <= x.maxCost, '请选择符合条件的声望角色');
                if (!librarySearchBlocked(s) && s.districts[0]?.id === x.destination.id) {
                    log(s, `幻影英雄展示${s.cards[id].name}并放置进场。`);
                    if (move(s, id, 'play', { controller: p, district: 0, tapped: enterTapped(s, id, 0), faceDown: false }))
                        event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
                }
            }
            shuffle(s.players[p].deck);
        }
        else if (x.kind === 'veil-tools-path') {
            if (!c.fail) {
                const id = c.cardId;
                need(x.cardIds.includes(id) && s.players[x.deckPlayer].deck.includes(id) && s.locations[id].zoneVersion === x.versions[id], '请选择检视范围中的一张牌');
                if (!librarySearchBlocked(s))
                    seal(s, id, sealHost(s, `society:${s.cards[id].owner}`), { zone: 'deck', zoneVersion: x.versions[id] });
            }
            shuffle(s.players[x.deckPlayer].deck);
        }
        else
            throw new RuleError('未接入的暗藏与成长选择');
        finishSpell(s, a);
    }
    return { effect, choice, contestWon };
}
