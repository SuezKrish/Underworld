export const BACKGROUND_PRESETS = [
    { id: 'city', name: '拉斯维加斯', position: '48% center', accent: '#b3a28b' },
    { id: 'abyss', name: '尖鸣突变体', position: '52% center', accent: '#b2a08a' },
    { id: 'manor', name: '爱弗罗德庄园', position: '50% center', accent: '#b0a58c' },
    { id: 'ruins', name: '安妮斯朵拉', position: '64% center', accent: '#b5a08f' },
    { id: 'tarot', name: '无瑕的索菲娅', position: '50% center', accent: '#b6a47e' }
];
export const DEFAULT_HIGHLIGHTS = { source: '#7da9b9', draft: '#b49bc2', cost: '#c4a176', target: '' };
export const DEFAULT_INTERFACE = { id: '', fit: 'cover', darkness: 50, highlights: DEFAULT_HIGHLIGHTS };
export function normalizeInterfacePreference(value) {
    const v = value && typeof value === 'object' ? value : {};
    return { id: BACKGROUND_PRESETS.some(p => p.id === v.id) ? v.id : '', fit: v.fit === 'contain' ? 'contain' : 'cover', darkness: Number.isFinite(v.darkness) ? Math.min(80, Math.max(10, v.darkness)) : 50,
        highlights: Object.fromEntries(Object.entries(DEFAULT_HIGHLIGHTS).map(([key, defaultValue]) => [key, /^#[a-f0-9]{6}$/i.test(v.highlights?.[key] ?? '') ? v.highlights[key].toLowerCase() : defaultValue])) };
}
export function highlightStyles(value) { const { highlights } = normalizeInterfacePreference(value); return { '--highlight-source': highlights.source, '--highlight-draft': highlights.draft, '--highlight-cost': highlights.cost, '--highlight-target': highlights.target || 'var(--gold)' }; }
export function displayedHighlightColor(value, key) { return value.highlights[key] || (BACKGROUND_PRESETS.find(p => p.id === value.id)?.accent ?? '#b3a483'); }
