'use client';
import { useEffect, useRef, useState } from 'react';
const selectedValue = (policy: any) => policy.settings.idleTimeoutMinutes === null ? 'off' : String(policy.settings.idleTimeoutMinutes);
export function RoomTimeoutControls() {
    const [policy, setPolicy] = useState<any>(null), [value, setValue] = useState('30'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
    const saving = useRef(false);
    useEffect(() => {
        let active = true;
        async function load() {
            if (saving.current)
                return;
            try {
                const response = await fetch('/api/room-settings', { cache: 'no-store' }), next = await response.json() as any;
                if (!response.ok)
                    throw Error(next.error);
                if (active && !saving.current) {
                    setPolicy(next);
                    setValue(selectedValue(next));
                    setError('');
                }
            }
            catch (e) {
                if (active)
                    setError((e as Error).message);
            }
        }
        load();
        window.addEventListener('focus', load);
        return () => { active = false; window.removeEventListener('focus', load); };
    }, []);
    async function save(nextValue: string) {
        if (!policy || saving.current)
            return;
        let rollbackPolicy = policy;
        saving.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        setValue(nextValue);
        try {
            const response = await fetch('/api/room-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: policy.revision, idleTimeoutMinutes: nextValue === 'off' ? null : Number(nextValue) }) }), next = await response.json() as any;
            if (!response.ok) {
                if (response.status === 409) {
                    const latest = await fetch('/api/room-settings', { cache: 'no-store' });
                    if (latest.ok) {
                        rollbackPolicy = await latest.json();
                        setPolicy(rollbackPolicy);
                    }
                }
                throw Error(next.error);
            }
            setPolicy(next);
            setValue(selectedValue(next));
            setMessage('房间超时设置已保存。');
        }
        catch (e) {
            setValue(selectedValue(rollbackPolicy));
            setError((e as Error).message);
        }
        finally {
            saving.current = false;
            setBusy(false);
        }
    }
    return <section className='room-timeout-settings' aria-label='房间超时设置'>
  <div><label htmlFor='room-idle-timeout'>超时自动关闭房间</label><select id='room-idle-timeout' value={value} disabled={!policy || busy} aria-describedby='room-idle-timeout-help' onChange={e => save(e.target.value)}><option value='15'>15分钟</option><option value='30'>30分钟</option><option value='60'>60分钟</option><option value='off'>取消</option></select></div>
  <p id='room-idle-timeout-help' className='mini-help'>按最后一次实际操作计时，保存后对进行中的线上房间生效。选择“取消”将停止自动关闭；超时结束后保留对局记录。</p>
  {busy && <p role='status'>保存中…</p>}{message && <p role='status' className='catalog-success'>{message}</p>}{error && <p role='alert' className='error'>{error}</p>}
 </section>;
}
