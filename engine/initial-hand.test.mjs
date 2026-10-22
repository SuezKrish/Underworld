import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCatalog,applyRulings} from './catalog.mjs';
import {compileSupported} from './automation.mjs';
import {compileEnvironment,environmentStatus} from './environment-definitions.mjs';
import {createRoomState,joinSeat,command,viewFor} from './match.mjs';

const cards=parseCatalog(readFileSync(new URL('../data/Card.xml',import.meta.url),'utf8')).cards;
const defs=compileSupported(cards),env=compileEnvironment(cards);
const setupPool=defs;
const cmd=(s,p,c)=>command(s,p,{id:crypto.randomUUID(),...c});
function start(t,both=false){
 t.mock.method(crypto,'getRandomValues',a=>{a.fill(0);return a});
 const world=['DQ14','DQ18','DQ22'],districts=env.filter(c=>c.type==='district');
 const rest=districts.filter(c=>!world.includes(c.catalogId));
 const order=[rest.pop(),...world.map(id=>districts.find(c=>c.catalogId===id)),...rest];
 const s=createRoomState('甲','a','automation-play',setupPool,defs.filter(c=>c.token),[...env.filter(c=>c.type==='society'),...order]);
 s.labSocietyIds=['MSWM03',both?'MSWM03':'MSJC09'];joinSeat(s,'乙','b');
 cmd(s,0,{type:'ready'});cmd(s,1,{type:'ready'});return s;
}
function search(s,p,fail=false){
 const a=s.effectChoice,id=a.cardIds.find(id=>s.cards[id].name==='黑市');
 assert.equal(a.controller,p);assert.equal(a.mode,'search');assert.ok(id);
 cmd(s,p,{type:'environment-choice',choiceId:a.id,cardIds:fail?[]:[id]});return id;
}

test('冷山帮持续取黑市后仍抓5张，起手共6张且没有入栈触发',t=>{
 const s=start(t);assert.deepEqual(s.players.map(p=>p.hand.length),[0,0]);
 const before=s.players[0].deck.length,id=search(s,0);
 assert.equal(s.turn.step,'mulligan');assert.equal(s.players[0].hand.length,6);
 assert.ok(s.players[0].hand.includes(id));assert.equal(s.players[0].deck.length,before-6);
 assert.equal(s.players[1].hand.length,6);assert.equal(s.flow.stack.length,0);
 assert.ok(!s.pendingTriggers.length&&!s.triggerChoices.length);
});

test('额外加入的黑市可与起始抓牌一起再调度，替换后手牌仍为6张',t=>{
 const s=start(t),id=search(s,0),ordinary=s.players[0].hand.find(x=>x!==id);
 const selected=[id,ordinary],handBefore=[...s.players[0].hand];
 cmd(s,0,{type:'mulligan',cardIds:selected});
 assert.deepEqual(s.players[0].hand,handBefore);assert.ok(selected.every(id=>s.locations[id].zone==='hand'));
 assert.equal(viewFor(s,0,0,'HAND').ownMulliganDone,true);
 cmd(s,1,{type:'mulligan',cardIds:[]});
 assert.equal(s.players[0].hand.length,6);assert.ok(selected.every(id=>s.locations[id].zone==='deck'));
 assert.ok(selected.every(id=>!s.players[0].hand.includes(id)));
 assert.equal(s.players[0].hand.filter(id=>!handBefore.includes(id)).length,2);
 assert.equal(viewFor(s,0,0,'HAND').ownMulliganDone,true);
});

test('双方冷山帮各自额外取牌，全部开局选择完成后各抓5张',t=>{
 const s=start(t,true),a=search(s,0);assert.deepEqual(s.players.map(p=>p.hand.length),[0,0]);assert.equal(s.locations[a].zone,'deck');
 const b=search(s,1);assert.deepEqual(s.players.map(p=>p.hand.length),[6,6]);
 assert.ok(s.players[0].hand.includes(a));assert.ok(s.players[1].hand.includes(b));
 for(const p of [0,1])cmd(s,p,{type:'mulligan',cardIds:[p===0?a:b]});
 assert.deepEqual(s.players.map(p=>p.hand.length),[6,6]);
});

test('检索失败仍完整抓5张，固定卡池不执行历史文本迁移',t=>{const s=start(t);search(s,0,true);assert.equal(s.players[0].hand.length,5);const card=cards.find(c=>c.id==='MSWM03');assert.equal(environmentStatus(card).implemented,true);});
