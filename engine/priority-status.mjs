// Priority is permission to respond, not ownership of the action step.
export function priorityStatusLabel(room, { locked = false, busy = false } = {}) {
    if (room.status === 'finished')
        return '对局结束';
    if (room.status !== 'playing')
        return '等待对局开始';
    if (room.turn?.step === 'mulligan')
        return room.ownMulliganDone ? '调度已锁定，等待对方确认' : '双方选择起始手牌调度';
    if (room.bot?.undoPaused)
        return 'Bot等待继续';
    if (room.bot?.blocked)
        return 'Bot结算暂停';
    if (busy)
        return '正在处理操作';
    if (room.bot?.pending)
        return 'Bot思考中';
    const choice = room.deathCostChoice ?? room.keeperChoice ?? room.ruleChoice ?? room.damageChoice ?? room.effectChoice ?? room.environmentChoice ?? room.roundChoice ?? room.triggerRound ?? room.triggerOrderChoice;
    if (choice) {
        const p = choice.controller;
        return [0, 1].includes(p) ? `等待${room.seats[p]?.name ?? '玩家'}完成选择` : '等待完成当前选择';
    }
    if (locked || room.flow?.locked || room.pendingChoiceCount || room.hidden || room.battle || room.manualRequest)
        return '当前结算中 · 无快速行动优先权';
    const p = room.flow?.priority;
    return [0, 1].includes(p) ? `当前优先权：${room.seats[p]?.name ?? '玩家'}${p === room.seat ? '（你）' : ''}` : '等待进入快速行动窗口';
}
