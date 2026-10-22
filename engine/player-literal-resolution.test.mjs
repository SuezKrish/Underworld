import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture, put, cmd, resolve, emitWithChoices} from './test-fixture.mjs';
import {moveCard, viewFor} from './match.mjs';
import {coreRoles} from './shoggoth-rules.mjs';
import {hasBarrier} from './derived.mjs';
import {effectiveDefense} from './rounds.mjs';

const field=(s,code,p=0)=>put(s,code,p,'play',{controller:p,district:0,tapped:false});
function fire(s,id){
 const a=s.triggerChoices.find(a=>a.cardId===id);
 assert.ok(a,'应提供卡面上的触发能力');
 cmd(s,a.controller,{type:'trigger-choice',triggerId:a.id,fire:true,targetIds:[]});
}

test('蒙古死亡蠕虫闪烁后成为新对象，仍会受到旧潜伏触发的一点伤害并死亡',()=>{
 const s=fixture(),worm=field(s,'JC054'),other=field(s,'JC125',1),blink=put(s,'JZ05');
 s.cards[other].defense=10;
 cmd(s,0,{type:'play',cardId:blink,targetIds:[worm]});
 resolve(s);
 assert.equal(s.locations[worm].faceDown,false);
 assert.ok(s.flow.stack.some(a=>a.cardId===worm&&a.event==='conceal'));
 resolve(s);
 assert.equal(s.locations[worm].zone,'graveyard');
 assert.equal(s.locations[other].damage,1);
});

test('终焉的诗寇蒂旧进场能力中的“其他”不排除已经离场重入的新对象',()=>{
 for(const reenter of [false,true]){
  const s=fixture(),source=field(s,'JC052'),other=field(s,'JC125',1);
  emitWithChoices(s,source,'entry');
  fire(s,source);
  if(reenter){moveCard(s,source,'hand');moveCard(s,source,'play',{controller:0,district:0,tapped:false});}
  resolve(s);
  assert.equal(s.locations[other].zone,'graveyard');
  assert.equal(s.locations[source].zone,reenter?'graveyard':'play');
 }
});

test('皓月歌者旧进场能力的“其他”按对象区分；新进场的歌者可以获得屏障',()=>{
 for(const reenter of [false,true]){
  const s=fixture(),source=field(s,'WM012'),other=field(s,'WM012');
  s.players[0].markers.exposed=0;
  emitWithChoices(s,source,'entry');
  fire(s,source);
  if(reenter){moveCard(s,source,'hand');moveCard(s,source,'play',{controller:0,district:0,tapped:false});}
  resolve(s);
  assert.ok(s.effects.some(e=>e.kind==='barrier'&&e.targetId===other));
  assert.equal(s.effects.some(e=>e.kind==='barrier'&&e.targetId===source),reenter);
 }
});

function multipleCores(){
 const s=fixture(),original=field(s,'BQ045'),spike=field(s,'JC125'),temporary=field(s,'XG01'),enemy=field(s,'JC125',1);
 s.selectedCoreIds=[original,null];
 s.locations[temporary].markers=1;s.cards[temporary].subtypes.push('核心');
 s.locations[enemy].markers=1;
 s.locations[original].tapped=true;
 s.locations[temporary].tapped=true;
 assert.deepEqual(coreRoles(s,0),[original,temporary]);
 return {s,original,spike,temporary,enemy};
}

