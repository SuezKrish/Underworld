'use client';
import { useState } from 'react';
import { CardSummary } from './card-information';
import { X } from 'lucide-react';
export function SealPanel({ room }: {
    room: any;
}) { const [open, setOpen] = useState(false), cards = room.sealed ?? []; return <section className='seal-panel'><div className='panel-title'><h3>封印区</h3><button className='secondary' onClick={() => setOpen(true)}>查看封印牌 · {cards.length}张</button></div>{!!cards.length && <p>{cards.map((c: any) => `${c.name} → ${c.hostName}`).join('；')}</p>}{open && <div className='modal-scrim' onClick={() => setOpen(false)}><section className='rules-modal asset-modal' role='dialog' aria-modal='true' aria-label='检视封印牌' onClick={e => e.stopPropagation()}><button className='icon close' aria-label='关闭封印区' onClick={() => setOpen(false)}><X size={20}/></button><h2>封印牌 · {cards.length}张</h2><div className='asset-card-grid'>{cards.map((c: any) => <CardSummary key={c.id} card={c}><p>封印在：{c.hostName}</p>{c.faceDown && <small>背面封印</small>}</CardSummary>)}</div>{!cards.length && <p>暂无封印牌。</p>}</section></div>}</section>; }
