'use client';
import { useEffect, useState } from 'react';
import { LogIn, UserRound } from 'lucide-react';
import { chatGPTSignInPath, chatGPTSignOutPath } from '../lib/auth-links.mjs';
type Account = {
    userId: string;
    displayName: string;
};
export function useAccount(enabled = true) {
    const [account, setAccount] = useState<Account | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
    useEffect(() => {
        if (!enabled)
            return;
        let active = true;
        async function refresh() {
            try {
                const r = await fetch('/api/account', { cache: 'no-store' });
                if (r.status === 401) {
                    if (active) {
                        setAccount(null);
                        setError('');
                    }
                    return;
                }
                const d = await r.json() as any;
                if (!r.ok)
                    throw Error(d.error ?? '无法读取登录状态');
                if (active) {
                    setAccount(d);
                    setError('');
                }
            }
            catch (e) {
                if (active)
                    setError((e as Error).message);
            }
            finally {
                if (active)
                    setLoading(false);
            }
        }
        refresh();
        window.addEventListener('focus', refresh);
        return () => { active = false; window.removeEventListener('focus', refresh); };
    }, [enabled]);
    return { account, loading, error };
}
export function SignInLink({ returnTo = '/', beforeNavigate, children }: {
    returnTo?: string;
    beforeNavigate?: () => void;
    children?: React.ReactNode;
}) {
    return <a className='secondary account-signin' href={chatGPTSignInPath(returnTo)} target='_top' onClick={beforeNavigate}><LogIn size={16}/>{children ?? '登录'}</a>;
}
export function AccountControls({ returnTo = '/', beforeNavigate, state }: {
    returnTo?: string;
    beforeNavigate?: () => void;
    state?: ReturnType<typeof useAccount>;
}) {
    const fetched = useAccount(!state), { account, loading, error } = state ?? fetched, [profiles, setProfiles] = useState<{
        key: string;
        name: string;
    }[]>([]);
    useEffect(() => {
        let active = true;
        fetch('/__local-test-accounts', { cache: 'no-store' }).then(async (r) => {
            if (!r.ok)
                return;
            const d = await r.json() as any;
            if (active && d.local === true && Array.isArray(d.profiles))
                setProfiles(d.profiles);
        }).catch(() => { });
        return () => { active = false; };
    }, []);
    return <div className='account-controls' aria-label='账号与登录'>
  {loading ? <span className='mini-help'>读取账号…</span> : account ? <><span className='account-name'><UserRound size={16}/>{account.displayName}</span><a className='quiet' href={chatGPTSignOutPath(returnTo)} target='_top' onClick={beforeNavigate}>退出登录</a></> : <SignInLink returnTo={returnTo} beforeNavigate={beforeNavigate}/>}
  {error && <span className='mini-help' role='status'>{error}</span>}
  {!!profiles.length && <details className='local-accounts'><summary>本地测试账号</summary><div><p>两个浏览器分别选择不同玩家，卡组各自保存。</p>{profiles.map(p => <a className='secondary' key={p.key} href={`${chatGPTSignInPath(returnTo)}&local_profile=${encodeURIComponent(p.key)}`} target='_top' onClick={beforeNavigate}>登录为{p.name}</a>)}</div></details>}
 </div>;
}
