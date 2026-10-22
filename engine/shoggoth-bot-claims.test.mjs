import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,put,cmd,resolve,defs} from './test-fixture.mjs';
import {parseCatalog} from './catalog.mjs';
import {compileEnvironment} from './environment-definitions.mjs';
import {createAutomationEngine} from './automation.mjs';
import {moveCard,viewFor} from './match.mjs';
import {botCommands} from './bot-policy.mjs';
import {hardBotView,hardBotCommands,hardLibraryWeights} from './hard-bot-policy.mjs';
import {hasCardType} from './card-types.mjs';

const env=compileEnvironment(parseCatalog(readFileSync(new URL('../data/Card.xml',import.meta.url),'utf8')).cards);
function room(difficulty='normal',seat=0){
 const s=fixture();s.societies=[];s.societyStates=[];
 for(const p of [0,1]){
  s.players[p].hand=[];s.players[p].deck=[];s.players[p].assets=s.players[p].assets.slice(0,4);
  for(const [i,a] of s.players[p].assets.entries()){a.tapped=true;a.faction=i<3?'灰':'红';s.cards[a.id].faction=a.faction;}
  s.players[p].costPool=p===seat?6:0;s.players[p].actionCounts={asset:1,secret:1};
  const id=`society:${p}`;s.cards[id]=s.societies[p]={...structuredClone(env.find(c=>c.catalogId==='MSBQ02')),id,owner:p};
  s.locations[id]={zone:'society',zoneVersion:0,controller:p};s.societyStates[p]={tapped:false,counters:{},uses:{}};
  s.deckSelections[p]={core:defs.find(c=>c.catalogId==='BQ045'),choices:{coreId:'BQ045'}};
  for(let i=0;i<20;i++)put(s,'JC125',p,'deck');
 }
 createAutomationEngine({log(){}}).shoggothInitialize(s);
 for(const d of s.districts){d.threshold=99;d.influence=[0,0];d.plan??={};}
 s.round=4;s.turn={...s.turn,firstPlayer:seat,phase:'action',step:'first-action',actionClosed:false};
 s.flow={...s.flow,priority:seat,stepOwner:seat,passed:[],stack:[],locked:false};
 s.bot={id:'shoggoth-locking',seat,difficulty,actionKeys:[],libraryKnown:{}};return s;
}
const decisions=s=>s.bot.difficulty==='hard'?hardBotCommands(s,hardBotView(s,viewFor)):botCommands(viewFor(s,s.bot.seat));
function mission(s,code='BH59',owner=s.bot.seat){const id=put(s,code,owner);moveCard(s,id,'play',{controller:owner});const d=s.locations[id].district;s.districts[d].influence[owner]=s.districts[d].threshold-1;return {id,d};}
const field=(s,code,extra={})=>put(s,code,s.bot.seat,'play',{controller:s.bot.seat,district:0,tapped:false,...extra});
const samplePlays=(s,id)=>decisions(s).filter(c=>c.type==='play'&&c.cardId===id);
function advance(s,done){
 for(let i=0;i<90&&!done();i++){
  let advanced=false,lastError='';
  for(const p of [s.flow.priority??0,1-(s.flow.priority??0)]){
   const v=p===s.bot.seat&&s.bot.difficulty==='hard'?hardBotView(s,viewFor):viewFor(s,p);
   v.bot={...s.bot,seat:p,id:p===s.bot.seat?'shoggoth-locking':'white-anglican'};
   for(const c of p===s.bot.seat&&s.bot.difficulty==='hard'?hardBotCommands(s,v):botCommands(v)){
    const next=structuredClone(s);try{cmd(next,p,c);next.undoFrames=[];for(const key of Object.keys(s))delete s[key];Object.assign(s,next);advanced=true;break;}catch(e){if(e.name!=='RuleError')throw e;lastError=e.message;}
   }
   if(advanced)break;
  }
  assert.ok(advanced,`No legal continuation: ${s.turn.step}, ${lastError}`);
 }
 assert.ok(done(),'Expected claim/payment continuation');
}

for(const difficulty of ['normal','hard'])for(const seat of [0,1])for(const code of ['BQ109','BQ049'])test(`${difficulty}座位${seat}：${code}补最后一点，实际赢取藏身处并恢复行动步骤`,()=>{
 const s=room(difficulty,seat),{id,d}=mission(s),spell=put(s,code,seat);
 moveCard(s,s.selectedCoreIds[seat],'play',{controller:seat,district:d});
 put(s,'BQ112',seat);put(s,'BQ064',seat);put(s,'BH29',seat);
 s.players[seat].actionCounts.asset=0;s.societyStates[seat].counters.失控=2;
 const c=decisions(s)[0];assert.equal(c.type,'play');assert.equal(c.cardId,spell);
 assert.equal(c.mode,code==='BQ109'?'influence':'spawn');assert.deepEqual(c.targetIds,[`district:${d}`]);
 cmd(s,seat,c);advance(s,()=>s.players[seat].scoreCards.some(c=>c.id===id)&&s.turn.step==='first-action'&&!s.flow.locked&&!s.flow.stack.length);
 assert.equal(s.locations[id].zone,'score');assert.equal(viewFor(s,seat).turn.standardAllowed,true);
 assert.equal(s.societyStates[seat].counters.失控,code==='BQ049'?3:2);
 assert.ok(s.players[seat].hand.includes(s.selectedCoreIds[seat]),'藏身处赢取能力回收核心');
});

