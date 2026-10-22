'use client';
import { readTriggerTimingPreference, saveTriggerTimingPreference } from './trigger-timing-preference';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X } from 'lucide-react';
import { BACKGROUND_PRESETS as presets, DEFAULT_INTERFACE, DEFAULT_HIGHLIGHTS, normalizeInterfacePreference, highlightStyles, displayedHighlightColor } from '../engine/interface-preferences.mjs';
type HighlightKey = 'source' | 'draft' | 'cost' | 'target';
type Preference = {
    id: string;
    fit: 'cover' | 'contain';
    darkness: number;
    highlights: Record<HighlightKey, string>;
};
const initial = DEFAULT_INTERFACE as Preference;
const key = 'hidden-world:background:v1';
const BackgroundContext = createContext<{
    value: Preference;
    setValue: (v: Preference) => void;
}>({ value: initial, setValue: () => { } });
function readPreference(): Preference {
    try {
        return normalizeInterfacePreference(JSON.parse(localStorage.getItem(key) ?? 'null')) as Preference;
    }
    catch {
        return initial;
    }
}
export function BackgroundProvider({ children }: {
    children: React.ReactNode;
}) {
    const [value, setValue] = useState(initial), [ready, setReady] = useState(false);
    useEffect(() => {
        setValue(readPreference());
        setReady(true);
        const sync = (e: StorageEvent) => {
            if (e.key === key)
                setValue(readPreference());
        };
        window.addEventListener('storage', sync);
        return () => window.removeEventListener('storage', sync);
    }, []);
    useEffect(() => {
        if (!ready)
            return;
        try {
            localStorage.setItem(key, JSON.stringify(value));
        }
        catch { }
    }, [ready, value]);
    const preset = presets.find(p => p.id === value.id);
    return <BackgroundContext.Provider value={{ value, setValue }}><div className={`interface-background ${preset ? 'custom-background' : ''}`} data-background={preset?.id ?? 'default'} style={{ ...highlightStyles(value), '--background-image': preset ? `url("/backgrounds/${preset.id}.jpg")` : 'none', '--background-position': preset?.position ?? 'center', '--background-fit': value.fit, '--background-shade': value.darkness / 100 } as React.CSSProperties}>{preset && <div className={`interface-artwork ${value.fit === 'contain' ? 'full-artwork' : ''}`} aria-hidden='true'/>}{children}</div></BackgroundContext.Provider>;
}
// Menus and card details are mounted on document.body; carry the selected
// palette with them so they inherit the same colors as the game surface.
export function ThemePortal({ children }: {
    children: React.ReactNode;
}) {
    const { value } = useContext(BackgroundContext), preset = presets.find(p => p.id === value.id);
    return createPortal(<div className={`theme-portal ${preset ? 'custom-background' : ''}`} data-background={preset?.id ?? 'default'} style={highlightStyles(value) as React.CSSProperties}>{children}</div>, document.body);
}
export function BackgroundSettings({currentTriggerTiming}:{currentTriggerTiming?:string}={}) {
    const { value, setValue } = useContext(BackgroundContext), dialog = useRef<HTMLDialogElement>(null);
    const [triggerTiming, setTriggerTiming] = useState('event');
    useEffect(() => setTriggerTiming(readTriggerTimingPreference()), []);
    return <><button className='quiet background-settings-button' aria-label='设置' title='设置' onClick={() => dialog.current?.showModal()}><Settings size={16}/><span>设置</span></button><dialog ref={dialog} className='background-dialog'><header><h2>设置</h2><button className='quiet' aria-label='关闭界面设置' onClick={() => dialog.current?.close()}><X size={20}/></button></header><section aria-label='触发规则设置'>{['event','stack'].includes(currentTriggerTiming??'')&&<p>本局触发规则：{currentTriggerTiming==='event'?'提前决定费用和目标':'入栈时决定费用和目标'}</p>}<h3 className='settings-section-heading'>触发规则</h3><select aria-label='触发费用和目标的决定时机' value={triggerTiming} onChange={e => { setTriggerTiming(e.target.value); saveTriggerTimingPreference(e.target.value); }}><option value='event'>提前决定费用和目标（默认）</option><option value='stack'>入栈时决定费用和目标</option></select><p>用于你新建的对局。提前决定时，触发轮只排列已确认能力的入栈顺序。现有对局继续使用创建时的规则。</p><p><a href='/rules/event.pdf' target='_blank' rel='noreferrer'>提前决定版规则书</a> · <a href='/rules/stack.pdf' target='_blank' rel='noreferrer'>入栈决定版规则书</a></p></section><h3 className='settings-section-heading'>背景</h3><div className='background-presets' role='radiogroup' aria-label='预设背景'><button role='radio' aria-checked={!value.id} className={`background-preset background-default ${!value.id ? 'selected' : ''}`} onClick={() => setValue({ ...value, id: '' })}><span>默认背景</span></button>{presets.map(p => <button key={p.id} role='radio' aria-checked={value.id === p.id} className={`background-preset ${value.id === p.id ? 'selected' : ''}`} onClick={() => setValue({ ...value, id: p.id })}><img src={`/backgrounds/${p.id}.jpg`} alt='' loading='lazy'/><span>{p.name}</span></button>)}</div><div className='background-options'><label>图片适配<select value={value.fit} disabled={!value.id} onChange={e => setValue({ ...value, fit: e.target.value as Preference['fit'] })}><option value='cover'>铺满屏幕</option><option value='contain'>完整展示图片</option></select></label><label>背景遮罩 <output>{value.darkness}%</output><input type='range' aria-label='背景遮罩' min='10' max='80' value={value.darkness} disabled={!value.id} onChange={e => setValue({ ...value, darkness: Number(e.target.value) })}/></label></div><section className='highlight-settings' aria-label='高亮颜色设置'><div className='highlight-settings-heading'><h3>高亮颜色</h3><button className='quiet' onClick={() => setValue({ ...value, highlights: { ...DEFAULT_HIGHLIGHTS } })}>恢复默认高亮颜色</button></div>{([{ key: 'source', label: '能力来源', sample: 'pending-trigger-source' }, { key: 'draft', label: '正在选择的对象', sample: 'draft-effect-target' }, { key: 'cost', label: '费用选择对象', sample: 'draft-cost-object' }, { key: 'target', label: '已指定目标', sample: 'current-effect-target' }] as const).map(item => <label className='highlight-color-row' key={item.key}><span className={`highlight-color-sample ${item.sample}`} aria-hidden='true'/><span>{item.label}</span><input type='color' aria-label={`${item.label}颜色`} value={displayedHighlightColor(value, item.key)} onInput={e => setValue({ ...value, highlights: { ...value.highlights, [item.key]: e.currentTarget.value } })} onChange={e => setValue({ ...value, highlights: { ...value.highlights, [item.key]: e.target.value } })}/><code>{displayedHighlightColor(value, item.key).toUpperCase()}</code></label>)}</section><p className='background-personal'>设置自动保存在此浏览器中。背景和高亮仅对你生效。</p><button className='primary' onClick={() => dialog.current?.close()}>完成</button></dialog></>;
}
