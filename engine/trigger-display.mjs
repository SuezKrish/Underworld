const eventNames = { reputation: '声望', 'prepareTrigger': '准备步骤触发', 'endTrigger': '结束步骤触发', battle: '战斗触发', 'region-win': '赢取地区触发', rumor: '传闻', 'enter-play': '进场触发' };
// Also labels triggers loaded from rooms saved before display names were stored.
// Never substitute an internal card identifier for a player-facing name.
export function triggerDisplayName(s, a) {
    if (a.displayName)
        return a.displayName;
    const id = a.sourceId ?? a.cardId ?? a.plan?.sourceId, l = s.locations[id];
    const source = l?.secretPlan ? '秘密计划' : l?.faceDown ? '暗藏者' : s.cards[id]?.name ?? s.districts?.find(d => d?.id === id)?.name ?? s.players.flatMap(p => p.scoreCards ?? []).find(c => c.id === id)?.name;
    const ability = a.event === 'keyword-influence' ? a.keyword : eventNames[a.event];
    return [source, ability ?? '触发能力'].filter(Boolean).join(' · ');
}
