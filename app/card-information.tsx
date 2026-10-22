'use client';
import { enableCardLongPress } from './card-long-press';
import { relatedCardsFor } from '../engine/card-relations.mjs';
import { effectPreviewClasses, entryDestinationClass } from '../engine/effect-preview.mjs';
import { splitCardRules } from '../engine/card-text-format.mjs';
import { costAndLoyaltyForDisplay, isRegularPlayerCard } from '../engine/card-display.mjs';
import { createContext, useCallback, useContext, useEffect, useRef, useState, useId } from 'react';
import { ThemePortal } from './background-settings';
import { Info, Crosshair, X } from 'lucide-react';
import { hasCardType, cardTypeLabel } from '../engine/card-types.mjs';
import { Rich } from './rich-text';
import { hasAbilityIconCounts, canReadCardText } from '../engine/card-search.mjs';
import { CardKeywordInformation } from './keyword-reference';
import { MagicDomainIcons } from './magic-domain-icons';
import { CardMarkers } from './card-markers';
type InfoCard = {
    abilityDescription?: string;
    isAbility?: boolean;
    catalogId?: string;
    code?: string;
    originalName?: string;
    related?: string[];
    chosenMagicDomain?: string;
    hostId?: string;
    hostName?: string;
    attachedTo?: string;
    zone?: string;
    owner?: number;
    id: string;
    name: string;
    displayName?: string;
    type?: string;
    faceDown?: boolean;
    controller?: number;
    ownerName?: string;
    flavorText?: string;
    printedCost?: number;
    printedCostText?: string;
    loyalty?: Record<string, number>;
    subtitle?: string;
    text?: string;
    faq?: string;
    subtypes?: string[];
    printedSubtypes?: string[];
    magicDomains?: string[];
    faction?: string;
    defense?: number;
    icons?: Record<string, number>;
    temporaryIcons?: Record<string, number>;
    keywordStates?: any[];
    grantedAbilities?: any[];
};
type OpenInformation = (id: string, opener: HTMLElement, x: number, y: number, faceDown: boolean) => void;
type TargetSource = {
    id: string;
    name: string;
    controllerName: string;
    status: string;
    position?: number;
};
type EffectPreview = {
    owner: string;
    sourceId?: string;
    targetIds: string[];
    costIds?: string[];
};
type InformationActions = {
    relatedFor: (id: string) => InfoCard[];
    showRelated: (id: string, opener: HTMLElement) => void;
    effectClasses: (id: string) => string;
    activatePreview: (preview: EffectPreview, onlyIfEmpty?: boolean) => void;
    updatePreview: (preview: EffectPreview) => void;
    clearPreview: (owner: string) => void;
    open: OpenInformation;
    showFront: (id: string, element: HTMLElement) => void;
    hideFront: () => void;
    previewId?: string;
    targetCount: (id: string) => number;
};
const InformationContext = createContext<InformationActions | null>(null);
export function useCardInformation() { return useContext(InformationContext); }
export function CardContextSurface({ cardId, children, inline = false }: {
    cardId: string;
    children: React.ReactNode;
    inline?: boolean;
}) {
    const information = useCardInformation(), Tag = inline ? 'span' : 'div';
    const count = information?.targetCount(cardId) ?? 0;
    return <Tag tabIndex={0} aria-haspopup='menu' className={`card-context-surface ${inline ? 'inline-surface' : ''} ${count ? 'current-effect-target' : ''} ${information?.effectClasses(cardId) ?? ''}`} data-card-id={cardId} data-target-count={count || undefined} style={{ display: inline ? 'inline-block' : 'contents' }} onContextMenu={e => { e.preventDefault(); e.stopPropagation(); information?.open(cardId, e.currentTarget, e.clientX, e.clientY, false); }} onKeyDown={e => {
            if (e.key === 'ContextMenu' || e.shiftKey && e.key === 'F10') {
                e.preventDefault();
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                information?.open(cardId, e.currentTarget, r.left, r.bottom, false);
            }
        }}>{children}</Tag>;
}
function canInspect(card?: InfoCard) { return !!card; }
export function CardInformationProvider({ cards, viewer, currentTargets = {}, entryDestinations = {}, targetAliases = {}, catalogCards, children }: {
    cards: InfoCard[];
    catalogCards?: InfoCard[];
    viewer?: number;
    currentTargets?: Record<string, TargetSource[]>;
    entryDestinations?: Record<string, {
        entryId: string;
        cardId: string;
        name: string;
        kind: string;
    }[]>;
    targetAliases?: Record<string, string>;
    children: React.ReactNode;
}) {
    useEffect(() => enableCardLongPress(), []);
    const [menu, setMenu] = useState<{
        id: string;
        x: number;
        y: number;
    } | null>(null), [infoId, setInfoId] = useState<string | null>(null), [infoMode, setInfoMode] = useState<'info' | 'faq' | 'seals' | 'targets' | 'related' | 'ability'>('info'), [front, setFront] = useState<{
        id: string;
        x: number;
        y: number;
    } | null>(null);
    const [loadedCatalog, setLoadedCatalog] = useState<InfoCard[]>([]);
    const relationCatalog = catalogCards ?? loadedCatalog;
    const relatedFor = (id: string) => { const card = cards.find(c => c.id === id); return card && canReadCardText(card, viewer) ? relatedCardsFor(card, relationCatalog) : []; };
    useEffect(() => {
        if (catalogCards || loadedCatalog.length || !menu)
            return;
        let cancelled = false;
        fetch('/api/cards?scope=play').then(r => r.ok ? r.json() : null).then((d: any) => {
            if (!cancelled && d?.cards)
                setLoadedCatalog(d.cards);
        }).catch(() => { });
        return () => { cancelled = true; };
    }, [catalogCards, loadedCatalog.length, !!menu]);
    const [effectPreview, setEffectPreview] = useState<EffectPreview | null>(null);
    const activatePreview = useCallback((next: EffectPreview, onlyIfEmpty = false) => setEffectPreview(prev => onlyIfEmpty && prev ? prev : JSON.stringify(prev) === JSON.stringify(next) ? prev : next), []);
    const updatePreview = useCallback((next: EffectPreview) => setEffectPreview(prev => prev?.owner === next.owner && JSON.stringify(prev) !== JSON.stringify(next) ? next : prev), []);
    const clearPreview = useCallback((owner: string) => setEffectPreview(prev => prev?.owner === owner ? null : prev), []);
    const effectClasses = (id: string) => [effectPreviewClasses(id, effectPreview, targetAliases), entryDestinationClass(id, entryDestinations, targetAliases)].filter(Boolean).join(' ');
    const targetCount = (id: string) => currentTargets[id]?.length ?? 0, infoTargets = infoId ? currentTargets[infoId] ?? [] : [];
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const menuFaceDown = useRef(false), infoFaceDown = useRef(false), opener = useRef<HTMLElement | null>(null), menuElement = useRef<HTMLDivElement>(null), infoButton = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLElement>(null), closeButton = useRef<HTMLButtonElement>(null);
    const menuCard = cards.find(c => c.id === menu?.id), infoCard = cards.find(c => c.id === infoId), frontCard = cards.find(c => c.id === front?.id);
    const sealsFor = (card?: InfoCard) => card ? cards.filter(c => c.zone === 'sealed' && (c.hostId === card.id || c.hostId === `district-host:${card.id}`)) : [];
    const menuSeals = sealsFor(menuCard), infoSeals = sealsFor(infoCard), fieldMenu = !!menuCard && ['play', 'asset', 'society', 'district'].includes(menuCard.zone ?? '');
    const hostFor = (card?: InfoCard) => card?.zone === 'play' && hasCardType(card, 'attachment') && card.attachedTo ? cards.find(c => ['play', 'asset', 'society', 'district'].includes(c.zone ?? '') && (c.id === card.attachedTo || `district-host:${c.id}` === card.attachedTo)) : undefined;
    const menuHost = hostFor(menuCard), infoHost = hostFor(infoCard);
    const hostLabel = (host: InfoCard) => host.faceDown && host.zone !== 'sealed' ? '暗藏者' : host.displayName ?? host.name;
    const showHost = (host: InfoCard) => { infoFaceDown.current = !!host.faceDown; setMenu(null); setInfoMode('info'); setInfoId(host.id); };
    useEffect(() => {
        if (!menu || !menuElement.current)
            return;
        const y = Math.max(8, Math.min(menu.y, window.innerHeight - menuElement.current.getBoundingClientRect().height - 8));
        if (y !== menu.y)
            setMenu(prev => prev?.id === menu.id ? { ...prev, y } : prev);
    }, [menu, menuHost, relationCatalog.length]);
    const canSeeFront = !!frontCard?.faceDown && typeof viewer === 'number' && frontCard.controller === viewer;
    const cancelHoverTimer = useCallback(() => {
        if (hoverTimer.current !== null) {
            clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
        }
    }, []);
    const hideFront = useCallback(() => { cancelHoverTimer(); hoverTimer.current = setTimeout(() => setFront(null), 120); }, [cancelHoverTimer]);
    const showFront = useCallback((id: string, element: HTMLElement) => {
        cancelHoverTimer();
        const card = cards.find(c => c.id === id);
        if (menu || infoId || !card?.faceDown || typeof viewer !== 'number' || card.controller !== viewer) {
            setFront(null);
            return;
        }
        const r = element.getBoundingClientRect(), width = Math.min(320, window.innerWidth - 24), x = r.right + width + 24 <= window.innerWidth ? r.right + 12 : r.left - width - 12;
        setFront({ id, x: Math.max(12, Math.min(x, window.innerWidth - width - 12)), y: Math.max(12, Math.min(r.top, window.innerHeight - 260)) });
    }, [cards, viewer, menu, infoId, cancelHoverTimer]);
    useEffect(() => () => cancelHoverTimer(), [cancelHoverTimer]);
    useEffect(() => {
        if (front && !canSeeFront)
            setFront(null);
    }, [front, canSeeFront]);
    const restoreFocus = useCallback(() => {
        if (opener.current?.isConnected)
            opener.current.focus({ preventScroll: true });
    }, []);
    const open = useCallback<OpenInformation>((id, element, x, y, faceDown) => { cancelHoverTimer(); setFront(null); menuFaceDown.current = faceDown; opener.current = element; setInfoId(null); setMenu({ id, x: Math.max(8, Math.min(x, window.innerWidth - 230)), y: Math.max(8, Math.min(y, window.innerHeight - 220)) }); }, [cancelHoverTimer]);
    const showRelated = (id: string, element: HTMLElement) => {
        const card = cards.find(c => c.id === id);
        if (!card || !relatedFor(id).length)
            return;
        opener.current = element;
        infoFaceDown.current = !!card.faceDown;
        setMenu(null);
        setInfoMode('related');
        setInfoId(id);
    };
    const closeInfo = useCallback(() => { setInfoId(null); restoreFocus(); }, [restoreFocus]);
    useEffect(() => {
        if (menu && (!canInspect(menuCard) || !!menuCard?.faceDown !== menuFaceDown.current)) {
            setMenu(null);
            restoreFocus();
        }
        if (infoId && (!canInspect(infoCard) || !!infoCard?.faceDown !== infoFaceDown.current)) {
            setInfoId(null);
            restoreFocus();
        }
    }, [menu, menuCard, infoId, infoCard, restoreFocus]);
    useEffect(() => {
        if (!menu)
            return;
        infoButton.current?.focus({ preventScroll: true });
        const dismiss = (e: PointerEvent) => {
            if (!menuElement.current?.contains(e.target as Node))
                setMenu(null);
        };
        const key = (e: KeyboardEvent) => {
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                e.preventDefault();
                const items = Array.from(menuElement.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not(:disabled)') ?? []), i = items.indexOf(document.activeElement as HTMLElement), n = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                items[n]?.focus();
            }
            if (e.key === 'Escape' || e.key === 'Tab') {
                if (e.key === 'Escape')
                    e.preventDefault();
                setMenu(null);
                restoreFocus();
            }
        };
        const reposition = () => setMenu(null);
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', key);
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', key); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); };
    }, [menu, restoreFocus]);
    useEffect(() => {
        if (!infoId)
            return;
        closeButton.current?.focus({ preventScroll: true });
        const key = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeInfo();
            }
            if (e.key === 'Tab' && dialog.current) {
                const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('button,a[href],[tabindex="0"]'));
                const first = focusable[0], last = focusable.at(-1);
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
                else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener('keydown', key);
        return () => document.removeEventListener('keydown', key);
    }, [infoId, closeInfo]);
    return <InformationContext.Provider value={{ relatedFor, showRelated, effectClasses, activatePreview, updatePreview, clearPreview, open, showFront, hideFront, targetCount, previewId: canSeeFront ? front?.id : undefined }}>{children}
  {front && frontCard && canSeeFront && <ThemePortal><div id='card-front-information' role='tooltip' aria-label='暗藏者的正面信息' className='card-front-preview' style={{ left: front.x, top: front.y, maxHeight: `calc(100dvh - ${front.y + 12}px)` }} onMouseEnter={cancelHoverTimer} onMouseLeave={hideFront}><span className='eyebrow'>暗藏者 · 正面资料</span><div className='card-front-heading'><strong className='formatted-name'><Rich name text={frontCard.displayName ?? frontCard.name}/></strong><span className='cost'>{costAndLoyaltyForDisplay(frontCard)}</span></div><p className='card-front-type'>{cardTypeLabel(frontCard)}{(frontCard.printedSubtypes ?? frontCard.subtypes)?.length ? ` · ${(frontCard.printedSubtypes ?? frontCard.subtypes)!.join('／')}` : ''}</p>{frontCard.subtitle && <p className='card-subtitle'>{frontCard.subtitle}</p>}{frontCard.faction && <p>{frontCard.faction}</p>}<MagicDomainIcons domains={frontCard.magicDomains}/>{hasAbilityIconCounts(frontCard) && frontCard.icons && <p>黑图标：调查 {frontCard.icons.investigation ?? 0} · 战斗 {frontCard.icons.battle ?? 0} · 势力 {frontCard.icons.influence ?? 0}</p>}{hasAbilityIconCounts(frontCard) && frontCard.temporaryIcons && Object.values(frontCard.temporaryIcons).some(n => n > 0) && <p>白图标：调查 {frontCard.temporaryIcons.investigation ?? 0} · 战斗 {frontCard.temporaryIcons.battle ?? 0} · 势力 {frontCard.temporaryIcons.influence ?? 0}</p>}{frontCard.defense !== undefined && <p>印刷防御力：{frontCard.defense}</p>}{frontCard.text && <p className='rich-preview card-front-rules'><Rich text={splitCardRules(frontCard.text).text}/></p>}</div></ThemePortal>}
  {menu && canInspect(menuCard) && <ThemePortal><div className='card-context-menu' ref={menuElement} role='menu' aria-label='卡牌右键菜单' style={{ left: menu.x, top: menu.y }}>{menuHost && <button role='menuitem' className='card-context-host' onClick={() => showHost(menuHost)}><Info size={16}/><span>结附于：<Rich name text={hostLabel(menuHost)}/></span></button>}{menuCard?.isAbility && <button role='menuitem' onClick={() => { infoFaceDown.current = !!menuCard?.faceDown; setMenu(null); setInfoMode('ability'); setInfoId(menu.id); }}><Info size={16}/>显示能力描述</button>}<button ref={infoButton} role='menuitem' onClick={() => { infoFaceDown.current = !!menuCard?.faceDown; setMenu(null); setInfoMode('info'); setInfoId(menu.id); }}><Info size={16}/>显示信息</button>{!menuCard?.isAbility && canReadCardText(menuCard, viewer) && <button role='menuitem' onClick={() => { infoFaceDown.current = !!menuCard?.faceDown; setMenu(null); setInfoMode('faq'); setInfoId(menu.id); }}><Info size={16}/>显示FAQ</button>}{relatedFor(menu.id).length > 0 && <button role='menuitem' onClick={() => showRelated(menu.id, opener.current!)}><Info size={16}/>关联卡牌 · {relatedFor(menu.id).length}</button>}{fieldMenu && <button role='menuitem' disabled={!menuSeals.length} onClick={() => { infoFaceDown.current = !!menuCard?.faceDown; setMenu(null); setInfoMode('seals'); setInfoId(menu.id); }}><Info size={16}/>查看封印信息{menuSeals.length ? ` · ${menuSeals.length}` : ''}</button>}<button role='menuitem' disabled={!targetCount(menu.id)} onClick={() => { infoFaceDown.current = !!menuCard?.faceDown; setMenu(null); setInfoMode('targets'); setInfoId(menu.id); }}><Crosshair size={16}/>当前成为效果对象{targetCount(menu.id) ? ` · ${targetCount(menu.id)}` : ''}</button></div></ThemePortal>}
  {infoCard && canInspect(infoCard) && <ThemePortal><div className='modal-scrim card-information-scrim' onClick={closeInfo}><section ref={dialog} className='rules-modal card-information-modal' role='dialog' aria-modal='true' aria-labelledby='card-information-title' onClick={e => e.stopPropagation()}><button ref={closeButton} className='icon close' aria-label='关闭卡牌信息' onClick={closeInfo}><X size={20}/></button><span className='eyebrow'>{infoMode === 'ability' ? '能力描述' : infoMode === 'related' ? '关联卡牌' : infoMode === 'targets' ? '当前成为效果对象' : infoMode === 'seals' ? '封印信息' : infoMode === 'faq' ? '卡牌FAQ' : '卡牌信息'} · {infoCard.faceDown && infoCard.zone !== 'sealed' ? '暗藏者' : infoCard.faceDown && !canReadCardText(infoCard, viewer) ? '背面封印牌' : cardTypeLabel(infoCard)}</span><h2 id='card-information-title' className='formatted-name'>{infoCard.faceDown && infoCard.zone !== 'sealed' ? '暗藏者' : <Rich name text={infoCard.displayName ?? infoCard.name}/>}</h2>{infoMode === 'ability' && <div className='card-information-rules'><p className='rich-preview'><Rich text={infoCard.abilityDescription || '该能力暂无可显示的描述。'}/></p></div>}{infoMode === 'related' && <div className='related-card-list'>{relatedFor(infoCard.id).map((c: any) => <article key={c.id}><h3><Rich name text={c.displayName ?? c.name}/></h3><p className='rich-preview'><Rich text={splitCardRules(c.text).text}/></p></article>)}</div>}{infoMode === 'targets' && <div className='current-target-sources' aria-live='polite'>{infoTargets.length ? <ol>{[...infoTargets].reverse().map(a => <li key={a.id}><strong><Rich text={a.name}/></strong><span>{a.controllerName}{a.controllerName ? ' · ' : ''}{a.status === 'stack' ? `堆叠第${a.position}层` : '待入栈'}</span></li>)}</ol> : <p>当前没有卡牌或能力指定此对象。</p>}</div>}{infoMode === 'seals' && <><p>封印牌 · {infoSeals.length}张</p><div className='asset-card-grid'>{infoSeals.map(c => <CardSummary key={c.id} card={c}><p>拥有者：{c.ownerName ?? '—'}</p>{c.faceDown && <small>背面封印</small>}</CardSummary>)}</div>{!infoSeals.length && <p>暂无封印牌。</p>}</>}{infoMode === 'info' && !!infoCard.ownerName && !['hand', 'graveyard', 'headquarters'].includes(infoCard.zone ?? '') && <dl className='card-information-owner'><dt>拥有者</dt><dd>{infoCard.ownerName ?? '未记录'}</dd></dl>}{infoMode === 'info' && infoHost && <p>结附于：<button className='quiet' onClick={() => showHost(infoHost)}><Rich name text={hostLabel(infoHost)}/></button></p>}{infoMode === 'info' && infoCard.chosenMagicDomain && <p>已选魔法领域：{infoCard.chosenMagicDomain}</p>}{infoMode === 'info' && canReadCardText(infoCard, viewer) && infoCard.text && <div className='card-information-rules'><h3>能力正文</h3><p className='rich-preview'><Rich text={splitCardRules(infoCard.text).text}/></p></div>}{infoMode === 'faq' && canReadCardText(infoCard, viewer) && <div className='card-information-rules'><h3>FAQ</h3><p className='rich-preview'><Rich text={splitCardRules(infoCard.text, infoCard.faq).faq || '该卡牌暂无FAQ。'}/></p></div>}{infoMode === 'info' && canReadCardText(infoCard, viewer) && <CardKeywordInformation card={infoCard}/>} {infoMode === 'info' && canReadCardText(infoCard, viewer) && infoCard.flavorText?.trim() && <div className='card-information-flavor'><h3>风味文字</h3><p><Rich text={infoCard.flavorText}/></p></div>}</section></div></ThemePortal>}
 </InformationContext.Provider>;
}
export function CardSummary({ card, children, className = 'asset-card' }: {
    card: any;
    children?: React.ReactNode;
    className?: string;
}) {
    const information = useCardInformation();
    const open = (element: HTMLElement, x: number, y: number) => information?.open(card.id, element, x, y, !!card.faceDown), targeted = !!information?.targetCount(card.id);
    return <article className={`${className} ${targeted ? 'current-effect-target' : ''} ${information?.effectClasses(card.id) ?? ''}`} data-card-id={card.id} data-target-count={information?.targetCount(card.id) || undefined} tabIndex={0} aria-haspopup='menu' onContextMenu={e => { e.preventDefault(); e.stopPropagation(); open(e.currentTarget, e.clientX, e.clientY); }} onKeyDown={e => {
            if (e.key === 'ContextMenu' || e.shiftKey && e.key === 'F10') {
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                open(e.currentTarget, r.left, r.bottom);
            }
        }}>
 <code>{card.catalogId ?? ''}</code><h3 className='formatted-name'><Rich name text={card.displayName ?? card.name}/></h3>{card.subtitle && <p>{card.subtitle}</p>}{isRegularPlayerCard(card) && <p className='card-cost-requirement'>{costAndLoyaltyForDisplay(card)}</p>}{!card.faceDown && isRegularPlayerCard(card) && hasAbilityIconCounts(card) && <p className='card-icons'>调查 {(card.effectiveIcons ?? card.icons ?? {}).investigation ?? 0} · 战斗 {(card.effectiveIcons ?? card.icons ?? {}).battle ?? 0} · 势力 {(card.effectiveIcons ?? card.icons ?? {}).influence ?? 0}{Object.values(card.effectiveTemporaryIcons ?? card.temporaryIcons ?? {}).some((n: any) => n > 0) && <small>白图标：眼 {(card.effectiveTemporaryIcons ?? card.temporaryIcons).investigation ?? 0} · 刀 {(card.effectiveTemporaryIcons ?? card.temporaryIcons).battle ?? 0} · 星 {(card.effectiveTemporaryIcons ?? card.temporaryIcons).influence ?? 0}</small>}</p>}<MagicDomainIcons domains={card.effectiveMagicDomains ?? card.magicDomains}/><CardMarkers card={card}/>{children}
 </article>;
}
// Each selector owns its preview. Closing a window clears only that window's
// selection, so an older component cannot erase a newer selector's highlight.
export function EffectPreviewSurface({ sourceId, targetIds = [], costIds = [], children, className = '', autoActivate = false }: {
    sourceId?: string;
    targetIds?: string[];
    costIds?: string[];
    children: React.ReactNode;
    className?: string;
    autoActivate?: boolean;
}) {
    const information = useCardInformation(), owner = useId(), key = JSON.stringify({ owner, sourceId, targetIds, costIds }), payload = JSON.parse(key);
    const activate = information?.activatePreview, update = information?.updatePreview, clear = information?.clearPreview;
    useEffect(() => {
        if (autoActivate)
            activate?.(JSON.parse(key), true);
        return () => clear?.(owner);
    }, [owner, clear, activate, autoActivate]);
    useEffect(() => { update?.(JSON.parse(key)); }, [key, update]);
    return <div className={`effect-preview-surface ${className}`} onPointerEnter={() => activate?.(payload)} onPointerDownCapture={() => activate?.(payload)} onFocusCapture={() => activate?.(payload)} onChangeCapture={() => activate?.(payload)}>{children}</div>;
}
export function EffectPreviewLegend() { return <p className='effect-preview-legend'><span className='source-key'>● 能力来源</span><span className='draft-key'>● 正在选择</span><span className='cost-key'>● 费用选择</span><span className='declared-key'>┄ 已指定目标</span></p>; }
export function RelatedCardLinks({ cardId }: {
    cardId: string;
}) { const information = useCardInformation(), cards = (information?.relatedFor(cardId) ?? []).filter(c => c.id !== 'TK011'); return cards.length ? <div className='catalog-related'><span>related：</span>{cards.map(c => <button className='quiet' key={c.id} onClick={e => { e.stopPropagation(); information?.showRelated(cardId, e.currentTarget); }}><Rich name text={c.displayName ?? c.name}/></button>)}</div> : null; }
export function AbilityContextSurface({ abilityId, children }: {
    abilityId: string;
    children: React.ReactNode;
}) { return <CardContextSurface cardId={`ability:${abilityId}`}>{children}</CardContextSurface>; }
