import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCatalog,applyRulings} from './catalog.mjs';
import {applyMetadata} from './metadata.mjs';
import {compileSupported} from './automation.mjs';
import {compileEnvironment} from './environment-definitions.mjs';
import {createRoomState,joinSeat,command,viewFor} from './match.mjs';
import {serializeRoomState,deserializeRoomState} from './room-storage.mjs';
const cards=parseCatalog(applyMetadata(applyRulings(readFileSync(new URL('../data/Card.xml',import.meta.url),'utf8')))).cards;
const defs=compileSupported(cards),env=compileEnvironment(cards);
const cmd=(s,p,c)=>command(s,p,{id:crypto.randomUUID(),...c});
function start(t,societies=['MSJC09','MSJC09']){
 t.mock.method(crypto,'getRandomValues',a=>{a.fill(0);return a;});
 const world=['DQ14','DQ18','DQ22'],districts=env.filter(c=>c.type==='district'),rest=districts.filter(c=>!world.includes(c.catalogId));
 const order=[rest.pop(),...world.map(id=>districts.find(c=>c.catalogId===id)),...rest];
 const s=createRoomState('甲','a','automation-play',defs,defs.filter(c=>c.token),[...env.filter(c=>c.type==='society'),...order]);
 s.labSocietyIds=societies;joinSeat(s,'乙','b');cmd(s,0,{type:'ready'});cmd(s,1,{type:'ready'});return s;
}
const chooseSearch=(s,p,fail=false)=>{const v=viewFor(s,p),a=v.environmentChoice;assert.ok(a.allowed);const id=a.cards[0]?.id;cmd(s,p,{type:'environment-choice',choiceId:a.id,cardIds:fail?[]:[id]});return id;};
for(const societies of [['MSBQ01','MSBQ01'],['MSBQ01','MSWM03'],['MSWM03','MSBQ01'],['MSBQ01','MSJC09']])test(`开局检索各自遵守去向：${societies.join('/')}`,t=>{
 let s=start(t,societies);const selected=[];
 if(s.effectChoice.simultaneous){
  selected[1]=chooseSearch(s,1);assert.equal(s.locations[selected[1]].zone,'deck');assert.deepEqual(s.players.map(p=>p.hand.length),[0,0]);
  s=deserializeRoomState(serializeRoomState(s));selected[0]=chooseSearch(s,0);
 }else selected[0]=chooseSearch(s,0);
 for(const [p,id]of selected.entries())if(id){
  if(societies[p]==='MSBQ01'){
   assert.equal(s.cards[id].name,'鲜血');assert.equal(s.locations[id].zone,'sealed');assert.equal(s.locations[id].hostId,`society:${p}`);
   assert.ok(!s.players[p].hand.includes(id));assert.ok(viewFor(s,1-p).sealed.some(c=>c.id===id&&c.hostId===`society:${p}`));
  }else{assert.equal(s.cards[id].name,'黑市');assert.equal(s.locations[id].zone,'hand');assert.ok(s.players[p].hand.includes(id));}
 }
 assert.equal(s.turn.step,'mulligan');assert.deepEqual(s.players.map(p=>p.hand.length),[6,6]);assert.equal(s.flow.stack.length,0);
});
test('龙之欢宴可检索失败，另一方的开局封印仍正常执行',t=>{
 const s=start(t,['MSBQ01','MSBQ01']);chooseSearch(s,0,true);const id=chooseSearch(s,1);assert.equal(s.locations[id].zone,'sealed');assert.equal(s.locations[id].hostId,'society:1');assert.deepEqual(s.players.map(p=>p.hand.length),[6,6]);
});
for(const first of [0,1])test(`调度由座位${first}先提交也不提前移动牌或公开张数，重载后一起执行`,t=>{
 let s=start(t),second=1-first;const hands=s.players.map(p=>[...p.hand]),decks=s.players.map(p=>[...p.deck]),ids=hands[first].slice(0,3),logStart=s.logs.length;
 cmd(s,first,{type:'mulligan',cardIds:ids});
 assert.deepEqual(s.players.map(p=>p.hand),hands);assert.deepEqual(s.players.map(p=>p.deck),decks);assert.ok(ids.every(id=>s.locations[id].zone==='hand'));
 const v=viewFor(s,second);assert.equal(v.players[first].handCount,hands[first].length);assert.equal(v.players[first].deckCount,decks[first].length);assert.deepEqual(v.players[first].aside,[]);
 assert.deepEqual(v.logs.slice(logStart).map(l=>l.text),[`${s.seats[first].name}已锁定起始手牌选择。`]);assert.ok(!JSON.stringify(v).includes('mulliganSelections'));
 assert.equal(v.ownMulliganDone,false);assert.equal(viewFor(s,first).ownMulliganDone,true);assert.equal(s.flow.locked,true);
 assert.throws(()=>cmd(s,first,{type:'mulligan',cardIds:[]}),/一次/);
 s=deserializeRoomState(serializeRoomState(s));cmd(s,second,{type:'mulligan',cardIds:hands[second].slice(0,1)});
 assert.equal(s.mulliganSelections,undefined);assert.equal(s.turn.step,'prepare');assert.ok(ids.every(id=>!s.players[first].hand.includes(id)&&s.locations[id].zone==='deck'));
 assert.equal(s.players[first].hand.length,hands[first].length);assert.equal(s.players[second].hand.length,hands[second].length);
 assert.ok(s.logs.some(l=>l.text===`${s.seats[first].name}完成再调度（3张）。`));assert.ok(s.logs.some(l=>l.text===`${s.seats[second].name}完成再调度（1张）。`));
});
test('保留零张调度与调度多张在双方完成前使用相同的公开日志',t=>{
 const s=start(t),empty=structuredClone(s),many=structuredClone(s),logStart=s.logs.length;
 cmd(empty,0,{type:'mulligan',cardIds:[]});cmd(many,0,{type:'mulligan',cardIds:many.players[0].hand.slice(0,4)});
 assert.deepEqual(viewFor(empty,1).logs.slice(logStart).map(l=>l.text),viewFor(many,1).logs.slice(logStart).map(l=>l.text));
 assert.deepEqual(empty.players.map(p=>p.hand),many.players.map(p=>p.hand));assert.deepEqual(empty.players.map(p=>p.deck),many.players.map(p=>p.deck));
});
