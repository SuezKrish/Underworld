import { exchangedPrintedCard } from './printed-exchange.mjs';
import { relocate } from './district-rules.mjs';
import { addWounds } from './wounds.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { effectiveIcons } from './rounds.mjs';
import { tapCard } from './field-events.mjs';
import { RuleError } from './core.mjs';
import { enterTapped, effectiveSubtypes, cardHasKeyword } from './derived.mjs';
import { sourceLive } from './batch-rules.mjs';
import { applyCardForm } from './card-forms.mjs';
import { cleanCardRules, splitCardRules } from './card-text-format.mjs';
import { graveCards, inGrave } from './graveyard-rules.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
import { sealHost, sealedOn } from './sealing.mjs';
import { simultaneousChoice, commitChoice, withSimultaneousDepartures } from './simultaneous-choice.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
import { hasAnyCardType } from './card-types.mjs';
import { controllerOf } from './ownership.mjs';
import { secrecyLevel } from './secrecy-counts.mjs';
import { setCardMarker } from './counter-placement.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export const MAXIM_COPY_ACTION = { timing: 'standard', cost: 2, target: 'character', effect: 'cq', operation: 'maxim-copy' };
const copiedFields = ['catalogId', 'type', 'printedCost', 'printedCostText', 'loyalty', 'faction', 'factionColors', 'magicDomains', 'subtypes', 'subtitle', 'icons', 'temporaryIcons', 'defense', 'text', 'keywords', 'conditionalKeywords', 'automation', 'action', 'attachment', 'spell', 'hiddenAbilities', 'cannotMove', 'noEquipment', 'noAttachments', 'assetAbility'];
function copyProfile(s, id) {
    const card = s.cards[id];
    // Current alternate faces and previous copies are copiable. Applied bonuses,
    // counters, granted abilities and non-copy forms do not change printed data.
    const printed = card.copyProfile ?? s.automationCards.find(c => c.catalogId === card.catalogId) ?? s.reserveTemplates.find(c => c.catalogId === card.catalogId) ?? card;
    const projected = exchangedPrintedCard(s, id, printed);
    return Object.fromEntries(copiedFields.map(key => [key, structuredClone(projected[key])]));
}
export function createCQEffects(ctx) {
    const { move, event, seal, choose, finishSpell, log, shuffle, librarySearchBlocked, filterCard } = ctx;
    const tigerCards = (s, p, zone) => (zone === 'deck' ? librarySearchBlocked(s) ? [] : s.players[p].deck : graveCards(s, p)).filter(id => filterCard(s.cards[id], { type: 'character' }) && matchesSpecifiedName(s.cards[id], '伥鬼'));
    const houseCards = (s, p, source) => s.players[p].play.filter(id => id !== source && s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && controllerOf(s, id) === p && hasAnyCardType(s.cards[id], ['character', 'attachment']) && !cardHasKeyword(s, id, '永恒'));
    function effect(s, a, plan, targets) {
        const p = a.controller;
        if (plan.operation === 'maxim-copy') {
            if (!sourceLive(s, plan) || !targets.length)
                return false;
            const target = targets[0].cardId, profile = copyProfile(s, target), automation = { ...(profile.automation ?? {}) };
            const actions = automation.actions ?? (automation.action ? [automation.action] : []);
            delete automation.action;
            automation.actions = [...actions.filter(x => x.operation !== 'maxim-copy'), structuredClone(MAXIM_COPY_ACTION)];
            const text = cleanCardRules(splitCardRules(profile.text).text).split('\n').filter(line => !line.includes('换生灵马克西姆成为目标角色的复制品')).join('\n');
            const patch = { ...profile, text: text + '\n行动2：换生灵马克西姆成为目标角色的复制品，但其名称仍为换生灵马克西姆，且仍然具有此能力。', automation };
            applyCardForm(s, plan.sourceId, { ...patch, copyProfile: patch, copyOrigin: s.cards[target].name });
            log(s, `换生灵马克西姆复制${s.cards[target].name}的印刷资料，保留名称、独有身份及复制行动。`);
            return false;
        }
        if (plan.operation === 'sisters-search') {
            if (librarySearchBlocked(s)) {
                shuffle(s.players[p].deck);
                return false;
            }
            const filter = plan.hidden ? { name: '诡异三姐妹' } : { type: 'character', requireSubtype: '吸血鬼', unique: true };
            const ids = s.players[p].deck.filter(id => filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id) }, filter));
            if (!ids.length) {
                shuffle(s.players[p].deck);
                return false;
            }
            choose(s, a, 'cq-sisters-search', p, ids, { canFail: true, hidden: !!plan.hidden, choiceLabel: plan.hidden ? '诡异三姐妹 · 寻找同名牌秘密放置进场' : '诡异三姐妹 · 寻找独有吸血鬼角色' });
            return true;
        }
        if (plan.operation === 'tiger-search') {
            const choices = [{ id: 'deck', name: '从牌库寻找并洗牌' }, { id: 'graveyard', name: '从墓地寻找' }].filter(o => o.id !== 'deck' || !librarySearchBlocked(s));
            choose(s, a, 'cq-tiger-source', p, [], { options: choices, choiceLabel: '伥虎 · 选择寻找伥鬼的区域' });
            return true;
        }
        if (plan.operation === 'house-seal')
            return simultaneousChoice(s, choose, a, 'cq-house-seal', [0, 1].map(controller => ({ controller, cardIds: houseCards(s, controller, plan.sourceId) })), { choiceLabel: '血肉之屋 · 各自选择一个角色或附属封印' });
        if (plan.operation === 'house-win') {
            if (sourceLive(s, plan) && s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId && secrecyLevel(s, p) > secrecyLevel(s, 1 - p) && sealedOn(s, plan.sourceId).length >= 7)
                ctx.claimDistrict(s, p, plan.sourceDistrict, plan.sourceDistrictCardId);
            return false;
        }
        if (plan.operation === 'gerone-tokens') {
            const template = s.reserveTemplates.find(c => c.catalogId === 'TK008');
            if (template) {
                beginEventGroup(s, a.id);
                try {
                    for (const t of targets)
                        for (let n = 0; n < t.tokenCount; n++) {
                            const id = crypto.randomUUID();
                            s.cards[id] = { ...structuredClone(template), id, owner: p };
                            s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
                            if (move(s, id, 'play', { controller: p, district: t.district, tapped: true, faceDown: false }))
                                event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
                        }
                }
                finally {
                    endEventGroup(s);
                }
            }
            return false;
        }
        if (plan.operation === 'curse-mill') {
            for (const id of s.players[p].deck.slice(0, 6))
                move(s, id, 'graveyard');
            return false;
        }
        if (plan.operation === 'curse-revive') {
            const card = targets.find(t => t.kind === 'card'), district = targets.find(t => t.kind === 'district');
            if (card && district && move(s, card.cardId, 'play', { controller: p, district: district.district, tapped: enterTapped(s, card.cardId, district.district), faceDown: false }))
                event(s, card.cardId, 'entry', s.locations[card.cardId], a.id, { method: 'effect-placement' });
            return false;
        }
        if (plan.operation === 'curse-defense') {
            const t = targets[0];
            if (t)
                s.effects.push({ kind: 'modify-defense', amount: -1, targetId: t.cardId, targetZoneVersion: t.zoneVersion, duration: 'until-end-of-round' });
            return false;
        }
        if (plan.operation === 'ghost-death') {
            const l = s.locations[plan.sourceId];
            if (effectiveSocietyMarkers(s, p).hidden > 0 && inGrave(s, plan.sourceId, plan.sourceId) && l.zoneVersion === plan.sourceZoneVersion + 1 && targets[0])
                seal(s, plan.sourceId, sealHost(s, targets[0].cardId), { zone: l.zone, zoneVersion: l.zoneVersion });
            return false;
        }
        if (plan.operation === 'riot-tap') {
            if (!sourceLive(s, plan))
                return false;
            setCardMarker(s, s.locations[plan.sourceId], 'counter', 'battle', (s.locations[plan.sourceId].counters?.battle ?? 0) + 1);
            if (s.districts[plan.sourceDistrict]?.id !== plan.sourceDistrictCardId)
                return false;
            choose(s, a, 'cq-riot-tap', p, [], { options: [{ id: 'tap', name: '横置符合战斗图标条件的敌方角色' }, { id: 'skip', name: '不横置' }], choiceLabel: '防暴构装体，八 · 是否横置敌方角色' });
            return true;
        }
        if (plan.operation === 'ghost-pull') {
            const t = targets[0];
            if (t && s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId) {
                if (relocate(s, t.cardId, plan.sourceDistrict))
                    event(s, t.cardId, 'move', s.locations[t.cardId], a.id, { district: plan.sourceDistrict });
            }
            return false;
        }
        if (plan.operation === 'rasputin-barrier') {
            for (const [id, version] of [[plan.sourceId, plan.sourceZoneVersion], [plan.subjectId, plan.subjectZoneVersion]])
                if (s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && s.locations[id].zoneVersion === version)
                    s.effects.push({ kind: 'barrier', targetId: id, targetZoneVersion: version, duration: 'until-end-of-round', provenance: { name: a.displayName, abilityText: '独有角色进场触发' } });
            return false;
        }
        if (plan.operation === 'sword-counter') {
            const l = s.locations[plan.subjectId];
            if (l?.zone === 'play' && !l.faceDown && l.zoneVersion === plan.subjectZoneVersion) {
                if (plan.markerField === 'wounds') {
                    addWounds(s, plan.subjectId, 1, { markerOrigin: 'sword' });
                    return false;
                }
                const old = plan.markerField === 'counter' ? l.counters?.[plan.markerKey] : l[plan.markerField];
                setCardMarker(s, l, plan.markerField, plan.markerKey, (old ?? 0) + 1, { origin: 'sword' });
            }
            return false;
        }
        return false;
    }
    function choice(s, p, c, x) {
        const a = x.spell, plan = a.plan;
        if (x.kind === 'cq-riot-tap') {
            need(['tap', 'skip'].includes(c.cardId), '请选择是否横置');
            if (c.cardId === 'tap' && sourceLive(s, plan) && s.districts[plan.sourceDistrict]?.id === plan.sourceDistrictCardId) {
                const n = effectiveIcons(s, plan.sourceId).battle;
                for (const id of s.players[1 - p].play) {
                    const l = s.locations[id];
                    if (l?.zone === 'play' && !l.faceDown && l.district === plan.sourceDistrict && hasAnyCardType(s.cards[id], ['character']) && effectiveIcons(s, id).battle < n)
                        tapCard(s, id);
                }
            }
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'cq-house-seal') {
            const selected = commitChoice(x, p, { cardId: c.cardId }, (own, c) => need(own.cardIds.includes(c.cardId) && houseCards(s, p, plan.sourceId).includes(c.cardId), '请选择自己仍操控的合法角色或附属'));
            if (!selected)
                return;
            beginEventGroup(s, a.id);
            try {
                withSimultaneousDepartures(s, selected.map(x => x.command.cardId), () => (() => {
                    for (const x of selected)
                        seal(s, x.command.cardId, plan.hostRef);
                })());
            }
            finally {
                endEventGroup(s);
            }
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'cq-tiger-source') {
            need(x.options.some(o => o.id === c.cardId), '请选择寻找区域');
            const zone = c.cardId, ids = tigerCards(s, p, zone);
            if (!ids.length) {
                if (zone === 'deck')
                    shuffle(s.players[p].deck);
                finishSpell(s, a);
                return;
            }
            choose(s, a, 'cq-tiger-search', p, ids, { canFail: zone === 'deck', zone, versions: Object.fromEntries(ids.map(id => [id, s.locations[id].zoneVersion])), choiceLabel: '伥虎 · 寻找伥鬼封印在原伥虎上' });
            return;
        }
        if (x.kind === 'cq-tiger-search') {
            if (c.fail)
                need(x.canFail, '墓地寻找不能放弃');
            else {
                need(x.cardIds.includes(c.cardId) && tigerCards(s, p, x.zone).includes(c.cardId) && s.locations[c.cardId].zoneVersion === x.versions[c.cardId], '检索牌已改变');
                seal(s, c.cardId, plan.hostRef, { zone: s.locations[c.cardId].zone, zoneVersion: x.versions[c.cardId] });
            }
            if (x.zone === 'deck')
                shuffle(s.players[p].deck);
            finishSpell(s, a);
            return;
        }
        if (x.kind === 'cq-sisters-search') {
            need(!librarySearchBlocked(s), '目前不能检索牌库');
            if (!c.fail) {
                need(x.cardIds.includes(c.cardId) && s.players[p].deck.includes(c.cardId), '请选择仍在牌库中的检索牌');
                const d = plan.hidden ? { district: plan.sourceDistrict, cardId: plan.sourceDistrictCardId } : a.targets[0];
                if (d && s.districts[d.district]?.id === d.cardId) {
                    log(s, `诡异三姐妹展示：${s.cards[c.cardId].name}。`);
                    if (move(s, c.cardId, 'play', { controller: p, district: d.district, tapped: !plan.hidden && enterTapped(s, c.cardId, d.district), faceDown: !!plan.hidden, ...(plan.hidden ? { hiddenHandle: crypto.randomUUID() } : {}) }) && !plan.hidden)
                        event(s, c.cardId, 'entry', s.locations[c.cardId], a.id, { method: 'effect-placement' });
                }
            }
            shuffle(s.players[p].deck);
            finishSpell(s, a);
            return;
        }
        throw new RuleError('未知CQ结算选择');
    }
    return { effect, choice };
}
