export function stackEntryLabel(a) {
    const name = a.displayName ?? '卡牌';
    if (a.kind === 'play-spell')
        return `${name} · ${a.cardType === 'attachment' ? '附属' : a.cardType === 'task/district' ? '任务牌' : '事务'}`;
    if (a.kind === 'play-character')
        return `${name} · 等待进场`;
    if (a.kind === 'reveal-character')
        return `${name} · 等待现身`;
    if (a.kind === 'hidden-effect')
        return `${name} · 隐秘能力`;
    if (['auto-ability', 'environment-ability', 'abyss-ability', 'zone-ability'].includes(a.kind))
        return `${name} · 能力`;
    if (a.kind === 'rule-return-region')
        return '规则性能力：地区角色与附属回牌库底';
    if (a.kind === 'rule-return-aside')
        return '展示牌置于牌库底';
    if (a.kind === 'gain-hidden')
        return '隐秘：获得标志';
    if (a.effect?.kind === 'seal-from-graveyard')
        return `${a.displayName ?? '传闻'} · 从墓地封印`;
    return a.displayName ?? '触发能力';
}
