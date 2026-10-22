import { RuleError } from './core.mjs';
import { uuid } from './random.mjs';
import { controllerOf } from './ownership.mjs';
import { effectiveMagicDomains } from './magic-domains.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { sealHost } from './sealing.mjs';
const need = (v, m) => {
    if (!v)
        throw new RuleError(m);
};
const selection = (s, t) => t.kind === 'district' ? `district:${t.district}` : t.kind === 'host' ? t.ref.hostId : t.kind === 'player' ? `player:${t.player}` : t.kind === 'stack' ? `stack:${t.entryId}` : t.faceDown ? `hidden:${s.locations[t.cardId]?.hiddenHandle}` : t.cardId;
// Capture paid choices at the cast event, before responses can remove or alter
// the spell. A copy is a new stack entry and never a second play/payment.
export function captureSpell(s, entryId) {
    const a = s.flow.stack.find(a => a.id === entryId && a.kind === 'play-spell');
    if (!a)
        return null;
    const c = printedRulesCard(s, a.cardId);
    return { ...structuredClone(a), copySource: { name: c.name, owner: c.owner, type: c.type, unique: c.unique, magicDomains: effectiveMagicDomains(s, a.cardId) }, targets: (a.targets ?? []).map(t => ({ ...structuredClone(t), originalSelection: selection(s, t), ...(t.kind === 'card' ? { originalController: controllerOf(s, t.cardId), originalTargetName: t.faceDown ? '暗藏者' : s.locations[t.cardId]?.secretPlan ? '秘密计划' : printedRulesCard(s, t.cardId)?.name ?? '原卡牌' } : {}) })) };
}
function groups(a) {
    const base = { ...a.plan, cardId: a.cardId }, all = a.targets ?? [];
    if (base.cqRepeatModes)
        return base.selectedCQModes.map((mode, i) => ({ key: i, label: base.modes.find(m => m.id === mode)?.label, plan: { ...base, ...base.modeTargets[mode], cqRepeatModes: null, modeTargets: null }, refs: all.map((t, index) => ({ t, index })).filter(({ t }) => t.modeIndex === i) }));
    if (base.multiMode)
        return base.selectedModes.map(mode => ({ key: mode, label: base.modes.find(m => m.id === mode)?.label, plan: { ...base, ...base.modeTargets[mode], multiMode: null, modeTargets: null }, refs: all.map((t, index) => ({ t, index })).filter(({ t }) => t.modeId === mode) }));
    return [{ key: 0, plan: { ...base, ...base.modeTargets?.[a.mode ?? base.selectedMode], modeTargets: null }, refs: all.map((t, index) => ({ t, index })) }];
}
function slotOptions(s, p, g, ref, options) {
    const opts = options(s, p, g.plan), target = g.plan.target;
    if (target === 'gunfire-district')
        return opts.filter(o => o.slot === (ref.kind === 'district' ? 'district' : 'hidden'));
    if (target === 'grave-character-and-district')
        return opts.filter(o => o.slot === (ref.kind === 'district' ? 'district' : 'grave'));
    if (['permanent-and-district', 'disaster-and-district', 'district-and-player', 'character-and-district', 'own-character-and-district'].includes(target))
        return opts.filter(o => o.slot === (ref.kind === 'district' ? 'district' : 'subject'));
    if (target === 'distributed-districts')
        return opts;
    if (target === 'sealed-and-character')
        return opts.filter(o => o.slot === ref.slot);
    return opts;
}
function newRef(s, id, old) {
    const extra = Object.fromEntries(['modeIndex', 'modeId', 'tokenCount', 'targetIndex', 'slot'].filter(k => old[k] !== undefined).map(k => [k, old[k]]));
    if (id.startsWith('district:')) {
        const district = Number(id.slice(9));
        return { ...extra, kind: 'district', district, cardId: s.districts[district].id };
    }
    if (id.startsWith('society:'))
        return { ...extra, kind: 'host', ref: sealHost(s, id) };
    if (id.startsWith('player:'))
        return { ...extra, kind: 'player', player: Number(id.slice(7)) };
    if (id.startsWith('stack:'))
        return { ...extra, kind: 'stack', entryId: id.slice(6) };
    const cardId = id.startsWith('hidden:') ? Object.keys(s.locations).find(k => s.locations[k].hiddenHandle === id.slice(7)) : id, l = s.locations[cardId];
    return { ...extra, kind: 'card', cardId, zoneVersion: l.zoneVersion, faceDown: !!l.faceDown };
}
const targetName = (s, t) => t.kind === 'card' ? (t.originalTargetName ?? (t.faceDown ? '暗藏者' : '原卡牌')) : t.kind === 'district' ? `地区${t.district + 1}` : t.kind === 'host' ? t.ref.name ?? '秘社' : t.kind === 'player' ? s.seats[t.player].name : '原堆叠效果';
export function createSpellCopyEffects({ choose, finishSpell, options, prepare, live, observeTargets, registerGroup, log }) {
    function view(s, x) { const original = x.spell.plan.copiedSpell, p = x.controller; return { copyName: original.displayName, copySlots: groups(original).flatMap(g => g.refs.map(({ t, index }) => ({ index, label: [g.label, `目标${index + 1}`, targetName(s, t)].filter(Boolean).join(' · '), options: slotOptions(s, p, g, t, options) }))) }; }
    function insert(s, a, targets, controller = a.controller) {
        const original = a.plan.copiedSpell, copy = { ...structuredClone(original), id: uuid(), group: a.id, controller, copied: true, targetsObserved: false, targets };
        s.flow.stack.push(copy);
        registerGroup?.(s, copy.group);
        observeTargets?.(s, copy);
        log(s, `${a.plan.copySourceName ?? '无瑕的索菲娅'}：${original.displayName}的复制进入堆叠。`);
    }
    function effect(s, a) {
        if (!a.plan.copiedSpell)
            return false;
        if (!a.plan.copiedSpell.targets?.length) {
            insert(s, a, []);
            return false;
        }
        choose(s, a, 'spell-copy-targets', a.controller, [], { choiceLabel: '无瑕的索菲娅 · 为法术复制选择目标' });
        return true;
    }
    function choice(s, p, c, x) {
        const original = x.spell.plan.copiedSpell, replacements = c.replacements ?? [];
        need(Array.isArray(replacements) && new Set(replacements.map(r => r.index)).size === replacements.length && replacements.every(r => Number.isSafeInteger(r.index) && r.index >= 0 && r.index < original.targets.length && typeof r.targetId === 'string'), '复制目标选择无效');
        const changed = new Map(replacements.map(r => [r.index, r.targetId])), targets = structuredClone(original.targets);
        for (const g of groups(original)) {
            if (!g.refs.some(({ index }) => changed.has(index)))
                continue;
            for (const { t, index } of g.refs)
                if (changed.has(index)) {
                    const id = changed.get(index);
                    need(slotOptions(s, p, g, t, options).some(o => o.id === id), '复制的新目标不合法');
                    targets[index] = newRef(s, id, t);
                }
            const refs = g.refs.map(({ index }) => targets[index]), ids = g.refs.map(({ t, index }) => changed.get(index) ?? selection(s, t));
            // With live retained targets, use precisely the normal targeting validator.
            // Retaining an old invalid target is allowed; it is not chosen again.
            if (g.refs.every(({ t, index }) => changed.has(index) || live(s, p, g.plan, t))) {
                const command = { targetIds: ids, ...(g.plan.target === 'gunfire-district' ? { mode: g.plan.selectedMode } : {}), ...(g.plan.target === 'distributed-districts' ? { distribution: refs.map((t, i) => ({ targetId: ids[i], count: t.tokenCount })) } : {}) };
                prepare(s, p, command, g.plan);
            }
            else {
                if (g.plan.target !== 'ordered-assault')
                    need(new Set(ids).size === ids.length, '复制不能选择重复的目标');
                if (g.plan.target === 'two-roles-or-attachments')
                    need(new Set(refs.map((t, i) => s.locations[t.cardId]?.zoneVersion === t.zoneVersion ? controllerOf(s, t.cardId) : g.refs[i].t.originalController)).size === 1, '两个目标必须由相同玩家操控');
            }
            if (['character-and-district', 'own-character-and-district', 'gunfire-district'].includes(g.plan.target)) {
                const d = refs.find(t => t.kind === 'district'), roles = refs.filter(t => t.kind === 'card');
                for (const r of roles) {
                    r.requiredDistrict = d.district;
                    r.requiredDistrictId = d.cardId;
                }
            }
        }
        insert(s, x.spell, targets);
        finishSpell(s, x.spell);
    }
    return { effect, choice, view, insert };
}
// A Vision copy retains modes/X/payments, but every occurrence of its single
// original role target must be replaced by the same other legal role.
export function visionCopyOptions(s, original, options) {
    const slots = groups(original).flatMap(g => g.refs.map(({ t }) => slotOptions(s, original.controller, g, t, options)));
    if (!slots.length)
        return [];
    return slots[0].filter(o => slots.every(list => list.some(x => x.id === o.id)) && s.locations[o.id]?.zone === 'play' && !s.locations[o.id].faceDown);
}
export function visionCopyTargets(s, original, id) { return original.targets.map(t => newRef(s, id, t)); }
