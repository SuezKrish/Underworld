import test from 'node:test';import assert from 'node:assert/strict';
import {priorityStatusLabel} from './priority-status.mjs';
const room={status:'playing',seat:0,seats:[{name:'甲'},{name:'乙'}],turn:{phase:'action',step:'second-action'},flow:{priority:0,stepOwner:1,locked:false}};
test('行动步骤属于对手时仍可由玩家持有响应优先权，显示两者不混淆',()=>{
 assert.equal(priorityStatusLabel(room),'当前优先权：甲（你）');
 assert.equal(priorityStatusLabel({...room,flow:{...room.flow,priority:1}}),'当前优先权：乙');
});
test('同步、选择和关闭窗口时，不将残留priority误报为可行动',()=>{
 assert.equal(priorityStatusLabel(room,{busy:true}),'正在处理操作');
 assert.equal(priorityStatusLabel({...room,bot:{pending:true}}),'Bot思考中');
 assert.equal(priorityStatusLabel({...room,roundChoice:{controller:1}}),'等待乙完成选择');
 assert.equal(priorityStatusLabel(room,{locked:true}),'当前结算中 · 无快速行动优先权');
 assert.equal(priorityStatusLabel({...room,status:'finished'}),'对局结束');
 assert.equal(priorityStatusLabel({...room,turn:{step:'mulligan'}}),'双方选择起始手牌调度');
});
