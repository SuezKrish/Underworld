import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,put,cmd,resolve} from './test-fixture.mjs';
import {viewFor} from './match.mjs';
import {botCommands} from './bot-policy.mjs';
import {hardBotView} from './hard-bot-policy.mjs';
import {getBotProfile} from './bot-deck.mjs';
const field=(s,code,p=0,d=0,extra={})=>put(s,code,p,'play',{controller:p,district:d,tapped:false,...extra});
function setup(id,difficulty='normal'){
 const s=fixture();s.bot={id,seat:0,difficulty,actionKeys:[],libraryKnown:{}};s.round=5;
 for(const p of [0,1]){for(const zone of ['hand','deck','play','graveyard','aside'])s.players[p][zone]=[];s.players[p].actionCounts={asset:1,secret:1};s.players[p].costPool=8;for(const a of s.players[p].assets)a.tapped=true;for(let i=0;i<12;i++)put(s,'JC125',p,'deck');}
 for(const d of s.districts){d.plan={};d.threshold=8;d.influence=[0,0];}
 return s;
}
const view=s=>s.bot.difficulty==='hard'?hardBotView(s,viewFor):viewFor(s,0);
test('新卡组均为50张：黄白两葬礼无茶叶，绿黑两卡门无临时收容所',()=>{
 const white=getBotProfile('yellow-white-spells').deck,green=getBotProfile('green-black-renown').deck;
 for(const d of [white,green])assert.equal(d.cards.reduce((n,c)=>n+c.count,0),50);
 assert.equal(white.cards.find(c=>c.cardId==='XQ49').count,2);assert.ok(!white.cards.some(c=>c.cardId==='WM090'));
 assert.equal(green.cards.find(c=>c.cardId==='CQ24').count,2);assert.ok(!green.cards.some(c=>c.cardId==='XG28'));assert.equal(green.name,'绿黑速攻（Bot）');assert.equal(green.cards.find(c=>c.cardId==='BH12').count,3);assert.ok(!green.cards.some(c=>c.cardId==='XQ36'));
});
for(const difficulty of ['normal','hard']){
 test(`${difficulty}葬礼实际响应毒药专家的进场触发，令其墓地目标结算失效`,()=>{
  const s=setup('yellow-white-spells',difficulty),funeral=put(s,'XQ49'),target=put(s,'WM060',1,'graveyard'),expert=put(s,'BQ082',1);
  s.players[0].costPool=1;s.players[1].ignoreLoyalty=true;s.flow.priority=1;s.flow.stepOwner=1;s.turn.firstPlayer=1;s.turn.step='first-action';
  cmd(s,1,{type:'play',cardId:expert,district:1});resolve(s);
  const a=s.triggerChoices.find(a=>a.cardId===expert);assert.ok(a);
  cmd(s,1,{type:'trigger-choice',triggerId:a.id,fire:true,targetIds:[target]});s.flow.priority=0;
  const v=view(s);assert.equal(v.flow.stack.at(-1).responseEffect.graveyardUse,true);
  const c=botCommands(v)[0];assert.equal(c.type,'play');assert.equal(c.cardId,funeral);assert.deepEqual(c.targetIds,[target]);
  cmd(s,0,c);resolve(s);assert.equal(s.locations[target].zone,'deck');assert.equal(s.players[1].deck.at(-1),target);
  resolve(s);assert.notEqual(s.locations[target].zone,'play');assert.equal(s.hidden,null);
 });
 test(`${difficulty}有轮回可洗墓地时，葬礼保留给即时干扰而非提前逐张洗敌方墓地`,()=>{
  const s=setup('yellow-white-spells',difficulty),funeral=put(s,'XQ49');put(s,'XQ02');
  field(s,'BQ082',1);put(s,'WM060',1,'graveyard');put(s,'CQ31',1,'graveyard');
  const candidates=botCommands(view(s));assert.ok(!candidates.some(c=>c.cardId===funeral));
 });
 test(`${difficulty}葬礼在牌库耗尽前回收最后轮回，实际抽回后可再补库`,()=>{
  const s=setup('yellow-white-spells',difficulty);s.players[0].deck=[];field(s,'XG01');const wheel=put(s,'XQ02',0,'graveyard'),funeral=put(s,'XQ49');
  const c=botCommands(view(s)).find(c=>c.cardId===funeral);assert.ok(c);assert.deepEqual(c.targetIds,[wheel]);cmd(s,0,c);resolve(s);
  assert.equal(s.locations[wheel].zone,'hand');assert.equal(s.locations[funeral].zone,'graveyard');assert.equal(s.status,'playing');assert.equal(s.triggerChoices.filter(a=>a.cardId===s.players[0].play[0]).length,0,'仪式不触发银钥');
  assert.ok(botCommands(view(s)).some(c=>c.cardId===wheel&&c.targetIds?.[0]==='player:0'));
 });
 test(`${difficulty}葬礼可在复活目标尚在墓地时响应移走，不提前拯救对手的空牌库`,()=>{
  const s=setup('yellow-white-spells',difficulty),funeral=put(s,'XQ49'),target=put(s,'CQ31',1,'graveyard');let v=view(s);
  v.flow.stack=[{id:'revive',kind:'auto-ability',controller:1,targetIds:[target]}];v.turn.standardAllowed=false;v.flow.priority=0;
  assert.ok(botCommands(v).some(c=>c.cardId===funeral&&c.targetIds?.[0]===target));v.flow.stack=[];v.turn.standardAllowed=true;v.players[1].deckCount=1;
  assert.ok(!botCommands(v).some(c=>c.cardId===funeral&&c.targetIds?.[0]===target));v.players[0].deckCount=0;v.flow.stack=[{id:'revive',kind:'auto-ability',controller:1,targetIds:[target]}];
  assert.ok(!botCommands(v).some(c=>c.cardId===funeral),'不能为了干扰而自己强制抓空');
 });
 test(`${difficulty}夜巡在高费敌方角色进场前移动暗藏黄雀，结算时选择正确相邻地区`,()=>{
  const s=setup('green-black-renown',difficulty),bird=field(s,'LC02',0,0,{faceDown:true,hiddenHandle:'finch'}),patrol=put(s,'BQ020'),incoming=put(s,'JC080',1);
  s.flow.priority=1;s.flow.stepOwner=1;s.turn.firstPlayer=1;cmd(s,1,{type:'play',cardId:incoming,district:1});s.flow.priority=0;
  const c=botCommands(view(s)).find(c=>c.cardId===patrol);assert.ok(c);assert.deepEqual(c.targetIds,['hidden:finch']);cmd(s,0,c);resolve(s);assert.equal(s.effectChoice.kind,'secrecy-batch-patrol');
  const choose=botCommands(view(s))[0];assert.equal(choose.cardId,'district:1');cmd(s,0,choose);assert.equal(s.locations[bird].district,1);assert.equal(s.locations[bird].faceDown,true);
  resolve(s);assert.ok(s.triggerChoices.some(a=>a.cardId===bird&&a.plan.operation==='source-direct-reveal'));
 });
 test(`${difficulty}势力对抗后或赢取前夜巡转移暗藏者，势力对抗尚未完成时不空放`,()=>{
  const s=setup('green-black-renown',difficulty),role=field(s,'LC02',0,0,{faceDown:true,hiddenHandle:'preserve'}),patrol=put(s,'BQ020');
  s.turn={...s.turn,phase:'contest',step:'contest-after',kind:'influence',district:0,standardAllowed:false};
  let v=view(s),c=botCommands(v).find(c=>c.cardId===patrol);assert.ok(c);assert.deepEqual(c.targetIds,['hidden:preserve']);
  s.turn.step='claim-before';assert.ok(botCommands(view(s)).some(c=>c.cardId===patrol));
  s.turn.step='contest-before';s.turn.kind='investigation';assert.ok(!botCommands(view(s)).some(c=>c.cardId===patrol));
 });
 test(`${difficulty}卡门评估四费抢附属；已有隐秘优势时不再多支付3`,()=>{
  const s=setup('green-black-renown',difficulty),carmen=put(s,'CQ24');field(s,'BQ091',1,0,{attachedTo:`district-host:${s.districts[0].id}`,hostVersion:s.districts[0].id});
  let c=botCommands(view(s)).find(c=>c.cardId===carmen&&c.payOptionalExtra);assert.ok(c);s.players[0].costPool=3;assert.ok(!botCommands(view(s)).some(c=>c.cardId===carmen&&c.payOptionalExtra));
  s.players[0].markers.hidden=1;c=botCommands(view(s)).find(c=>c.cardId===carmen&&!c.payOptionalExtra);assert.ok(c);
 });
}
for(const difficulty of ['normal','hard'])test(`${difficulty}第二回合秘密派遣接夜班员工；有宿主后优先结附，翻面前保留持续过牌`,()=>{
 const s=setup('green-black-renown',difficulty);s.round=2;s.players[0].costPool=2;s.players[0].actionCounts.secret=0;
 const host=put(s,'LC02'),employee=put(s,'BH12');put(s,'JC084');put(s,'JC086');
 const deploy=botCommands(view(s))[0];assert.equal(deploy.type,'secret-deploy');cmd(s,0,deploy);s.flow.priority=0;
 const attach=botCommands(view(s)).find(c=>c.type==='play'&&c.cardId===employee);assert.ok(attach);cmd(s,0,attach);resolve(s);
 assert.equal(s.locations[employee].attachedTo,deploy.cardId);assert.equal(s.locations[deploy.cardId].faceDown,true);assert.equal(s.cards[host].catalogId,'LC02');
});

for(const difficulty of ['normal','hard'])test(`${difficulty}夜班员工仍可过牌时不为普通图标提前翻面`,()=>{
 const s=setup('green-black-renown',difficulty),role=field(s,'LC02',0,0,{faceDown:true,hiddenHandle:'employee-host'});field(s,'BH12',0,0,{attachedTo:role,hostVersion:1});
 s.turn={...s.turn,phase:'contest',step:'contest-before',kind:'investigation',district:0};
 assert.ok(!botCommands(view(s)).some(c=>c.type==='reveal'&&c.cardId===role));s.turn.kind='battle';
 assert.ok(!botCommands(view(s)).some(c=>c.type==='reveal'&&c.cardId===role));
});
