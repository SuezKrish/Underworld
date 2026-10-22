import { magicDomainsForSearch } from '../engine/card-search.mjs';
const symbols: Record<string, string> = { 心灵: '心', 神圣: '圣', 星辰: '星', 死亡: '死', 鲜血: '血' };
export function MagicDomainIcons({ domains, magic }: {
    domains?: string[];
    magic?: string;
}) { const names = magicDomainsForSearch({ magicDomains: domains, magic }); return names.length ? <span className='magic-domain-icons' aria-label={`魔法领域：${names.join('、')}`}>{names.map((name: string) => <span className='magic-domain-icon' key={name} title={name}>【{symbols[name] ?? name}】</span>)}</span> : null; }
