import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,put,cmd,resolve} from './test-fixture.mjs';
import {viewFor} from './match.mjs';
import {botCommands} from './bot-policy.mjs';
import {hardBotView,hardBotCommands} from './hard-bot-policy.mjs';
import {openingBlackBladeRisk} from './bot-opening-safety.mjs';

function room(profile,difficulty,color='绿'){
 const s=fixture();for(const p of [0,1]){
  for(const zone of ['hand','deck','play','graveyard']){for(const id of s.players[p][zone]){delete s.cards[id];delete s.locations[id];}s.players[p][zone]=[];}
  s.players[p].assets=[];s.players[p].costPool=0;for(let i=0;i<30;i++)put(s,'JC078',p,'deck');
 }
 s.bot={id:profile,seat:0,difficulty,actionKeys:[],libraryKnown:{}};s.round=1;s.players[0].costPool=1;s.players[0].ignoreLoyalty=true;s.players[0].actionCounts={asset:1,secret:0};
 s.turn={...s.turn,phase:'action',step:'first-action',firstPlayer:0,actionClosed:false};s.flow={...s.flow,priority:0,stepOwner:0,locked:false,stack:[],passed:[]};
 s.societies=['白',color].map((faction,p)=>({id:`society:${p}`,catalogId:`test:${p}`,name:'测试秘社',text:'',type:'society',owner:p,faction,plan:{},traits:[]}));s.societyStates=[0,1].map(()=>({tapped:false,counters:{},uses:{}}));
 for(const [p,c]of s.societies.entries()){s.cards[c.id]=c;s.locations[c.id]={zone:'society',zoneVersion:0,controller:p};}
 for(const d of s.districts){d.plan={};d.threshold=99;d.influence=[0,0];}
 const matuta=put(s,'XG22');for(let i=0;i<3;i++)put(s,'JC078');return {s,matuta};
}
const see=s=>s.bot.difficulty==='hard'?hardBotView(s,viewFor):viewFor(s,0);
const choose=s=>{const v=see(s);return s.bot.difficulty==='hard'?hardBotCommands(s,v)[0]:botCommands(v)[0];};

for(const profile of ['white-anglican','yellow-white-spells']){
 for(const color of ['黑','红','绿','蓝','白','黄','灰','紫'])test(`${profile} 标准：先手开局按对手${color}色秘社判断是否暗藏马图塔`,()=>{
  const {s,matuta}=room(profile,'normal',`${color}·测试派系`),c=choose(s),risk=['黑','红','绿','蓝'].includes(color);
  assert.equal(c.cardId,matuta);assert.equal(c.type,risk?'secret-deploy':'play');cmd(s,0,c);if(!risk)resolve(s);
  assert.equal(!!s.locations[matuta].faceDown,risk);
 });
 for(const color of ['绿','白'])for(const threat of [true,false])test(`${profile} 困难：面对${color}色秘社按已知手牌${threat?'有':'没有'}一费黑刀决定`,()=>{
  const {s,matuta}=room(profile,'hard',color);put(s,threat?'BH07':'BQ069',1);put(s,'BQ020',1);
  const c=choose(s);assert.equal(c.cardId,matuta);assert.equal(c.type,threat?'secret-deploy':'play');cmd(s,0,c);if(!threat)resolve(s);assert.equal(!!s.locations[matuta].faceDown,threat);
 });
 test(`${profile} 标准：改变未知手牌及牌库顺序不改变开局选择`,()=>{
  const {s}=room(profile,'normal','绿'),knife=put(s,'BH07',1);put(s,'BQ020',1);const first=choose(s);
  s.cards[knife].icons={battle:0};s.cards[knife].printedCost=9;s.players[1].deck.reverse();assert.deepEqual(choose(s),first);
  s.societies[1].faction='白';const safe=choose(s);s.cards[knife].icons={battle:99};s.cards[knife].printedCost=1;assert.deepEqual(choose(s),safe);
 });
}
test('标准开局估计只读公开秘社，连隐藏手牌字段也不访问；支持混色秘社',()=>{
 const v={seat:0,round:1,bot:{difficulty:'normal'},turn:{phase:'action',firstPlayer:0},players:[{},{}],societies:[{faction:'白'},{faction:'白/黑·测试'}]};
 Object.defineProperty(v.players[1],'hand',{get(){throw Error('不可读取未知手牌');}});
 assert.equal(openingBlackBladeRisk(v),true);v.societies[1]={faction:'白黄'};assert.equal(openingBlackBladeRisk(v),false);
});
test('困难开局检查黑刀而不是白刀、高费身材或无法行动的迟缓角色',()=>{
 const v={seat:0,round:1,bot:{difficulty:'hard'},hardInfo:{},turn:{phase:'action',firstPlayer:0},players:[{},{hand:[]}],societies:[{faction:'白'},{faction:'绿'}]};
 for(const c of [
  {printedCost:1,icons:{battle:0},temporaryIcons:{battle:1}},
  {printedCost:2,icons:{battle:1}},
  {printedCost:1,icons:{battle:1},keywords:['迟缓']},
  {printedCost:1,icons:{battle:1},castAllowed:false},
  {printedCost:1,icons:{battle:1},concealedOnlyNow:true},
 ]){v.players[1].hand=[{type:'character',...c}];assert.equal(openingBlackBladeRisk(v),false);}
 v.players[1].hand=[{type:'character',printedCost:1,icons:{battle:1}}];assert.equal(openingBlackBladeRisk(v),true);
 v.turn.firstPlayer=1;assert.equal(openingBlackBladeRisk(v),false);v.turn.firstPlayer=0;v.round=2;assert.equal(openingBlackBladeRisk(v),false);
});
