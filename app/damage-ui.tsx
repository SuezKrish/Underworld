'use client';
export function DamageReplacement({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const a = room.damageChoice;
    if (!a)
        return null;
    return <section className='choice-panel'><h3>持续能力 · 伤害替代顺序</h3><p>{a.targetName}将受到{a.amount}点伤害。选择首先适用的替代效果；当前没有响应窗口。</p>{a.controller !== room.seat ? <p>等待{room.seats[a.controller].name}选择。</p> : a.options.map((o: any) => <button className='secondary' key={o.id} disabled={busy} onClick={() => act({ type: 'damage-replacement', choiceId: a.id, replacementId: o.id })}>{o.label}</button>)}</section>;
}
