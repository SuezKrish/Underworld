'use client';
import { useEffect, useRef, useState } from 'react';
import { SignInLink } from './account-controls';
import { watchDeckList } from './deck-list-sync';
import { BOT_PROFILES } from '../engine/bot-deck.mjs';
import { decodeDeckCode, encodeDeckCode, MAX_DECK_CODE_LENGTH } from '../engine/deck-code.mjs';
type Props = {
    required?: boolean;
    value: string;
    code: string;
    onChange: (id: string) => void;
    onCodeChange: (code: string) => void;
    busy: boolean;
    societies: any[];
};
export function DeckSelection({ value, code, onChange, onCodeChange, busy, required = false, societies }: Props) {
    const [source, setSource] = useState<'code' | 'saved' | 'bot'>(value ? 'saved' : BOT_PROFILES.some(profile => profile.deckCode === code) ? 'bot' : 'code');
    const [draft, setDraft] = useState(code), [imported, setImported] = useState<any>(null), [importError, setImportError] = useState('');
    const [decks, setDecks] = useState<any[]>([]), [error, setError] = useState(''), [needsLogin, setNeedsLogin] = useState(false);
    const latest = useRef({ value, onChange, busy });
    latest.current = { value, onChange, busy };
    useEffect(() => {
        let active = true, request = 0;
        async function refresh() {
            if (latest.current.busy)
                return;
            const current = ++request;
            try {
                const r = await fetch('/api/decks', { cache: 'no-store' }), d = await r.json() as any;
                if (!active || current !== request)
                    return;
                if (r.status === 401) {
                    setDecks([]);
                    setNeedsLogin(true);
                    setError('');
                    if (latest.current.value)
                        latest.current.onChange('');
                    return;
                }
                if (!r.ok)
                    throw Error(d.error);
                setNeedsLogin(false);
                setDecks(d.decks);
                setError('');
                if (latest.current.value && !d.decks.some((deck: any) => deck.id === latest.current.value))
                    latest.current.onChange('');
            }
            catch (e) {
                if (active && current === request)
                    setError((e as Error).message);
            }
        }
        refresh();
        const stop = watchDeckList(refresh);
        return () => { active = false; stop(); };
    }, []);
    function chooseSource(next: 'code' | 'saved' | 'bot') {
        if (next === source)
            return;
        setSource(next);
        onChange('');
        onCodeChange('');
        setImported(null);
        setImportError('');
    }
    function importCode() {
        try {
            const deck = decodeDeckCode(draft);
            onChange('');
            onCodeChange(encodeDeckCode(deck));
            setImported(deck);
            setImportError('');
        }
        catch (e) {
            onCodeChange('');
            setImported(null);
            setImportError((e as Error).message);
        }
    }
    return <div className='entry-deck'>
  <label>使用的卡组与秘社</label>
  <div className='deck-source-tabs' role='group' aria-label='卡组来源'>
   <button type='button' className={source === 'code' ? 'primary' : 'secondary'} aria-pressed={source === 'code'} disabled={busy} onClick={() => chooseSource('code')}>导入卡组代码</button>
   <button type='button' className={source === 'saved' ? 'primary' : 'secondary'} aria-pressed={source === 'saved'} disabled={busy} onClick={() => chooseSource('saved')}>已保存卡组</button>
   <button type='button' className={source === 'bot' ? 'primary' : 'secondary'} aria-pressed={source === 'bot'} disabled={busy} onClick={() => chooseSource('bot')}>Bot卡组</button>
  </div>
  {source === 'bot' ? <>
   <label htmlFor='player-bot-deck'>使用Bot卡组 · 无需登录</label>
   <select id='player-bot-deck' value={BOT_PROFILES.find(profile => profile.deckCode === code)?.id ?? ''} disabled={busy} onChange={e => { onChange(''); onCodeChange(BOT_PROFILES.find(profile => profile.id === e.target.value)?.deckCode ?? ''); }}>
    <option value=''>请选择卡组</option>
    {BOT_PROFILES.map(profile => <option key={profile.id} value={profile.id}>{profile.deck.name}</option>)}
   </select>
   <p className='mini-help'>可使用任意Bot卡组挑战任意Bot，也可用于双人对局。</p>
  </> : source === 'code' ? <>
   <label htmlFor='match-deck-code'>卡组代码 · 无需登录</label>
   <textarea id='match-deck-code' rows={3} maxLength={MAX_DECK_CODE_LENGTH} value={draft} disabled={busy} placeholder='粘贴组卡页面复制的 HWD1. 卡组代码' onChange={e => { setDraft(e.target.value); onCodeChange(''); setImported(null); setImportError(''); }}/>
   <div className='deck-code-actions'><button type='button' className='secondary' disabled={busy || !draft.trim()} onClick={importCode}>导入代码</button>{(draft || code) && <button type='button' className='quiet' disabled={busy} onClick={() => { setDraft(''); onCodeChange(''); setImported(null); setImportError(''); }}>清除</button>}</div>
   {imported && code && <p className='deck-code-summary' role='status'>已导入：{imported.name} · {imported.cards.reduce((n: number, r: any) => n + r.count, 0)}张 · {societies.find(s => s.id === imported.societyId)?.name ?? imported.societyId}</p>}
   {importError && <p className='error' role='alert'>{importError}</p>}
   {!code && <p className='mini-help'>{required ? '导入后即可创建或加入构筑房间。' : '不导入时使用自动化测试牌组。'}</p>}
  </> : <>
   <label htmlFor='match-deck'>已保存卡组</label>
   <select id='match-deck' value={value} onChange={e => onChange(e.target.value)} disabled={busy || needsLogin}><option value=''>{required ? '请选择已保存且可测试的卡组' : '自动化测试牌组'}</option>{decks.map(d => <option key={d.id} value={d.id} disabled={!d.validation.playable}>{d.name} · {d.validation.society?.name ?? '未选秘社'} · {d.validation.total}张{d.validation.playable ? '' : ' · 尚不可测试'}</option>)}</select>
   {needsLogin && <SignInLink>登录并选择已保存卡组</SignInLink>}
   {error && <p className='error' role='alert'>{error}</p>}
  </>}
  <a href='/decks'>组卡与生成卡组代码 →</a>
 </div>;
}
export function SeatDecks({ room }: {
    room: any;
}) { return <div className='seat-decks'>{room.manualWithoutConsent && <p className='manual-room-status'>手动操作无需对手确认</p>}{room.seats.map((s: any, i: number) => <div key={i}><strong>{s?.name ?? '空座位'}</strong><p>{room.deckSelections?.[i] ? `${room.deckSelections[i].name} · ${room.deckSelections[i].count}张 · ${room.deckSelections[i].society.name}` : '自动化测试牌组'}</p></div>)}</div>; }
