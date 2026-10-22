import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,put,cmd,resolve} from './test-fixture.mjs';
import {viewFor} from './match.mjs';
import {cardHasKeyword} from './derived.mjs';

function giftBatch(codes,whaleCount=1){
 const s=fixture();
 for(const p of [0,1])for(const zone of ['hand','deck','play','graveyard']){
  for(const id of s.players[p][zone]){delete s.cards[id];delete s.locations[id];}
  s.players[p][zone]=[];
 }
 const whales=Array.from({length:whaleCount},()=>put(s,'JZ64',0,'play',{controller:0,district:0,tapped:false}));
 const host=put(s,'JC125',0,'play',{controller:0,district:0,tapped:false});
 // The hidden contest first moves the top card to hand. Keep the selected
 // cards below it, inside the gift's later seven-card inspection.
 put(s,'JC125',0,'deck');
 const selected=codes.map(code=>put(s,code,0,'deck'));
 for(const p of [0,1])for(let i=0;i<8;i++)put(s,'JC125',p,'deck');
 const bid=put(s,'JC125'),enemyBid=put(s,'JC125',1),gift=put(s,'BH51');
 s.cards[bid].printedCost=20;s.cards[enemyBid].printedCost=0;
 const spiritBefore=selected.map(id=>cardHasKeyword(s,id,'灵体'));
 cmd(s,0,{type:'play',cardId:gift,targetIds:[host]});resolve(s);
 cmd(s,0,{type:'select-hidden',cardId:bid});cmd(s,1,{type:'select-hidden',cardId:enemyBid});
 cmd(s,0,{type:'hidden-reward',reward:'none'});
 assert.equal(s.effectChoice.kind,'reverberation-gift');
 assert.ok(selected.every(id=>s.effectChoice.cardIds.includes(id)));
 cmd(s,0,{type:'effect-choice',choiceId:s.effectChoice.id,cardIds:selected});
 assert.ok(selected.every(id=>s.locations[id].zone==='sealed'&&s.locations[id].hostId===host));
 return {s,whales,selected,spiritBefore};
}

test('原初烈焰赠礼封印思绪水母与幽明生，仅水母提供幽灵鲸触发',()=>{
 const {s,whales:[whale],selected,spiritBefore}=giftBatch(['BH46','WM068']);
 assert.deepEqual(spiritBefore,[true,false]);
 const offered=viewFor(s,0).triggerRound.abilities.filter(a=>a.cardId===whale);
 assert.equal(offered.length,1);
 assert.equal(offered[0].plan.subjectId,selected[0]);
});

for(const whaleCount of [1,2])test(`原初烈焰赠礼同批封印两张印刷灵体牌，每个幽灵鲸各触发两次（${whaleCount}个鲸）`,()=>{
 const {s,whales,selected,spiritBefore}=giftBatch(['BH46','BH46'],whaleCount);
 assert.deepEqual(spiritBefore,[true,true]);
 const r=viewFor(s,0).triggerRound,offered=r.abilities.filter(a=>whales.includes(a.cardId));
 assert.equal(offered.length,whaleCount*2);
 for(const whale of whales)assert.deepEqual(new Set(offered.filter(a=>a.cardId===whale).map(a=>a.plan.subjectId)),new Set(selected));
 assert.equal(new Set(offered.map(a=>a.id)).size,offered.length);
 const bottom=s.players[0].deck.slice(-offered.length);
 cmd(s,0,{type:'trigger-round',roundId:r.id,decisions:r.abilities.filter(a=>!a.pending).map(a=>({triggerId:a.id,fire:whales.includes(a.cardId),targetIds:[]})),abilityIds:offered.map(a=>a.id)});
 assert.equal(s.flow.stack.filter(a=>whales.includes(a.cardId)).length,whaleCount*2);
 while(s.flow.stack.length)resolve(s);
 assert.ok(bottom.every(id=>s.locations[id].zone==='hand'));
});