for(const [code,mode,operation] of [['BQ048','reset','knife'],['BQ060','shield','shield'],['BH31','protect','protect'],['BQ067',null,'barrier']]){
 test(`${code}未写“目标”的核心增益不指定目标，并作用于结算时的全部核心`,()=>{
  const {s,original,temporary,enemy}=multipleCores();
  const book=field(s,'CQ22');
  s.cards[book].attachment={watch:[{event:'targeted',hostSubject:true,transactionOnly:true,target:'none',effect:'draw',count:1}]};
  s.cards[book].automation=s.cards[book].attachment;
  s.locations[book].attachedTo=original;s.locations[book].hostVersion=s.locations[original].zoneVersion;
  let id;
  if(code==='BQ067'){
   id=field(s,code);s.locations[id].attachedTo='society:0';s.locations[id].hostVersion=0;
   s.players[0].honor=1;cmd(s,0,{type:'activate',cardId:id,targetIds:[]});
  }else{id=put(s,code);cmd(s,0,{type:'play',cardId:id,mode,targetIds:[]});}
  assert.deepEqual(s.flow.stack.find(a=>a.cardId===id).targets,[]);
  assert.ok(!s.triggerChoices.some(a=>a.cardId===book),'不能触发成为事务目标的抄本');
  const late=field(s,'JC125');s.locations[late].markers=1;s.cards[late].subtypes.push('核心');
  resolve(s);
  for(const core of [original,temporary,late]){
   if(operation==='knife'){assert.equal(s.locations[core].tapped,false);assert.equal(s.locations[core].counters.battle,1);}
   if(operation==='shield')assert.equal(s.locations[core].counters.shield,1);
   if(operation==='protect'||operation==='barrier')assert.ok(hasBarrier(s,core));
  }
  assert.ok(!s.locations[enemy].counters?.shield);
  assert.ok(!hasBarrier(s,enemy));
 });
}

for(const mode of ['move','defense'])test(`基础测试${mode}结算时作用于全部核心；防御项只抓一张牌`,()=>{
 const {s,original,temporary}=multipleCores(),id=put(s,'BQ109'),before=s.players[0].hand.length;
 const defense=[original,temporary].map(id=>effectiveDefense(s,id));
 cmd(s,0,{type:'play',cardId:id,mode,targetIds:mode==='move'?['district:1']:[]});
 resolve(s);
 assert.equal(s.effectChoice,null);
 for(const [i,core] of [original,temporary].entries()){
  if(mode==='move'){assert.equal(s.locations[core].tapped,false);assert.equal(s.locations[core].district,1);}
  else assert.equal(effectiveDefense(s,core),defense[i]+1);
 }
 if(mode==='defense')assert.equal(s.players[0].hand.length,before);
});

test('决绝的士官准备触发已入栈，来源离场仍移除失控并允许抓牌',()=>{
 const s=fixture(),id=field(s,'BH27');
 s.societyStates=[{counters:{失控:2}},{counters:{}}];
 emitWithChoices(s,id,'prepare');s.flow.locked=true;cmd(s,0,{type:'resume-window'});
 moveCard(s,id,'hand');
 resolve(s);
 assert.equal(s.societyStates[0].counters.失控,1);
 assert.equal(s.effectChoice.kind,'shoggoth-draw-optional');
 const before=s.players[0].hand.length;
 cmd(s,0,{type:'effect-choice',choiceId:s.effectChoice.id,draw:true});
 assert.equal(s.players[0].hand.length,before+1);
 assert.equal(s.locations[id].wounds,undefined);
});

test('思维同步仪锁定与抓牌是独立部分，原宿主离场仍抓一张牌',()=>{
 const s=fixture(),host=field(s,'JC125',1),id=field(s,'BH34');
 s.locations[id].attachedTo=host;s.locations[id].hostVersion=1;
 emitWithChoices(s,id,'entry');
 const a=s.triggerChoices.find(a=>a.cardId===id);
 cmd(s,0,{type:'trigger-choice',triggerId:a.id,fire:true,mode:'lock',targetIds:[]});
 moveCard(s,host,'hand');
 const before=s.players[0].hand.length;
 resolve(s);
 assert.equal(s.players[0].hand.length,before+1);
});

test('计划修格斯达成推进后的触发不因来源提前离场而取消放置核心',()=>{
 const s=fixture(),id=field(s,'BQ065'),core=field(s,'BQ043');
 s.players[0].core??=[];s.selectedCoreIds=[core,null];
 moveCard(s,core,'core',{corePlayer:0});
 s.locations[id].attachedTo='society:0';s.locations[id].hostVersion=0;s.locations[id].secretPlan=true;
 for(let i=0;i<s.cards[core].printedCost;i++){
  cmd(s,0,{type:'activate',cardId:id,actionIndex:0,targetIds:[]});resolve(s);
 }
 const a=s.triggerChoices.find(a=>a.cardId===id);
 assert.ok(a);
 cmd(s,0,{type:'trigger-choice',triggerId:a.id,fire:true,targetIds:['district:1']});
 moveCard(s,id,'hand');resolve(s);
 assert.equal(s.locations[core].zone,'play');assert.equal(s.locations[core].district,1);
});
