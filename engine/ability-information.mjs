import { printedExchangeActive } from './printed-exchange.mjs';
import { taskForceBonusActive } from './field-completion-rules.mjs';
import { roundKeywordEffectApplies } from './batch-rules.mjs';
import { loyaltyReplacementSources } from './loyalty.mjs';
import { palaceSources } from './bq-rules.mjs';
import { statusKeywordSources, markedRoundKeyword, reputationSuppressedSources, hiddenBoxBlankSources, assetReputationCastSources } from './veiled-status-rules.mjs';
import { paidRevealRestriction } from './veil-tools-rules.mjs';
import { tiagoSources, hiddenSlowSources } from './regional-synergy-rules.mjs';
import { dreamContext } from './continuing-cost-rules.mjs';
import { effectiveSocietyMarkers } from './secrecy-counts.mjs';
import { scoredTasks } from './task-districts.mjs';
import { attachmentGrantedTriggers } from './granted-triggers.mjs';
import { shoggothKeyword, shoggothAuraKeyword, coreRole } from './shoggoth-rules.mjs';
import { nisosSources, firstAbilitiesActive } from './green-black-rules.mjs';
import { societyPlan } from './environment-definitions.mjs';
import { matchesSpecifiedName } from './card-names.mjs';
import { printedRulesCard, printedRulesBlank, abilityLossSources } from './printed-rules.mjs';
import { conditionalAttachmentKeywords, cardHasKeyword, hasBarrier, keywordAmount, effectiveActions, auraApplies, attachmentHostLegal, mediatorActive, effectiveSubtypes, ownedKeywordSources } from './derived.mjs';
import { contingencySources, equipmentFastCastSources } from './casting-rules.mjs';
import { controllerOf } from './ownership.mjs';
import { yellowHiddenCard } from './yellow-gray-rules.mjs';
import { entropyHiddenCard } from './entropy-effects.mjs';
import { cleanCardRules } from './card-text-format.mjs';
import { PHILOSOPHER_STONE, PHILOSOPHER_STONE_TEXT } from './philosopher-stone-definitions.mjs';
import { realityCard } from './reality-rules.mjs';
import { progressive, graveCastMethods } from './plan-rules.mjs';
import { hasCardType } from './card-types.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
const numeric = /^(袭击|创伤袭击|创伤|杀伤|护卫|护盾)(\d+)$/;
const sourceInfo = (s, id, reason) => ({ name: s.cards[id]?.name ?? s.districts.find(d => d?.id === id)?.name ?? '规则效果', reason });
const effectSource = (s, e) => e.provenance ? { name: e.provenance.name, reason: e.provenance.abilityText ?? '已结算的效果' } : e.sourceId ? sourceInfo(s, e.sourceId, '持续效果') : { name: '旧对局效果', reason: '该记录未保存来源' };
const unique = xs => xs.filter((x, i) => xs.findIndex(y => y.name === x.name && y.reason === x.reason) === i);
// Information is projected only after the existing visibility checks. It never
// exposes raw effects or private source objects to the browser.
export function abilityInformation(s, id) {
    const c = printedRulesCard(s, id), original = s.cards[id], l = s.locations[id];
    if (!c || !l)
        return {};
    const p = controllerOf(s, id), field = l.zone === 'play' && !l.faceDown, keys = new Set([...(original.keywords ?? []), ...(original.conditionalKeywords?.first ?? []), ...(original.conditionalKeywords?.hidden ?? []), ...(original.conditionalKeywords?.exposed ?? []), ...(original.conditionalKeywords?.district ?? []).map(x => x.keyword)]), grants = new Map(), removals = new Map();
    const add = (map, key, source) => { keys.add(key); map.set(key, [...(map.get(key) ?? []), source]); };
    for (const key of c.keywords ?? [])
        add(grants, key, sourceInfo(s, id, '印刷关键词'));
    ;
    for (const source of s.players.flatMap(pl => pl.play))
        for (const grant of printedRulesCard(s, source).automation?.ownedKeywords ?? [])
            if (ownedKeywordSources(s, id, grant.keyword).includes(source))
                add(grants, grant.keyword, sourceInfo(s, source, '拥有的卡牌获得关键词'));
    for (const [condition, label] of [['hidden', '本方具有隐秘'], ['exposed', '本方具有暴露']])
        for (const k of c.conditionalKeywords?.[condition] ?? [])
            if (effectiveSocietyMarkers(s, p)[condition] > 0)
                add(grants, k, sourceInfo(s, id, label));
    for (const g of c.conditionalKeywords?.district ?? [])
        if (cardHasKeyword(s, id, g.keyword))
            add(grants, g.keyword, sourceInfo(s, id, '所在地区满足印刷条件'));
    for (const k of c.automation?.dreamContextKeywords ?? [])
        if (dreamContext(s, id))
            add(grants, k, sourceInfo(s, id, '黄昏、梦境或承受封印'));
    for (const k of c.conditionalKeywords?.first ?? [])
        if (firstAbilitiesActive(s, p))
            add(grants, k, sourceInfo(s, id, '先手相关能力生效'));
    for (const source of hiddenSlowSources(s, id))
        add(grants, '迟缓', sourceInfo(s, source, printedRulesCard(s, source).automation?.hiddenSlow === 'global' ? '所有暗藏者获得迟缓' : '本地区暗藏者获得迟缓'));
    const sources = s.players.flatMap(pl => pl.play).filter(a => s.locations[a]?.zone === 'play' && !s.locations[a].faceDown);
    if (shoggothKeyword(s, id, '混乱'))
        add(grants, '混乱', sourceInfo(s, `society:${p}`, '秘社上有三个失控标志'));
    if (shoggothAuraKeyword(s, id, '机动'))
        for (const source of sources)
            if (printedRulesCard(s, source).automation?.shoggothStatic === 'control-team' && controllerOf(s, source) === p)
                add(grants, '机动', sourceInfo(s, source, '核心角色获得机动'));
    if (field) {
        ;
        for (const k of ['灵体', '屏障'])
            ;
        if (c.automation?.static === 'execution-task-force') {
            const active = taskForceBonusActive(s, id, c);
            for (const k of ['杀伤1', '撤回'])
                add(active ? grants : removals, k, sourceInfo(s, id, active ? '秘社为执行部或分数落后' : '秘社与比分条件均未满足'));
        }
        for (const k of ['声望', '屏障']) {
            for (const a of statusKeywordSources(s, id, k))
                add(grants, k, sourceInfo(s, a, a === id ? '自身持续条件满足' : '本方公开角色获得声望'));
            if (markedRoundKeyword(s, id, k))
                for (const e of s.effects.filter(e => e.kind === 'marked-role-keywords' && e.round === s.round))
                    add(grants, k, effectSource(s, e));
        }
        for (const a of reputationSuppressedSources(s, id))
            add(removals, '声望', sourceInfo(s, a, '敌方角色失去声望'));
        if (hasCardType(c, 'character'))
            for (const g of societyPlan(s, p).roleKeywords ?? [])
                if (g.subtypesAny.some(t => effectiveSubtypes(s, id).includes(t)))
                    for (const k of g.keywords)
                        add(grants, k, sourceInfo(s, `society:${p}`, '秘社持续能力'));
        const d = s.districts[l.district];
        if (d?.plan?.grantSpirit && hasCardType(c, 'character'))
            add(grants, '灵体', { name: d.name, reason: '地区持续能力' });
        for (const aid of sources) {
            const a = printedRulesCard(s, aid), al = s.locations[aid];
            if (al.attachedTo === id && attachmentHostLegal(s, aid)) {
                for (const k of [...(a.attachment?.grantKeywords ?? []), ...conditionalAttachmentKeywords(s, aid)])
                    add(grants, k, sourceInfo(s, aid, '结附授予'));
                if (a.attachment?.bonus?.barrier)
                    add(grants, '屏障', sourceInfo(s, aid, '结附授予'));
                if (a.attachment?.firstPlayerBarrier && firstAbilitiesActive(s, p))
                    add(grants, '屏障', sourceInfo(s, aid, '先手持续能力'));
            }
            for (const aura of a.automation?.auras ?? [])
                if (auraApplies(s, aid, id, aura))
                    for (const k of aura.grantKeywords ?? [])
                        add(grants, k, sourceInfo(s, aid, '持续能力授予'));
            if (a.automation?.static === 'reputation-defense-barrier' && controllerOf(s, aid) === p && cardHasKeyword(s, id, '声望'))
                add(grants, '屏障', sourceInfo(s, aid, '声望角色获得屏障'));
        }
        if (mediatorActive(s, id))
            add(grants, '威名', sourceInfo(s, id, '本地区没有势力标志'));
        if (c.automation?.static === 'destroyed-prophet' && s.districts[l.district]?.destroyed)
            add(grants, '声望', sourceInfo(s, id, '所在地区已毁灭'));
        if (c.automation?.static === 'armed-wound-three' && sources.some(a => s.locations[a].attachedTo === id && s.cards[a].subtypes?.includes('武器')))
            add(grants, '创伤3', sourceInfo(s, id, '结附有武器'));
        if (c.automation?.static === 'guide-conditional-keywords' && hasCardType(c, 'character'))
            for (const [k, types] of [['屏障', ['人工智能']], ['机动', ['机械', '魔像']]])
                if (s.players[p].play.some(a => s.locations[a]?.zone === 'play' && !s.locations[a].faceDown && hasCardType(s.cards[a], 'character') && effectiveSubtypes(s, a).some(t => types.includes(t))))
                    add(grants, k, sourceInfo(s, id, '本方角色满足类别条件'));
        if (c.automation?.static === 'titania-king' && s.players[p].play.some(a => s.locations[a]?.zone === 'play' && !s.locations[a].faceDown && matchesSpecifiedName(s.cards[a], '仙王奥伯龙'))) {
            add(grants, '屏障', sourceInfo(s, id, '操控仙王奥伯龙'));
            add(removals, '领袖', sourceInfo(s, id, '操控仙王奥伯龙'));
        }
    }
    for (const a of sources)
        if (!abilitiesSuppressed(s, a) && printedRulesCard(s, a).automation?.scarabStatic === 'attachment-asset-barrier' && controllerOf(s, a) === p && (l.zone === 'asset' || field && hasCardType(c, 'attachment')))
            add(grants, '屏障', sourceInfo(s, a, '附属和资产获得屏障'));
    if (c.automation?.static === 'hidden-removes-slow' && effectiveSocietyMarkers(s, p).hidden > 0)
        add(removals, '迟缓', sourceInfo(s, id, '本方秘社具有隐秘'));
    for (const e of s.effects ?? []) {
        if (e.targetId === id && e.targetZoneVersion === l.zoneVersion) {
            if (e.kind === 'grant-keyword')
                add(grants, e.keyword, effectSource(s, e));
            if (e.kind === 'remove-keyword')
                add(removals, e.keyword, effectSource(s, e));
            if (e.kind === 'barrier')
                add(grants, '屏障', effectSource(s, e));
            if (e.kind === 'barrier-lock')
                add(removals, '屏障', effectSource(s, e));
        }
        if (roundKeywordEffectApplies(s, id, e))
            for (const k of e.keywords)
                add(grants, k, effectSource(s, e));
    }
    if (field && hasCardType(c, 'character') && effectiveSubtypes(s, id).includes('仙灵'))
        for (const sid of Object.keys(s.locations).filter(sid => false))
            add(removals, '领袖', sourceInfo(s, sid, '封印在本方秘社上时，本方仙灵角色失去领袖'));
    for (const aid of sources)
        if (printedRulesCard(s, aid).automation?.static === 'deer-no-barrier' && c.name !== '月华独角兽' && keys.has('屏障'))
            add(removals, '屏障', sourceInfo(s, aid, '禁止获得屏障'));
    if (printedRulesBlank(s, id)) {
        const blankSources = realityCard(s, id) === false ? [sourceInfo(s, `society:${original.owner}`, '虚牌的印刷文本空白')] : [...(s.effects ?? []).filter(e => e.kind === 'blank-printed-rules' && e.targetId === id && e.targetZoneVersion === l.zoneVersion).map(e => effectSource(s, e)), ...nisosSources(s, id).map(a => sourceInfo(s, a, '防御力1的敌方非人类角色印刷文本空白')), ...sources.filter(a => s.locations[a].attachedTo === id && printedRulesCard(s, a).automation?.static === 'blank-host-text').map(a => sourceInfo(s, a, '受此结附的角色印刷文本空白'))];
        for (const k of original.keywords ?? [])
            for (const source of blankSources)
                add(removals, k, source);
    }
    if (l.zone === 'play' && l.faceDown)
        for (const k of keys)
            add(removals, k, { name: '暗藏者状态', reason: '正面印刷关键词未生效' });
    const keywordStates = [...keys].map(keyword => { const present = l.zone === 'play' && l.faceDown ? keyword === '迟缓' && hiddenSlowSources(s, id).length > 0 : keyword === '屏障' ? hasBarrier(s, id) : cardHasKeyword(s, id, keyword), match = keyword.match(numeric), amount = match && field ? keywordAmount(s, id, match[1]) : undefined; return { keyword, present, ...(amount !== undefined ? { amount } : {}), sources: unique(grants.get(keyword) ?? []), removedBy: present ? [] : unique(removals.get(keyword) ?? []) }; });
    const grantedAbilities = [];
    ;
    if (field && hasCardType(c, 'character') && cardHasKeyword(s, id, '声望'))
        for (const e of s.effects ?? [])
            if (e.kind === 'extra-reputation' && e.controller === p && e.round === s.round)
                grantedAbilities.push({ text: '本回合中，声望能力额外触发一次。', source: effectSource(s, e) });
    for (const source of [])
        grantedAbilities.push({ text: '不能移动或翻面。', source: sourceInfo(s, source, '青行灯持续能力') });
    for (const e of s.effects ?? [])
        if (e.kind === 'kaguya-cards-unrespondable' && e.controller === original.owner)
            grantedAbilities.push({ text: '本回合中，本方卡牌不能被响应。', source: effectSource(s, e) });
    for (const e of s.effects ?? [])
        if (field && e.kind === 'printed-battle-only' && e.targetId === id && e.targetZoneVersion === l.zoneVersion)
            grantedAbilities.push({ text: '失去黑刀和白刀以外的所有印刷能力图标，持续至离场。', source: effectSource(s, e) });
    for (const source of contingencySources(s, p, c))
        grantedAbilities.push({ text: '本回合可在快速行动时机打出一张法术牌，额外支付1；已有快速时机或在正常标准行动时打出无需使用此许可。', source: sourceInfo(s, source, '应急预案快速打出许可') });
    for (const e of s.effects ?? [])
        if (field && e.kind === 'prevent-tap' && e.targetId === id && e.targetZoneVersion === l.zoneVersion)
            grantedAbilities.push({ text: '不能被横置直到回合结束。', source: effectSource(s, e) });
    for (const e of s.effects ?? [])
        if (field && e.kind === 'prevent-destruction' && (e.targetId === id && e.targetZoneVersion === l.zoneVersion || e.allOwnRoles && e.controller === p && hasCardType(c, 'character')))
            grantedAbilities.push({ text: '本回合中，该角色不能被消灭。', source: effectSource(s, e) });
    for (const e of s.effects ?? [])
        if (e.kind === 'printed-exchange' && printedExchangeActive(s, e) && e.pair.some(t => t.cardId === id))
            grantedAbilities.push({ text: '交换印刷文本框或能力图标，直到回合结束或其中一个角色离场。', source: { name: e.sourceName, reason: '罗宾·古德菲洛已结算的交换能力' } });
    for (const source of abilityLossSources(s, id))
        grantedAbilities.push({ text: '失去所有持续、触发和行动能力，包括关键词提供的能力。', source: sourceInfo(s, source, '寂静的山谷持续能力') });
    for (const e of s.effects ?? [])
        if (field && e.kind === 'remove-existing-stars' && e.targetId === id && e.targetZoneVersion === l.zoneVersion)
            grantedAbilities.push({ text: `结算时已有的${e.black}个黑星和${e.white}个白星被移取，直到回合结束。`, source: effectSource(s, e) });
    if (field && original.copyOrigin)
        grantedAbilities.push({ text: '复制' + original.copyOrigin + '的印刷资料，保留自身名称、独有身份及复制行动。', source: { name: original.copyOrigin, reason: '换生灵马克西姆已结算的复制能力' } });
    for (const source of hiddenBoxBlankSources(s))
        grantedAbilities.push({ text: '印刷隐秘能力框空白。', source: sourceInfo(s, source, '未横置时的持续能力') });
    for (const source of [])
        grantedAbilities.push({ text: '每回合可从资产区正面打出一张超能力或超能力者牌，所需费用减少1。', source: sourceInfo(s, source, '心焰资产区打出许可') });
    for (const source of assetReputationCastSources(s, p, id))
        grantedAbilities.push({ text: '可以从本方资产区打出，仍需支付费用并满足忠诚。', source: sourceInfo(s, source, '资产区打出许可') });
    for (const source of tiagoSources(s, id))
        grantedAbilities.push({ text: '本方有隐秘时，白眼图标视作黑眼图标。', source: sourceInfo(s, source, '持续图标修正') });
    for (const aid of equipmentFastCastSources(s, p, c))
        grantedAbilities.push({ text: "可以在快速行动时机打出此装备或武器附属。", source: sourceInfo(s, aid, "快速打出许可") });
    for (const e of s.effects ?? [])
        if (e.kind === 'prevent-destruction' && (e.targetId === id && e.targetZoneVersion === l.zoneVersion || field && hasCardType(c, 'character') && e.allOwnRoles && e.controller === p))
            grantedAbilities.push({ text: '不能被消灭直到回合结束。', source: effectSource(s, e) });
    if (field && effectiveSubtypes(s, id).includes('工程师')) {
        const d = s.districts[l.district];
        if (d?.plan?.taskStatic === 'engineer-icons' && printedRulesCard(s, d.id)?.automation?.taskStatic === 'engineer-icons')
            grantedAbilities.push({ text: '获得［白眼］［黑星］。', source: sourceInfo(s, d.id, '地区持续能力') });
    }
    for (const source of loyaltyReplacementSources(s, p, c))
        grantedAbilities.push({ text: '打出或付费翻面时，可用绿、红或紫资产替代忠诚；替代方案中每张资产只满足一个符号。', source: sourceInfo(s, source, '持续忠诚替代能力') });
    if (field)
        for (const aid of [])
            if (aid !== id)
                grantedAbilities.push({ text: '防止该角色将受到的所有非战斗伤害。', source: sourceInfo(s, aid, '建御雷神持续能力') });
    if (field)
        for (const aid of sources)
            if (s.locations[aid].attachedTo === id && attachmentHostLegal(s, aid) && printedRulesCard(s, aid).attachment?.preventWounds)
                grantedAbilities.push({ text: '防止此角色将受到的创伤。', source: sourceInfo(s, aid, '结附持续能力') });
    if (field)
        for (const aid of [])
            if (aid !== id)
                grantedAbilities.push({ text: '防止该角色将受到的所有非战斗伤害。', source: sourceInfo(s, aid, '建御雷神持续能力') });
    if (field)
        for (const aid of sources)
            ;
    if (field)
        for (const aid of sources)
            ;
    for (const t of attachmentGrantedTriggers(s, id, 'death'))
        grantedAbilities.push({ text: t.abilityText ?? t.abilityLabel, source: t.grantedEffect ? effectSource(s, t) : sourceInfo(s, t.grantedBy, '结附授予') });
    if (coreRole(s, id, p)) {
        for (const c of scoredTasks(s, p, 'BQ114'))
            grantedAbilities.push({ text: '获得［黑眼］［黑星］和+1防御力；本方秘社每有一个失控标志，额外获得［黑刀］。', source: sourceInfo(s, c.id, '计分区持续能力') });
        for (const c of scoredTasks(s, p, 'BQ116'))
            grantedAbilities.push({ text: '打出或付费翻面的所需费用减少1，且该角色牌不能被响应。', source: sourceInfo(s, c.id, '计分区持续能力') });
    }
    for (const a of effectiveActions(s, id))
        if (a.grantedBy)
            grantedAbilities.push({ text: a.abilityLabel ?? cleanCardRules(s.cards[a.grantedBy]?.text).split('\n').find(line => /获得|具有/.test(line)) ?? '获得行动能力', source: sourceInfo(s, a.grantedBy, '结附授予') });
    for (const h of yellowHiddenCard(s, entropyHiddenCard(s, id)).hiddenAbilities ?? [])
        if (h.grantedBy && h.plan?.operation !== 'disaster-move')
            grantedAbilities.push({ text: h.abilityText ?? '隐秘：你可以在入栈时支付X，选择目标印刷费用为X的角色或附属，将其置于其拥有者牌库底。', source: sourceInfo(s, h.grantedBy, '持续能力授予') });
    if (progressive(s, id) && !original.keywords?.includes('可推进'))
        grantedAbilities.push({ text: '行动1：在本计划上放置一个推进标志。', source: sourceInfo(s, `society:${original.owner}`, '秘密附属获得可推进') });
    if (hasCardType(c, 'character') && effectiveSubtypes(s, id).includes('不死生物'))
        for (const aid of sources)
            ;
    for (const method of graveCastMethods(s, p, id))
        if (method.id !== 'card')
            grantedAbilities.push({ text: method.label, source: method.id.startsWith('vizier:') ? sourceInfo(s, method.id.slice(7), '墓地打出许可') : method.id === 'hades' ? { name: '计划：哈迪斯', reason: '计分区持续能力' } : { name: '当前结算的效果', reason: '一次墓地打出许可' } });
    for (const e of s.effects ?? [])
        if (e.kind === 'archaeological-return' && e.targetId === id && e.targetZoneVersion === l.zoneVersion && e.round === s.round)
            grantedAbilities.push({ text: '本回合死亡入墓后，立即横置回到之前的地区，维持死亡前操控者。', source: effectSource(s, e) });
    for (const source of palaceSources(s, original.owner, id))
        grantedAbilities.push({ text: '可以按正常时机、费用及忠诚从封印区正面打出；每个来源对象每回合一次。', source: sourceInfo(s, source, '封印区打出许可') });
    if ((l.counters?.shield ?? 0) > 0)
        grantedAbilities.push({ text: '强制触发：成为敌方卡牌或能力的目标时，移除一个护盾标志，然后终止整个效果。必须实际移除护盾。', source: { name: '护盾标志', reason: `当前${l.counters.shield}枚；每次成为目标只触发一次` } });
    if ((l.counters?.[PHILOSOPHER_STONE] ?? 0) > 0)
        grantedAbilities.push({ text: PHILOSOPHER_STONE_TEXT, source: { name: '哲人石标志', reason: `当前${l.counters[PHILOSOPHER_STONE]}枚；每枚独立触发` } });
    for (const [aid, a] of Object.entries(s.locations))
        if (field && a.zone === 'play' && !a.faceDown && a.attachedTo === id && a.hostVersion === l.zoneVersion && attachmentHostLegal(s, aid) && hasCardType(c, 'character') && printedRulesCard(s, aid).attachment?.protectHostMagic?.includes('死亡'))
            grantedAbilities.push({ text: '不能成为【死】卡牌或能力的目标。', source: sourceInfo(s, aid, '结附授予') });
    if (l.zone === 'play' && l.faceDown) {
        const source = paidRevealRestriction(s, p);
        if (source)
            grantedAbilities.push({ text: '只能在自己的行动步骤付费翻面。', source: sourceInfo(s, source, '持续现身限制') });
    }
    return { keywordStates, grantedAbilities };
}
export function recordEffectSources(s, before, sourceId, abilityText) {
    if (!sourceId)
        return;
    const name = s.cards[sourceId]?.name ?? s.districts.find(d => d?.id === sourceId)?.name;
    if (!name)
        return;
    for (const effect of s.effects ?? [])
        if (!before.has(effect) && !effect.provenance)
            effect.provenance = { name, abilityText: abilityText ?? '卡牌或能力效果' };
}
