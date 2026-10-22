'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { Rich } from './rich-text';
import { CardContextSurface } from './card-information';
const factionOrder = ['黄', '绿', '蓝', '红', '灰', '白', '黑', '紫'];
const domainOrder = ['心灵', '神圣', '星辰', '死亡', '鲜血'];
function Loyalty({ loyalty, compact = false }: {
    loyalty: any;
    compact?: boolean;
}) { const f = factionOrder.filter(k => loyalty?.factions?.[k]), d = domainOrder.filter(k => loyalty?.domains?.[k]); return <div className={`loyalty-summary ${compact ? 'compact' : ''}`}><span>当前忠诚</span>{f.map(k => <b key={k}>{k} ×{loyalty.factions[k]}</b>)}{d.map(k => <b key={k}>{k} ×{loyalty.domains[k]}</b>)}{!f.length && !d.length && <small>无派系或领域忠诚</small>}</div>; }
export function AssetPanel({ room, busy, act, view: controlledView, onViewChange, hideOverview = false }: {
    room: any;
    busy: boolean;
    act: (c: any) => Promise<void>;
    view?: number | null;
    onViewChange?: (view: number | null) => void;
    hideOverview?: boolean;
}) {
    const [internalView, setInternalView] = useState<number | null>(null), view = controlledView === undefined ? internalView : controlledView, setView = onViewChange ?? setInternalView;
    const canPay = !room.manualRequest && room.status === 'playing' && !room.flow.locked && !room.pendingChoiceCount && !room.effectChoice && room.flow.priority === room.seat && !room.hidden && !room.battle;
    const player = view === null ? null : room.players[view];
    return <>{!hideOverview && <div className="asset-zone-overview">{room.players.map((p: any, i: number) => <div className="asset-zone-row" key={i}><button className="secondary" onClick={() => setView(i)}>{i === room.seat ? '查看本方资产区' : '查看对方资产区'} · {p.assets.length}张</button><Loyalty loyalty={p.loyalty} compact/></div>)}</div>}{player && <div className="modal-scrim" onClick={() => setView(null)}><section className="rules-modal asset-modal" role="dialog" aria-modal="true" aria-label={`${room.seats[view!].name}的资产区`} onClick={e => e.stopPropagation()}><button className="icon close" aria-label="关闭资产区" onClick={() => setView(null)}><X size={20}/></button><span className="eyebrow">ASSET ZONE · 公开区域</span><h2>{room.seats[view!].name}的资产区</h2><p>{player.assets.length}张资产 · 未横置{player.assets.filter((a: any) => !a.tapped).length}张 · 费用池{player.costPool ?? 0}</p><Loyalty loyalty={player.loyalty}/>{!player.assets.length ? <p>资产区为空。</p> : <div className="asset-card-grid">{player.assets.map((a: any) => <CardContextSurface key={a.id} cardId={a.id}><article className={`asset-card ${a.tapped ? 'is-tapped' : ''}`}><div className="panel-title"><code>{a.catalogId ?? '测试资产'}</code><span>{a.tapped ? '已横置' : '未横置'}</span></div><h3 className="formatted-name"><Rich name text={a.displayName ?? a.name}/></h3><p className='ownership-label'>拥有者：{a.ownerName ?? '—'} · 操控者：{a.controllerName ?? '—'}</p>{a.subtitle && <p className="card-subtitle">{a.subtitle}</p>}<p>{a.faction} · {a.magicDomains.join(' / ') || '无魔法领域'}</p>{a.text && <details><summary>查看原卡牌正文</summary><p className="rich-preview"><Rich text={a.text}/></p>{a.flavorText && <p className="card-flavor"><Rich text={a.flavorText}/></p>}</details>}{view === room.seat && room.turn && <button className="secondary" disabled={busy || !canPay || a.tapped} onClick={() => act({ type: 'tap-asset', assetId: a.id })}>横置 · 产生1点费用</button>}</article></CardContextSurface>)}</div>}</section></div>}</>;
}
export function AutoPassControls({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => Promise<void>;
}) {
    const mode = room.players[room.seat]?.autoPass?.mode ?? 'none', enabled = room.status === 'playing' && room.turn?.phase !== 'setup';
    return <div className="auto-pass-controls"><button className={`secondary wide ${mode === 'step' ? 'active-pass' : ''}`} aria-pressed={mode === 'step'} disabled={busy || !enabled} onClick={() => act({ type: 'auto-pass', mode: mode === 'step' ? 'none' : 'step', stepKey: room.turn?.priorityStepKey ?? `round:${room.round}:lab` })}>{mode === 'step' ? '取消本步骤让过' : '本步骤让过优先权'}</button><button className={`secondary wide ${mode === 'continuous' ? 'active-pass' : ''}`} aria-pressed={mode === 'continuous'} disabled={busy || room.status !== 'playing' || room.turn?.phase === 'setup'} onClick={() => act({ type: 'auto-pass', mode: mode === 'continuous' ? 'none' : 'continuous', stepKey: room.turn?.priorityStepKey ?? `round:${room.round}:lab` })}>{mode === 'continuous' ? '取消让过优先权' : '让过优先权'}</button>{mode !== 'none' && <p role="status" className="auto-pass-status">{mode === 'step' ? `${room.turn?.priorityStepLabel ?? '当前步骤'} · 自动让过中` : '持续自动让过中 · 可随时取消'}</p>}</div>;
}