test('同样能赢任务时优先一费基础测试，保留费用且不增加失控',()=>{
 const s=room(),{d}=mission(s),basic=put(s,'BQ109'),spawn=put(s,'BQ049');
 s.societyStates[0].counters.失控=2;const cs=decisions(s);
 assert.equal(cs[0].cardId,basic);assert.equal(cs[0].mode,'influence');
 assert.ok(cs.some(c=>c.cardId===spawn&&c.mode==='spawn'&&c.targetIds[0]===`district:${d}`));
});

test('对手的任务不会被吞噬蔓延当成本方补势力；有敌方势力时不能虚算一张命令赢取',()=>{
 const s=room(),{d}=mission(s,'BH59',1),basic=put(s,'BQ109'),spawn=put(s,'BQ049');
 s.districts[d].influence=[2,1];const cs=decisions(s);
 assert.ok(!cs.some(c=>c.cardId===basic&&c.mode==='influence'));
 assert.notEqual(cs[0]?.cardId,spawn,'不把对手任务当成立即获胜');
});

test('已经锁定赢取的地区即使标志被移除也不再浪费命令；已入栈的补势力不重复打出',()=>{
 const s=room(),{d}=mission(s),first=put(s,'BQ109'),second=put(s,'BQ109');
 cmd(s,0,{type:'play',cardId:first,mode:'influence',targetIds:[`district:${d}`]});
 assert.ok(!decisions(s).some(c=>c.cardId===second&&c.mode==='influence'));
 s.flow.stack=[];s.districts[d].pendingWinner=0;s.districts[d].influence=[0,0];
 assert.ok(!decisions(s).some(c=>c.cardId===second&&c.mode==='influence'));
});

for(const difficulty of ['normal','hard'])test(`${difficulty}提取样本默认等3失控；2失控仅缺手牌时用，且不抽空牌库`,()=>{
 for(const loss of [0,1,2,3]){
  const s=room(difficulty),sample=put(s,'BQ064');for(let i=0;i<4;i++)put(s,'JC125');
  s.societyStates[0].counters.失控=loss;
  assert.equal(samplePlays(s,sample).length>0,loss===3,`失控${loss}`);
 }
 const s=room(difficulty),sample=put(s,'BQ064');s.societyStates[0].counters.失控=2;
 assert.ok(samplePlays(s,sample).length);field(s,'BH27',{wounds:1});assert.equal(samplePlays(s,sample).length,0,'士官已有一创伤仍可在下次准备步骤移除失控并抓牌');
 s.players[0].play=[];s.societyStates[0].counters.失控=3;s.players[0].deck=s.players[0].deck.slice(0,3);
 assert.equal(samplePlays(s,sample).length,0);
});

for(const difficulty of ['normal','hard'])test(`${difficulty}3失控先提取样本，再翻支援组；最后一张解失控牌不拿去建资产`,()=>{
 const s=room(difficulty),sample=put(s,'BQ064'),support=field(s,'BH29',{faceDown:true,hiddenHandle:'support'});
 s.players[0].costPool=8;s.players[0].actionCounts.asset=0;s.societyStates[0].counters.失控=3;
 const c=decisions(s)[0];assert.equal(c.cardId,sample);assert.equal(c.type,'play');
 assert.ok(!decisions(s).some(c=>c.cardId===sample&&c.type==='build-asset'));
 cmd(s,0,c);resolve(s);assert.equal(s.societyStates[0].counters.失控,0);
 assert.equal(s.players[0].hand.length,3);assert.ok(decisions(s).some(c=>c.type==='reveal'&&c.cardId===support));
});

test('2失控时先落士官再用低收益红命令，避免为了生成普通触手封锁展开',()=>{
 const s=room(),officer=put(s,'BH27'),spawn=put(s,'BQ049');put(s,'BH29');
 s.societyStates[0].counters.失控=2;assert.equal(decisions(s)[0].cardId,officer);
 assert.notEqual(decisions(s)[0].cardId,spawn);
});

test('困难取牌在3失控且没有解失控牌时先找一张样本，不连续找重复样本',()=>{
 const s=room('hard'),sample=put(s,'BQ064',0,'deck'),extra=put(s,'BQ064',0,'deck'),support=put(s,'BH29',0,'deck');
 s.societyStates[0].counters.失控=3;
 const scores=hardLibraryWeights(s,{kind:'hand'},viewFor),best=[sample,extra].sort((a,b)=>scores[b]-scores[a])[0];
 assert.ok(scores[best]>scores[support]);moveCard(s,best,'hand');
 const next=hardLibraryWeights(s,{kind:'hand'},viewFor);assert.ok(next[support]>next[best===sample?extra:sample]);
});

test('即将赢得第三张任务时，优先补势力结束对局而非先提取样本',()=>{
 const s=room(),{id}=mission(s,'BQ114'),basic=put(s,'BQ109');put(s,'BQ064');s.societyStates[0].counters.失控=3;
 s.players[0].scoreCards=['BH59','BQ112'].map(code=>{const id=put(s,code);moveCard(s,id,'score',{controller:0});return {...structuredClone(s.cards[id]),plan:s.cards[id].automation,points:0};});
 const c=decisions(s)[0];assert.equal(c.cardId,basic);assert.equal(c.mode,'influence');cmd(s,0,c);
 advance(s,()=>s.status==='finished');
 assert.equal(s.result.winner,0);assert.match(s.result.reason,/三张或更多任务/);
 assert.equal(s.turn.claim.cardId,id);
});
