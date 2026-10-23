import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,put,cmd,resolve} from './test-fixture.mjs';
import {viewFor,moveCard} from './match.mjs';
import {botCommands} from './bot-policy.mjs';
import {hardBotView,hardBotCommands,hardLibraryWeights} from './hard-bot-policy.mjs';
import {readFileSync} from 'node:fs';
import {offlineContext} from '../offline/service.mjs';
const env=offlineContext(readFileSync(new URL('../data/Card.xml',import.meta.url),'utf8')).environment;
function room(difficulty='normal',doom=true){
 const s=fixture();s.environmentCatalog=env;s.cardPoolTestMode=false;s.round=7;
 for(const p of [0,1]){
  for(const zone of ['hand','deck','play','graveyard','aside']){for(const id of s.players[p][zone]){delete s.cards[id];delete s.locations[id];}s.players[p][zone]=[];}
  s.players[p].assets=[];s.players[p].costPool=0;s.players[p].actionCounts={asset:1,secret:1};
  for(let i=0;i<28;i++)put(s,'JC125',p,'deck');
 }
 for(let i=0;i<5;i++)moveCard(s,put(s,'BH25'),'asset',{controller:0,tapped:true});s.players[0].costPool=7;
 s.bot={id:'red-monastery',seat:0,difficulty,actionKeys:[],libraryKnown:{}};
 s.societies=[doom?'MSJZ03':'MSCQ02','MSLC04'].map((code,p)=>({...structuredClone(env.find(c=>c.catalogId===code)),id:`society:${p}`,owner:p}));
 s.societyStates=[0,1].map(()=>({tapped:false,counters:{},uses:{}}));
 for(const p of [0,1]){s.cards[`society:${p}`]=s.societies[p];s.locations[`society:${p}`]={zone:'society',zoneVersion:1,controller:p};}
 for(const d of s.districts){d.plan={};delete d.winTrigger;d.influence=[0,0];d.threshold=99;d.traits=[];d.destroyed=1;}
 return s;
}
const pick=s=>s.bot.difficulty==='hard'?hardBotCommands(s,hardBotView(s,viewFor)):botCommands(viewFor(s,0));
for(const difficulty of ['normal','hard']){
 test(`${difficulty}: 末日钟以不能打出的雨果生成祭司，费用充足也不空过`,()=>{
  const s=room(difficulty),hugo=put(s,'BH23'),a=pick(s)[0];
  assert.equal(viewFor(s,0).players[0].hand[0].castAllowed,false);
  assert.equal(a.type,'society-action');assert.equal(a.abilityId,'priest');assert.deepEqual(a.discardIds,[hugo]);cmd(s,0,a);resolve(s);
  assert.equal(s.locations[hugo].zone,'graveyard');assert.equal(s.players[0].play.filter(id=>s.cards[id].catalogId==='TK009').length,1);assert.ok(s.societyStates[0].tapped);
  assert.ok(!pick(s).some(c=>c.type==='society-action'));
 });
 test(`${difficulty}: 末日钟放第四个时间毁灭可争夺地区，不给敌方角色标志`,()=>{
  const s=room(difficulty);s.districts[0].destroyed=0;s.districts[0].counters={time:3};
  put(s,'JC045',1,'play',{controller:1,district:0,tapped:false});
  const a=pick(s)[0];assert.equal(a.abilityId,'time');assert.deepEqual(a.targetIds,['district:0']);cmd(s,0,a);resolve(s);assert.equal(s.districts[0].destroyed,1);
 });
 test(`${difficulty}: 已毁灭地区给本方祭司时间转势力，不浪费在地区上`,()=>{
  const s=room(difficulty),id=put(s,'TK009',0,'play',{controller:0,district:1,tapped:false});
  const a=pick(s)[0];assert.equal(a.abilityId,'time');assert.deepEqual(a.targetIds,[id]);cmd(s,0,a);resolve(s);
  const card=viewFor(s,0).players[0].play.find(c=>c.id===id);assert.equal(card.effectiveIcons.influence,1);
 });
 test(`${difficulty}: 三费回合先牺牲信徒减费时间流，再为朽灭者取得地区减费`,()=>{
  const s=room(difficulty,false);s.round=3;s.players[0].costPool=3;for(const d of s.districts)d.destroyed=0;s.districts[2].destroyed=1;
  const cult=put(s,'JC042',0,'play',{controller:0,district:2,tapped:false});put(s,'XG36',0,'play',{controller:0,district:2,tapped:false});
  const flow=put(s,'BH24'),wither=put(s,'XG14');put(s,'JZ42');
  const a=pick(s)[0];assert.equal(a.type,'activate');assert.equal(a.cardId,cult);cmd(s,0,a);resolve(s);
  const b=pick(s)[0];assert.equal(b.type,'play');assert.equal(b.cardId,flow);assert.ok(!b.targetIds.includes(cult));assert.equal(viewFor(s,0).castingCosts[flow],0);assert.equal(viewFor(s,0).castingCosts[wither],0);
 });
}
test('困难取牌：切换后可打出的灾难优于不能打出的原有引擎；重复取牌价值降低',()=>{
 const s=room('hard');put(s,'BH23');put(s,'XG14',0,'play',{controller:0,district:1,tapped:false});
 const ids=Object.fromEntries(['JZ32','WM033','JC045','XG14','CQ12','BQ047'].map(code=>[code,put(s,code,0,'deck')]));
 let weights=hardLibraryWeights(s,{kind:'hand'},viewFor);
 for(const code of ['JZ32','WM033','JC045'])assert.ok(weights[ids.XG14]>weights[ids[code]],code);
 assert.ok(weights[ids.CQ12]>weights[ids.WM033]);
 const before=weights[ids.XG14];put(s,'XG14');weights=hardLibraryWeights(s,{kind:'hand'},viewFor);assert.ok(weights[ids.XG14]<before);
});

for(const difficulty of ['normal','hard'])test(`${difficulty}: 时间流隐秘对抗保留可零费跟进的朽灭者`,()=>{
 const s=room(difficulty,false);s.round=3;s.players[0].costPool=3;s.districts[0].destroyed=0;s.districts[1].destroyed=0;
 const cult=put(s,'JC042',0,'play',{controller:0,district:2,tapped:false}),hunter=put(s,'XG36',0,'play',{controller:0,district:2,tapped:false});
 const flow=put(s,'BH24'),wither=put(s,'XG14'),bid=put(s,'JZ42'),foe=put(s,'JC125',1);
 cmd(s,0,pick(s)[0]);resolve(s);assert.equal(s.locations[cult].zone,'graveyard');
 const play=pick(s)[0];assert.equal(play.cardId,flow);cmd(s,0,play);resolve(s);
 assert.equal(s.hidden.step,2);const select=pick(s)[0];assert.equal(select.type,'select-hidden');assert.notEqual(select.cardId,wither);assert.equal(select.cardId,bid);
 cmd(s,0,select);cmd(s,1,{type:'select-hidden',cardId:foe});assert.equal(s.locations[wither].zone,'hand');cmd(s,0,{type:'hidden-reward',reward:'hidden'});assert.equal(viewFor(s,0).castingCosts[wither],0);
});
