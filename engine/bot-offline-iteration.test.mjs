import test from 'node:test';
import assert from 'node:assert/strict';
import {endHandForecast,resourcePriorities} from './bot-resource-planning.mjs';
import {canFund} from './bot-dynamic-planning.mjs';
import {fixture,put,cmd,resolve} from './test-fixture.mjs';
import {viewFor} from './match.mjs';
import {botCommands} from './bot-policy.mjs';
import {hardBotView,hardBotCommands} from './hard-bot-policy.mjs';

function forecast(){
 const player=()=>({hand:[],play:[],graveyard:[],assets:[{tapped:false},{tapped:false},{tapped:false}],costPool:0,deckCount:30,handLimit:7,actionsUsed:{asset:true,secret:true},loyalty:{factions:{},domains:{}}});
 const v={seat:0,round:7,bot:{id:'yellow-white-spells'},players:[player(),player()],turn:{phase:'action',step:'first-action',firstPlayer:0},flow:{stepOwner:0,stack:[]},districts:[],sealed:[]};
 v.players[0].hand=Array.from({length:7},(_,i)=>({id:'c'+i,type:'event',printedCost:i<3?1:8,subtypes:['法术'],magicDomains:['心灵'],spell:{target:'none'}}));
 return v;
}
test('银钥发动后的法术补牌计入回合末手牌，不继续把满手牌局面视为缺牌',()=>{
 const v=forecast();assert.equal(endHandForecast(v).projected,4);
 v.players[0].play=[{automation:{watch:[{event:'cast',own:true,filter:{requireSubtype:'法术'},effect:'draw'}]}}];
 assert.equal(endHandForecast(v).projected,7);assert.equal(resourcePriorities(v).stocked,true);assert.equal(resourcePriorities(v).race,true);
 v.players[0].play[0].printedTextBlank=true;assert.equal(endHandForecast(v).projected,4);
});
test('补牌预测检查领域条件及牌库预算，不能将不满足条件的法术当作过牌',()=>{
 const v=forecast();v.players[0].play=[{automation:{watch:[{event:'cast',own:true,filter:{magic:'鲜血'},effect:'draw'}]}}];
 assert.equal(endHandForecast(v).income,0);
 v.players[0].play[0].automation.watch[0].filter={magic:'心灵'};v.players[0].deckCount=7;
 assert.equal(endHandForecast(v).income,1);
});
test('无法建立资产、公开以及目标不存在时，不虚构本回合能花掉的手牌',()=>{
 const v=forecast();v.players[0].actionsUsed={asset:false,secret:false};v.players[0].hand=[{id:'public',type:'character',printedCost:1,publicNow:true,nonAssetNow:true,castAllowed:false},{id:'target',type:'event',printedCost:0,nonAssetNow:true,spell:{target:'enemy-character'}}];v.spellTargets={target:[]};
 assert.equal(endHandForecast(v).spend,0);assert.equal(endHandForecast(v).projected,2);
});
test('主母的费用规划忽略自己的紫忠诚，仍检查血心星及非本方牌',()=>{
 const v=forecast();v.societies=[{plan:{ignorePurpleLoyalty:true}}];
 const c={id:'purple',owner:0,printedCost:2,loyalty:{紫:3,血:2}};
 assert.equal(canFund(v,c),false);v.players[0].loyalty.domains.鲜血=2;assert.equal(canFund(v,c),true);
 assert.equal(canFund(v,{...c,owner:1}),false);assert.equal(canFund(v,{...c,loyalty:{紫:3,心:1}}),false);
});
function room(profile){
 const s=fixture();for(const p of [0,1]){for(const z of ['hand','play','deck','graveyard']){for(const id of s.players[p][z]){delete s.cards[id];delete s.locations[id];}s.players[p][z]=[];}for(let i=0;i<24;i++)put(s,'JC125',p,'deck');}
 s.bot={id:profile,seat:0,difficulty:'normal',actionKeys:[]};s.players[0].actionCounts={asset:1,secret:1};s.round=5;
 for(const d of s.districts){d.plan={};d.influence=[0,0];d.threshold=99;d.destroyed=0;d.traits=[];}
 return s;
}
const field=(s,c,d=0,p=0)=>put(s,c,p,'play',{controller:p,district:d,tapped:false});
test('记分区已有三个毁灭地区时，雨果仍会毁灭新地区，恢复后续灾难减费',()=>{
 const s=room('red-monastery');s.players[0].scoreCards=[{destroyed:1},{destroyed:1},{destroyed:1}];
 const hugo=field(s,'BH23');s.locations[hugo].markers=4;s.turn={...s.turn,phase:'end',step:'end'};
 const c=botCommands(viewFor(s,0)).find(c=>c.type==='activate'&&c.cardId===hugo&&c.modes?.includes('destroy'));
 assert.ok(c);cmd(s,0,c);resolve(s);assert.equal(s.districts[0].destroyed,1);
});
test('鲜血奴仆在裁定官在场、无需等待弃牌时，转为附属补充手牌',()=>{
 const s=room('blue-dragon-feast'),slave=field(s,'JC028'),arbiter=field(s,'BQ030');
 s.turn={...s.turn,phase:'end',step:'end'};
 const c=botCommands(viewFor(s,0)).find(c=>c.type==='activate'&&c.cardId===slave);
 assert.ok(c);assert.deepEqual(c.targetIds,[arbiter]);cmd(s,0,c);resolve(s);
 assert.equal(s.locations[slave].attachedTo,arbiter);
});
test('鲜血奴仆保留一次结附给抓牌后弃牌，不为裁定官的一张牌提前消耗',()=>{
 const s=room('blue-dragon-feast'),slave=field(s,'JC028');field(s,'BQ030');field(s,'BQ031');put(s,'JC125',1);
 s.turn={...s.turn,phase:'end',step:'end'};
 assert.ok(!botCommands(viewFor(s,0)).some(c=>c.type==='activate'&&c.cardId===slave));
});
test('盖罗涅费用充足时可直接打出，不被永久偏好暗藏排除',()=>{
 const s=room('red-monastery');s.players[0].assets=[];s.players[0].costPool=5;s.players[0].ignoreLoyalty=true;
 const card=put(s,'CQ12'),c=botCommands(viewFor(s,0))[0];
 assert.equal(c.type,'play');assert.equal(c.cardId,card);cmd(s,0,c);resolve(s);assert.equal(s.locations[card].zone,'play');
});
test('盖罗涅可用两个已横置的邪教徒支付不足的两费，所有费用一次声明',()=>{
 const s=room('red-monastery');s.players[0].assets=[];s.players[0].costPool=3;s.players[0].ignoreLoyalty=true;
 const costs=[field(s,'TK008'),field(s,'TK008')];for(const id of costs)s.locations[id].tapped=true;
 const card=put(s,'CQ12'),c=botCommands(viewFor(s,0))[0];
 assert.equal(c.type,'play');assert.equal(c.cardId,card);assert.deepEqual(new Set(c.costIds),new Set(costs));
 cmd(s,0,c);assert.equal(s.players[0].costPool,0);assert.ok(costs.every(id=>!s.players[0].play.includes(id)));resolve(s);assert.equal(s.locations[card].zone,'play');
});
test('不会为盖罗涅减费而牺牲仍在运转的朽灭者或钟摆祭司',()=>{
 const s=room('red-monastery');s.players[0].assets=[];s.players[0].costPool=3;s.players[0].ignoreLoyalty=true;
 field(s,'XG14');field(s,'JC045');const card=put(s,'CQ12');
 assert.ok(!botCommands(viewFor(s,0)).some(c=>c.type==='play'&&c.cardId===card&&c.costIds?.length));
});
for(const profile of ['green-black-renown','black-purple-criminals'])for(const difficulty of ['normal','hard'])test(`${profile}/${difficulty}卡门已入堆叠等待翻面时，不再次提交专用抢附属翻面`,()=>{
 const s=room(profile);s.bot.difficulty=difficulty;s.bot.libraryKnown={};s.players[0].costPool=12;
 const carmen=field(s,'CQ24');s.locations[carmen].faceDown=true;s.locations[carmen].hiddenHandle='waiting-carmen';
 const attachment=field(s,'BQ091',1,1);s.locations[attachment].attachedTo=`district-host:${s.districts[1].id}`;s.locations[attachment].hostVersion=s.districts[1].id;
 s.turn={...s.turn,phase:'end',step:'end'};
 const choose=()=>difficulty==='hard'?hardBotCommands(s,hardBotView(s,viewFor)):botCommands(viewFor(s,0));
 assert.ok(choose().some(c=>c.type==='reveal'&&c.cardId===carmen));
 cmd(s,0,{type:'reveal',cardId:carmen,payOptionalExtra:true});s.flow.priority=0;
 assert.ok(s.flow.stack.some(a=>a.kind==='reveal-character'&&a.cardId===carmen));
 assert.ok(!choose().some(c=>c.type==='reveal'&&c.cardId===carmen));
});
