import { placeRegionInfluence } from './club-influence.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { RuleError } from './core.mjs';
import { sourceLive } from './batch-rules.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { effectiveSubtypes, enterTapped, graveyardLocked } from './derived.mjs';
import { inGrave } from './graveyard-rules.mjs';
import { effectiveSocietyMarkers, secrecyLevel } from './secrecy-counts.mjs';
import { adjacentDistricts } from './task-districts.mjs';
import { relocate } from './district-rules.mjs';
import { tapCard } from './field-events.mjs';
export function controlsIndustry(s, p) { return s.players[p].play.some(id => { const l = s.locations[id], c = printedRulesCard(s, id); return l?.zone === 'play' && !l.faceDown && hasCardType(c, 'attachment') && c.subtitle === '圣甲虫产业'; }); }
export function createFieldSupportEffects({ move, event, draw, choose, finishSpell, log, shuffle, filterCard, librarySearchBlocked }) {
    const need = (value, message) => {
        if (!value)
            throw new RuleError(message);
    };
    const matches = (s, id, filter) => filterCard({ ...s.cards[id], subtypes: effectiveSubtypes(s, id) }, filter);
    function placement(s, a, id, d) {
        if (!s.districts[d])
            return false;
        const moved = move(s, id, 'play', { controller: a.controller, district: d, faceDown: false, tapped: enterTapped(s, id, d) });
        if (moved)
            event(s, id, 'entry', s.locations[id], a.id, { method: 'effect-placement' });
        return moved;
    }
    function effect(s, a, plan, targets) {
        const p = a.controller, t = targets[0], id = plan.sourceId ?? a.cardId;
        if (plan.operation === 'top-spells') {
            if (librarySearchBlocked(s)) {
                shuffle(s.players[p].deck);
                return false;
            }
            const ids = s.players[p].deck.slice(0, secrecyLevel(s, p) > secrecyLevel(s, 1 - p) ? 8 : 4), eligibleIds = ids.filter(x => matches(s, x, { requireSubtype: '法术' }));
            if (!ids.length) {
                shuffle(s.players[p].deck);
                return false;
            }
            choose(s, a, 'field-support-top-spells', p, ids, { eligibleIds, min: 0, max: eligibleIds.length, versions: Object.fromEntries(ids.map(x => [x, s.locations[x].zoneVersion])), choiceLabel: '本杰明·富兰克林 · 选择法术，其余洗回牌库' });
            return true;
        }
        if (plan.operation === 'hand-placement' || plan.operation === 'search-placement') {
            const searching = plan.operation === 'search-placement', zone = searching ? 'deck' : 'hand';
            if (searching && librarySearchBlocked(s)) {
                shuffle(s.players[p].deck);
                return false;
            }
            const ids = s.players[p][zone].filter(x => matches(s, x, plan.filter));
            if (!ids.length) {
                if (searching)
                    shuffle(s.players[p].deck);
                return false;
            }
            choose(s, a, 'field-support-placement', p, ids, { zone, searching, canFail: searching, destination: { district: t.district, id: t.cardId }, filter: plan.filter, versions: Object.fromEntries(ids.map(x => [x, s.locations[x].zoneVersion])), choiceLabel: searching ? '选择异界角色放置进场' : '选择独有法师或吸血鬼放置进场' });
            return true;
        }
        if (plan.operation === 'grave-self-placement') {
            const l = s.locations[id];
            if (inGrave(s, id, id) && l.zoneVersion === plan.sourceZoneVersion && !graveyardLocked(s, id, s.cards[id].owner, l.zone))
                placement(s, a, id, t.district);
        }
        if (plan.operation === 'move-enemy') {
            if (s.districts[a.district]?.id === plan.destinationCardId && relocate(s, t.cardId, a.district))
                event(s, t.cardId, 'move', s.locations[t.cardId], a.id, { operator: p });
            if (plan.paidTapCount > 0 || plan.waivedOptionalExtraCosts)
                tapCard(s, t.cardId);
        }
        if (plan.operation === 'source-battle-counter' && sourceLive(s, plan)) {
            const l = s.locations[id];
            l.counters ??= {};
            setCardMarker(s, l, "counter", "battle", (l.counters.battle ?? 0) + 1);
        }
        if (plan.operation === 'death-icons-draw' && effectiveSocietyMarkers(s, p).hidden > 0)
            draw(s, [p], plan.sourceBattleCount ?? 0);
        if (plan.operation === 'influence-vampire-districts') {
            const districts = new Set(s.players[p].play.filter(x => s.locations[x]?.zone === 'play' && !s.locations[x].faceDown && hasCardType(printedRulesCard(s, x), 'character') && effectiveSubtypes(s, x).includes('吸血鬼')).map(x => s.locations[x].district));
            for (const d of districts) {
                const district = s.districts[d];
                if (!district)
                    continue;
                placeRegionInfluence(s, d, p);
            }
            log(s, `安哥拉·曼纽：在${districts.size}个有本方吸血鬼的地区放置势力。`);
        }
        if (plan.operation === 'move-adjacent' && sourceLive(s, plan) && s.districts[a.district]?.id === plan.destinationCardId && adjacentDistricts(s, s.locations[id].district).includes(a.district) && relocate(s, id, a.district))
            event(s, id, 'move', s.locations[id], a.id, { operator: p });
        return false;
    }
    function choice(s, p, c, x) {
        const a = x.spell;
        if (x.kind === 'field-support-top-spells') {
            const ids = c.cardIds ?? [];
            need(Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => x.eligibleIds.includes(id) && s.players[p].deck.includes(id) && s.locations[id].zoneVersion === x.versions[id] && matches(s, id, { requireSubtype: '法术' })), '请选择检视范围内的法术牌');
            if (!librarySearchBlocked(s)) {
                for (const id of ids) {
                    log(s, `${s.seats[p].name}展示${s.cards[id].name}并置于手中。`);
                    move(s, id, 'hand');
                }
            }
            shuffle(s.players[p].deck);
        }
        else if (x.kind === 'field-support-placement') {
            need(!c.fail || x.canFail, '手牌放置进场不能选择检索失败');
            if (!c.fail) {
                const id = c.cardId;
                need(x.cardIds.includes(id) && s.players[p][x.zone].includes(id) && s.locations[id].zoneVersion === x.versions[id] && matches(s, id, x.filter), '请选择仍在原区域的合法角色');
                if ((!x.searching || !librarySearchBlocked(s)) && s.districts[x.destination.district]?.id === x.destination.id) {
                    log(s, `${s.seats[p].name}展示${s.cards[id].name}并尝试放置进场。`);
                    placement(s, a, id, x.destination.district);
                }
            }
            if (x.searching)
                shuffle(s.players[p].deck);
        }
        else
            throw new RuleError('未知的场上支援选择');
        finishSpell(s, a);
    }
    return { effect, choice };
}
