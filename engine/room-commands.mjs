export const roomCommands = [
    { name: 'undo', operation: 'undo', meaning: '撤销上一步实际操作或选择。' },
    { name: 'check-deck', operation: 'inspect', zone: 'unordered-deck', free: true, meaning: '检视自己的整个牌库，按名称排列，不显示牌库顺序；可申请将牌置于手中或墓地。' },
    { name: 'check-deck-in-order', operation: 'inspect', zone: 'deck', meaning: '按当前顺序检视自己的整个牌库；可申请将牌置于手中或墓地。' },
    { name: 'move-top', operation: 'deck-top', select: true, meaning: '将所选拥有者为自己的牌置于自己牌库顶；多张牌随机排列。' },
    { name: 'move-bottom', operation: 'deck-bottom', select: true, meaning: '将所选拥有者为自己的牌置于自己牌库底；多张牌随机排列。' },
    { name: 'move-hand', operation: 'to-hand', select: true, meaning: '将所选拥有者为自己的牌置于自己手牌。' },
    { name: 'move-graveyard', operation: 'to-graveyard', select: true, meaning: '将所选拥有者为自己的牌置于自己墓地。' },
    { name: 'move-asset', operation: 'to-asset', select: true, meaning: '将所选拥有者为自己的卡牌置于本方资产区，无视非资产限制。' },
    { name: 'seal', operation: 'seal', select: true, meaning: '将所选拥有者为自己的卡牌封印在所选对象上。' },
    { name: 'put-face-up', operation: 'put-face-up', select: true, meaning: '将所选拥有者为自己的角色牌或附属牌正面放置进场。' },
    { name: 'put-face-down', operation: 'put-face-down', select: true, meaning: '将所选拥有者为自己的角色牌以暗藏者状态放置进场。' },
    { name: 'check-top', operation: 'inspect', zone: 'top', number: true, meaning: '检视自己牌库顶X张牌；可申请调整顺序、将牌置于手中或墓地。' },
    { name: 'check-bottom', operation: 'inspect', zone: 'bottom', number: true, meaning: '检视自己牌库底X张牌；可申请调整顺序、将牌置于手中或墓地。' },
    { name: 'draw', operation: 'draw', number: true, meaning: '抓X张牌。' },
    { name: 'shuffle-deck', operation: 'shuffle', meaning: '将自己的牌库洗牌。' },
    { name: 'flip-character', operation: 'flip-character', select: true, meaning: '将所选自己操控的场上角色／暗藏者翻面，按潜伏／现身规则处理。' },
    { name: 'add-secrecy-counter', operation: 'add-secrecy-counter', number: true, meaning: '在本方秘社上放置X个隐秘标志。' },
    { name: 'add-exposure-counter', operation: 'add-exposure-counter', number: true, meaning: '在本方秘社上放置X个暴露标志。' },
    { name: 'add-influence-counter', operation: 'add-influence-counter', number: true, select: true, meaning: '选择一个地区，在该地区放置X个本方势力标志。' },
    { name: 'initiate-secrecy-contest', operation: 'initiate-secrecy-contest', number: true, signed: true, defaultCount: 0, meaning: '进行一次隐秘对抗，本次隐秘对抗中指令输入者获得+X。' },
    { name: 'ignore-loyalty', operation: 'ignore-loyalty', meaning: '切换本方忠诚度需求：输入一次忽略，再次输入恢复；卡牌及能力仍支付费用。' },
    { name: 'add-mana', operation: 'add-mana', number: true, meaning: '本方费用池增加X点，仍在步骤结束时清空。' }
].map(c => ({ ...c, command: '\\' + c.name, usage: '\\' + c.name + (c.number ? ' [X]' : '') }));
// Do not trim: a command must occupy the entire message, including whitespace.
export function parseRoomCommand(text) {
    if (typeof text !== 'string')
        return null;
    for (const def of roomCommands) {
        if (text === def.command)
            return { ...def, ...(def.number ? { count: def.defaultCount ?? 1 } : {}) };
        if (!def.number || !text.startsWith(def.command + ' '))
            continue;
        const raw = text.slice(def.command.length + 1);
        if (!(def.signed ? /^[+-]?(?:0|[1-9][0-9]*)$/ : /^[1-9][0-9]*$/).test(raw) || /[\r\n]/.test(raw))
            continue;
        const count = Number(raw);
        if (Number.isSafeInteger(count) && (def.signed || count > 0))
            return { ...def, count };
    }
    return null;
}
export function commandSuggestions(text) {
    if (typeof text !== 'string' || !text.startsWith('\\'))
        return [];
    const prefix = text.split(' ')[0];
    return roomCommands.filter(c => c.command.startsWith(prefix));
}
