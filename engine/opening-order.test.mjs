import test from 'node:test';import assert from 'node:assert/strict';
import {botOpeningFirstPlayer,chooseOpeningFirstPlayer} from './opening-order.mjs';
import {createRoomState,joinSeat,command,viewFor} from './match.mjs';import {serializeRoomState,deserializeRoomState} from './room-storage.mjs';
const act=(s,p,c)=>command(s,p,{id:crypto.randomUUID(),...c});
function ready(order){const s=createRoomState('玩家','p');s.openingFirstPlayer=botOpeningFirstPlayer(order,1);joinSeat(s,'Bot','b');act(s,0,{type:'ready'});act(s,1,{type:'ready'});return s;}
function nextRound(s){for(let n=0;n<100&&s.round===1;n++){assert.equal(s.roundChoice,null);assert.equal(s.triggerChoices.length,0);act(s,s.flow.priority,{type:'pass'});}assert.equal(s.round,2);}

test('随机为默认，玩家与Bot选项按座位映射，仅接收三种明确值',()=>{
 for(const seat of [0,1]){assert.equal(botOpeningFirstPlayer(undefined,seat),null);assert.equal(botOpeningFirstPlayer('random',seat),null);assert.equal(botOpeningFirstPlayer('bot',seat),seat);assert.equal(botOpeningFirstPlayer('player',seat),1-seat);}
 for(const invalid of [null,'',0,1,true,{},[],'first'])assert.throws(()=>botOpeningFirstPlayer(invalid),/先后手设置无效/);
});
test('固定选择不抽取随机数；旧房间与默认随机路径均使用安全随机数的奇偶',t=>{
 let calls=0,word=0;t.mock.method(crypto,'getRandomValues',a=>{calls++;a.fill(word);return a;});
 for(const first of [0,1])assert.equal(chooseOpeningFirstPlayer({openingFirstPlayer:first}),first);assert.equal(calls,0);
 for(const x of [0,1,2,3,0xfffffffe,0xffffffff]){word=x;assert.equal(chooseOpeningFirstPlayer({}),x%2);assert.equal(chooseOpeningFirstPlayer({openingFirstPlayer:null}),x%2);}
 assert.equal(calls,12);assert.throws(()=>chooseOpeningFirstPlayer({openingFirstPlayer:'0'}),/设置无效/);
});
for(const order of ['player','bot'])for(const commits of [[0,1],[1,0]])test(`${order}固定首回合，调度提交${commits.join('→')}、重载、后续轮换均正常`,()=>{
 let s=ready(order);const first=order==='player'?0:1;
 assert.equal(s.turn.firstPlayer,first);for(const seat of [0,1])assert.equal(viewFor(s,seat).turn.firstPlayer,first);
 act(s,commits[0],{type:'mulligan',cardIds:[]});assert.equal(s.turn.firstPlayer,first);
 s=deserializeRoomState(serializeRoomState(s));assert.equal(s.openingFirstPlayer,first);
 act(s,commits[1],{type:'mulligan',cardIds:[]});assert.equal(s.turn.firstPlayer,first);assert.equal(s.flow.priority,first);assert.equal(s.flow.stepOwner,first);
 nextRound(s);assert.equal(s.turn.firstPlayer,1-first);assert.equal(s.flow.priority,1-first);
});
for(const first of [0,1])test(`完整随机开局可选择座位${first}，不受创建者或调度提交顺序固定`,t=>{
 t.mock.method(crypto,'getRandomValues',a=>{a.fill(first);return a;});const s=ready('random');assert.equal(s.turn.firstPlayer,first);assert.equal(viewFor(s,1).turn.firstPlayer,first);t.mock.method(crypto,'getRandomValues',a=>{a.fill(1-first);return a;});act(s,0,{type:'mulligan',cardIds:[]});act(s,1,{type:'mulligan',cardIds:[]});assert.equal(s.turn.firstPlayer,first);assert.equal(s.flow.stepOwner,first);
});

test('公开卡池秘社开局确定固定先手，双方在调度前看到同一结果',async()=>{
 const {readFileSync}=await import('node:fs');
 const {parseCatalog}=await import('./catalog.mjs');
 const {compileSupported}=await import('./automation.mjs');
 const {compileEnvironment}=await import('./environment-definitions.mjs');
 const cards=parseCatalog(readFileSync(new URL('../data/Card.xml',import.meta.url),'utf8')).cards,defs=compileSupported(cards),env=compileEnvironment(cards);
 const s=createRoomState('甲','a','automation-play',defs,defs.filter(c=>c.token),env);
 s.labSocietyIds=['MSLC02','MSLC02'];s.openingFirstPlayer=1;
 joinSeat(s,'乙','b');act(s,0,{type:'ready'});act(s,1,{type:'ready'});
 assert.equal(s.turn.firstPlayer,1);assert.equal(s.turn.step,'mulligan');
 for(const p of [0,1])assert.equal(viewFor(s,p).turn.firstPlayer,1);
 assert.equal(s.turn.step,'mulligan');assert.equal(s.turn.firstPlayer,1);
 act(s,0,{type:'mulligan',cardIds:[]});act(s,1,{type:'mulligan',cardIds:[]});
 assert.equal(s.turn.firstPlayer,1);assert.equal(s.flow.priority,1);
});
