'use client';
import { CardContextSurface } from './card-information';
import { visibleCardMarkers } from '../engine/card-markers.mjs';
export function ShoggothCounter({ society }: {
    society: any;
}) {
    const count = society?.counters?.['失控'] ?? 0;
    if (!society?.plan?.shoggoth || count <= 0)
        return null;
    return <span className={`shoggoth-counter${count >= 3 ? ' at-limit' : ''}`} aria-label={`失控标志 ${count}`}><span>失控</span><b>{count}</b></span>;
}
export function SocietyCounters({ society }: {
    society: any;
}) {
    if (!society)
        return null;
    return <>{visibleCardMarkers(society).filter(m => !(society.plan?.shoggoth && m.key === '失控')).map(m => <span className='society-counter' key={m.key} title={m.description}>{m.label} <b>{m.count}</b></span>)}</>;
}
export function PlayerSocietySummary({ room, player }: {
    room: any;
    player: number;
}) {
    const p = room.players[player], society = room.societies?.[player], own = player === room.seat;
    const showHonor = p.coreArea || p.honor > 0 || society?.plan?.actions?.some((a: any) => a.honorCost);
    return <div className='player-identity'>
  <div className='player-identity-heading'><small>{own ? '本方' : '对方'}</small><h2>{room.seats[player].name}</h2>{p.autoPass?.mode && p.autoPass.mode !== 'none' && <small>{p.autoPass.mode === 'step' ? '本步骤自动让过中' : '持续自动让过中'}</small>}</div>
  {society && <div className='player-society-heading'><CardContextSurface inline cardId={society.id}><strong className='player-society-name'>{society.name}</strong></CardContextSurface>{society.tapped && <span className='society-tapped'>已横置</span>}</div>}
  <div className='player-public-stats' aria-label={`${own ? '本方' : '对方'}公开状态`}><span>分数 <b>{p.score}</b></span><ShoggothCounter society={society}/>{showHonor && <span>名誉 <b>{p.honor ?? 0}</b></span>}<span>隐秘 <b>{p.markers.hidden}</b></span><span>暴露 <b>{p.markers.exposed}</b></span>{own && <span>手牌上限 <b>{p.handLimit}</b></span>}</div>
  {visibleCardMarkers(society ?? {}).some(m => !(society?.plan?.shoggoth && m.key === '失控')) && <div className='society-counters' aria-label={`${society.name}上的标志`}><SocietyCounters society={society}/></div>}
 </div>;
}
