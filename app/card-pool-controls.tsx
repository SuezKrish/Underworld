'use client';
import { RoomTimeoutControls } from './room-timeout-controls';
export function PoolControls({ pool, busy, write }: {
    pool: any;
    busy: boolean;
    write: (body: any) => Promise<boolean>;
}) {
    if (!pool?.canManagePool || !pool.poolManagement)
        return null;
    const m = pool.poolManagement, enabled = pool.cards.filter((c: any) => c.availability.enabled).length;
    return <section className='pool-management' aria-label='全站卡牌池管理'><h2>全站卡牌池管理</h2><RoomTimeoutControls /><p>仅你的账号可见及修改。普通用户只能看到启用的卡牌，组卡、秘社选择与新建对局采用同一设置。</p><p>当前启用 <b>{enabled}</b> / {pool.cards.length} 条卡牌记录。单张禁用会保留，重新启用扩展不会解除单张禁用。</p><details><summary>按扩展启用或禁用</summary><div className='pool-set-grid'>{m.sets.map((s: any) => <div key={s.name} className={s.enabled ? '' : 'pool-set-disabled'}><div><strong>{s.name}</strong><small>{s.enabled ? '已启用' : '已禁用'} · {s.enabledCount}/{s.total} 张可用</small></div><button className='secondary' disabled={busy} aria-label={`${s.enabled ? '禁用' : '启用'}扩展 ${s.name}`} onClick={() => write({ type: 'set-set-availability', setName: s.name, enabled: !s.enabled })}>{s.enabled ? '禁用扩展' : '启用扩展'}</button></div>)}</div></details><p className='mini-help'>卡牌池设置保存在服务器并对所有用户生效。已开始的对局保留原资料；卡牌池设置改变后，尚未开始的旧房间需重新创建。全部地区启用时为29张，新建对局至少需要3张启用地区。卡牌或能力生成的专用指示物仍按效果生成。</p></section>;
}
export function CardAvailabilityControl({ card, busy, write }: {
    card: any;
    busy: boolean;
    write: (body: any) => Promise<boolean>;
}) {
    if (!card.availability)
        return null;
    const a = card.availability;
    return <div className='card-availability-control'><span>{a.enabled ? '已启用' : a.cardDisabled ? '单张已禁用' : a.profileDisabled ? '当前不可用' : '所属扩展已禁用'}{a.disabledBySets.length > 0 && <small>扩展：{a.disabledBySets.join('、')}</small>}</span><button className='secondary' disabled={busy} aria-label={`${a.cardDisabled ? '启用' : '禁用'}卡牌 ${card.id}`} onClick={() => write({ type: 'set-card-availability', cardId: card.id, enabled: a.cardDisabled })}>{a.cardDisabled ? '启用此牌' : '禁用此牌'}</button>{!a.cardDisabled && a.disabledBySets.length > 0 && <small>需启用所属扩展后才可用。</small>}</div>;
}
