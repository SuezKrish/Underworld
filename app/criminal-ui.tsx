'use client';
export function CriminalChoice({ a, busy, act }: {
    a: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const submit = (data: any) => act({ type: 'effect-choice', choiceId: a.id, ...data });
    return <><div className='effect-options'>{a.cards?.map((c: any) => <div key={c.id}>{a.kind === 'criminal-kormir-shown' ? <><span>{c.name}</span><button className='secondary' disabled={busy} onClick={() => submit({ cardId: c.id, mode: 'grave' })}>置于墓地</button><button className='secondary' disabled={busy} onClick={() => submit({ cardId: c.id, mode: 'hidden' })}>以暗藏者进场</button></> : <button className='secondary' disabled={busy} title={c.text} onClick={() => submit({ cardId: c.id })}>{c.name}{c.printedCost !== undefined ? ` · 印刷费用${c.printedCost}` : ''}</button>}</div>)}</div>{a.canSkip && <button className='quiet' disabled={busy} onClick={() => submit({ skip: true })}>{a.kind === 'criminal-carmen-host' ? '不重新结附' : '保留在一旁，随后按规则回底'}</button>}</>;
}
