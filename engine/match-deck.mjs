import { validateDeck } from './decks.mjs';
import { decodeDeckCode } from './deck-code.mjs';
export function prepareMatchDeck(input, ctx, deckRevision = null) {
    const validation = validateDeck(input, ctx.cards, ctx.implemented);
    if (!validation.playable)
        throw Error(validation.errors[0]?.message ?? '卡组中包含尚未实现自动结算的卡牌，请回组卡页面调整');
    const compiled = new Map(ctx.compiled.map(c => [c.catalogId, c]));
    if (validation.deck.choices.coreId && !compiled.get(validation.deck.choices.coreId)?.automation?.coreAbility)
        throw Error('所选核心角色尚未接入自动结算');
    const estimated = validation.deck.cards.reduce((n, r) => n + JSON.stringify(compiled.get(r.cardId)).length * r.count, 0);
    if (estimated > 600000)
        throw Error('当前卡组超出平台测试房间的存储容量，请减少数量后重试；这不是游戏构筑规则的卡组上限');
    return { name: validation.deck.name, society: validation.society, choices: validation.deck.choices,
        core: validation.deck.choices.coreId ? structuredClone(compiled.get(validation.deck.choices.coreId)) : null,
        cards: validation.deck.cards.flatMap(r => Array.from({ length: r.count }, () => structuredClone(compiled.get(r.cardId)))),
        catalogRevision: ctx.revision, poolRevision: ctx.poolRevision, deckRevision };
}
export function prepareCodeDeck(code, ctx) { return prepareMatchDeck(decodeDeckCode(code), ctx); }
