import test from 'node:test';
import assert from 'node:assert/strict';
import {BOT_PROFILES} from './bot-deck.mjs';
import {botCommands} from './bot-policy.mjs';
import {hardBotView,hardBotCommands} from './hard-bot-policy.mjs';
import {libraryReserve} from './bot-resource-planning.mjs';
import {fixture,put,cmd,resolve} from './test-fixture.mjs';
import {viewFor} from './match.mjs';

const ability=(id,extra={})=>({id,kind:'auto-ability',controller:0,cardId:'draw-source',event:'sealed',plan:{target:'none',effect:'bottom-to-hand',count:1},targets:[],...extra});
function position(profile,difficulty){
 const player=()=>({hand:[{id:'hand',type:'character'}],handCount:1,handLimit:7,deckCount:40,assets:[],play:[],graveyard:[],markers:{hidden:0,exposed:0},actionsUsed:{asset:true,secret:true}});
 const v={seat:0,status:'playing',bot:{id:profile,seat:0,difficulty,actionKeys:[]},round:2,turn:{phase:'end',step:'end',firstPlayer:0,district:0},flow:{priority:0,stepOwner:0,locked:false,stack:[]},players:[player(),player()],districts:[0,1,2].map(i=>({id:`region:${i}`,threshold:99,influence:[0,0]})),pendingTriggers:[],triggerChoices:[],sealed:[],environmentTriggers:[]};
 v.players[0].deckCount=libraryReserve(v)+2;return v;
}
const choose=v=>v.bot.difficulty==='hard'?hardBotCommands({bot:v.bot,players:v.players},v)[0]:botCommands(v)[0];
const fires=c=>c.decisions.filter(d=>d.fire).length;
for(const profile of BOT_PROFILES)for(const difficulty of ['normal','hard']){
 test(`${profile.id} ${difficulty}：事件时批量发动计入已承诺待入栈的耗牌，不重复计入也不扣敌方预算`,()=>{
  const v=position(profile.id,difficulty),a=ability('committed');v.pendingTriggers=[a];
  v.deathCostChoice={id:'batch',kind:'trigger-cost-batch',controller:0,available:0,abilities:[ability('new-1'),ability('new-2'),ability('new-3')]};
  assert.equal(fires(choose(v)),1);
  v.flow.stack=[{...a,responseEffect:{libraryUse:1}}];assert.equal(fires(choose(v)),1,'同一条能力同时出现时不重复扣除');
  v.pendingTriggers=[{...a,controller:1}];v.flow.stack=[];assert.equal(fires(choose(v)),2,'敌方的补牌不占本方预算');
  v.pendingTriggers=[ability('committed-two',{plan:{target:'none',effect:'draw',count:2}})];
  v.deathCostChoice={id:'single',kind:'trigger-cost',controller:0,available:0,ability:ability('single-draw'),targetOptions:[]};
  assert.equal(choose(v).fire,false,'单条提前发动也计入先前承诺的耗牌');
  delete v.deathCostChoice;v.triggerRound={id:'round',controller:0,abilities:[ability('new-round')]};
  assert.equal(fires(choose(v)),0,'后续触发轮不重复花费已承诺的预算');
 });
 test(`${profile.id} ${difficulty}：同批强制耗牌先预留，剩余预算只供一个可选触发`,()=>{
  const v=position(profile.id,difficulty);
  v.deathCostChoice={id:'batch',kind:'trigger-cost-batch',controller:0,available:0,abilities:[ability('optional-1'),ability('mandatory',{mandatory:true}),ability('optional-2')]};
  const c=choose(v);assert.equal(c.decisions.find(d=>d.triggerId==='mandatory').fire,true);assert.equal(fires(c),2);
  v.players[0].deckCount=libraryReserve(v);assert.deepEqual(choose(v).decisions.map(d=>d.fire),[false,true,false]);
 });
}

function whaleRoom(difficulty,deckCount=23){
 const s=fixture({triggerTiming:'event'});for(const p of [0,1]){
  for(const zone of ['hand','deck','play','graveyard']){for(const id of s.players[p][zone]){delete s.cards[id];delete s.locations[id];}s.players[p][zone]=[];}
  s.players[p].assets=[];s.players[p].costPool=0;for(let i=0;i<(p===0?deckCount:25);i++)put(s,'JC125',p,'deck');
 }
 s.bot={id:'purple-matriarch',seat:0,difficulty,actionKeys:[],libraryKnown:{}};s.players[0].costPool=3;s.players[0].ignoreLoyalty=true;s.players[0].actionCounts={asset:1,secret:1};
 for(const d of s.districts){d.threshold=99;d.plan={};d.influence=[0,0];}
 const whales=Array.from({length:4},()=>put(s,'JZ64',0,'play',{controller:0,district:0,tapped:false}));
 const water=put(s,'BH46',0,'play',{controller:0,district:1,tapped:false,faceDown:true,hiddenHandle:'new-spirit'});for(let i=0;i<7;i++)put(s,'JC125');
 s.flow.stack=[ability('queued-draw',{cardId:whales[0],plan:{target:'none',effect:'bottom-to-hand',count:1,sourceId:whales[0]}})];
 cmd(s,0,{type:'reveal',cardId:water});resolve(s);return {s,whales,water};
}
for(const difficulty of ['normal','hard']){
 const project=s=>difficulty==='hard'?hardBotView(s,viewFor):viewFor(s,0);
 const pick=s=>{const v=project(s);return difficulty==='hard'?hardBotCommands(s,v)[0]:botCommands(v)[0];};
 test(`${difficulty}：当前事件时规则中四只幽灵鲸同时触发，只发动安全预算内的一次`,()=>{
  const {s,whales}=whaleRoom(difficulty);const v=project(s);assert.equal(v.players[0].deckCount,23);assert.equal(libraryReserve(v),17);
  assert.equal(v.deathCostChoice.kind,'trigger-cost-batch');assert.equal(v.deathCostChoice.abilities.length,4);
  const c=pick(s);assert.equal(fires(c),1);cmd(s,0,c);
  assert.equal(s.pendingTriggers.filter(a=>whales.includes(a.cardId)).length,1);
  // The water's own reveal trigger is offered after the four entry triggers.
  // It must also reserve the already accepted whale draw before sealing a top card.
  const next=pick(s);assert.equal(next.type,'trigger-cost-choice');assert.equal(next.fire,false);cmd(s,0,next);
  // Entering the next trigger round is ordering only: no second activation.
  const order=pick(s);assert.equal(order.type,'trigger-round');assert.deepEqual(order.decisions,[]);cmd(s,0,order);
  resolve(s);resolve(s);assert.equal(s.players[0].deck.length,21);assert.equal(s.status,'playing');
 });
 test(`${difficulty}：幽灵鲸牌库只有20张时保留多回合余量，牌库补充后重新允许补牌`,()=>{
  const {s}=whaleRoom(difficulty,20);assert.equal(fires(pick(s)),0);
  for(let i=0;i<3;i++)put(s,'JC125',0,'deck');assert.equal(fires(pick(s)),1);
 });
}
