import { hasCardType } from './card-types.mjs';
import { graveyardPlanUses } from './bot-graveyard-uses.mjs';
import { removalEffects, counterEffects } from './response-effect-semantics.mjs';
const cache = new WeakMap();
// Analyze mechanics, not deck membership or catalog IDs. Unknown compound
// operations retain conservative text-derived capability hints; they do not
// invent targets, costs, or executable commands.
export function cardPlans(c) {
    const a = c?.automation ?? {}, out = [];
    function visit(plan, event) {
        if (!plan || typeof plan !== 'object')
            return;
        if (Array.isArray(plan)) {
            for (const p of plan)
                visit(p, event);
            return;
        }
        if (plan.effect || plan.operation || plan.kind && plan.kind !== 'character')
            out.push({ plan, event });
        for (const [k, p] of Object.entries(plan))
            if (p && typeof p === 'object' && !['filter', 'filterTarget', 'icons', 'loyalty'].includes(k))
                visit(p, event);
    }
    for (const [key, plan] of Object.entries(a))
        if (plan && typeof plan === 'object')
            visit(plan, key);
    visit(c?.action, 'actions');
    visit(c?.spell, 'cast');
    visit(c?.attachment, 'cast');
    visit(c?.availableActions, 'actions');
    return out;
}
export function cardCapabilities(c) {
    if (!c)
        return { plans: [], draw: 0, bottomDraw: 0, mill: 0, removal: 0, protection: 0, discount: 0, discard: 0, grave: 0, heuristic: false };
    if (cache.has(c))
        return cache.get(c);
    const plans = cardPlans(c), text = String(c.text ?? '').replaceAll('**', '').split(/FAQ|常见问题/)[0];
    const any = f => plans.some(({ plan: p }) => f(p));
    const draw = Math.max(0, ...plans.map(({ plan: p }) => ['draw', 'bottom-to-hand', 'top-select-hand', 'grave-bottom-draw'].includes(p.effect) || ['draw', 'draw-both'].includes(p.kind) ? Math.min(5, p.count ?? 1) : 0));
    const explicit = { draw, bottomDraw: any(p => p.effect === 'bottom-to-hand') ? 1 : 0, mill: any(p => ['mill', 'mill-self', 'mill-self-one', 'discard-top'].includes(p.effect)) ? 1 : 0,
        removal: any(p => removalEffects.has(p.effect) || counterEffects.has(p.effect)) ? 1 : 0,
        protection: any(p => p.operation === 'vampire-protection' || p.grantKeywords?.some(k => ['屏障', '永恒', '护盾'].includes(k))) ? 1 : 0,
        discount: !!(c.automation?.castingDiscount || c.automation?.revealDiscount), discard: any(p => p.effect === 'discard-player' || p.operation === 'discard-one') ? 1 : 0,
        grave: any(p => graveyardPlanUses(p).some(u => u.kind !== 'recycle')) ? 1 : 0 };
    const hints = { draw: /抓[一二三四五六七八九十X\d]+张牌/.test(text) ? 1 : 0, bottomDraw: /牌库底[^。\n]*置于[^。\n]*手/.test(text) ? 1 : 0,
        mill: /牌库[^。\n]*(?:顶|展示)[^。\n]*墓地/.test(text) ? 1 : 0, removal: /(?:消灭目标|终止目标|将目标[^。\n]*移回)/.test(text) ? 1 : 0,
        protection: /获得[^。\n]*(?:屏障|永恒|护盾)|不能被消灭/.test(text) ? 1 : 0, discount: /费用减少/.test(text) ? 1 : 0,
        discard: /敌方玩家[^。\n]*(?:弃|丢弃)|目标玩家弃/.test(text) ? 1 : 0, grave: /墓地[^。\n]*(?:放置进场|以暗藏者状态|移回[^。\n]*手|置于[^。\n]*手)/.test(text) ? 1 : 0 };
    const result = { plans, heuristic: Object.keys(hints).some(k => hints[k] && !explicit[k]), ...Object.fromEntries(Object.keys(explicit).map(k => [k, Math.max(Number(explicit[k]), hints[k] ?? 0)])), character: hasCardType(c, 'character') };
    cache.set(c, result);
    return result;
}
// Immediate draw potential only: a draw-on-death or next-preparation ability
// does not make the next deck cards reachable by casting this card now.
export function immediateDraws(c, events = ['cast', 'entry'], drawBlocked = false) {
    const plans = cardPlans(c).filter(x => events.includes(x.event));
    let top = 0, bottom = 0;
    for (const { plan: p } of plans) {
        const n = Math.max(0, Math.min(5, Number(p.count ?? 1) || 0));
        if (p.effect === 'bottom-to-hand')
            bottom += n;
        else if (p.effect === 'top-select-hand' || !drawBlocked && (['draw', 'grave-bottom-draw'].includes(p.effect) || ['draw', 'draw-both'].includes(p.kind)))
            top += n;
        for (const key of ['drawAfter', 'drawBefore'])
            if (!drawBlocked && Number.isFinite(p[key]))
                top += Math.max(0, p[key]);
    }
    return { top: Math.min(5, top), bottom: Math.min(3, bottom) };
}
