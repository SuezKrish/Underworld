'use client';
export type BotOpeningOrderValue = 'random' | 'player' | 'bot';
export function BotOpeningOrder({ value, onChange, disabled = false, id = 'bot-opening-order' }: {
    value: BotOpeningOrderValue;
    onChange: (value: BotOpeningOrderValue) => void;
    disabled?: boolean;
    id?: string;
}) {
    return <><label htmlFor={id}>首回合先手</label><select id={id} value={value} onChange={e => onChange(e.target.value as BotOpeningOrderValue)} disabled={disabled}><option value='random'>随机先后手（默认）</option><option value='player'>玩家先手</option><option value='bot'>Bot 先手</option></select><p className='entry-help opening-order-help'>仅决定首回合，之后照常轮换先后手。</p></>;
}
