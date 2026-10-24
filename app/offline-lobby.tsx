'use client';
import { BOT_PROFILES } from '../engine/bot-deck.mjs';
import { BotOpeningOrder, type BotOpeningOrderValue } from './bot-opening-order';
type Props = {
    botOpeningOrder: BotOpeningOrderValue;
    setBotOpeningOrder: (v: BotOpeningOrderValue) => void;
    botDifficulty: 'normal' | 'medium' | 'hard';
    setBotDifficulty: (v: 'normal' | 'medium' | 'hard') => void;
    name: string;
    setName: (v: string) => void;
    botId: string;
    setBotId: (v: string) => void;
    deckCode: string;
    setDeckCode: (v: string) => void;
    busy: boolean;
    error: string;
    start: () => void;
    saved: any[];
    resume: (c: any) => void;
};
export function OfflineLobby(p: Props) {
    return <main className='lobby offline-lobby'><section className='intro'><div className='eyebrow'>本机运行 · 无需登录</div><h1>Underworld<br /><em>离线对战</em></h1><p className='intro-text'>选择卡组，挑战自动机。<br />对局与卡组保存在这台设备中。</p><div className='feature-row'><span>{BOT_PROFILES.length} 套 Bot 卡组</span><span>完整规则结算</span><span>断网可用</span></div><a className='secondary' href='/decks'>构筑自己的卡组</a></section><section className='entry-panel'><h2>开始挑战</h2><label htmlFor='offline-name'>你的昵称</label><input id='offline-name' maxLength={24} value={p.name} onChange={e => p.setName(e.target.value)} placeholder='输入昵称'/><label htmlFor='offline-bot'>对手卡组</label><select id='offline-bot' value={p.botId} disabled={p.busy} onChange={e => p.setBotId(e.target.value)}>{BOT_PROFILES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><label htmlFor='offline-difficulty'>难度</label><select id='offline-difficulty' value={p.botDifficulty} disabled={p.busy} onChange={e => p.setBotDifficulty(e.target.value as 'normal' | 'medium' | 'hard')}><option value='normal'>简单</option><option value='medium'>中等</option><option value='hard'>困难</option></select><BotOpeningOrder id='offline-opening-order' value={p.botOpeningOrder} onChange={p.setBotOpeningOrder} disabled={p.busy}/><label htmlFor='offline-player-deck'>你的卡组</label><select id='offline-player-deck' value={BOT_PROFILES.find(b => b.deckCode === p.deckCode)?.id ?? 'custom'} onChange={e => { const b = BOT_PROFILES.find(b => b.id === e.target.value); p.setDeckCode(b?.deckCode ?? ''); }}><option value='custom'>导入卡组代码／默认使用对手卡组</option>{BOT_PROFILES.map(b => <option key={b.id} value={b.id}>{b.deck.name}</option>)}</select><textarea aria-label='离线卡组代码' rows={4} value={p.deckCode} onChange={e => p.setDeckCode(e.target.value)} placeholder='粘贴 HWD1 卡组代码；留空则使用与对手相同的卡组'/><button className='primary wide' disabled={p.busy} onClick={p.start}>{p.busy ? '正在准备…' : '开始对战'}</button>{p.error && <p className='error' role='alert'>{p.error}</p>}{p.saved.length > 0 && <div className='saved'><span>本机对局与记录</span>{p.saved.map(c => <button key={c.token} onClick={() => p.resume(c)}>{c.name} · {c.code}{c.status === 'finished' ? ' · 已结束' : ' · 继续对局'}</button>)}</div>}</section></main>;
}
