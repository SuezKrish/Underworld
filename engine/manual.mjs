import { markReplayUndo } from './replay.mjs';
import { placementOperations, placementEligible, placementOptions, validatePlacement, executePlacement } from './manual-placement.mjs';
import { maskSealedFace, printedSealedFace } from './sealed-face.mjs';
import { deckWasShuffled } from './deck-shuffle-events.mjs';
import { setCardMarker } from './counter-placement.mjs';
import { placeRegionInfluence } from './club-influence.mjs';
import { uuid, randomValues } from './random.mjs';
import { hasCardType } from './card-types.mjs';
import { packUndoFrames } from './undo-history-codec.mjs';
import { societyMarkers, RuleError } from './core.mjs';
import { identity, controllerOf } from './ownership.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
export const manualNames = { 'to-asset': '将牌置于资产区（无视非资产限制）', seal: '将牌封印在所选对象上', 'put-face-up': '将角色牌或附属牌正面放置进场', 'put-face-down': '将角色牌以暗藏者状态放置进场', 'ignore-loyalty': '切换本方忠诚度需求', 'add-mana': '增加本方费用池', inspect: '检视自己的隐藏区域', shuffle: '将自己的牌库洗牌', draw: '手动抓牌', 'to-graveyard': '将自己拥有的牌置于墓地', 'reorder-inspection': '调整已检视牌库顶／底的顺序', 'to-hand': '将自己拥有的牌置于手中', 'deck-top': '将自己拥有的牌置于牌库顶', 'deck-bottom': '将自己拥有的牌置于牌库底', recycle: '将自己拥有的牌洗回牌库', 'add-reserve': '从游戏外加入卡牌', 'flip-character': '翻面本方角色／暗藏者', 'add-secrecy-counter': '放置本方隐秘标志', 'add-exposure-counter': '放置本方暴露标志', 'add-influence-counter': '放置本方势力标志', 'initiate-secrecy-contest': '开启隐秘对抗', undo: '撤销上一步' };
export const manualMutationOperations = [...placementOperations, 'ignore-loyalty', 'add-mana', 'reorder-inspection', 'to-graveyard', 'draw', 'shuffle', 'to-hand', 'deck-top', 'deck-bottom', 'recycle', 'flip-character', 'add-secrecy-counter', 'add-exposure-counter', 'add-influence-counter', 'initiate-secrecy-contest'];
export function manualWindowOpen(s) { return s.status === 'playing' && !s.flow.locked && !s.flow.stack.some(a => a.plan?.noResponse) && !s.deathContinuation && !s.hidden && !s.battle && !s.effectChoice && !s.roundChoice && !s.ruleChoice && !s.damageChoice && !s.triggerOrderChoice && !s.triggerRound && !s.triggerChoices.length && !s.pendingTriggers.some(a => !a.triggerRoundNumber) && !s.keeperQueue?.length && !s.keeperContinuation; }
const markerOperations = ['add-secrecy-counter', 'add-exposure-counter', 'add-influence-counter'];
const moveOperations = ['to-graveyard', 'to-hand', 'deck-top', 'deck-bottom'];
const movableZones = ['hand', 'play', 'asset', 'graveyard', 'headquarters', 'sealed'];
export function shuffleDeck(ids) {
    for (let i = ids.length - 1; i > 0; i--) {
        const limit = 0x100000000 - 0x100000000 % (i + 1);
        let n;
        do {
            n = randomValues(new Uint32Array(1))[0];
        } while (n >= limit);
        const j = n % (i + 1);
        [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    ;
    deckWasShuffled(ids);
}
function canChoose(s, p, id) { const l = s.locations[id]; return s.cards[id]?.owner === p && (movableZones.includes(l?.zone) || l?.zone === 'deck' && s.privateInspections?.[p]?.ids.includes(id)); }
export function ownedCandidates(s, p) { return Object.keys(s.cards).filter(id => canChoose(s, p, id)).map(id => { const c = identity(s.cards[id].sealedFace ? { ...s, cards: { ...s.cards, [id]: printedSealedFace(s.cards[id]) } } : s, id), l = s.locations[id]; return l.faceDown && l.zone === 'play' && controllerOf(s, id) !== p ? { id: `hidden:${l.hiddenHandle}`, name: '暗藏者', owner: p, ownerName: c.ownerName, controller: c.controller, controllerName: c.controllerName, zone: l.zone, district: l.district } : { ...c, zone: l.zone, district: l.district }; }); }
function actual(s, value) { return value.startsWith('hidden:') ? Object.keys(s.locations).find(id => s.locations[id].hiddenHandle === value.slice(7)) : value; }
export function manualQuantity(r) { return r.operation === 'initiate-secrecy-contest' ? `修正${r.count >= 0 ? '+' : ''}${r.count}` : r.count !== undefined ? `${r.count}${r.operation === 'add-mana' ? '点' : markerOperations.includes(r.operation) ? '个' : '张'}` : r.cardIds ? `${r.cardIds.length}张` : ''; }
export function manualView(s, p, targetOptions) { const r = s.manualRequest, v = s.privateInspections?.[p], pick = s.manualSelections?.[p]; return { manualWithoutConsent: !!s.manualWithoutConsent, commandAcknowledgement: s.commandAcknowledgements?.[p] ?? null, manualSelection: pick ? { id: pick.id, operation: pick.operation, commandText: pick.commandText, count: pick.count, ...(placementOperations.includes(pick.operation) ? { placements: Object.fromEntries(ownedCandidates(s, p).filter(c => placementEligible(s, actual(s, c.id), pick.operation)).map(c => [c.id, placementOptions(s, p, actual(s, c.id), pick.operation, targetOptions).map(({ id, name }) => ({ id, name }))])) } : {}), options: pick.operation === 'add-influence-counter' ? s.districts.flatMap((d, i) => d ? [{ id: 'district:' + i, district: i, name: `地区${i + 1} · ${d.name}` }] : []) : undefined, cards: (pick.operation === 'flip-character' ? flipCandidates(s, p) : ownedCandidates(s, p)).filter(c => !placementOperations.includes(pick.operation) || placementEligible(s, actual(s, c.id), pick.operation)).filter(c => pick.operation !== 'to-hand' || c.zone !== 'hand').filter(c => pick.operation !== 'to-graveyard' || !['graveyard', 'headquarters'].includes(c.zone)) } : null, manualRequest: r ? { id: r.id, requester: r.requester, operation: r.operation, quantity: manualQuantity(r), district: r.district ?? null, districtName: r.district !== undefined ? s.districts[r.district]?.name : undefined, label: r.zone === 'unordered-deck' ? '无序检视自己的牌库' : manualNames[r.operation], count: r.count ?? r.cardIds?.length ?? null, zone: r.zone ?? null, selection: r.cardIds?.map(id => { const l = s.locations[id]; return { name: ['hand', 'deck'].includes(l.zone) ? '一张牌' : l.faceDown ? '背面牌' : s.cards[id].name, zone: l.zone, district: l.district ?? null }; }) ?? [], undoLabel: r.undoLabel ?? null } : null, inspection: v && v.zone !== 'reserve' ? { id: v.id, zone: v.zone, count: v.ids.length, ordered: v.zone !== 'unordered-deck', cards: v.ids.filter(id => s.cards[id]).map(id => identity(s, id)) } : null, ownedReturnCandidates: s.players[p] ? ownedCandidates(s, p) : [], undoAvailable: !!s.deathContinuation?.before || !!s.undoFrames?.length, undoLabel: s.deathContinuation?.before ? '当前未完成操作' : s.undoFrames?.at(-1)?.label ?? null }; }
export function flipCandidates(s, p) { return (s.players[p]?.play ?? []).filter(id => s.locations[id]?.zone === 'play' && controllerOf(s, id) === p && (s.locations[id].faceDown || hasCardType(s.cards[id], 'character')) && !s.locations[id].secretPlan).map(id => ({ ...identity(s, id), zone: 'play', district: s.locations[id].district })); }
export function createManualEngine(ctx) {
    const { move, draw, log, openWindow, stateBased, event, flipCharacter, canFlipCharacter, startHidden } = ctx;
    function inspect(s, r) { const pl = s.players[r.requester], deck = [...pl.deck], ids = r.zone === 'unordered-deck' ? deck.sort((a, b) => s.cards[a].name.localeCompare(s.cards[b].name, 'zh-CN') || a.localeCompare(b)) : r.zone === 'deck' ? deck : r.zone === 'top' ? deck.slice(0, r.count) : deck.slice(Math.max(0, deck.length - r.count)); s.privateInspections ??= {}; s.privateInspections[r.requester] = { id: r.id, zone: r.zone, ids }; }
    function execute(s, r, automatic = false) {
        const who = r.requester, pl = s.players[who];
        if ([...moveOperations, ...placementOperations].includes(r.operation))
            need(r.cardIds.every((id, i) => s.cards[id]?.owner === who && [...movableZones, 'deck'].includes(s.locations[id]?.zone) && (!r.cardRefs || s.locations[id].zone === r.cardRefs[i].zone && s.locations[id].zoneVersion === r.cardRefs[i].zoneVersion)), '牌已改变位置，申请失效');
        if (r.operation === 'reorder-inspection') {
            const v = s.privateInspections?.[who], segment = r.zone === 'top' ? pl.deck.slice(0, r.orderIds.length) : pl.deck.slice(pl.deck.length - r.orderIds.length);
            need(v?.id === r.inspectionId && v.zone === r.zone && segment.length === r.orderIds.length && segment.every((id, i) => id === v.ids[i]), '牌库或检视已改变，排序申请失效');
        }
        if (['add-secrecy-counter', 'add-exposure-counter'].includes(r.operation))
            need(Number.isSafeInteger(pl.markers.hidden + r.count) && Number.isSafeInteger(pl.markers.exposed + r.count), '标志数量过大');
        if (r.operation === 'add-influence-counter') {
            const d = s.districts[r.district];
            need(d?.id === r.districtCardId, '所选地区已改变');
            need(Number.isSafeInteger(d.influence[who] + r.count - d.influence[1 - who]), '势力标志数量过大');
        }
        if (r.operation === 'flip-character')
            need(r.cardIds.every((id, i) => flipCandidates(s, who).some(c => c.id === id) && s.locations[id].zoneVersion === r.cardRefs[i].zoneVersion && canFlipCharacter?.(s, id)), '角色或暗藏者已改变或当前不能翻面，翻面申请失效');
        if (r.operation === 'add-mana')
            need(Number.isSafeInteger((pl.costPool ?? 0) + r.count), '费用池数量过大');
        if (placementOperations.includes(r.operation))
            validatePlacement(s, who, r, ctx.targetOptions);
        s.manualRequest = null;
        if (r.operation === 'ignore-loyalty')
            pl.ignoreLoyalty = !pl.ignoreLoyalty;
        if (r.operation === 'add-mana')
            pl.costPool = (pl.costPool ?? 0) + r.count;
        if (r.operation === 'undo') {
            need(!r.continuationId || s.deathContinuation?.command.id === r.continuationId, '待撤销操作已改变');
            const activity = s.lastActivityAt, frame = r.continuationId ? { state: s.deathContinuation.before, label: r.undoLabel } : s.undoFrames.pop(), frames = s.undoFrames, logs = s.logs, seats = s.seats, recent = s.recentCommands, catalogs = Object.fromEntries(undoCatalogKeys.filter(k => Object.hasOwn(s, k)).map(k => [k, s[k]]));
            for (const k of Object.keys(s))
                delete s[k];
            Object.assign(s, catalogs, structuredClone(frame.state), { undoFrames: frames, logs, seats, recentCommands: recent, manualRequest: null });
            if (activity !== undefined)
                s.lastActivityAt = activity;
            restoreTemplateFields(s);
            s.privateInspections = {};
            for (const x of s.players)
                x.autoPass = { mode: 'none', stepKey: null };
            if (s.bot) {
                s.bot.undoPaused = true;
                s.bot.pending = false;
                delete s.bot.blocked;
            }
            log(s, `${automatic ? '按房间设置免确认' : '双方同意'}撤销${frame.label}，恢复该操作前状态；此前日志保留。`);
            markReplayUndo(s);
            return true;
        }
        if (placementOperations.includes(r.operation)) {
            executePlacement(s, r, ctx);
            s.privateInspections = {};
            stateBased(s);
        }
        if (r.operation === 'inspect')
            inspect(s, r);
        if (r.operation === 'reorder-inspection') {
            const n = r.orderIds.length;
            pl.deck = r.zone === 'top' ? [...r.orderIds, ...pl.deck.slice(n)] : [...pl.deck.slice(0, pl.deck.length - n), ...r.orderIds];
            s.privateInspections = {};
        }
        if (r.operation === 'shuffle') {
            shuffleDeck(pl.deck);
            s.privateInspections = {};
        }
        if (r.operation === 'draw') {
            draw(s, [who], r.count);
            s.privateInspections = {};
        }
        if (moveOperations.includes(r.operation)) {
            const ids = [...r.cardIds];
            if (ids.length > 1)
                shuffleDeck(ids);
            const moved = [];
            for (const id of ids) {
                if (move(s, id, r.operation === 'to-hand' ? 'hand' : r.operation === 'to-graveyard' ? 'graveyard' : 'deck') && s.locations[id].zone === 'deck')
                    moved.push(id);
            }
            // move appends to the bottom. Reposition the batch once, retaining the
            // unselected deck order and excluding tokens or cards whose move failed.
            if (['deck-top', 'deck-bottom'].includes(r.operation)) {
                const chosen = new Set(moved), rest = pl.deck.filter(id => !chosen.has(id));
                pl.deck = r.operation === 'deck-top' ? [...moved, ...rest] : [...rest, ...moved];
            }
            s.privateInspections = {};
            stateBased(s);
        }
        if (['add-secrecy-counter', 'add-exposure-counter'].includes(r.operation)) {
            const m = pl.markers;
            setCardMarker(s, pl, 'markers', null, societyMarkers(m.hidden, m.exposed, r.operation === 'add-secrecy-counter' ? r.count : 0, r.operation === 'add-exposure-counter' ? r.count : 0));
            stateBased(s);
        }
        if (r.operation === 'add-influence-counter') {
            placeRegionInfluence(s, r.district, who, r.count);
            stateBased(s);
        }
        if (r.operation === 'initiate-secrecy-contest') {
            if (startHidden?.(s, r.id))
                s.hidden.environmentBonus = { [who]: r.count };
            s.privateInspections = {};
        }
        if (r.operation === 'flip-character') {
            for (const id of r.cardIds)
                need(flipCharacter?.(s, id, r.id), '此角色或暗藏者当前不能翻面');
            s.privateInspections = {};
            stateBased(s);
        }
        // Complete a pending request from an older room, while rejecting new ones.
        if (r.operation === 'recycle') {
            need(r.cardIds.every(id => s.cards[id]?.owner === who && ['hand', 'play', 'asset'].includes(s.locations[id]?.zone)), '牌已改变位置，申请失效');
            for (const id of r.cardIds)
                move(s, id, 'deck');
            shuffleDeck(pl.deck);
            s.privateInspections = {};
            stateBased(s);
        }
        if (r.operation === 'add-reserve') {
            const id = r.reserveId, template = s.cards[id];
            need(pl.reserve.includes(id), '备牌已改变位置');
            need(!template.token || r.zone === 'play', '指示物只能生成到场上');
            const entered = move(s, id, r.zone, r.zone === 'play' ? { district: r.district, tapped: template.keywords?.includes('迟缓') ?? false, controller: who } : {});
            if (entered && r.zone === 'play')
                event?.(s, id, 'entry', s.locations[id], r.id, { method: 'effect-placement' });
            stateBased(s);
        }
        if ([...moveOperations, ...placementOperations, 'recycle', 'add-reserve', 'flip-character', ...markerOperations].includes(r.operation) && s.status === 'playing' && !s.flow.locked && (s.pendingTriggers.length || s.triggerChoices.length))
            openWindow(s);
        log(s, `${automatic ? '按房间设置免确认：' : '双方同意：'}${s.seats[who].name}完成${r.operation === 'ignore-loyalty' ? (pl.ignoreLoyalty ? '忽略本方忠诚度需求' : '恢复本方忠诚度需求') : manualNames[r.operation]}${manualQuantity(r) ? `（${manualQuantity(r)}）` : ''}。`);
        return true;
    }
    function command(s, p, c) {
        if (c.type === 'manual-selection-cancel') {
            if (s.manualSelections?.[p]?.id === c.selectionId)
                delete s.manualSelections[p];
            return true;
        }
        if (c.type === 'manual-selection-start') {
            need([...moveOperations, ...placementOperations, 'flip-character', 'add-influence-counter'].includes(c.operation), '选牌指令无效');
            need(s.status === 'playing', '对局未进行');
            need(!s.manualRequest, '已有操作等待确认');
            need(manualWindowOpen(s), '请先完成当前对抗、触发或结算选择；其他指令仅可在快速行动窗口使用');
            s.manualSelections ??= {};
            s.manualSelections[p] = { id: c.id, operation: c.operation, commandText: c.commandText, count: c.count };
            return true;
        }
        if (c.type === 'cancel-inspection') {
            if (s.privateInspections)
                delete s.privateInspections[p];
            if (s.manualRequest?.requester === p && s.manualRequest.operation === 'reorder-inspection') {
                s.manualRequest = null;
                log(s, '关闭检视，取消排序申请。');
            }
            return true;
        }
        if (c.type === 'manual-request') {
            if (c.operation === 'inspect' && c.zone !== 'unordered-deck')
                need(!s.bot || s.manualWithoutConsent, '此BOT对局未启用隐藏信息手动检视，请创建启用免确认的测试房间');
            need(s.seats[1], '需另一位玩家加入');
            need(!s.manualRequest || c.operation === 'inspect' && c.zone === 'unordered-deck', '已有操作等待确认');
            need(s.status === 'playing' || c.operation === 'undo', '对局未进行，不能执行此操作');
            need(Object.hasOwn(manualNames, c.operation) && !['recycle', 'add-reserve'].includes(c.operation), '手动操作无效');
            if (c.operation !== 'undo')
                need(manualWindowOpen(s), '请在快速行动窗口使用指令；请先完成当前对抗、触发或结算选择');
            const r = { id: uuid(), requester: p, operation: c.operation };
            if (['draw', 'inspect'].includes(c.operation)) {
                need(Number.isSafeInteger(c.count) && c.count >= 0, '张数需为非负安全整数');
                r.count = c.count;
            }
            if (c.operation === 'inspect') {
                need(['deck', 'top', 'bottom', 'unordered-deck'].includes(c.zone), '检视区域无效');
                r.zone = c.zone;
            }
            if ([...moveOperations, ...placementOperations].includes(c.operation)) {
                need(Array.isArray(c.cardIds) && c.cardIds.length > 0 && c.cardIds.length <= 500 && new Set(c.cardIds).size === c.cardIds.length && c.cardIds.every(id => typeof id === 'string'), '选择无效');
                r.cardIds = c.cardIds.map(id => actual(s, id));
                need(new Set(r.cardIds).size === r.cardIds.length, '选择无效，不能重复选择同一张牌');
                need(r.cardIds.every(id => canChoose(s, p, id)), '只能选择拥有者为自己、位于手牌、场上、墓地、集团总部、封印区或已检视牌库中的牌');
                if (c.operation === 'to-hand')
                    need(r.cardIds.every(id => s.locations[id].zone !== 'hand'), '请选择不在手牌中的牌');
                r.cardRefs = r.cardIds.map(id => ({ zone: s.locations[id].zone, zoneVersion: s.locations[id].zoneVersion }));
            }
            if (placementOperations.includes(c.operation)) {
                r.destinations = {};
                for (const [i, id] of r.cardIds.entries()) {
                    need(placementEligible(s, id, c.operation), '这张牌不符合当前放置方式');
                    if (c.operation !== 'to-asset') {
                        const requested = c.destinations?.[c.cardIds[i]], dest = placementOptions(s, p, id, c.operation, ctx.targetOptions).find(o => o.id === requested);
                        need(dest, '请选择合法的放置位置或封印宿主');
                        r.destinations[id] = dest;
                    }
                }
            }
            if (c.operation === 'to-graveyard')
                need(r.cardIds.every(id => !['graveyard', 'headquarters'].includes(s.locations[id].zone)), '请选择尚未位于墓地或集团总部的牌');
            if (c.operation === 'reorder-inspection') {
                const v = s.privateInspections?.[p];
                need(v && v.id === c.inspectionId && ['top', 'bottom'].includes(v.zone), '请先检视自己的牌库顶或底');
                need(Array.isArray(c.cardIds) && c.cardIds.length === v.ids.length && new Set(c.cardIds).size === v.ids.length && c.cardIds.every(id => v.ids.includes(id)), '排序必须包含全部已检视的牌且不能重复');
                const segment = v.zone === 'top' ? s.players[p].deck.slice(0, v.ids.length) : s.players[p].deck.slice(s.players[p].deck.length - v.ids.length);
                need(segment.every((id, i) => id === v.ids[i]) && segment.length === v.ids.length, '牌库已改变，请重新检视');
                r.inspectionId = v.id;
                r.orderIds = [...c.cardIds];
                r.zone = v.zone;
                r.count = v.ids.length;
            }
            if (markerOperations.includes(c.operation) || c.operation === 'add-mana') {
                need(Number.isSafeInteger(c.count) && c.count > 0, '标志数量需为正整数');
                r.count = c.count;
            }
            if (c.operation === 'add-influence-counter') {
                need(Number.isInteger(c.district) && !!s.districts[c.district], '请选择存在的地区');
                r.district = c.district;
                r.districtCardId = s.districts[c.district].id;
            }
            if (c.operation === 'initiate-secrecy-contest') {
                need(Number.isSafeInteger(c.count), '隐秘对抗修正需为整数');
                r.count = c.count;
            }
            if (c.operation === 'flip-character') {
                need(Array.isArray(c.cardIds) && c.cardIds.length > 0 && new Set(c.cardIds).size === c.cardIds.length && c.cardIds.every(id => typeof id === 'string'), '请选择场上的本方角色或暗藏者');
                r.cardIds = c.cardIds.map(id => actual(s, id));
                need(new Set(r.cardIds).size === r.cardIds.length && r.cardIds.every(id => flipCandidates(s, p).some(c => c.id === id)), '只能选择自己操控的场上角色或暗藏者');
                need(r.cardIds.every(id => canFlipCharacter?.(s, id)), '此角色或暗藏者当前不能翻面');
                r.cardRefs = r.cardIds.map(id => ({ zone: 'play', zoneVersion: s.locations[id].zoneVersion }));
            }
            if (c.operation === 'undo') {
                prunePriorityUndo(s);
                need(s.deathContinuation?.before || s.undoFrames?.length, '没有可撤销的步骤');
                r.undoLabel = s.deathContinuation?.before ? '当前未完成操作' : s.undoFrames.at(-1).label;
                if (s.deathContinuation?.before)
                    r.continuationId = s.deathContinuation.command.id;
            }
            if (r.operation === 'inspect' && r.zone === 'unordered-deck') {
                inspect(s, r);
                log(s, `${s.seats[p].name}无序检视自己的牌库。`);
                return true;
            }
            if (s.manualWithoutConsent)
                return execute(s, r, true);
            s.manualRequest = r;
            log(s, `${s.seats[p].name}申请${manualNames[r.operation]}${manualQuantity(r) ? `（${manualQuantity(r)}）` : ''}，等待对手同意。`);
            return true;
        }
        if (c.type === 'manual-cancel') {
            need(s.manualRequest?.requester === p && c.requestId === s.manualRequest.id, '没有属于你的待确认申请');
            s.manualRequest = null;
            log(s, `${s.seats[p].name}取消人工操作申请。`);
            return true;
        }
        if (c.type === 'manual-confirm') {
            const r = s.manualRequest;
            need(r && r.requester !== p && r.id === c.requestId, '只能由对手确认此申请');
            need(typeof c.accept === 'boolean', '请明确是否同意');
            if (!c.accept) {
                s.manualRequest = null;
                log(s, `${s.seats[p].name}拒绝人工操作申请。`);
                return true;
            }
            return execute(s, r);
        }
        if (s.manualRequest)
            throw new RuleError('人工操作等待对手确认，请先同意、拒绝或取消申请');
        return false;
    }
    return { command };
}
// Room catalogs are immutable templates, not match state. Keep one copy in the
// room rather than duplicating the entire supported pool in every undo frame.
export const undoCatalogKeys = ['automationCards', 'reserveTemplates', 'environmentCatalog', 'deckSelections', 'cardNamePool', 'characterNames', 'playerPreferences'];
export function compactTemplateFields(snapshot, templates) {
    const identityKeys = new Set(['id', 'owner', 'catalogId']);
    for (const card of Object.values(snapshot.cards ?? {})) {
        const template = templates.get(card.catalogId);
        if (!template)
            continue;
        const absentBefore = new Set(card.__undoAbsentTemplateFields ?? []), omittedBefore = card.__undoTemplateFields === '*' ? new Set(Object.keys(template).filter(k => !absentBefore.has(k) && !Object.hasOwn(card, k))) : new Set(card.__undoTemplateFields ?? []), absent = [];
        for (const key of Object.keys(template)) {
            if (identityKeys.has(key))
                continue;
            if (omittedBefore.has(key) || Object.hasOwn(card, key) && JSON.stringify(card[key]) === JSON.stringify(template[key]))
                delete card[key];
            else if (!Object.hasOwn(card, key))
                absent.push(key);
        }
        card.__undoTemplateFields = '*';
        if (absent.length)
            card.__undoAbsentTemplateFields = absent;
        else
            delete card.__undoAbsentTemplateFields;
    }
}
export function undoStateFields(s) { const excluded = new Set([...undoCatalogKeys, 'undoFrames', 'logs', 'recentCommands', 'seats', 'manualRequest', 'privateInspections', 'manualSelections', 'commandAcknowledgements', 'lastActivityAt']); return Object.fromEntries(Object.entries(s).filter(([key]) => !excluded.has(key))); }
export function undoSnapshot(s) {
    const snapshot = structuredClone(undoStateFields(s)), templates = new Map([...(s.automationCards ?? []), ...(s.reserveTemplates ?? [])].map(c => [c.catalogId, c]));
    compactTemplateFields(snapshot, templates);
    // The map key already identifies the card. Preserve unusual or absent IDs,
    // while avoiding a second UUID for every instance in each undo checkpoint.
    const exceptions = [];
    for (const [id, c] of Object.entries(snapshot.cards)) {
        if (c.id === id)
            delete c.id;
        else
            exceptions.push(id);
    }
    snapshot.__undoIdKeysV1 = exceptions;
    return snapshot;
}
export function restoreTemplateFields(s) {
    if (Object.hasOwn(s, '__undoIdKeysV1')) {
        const exceptions = new Set(s.__undoIdKeysV1);
        for (const [id, c] of Object.entries(s.cards))
            if (!exceptions.has(id) && !Object.hasOwn(c, 'id'))
                c.id = id;
        delete s.__undoIdKeysV1;
    }
    const templates = new Map([...(s.automationCards ?? []), ...(s.reserveTemplates ?? [])].map(c => [c.catalogId, c]));
    for (const c of Object.values(s.cards)) {
        if (!c.__undoTemplateFields)
            continue;
        const template = templates.get(c.catalogId);
        need(template, '撤销缺少原始卡牌模板');
        if (c.__undoTemplateFields === '*') {
            const absent = new Set(c.__undoAbsentTemplateFields ?? []);
            for (const key of Object.keys(template))
                if (!absent.has(key) && !Object.hasOwn(c, key))
                    c[key] = structuredClone(template[key]);
        }
        else
            for (const key of c.__undoTemplateFields)
                c[key] = structuredClone(template[key]);
        delete c.__undoTemplateFields;
        delete c.__undoAbsentTemplateFields;
    }
    for (const [id, l] of Object.entries(s.locations ?? {}))
        if (l.zone === 'sealed' && l.faceDown)
            maskSealedFace(s, id);
}
export const UNDO_HISTORY_LIMIT = 64;
export function saveUndo(s, state, label) {
    s.undoFrames ??= [];
    s.undoFrames.push({ state, label });
    while (s.undoFrames.length > UNDO_HISTORY_LIMIT)
        s.undoFrames.shift();
    // Charge shared history for its stored differences, not 64 copies of every
    // card and deck. Preserve at least the latest checkpoint in memory.
    if (s.undoFrames.length > 1) {
        const base = undoSnapshot(s);
        while (s.undoFrames.length > 1 && new TextEncoder().encode(JSON.stringify(packUndoFrames(s.undoFrames, base))).byteLength > 650000)
            s.undoFrames.shift();
    }
}
export function gameplayUndoState(snapshot) {
    const state = { ...snapshot, flow: { ...snapshot.flow }, turn: snapshot.turn ? { ...snapshot.turn } : snapshot.turn, players: snapshot.players?.map(p => { const { autoPass, ...rest } = p; return rest; }) };
    for (const key of undoCatalogKeys)
        delete state[key];
    delete state.replayCursor;
    delete state.flow.priority;
    delete state.flow.passed;
    if (state.turn)
        delete state.turn.actionClosed;
    delete state.windowPriorityAfterTriggers;
    return JSON.stringify(state);
}
export function prunePriorityUndo(s) {
    if (!s.undoFrames?.length)
        return;
    const current = undoSnapshot(s);
    s.undoFrames = s.undoFrames.filter((f, i, all) => !['自动让过优先权', '让过优先权与结算', '上一次对局操作'].includes(f.label) || gameplayUndoState(f.state) !== gameplayUndoState(all[i + 1]?.state ?? current));
}
