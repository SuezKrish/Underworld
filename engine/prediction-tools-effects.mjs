import { RuleError } from './core.mjs';
import { sourceLive } from './batch-rules.mjs';
import { uuid } from './random.mjs';
import { beginEventGroup, endEventGroup } from './event-group.mjs';
const modes = {
    battle: { name: '战斗模式：黑刀2，创伤2', icons: { battle: 2 }, keywords: ['创伤2'] },
    scout: { name: '侦查模式：黑眼1、黑星1，撤回', icons: { investigation: 1, influence: 1 }, keywords: ['撤回'] },
    fortress: { name: '壁垒模式：黑刀1、黑星1，防御+1，护卫3', icons: { battle: 1, influence: 1 }, defense: 1, keywords: ['护卫3'] },
    support: { name: '支援模式：白眼1、白刀1、白星1，机动', white: true, icons: { investigation: 1, battle: 1, influence: 1 }, keywords: ['机动'] }
};
export function createPredictionToolsEffects({ move, choose, finishSpell, log }) {
    function grant(s, a, definition, duration) {
        const id = a.plan.sourceId, l = s.locations[id];
        if (!sourceLive(s, a.plan))
            return;
        const base = { targetId: id, targetZoneVersion: l.zoneVersion, sourceId: id, duration };
        for (const [icon, amount] of Object.entries(definition.icons ?? {}))
            s.effects.push({ ...base, kind: 'modify-icons', icon, amount, white: !!definition.white });
        if (definition.defense)
            s.effects.push({ ...base, kind: 'modify-defense', amount: definition.defense });
        for (const keyword of definition.keywords ?? [])
            s.effects.push({ ...base, kind: 'grant-keyword', keyword });
    }
    function effect(s, a, plan) {
        const p = a.controller;
        if (plan.operation === 'divination') {
            s.societyStates ??= [];
            s.societyStates[p] ??= { tapped: false, counters: {}, uses: {} };
            const counters = s.societyStates[p].counters ??= {}, n = (counters.divination ?? 0) + 1;
            counters.divination = n;
            choose(s, a, 'predict', p, s.players[p].deck.slice(0, n), { drawAfter: n, choiceLabel: `水镜占卜 · 预测${n}，抓${n}张牌` });
            return true;
        }
        if (plan.operation === 'shadow-buff')
            grant(s, a, { icons: { battle: 1, influence: 1 }, defense: 1 }, 'until-end-of-round');
        if (plan.operation === 'platform') {
            if (sourceLive(s, plan)) {
                choose(s, a, 'prediction-platform', p, [], { options: Object.entries(modes).map(([id, m]) => ({ id, name: m.name })), choiceLabel: '多功能人型作战平台 · 选择模式' });
                return true;
            }
        }
        if (plan.operation === 'blood-supply') {
            const template = (s.automationCards ?? s.reserveTemplates ?? []).find(c => c.catalogId === 'BQ040');
            if (!template)
                throw new RuleError('鲜血卡牌模板缺失');
            beginEventGroup(s, a.id);
            try {
                for (let i = 0; i < 2; i++) {
                    const id = uuid();
                    s.cards[id] = { ...structuredClone(template), id, owner: p, token: false };
                    s.locations[id] = { zone: 'reserve', zoneVersion: 0 };
                    s.players[p].reserve.push(id);
                    move(s, id, 'graveyard');
                }
            }
            finally {
                endEventGroup(s);
            }
            log(s, '觅血者：生成两张鲜血并置于本方墓地。');
        }
        return false;
    }
    function choice(s, p, c, x) {
        if (x.kind !== 'prediction-platform' || !Object.hasOwn(modes, c.cardId))
            throw new RuleError('请选择有效的作战平台模式');
        grant(s, x.spell, modes[c.cardId], 'this-object');
        finishSpell(s, x.spell);
    }
    return { effect, choice };
}
