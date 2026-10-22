'use client';
import { useEffect, useRef, useState } from 'react';
import { Save, FolderOpen, X } from 'lucide-react';
export function OfflineSaves({ room, credential, onLoad }: {
    room: any;
    credential: any;
    onLoad: (credential: any, room: any) => void;
}) {
    const [open, setOpen] = useState(false), [name, setName] = useState(''), [saves, setSaves] = useState<any[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), dialog = useRef<HTMLDialogElement>(null);
    async function list() {
        const r = await fetch('/api/offline-saves'), d = await r.json() as any;
        if (!r.ok)
            throw Error(d.error);
        setSaves(d.saves);
    }
    useEffect(() => {
        if (open) {
            dialog.current?.showModal();
            setError('');
            setNotice('');
            setName(room ? `第${room.round}回合 · ${new Date().toLocaleString('zh-CN')}` : '');
            list().catch(e => setError(e.message));
        }
        else
            dialog.current?.close();
    }, [open]);
    async function save() {
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const r = await fetch('/api/offline-saves', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential.token}` }, body: JSON.stringify({ code: room.code, revision: room.revision, name }) }), d = await r.json() as any;
            if (!r.ok)
                throw Error(d.error);
            await list();
            setNotice('存档已保存。');
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    async function load(id: string) {
        setBusy(true);
        setError('');
        try {
            const r = await fetch('/api/offline-saves/' + id, { method: 'POST' }), d = await r.json() as any;
            if (!r.ok)
                throw Error(d.error);
            onLoad({ code: d.room.code, token: d.token, name: d.room.seats[0].name }, d.room);
            setOpen(false);
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    return <><button className='quiet' onClick={() => setOpen(true)}><FolderOpen size={15}/>存档 / 读档</button>{open && <dialog ref={dialog} className='rules-modal offline-saves-modal' aria-labelledby='offline-saves-title' onCancel={() => setOpen(false)} onClick={e => {
                if (e.target === dialog.current)
                    setOpen(false);
            }}><button className='icon close' aria-label='关闭存读档' onClick={() => setOpen(false)}><X size={20}/></button><h2 id='offline-saves-title'>存档 / 读档</h2>{room && credential && <section><label htmlFor='offline-save-name'>存档名称</label><input id='offline-save-name' maxLength={80} value={name} onChange={e => setName(e.target.value)} disabled={busy}/><button className='primary' disabled={busy || !name.trim()} onClick={save}><Save size={15}/>保存当前对局</button></section>}<p>读取存档会另开一局，当前对局和原存档都会保留。存档保存在这台设备中。</p>{notice && <p role='status'>{notice}</p>}{error && <p className='error' role='alert'>{error}</p>}<div className='effect-options'>{saves.map(s => <article className='rail-section' key={s.id}><strong>{s.name}</strong><p>第{s.round}回合 · 对手：{s.opponent} · {new Date(s.savedAt).toLocaleString('zh-CN')}</p><button className='secondary' disabled={busy} onClick={() => load(s.id)}>读取此存档</button></article>)}</div>{!saves.length && <p>还没有手动存档。</p>}</dialog>}</>;
}
