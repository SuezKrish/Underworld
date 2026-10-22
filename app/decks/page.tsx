'use client';
import { ResponsiveNavigation } from '../mobile-ui';
import { CardInformationProvider, useCardInformation } from '../card-information';
import { catalogCardVisible } from '../../engine/card-relations.mjs';
import { BackgroundSettings } from '../background-settings';
import { KeywordReference } from '../keyword-reference';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Minus, Save, Download, Upload, Copy, ArrowLeft, Search, Shield, Trash2 } from 'lucide-react';
import { MagicDomainIcons } from '../magic-domain-icons';
import { Rich } from '../rich-text';
import { parseCardSearch, matchesCardSearch, mainTypesForSearch } from '../../engine/card-search.mjs';
import { CardSearchHelp } from '../card-search-help';
import { DeckCodeDialog } from '../deck-code-dialog';
import { notifyDeckListChanged, watchDeckList } from '../deck-list-sync';
import { AccountControls, SignInLink, useAccount } from '../account-controls';
import { validateDeck, isShoggothCoreCandidate, isMainCard, isInitialSociety, cardAllowed, copyLimit, deckName, factionColor } from '../../engine/deck-rules.mjs';
const mainTypeOrder = ['角色', '角色/附属', '事务', '附属', '任务/地区'];
function deckMainType(card: any) {
    const types = mainTypesForSearch(card ?? {});
    if (types.includes('character'))
        return types.includes('attachment') ? '角色/附属' : '角色';
    if (types.includes('spell'))
        return '事务';
    if (types.includes('attachment'))
        return '附属';
    if (types.includes('task') || types.includes('district'))
        return '任务/地区';
    return card?.type ?? '其他';
}
const blank = () => ({ name: '新卡组', societyId: 'MSJC09', cards: [] as {
        cardId: string;
        count: number;
    }[], choices: { color: '黄', anchorNames: [] as string[], coreId: '' } });
