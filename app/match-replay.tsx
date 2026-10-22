'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, Upload, X } from 'lucide-react';
import { normalizeReplayRecord, replayTimeline, safeReplayFrame, unpackReplayChunk } from '../engine/replay.mjs';
import { ThemePortal } from './background-settings';
import { CardContextSurface, CardInformationProvider } from './card-information';
import { Rich } from './rich-text';
import { MagicDomainIcons } from './magic-domain-icons';
import { CardMarkers } from './card-markers';
import { hasAbilityIconCounts } from '../engine/card-search.mjs';
const phaseNames: Record<string, string> = { setup: '游戏准备', start: '开始阶段', action: '行动阶段', contest: '对抗阶段', end: '结束阶段', finished: '对局结束' };
const contestNames: Record<string, string> = { investigation: '调查', battle: '战斗', influence: '势力' };
function ReplayCard({ card }: {
    card: any;
}) { const icons = card.effectiveIcons ?? card.icons; return <CardContextSurface cardId={card.id}><div className={`replay-card ${card.tapped ? 'replay-tapped' : ''}`}><div className='replay-card-head'><span>{card.printedCostText ?? card.printedCost ?? ''}</span><small>{card.zone === 'play' && card.district !== undefined ? `地区${card.district + 1}` : ''}</small></div><strong><Rich name text={card.displayName ?? card.name}/></strong>{card.faceDown && <small>暗藏者 · 已知牌面</small>}{card.secretPlan && <small>秘密计划 · 已知牌面</small>}<CardMarkers card={card}/>{hasAbilityIconCounts(card) && icons && <span className='replay-card-icons'>眼{icons.investigation ?? 0} · 刀{icons.battle ?? 0} · 星{icons.influence ?? 0}</span>}<MagicDomainIcons domains={card.magicDomains}/>{card.defense !== undefined && <small>{card.zone === 'play' ? `伤害${card.damage ?? 0} / ` : ''}防御{card.effectiveDefense ?? card.defense}</small>}{card.tapped && <small>已横置</small>}</div></CardContextSurface>; }
function ReplayBoard({ frame }: {
    frame: any;
}) {
    const cards: any[] = Object.values(frame.cards), player = (p: number) => frame.players[p], list = (ids: string[]) => ids.map(id => frame.cards[id]).filter(Boolean), field = (p: number, d: number) => cards.filter(c => c.zone === 'play' && c.controller === p && c.district === d);
    const playerBar = (p: number) => <><div className='replay-player-bar'><strong>{player(p).name}</strong><span>分数 {player(p).score} · 隐秘 {player(p).markers?.hidden ?? 0} · 暴露 {player(p).markers?.exposed ?? 0} · 费用池 {player(p).costPool ?? 0} · 牌库 {player(p).deckCount} 张</span></div><div className='replay-hand' aria-label={`${player(p).name}的手牌`}>{list(player(p).hand).map(c => <ReplayCard key={c.id} card={c}/>)}{!player(p).hand.length && <small>手牌为空</small>}</div></>;
    return <div className='replay-board-layout'><aside className='replay-public-zones'>{frame.players.map((p: any, i: number) => <section key={i}><strong>{p.name}</strong>{frame.societies.filter((id: string) => frame.cards[id].controller === i).map((id: string) => <ReplayCard key={id} card={frame.cards[id]}/>)}{(['assets', 'graveyard', 'scoreCards', 'core'] as const).map(z => <details key={z}><summary>{({ assets: '资产', graveyard: '墓地', scoreCards: '记分区', core: '核心区' })[z]} · {p[z].length}</summary>{list(p[z]).map(c => <ReplayCard key={c.id} card={c}/>)}</details>)}</section>)}<details><summary>封印区 · {frame.sealed.length}</summary>{list(frame.sealed).map(c => <ReplayCard key={c.id} card={c}/>)}</details></aside><div className='replay-table'>{playerBar(1)}<div className='replay-districts'>{frame.districts.map((id: string, i: number) => {
            const d = frame.cards[id];
            if (!d)
                return <section key={`empty:${i}`} className='replay-district'><span>空地区</span></section>;
            return <section key={id} className='replay-district'><div className='replay-field enemy-field'>{field(1, i).map(c => <ReplayCard key={c.id} card={c}/>)}</div><CardContextSurface cardId={id}><div className='replay-region'><small>地区 {i + 1}</small><strong><Rich name text={d.displayName ?? d.name}/></strong><span>势力 {d.influence?.[0] ?? 0} / {d.influence?.[1] ?? 0} · {d.points ?? 0}分</span>{d.destroyed > 0 && <small>毁灭 {d.destroyed}</small>}</div></CardContextSurface><div className='replay-field own-field'>{field(0, i).map(c => <ReplayCard key={c.id} card={c}/>)}</div></section>;
        })}</div>{playerBar(0)}</div><aside className='replay-stack'><h3>堆叠</h3>{[...frame.stack].reverse().map((a: any) => <CardContextSurface key={a.id} cardId={a.cardId ?? a.sourceId}><div className='replay-stack-entry'><strong><Rich text={a.displayName ?? frame.cards[a.cardId]?.name ?? '能力'}/></strong>{a.abilityLabel && <p><Rich text={a.abilityLabel}/></p>}</div></CardContextSurface>)}{!frame.stack.length && <p>堆叠为空</p>}</aside></div>;
}
export function MatchReplay({ record, close }: {
    record: any;
    close: () => void;
}) {
    const data = useMemo(() => normalizeReplayRecord(record), [record]), chunks = data.replay.chunks;
    const [index, setIndex] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1);
    const timeline = useMemo(() => replayTimeline(chunks, data.logs), [chunks, data.logs]), count = timeline.entries.length, length = Math.max(1, count || data.logs.length);
    const selection = useMemo(() => {
        if (!count)
            return { frame: null, error: null };
        const ref = timeline.entries[index];
        try {
            return { frame: safeReplayFrame(unpackReplayChunk(chunks[ref.chunkIndex])[ref.localIndex].state), error: null };
        }
        catch (e) {
            return { frame: null, error: (e as Error).message };
        }
    }, [chunks, count, index, timeline]);
    useEffect(() => {
        if (!playing)
            return;
        const timer = setInterval(() => setIndex(i => Math.min(length - 1, i + 1)), 1100 / speed);
        return () => clearInterval(timer);
    }, [playing, speed, length]);
    useEffect(() => {
        if (index >= length - 1)
            setPlaying(false);
    }, [index, length]);
    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !document.querySelector('.card-information-modal,.card-context-menu'))
                close();
        };
        document.addEventListener('keydown', key);
        return () => document.removeEventListener('keydown', key);
    }, [close]);
    const current: any = selection.frame, logId = current?.logId ?? data.logs[index]?.id, shown = data.logs.filter((l: any) => l.id <= logId && (!count || timeline.logIds.has(l.id))), jump = (n: number) => { setPlaying(false); setIndex(Math.max(0, Math.min(length - 1, n))); };
    const allCards: any[] = current ? Object.values(current.cards).map((c: any) => ({ ...c, faceDown: false, secretPlan: false })) : [];
    return <ThemePortal><CardInformationProvider cards={allCards}><div className='modal-scrim replay-scrim'><section className='replay-modal' role='dialog' aria-modal='true' aria-label='对局回放'><header className='replay-header'><div><h2>对局回放 · {data.code}</h2><p>{data.players.map((p: any) => p.name).join(' 对阵 ')}{current && <> · 第{current.round}回合 · {phaseNames[current.turn.phase] ?? current.turn.phase}{current.turn.phase === 'contest' && <> · 地区{current.turn.district + 1} {contestNames[current.turn.kind] ?? ''}对抗</>}</>}</p></div><button className='icon' aria-label='关闭对局回放' onClick={close}><X size={20}/></button></header>
 <div className='replay-controls'><button className='secondary' aria-label='回到回放开头' disabled={!index} onClick={() => jump(0)}><SkipBack size={16}/></button><button className='secondary' aria-label='上一步回放' disabled={!index} onClick={() => jump(index - 1)}><ChevronLeft size={16}/></button><button className='primary' disabled={length < 2} onClick={() => {
            if (index === length - 1)
                setIndex(0);
            setPlaying(v => !v);
        }}>{playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? '暂停' : '播放'}</button><button className='secondary' aria-label='下一步回放' disabled={index >= length - 1} onClick={() => jump(index + 1)}><ChevronRight size={16}/></button><button className='secondary' aria-label='跳到回放结尾' disabled={index >= length - 1} onClick={() => jump(length - 1)}><SkipForward size={16}/></button><input type='range' min='0' max={length - 1} value={index} aria-label='回放进度' onChange={e => jump(Number(e.target.value))}/><span>{index + 1} / {length}</span><select aria-label='回放速度' value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[.5, 1, 2, 4].map(v => <option key={v} value={v}>{v}×</option>)}</select></div>
 {!count && <p className='replay-note'>这份旧记录未保存历史场面，仅播放日志。</p>}{count > 0 && (timeline.partial || chunks[0]?.base?.state?.round > 1) && <p className='replay-note'>这场对局从更新后的操作开始记录，较早的场面未保存。</p>}
 <div className='replay-content'>{selection.error ? <p role='alert'>{selection.error}</p> : current && <ReplayBoard frame={current}/>}<section className={`replay-log ${count ? '' : 'replay-log-only'}`} aria-label='回放日志'><h3>对局日志</h3>{shown.slice(count ? -10 : Math.max(0, shown.length - 50)).map((l: any, i: number) => <p key={l.id ?? i} className={l.id === logId ? 'current' : ''}><small>{l.round ? `第${l.round}回合 · ` : ''}{l.id}</small>{l.text}</p>)}{!shown.length && <p>等待第一条对局事件。</p>}</section></div>
 </section></div></CardInformationProvider></ThemePortal>;
}
export function ReplayImport() {
    const input = useRef<HTMLInputElement>(null), [record, setRecord] = useState<any>(null), [error, setError] = useState('');
    return <><button className='quiet' onClick={() => input.current?.click()}><Upload size={15}/>导入回放</button><input hidden type='file' ref={input} accept='.json,application/json' aria-label='导入对局JSON文件' onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file)
                return;
            try {
                if (file.size > 50 * 1024 * 1024)
                    throw Error('回放文件超过50MB');
                const data = normalizeReplayRecord(JSON.parse(await file.text()));
                setRecord(data);
                setError('');
            }
            catch (e) {
                setError((e as Error).message);
            }
        }}/>{error && <span role='alert' className='error'>{error}</span>}{record && <MatchReplay record={record} close={() => setRecord(null)}/>}</>;
}
