import { hardDeckCards } from './hard-bot-library.mjs';
import { uuid } from './random.mjs';
export const contactSources = () => [];
export function beginContactReward(s, p, margin, remaining, log) { const ids = hardDeckCards(s, p, margin, { kind: 'hand' }); s.roundChoice = { id: uuid(), kind: 'investigation', controller: p, cardIds: ids, echoes: [] }; log(s, s.seats[p].name + '赢得调查：检视牌库顶' + ids.length + '张，调整顺序后抓1张牌。'); }
export function chooseContactReward() { throw Error('当前没有待处理的检索'); }
