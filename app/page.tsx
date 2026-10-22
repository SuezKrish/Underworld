'use client';
import { ResponsiveNavigation, MobileBattleDock, MobilePanelHeading, DistrictNavigation, useMobileBattlePanel } from './mobile-ui';
import { ReplayImport } from './match-replay';
import { PlayerSocietySummary } from './society-summary';
import { CharacterEntryDistrict, randomCharacterEntry } from './character-entry-district';
import { stackEntryLabel } from '../engine/stack-display.mjs';
import { OfflineLobby } from './offline-lobby';
import { BotOpeningOrder, type BotOpeningOrderValue } from './bot-opening-order';
import { OfflineSaves } from './offline-saves';
import { TriggerRound } from './trigger-round-ui';
import { BOT_ID, BOT_PROFILES, getBotProfile } from '../engine/bot-deck.mjs';
import { BackgroundSettings } from './background-settings';
import { KeywordReference } from './keyword-reference';
import { DeathCostChoice } from './death-cost-ui';
import { CardMarkers } from './card-markers';
import { hasCardType, cardTypeLabel } from '../engine/card-types.mjs';
import { adjacentDistricts } from '../engine/task-districts.mjs';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Eye, FlaskConical, Layers3, Link2, LockKeyhole, LogOut, Plus, Radio, RotateCcw, Shield, Users } from 'lucide-react';
import { TriggerOrder } from './trigger-order-ui';
import { EnvironmentPanel } from './environment-ui';
import { AbyssPanel } from './abyss-ui';
import { ZonePanel } from './zone-ui';
import { RoundOverview, RoundDecisions } from './round-ui';
import { AssetPanel } from './asset-ui';
import { PriorityWindow } from './priority-window';
import { costAndLoyaltyForDisplay, isRegularPlayerCard } from '../engine/card-display.mjs';
import { SocietyStatus, HiddenContest } from './hidden-ui';
import { CharacterRevealAction } from './death-deck-ui';
import { TargetAction, CardInspection, EffectChoice, AbilityActions, CharacterPlayAction } from './automation-ui';
import { PublicGraveyard, PublicSealedZone } from './manual-ui';
import { RoomConsole } from './room-console';
import { SealPanel } from './seal-ui';
import { KeeperChoice } from './keeper-ui';
import { DeckSelection, SeatDecks } from './deck-selection';
import { RoomRecord } from './room-record';
import { Rich } from './rich-text';
import { AccountControls } from './account-controls';
import { CorePanel } from './shoggoth-ui';
import { CardInformationProvider, useCardInformation, CardSummary, CardContextSurface, AbilityContextSurface } from './card-information';
import { hasAbilityIconCounts } from '../engine/card-search.mjs';
import { MagicDomainIcons } from './magic-domain-icons';
import { DamageReplacement } from './damage-ui';
import { RuleSacrifice } from './rule-ui';
type Credential = {
    code: string;
    token: string;
    name: string;
    status?: string;
};
type Card = {
    id: string;
    name: string;
    displayName?: string;
    printedCost: number;
    printedCostText?: string;
    loyalty?: Record<string, number>;
    text: string;
    rumor?: boolean;
    battleTrigger?: boolean;
    district?: number;
    markers?: number;
    counters?: Record<string, number>;
    faceDown?: boolean;
    recordFaceDown?: boolean;
    recordSecretPlan?: boolean;
    paidRevealBlocked?: boolean;
    printedTextBlank?: boolean;
    isReal?: boolean | null;
    hiddenNumber?: number;
    type?: string;
    keywords?: string[];
    tapped?: boolean;
    cannotMove?: boolean;
    damage?: number;
    defense?: number;
    effectiveDefense?: number;
    icons?: Record<string, number>;
    effectiveIcons?: Record<string, number>;
    subtypes?: string[];
    printedSubtypes?: string[];
    availableActions?: any[];
    leaderNow?: boolean;
    barrierNow?: boolean;
    magicDomains?: string[];
    effectiveMagicDomains?: string[];
    whiteIconsConvertedNow?: boolean;
    temporaryIcons?: Record<string, number>;
    effectiveTemporaryIcons?: Record<string, number>;
    action?: any;
    spell?: any;
    automation?: any;
    publicNow?: boolean;
    concealedOnlyNow?: boolean;
    nonAssetNow?: boolean;
    castAllowed?: boolean;
    attachment?: any;
    attachedTo?: string;
    attachedCards?: any[];
    catalogId?: string;
    ownerName?: string;
    controllerName?: string;
    controller?: number;
    flavorText?: string;
};
function GameCard({ card, selected, onClick, small = false, inPlay = false }: {
    card: Card;
    selected?: boolean;
    onClick?: () => void;
    small?: boolean;
    inPlay?: boolean;
}) {
    const hidden = !!card.faceDown, information = useCardInformation(), canInspect = !!information, whiteIcons = card.effectiveTemporaryIcons ?? card.temporaryIcons;
    return <button onClick={onClick} onMouseEnter={e => {
            if (inPlay && hidden)
                information?.showFront(card.id, e.currentTarget);
        }} onMouseLeave={() => {
            if (inPlay && hidden)
                information?.hideFront();
        }} onFocus={e => {
            if (inPlay && hidden)
                information?.showFront(card.id, e.currentTarget);
        }} onBlur={() => {
            if (inPlay && hidden)
                information?.hideFront();
        }} aria-describedby={information?.previewId === card.id ? 'card-front-information' : undefined} aria-haspopup={canInspect ? 'menu' : undefined} onContextMenu={e => {
            if (!canInspect || !information)
                return;
            e.preventDefault();
            e.stopPropagation();
            information.open(card.id, e.currentTarget, e.clientX, e.clientY, hidden);
        }} onKeyDown={e => {
            if (!canInspect || !information || !(e.key === 'ContextMenu' || e.shiftKey && e.key === 'F10'))
                return;
            e.preventDefault();
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            information.open(card.id, e.currentTarget, r.left, r.bottom, hidden);
        }} data-card-id={card.id} data-target-count={information?.targetCount(card.id) || undefined} className={`game-card ${information?.targetCount(card.id) ? 'current-effect-target' : ''} ${information?.effectClasses(card.id) ?? ''} ${selected ? 'selected' : ''} ${small ? 'small' : ''} ${hidden ? 'face-down' : ''} ${card.tapped ? 'card-tapped' : ''}`} title={inPlay && !hidden ? card.text : undefined} aria-label={hidden ? (onClick ? `自己的暗藏者：${card.name}` : `对手的暗藏者 ${card.hiddenNumber ?? ''}`) : undefined}>
  <div className="card-head"><span className="cost">{hidden ? '◆' : isRegularPlayerCard(card) ? costAndLoyaltyForDisplay(card) : ''}</span><span>{hidden ? '背面朝上' : card.catalogId ? '正式卡牌 · 测试' : '机制测试牌'}</span></div>
  <div className="card-sigil">{hidden ? <Eye size={small ? 23 : 31} strokeWidth={1}/> : <Shield size={small ? 21 : 31} strokeWidth={1}/>}<span>{card.rumor ? '传闻' : card.battleTrigger ? '触发' : cardTypeLabel(card)}</span></div>
  <strong className='formatted-name'>{hidden ? `暗藏者 ${card.hiddenNumber ?? ''}` : <Rich name text={card.displayName ?? card.name.replace('测试·', '')}/>}</strong>{!!card.attachedCards?.length && <small>结附：{card.attachedCards.map(a => a.name).join('、')}</small>}{card.recordFaceDown && <small>原为暗藏者</small>}{card.recordSecretPlan && <small>原为秘密计划</small>}<CardMarkers card={card}/>{hidden ? <><span className="marker">势力图标 1</span></> : <>{hasAbilityIconCounts(card) && <span className="card-icons" aria-label={`调查 ${(card.effectiveIcons ?? card.icons ?? {}).investigation ?? 0} · 战斗 ${(card.effectiveIcons ?? card.icons ?? {}).battle ?? 0} · 势力 ${(card.effectiveIcons ?? card.icons ?? {}).influence ?? 0}`}>眼 {(card.effectiveIcons ?? card.icons ?? {}).investigation ?? 0} · 刀 {(card.effectiveIcons ?? card.icons ?? {}).battle ?? 0} · 星 {(card.effectiveIcons ?? card.icons ?? {}).influence ?? 0}{whiteIcons && Object.values(whiteIcons).some(n => n > 0) && <small>白：眼 {whiteIcons.investigation ?? 0} · 刀 {whiteIcons.battle ?? 0} · 星 {whiteIcons.influence ?? 0}{!card.effectiveTemporaryIcons && card.whiteIconsConvertedNow ? '（已转为黑图标）' : ''}</small>}</span>}{card.printedSubtypes && card.subtypes?.join('/') !== card.printedSubtypes.join('/') && <small>当前类别：{card.subtypes?.join('／') || '无'}</small>}{card.leaderNow !== undefined && (card.leaderNow || card.keywords?.includes('领袖')) && <small>{card.leaderNow ? '当前具有领袖' : '当前已失去领袖'}</small>}{card.barrierNow && <small>当前具有屏障</small>}{typeof card.isReal === 'boolean' && <small>{card.isReal ? '实牌' : '虚牌 · 印刷文本与能力图标失效'}</small>}<MagicDomainIcons domains={card.effectiveMagicDomains ?? card.magicDomains}/>{inPlay && !small && <p><Rich text={card.text}/></p>}{card.defense !== undefined && <span className="card-health">{inPlay && <>伤害 {card.damage ?? 0} / </>}防御 {card.effectiveDefense ?? card.defense}</span>}{(card as any).bannedCost !== undefined && <small>禁令费用：{(card as any).bannedCost}</small>}{(card as any).namedCharacter && <small>通缉名称：{(card as any).namedCharacter}</small>}</>}
 </button>;
}
export default function Home() {
    const offline = typeof window !== 'undefined' && (window as any).__HIDDEN_WORLD_OFFLINE__ === true;
    const seatsKey = offline ? 'hw-offline-seats' : 'hw-seats', currentKey = offline ? 'hw-offline-current' : 'hw-current';
    const [botDifficulty, setBotDifficulty] = useState<'normal' | 'hard'>('normal');
    const [botOpeningOrder, setBotOpeningOrder] = useState<BotOpeningOrderValue>('random');
    const [botId, setBotId] = useState(BOT_ID), botProfile = getBotProfile(botId)!;
    const [consoleSize, setConsoleSize] = useState({ width: 300, height: 220 }), [assetView, setAssetView] = useState<number | null>(null), railRef = useRef<HTMLDivElement>(null);
    const [credential, setCredential] = useState<Credential | null>(null), [room, setRoom] = useState<any>(null), [name, setName] = useState(offline ? '玩家' : ''), [join, setJoin] = useState(''), [saved, setSaved] = useState<Credential[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [connected, setConnected] = useState(true), [selected, setSelected] = useState<string | null>(null), [district, setDistrict] = useState(0), [copied, setCopied] = useState(false), [mode, setMode] = useState('constructed-play'), [deckId, setDeckId] = useState(''), [deckCode, setDeckCode] = useState(''), [manualWithoutConsent, setManualWithoutConsent] = useState(false), [botManualWithoutConsent, setBotManualWithoutConsent] = useState(true), [societyId, setSocietyId] = useState('MSJC09'), [availableSocieties, setAvailableSocieties] = useState<any[]>([]), [availableCores, setAvailableCores] = useState<any[]>([]), [coreId, setCoreId] = useState('BQ043');
    useEffect(() => { railRef.current?.scrollTo({ top: 0 }); }, [room?.triggerRound?.id, room?.triggerRound?.controller, room?.effectChoice?.id, room?.triggerOrderChoice?.id, room?.deathCostChoice?.id, room?.environmentChoice?.id, room?.ruleChoice?.id, room?.roundChoice?.id, room?.keeperChoice?.id, room?.damageChoice?.id, room?.hidden?.id, room?.triggerChoices?.map((a: any) => a.id).join(',')]);
    useEffect(() => {
        const refresh = () => {
            fetch('/api/cards?scope=play', { cache: 'no-store' }).then(async (r) => {
                if (!r.ok)
                    return;
                const d = await r.json() as any;
                setAvailableCores(d.cards.filter((c: any) => c.subtitle === '修格斯' && c.type === '角色' && c.audit?.implemented));
                setAvailableSocieties(d.cards.filter((c: any) => c.type === '秘社' && !c.id.startsWith('ZH') && !c.text.includes('不能作为初始秘社牌') && /初始手牌[：:]\s*\d+/.test(c.text.replace(/\*\*/g, ''))));
            }).catch(() => { });
        };
        refresh();
        const timer = setInterval(refresh, 15000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => {
        if (availableSocieties.length && !availableSocieties.some(s => s.id === societyId))
            setSocietyId(availableSocieties[0].id);
    }, [availableSocieties, societyId]);
    const roomRef = useRef<any>(null), credRef = useRef<Credential | null>(null), mounted = useRef(true), logRef = useRef<HTMLDivElement>(null);
    function applyRoom(r: any) {
        if (credRef.current && r.code !== credRef.current.code)
            return;
        if (!roomRef.current || r.code !== roomRef.current.code || r.revision >= roomRef.current.revision) {
            roomRef.current = r;
            setRoom(r);
        }
    }
    useEffect(() => {
        mounted.current = true;
        const query = new URLSearchParams(location.search).get('join');
        if (query)
            setJoin(query.toUpperCase());
        try {
            setSaved(JSON.parse(localStorage.getItem(seatsKey) || '[]'));
            const seat = JSON.parse(sessionStorage.getItem(currentKey) || 'null');
            if (seat && !query) {
                setCredential(seat);
                credRef.current = seat;
            }
        }
        catch { }
        return () => { mounted.current = false; };
    }, []);
    useEffect(() => {
        if (!credential)
            return;
        let active = true, controller: AbortController | null = null;
        async function sync() {
            controller = new AbortController();
            try {
                const res = await fetch(`/api/rooms/${credential!.code}`, { headers: { Authorization: `Bearer ${credential!.token}` }, signal: controller.signal, cache: 'no-store' });
                const data = await res.json() as any;
                if (!active)
                    return;
                if (!res.ok) {
                    if (res.status === 404) {
                        forget(credential!.code);
                        leave();
                        setError('房间或对局记录已删除');
                        return;
                    }
                    setConnected(false);
                    setError(data.error);
                    return;
                }
                setConnected(true);
                applyRoom(data.room);
                if (data.room.bot?.pending) {
                    const botResponse = await fetch(`/api/rooms/${credential!.code}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential!.token}` }, body: JSON.stringify({ type: 'bot-tick', id: crypto.randomUUID(), revision: data.room.revision }), signal: controller.signal });
                    if (botResponse.ok) {
                        const updated = await botResponse.json() as any;
                        if (active)
                            applyRoom(updated.room);
                    }
                }
            }
            catch (e) {
                if (active && (e as Error).name !== 'AbortError')
                    setConnected(false);
            }
        }
        sync();
        const id = setInterval(sync, 1800);
        return () => { active = false; controller?.abort(); clearInterval(id); };
    }, [credential]);
    useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [room?.logs?.length]);
    const { panel: mobilePanel, setPanel: setMobilePanel, needsChoice } = useMobileBattlePanel(room, selected), districtsRef = useRef<HTMLDivElement>(null);
    const mine = room?.players?.[room.seat], other = room?.players?.[1 - room?.seat], card = mine?.hand.find((c: Card) => c.id === selected), hiddenCard = mine?.play.find((c: Card) => c.id === selected && c.faceDown), fieldCard = mine?.play.find((c: Card) => c.id === selected && !c.faceDown), myPriority = room?.flow.priority === room?.seat, locked = !!room?.manualRequest || room?.flow.locked || !!room?.ruleChoice || !!room?.damageChoice || !!room?.pendingChoiceCount || !!room?.effectChoice || !!room?.hidden || !!room?.battle || room?.status !== 'playing', standard = !!room && (!room.turn || room.turn.standardAllowed) && myPriority && room.flow.stepOwner === room.seat && !locked && !room.flow.stack.length && !room.pendingChoiceCount, available = (mine?.costPool ?? 0) + (mine?.assets.filter((a: any) => !a.tapped).length ?? 0);
    function remember(c: Credential, r: any) { setCredential(c); credRef.current = c; roomRef.current = null; applyRoom(r); sessionStorage.setItem(currentKey, JSON.stringify(c)); const all = [{ ...c, status: r.status }, ...saved.filter(x => x.token !== c.token)]; localStorage.setItem(seatsKey, JSON.stringify(all)); setSaved(all); history.replaceState(null, '', location.pathname); setError(''); }
    async function enter(kind: 'create' | 'join' | 'bot') {
        if (!name.trim()) {
            setError('先填写你的昵称');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const code = join.replace(/\s/g, '').toUpperCase();
            if (kind === 'join' && !/^[A-Z2-9]{8}$/.test(code))
                throw Error('邀请码为8位字母或数字');
            const res = await fetch(kind !== 'join' ? '/api/rooms' : `/api/rooms/${code}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, triggerTiming:readTriggerTimingPreference(), type: 'join', opponentBot: kind === 'bot' ? botId : undefined, botDifficulty: kind === 'bot' ? botDifficulty : undefined, botOpeningOrder: kind === 'bot' ? botOpeningOrder : undefined, mode: kind === 'bot' ? 'constructed-play' : mode, societyId, coreId, manualWithoutConsent: kind === 'bot' ? botManualWithoutConsent : manualWithoutConsent, deckId: mode === 'round-play' && kind !== 'bot' ? undefined : deckId, deckCode: mode === 'round-play' && kind !== 'bot' ? undefined : deckCode }) });
            const data = await res.json() as any;
            if (!res.ok)
                throw Error(data.error);
            remember({ code: data.room.code, token: data.token, name: name.trim() }, data.room);
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    async function act(command: Record<string, unknown>) {
        if (!credential || !room)
            return;
        setBusy(true);
        setError('');
        const id = crypto.randomUUID(), path = `/api/rooms/${credential.code}`, headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${credential.token}` };
        try {
            for (let attempt = 0; attempt < 2; attempt++) {
                const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify({ ...command, id, revision: roomRef.current.revision }) }), data = await res.json() as any;
                if (res.status === 409 && attempt === 0) {
                    const sync = await fetch(path, { headers, cache: 'no-store' }), fresh = await sync.json() as any;
                    if (!sync.ok)
                        throw Error(fresh.error);
                    applyRoom(fresh.room);
                    continue;
                }
                if (!res.ok) {
                    if (data.room)
                        applyRoom(data.room);
                    throw Error(data.error);
                }
                applyRoom(data.room);
                setConnected(true);
                return;
            }
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    function leave() { sessionStorage.removeItem(currentKey); setCredential(null); credRef.current = null; setRoom(null); roomRef.current = null; setSelected(null); setAssetView(null); setError(''); history.replaceState(null, '', location.pathname); }
    function forget(code: string) { const all = JSON.parse(localStorage.getItem(seatsKey) || '[]').filter((c: Credential) => c.code !== code); localStorage.setItem(seatsKey, JSON.stringify(all)); setSaved(all); }
    async function removeRecord() {
        if (!credential)
            return;
        setBusy(true);
        setError('');
        try {
            const res = await fetch(`/api/rooms/${credential.code}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential.token}` }, body: JSON.stringify({ revision: roomRef.current.revision }) }), data = await res.json() as any;
            if (!res.ok)
                throw Error(data.error);
            forget(credential.code);
            leave();
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    async function loadRecord() {
        if (!credential)
            throw Error('请先打开对局');
        const res = await fetch(`/api/rooms/${credential.code}?record=1`, { headers: { Authorization: `Bearer ${credential.token}` } }), data = await res.json() as any;
        if (!res.ok)
            throw Error(data.error);
        return data;
    }
    async function downloadRecord() {
        if (!credential)
            return;
        setBusy(true);
        setError('');
        try {
            const data = await loadRecord(), url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), a = document.createElement('a');
            a.href = url;
            a.download = `under-world-${credential.code}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    useEffect(() => {
        if (room?.status !== 'finished' || !credential)
            return;
        const all = JSON.parse(localStorage.getItem(seatsKey) || '[]').map((c: Credential) => c.code === room.code ? { ...c, status: 'finished' } : c);
        localStorage.setItem(seatsKey, JSON.stringify(all));
        setSaved(all);
    }, [room?.status, credential]);
    async function copy() {
        try {
            await navigator.clipboard.writeText(`${location.origin}/?join=${room.code}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch {
            setError(`邀请码：${room.code}`);
        }
    }
    return <CardInformationProvider targetAliases={Object.fromEntries((room?.districts ?? []).flatMap((c: any, i: number) => c ? [[`district:${i}`, c.id]] : []))} currentTargets={room?.currentTargets} entryDestinations={room?.entryDestinations} cards={[...(room?.players ?? []).flatMap((p: any) => ['play', 'hand', 'graveyard', 'headquarters', 'assets', 'scoreCards'].flatMap(zone => (p[zone] ?? []).map((c: any) => ({ ...c, zone: zone === 'assets' ? 'asset' : zone })))), ...(room?.players ?? []).flatMap((pl: any) => pl.coreArea ? [{ ...pl.coreArea, zone: 'core-area' }, ...pl.coreArea.cards.map((c: any) => ({ ...c, zone: 'core' }))] : []), ...(room?.societies ?? []).map((c: any) => ({ ...c, ownerName: room?.seats?.[c.owner]?.name, zone: 'society' })), ...(room?.districts ?? []).filter(Boolean).map((c: any) => ({ ...c, zone: 'district' })), ...(room?.sealed ?? []).map((c: any) => ({ ...c, zone: 'sealed' })), ...(room?.inspection?.cards ?? []).map((c: any) => ({ ...c, zone: 'deck' })), ...(room?.flow?.stack ?? []).map((a: any) => ({ id: `stack:${a.id}`, name: stackEntryLabel(a), isAbility: true, abilityDescription: a.abilityDescription, text: (!a.displayName?.startsWith('暗藏者') && !a.displayName?.startsWith('秘密计划') ? (room?.players ?? []).flatMap((p: any) => [...(p.play ?? []), ...(p.graveyard ?? []), ...(p.hand ?? [])]).find((c: any) => c.id === a.cardId && !c.faceDown)?.text : undefined), type: '堆叠对象', zone: 'stack' })), ...[...(room?.triggerRound?.abilities ?? []), ...(room?.triggerChoices ?? []), ...(room?.pendingTriggers ?? []), ...(room?.triggerOrderChoice?.abilities ?? []), ...(room?.deathCostChoice?.abilities ?? []), ...(room?.deathCostChoice?.ability ? [room.deathCostChoice.ability] : [])].map((a: any) => ({ id: `ability:${a.id}`, name: a.displayName ?? a.name ?? '触发能力', text: a.abilityDescription, abilityDescription: a.abilityDescription, isAbility: true, type: '能力', zone: 'ability' }))]} viewer={room?.seat}><div className={`app-shell ${room && room.status !== 'waiting' ? 'playing-layout' : ''}`} data-mobile-panel={mobilePanel ?? 'board'} style={{ '--console-width': `${consoleSize.width}px`, '--console-height': `${consoleSize.height}px` } as React.CSSProperties}><header className="topbar"><a href="/" className="brand" onClick={e => {
            e.preventDefault();
            if (!room)
                leave();
        }}><span className="brand-mark"><Eye size={23}/></span><div><strong>{offline ? 'Underworld' : '隐秘世界'}</strong><small>UNDERWORLD · ARENA</small></div></a><ResponsiveNavigation><BackgroundSettings currentTriggerTiming={room?.triggerTiming}/><KeywordReference />{offline && <OfflineSaves room={room} credential={credential} onLoad={remember}/>}<span className="build-tag">{offline ? '离线版' : '基础测试版'}</span>{!offline && <AccountControls />}<a className="quiet" href="/decks">组卡</a><a className="quiet" href="/cards">卡牌池</a><a className="quiet" href="/card-revisions">卡牌修订</a><ReplayImport />{room && <button className="quiet" aria-label="返回大厅" title="返回大厅" onClick={leave}><LogOut size={15}/><span>返回大厅</span></button>}</ResponsiveNavigation></header>
 {!credential ? offline ? <OfflineLobby botOpeningOrder={botOpeningOrder} setBotOpeningOrder={setBotOpeningOrder} botDifficulty={botDifficulty} setBotDifficulty={setBotDifficulty} name={name} setName={setName} botId={botId} setBotId={setBotId} deckCode={deckCode} setDeckCode={v => { setDeckCode(v); setDeckId(''); }} busy={busy} error={error} start={() => enter('bot')} saved={saved} resume={c => { setCredential(c); credRef.current = c; roomRef.current = null; sessionStorage.setItem(currentKey, JSON.stringify(c)); setError(''); }}/> : <main className="lobby"><section className="intro"><div className="eyebrow"><span className="live-dot"/>线上对战平台</div><h1>隐秘世界<br /><em>对战大厅</em></h1><p className="intro-text">创建一个房间，邀请另一位玩家。<br />从这里开始，在帷幕之下展开对抗。</p><div className="feature-row"><span><Users size={16}/>双人房间</span><span><LockKeyhole size={16}/>隐藏信息隔离</span><span><Layers3 size={16}/>自动结算</span></div><div className="foundation-note"><FlaskConical size={20}/><div><strong>选择秘社，构筑你的卡组</strong><p>主牌至少50张，同名默认最多3张；秘社限制会自动校验。已实现卡牌可进入构筑测试，已接入的秘社能力可在对局中发动，开局使用当前启用的地区牌库。</p></div></div></section><section className="entry-panel"><div className="panel-title"><span className="eyebrow">入席</span><Shield size={21}/></div><h2>准备进入隐秘世界</h2><label htmlFor="nickname">你的昵称</label><input id="nickname" maxLength={24} value={name} onChange={e => setName(e.target.value)} placeholder="例如：帷幕守望者"/><label htmlFor="room-mode">测试方式</label><select id="room-mode" value={mode} onChange={e => setMode(e.target.value)}><option value="constructed-play">自己的卡组 · 构筑测试</option><option value="automation-play">自动化测试牌组 · 已实现卡牌</option><option value="round-play">回合流程 · 文字测试牌</option></select>{(mode === 'round-play' || mode === 'automation-play' && !deckId && !deckCode) && <><label htmlFor='test-society'>测试秘社</label><select id='test-society' value={societyId} onChange={e => setSocietyId(e.target.value)}>{availableSocieties.map(s => <option key={s.id} value={s.id}>{s.name} · {s.id}</option>)}</select>{societyId === 'MSBQ02' && mode === 'automation-play' && <><label htmlFor='test-core'>测试核心角色</label><select id='test-core' value={coreId} onChange={e => setCoreId(e.target.value)}>{availableCores.map((c: any) => <option key={c.id} value={c.id}>{c.name} · {c.id}</option>)}</select></>}<p className='entry-help'>秘社已接入的能力可测试；未实现能力会在房间中列出。构筑卡组使用卡组指定的秘社。</p></>}{mode !== 'round-play' && <DeckSelection required={mode === 'constructed-play'} value={deckId} code={deckCode} onChange={setDeckId} onCodeChange={setDeckCode} busy={busy} societies={availableSocieties}/>}<label className='manual-room-option'><input type='checkbox' checked={manualWithoutConsent} onChange={e => setManualWithoutConsent(e.target.checked)} disabled={busy}/>新房间的手动操作无需对手确认</label><button className="primary wide" disabled={busy} onClick={() => enter('create')}><Plus size={17}/>创建双人房间<ArrowRight size={17}/></button><label className='manual-room-option'><input type='checkbox' checked={botManualWithoutConsent} onChange={e => setBotManualWithoutConsent(e.target.checked)} disabled={busy}/>BOT对局：手动操作无需对手确认</label><label htmlFor='bot-profile'>挑战对手</label><select id='bot-profile' value={botId} onChange={e => setBotId(e.target.value)} disabled={busy}>{BOT_PROFILES.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><label htmlFor="bot-difficulty">难度</label><select id="bot-difficulty" value={botDifficulty} onChange={e => setBotDifficulty(e.target.value as 'normal' | 'hard')} disabled={busy}><option value="normal">标准</option><option value="hard">困难</option></select><BotOpeningOrder value={botOpeningOrder} onChange={setBotOpeningOrder} disabled={busy}/>{botDifficulty === 'hard' && <p className="entry-help">困难BOT知道你的手牌、暗藏者、秘密计划与牌库顺序，并可选择自身未知的牌库顶／底牌。起手和调度仍随机。</p>}<button className='secondary wide' disabled={busy} onClick={() => enter('bot')}>挑战{botProfile.name}</button><p className='entry-help'>BOT使用「{botProfile.deck.name}」50张牌组。你可以使用自己的卡组；未选择时，使用相同卡组挑战。</p><div className="divider">或加入朋友的房间</div><label htmlFor="invite">房间邀请码</label><div className="join-row"><input id="invite" maxLength={8} value={join} onChange={e => setJoin(e.target.value.toUpperCase())} placeholder="8位邀请码"/><button disabled={busy} className="secondary" onClick={() => enter('join')}>加入<ChevronRight size={15}/></button></div><p className="entry-help">无须卡图。座位凭证保存在当前浏览器，可在下方恢复已有座位。</p>{saved.length > 0 && <div className="saved"><span>房间与对局记录</span>{saved.map(c => <button key={c.token} onClick={() => { setCredential(c); credRef.current = c; roomRef.current = null; sessionStorage.setItem(currentKey, JSON.stringify(c)); setError(''); }}><RotateCcw size={13}/>{c.name}<code>{c.code}</code>{c.status === 'finished' && <small>已结束 · 记录</small>}</button>)}</div>}{error && <p role="alert" className="error">{error}</p>}</section></main> : !room ? <main className="loading"><span className="live-dot"/><h2>正在同步房间…</h2>{error && <p className="error">{error}</p>}<button className="secondary" onClick={leave}>返回大厅</button></main> : <main className="arena"><div className="room-strip"><div><span className="eyebrow">{offline ? '本机 Bot 对战' : room.mode === 'automation-play' ? '真实卡牌自动化测试' : room.mode === 'round-play' ? '双人回合对局 · 文字测试牌' : '双人机制测试'}</span><h1>{offline ? '对局' : '房间'} <code>{room.code}</code></h1></div><div className="room-actions"><span className={`connection ${connected ? '' : 'offline'}`}><Radio size={13}/>{connected ? (offline ? '本机运行' : '已连接') : '正在重新连接'}</span>{!room.bot && <button className="secondary" onClick={copy}>{copied ? <Check size={14}/> : <Link2 size={14}/>} {copied ? '已复制' : '邀请玩家'}</button>}{room.bot && <span className='build-tag'>{room.bot.undoPaused && room.status === 'playing' ? 'BOT等待继续' : room.bot.blocked ? 'BOT结算暂停' : room.bot.pending ? 'BOT思考中' : room.bot.name}</span>}{room.bot?.undoPaused && room.status === 'playing' && <button className='secondary' disabled={busy || !!room.manualRequest} onClick={() => act({ type: 'bot-resume' })}>继续 BOT</button>}<RoomRecord compact room={room} busy={busy} act={act} remove={removeRecord} download={downloadRecord} loadRecord={loadRecord}/></div></div>{error && <p role="alert" className="error arena-error">{error}</p>}
 {room.status === 'finished' && room.players.length !== 2 ? <section className="waiting"><h2>房间已结束</h2><p>未开始的房间记录也已保留，可导出或由创建者删除。</p></section> : room.status === 'waiting' ? <section className="waiting"><div className="eyebrow">等待双方就绪</div><h2>对局之前，先落座。</h2><p>{room.bot ? `${room.bot.name} 已准备。确认起始手牌后开始对局。` : '将邀请码发给另一位玩家，双方准备后确认起始手牌，随机决定先手，开始回合对局。'}</p><div className="seats">{room.seats.map((s: any, i: number) => <div className="seat" key={i}><span className="seat-icon"><Users size={28}/></span><small>玩家 {i + 1}{i === room.seat ? ' · 你' : ''}</small><h3>{s?.name || '等待玩家加入'}</h3><span className={s?.ready ? 'ready-label' : ''}>{s ? (s.ready ? '已准备' : '尚未准备') : '空座位'}</span></div>)}</div><button className="primary" disabled={busy} onClick={() => act({ type: 'ready' })}>{room.seats[room.seat].ready ? '取消准备' : offline ? '开始对局' : '准备测试'}<Check size={17}/></button><SeatDecks room={room}/><div className="note" hidden={offline}>{room.mode === 'automation-play' ? `已实现 ${room.automationCount} 条真实卡牌记录（含${room.automationTokenCount}条指示物）。XML未标注独有的角色暂作普通角色；无起始资产。${room.deckSelections?.some(Boolean) ? '使用各自卡组与秘社；先翻开3张真实地区，再处理秘社开局能力、抓起始手牌。' : '测试牌组使用所选秘社起手数与已接入能力，世界牌库采用房间创建时启用的地区。'}` : room.mode === 'round-play' ? '使用文字测试主牌与所选真实秘社，无起始资产。世界牌库由当前启用的真实地区洗混，先翻开3张；按秘社抓起始手牌，可各再调度一次。' : '旧机制房间：每人6张文字测试牌与4个测试资产。新建房间可运行完整回合。'}</div></section> : <div className="arena-layout"><aside id="mobile-stack-panel" className="stack-rail" aria-label="堆叠与展示区"><MobilePanelHeading title="堆叠与展示" close={() => setMobilePanel(null)}/><section className="rail-section"><div className="panel-title"><h3><Layers3 size={15}/>堆叠</h3><span>{room.flow.stack.length}</span></div><div className="stack-list">{[...room.flow.stack].reverse().map((a: any, i: number) => <CardContextSurface key={a.id} cardId={`stack:${a.id}`}><div className="stack-item"><small>{i === 0 ? '顶端 · 先结算' : `层 ${i + 1}`}</small><strong>{stackEntryLabel(a)}</strong>{a.modeLabels?.length > 0 && <span>{a.modeLabels.join(' → ')}</span>}</div></CardContextSurface>)}{!room.flow.stack.length && <div className="empty-stack">堆叠为空</div>}</div></section><section className="rail-section pending"><div className="panel-title"><h3>待入栈触发</h3><span>{room.pendingTriggers.length}</span></div>{room.canResumeTriggerWindow && <button className='primary' disabled={busy} onClick={() => act({ type: 'resume-window' })}>恢复待入栈触发窗口</button>}<p>{room.pendingTriggers.length ? `${room.pendingTriggers.length}个已发动的触发正在等待快速行动窗口。` : '暂无等待入栈的触发。'}</p></section>{room.players.some((p: any) => p.aside.length > 0) && <section className="rail-section"><h3>置于一旁的展示牌</h3>{room.players.flatMap((p: any) => p.aside).map((c: Card) => <div className="aside-card" key={c.id}><span>{c.name}</span>{!room.turn && <button className="quiet" disabled={busy || locked || !myPriority || !!room.pendingChoiceCount} onClick={() => act({ type: 'move-aside', cardId: c.id })}>测试移入墓地</button>}</div>)}</section>}</aside><section className="table"><div className="player-row opponent"><PlayerSocietySummary room={room} player={1 - room.seat}/><div className='player-attachments' aria-label='对方秘社结附'>{other.play.filter((c: Card) => c.attachedTo?.startsWith('society:')).map((c: Card) => <GameCard key={c.id} card={c} inPlay small/>)}</div><div className='assets opponent-assets'><div className='asset-pips'>{other.assets.slice(0, 8).map((a: any) => <CardContextSurface inline key={a.id} cardId={a.id}><span className={a.tapped ? 'spent' : ''} title={`${a.name} · ${a.tapped ? '已横置' : '未横置'}`}>◇</span></CardContextSurface>)}</div><small>可用资产 {other.assets.filter((a: any) => !a.tapped).length}/{other.assets.length} · 费用池 {other.costPool ?? 0}</small><button className='mobile-asset-control' aria-label='查看对方费用与资产' onClick={() => setAssetView(1 - room.seat)}>费用 {other.costPool ?? 0} · 资产 {other.assets.filter((a: any) => !a.tapped).length}/{other.assets.length}</button><button className='asset-details' aria-label='查看对方资产区' onClick={() => setAssetView(1 - room.seat)}>资产明细</button></div><div className="zone-counts">{other.barrierNow && <span>玩家屏障</span>}<span>手牌 <b>{other.handCount}</b></span><span>牌库 <b>{other.deckCount}</b></span><span>墓地 <b>{other.graveyard.length}</b> <PublicGraveyard room={room} player={1 - room.seat}/></span><PublicSealedZone room={room} player={1 - room.seat}/></div><div className="backs" hidden={room.status === 'finished'} aria-label="对手手牌不公开">{Array.from({ length: Math.min(other.handCount, 8) }).map((_, i) => <span key={i}><Eye size={14}/></span>)}</div></div>{room.status === 'finished' && <><h3 className="hand-heading">对方手牌 <span>{other.hand.length}</span></h3><div className="hand opponent-hand" aria-label="已结束对局的对方手牌">{other.hand.map((card: Card) => <GameCard key={card.id} card={card}/>)}</div></>}<div className="phase-bar"><span><span className="live-dot"/>{room.round > 0 && <>第{room.round}回合 · </>}{room.turn?.phase === 'contest' && room.turn.contestLabel && <>地区{room.turn.districtNumber ?? room.turn.district + 1} · {room.turn.contestLabel} · </>}{room.hidden ? '隐秘对抗结算中' : room.turn ? `${room.turn.phaseLabel} · ${room.turn.stepLabel}` : room.hidden ? '隐秘对抗' : room.battle ? '战斗触发测试' : '快速行动窗口'}</span><small>{room.status === 'finished' ? '对局结束' : locked ? '快速行动窗口关闭' : `${room.seats[room.flow.priority].name}具有行动权`}</small></div><DistrictNavigation room={room} containerRef={districtsRef}/><div className="districts" ref={districtsRef}>{(room.districts ?? [null, null, null]).map((d: any, i: number) => (d || i < 3) && <CardContextSurface key={d?.id ?? i} cardId={d?.id ?? `district:${i}`}><div className="district" data-district-index={i}><div className="district-label"><span>地区 {String(room.districts?.[i]?.number ?? i + 1).padStart(2, '0')}</span><small>{room.districts?.[i] ? `${room.districts[i].points}分 · 势力值${room.districts[i].threshold}` : '空地区'}</small></div><div className="region-status">{room.districts?.[i] && <><CardContextSurface inline cardId={room.districts[i].id}><strong><Rich name text={room.districts[i].displayName ?? room.districts[i].name}/></strong></CardContextSurface>{hasCardType(room.districts[i], 'task') && <small>{costAndLoyaltyForDisplay(room.districts[i])} · 任务地区</small>}{room.districts[i].destroyed > 0 && <small>毁灭标志 {room.districts[i].destroyed}{!hasCardType(room.districts[i], 'task') && <> · 计分减{room.districts[i].destroyed}</>}</small>}<details><summary>地区效果 · {room.districts[i].traits?.join('／')}</summary><p><Rich text={room.districts[i].text}/></p></details><span>本方势力 {room.districts[i].influence[room.seat]} · 敌方势力 {room.districts[i].influence[1 - room.seat]}</span>{room.districts[i].timeMarkers > 0 && <small>时间标志合计 {room.districts[i].timeMarkers}{room.districts[i].counters?.time > 0 && <> · 地区自身 {room.districts[i].counters.time}</>}</small>}</>}</div><div className="field-side enemy-field" aria-label={`地区${i + 1} · 对方场上`}>{other.play.filter((c: Card) => c.district === i && !hasCardType(c, 'task')).map((c: Card) => <GameCard key={c.id} card={c} inPlay small/>)}</div><div className="district-line"><span>争夺区</span></div><div className="field-side own-field" aria-label={`地区${i + 1} · 本方场上`}>{mine.play.filter((c: Card) => c.district === i && !hasCardType(c, 'task')).map((c: Card) => <GameCard key={c.id} card={c} inPlay small selected={selected === c.id} onClick={c.faceDown || room.turn ? () => setSelected(selected === c.id ? null : c.id) : undefined}/>)}</div></div></CardContextSurface>)}</div><div className="player-row own"><PlayerSocietySummary room={room} player={room.seat}/><div className='player-attachments' aria-label='本方秘社结附'>{mine.play.filter((c: Card) => c.attachedTo?.startsWith('society:')).map((c: Card) => <GameCard key={c.id} card={c} inPlay small selected={selected === c.id} onClick={() => setSelected(selected === c.id ? null : c.id)}/>)}</div><div className="assets">{[...mine.assets.filter((a: any) => !a.tapped), ...mine.assets.filter((a: any) => a.tapped)].slice(0, 8).map((a: any) => <CardContextSurface inline key={a.id} cardId={a.id}>{room.turn ? <button className={a.tapped ? 'spent' : ''} key={a.id} title={`${a.name} · ${a.faction || '中立'} · ${a.tapped ? '已横置' : '点击横置，产生1点费用'}`} aria-label={`横置资产 ${a.name}`} disabled={busy || a.tapped || !myPriority || locked || room.pendingChoiceCount > 0} onClick={() => act({ type: 'tap-asset', assetId: a.id })}>◇</button> : <span className={a.tapped ? 'spent' : ''} key={a.id} title={`${a.name} · ${a.faction || '中立'} · ${a.tapped ? '已横置' : '未横置'}`}>◇</span>}</CardContextSurface>)}<small>可用资产 {mine.assets.filter((a: any) => !a.tapped).length}/{mine.assets.length}{room.turn && <> · 费用池 {mine.costPool}</>}</small><button className='mobile-asset-control' aria-label='查看本方费用与资产' onClick={() => setAssetView(room.seat)}>费用 {mine.costPool ?? 0} · 资产 {mine.assets.filter((a: any) => !a.tapped).length}/{mine.assets.length}</button><button className='asset-details' aria-label='查看本方资产区' onClick={() => setAssetView(room.seat)}>资产明细</button></div><div className="zone-counts">{mine.barrierNow && <span>玩家屏障</span>}<span>牌库 <b>{mine.deckCount}</b></span><span>墓地 <b>{mine.graveyard.length}</b> <PublicGraveyard room={room} player={room.seat}/></span><PublicSealedZone room={room} player={room.seat}/></div></div>
 <div className="hand-heading"><h3>你的手牌 <span>{mine.handCount}</span></h3></div><div className="hand">{mine.hand.map((c: Card) => <GameCard card={c} key={c.id} selected={selected === c.id} onClick={() => setSelected(c.id === selected ? null : c.id)}/>)}</div></section>
 <aside id="mobile-actions-panel" className="control-rail"><MobilePanelHeading title="对局操作" close={() => setMobilePanel(null)}/><RoundOverview room={room}/><PriorityWindow room={room} busy={busy || !!room.manualRequest} locked={locked} act={act}/><div ref={railRef} tabIndex={0} className='rail-scroll' aria-label='能力与选择窗口'><DeathCostChoice room={room} busy={busy} act={act}/><TriggerRound room={room} busy={busy || !!room.manualRequest || !!room.keeperChoice || !!room.deathCostChoice} act={act}/>{!room.triggerRound && <TriggerOrder room={room} busy={busy || !!room.manualRequest || !!room.keeperChoice || !!room.deathCostChoice} act={act}/>}<EnvironmentPanel mode='decisions' room={room} busy={busy || !!room.manualRequest || !!room.keeperChoice || !!room.deathCostChoice} act={act}/><HiddenContest room={room} busy={busy || !!room.manualRequest} act={act}/>{!!room.publicActions?.length && <section className='choice-panel'><h3>双方可发动的场上能力</h3>{room.publicActions.map((a: any) => <div key={`${a.card.id}:${a.actionIndex}`}><TargetAction room={room} card={a.card} plan={a.plan} options={room.abilityTargets?.[`${a.card.id}:${a.actionIndex}`] ?? room.abilityTargets?.[a.card.id] ?? []} field actionIndex={a.actionIndex} disabled={busy || locked || !myPriority} act={act}/></div>)}</section>}{room.players.some((pl: any) => pl.headquartersActive) && <section className='zone-details'><h3>集团总部</h3>{room.players.map((pl: any, p: number) => pl.headquartersActive && <details key={p}><summary>{room.seats[p].name} · {pl.headquarters.length}张牌</summary><div className='field-side'>{pl.headquarters.map((c: Card) => <GameCard key={c.id} card={c} small/>)}</div></details>)}</section>}<AbyssPanel room={room} busy={busy || !!room.manualRequest || !!room.keeperChoice || !!room.deathCostChoice} act={act}/><CorePanel room={room} busy={busy || !!room.manualRequest} act={act}/><ZonePanel room={room} busy={busy || !!room.manualRequest || !!room.keeperChoice || !!room.deathCostChoice} act={act}/><DamageReplacement room={room} busy={busy} act={act}/><RuleSacrifice key={room.ruleChoice?.id ?? 'none'} room={room} busy={busy || !!room.manualRequest || !!room.keeperChoice || !!room.deathCostChoice} act={act}/><KeeperChoice room={room} busy={busy || !!room.manualRequest} act={act}/><CardInspection room={room} busy={busy} act={act}/><EffectChoice room={room} busy={busy || !!room.manualRequest || !!room.keeperChoice || !!room.deathCostChoice} act={act}/>{room.turn && <RoundDecisions key={`${room.round}:${room.turn.step}:${room.roundChoice?.id ?? ''}:${room.seat}`} room={room} busy={busy || !!room.manualRequest || !!room.keeperChoice || !!room.deathCostChoice} act={act}/>}
 
 {room.status === 'playing' && !room.triggerRound && room.triggerChoices.map((a: any) => a.kind === 'auto-ability' ? <AbilityContextSurface key={a.id} abilityId={a.id}><div className="choice-panel"><h3>触发能力</h3><TargetAction room={room} key={a.id} card={{ name: a.displayName }} plan={a.plan} options={room.abilityTargets?.[a.id] ?? []} disabled={busy || !!room.keeperChoice} act={act} trigger={a}/></div></AbilityContextSurface> : <AbilityContextSurface key={a.id} abilityId={a.id}><div className="choice-panel"><h3>触发能力</h3><p>{a.effect.kind === 'seal-from-graveyard' ? '传闻牌已在墓地。发动后选择场上目标，等待下一快速行动窗口入栈。' : a.event === 'prepareTrigger' ? '准备步骤触发：选择发动后进入当前快速行动窗口。' : a.event === 'endTrigger' ? '结束步骤触发：选择发动后进入当前快速行动窗口。' : a.event === 'keyword-influence' ? `${a.keyword}：参与并赢得本次对抗，可放置一个本方势力标志，同地区不叠加。` : a.event === 'reputation' ? '本地区对抗结束，声望可放置一个本方势力标志。' : a.event === 'region-win' ? '地区赢取触发：测试效果为抓1张牌，可发动并等待响应。' : '战斗正在结算。发动后先进入待入栈队列。'}</p>{a.effect.kind === 'seal-from-graveyard' ? <div className="reward-row">{room.players.flatMap((pl: any) => pl.play).filter((c: any) => !c.faceDown && hasCardType(c, 'character') && (c.controller === room.seat || !c.barrierNow)).map((c: Card) => <button className="secondary" disabled={busy || !!room.manualRequest} key={c.id} onClick={() => act({ type: 'trigger-choice', triggerId: a.id, fire: true, targetId: c.id })}>封印到 {c.name}</button>)}</div> : <button className="primary" disabled={busy || !!room.manualRequest} onClick={() => act({ type: 'trigger-choice', triggerId: a.id, fire: true })}>发动</button>}<button className="quiet" disabled={busy || !!room.manualRequest} onClick={() => act({ type: 'trigger-choice', triggerId: a.id, fire: false })}>不发动</button></div></AbilityContextSurface>)}
 {room.battle && <div className="choice-panel"><h3>战斗结算中</h3><p>快速行动不可发动；满足条件的触发可以发动，但还没有进入堆叠。</p>{room.battle.controller === room.seat ? <button className="primary" disabled={busy || room.pendingChoiceCount > 0} onClick={() => act({ type: 'finish-battle' })}>结束战斗测试，开启快速行动窗口</button> : <span>等待发起方结束战斗测试。</span>}</div>}
            <section className='selected-action-panel'><div className="command-bar">{card && (card.spell || card.attachment) ? <><TargetAction room={room} key={card.id} card={card} plan={card.spell ?? card.attachment} options={room.spellTargets?.[card.id] ?? []} disabled={busy || locked || !myPriority || card.castAllowed === false || !!room.pendingChoiceCount || ((card.spell ?? card.attachment).timing !== 'fast' && !standard) || ((card.spell ?? card.attachment).actionPhaseOnly && room.turn.phase !== 'action')} act={act}/>{false}<button className="secondary" disabled={busy || !standard || mine.actionsUsed.asset || card.nonAssetNow} onClick={() => act({ type: 'build-asset', cardId: card.id })}>建立资产</button></> : card ? <><span className="selected-name">{card.name}</span><CharacterEntryDistrict card={card} room={room} district={district} setDistrict={setDistrict}/><CharacterPlayAction key={card.id} card={card} room={room} disabled={busy || !standard} available={available} district={district} act={act}/>{false}<button className="secondary" disabled={busy || !standard || mine.actionsUsed.asset || card.nonAssetNow} onClick={() => act({ type: 'build-asset', cardId: card.id })}>{mine.actionsUsed.asset ? '本回合资产已建立' : '建立资产'}</button><span role="group" aria-label="秘密派遣操作" className="secret-deployment-action">{randomCharacterEntry(card) && !card.publicNow && <CharacterEntryDistrict card={card} room={room} district={district} setDistrict={setDistrict} secretDeployment disabled={busy || !standard || mine.actionsUsed.secret || mine.secretDeploymentBlocked}/>}<button className="secondary" disabled={busy || !standard || mine.actionsUsed.secret || mine.secretDeploymentBlocked || !hasCardType(card, 'character') || card.publicNow || available < (mine.secretDeploymentBaseCost ?? 1)} onClick={() => act({ type: 'secret-deploy', cardId: card.id, district })}>{mine.secretDeploymentBlocked ? '持续能力禁止秘密派遣' : mine.actionsUsed.secret ? '本回合已秘密派遣' : `支付${mine.secretDeploymentBaseCost ?? 1} · 秘密派遣`}</button></span>{card.rumor && !room.turn && <button className="secondary" disabled={busy || !standard} onClick={() => act({ type: 'discard-rumor', cardId: card.id })}>测试弃牌 → 传闻</button>}</> : hiddenCard ? <><span className="selected-name">自己的暗藏者：{hiddenCard.name}</span><CharacterRevealAction key={hiddenCard.id} card={hiddenCard} room={room} available={available} disabled={busy || !myPriority || locked || !!room.pendingChoiceCount || room.flow.stack.some((a: any) => a.kind === 'reveal-character' && a.cardId === hiddenCard.id) || hiddenCard.automation?.noPaidReveal || hiddenCard.paidRevealBlocked} act={act}/>{hiddenCard.availableActions?.length > 0 && <AbilityActions card={hiddenCard} room={room} busy={busy} locked={locked} myPriority={myPriority} available={available} standard={standard} act={act}/>}</> : fieldCard && room.turn ? <><span className="selected-name">{fieldCard.name}{fieldCard.tapped ? ' · 已横置' : ''}</span>{fieldCard.printedTextBlank && <span>印刷文本框当前视作空白；后天获得的能力仍可使用。</span>}{fieldCard.abilitiesSuppressed ? <span>禁音使未横置，本地区角色不能发动行动或触发能力。</span> : (fieldCard.availableActions?.length || fieldCard.automation?.action || fieldCard.automation?.actions) ? <AbilityActions card={fieldCard} room={room} busy={busy} locked={locked} myPriority={myPriority} available={available} standard={standard} act={act}/> : fieldCard.action ? <button className="primary" disabled={busy || locked || !myPriority || room.pendingChoiceCount > 0 || available < (fieldCard.action.cost ?? 0) || (fieldCard.action.tap && fieldCard.tapped) || (fieldCard.action.timing !== 'fast' && !standard)} onClick={() => act({ type: 'activate', cardId: fieldCard.id })}>发动{fieldCard.action.timing === 'fast' ? '快速' : '标准'}行动 · {fieldCard.action.tap ? '横置' : ''}{fieldCard.action.cost ? `支付${fieldCard.action.cost}` : ''}</button> : false === 'dis-pater' ? <span>请使用上方“深渊兽能力”窗口发动场上行动。</span> : <span>该牌没有主动行动能力。</span>}{room.districts?.[fieldCard.district ?? 0]?.roadMove && hasCardType(fieldCard, 'character') && adjacentDistricts(room, fieldCard.district).map(i => <button className='secondary' key={i} disabled={busy || !standard || fieldCard.tapped || fieldCard.cannotMove || fieldCard.abilitiesSuppressed} onClick={() => act({ type: 'road-move', cardId: fieldCard.id, district: i })}>公路行动 · 横置并移动至地区{i + 1}</button>)}</> : <span>选择卡牌</span>}</div></section><details className='rail-disclosure'><summary>秘社与地区行动能力</summary><EnvironmentPanel mode='actions' room={room} busy={busy || !!room.manualRequest || !!room.keeperChoice || !!room.deathCostChoice} act={act}/></details><details className='rail-disclosure'><summary>封印、资产与公开区域</summary><SocietyStatus room={room}/><SealPanel room={room}/><details className="zone-details"><summary>公开区域 · 计分与墓地</summary>{room.players.map((pl: any, i: number) => <div key={i}><b>{room.seats[i].name}的计分区 · {pl.score}分 · 获胜要求{pl.victoryThreshold ?? 8}分</b><p>{pl.scoreCards.length ? pl.scoreCards.map((c: any, j: number) => <CardContextSurface inline key={c.id} cardId={c.id}>{j > 0 ? '、' : ''}{c.name}（{c.awardedPoints ?? ((c.points ?? 0) - (c.destroyed ?? 0))}分）</CardContextSurface>) : '空'}</p>{pl.honor > 0 && <p>名誉点：{pl.honor}</p>}<b>{room.seats[i].name}的墓地</b><div className='graveyard-cards'>{pl.graveyard.map((c: Card) => <CardSummary key={c.id} card={c}/>)}{!pl.graveyard.length && <span>空</span>}</div></div>)}</details></details>{!room.turn && <section className="rail-section"><div className="test-actions"><button className="secondary" disabled={busy || !standard} onClick={() => act({ type: 'hidden' })}><Eye size={16}/>隐秘对抗测试 · 费用1</button><button className="secondary" disabled={busy || !standard} onClick={() => act({ type: 'battle' })}><FlaskConical size={16}/>战斗触发测试</button></div></section>}</div><div className="scope-note" hidden><FlaskConical size={15}/><p>{room.mode === 'automation-play' ? '完整回合 · 真实卡牌测试' : room.turn ? '完整回合 · 文字测试牌' : '旧机制测试房间'}<br />{room.turn ? room.mode === 'automation-play' ? `已接入${room.automationCount}条记录（含备牌指示物）。真实秘社与${room.worldCardCount ?? 29}张地区牌库。` : '已接入回合、地区对抗与计分。使用文字测试牌。' : '新建房间可测试完整回合。'}</p></div></aside><div className="mobile-log-panel"><MobilePanelHeading title="日志与指令" close={() => setMobilePanel(null)}/><RoomConsole room={room} busy={busy} act={act} onResize={setConsoleSize} mobileExpanded={mobilePanel === 'log'}/></div><MobileBattleDock room={room} panel={mobilePanel} setPanel={setMobilePanel} needsChoice={needsChoice} busy={busy || !!room.manualRequest} locked={locked} act={act}/></div>}</main>}
 {room?.players?.length === 2 && <AssetPanel hideOverview view={assetView} onViewChange={setAssetView} room={room} busy={busy || !!room.manualRequest} act={act}/>}
    </div></CardInformationProvider>;
}
