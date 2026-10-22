'use client';
import { ResponsiveNavigation } from '../mobile-ui';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, Search } from 'lucide-react';
import { BackgroundSettings } from '../background-settings';
import { revisionOverview } from '../../engine/revision-overview.mjs';
import { revisionDiffSegments } from '../../engine/revision-diff.mjs';
import { Rich } from '../rich-text';
type Revision = {
    before: string;
    after: string;
    kind: string;
    note?: string;
    field?: string;
    diff: {
        prefix: string;
        removed: string;
        added: string;
        suffix: string;
    };
};
type RevisedCard = {
    id: string;
    name: string;
    displayName: string;
    typeLine: string;
    sets: {
        name: string;
    }[];
    latest: {
        text: string;
        faq: string;
    };
    revisions: Revision[];
};
export default function CardRevisions() {
    const offline = typeof window !== 'undefined' && (window as any).__HIDDEN_WORLD_OFFLINE__ === true;
    const [data, setData] = useState<{
        cards: RevisedCard[];
        revisionCount: number;
        reviewedCards: number;
        canReviewNotes?: boolean;
    } | null>(null), [query, setQuery] = useState(''), [expansion, setExpansion] = useState(''), [kind, setKind] = useState(''), [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        fetch('/api/card-revisions', { cache: 'no-store' }).then(async (r) => {
            const d = await r.json() as any;
            if (!r.ok)
                throw Error(d.error);
            if (active)
                setData(d);
        }).catch(e => {
            if (active)
                setError(e.message);
        });
        return () => { active = false; };
    }, []);
    const all = useMemo(() => (data?.cards ?? []).map(c => ({ ...c, overview: revisionOverview(c) })).filter(c => c.overview.length), [data]), sets = [...new Set(all.flatMap(c => c.sets.map(s => s.name)))].sort(), kinds = [...new Set(all.flatMap(c => c.overview.flatMap(r => r.kinds)))].sort();
    const filtered = useMemo(() => all.filter(c => (!expansion || c.sets.some(s => s.name === expansion)) && (!kind || c.overview.some(r => r.kinds.includes(kind))) && (!query.trim() || `${c.id} ${c.name}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))), [data, query, expansion, kind]);
    return <div className='app-shell'><header className='topbar'><a className='brand' href='/'><span className='brand-mark'><Eye size={23}/></span><div><strong>隐秘世界</strong><small>CARD REVISIONS</small></div></a><ResponsiveNavigation><BackgroundSettings /><a className='quiet' href='/cards'><ArrowLeft size={16}/>卡牌池</a><a className='quiet' href='/'>大厅</a></ResponsiveNavigation></header>
 <main className='catalog-main revision-main' aria-busy={!data && !error}><div className='catalog-heading'><div><span className='eyebrow'>{offline ? 'CARD REVISIONS' : '规则文本审查'}</span><h1>卡牌修订</h1><p>每张卡牌仅对比最初文本与最终文本。纯标点、加粗调整、补写遗漏结附条件及已撤回的措辞提案不列入。</p>{data && <p className='revision-count'>{!offline && <>已核对 {data.reviewedCards} 条资料 · </>}{all.length} 张牌</p>}</div></div>
 <div className='revision-filters'><label><Search size={17}/><input aria-label='搜索卡牌修订' disabled={!data} placeholder='牌名或编号' value={query} onChange={e => setQuery(e.target.value)}/></label><select aria-label='修订扩展' disabled={!data} value={expansion} onChange={e => setExpansion(e.target.value)}><option value=''>全部扩展</option>{sets.map(s => <option key={s}>{s}</option>)}</select><select aria-label='修订类型' disabled={!data} value={kind} onChange={e => setKind(e.target.value)}><option value=''>全部修订类型</option>{kinds.map(k => <option key={k}>{k}</option>)}</select><span>{data ? filtered.length : '—'} 张牌</span></div>
 {error && <p role='alert' className='error'>{error}</p>}{!data && !error && <p role='status'>正在读取修订记录…</p>}{data && !filtered.length && <p>没有匹配的修订。</p>}
 <div className='revision-list'>{filtered.map(c => <details className='revision-card' key={c.id}><summary><span className='revision-card-code'>{c.id}</span><strong><Rich name text={c.displayName}/></strong><span>{c.sets.map(s => s.name).join(' / ')}</span><small>{[...new Set(c.overview.flatMap(r => r.kinds))].join('、')}</small></summary><div className='revision-card-content'><p className='revision-card-type'>{c.typeLine}</p>{c.overview.map((r: any, i: number) => <section className='revision-entry' key={i}><div className='revision-entry-heading'><strong>{r.kinds.join('、')}{r.field !== '正文' && ` · ${r.field}`}</strong></div><div className='revision-comparison'><div><h3>未修订文本</h3><p><RevisionDiff before={r.before} after={r.after} side='before'/></p></div><div><h3>最后修订文本</h3><p><RevisionDiff before={r.before} after={r.after} side='after'/></p></div></div></section>)}<section className='revision-current'><a className='quiet' href={`/cards?card=${encodeURIComponent(c.id)}`}>在卡牌池查看</a></section></div></details>)}</div>
 </main></div>;
}
function RevisionDiff({ before, after, side }: {
    before: string;
    after: string;
    side: 'before' | 'after';
}) { return <>{revisionDiffSegments(before, after).map((s: any, i: number) => s.kind === 'equal' ? s.text : s.kind === 'delete' ? (side === 'before' ? <del className='revision-removed' key={i}>{s.text}</del> : null) : (side === 'after' ? <ins className='revision-added' key={i}>{s.text}</ins> : null))}</>; }