export default function DeckBuilder() {
    const [mobileView, setMobileView] = useState('catalog'), [pool, setPool] = useState<any>(null), [saved, setSaved] = useState<any[]>([]), [deck, setDeck] = useState<any>(blank), [record, setRecord] = useState<any>(null), [query, setQuery] = useState(''), [deckSort, setDeckSort] = useState('name'), [color, setColor] = useState(''), [type, setType] = useState(''), [onlyAllowed, setOnlyAllowed] = useState(true), [onlyAuto, setOnlyAuto] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [page, setPage] = useState(0), [codeDialog, setCodeDialog] = useState(false), [deleteTarget, setDeleteTarget] = useState<any>(null), [deleteError, setDeleteError] = useState('');
    const deleteDialog = useRef<HTMLDialogElement>(null), savedRequest = useRef(0);
    const upload = useRef<HTMLInputElement>(null), authNavigating = useRef(false), accountState = useAccount();
    const draftKey = typeof window !== 'undefined' && (window as any).__HIDDEN_WORLD_OFFLINE__ ? 'hw-offline-deck-draft' : 'hw-deck-login-draft';
    const offline = typeof window !== 'undefined' && (window as any).__HIDDEN_WORLD_OFFLINE__ === true;
    function preserveLoginDraft() {
        try {
            if (dirty) {
                sessionStorage.setItem(draftKey, JSON.stringify(deck));
            }
            authNavigating.current = true;
        }
        catch { }
    }
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(draftKey);
            if (raw) {
                sessionStorage.removeItem(draftKey);
                const draft = JSON.parse(raw);
                if (draft && Array.isArray(draft.cards) && typeof draft.societyId === 'string') {
                    setRecord(null);
                    setDeck(draft);
                    setDirty(true);
                    setMessage('已恢复卡组草稿。');
                }
            }
        }
        catch { }
    }, []);
    async function loadSaved() {
        const request = ++savedRequest.current, r = await fetch('/api/decks', { cache: 'no-store' }), d = await r.json() as any;
        if (r.status === 401) {
            if (request === savedRequest.current)
                setSaved([]);
            return [];
        }
        if (!r.ok)
            throw Error(d.error);
        if (request === savedRequest.current)
            setSaved(d.decks);
        return d.decks;
    }
    useEffect(() => {
        let active = true;
        fetch('/api/cards?scope=play', { cache: 'no-store' }).then(async (r) => {
            const d = await r.json() as any;
            if (!r.ok)
                throw Error(d.error);
            if (active)
                setPool(d);
        }).catch(e => setError(e.message));
        loadSaved().catch(e => setError(e.message));
        return () => { active = false; };
    }, []);
    useEffect(() => {
        if (!dirty)
            return;
        const warn = (e: BeforeUnloadEvent) => {
            if (authNavigating.current)
                return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);
    useEffect(() => watchDeckList(() => {
        fetch('/api/cards?scope=play', { cache: 'no-store' }).then(async (r) => {
            if (r.ok)
                setPool(await r.json());
        }).catch(() => { });
        loadSaved().catch(() => { });
    }), []);
    useEffect(() => {
        let active = true;
        const refresh = () => {
            if (document.visibilityState !== 'visible')
                return;
            fetch('/api/cards?scope=play', { cache: 'no-store' }).then(async (r) => {
                if (r.ok) {
                    const next = await r.json();
                    if (active)
                        setPool(next);
                }
            }).catch(() => { });
        }, timer = setInterval(refresh, 15000);
        window.addEventListener('focus', refresh);
        return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
    }, []);
    useEffect(() => {
        if (deleteTarget && !deleteDialog.current?.open)
            deleteDialog.current?.showModal();
    }, [deleteTarget]);
    const allCards = pool?.cards ?? [], cards = allCards.filter(catalogCardVisible), societies = cards.filter(isInitialSociety), society = cards.find((c: any) => c.id === deck.societyId), implemented = useMemo(() => new Set<string>((pool?.cards ?? []).filter((c: any) => c.audit.implemented).map((c: any) => c.id)), [pool]);
    const validation = useMemo(() => pool ? (() => {
        const v = validateDeck({ ...deck, name: deck.name.trim() ? deck.name : '未命名草稿' }, cards, implemented);
        if (!deck.name.trim()) {
            v.errors.push({ code: 'name', message: '请填写卡组名称' });
            v.constructionLegal = false;
            v.playable = false;
        }
        return v;
    })() : null, [pool, deck, implemented]), counts = new Map<string, number>(deck.cards.map((r: any) => [r.cardId, r.count]));
    const search = useMemo(() => parseCardSearch(query), [query]), visible = cards.filter((c: any) => isMainCard(c) && matchesCardSearch(c, search) && (!color || factionColor(c) === color) && (!type || mainTypesForSearch(c).includes(mainTypesForSearch({ type })[0]) && (type.indexOf('/') < 0 || mainTypesForSearch({ type }).every(t => mainTypesForSearch(c).includes(t)))) && (!onlyAllowed || cardAllowed(c, society, deck.choices)) && (!onlyAuto || implemented.has(c.id)));
    useEffect(() => setPage(0), [query, color, type, onlyAllowed, onlyAuto, deck.societyId, deck.choices.color]);
    const pageCount = Math.max(1, Math.ceil(visible.length / 24)), pageIndex = Math.min(page, pageCount - 1), paged = visible.slice(pageIndex * 24, (pageIndex + 1) * 24);
    const rows = deck.cards.map((r: any) => ({ ...r, card: cards.find((c: any) => c.id === r.cardId) })).sort((a: any, b: any) => { const typeDifference = deckSort === 'type' ? (mainTypeOrder.indexOf(deckMainType(a.card)) < 0 ? 99 : mainTypeOrder.indexOf(deckMainType(a.card))) - (mainTypeOrder.indexOf(deckMainType(b.card)) < 0 ? 99 : mainTypeOrder.indexOf(deckMainType(b.card))) : 0; return typeDifference || (a.card?.name ?? a.cardId).localeCompare(b.card?.name ?? b.cardId, 'zh-CN') || a.cardId.localeCompare(b.cardId); });
    function edit(next: any) { setDeck(next); setDirty(true); setMessage(''); setError(''); }
    function changeCount(cardId: string, count: number) {
        if (!Number.isSafeInteger(count) || count < 0 || count > 10000)
            return;
        edit({ ...deck, cards: count ? deck.cards.some((r: any) => r.cardId === cardId) ? deck.cards.map((r: any) => r.cardId === cardId ? { ...r, count } : r) : [...deck.cards, { cardId, count }] : deck.cards.filter((r: any) => r.cardId !== cardId) });
    }
    async function save(copy = false) {
        setBusy(true);
        setError('');
        try {
            const id = copy ? null : record?.id, res = await fetch(id ? `/api/decks/${id}` : '/api/decks', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...deck, ...(id ? { revision: record.revision } : {}) }) }), data = await res.json() as any;
            if (!res.ok)
                throw Error(data.error);
            setRecord(data.deck);
            setDeck({ ...deck, name: data.deck.name });
            setDirty(false);
            setMessage(data.deck.validation.playable ? '已保存，可用于构筑测试' : '已保存草稿；请查看构筑校验');
            notifyDeckListChanged();
            await loadSaved();
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    async function open(id: string) {
        if (dirty && !confirm('当前修改尚未保存，是否离开当前草稿？'))
            return;
        setBusy(true);
        try {
            const r = await fetch(`/api/decks/${id}`, { cache: 'no-store' }), d = await r.json() as any;
            if (!r.ok)
                throw Error(d.error);
            setRecord(d.deck);
            setDeck({ name: d.deck.name, societyId: d.deck.societyId, cards: d.deck.cards, choices: d.deck.choices });
            setDirty(false);
            setMessage('已载入保存卡组');
            setError('');
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    function requestDelete() {
        if (!record || busy)
            return;
        setDeleteError('');
        setDeleteTarget({ ...record, discardChanges: dirty });
    }
    function closeDelete() {
        if (busy)
            return;
        deleteDialog.current?.close();
        setDeleteTarget(null);
        setDeleteError('');
    }
    async function deleteDeck() {
        if (!deleteTarget || busy)
            return;
        const target = deleteTarget;
        setBusy(true);
        setDeleteError('');
        try {
            const response = await fetch(`/api/decks/${target.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: target.revision }) }), data = await response.json() as any;
            if (!response.ok)
                throw Error(data.error);
            ++savedRequest.current;
            setSaved(current => current.filter(d => d.id !== target.id));
            setRecord(null);
            setDeck(blank());
            setDirty(false);
            setError('');
            setMessage(`已删除卡组「${target.name}」`);
            deleteDialog.current?.close();
            setDeleteTarget(null);
            notifyDeckListChanged();
        }
        catch (e) {
            setDeleteError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    function fresh() {
        if (dirty && !confirm('当前修改尚未保存，是否新建卡组？'))
            return;
        setRecord(null);
        setDeck(blank());
        setDirty(false);
        setMessage('');
        setError('');
    }
    function exportDeck() { const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 1, ...deck }, null, 2)], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = deck.name + '.deck.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    async function importDeck(file: File) {
        try {
            if (file.size > 100000)
                throw Error('卡组文件不得超过100KB');
            const data = JSON.parse(await file.text());
            const checked = validateDeck(data, cards, implemented);
            if (dirty && !confirm('当前修改尚未保存，是否导入替换当前草稿？'))
                return;
            setRecord(null);
            edit(checked.deck);
            setMessage('已导入为新草稿；可复制卡组代码，在大厅直接导入对战');
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            if (upload.current)
                upload.current.value = '';
        }
    }
    const progress = validation ? Math.min(100, validation.total / validation.min * 100) : 0;
    return <CardInformationProvider cards={allCards} catalogCards={allCards}><div className='deck-page'><header className='topbar site-header'><a className='brand' href='/'><span className='brand-mark'>隐</span><div><strong>隐秘世界</strong><small>UNDERWORLD · ARENA</small></div></a><ResponsiveNavigation><a href='/'>对战大厅</a><a href='/cards'>卡牌池</a><span className='version-tag'>组卡</span><BackgroundSettings /><KeywordReference /><AccountControls returnTo='/decks' beforeNavigate={preserveLoginDraft} state={accountState}/></ResponsiveNavigation></header><main className='deck-workspace'><div className='deck-title'><div><span className='eyebrow'>DECK WORKSHOP</span><h1>选择秘社，构筑你的卡组</h1><p>同名默认最多3张 · 主牌至少50张 · 特殊卡文与秘社限制自动校验</p></div><a className='secondary' href='/'><ArrowLeft size={16}/>返回大厅</a></div>{error && <p role='alert' className='error'>{error}{error.includes('登录') && <SignInLink returnTo='/decks' beforeNavigate={preserveLoginDraft}>登录后保存卡组</SignInLink>}</p>}{message && <p role='status' className='deck-message'>{message}</p>}
 {!accountState.loading && !accountState.account && <div className='deck-login-note'><p>无需登录即可组卡、复制卡组代码并导入对战；登录后可保存到账号。</p><SignInLink returnTo='/decks' beforeNavigate={preserveLoginDraft}>登录后保存卡组</SignInLink></div>}<div className='deck-toolbar'><select aria-label='已保存卡组' value={record?.id ?? ''} onChange={e => e.target.value && open(e.target.value)} disabled={busy}><option value=''>新建草稿</option>{saved.map(d => <option key={d.id} value={d.id}>{d.name} · {d.validation.total}张 · {d.validation.playable ? '可测试' : '草稿'}</option>)}</select><button className='secondary' onClick={fresh} disabled={busy}><Plus size={16}/>新建</button><button className='primary' onClick={() => save()} disabled={busy || !pool || accountState.loading || !accountState.account}><Save size={16}/>{busy ? '处理中…' : '保存卡组'}{dirty ? ' *' : ''}</button>{record && <button className='secondary' onClick={() => save(true)} disabled={busy}><Copy size={16}/>另存副本</button>}<button className='secondary' onClick={() => setCodeDialog(true)} disabled={busy || !pool}><Copy size={16}/>卡组代码</button><button className='secondary' onClick={exportDeck}><Download size={16}/>导出</button><button className='secondary' onClick={() => upload.current?.click()} disabled={!pool}><Upload size={16}/>导入</button>{record && <button className='secondary deck-delete-button' onClick={requestDelete} disabled={busy}><Trash2 size={16}/>删除卡组</button>}<input ref={upload} type='file' accept='.json,application/json' hidden aria-label='导入卡组文件' onChange={e => e.target.files?.[0] && importDeck(e.target.files[0])}/></div>
 {codeDialog && <DeckCodeDialog deck={deck} onClose={() => setCodeDialog(false)} onImport={input => {
                const checked = validateDeck(input, cards, implemented);
                if (dirty && !confirm('当前修改尚未保存，是否导入替换当前草稿？'))
                    return false;
                setRecord(null);
                edit(checked.deck);
                setMessage('已导入为新草稿；可复制卡组代码，在大厅直接导入对战');
                return true;
            }}/>}
 <dialog ref={deleteDialog} className='deck-delete-dialog' aria-labelledby='deck-delete-title' aria-describedby='deck-delete-description' onCancel={e => { e.preventDefault(); closeDelete(); }}><h2 id='deck-delete-title'>删除卡组</h2><p className='deck-delete-name'>「{deleteTarget?.name}」</p><p id='deck-delete-description'>删除后无法恢复。已开始的对局及对局记录会保留。</p>{deleteTarget?.discardChanges && <p>当前未保存的修改也会清除。</p>}{deleteError && <p className='error' role='alert'>{deleteError}</p>}<div className='deck-delete-actions'><button className='secondary' autoFocus onClick={closeDelete} disabled={busy}>取消</button><button className='primary deck-delete-confirm' onClick={deleteDeck} disabled={busy}>{busy ? '删除中…' : '确认删除'}</button></div></dialog>
 <nav className='mobile-deck-tabs' aria-label='组卡视图'><button aria-pressed={mobileView === 'catalog'} onClick={() => setMobileView('catalog')}>添加卡牌</button><button aria-pressed={mobileView === 'deck'} onClick={() => setMobileView('deck')}>当前卡组 · {validation?.total ?? 0}张</button></nav><div className='deck-grid' data-mobile-view={mobileView}><section className='deck-catalog'><div className='deck-filter'><div className='deck-search'><Search size={18}/><input aria-label='搜索组卡卡牌' placeholder='牌名 或 搜索过滤' value={query} onChange={e => setQuery(e.target.value)}/></div><div className='deck-filter-row'><select aria-label='组卡派系筛选' value={color} onChange={e => setColor(e.target.value)}><option value=''>全部派系</option>{['黄', '绿', '蓝', '红', '灰', '白', '黑', '紫', '中立'].map(c => <option key={c}>{c}</option>)}</select><select aria-label='组卡类型筛选' value={type} onChange={e => setType(e.target.value)}><option value=''>全部类型</option>{['角色', '附属', '事务', '角色/附属', '任务/地区'].map(t => <option key={t}>{t}</option>)}</select></div><CardSearchHelp />{search.errors.length > 0 && <p className='error' role='alert'>{search.errors.join('；')}</p>}<label><input type='checkbox' checked={onlyAllowed} onChange={e => setOnlyAllowed(e.target.checked)}/>仅显示秘社允许的牌</label>{!offline && <label><input type='checkbox' checked={onlyAuto} onChange={e => setOnlyAuto(e.target.checked)}/>仅显示已自动结算的牌</label>}<p>{pool ? `${visible.length}条候选；同名不同版本共用数量上限。` : '正在载入卡牌池…'}</p></div><div className='deck-card-list'>{paged.map((c: any) => { const n = counts.get(c.id) ?? 0, limit = copyLimit(c, society, deck.choices), same = validation?.countsByName[deckName(c)] ?? 0; return <article className='deck-card' key={c.id}><div className='deck-card-heading'><div><code>{c.id}</code><h3 className="formatted-name"><Rich name text={c.displayName ?? c.name}/>{c.unique === 1 ? ' · 独有' : ''}</h3><p>{c.typeLine} · {c.cost} · {c.faction}</p><MagicDomainIcons magic={c.magic}/></div>{!offline && <span className={`deck-status ${implemented.has(c.id) ? 'implemented' : ''}`}>{implemented.has(c.id) ? '自动结算' : '待接入'}</span>}</div><details><summary>查看能力与卡牌资料</summary><p className='rich-preview'><Rich text={c.text}/></p>{c.subtitle && <p>副名：{c.subtitle}</p>}{c.flavorText && <p className="card-flavor"><Rich text={c.flavorText}/></p>}<p>{c.iconsDefense}</p></details><div className='deck-count'><span>同名 {same} / {limit === Infinity ? '不限' : limit}</span><div><button aria-label={`减少 ${c.id}`} disabled={n === 0} onClick={() => changeCount(c.id, n - 1)}><Minus size={15}/></button><input aria-label={`数量 ${c.id}`} type='number' min={0} max={10000} value={n} onChange={e => changeCount(c.id, Number(e.target.value))}/><button aria-label={`增加 ${c.id}`} disabled={same >= limit} onClick={() => changeCount(c.id, n + 1)}><Plus size={15}/></button></div></div></article>; })}</div><div className='deck-pagination'><button className='secondary' disabled={pageIndex === 0} onClick={() => setPage(pageIndex - 1)}>上一页</button><span>第{pageIndex + 1} / {pageCount}页 · 每页24条</span><button className='secondary' disabled={pageIndex >= pageCount - 1} onClick={() => setPage(pageIndex + 1)}>下一页</button></div></section>
 <aside className='deck-summary'><section className='deck-settings'><label htmlFor='deck-name'>卡组名称</label><input id='deck-name' maxLength={80} value={deck.name} onChange={e => edit({ ...deck, name: e.target.value })}/><label htmlFor='deck-society'><Shield size={16}/>初始秘社</label><select id='deck-society' value={deck.societyId} onChange={e => edit({ ...deck, societyId: e.target.value, choices: { color: '黄', anchorNames: [], coreId: '' } })}>{societies.map((s: any) => <option value={s.id} key={s.id}>{s.name} · {s.id}</option>)}</select>{society && <><p className='society-start'>起始手牌 <b>{validation?.society?.initialHand}</b>张</p>{validation?.society?.rules.map((rule: string, i: number) => <p className='deck-rule' key={i}>{rule}</p>)}<details><summary>查看秘社全部能力</summary><p className='rich-preview'>{society.text}</p></details></>}
 {deck.societyId === 'MSBQ04' && <><label htmlFor='chosen-color'>天闻山庄的颜色派系</label><select id='chosen-color' value={deck.choices.color} onChange={e => edit({ ...deck, choices: { ...deck.choices, color: e.target.value } })}>{['黄', '绿', '蓝', '红', '灰', '白', '黑', '紫'].map(c => <option key={c}>{c}</option>)}</select></>}
 {false}
 {deck.societyId === 'MSBQ02' && <><label htmlFor='core-character'>核心角色</label><select id='core-character' value={deck.choices.coreId} onChange={e => edit({ ...deck, choices: { ...deck.choices, coreId: e.target.value } })}><option value=''>选择副名为修格斯的角色</option>{cards.filter((c: any) => isShoggothCoreCandidate(c)).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><p className='mini-help'>核心角色单独记录，不计入主牌组张数。</p></>}
 </section><section className='deck-validation'><div className='deck-total'><strong>{validation?.total ?? 0}</strong><span>主牌 / 至少{validation?.min ?? 50}张</span></div><div className='deck-progress'><span style={{ width: progress + '%' }}/></div><strong className={validation?.constructionLegal ? 'valid' : 'invalid'}>{validation?.constructionLegal ? '构筑校验通过' : '构筑尚未通过'}</strong><p>{offline ? (validation?.playable ? '卡组已就绪，可保存或复制代码开始对战。' : '可保存为草稿，完成构筑后开始对战。') : (validation?.playable ? '主牌均已自动结算，可复制卡组代码或保存后进入构筑测试。' : '可保存为草稿，修正问题后再进行构筑测试。')}</p>{!!validation?.errors.length && <ul>{validation?.errors.map((e: any, i: number) => <li key={i}>{e.message}</li>)}</ul>}{!offline && <><p className='mini-help'>已接入的秘社能力可在对局中发动；开局使用当前启用的地区牌库（全部启用时29张）。</p><details><summary>测试范围与注意事项</summary>{validation?.warnings.map((w: string, i: number) => <p key={i}>{w}</p>)}{!!validation?.pending.length && <p>待接入：{validation?.pending.map((c: any) => `${c.name}×${c.count}`).join('、')}</p>}</details></>}</section><section className='deck-selected'><h2>当前主牌 <span>{rows.length}条</span></h2><label className='deck-sort'>排序<select aria-label='已加入卡牌排序' value={deckSort} onChange={e => setDeckSort(e.target.value)}><option value='name'>按牌名</option><option value='type'>按主类型</option></select></label>{rows.length ? rows.map((r: any, i: number) => <Fragment key={r.cardId}>{deckSort === 'type' && (i === 0 || deckMainType(rows[i - 1].card) !== deckMainType(r.card)) && <h3 className='deck-type-heading'>{deckMainType(r.card)} <span>{rows.filter((item: any) => deckMainType(item.card) === deckMainType(r.card)).reduce((n: number, item: any) => n + item.count, 0)}张</span></h3>}<SelectedDeckRow cardId={r.cardId}><span>{r.card?.name ?? r.cardId}<small>{r.cardId}</small><MagicDomainIcons magic={r.card?.magic}/></span><input type='number' min={0} max={10000} aria-label={`卡组数量 ${r.cardId}`} value={r.count} onChange={e => changeCount(r.cardId, Number(e.target.value))}/><button aria-label={`移除 ${r.cardId}`} onClick={() => changeCount(r.cardId, 0)}>×</button></SelectedDeckRow></Fragment>) : <p>从左侧卡牌池添加卡牌。</p>}</section></aside></div></main></div></CardInformationProvider>;
}
function SelectedDeckRow({ cardId, children }: {
    cardId: string;
    children: React.ReactNode;
}) {
    const information = useCardInformation();
    return <div tabIndex={0} aria-haspopup='menu' data-card-id={cardId} onContextMenu={e => { e.preventDefault(); information?.open(cardId, e.currentTarget, e.clientX, e.clientY, false); }} onKeyDown={e => {
            if (e.key === 'ContextMenu' || e.shiftKey && e.key === 'F10') {
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                information?.open(cardId, e.currentTarget, r.left, r.bottom, false);
            }
        }}>{children}</div>;
}
