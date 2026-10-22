'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ThemePortal } from './background-settings';
import { CardInformationProvider, CardSummary } from './card-information';
import { Rich } from './rich-text';
const zones = [['hand', '手牌'], ['play', '场上'], ['assets', '资产区'], ['graveyard', '墓地'], ['headquarters', '集团总部'], ['aside', '置于一旁'], ['core', '核心区'], ['scoreCards', '记分区']] as const;
export function FinishedInformation({ room, close }: {
    room: any;
    close: () => void;
}) {
    const [player, setPlayer] = useState(room.seat ?? 0), [zone, setZone] = useState('hand');
    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !document.querySelector('.card-information-modal,.card-context-menu'))
                close();
        };
        document.addEventListener('keydown', key);
        return () => document.removeEventListener('keydown', key);
    }, [close]);
    const info = room.finishedInformation;
    if (room.status !== 'finished' || !info)
        return null;
    const reveal = (c: any) => ({ ...c, recordFaceDown: c.faceDown, faceDown: false });
    const all = info.cards.map(reveal);
    const cards: any[] = zone === 'core' ? [info.players[player]?.coreArea, ...info.players[player]?.core ?? []].filter(Boolean) : zones.some(([key]) => key === zone) ? info.players[player]?.[zone] ?? [] : zone === 'all' ? info.cards : zone === 'sealed' ? info.sealed.filter((c: any) => c.owner === player) : info[zone] ?? [];
    const targetName = (t: any) => t.cardId ? all.find((c: any) => c.id === t.cardId)?.name ?? t.cardId : t.district !== undefined ? `地区 ${t.district + 1}` : t.player !== undefined ? room.seats[t.player]?.name : '—';
    return <ThemePortal><CardInformationProvider cards={all}><div className='modal-scrim finished-information-scrim' onClick={close}><section className='rules-modal finished-information' role='dialog' aria-modal='true' aria-label='已结束对局已知信息' onClick={e => e.stopPropagation()}>
  <button className='icon close' aria-label='关闭已知信息' onClick={close}><X size={20}/></button><h2>对局记录 · 已知信息</h2>
  <div className='record-zone-controls'><label>玩家<select aria-label='查看玩家' value={player} onChange={e => setPlayer(Number(e.target.value))}>{info.players.map((p: any, i: number) => <option key={i} value={i}>{p.name}</option>)}</select></label><label>区域<select aria-label='查看区域' value={zone} onChange={e => setZone(e.target.value)}>{zones.map(([key, label]) => <option key={key} value={key}>{label} · {info.players[player]?.[key]?.length ?? 0}</option>)}<option value='sealed'>封印区 · {info.sealed.filter((c: any) => c.owner === player).length}</option><option value='societies'>双方秘社</option><option value='districts'>地区</option><option value='stack'>堆叠 · {info.stack.length}</option><option value='all'>全部已知卡牌</option></select></label></div>
  <p>牌库剩余 {info.players[player]?.deckCount ?? 0} 张 · 世界牌库剩余 {info.worldDeckCount} 张</p>
  <p>{zone === 'stack' ? '从栈顶到栈底排列。' : '仅展示至少一名玩家已知的信息，可右键查看完整文本。'}不展示牌库内容及顺序。</p>
  {zone === 'stack' ? <ol className='record-stack'>{[...info.stack].reverse().map((a: any) => <li key={a.id}><strong><Rich text={a.displayName ?? a.card?.name ?? '能力'}/></strong><p>{room.seats[a.controller]?.name}</p>{a.abilityLabel && <p><Rich text={a.abilityLabel}/></p>}{a.targets.length > 0 && <p>指定对象：{a.targets.map(targetName).join('、')}</p>}{a.card && <CardSummary card={reveal(a.card)}/>}</li>)}</ol> : <div className='asset-card-grid'>{cards.map((c, i) => <CardSummary key={c.id ?? i} card={reveal(c)}>{c.secretPlan ? <p>秘密计划 · 背面朝上</p> : c.faceDown && <p>{c.zone === 'sealed' ? '背面封印牌' : '暗藏者'}</p>}{c.zone === 'play' && c.district !== undefined && <p>地区 {c.district + 1}</p>}{c.hostId && <p>封印于：{all.find((a: any) => a.id === c.hostId || `district-host:${a.id}` === c.hostId)?.name ?? c.hostId}</p>}{c.ownerName && <p>拥有者：{c.ownerName}</p>}</CardSummary>)}</div>}
  {!(zone === 'stack' ? info.stack.length : cards.length) && <p>此区域没有卡牌。</p>}
 </section></div></CardInformationProvider></ThemePortal>;
}
