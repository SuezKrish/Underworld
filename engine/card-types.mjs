const aliases = { 角色: 'character', 附属: 'attachment', 事务: 'spell', 资产: 'asset', 秘社: 'society', 地区: 'district', 任务: 'task', 指示物: 'token', 指示物角色: 'character', 指示物附属: 'attachment', 指示物资产: 'asset' };
const normalize = type => aliases[type] ?? type;
export function cardTypes(card) { return [...new Set((card?.type ?? '').split('/').filter(Boolean).map(normalize))]; }
export function hasCardType(card, type) { return !!card && (normalize(type) === 'token' ? !!card.token || card.type?.split('/').some(t => t.startsWith('指示物')) : cardTypes(card).includes(normalize(type))); }
export function hasAnyCardType(card, types) { return types.some(type => hasCardType(card, type)); }
export function cardTypeLabel(card) { const labels = { character: '角色', attachment: '附属', spell: '事务', asset: '资产', society: '秘社', district: '地区', task: '任务', 'hidden-character': '暗藏者' }; return cardTypes(card).map(type => labels[type] ?? type).join('/'); }
