'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { decodeDeckCode, encodeDeckCode, MAX_DECK_CODE_LENGTH } from '../engine/deck-code.mjs';
export function DeckCodeDialog({ deck, onClose, onImport }: {
    deck: any;
    onClose: () => void;
    onImport: (deck: any) => boolean;
}) {
    const dialog = useRef<HTMLDialogElement>(null), codeField = useRef<HTMLTextAreaElement>(null);
    const [draft, setDraft] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
    const encoded = useMemo(() => {
        try {
            return { code: encodeDeckCode(deck), error: '' };
        }
        catch (e) {
            return { code: '', error: (e as Error).message };
        }
    }, [deck]);
    useEffect(() => { dialog.current?.showModal(); }, []);
    async function copy() {
        try {
            await navigator.clipboard.writeText(encoded.code);
            setMessage('卡组代码已复制');
            setError('');
        }
        catch {
            codeField.current?.focus();
            codeField.current?.select();
            setMessage('请复制已选中的卡组代码');
        }
    }
    function importCode() {
        try {
            if (onImport(decodeDeckCode(draft)))
                onClose();
        }
        catch (e) {
            setError((e as Error).message);
        }
    }
    return <dialog ref={dialog} className='deck-code-dialog' aria-labelledby='deck-code-title' onCancel={e => { e.preventDefault(); onClose(); }}>
  <div className='deck-code-heading'><h2 id='deck-code-title'>卡组代码</h2><button type='button' className='secondary' onClick={onClose}>关闭</button></div>
  <label htmlFor='export-deck-code'>当前卡组：{deck.name}</label>
  <textarea ref={codeField} id='export-deck-code' rows={4} value={encoded.code} readOnly onFocus={e => e.target.select()}/>
  {encoded.error && <p className='error' role='alert'>{encoded.error}</p>}
  <div className='deck-code-actions'><button type='button' className='primary' disabled={!encoded.code} onClick={copy}>复制代码</button><span>无需保存，可在大厅直接导入对战。</span></div>
  {message && <p className='deck-code-summary' role='status'>{message}</p>}
  <label htmlFor='import-deck-code'>导入其他卡组代码</label>
  <textarea id='import-deck-code' rows={3} value={draft} maxLength={MAX_DECK_CODE_LENGTH} onChange={e => { setDraft(e.target.value); setError(''); }} placeholder='粘贴 HWD1. 卡组代码，或已导出的卡组 JSON'/>
  {error && <p className='error' role='alert'>{error}</p>}
  <div className='deck-code-actions'><button type='button' className='secondary' disabled={!draft.trim()} onClick={importCode}>导入为新草稿</button></div>
 </dialog>;
}
