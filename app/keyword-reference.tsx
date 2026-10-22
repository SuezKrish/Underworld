'use client';
import { useState, useRef, useEffect } from 'react';
import { BookOpen, X } from 'lucide-react';
import { CommandReference } from './command-reference';
import { keywordReference, offlineKeywordReference, keywordsInText } from '../engine/keywords.mjs';
export function KeywordReference() {
    const [open, setOpen] = useState(false), [query, setQuery] = useState(''), dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (open)
            dialog.current?.showModal();
        else
            dialog.current?.close();
    }, [open]);
    const offline = typeof window !== 'undefined' && (window as any).__HIDDEN_WORLD_OFFLINE__ === true;
    const entries = (offline ? offlineKeywordReference : keywordReference).filter(k => (k.name + k.meaning).includes(query.trim()));
    return <><button className='quiet' onClick={() => setOpen(true)}><BookOpen size={15}/>关键词速查</button>{open && <dialog ref={dialog} className='rules-modal keyword-reference-modal' aria-labelledby='keyword-reference-title' onCancel={() => setOpen(false)} onClick={e => {
                if (e.target === dialog.current)
                    setOpen(false);
            }}><button className='icon close' aria-label='关闭关键词速查' onClick={() => setOpen(false)}><X size={20}/></button><span className='eyebrow'>规则关键词</span><h2 id='keyword-reference-title'>关键词速查表</h2><input aria-label='检索关键词' placeholder='搜索关键词或含义' value={query} onChange={e => setQuery(e.target.value)}/><dl className='keyword-definitions'>{entries.map(k => <div key={k.name}><dt>{k.name}</dt><dd>{k.meaning}</dd></div>)}</dl>{!entries.length && <p>没有符合条件的关键词。</p>}</dialog>}<CommandReference /></>;
}
export function CardKeywordInformation({ card }: {
    card: any;
}) {
    const states = card.keywordStates ?? [], granted = card.grantedAbilities ?? [], definitions = keywordsInText([...states.map((s: any) => s.keyword), ...granted.map((a: any) => a.text), card.text].join('\n'));
    return <>{states.length > 0 && <div className='card-current-abilities'><h3>当前关键词</h3><dl className='keyword-definitions'>{states.map((s: any) => <div key={s.keyword}><dt>{s.keyword}{s.amount !== undefined && s.amount > 0 && s.amount !== Number(s.keyword.match(/\d+$/)?.[0]) ? ` · 合计${s.amount}` : ''}<span className={s.present ? 'keyword-present' : 'keyword-absent'}>{s.present ? '生效' : s.removedBy.length ? '已失去' : '条件未满足'}</span></dt><dd>{s.sources.map((x: any, i: number) => <p key={i}>来源：{x.name} · {x.reason}</p>)}{s.removedBy.map((x: any, i: number) => <p key={i}>失去来源：{x.name} · {x.reason}</p>)}</dd></div>)}</dl></div>}{granted.length > 0 && <div className='card-granted-abilities'><h3>获得的能力</h3>{granted.map((a: any, i: number) => <article key={i}><p>{a.text}</p><small>来源：{a.source.name} · {a.source.reason}</small></article>)}</div>}{definitions.length > 0 && <div className='card-keyword-reference'><h3>涉及的关键词</h3><dl className='keyword-definitions'>{definitions.map(k => <div key={k.name}><dt>{k.name}</dt><dd>{k.meaning}</dd></div>)}</dl></div>}</>;
}
