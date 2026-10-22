import { PHILOSOPHER_STONE, PHILOSOPHER_STONE_TEXT } from './philosopher-stone-definitions.mjs';
const labels = { shield: '护盾', progress: '推进', locked: '锁定', time: '时间', crisis: '危机', renown: '名望', divination: '卜卦', revival: '复苏', rest: '休整', investigation: '调查', battle: '战斗', influence: '势力', defense: '防御', [PHILOSOPHER_STONE]: '哲人石' };
export function visibleCardMarkers(card) {
    const counts = { ...card.counters };
    counts.time = (counts.time ?? 0) + (card.markers ?? 0);
    if (card.wounds > 0)
        counts['创伤'] = (counts['创伤'] ?? 0) + card.wounds;
    const influence = (card.clubInfluence ?? []).flatMap((count, p) => count > 0 ? [{ key: `club-influence:${p}`, count, label: `${card.clubInfluenceNames?.[p] ?? (p === card.controller ? '本方' : '敌方')}势力标志` }] : []);
    return [...influence, ...Object.entries(counts).filter(([, n]) => Number.isFinite(n) && n > 0).map(([key, count]) => ({
            key, count, label: `${labels[key] ?? key.replace(/标志$/, '')}标志`,
            ...(key === PHILOSOPHER_STONE ? { description: PHILOSOPHER_STONE_TEXT } : {})
        }))];
}
