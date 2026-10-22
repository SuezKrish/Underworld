'use client';
import { useRef } from 'react';
import { Terminal, X } from 'lucide-react';
import { roomCommands } from '../engine/room-commands.mjs';
export function CommandReference() {
    const ref = useRef<HTMLDialogElement>(null);
    return <><button className='quiet' onClick={() => ref.current?.showModal()}><Terminal size={15}/>指令一览</button><dialog ref={ref} className='rules-modal command-reference-modal' aria-labelledby='command-reference-title' onClick={e => {
            if (e.target === ref.current)
                ref.current?.close();
        }}><button className='icon close' aria-label='关闭指令一览' onClick={() => ref.current?.close()}><X size={20}/></button><h2 id='command-reference-title'>指令一览</h2><p>在消息栏输入完整指令。只有整条输入完全匹配才执行；正文中的指令照常作为消息发送。</p><p>\undo 可在没有快速行动窗口时使用；其他指令仅可在快速行动窗口使用。未特别注明的指令需要对手同意；房间设置可允许免确认操作。</p><dl className='keyword-definitions'>{roomCommands.map(c => <div key={c.name}><dt><code>{c.usage}</code></dt><dd>{c.meaning}{c.number && ` 不输入X默认为${c.defaultCount ?? 1}。`}{c.free && <strong>（无需对手同意）</strong>}</dd></div>)}</dl></dialog></>;
}
