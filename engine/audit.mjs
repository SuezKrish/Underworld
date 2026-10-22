import blockers from '../data/card-blockers.json' with { type: 'json' };
const blockerRows = new Map(blockers.records.map(c => [c.id, c]));
import audit from '../data/card-audit.json' with { type: 'json' };
import { automationStatus } from './automation.mjs';
import { comparableCardRules } from './card-text-format.mjs';
const rows = new Map(audit.map(c => [c.id, c]));
export const semanticFields = ['text', 'type', 'typeLine', 'cost', 'printedCost', 'faction', 'magic', 'iconsDefense'];
export function auditCard(card, original) {
    const row = rows.get(card.id), changed = !original || semanticFields.some(k => k === 'text' ? comparableCardRules(card[k]) !== comparableCardRules(original[k]) : card[k] !== original[k]);
    if (!row || changed)
        return { ruleStatus: 'unreviewed', implemented: false, engineStatus: 'unreviewed', summary: '资料新增或规则字段已修改，需要重新审核。', issues: [], reason: '尚未审核当前版本' };
    const auto = automationStatus(card), base = blockerRows.get(card.id), ruleStatus = auto.implemented ? 'clear' : base?.category === '规则歧义' ? 'disputed' : base?.category === '资料不足' ? 'needs-confirmation' : 'clear';
    const blocker = base;
    return { ...row, summary: row.summary, blocker: auto.implemented ? null : blocker && blocker.category !== '已实现' ? blocker : { category: '仅未排期', reason: '该版本资料变化后尚未重新接入。', decision: '重新审核当前文本并更新实现。' }, ruleStatus, implemented: auto.implemented, engineStatus: auto.implemented ? 'automated' : 'pending', reason: auto.reason };
}
export function auditCatalog(cards, baseline) {
    const original = new Map(baseline.map(c => [c.id, c]));
    const enriched = cards.map(c => ({ ...c, audit: auditCard(c, original.get(c.id)) }));
    const counts = { total: cards.length, automated: 0, clear: 0, disputed: 0, 'needs-confirmation': 0, unreviewed: 0 };
    for (const c of enriched) {
        counts[c.audit.ruleStatus]++;
        if (c.audit.implemented)
            counts.automated++;
    }
    const blockerCounts = {};
    for (const c of enriched)
        if (!c.audit.implemented) {
            const k = c.audit.blocker?.category ?? '待重审';
            blockerCounts[k] = (blockerCounts[k] ?? 0) + 1;
        }
    return { cards: enriched, auditCounts: counts, blockerCounts, auditAssumptions: ['智谋与威名同地区不叠加：赢得具有该关键词角色所参与的调查／战斗对抗时，可在该地区放置一个本方势力标志；触发在奖励完成后的快速行动窗口入栈。', '独有属性从prop/unique读取，0为普通、1为独有，缺少时默认为0；同一操控者按显示牌名加粗部分识别独有身份；先发动进场触发，再规则性选择牺牲直到只留一个。', '已接入隐秘对抗基础流程、预测、检索、操控权、墓地进场及部分附属；其他能力逐卡列出待实现原因。', '文字明确与已经实现分别标注；审核不等于对全部卡牌组合的证明。', '默认封印正面公开且不在场；宿主失效封印不移动来源，宿主离场封印牌立即规则回拥有者手。', '指示物角色不能支付封印额外费用；被效果封印视作死亡，在场上发动死亡能力后回拥有者备牌。其他非指示物执行封印动作后，即使不留在封印区仍算支付费用。', '结附在场且能力生效；目标离场或不合法立即入拥有者墓地，明确离场回收按卡文。', '进场监听包含符合条件的来源自身，只有其他排除。', '角色与暗藏者互相翻面时原对象视作离场，所有指示物标志移除；秘密计划翻正面不视作离场。', '地区结算时，宿主与地区上结附牌一起直接回拥有者牌库底，附属不经过墓地；封印牌仍先规则解除封印回手。', '赢取地区后回底规则能力立即入堆叠；赢取触发和快速响应在它之前结算，回底时由拥有者决定顺序。', '角色/附属双类别同时满足两种类别的检查；道途复数同样要求规则牺牲。', '地区时间标志数为地区中角色与附属的时间标志总和，双类别只计一次。', '秘社转变保留同一对象、横置状态、标志、封印和结附；切换秘社重置横置状态，二者分别处理。', '同一触发轮由当前步骤行动优先权玩家先批量选择是否发动、目标与入栈顺序，另一玩家随后处理；新诱发能力在下一轮选择，先入栈后结算。', '转化形态标记token，默认不能加入初始牌组；转化保持同一实体对象及全部状态、标志，实体牌不继承模板token身份，离场恢复原卡面。具体转化能力逐张接入。', '世界只替代非指示物进入本方资产区，原牌回其拥有者牌库底，小世界归资产区一方并保持横置状态。', "玛格纳姆仅在卡牌或能力效果放置进场时触发检索；正常打出、付费翻面与效果翻面均不触发该检索。"] };
}
