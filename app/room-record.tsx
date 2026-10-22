'use client';
import { MatchReplay } from './match-replay';
import { normalizeReplayRecord } from '../engine/replay.mjs';
import { useState } from 'react';
import { Download, Eye, Flag, Square, Trash2, X } from 'lucide-react';
import { FinishedInformation } from './finished-information';
export function RoomRecord({ room, busy, act, remove, download, loadRecord, compact = false }: {
    room: any;
    busy: boolean;
    act: (c: any) => Promise<void>;
    remove: () => Promise<void>;
    download: () => Promise<void>;
    loadRecord: () => Promise<any>;
    compact?: boolean;
}) {
    const [confirm, setConfirm] = useState<'end' | 'delete' | 'concede' | null>(null), [inspect, setInspect] = useState(false), [replay, setReplay] = useState<any>(null), [replayBusy, setReplayBusy] = useState(false), [replayError, setReplayError] = useState('');
    const finished = room.status === 'finished', winner = room.result?.winner;
    const title = confirm === 'concede' ? '确认投降？' : confirm === 'end' ? '结束房间并保留记录？' : '删除这场对局的全部记录？';
    return <><section className={compact ? 'record-tools compact' : 'record-tools'}>
  {!compact && <div><strong>{finished ? '对局已结束 · 记录保留' : '房间管理'}</strong><p>{finished ? room.result?.reason : '可投降判负，或结束房间并保留记录。'}{finished && <><br />可从大厅最近的座位恢复此记录。{!room.recordComplete && '旧版仅保留了最近100条事件，更早事件无法恢复。'}</>}</p></div>}
  <div className='room-actions'>
   {finished && <span className='record-result' role='status'>{Number.isInteger(winner) ? `${room.seats[winner]?.name}获胜` : '对局已结束'} · {room.result?.reason}</span>}
   <button className='secondary' disabled={busy} onClick={download}><Download size={15}/>{compact ? '导出记录' : '导出对局记录'}</button>
   {finished && <button className='secondary' disabled={replayBusy} onClick={async () => {
                setReplayBusy(true);
                try {
                    setReplay(normalizeReplayRecord(await loadRecord()));
                    setReplayError('');
                }
                catch (e) {
                    setReplayError((e as Error).message);
                }
                finally {
                    setReplayBusy(false);
                }
            }}>{replayBusy ? '正在加载回放…' : '播放回放'}</button>}{replayError && <span role='alert'>{replayError}</span>}
   {finished && room.finishedInformation && <button className='secondary' onClick={() => setInspect(true)}><Eye size={15}/>查看已知信息</button>}
   {room.status === 'playing' && <button className='secondary' disabled={busy} onClick={() => setConfirm('concede')}><Flag size={15}/>投降</button>}
   {!finished ? <button className='secondary' disabled={busy || !!room.manualRequest} onClick={() => setConfirm('end')}><Square size={15}/>{compact ? '结束对局' : '结束房间并保留记录'}</button> : room.canDelete ? <button className='danger-button' disabled={busy} onClick={() => setConfirm('delete')}><Trash2 size={15}/>{compact ? '删除记录' : '删除对局记录'}</button> : <small>房间创建者可删除整场记录</small>}
  </div>
 </section>
 {confirm && <div className='modal-scrim'><section className='rules-modal' role='dialog' aria-modal='true' aria-label={title}>
  <button className='icon close' aria-label='取消房间操作' onClick={() => setConfirm(null)}><X size={20}/></button><h2>{title}</h2>
  <p>{confirm === 'concede' ? '投降后，对手立即获胜。记录仅展示至少一名玩家已知的信息；牌库只显示剩余张数。' : confirm === 'end' ? '双方将立即停止对局，不判定胜负。房间、已知局面及对局事件记录保留，可查看和导出；结束后不能继续行动。' : '删除后，双方都无法再恢复此房间或查看记录。此操作无法撤销，请先导出需要保留的记录。'}</p>
  <div className='reward-row'><button className='secondary' disabled={busy} onClick={() => setConfirm(null)}>取消</button><button className={confirm === 'end' ? 'primary' : 'danger-button'} disabled={busy} onClick={async () => {
                if (confirm === 'delete')
                    await remove();
                else
                    await act({ type: confirm === 'concede' ? 'concede' : 'end-room' });
                setConfirm(null);
            }}>{confirm === 'concede' ? '确认投降' : confirm === 'end' ? '确认结束并保留' : '永久删除记录'}</button></div>
 </section></div>}
 {replay && <MatchReplay record={replay} close={() => setReplay(null)}/>}
 {inspect && finished && <FinishedInformation room={room} close={() => setInspect(false)}/>}
 </>;
}
