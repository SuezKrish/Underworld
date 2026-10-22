'use client';
import {compareCardOrder} from '../../engine/card-order.mjs';
import { ResponsiveNavigation } from '../mobile-ui';
import { catalogCardVisible } from '../../engine/card-relations.mjs';
import { BackgroundSettings } from '../background-settings';
import { CardInformationProvider, useCardInformation, RelatedCardLinks } from '../card-information';
import { KeywordReference } from '../keyword-reference';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bold, Download, Eye, Search, Upload, X } from 'lucide-react';
import { Rich } from '../rich-text';
import { parseCardSearch, matchesCardSearch, printedCostForSearch, magicDomainsForSearch, mainTypesForSearch } from '../../engine/card-search.mjs';
import { cardTypeLabel } from '../../engine/card-types.mjs';
import { MagicDomainIcons } from '../magic-domain-icons';
import { CardSearchHelp } from '../card-search-help';
import { AccountControls } from '../account-controls';
import { PoolControls, CardAvailabilityControl } from '../card-pool-controls';
export default function CardPool() {
    const offline = typeof window !== 'undefined' && (window as any).__HIDDEN_WORLD_OFFLINE__ === true;
    const [mobileFilters, setMobileFilters] = useState(false), [pool, setPool] = useState<any>(null), [query, setQuery] = useState(''), [type, setType] = useState(''), [set, setSet] = useState(''), [faction, setFaction] = useState(''), [magic, setMagic] = useState(''), [cost, setCost] = useState(''), [costOperator, setCostOperator] = useState(':'), [auditFilter, setAuditFilter] = useState(''), [availabilityFilter, setAvailabilityFilter] = useState(''), [page, setPage] = useState(0), [selected, setSelected] = useState<string | null>(null), [draft, setDraft] = useState<any>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [importing, setImporting] = useState<any>(null);
    const file = useRef<HTMLInputElement>(null), nameInput = useRef<HTMLInputElement>(null), linked = useRef(false);
    async function load() {
        try {
            const r = await fetch('/api/cards', { cache: 'no-store' }), d = await r.json() as any;
            if (!r.ok)
                throw Error(d.error);
            setPool(d);
            setError('');
        }
        catch (e) {
            setError((e as Error).message);
        }
    }
    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (selected || importing || busy)
            return;
        const refresh = () => {
            if (document.visibilityState === 'visible')
                load();
        }, timer = setInterval(refresh, 15000);
        window.addEventListener('focus', refresh);
        return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
    }, [selected, importing, busy]);
    const showDevelopment = !offline && pool?.canManagePool === true;
    const allCards = pool?.cards ?? [], cards = allCards.filter(catalogCardVisible).sort(compareCardOrder), search = useMemo(() => parseCardSearch(query), [query]), filtered = useMemo(() => cards.filter((c: any) => (!availabilityFilter || (availabilityFilter === 'enabled' ? c.availability?.enabled : !c.availability?.enabled)) && (!auditFilter || (auditFilter === 'automated' ? c.audit?.implemented : auditFilter.startsWith('block:') ? !c.audit?.implemented && c.audit?.blocker?.category === auditFilter.slice(6) : c.audit?.ruleStatus === auditFilter)) && (!type || mainTypesForSearch(c).includes(type)) && (!set || c.sets.some((s: any) => s.name === set)) && (!faction || c.faction === faction) && (!magic || (magic === '无' ? magicDomainsForSearch(c).length === 0 : magicDomainsForSearch(c).includes(magic))) && (!cost || matchesCardSearch(c, `o${costOperator}${cost}`)) && matchesCardSearch(c, search)), [pool, search, type, set, faction, magic, cost, costOperator, auditFilter, availabilityFilter]);
    const active = cards.find((c: any) => c.id === selected), types = [...new Set<string>(cards.flatMap((c: any) => mainTypesForSearch(c)))].sort(), magics = [...new Set<string>(cards.flatMap((c: any) => magicDomainsForSearch(c)))].sort(), costs = [...new Set<number>(cards.map((c: any) => printedCostForSearch(c)))].sort((a, b) => a - b), sets = [...new Set<string>(cards.flatMap((c: any) => c.sets.map((s: any) => s.name)))].sort(), factions = [...new Set<string>(cards.map((c: any) => c.faction))].sort();
    useEffect(() => { setPage(p => Math.min(p, Math.max(0, Math.ceil(filtered.length / 36) - 1))); }, [filtered.length]);
    useEffect(() => {
        if (pool && !pool.canManagePool)
            setAvailabilityFilter('');
    }, [pool?.canManagePool]);
    useEffect(() => {
        if (!pool || linked.current)
            return;
        linked.current = true;
        const id = new URL(location.href).searchParams.get('card'), c = cards.find((c: any) => c.id === id);
        if (c) {
            choose(c);
            setQuery(c.code);
        }
    }, [pool]);
    function choose(c: any) { setSelected(c.id); setDraft({ displayName: c.displayName ?? c.name, unique: c.unique ?? 0, text: c.text, faq: c.faq ?? '', subtitle: c.subtitle, flavorText: c.flavorText }); setError(''); setMessage(''); }
    async function write(body: any) {
        setBusy(true);
        setError('');
        try {
            const r = await fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, revision: pool.revision, settingsRevision: pool.poolManagement?.revision }) }), d = await r.json() as any;
            if (!r.ok)
                throw Error(d.error);
            setPool(d);
            setMessage(body.type === 'import' ? `已导入 ${d.cards.length} 条记录，移除 ${d.removed} 条繁体描述。` : body.type.startsWith('set-') ? '全站启用设置已保存。' : '已保存，可导出至 XML。');
            if (body.type === 'import') {
                setImporting(null);
                setSelected(null);
                setDraft(null);
                setPage(0);
                setQuery('');
                setType('');
                setSet('');
                setFaction('');
                setMagic('');
                setCost('');
                setCostOperator(':');
                setAuditFilter('');
            }
            return true;
        }
        catch (e) {
            setError((e as Error).message);
            return false;
        }
        finally {
            setBusy(false);
        }
    }
    function boldName() {
        const el = nameInput.current;
        if (!el)
            return;
        const a = el.selectionStart ?? 0, b = el.selectionEnd ?? 0;
        if (a === b)
            return;
        const t = draft.displayName;
        setDraft({ ...draft, displayName: t.slice(0, a) + '**' + t.slice(a, b) + '**' + t.slice(b) });
    }
    async function readFile(f: File) {
        setError('');
        try {
            if (f.size > 1700000)
                throw Error('XML 文件不得超过1.7 MB');
            const xml = await f.text(), doc = new DOMParser().parseFromString(xml, 'application/xml');
            if (doc.querySelector('parsererror') || !doc.querySelector('cockatrice_carddatabase > cards'))
                throw Error('请选择有效的 Cockatrice Card.xml 文件');
            const count = doc.querySelectorAll('cards > card').length;
            if (!count || count > 2000)
                throw Error('卡牌数量需要在1至2000之间');
            setImporting({ xml, count, name: f.name });
        }
        catch (e) {
            setError((e as Error).message);
        }
    }
    function filter(change: () => void) { change(); setPage(0); }
    return <CardInformationProvider cards={allCards} catalogCards={allCards}><div className="app-shell"><header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Eye size={23}/></span><div><strong>隐秘世界</strong><small>UNDERWORLD · CARD LIBRARY</small></div></a><ResponsiveNavigation><BackgroundSettings /><KeywordReference /><a className="quiet" href="/card-revisions">卡牌修订</a><a className="quiet" href="/"><ArrowLeft size={16}/>返回大厅</a><AccountControls returnTo="/cards"/></ResponsiveNavigation></header><main className="catalog-main"><div className="catalog-heading"><div><span className="eyebrow">{showDevelopment ? 'CARD.XML · 卡牌资料' : 'CARD LIBRARY'}</span><h1>卡牌池 <span>{pool ? cards.length : '—'}</span></h1><p>检索卡牌，查看规则文本与FAQ。</p></div>{showDevelopment && <div className="room-actions"><input hidden type="file" accept=".xml,application/xml,text/xml" ref={file} onChange={e => {
                const f = e.target.files?.[0];
                if (f)
                    readFile(f);
                e.target.value = '';
            }}/>{pool?.canManagePool && <button className="secondary" disabled={busy || !pool} onClick={() => file.current?.click()}><Upload size={16}/>导入 XML</button>}<a className='secondary' href='/api/cards?format=blockers' download='Card.blockers.json'>导出待实现清单</a><a className="secondary" href="/api/cards?format=audit" download="Card.audit.json">导出审核</a><a className="primary" href="/api/cards?format=xml" download="Card.modified.xml"><Download size={16}/>导出 XML</a></div>}</div>{showDevelopment && <><div className="note">逐卡审核：{pool?.auditCounts?.clear ?? 0} 条文字明确，{pool?.auditCounts?.disputed ?? 0} 条存在歧义或冲突，{pool?.auditCounts?.['needs-confirmation'] ?? 0} 条待补资料或裁定。已实现 {pool?.auditCounts?.automated ?? 0} 条真实卡牌记录，可在大厅创建真实卡牌测试房间。文字明确的其余卡牌尚未实现。</div><div className="note">资料补全：{pool?.metadataSummary?.matchedCards ?? 0} 张匹配来源 · {pool?.metadataSummary?.uniqueCards ?? 0} 张记录为独有 · {pool?.metadataSummary?.subtitles ?? 0} 张副名 · {pool?.metadataSummary?.flavors ?? 0} 张风味文本。存在较大正文差异和识别不确定项，请查看核对清单。</div><div className='note'>待实现：{Object.entries(pool?.blockerCounts ?? {}).map(([k, v]) => `${k} ${v}条`).join(' · ')}。机制复杂表示需要继续扩展引擎；不表示永远无法实现。</div><details className="zone-details"><summary>当前测试约定与裁定</summary>{pool?.auditAssumptions?.map((t: string) => <p key={t}>{t}</p>)}</details></>}{error && <div className="error" role="alert">{error} <button className="quiet" onClick={load}>刷新卡牌池</button></div>}{message && <p className="catalog-success" role="status">{message}</p>}<PoolControls pool={pool} busy={busy} write={write}/><button className="secondary mobile-filter-toggle" aria-expanded={mobileFilters} aria-controls="catalog-filters" onClick={() => setMobileFilters(!mobileFilters)}>{mobileFilters ? '收起筛选' : '展开筛选'}{[type, set, faction, magic, cost, availabilityFilter].filter(Boolean).length > 0 && ` · ${[type, set, faction, magic, cost, availabilityFilter].filter(Boolean).length}项`}</button><div id="catalog-filters" className={`catalog-filters${mobileFilters ? ' filters-expanded' : ''}`}>{pool?.canManagePool && <select aria-label="启用状态" value={availabilityFilter} onChange={e => filter(() => setAvailabilityFilter(e.target.value))}><option value="">全部启用状态</option><option value="enabled">已启用</option><option value="disabled">已禁用</option></select>}<label className="search-field"><Search size={17}/><input aria-label="搜索卡牌" value={query} onChange={e => filter(() => setQuery(e.target.value))} aria-describedby="catalog-search-error" placeholder="牌名 或 搜索过滤"/></label>{showDevelopment && <select aria-label="审核状态" value={auditFilter} onChange={e => filter(() => setAuditFilter(e.target.value))}><option value="">全部审核状态</option><option value="automated">已实现自动结算</option><option value="clear">文字明确</option><option value="disputed">存在歧义或冲突</option><option value="needs-confirmation">待补资料或裁定</option>{['规则歧义', '资料不足', '工程复杂', '仅未排期'].map(k => <option key={k} value={`block:${k}`}>待实现 · {k}</option>)}<option value="unreviewed">修改后待重审</option></select>}<select aria-label="卡牌类型" value={type} onChange={e => filter(() => setType(e.target.value))}><option value="">全部类型</option>{types.map(t => <option key={t} value={t}>{cardTypeLabel({ type: t })}</option>)}</select><select aria-label="卡牌系列" value={set} onChange={e => filter(() => setSet(e.target.value))}><option value="">全部系列</option>{sets.map(t => <option key={t}>{t}</option>)}</select><select aria-label="卡牌势力" value={faction} onChange={e => filter(() => setFaction(e.target.value))}><option value="">全部势力</option>{factions.map(t => <option key={t}>{t}</option>)}</select><select aria-label='魔法领域筛选' value={magic} onChange={e => filter(() => setMagic(e.target.value))}><option value=''>全部魔法领域</option><option value='无'>无魔法领域</option>{magics.map(m => <option key={m}>{m}</option>)}</select><div className='catalog-cost-filter'><select aria-label='印刷费用比较' value={costOperator} onChange={e => filter(() => setCostOperator(e.target.value))}><option value=':'>费用等于</option><option value='!'>费用不等于</option><option value='<'>费用小于</option><option value='>'>费用大于</option></select><input aria-label='印刷费用筛选' type='number' min='0' step='1' list='catalog-cost-values' value={cost} placeholder='任意费用' onChange={e => filter(() => setCost(e.target.value))}/><datalist id='catalog-cost-values'>{costs.map(n => <option key={n} value={n}/>)}</datalist></div></div><CardSearchHelp />{search.errors.length > 0 && <p className='error' id='catalog-search-error' role='alert'>{search.errors.join('；')}</p>}<div className="catalog-status"><span>{filtered.length} 条结果 · 第 {page + 1} / {Math.max(1, Math.ceil(filtered.length / 36))} 页</span>{showDevelopment && <small>源文件保留同名的不同版本 · 修订 {pool?.revision ?? 0}</small>}</div>{!pool ? <p>正在读取卡牌资料…</p> : <div className="catalog-grid">{filtered.slice(page * 36, (page + 1) * 36).map((c: any) => <article className={`catalog-entry ${c.availability?.enabled === false ? 'pool-card-disabled' : ''}`} key={c.id}><CatalogCard card={c} choose={() => choose(c)}><div className="catalog-card-top"><code>{c.code}</code><span>{c.cost}</span></div><h2 className="formatted-name"><Rich name text={c.displayName ?? c.name}/></h2>{c.unique === 1 && <span className='audit-badge'>独有</span>}{showDevelopment && <span className={`audit-badge ${c.audit?.implemented ? 'implemented' : ''}`}>{c.audit?.implemented ? '已实现自动结算' : c.audit?.ruleStatus === 'clear' ? '文字明确 · 尚未实现' : c.audit?.ruleStatus === 'disputed' ? '存在歧义或冲突' : c.audit?.ruleStatus === 'needs-confirmation' ? '待补资料或裁定' : '修改后待重审'}</span>}{c.subtitle && <p className="card-subtitle">{c.subtitle}</p>}<small>{c.typeLine}</small><p className="catalog-text"><Rich text={c.text}/></p>{c.flavorText && <p className="card-flavor"><Rich text={c.flavorText}/></p>}<RelatedCardLinks cardId={c.id}/><div className="catalog-card-bottom"><span>{c.faction} <MagicDomainIcons magic={c.magic}/></span><span>{c.sets.map((s: any) => s.name).join(' / ')}</span></div></CatalogCard>{pool.canManagePool && <CardAvailabilityControl card={c} busy={busy} write={write}/>}</article>)}</div>}{pool && filtered.length === 0 && <p className="catalog-empty">没有符合条件的卡牌。</p>}<div className="catalog-pagination"><button className="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</button><button className="secondary" disabled={(page + 1) * 36 >= filtered.length} onClick={() => setPage(page + 1)}>下一页</button></div></main>
 {active && draft && pool?.canManagePool && <div className="modal-scrim"><section className="rules-modal card-editor" role="dialog" aria-modal="true" aria-label="编辑卡牌"><button className="icon close" aria-label="关闭卡牌编辑" onClick={() => { setSelected(null); setDraft(null); }}><X size={20}/></button><span className="eyebrow">{active.code} · {active.sets.map((s: any) => `${s.name} ${s.number}`).join(' / ')}</span><h2 className="formatted-name"><Rich name text={active.displayName ?? active.name}/></h2><p>{active.typeLine} · 费用 {active.cost} · {active.faction} · 法术领域 {active.magic}</p><CardAvailabilityControl card={active} busy={busy} write={write}/><section className="audit-detail"><h3>能力审核</h3><p>{active.audit?.summary}</p><p>{active.audit?.reason}</p>{active.audit?.blocker && <div><h4>当前实现障碍 · {active.audit.blocker.category}</h4><p>{active.audit.blocker.reason}</p><p>{active.audit.blocker.decision}</p>{active.audit.blocker.issues?.map((a: any, i: number) => <div key={i}><blockquote>{a.quote}</blockquote><p>{a.reason}</p><p>{a.decision}</p></div>)}{active.audit.blocker.engineeringTasks?.map((a: any, i: number) => <details key={i}><summary>{a.reason}</summary><blockquote>{a.quote}</blockquote><p>{a.decision}</p></details>)}</div>}{active.audit?.issues?.map((a: any, i: number) => <div key={i}><blockquote>{a.excerpt}</blockquote><p>{a.question}</p></div>)}{active.audit?.rulings?.map((r: string) => <p key={r}>{r}</p>)}{active.audit?.deferredByUser && <p>按你的要求，本轮暂不处理。</p>}<small>修改能力、费用或图标会撤销该版本的自动化资格。副名、风味文本和牌名加粗格式不影响已有能力实现。正文、副名与风味文本的加粗标记会自动移除。</small></section><section className="audit-detail"><h3>资料来源核对</h3>{active.metadata ? <><p>{active.metadata.sources?.join(' · ')}</p><p>{active.metadata.bodyComparison}</p>{active.metadata.issues?.map((t: string) => <p key={t}>{t}</p>)}</> : <p>本批资料没有可确认的对应来源。</p>}<p>正文以既有 XML 为准。识别不确定的字段留待核对；可下载完整资料差异清单。</p></section><div className="panel-title"><label htmlFor="card-display-name">牌名加粗格式</label><button className="secondary" onClick={boldName}><Bold size={15}/>加粗选中牌名</button></div><input id="card-display-name" ref={nameInput} maxLength={300} value={draft.displayName} onChange={e => setDraft({ ...draft, displayName: e.target.value })}/><p className="mini-help">只在原牌名中添加 **加粗**；独有属性单独记录，不随编辑格式自动变化。</p><label htmlFor="card-unique">独有属性（unique）</label><select id="card-unique" value={draft.unique} onChange={e => setDraft({ ...draft, unique: Number(e.target.value) })}><option value={0}>0 · 非独有（默认）</option><option value={1}>1 · 独有</option></select><p className="mini-help">独有与“唯一”分别处理，独有标记不会将构筑上限改为1张。同一操控者按显示牌名加粗部分识别独有身份；多个同身份独有角色进场触发先发动，再选择规则性牺牲至一个。没有加粗时暂按完整牌名识别，请补齐身份格式。</p><label htmlFor="card-subtitle">副名</label><input id="card-subtitle" maxLength={200} value={draft.subtitle} placeholder="可留空" onChange={e => setDraft({ ...draft, subtitle: e.target.value })}/><label htmlFor="card-text">简体能力正文（普通文本）</label><textarea id="card-text" rows={10} maxLength={24000} value={draft.text} onChange={e => setDraft({ ...draft, text: e.target.value })}/><label htmlFor="card-faq">FAQ（独立显示，不参与搜索）</label><textarea id="card-faq" rows={4} maxLength={24000} value={draft.faq} onChange={e => setDraft({ ...draft, faq: e.target.value })}/><label htmlFor="card-flavor">风味文本</label><textarea id="card-flavor" rows={3} maxLength={4000} placeholder="可留空，支持 **加粗**" value={draft.flavorText} onChange={e => setDraft({ ...draft, flavorText: e.target.value })}/><details className="zone-details" open><summary>牌面文字预览</summary><h3 className="formatted-name"><Rich name text={draft.displayName}/></h3>{draft.subtitle && <p className="card-subtitle">{draft.subtitle}</p>}<p className="rich-preview"><Rich text={draft.text}/></p>{draft.flavorText && <p className="card-flavor rich-preview"><Rich text={draft.flavorText}/></p>}</details><p className="mini-help">XML 接口：prop/displayname（显示牌名，可部分加粗）、prop/unique（0或1，默认0）、prop/subtitle、prop/flavortext、prop/textformat=markdown；text 中使用 **文字** 标记加粗。卡牌原有编号、关联与属性保留。</p>{error && <p className="error" role="alert">{error}</p>}<button className="primary wide" disabled={busy} onClick={() => write({ type: 'edit', cardId: active.id, ...draft })}>{busy ? '保存中…' : '保存卡牌资料'}</button></section></div>}
 {active && !pool?.canManagePool && <div className="modal-scrim"><section className="rules-modal card-editor" role="dialog" aria-modal="true" aria-label="卡牌详情"><button className="icon close" aria-label="关闭卡牌详情" onClick={() => { setSelected(null); setDraft(null); }}><X size={20}/></button><span className="eyebrow">{active.code}</span><h2 className="formatted-name"><Rich name text={active.displayName ?? active.name}/></h2>{active.subtitle && <p>{active.subtitle}</p>}<p>{active.typeLine} · {active.cost} · {active.faction} · {active.magic}</p><p className="rich-preview"><Rich text={active.text}/></p>{active.flavorText && <p className="card-flavor"><Rich text={active.flavorText}/></p>}<p>{active.sets.map((s: any) => s.name).join(' / ')}</p></section></div>}
 {importing && <div className="modal-scrim"><section className="rules-modal" role="dialog" aria-modal="true" aria-label="确认导入"><h2>从 XML 更新卡牌池</h2><p>{importing.name} · {importing.count} 条卡牌记录</p><p>导入会替换当前卡牌池，包括未包含在新文件中的修改。可以先关闭此窗口，导出当前 XML 备份。导入不会改变已有房间的测试牌。</p>{error && <p className="error" role="alert">{error}</p>}<div className="reward-row"><button className="secondary" disabled={busy} onClick={() => setImporting(null)}>取消</button><button className="primary" disabled={busy} onClick={() => write({ type: 'import', xml: importing.xml })}>确认替换卡牌池</button></div></section></div>}</div></CardInformationProvider>;
}
function CatalogCard({ card, choose, children }: {
    card: any;
    choose: () => void;
    children: React.ReactNode;
}) {
    const information = useCardInformation();
    return <button className='catalog-card' onClick={choose} aria-haspopup='menu' onContextMenu={e => { e.preventDefault(); information?.open(card.id, e.currentTarget, e.clientX, e.clientY, false); }} onKeyDown={e => {
            if (e.key === 'ContextMenu' || e.shiftKey && e.key === 'F10') {
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                information?.open(card.id, e.currentTarget, r.left, r.bottom, false);
            }
        }}>{children}</button>;
}
