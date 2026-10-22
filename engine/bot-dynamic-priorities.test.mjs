import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,put,cmd,defs} from './test-fixture.mjs';
import {viewFor,moveCard} from './match.mjs';
import {hardBotView,hardBotCommands,hardLibraryWeights} from './hard-bot-policy.mjs';
import {botCommands,botCardValue} from './bot-policy.mjs';
import {getBotProfile} from './bot-deck.mjs';
import {compileEnvironment} from './environment-definitions.mjs';
import {parseCatalog} from './catalog.mjs';
import {createAutomationEngine} from './automation.mjs';
import {hardDeckCards,installHardLibraryScorer,rememberHardDeckCards} from './hard-bot-library.mjs';
import {criminalTrigger} from './criminal-bot-policy.mjs';
import {projectedGraveCount,engineCanStart} from './bot-dynamic-planning.mjs';
const env=compileEnvironment(parseCatalog(readFileSync(new URL('../data/Card.xml',import.meta.url),'utf8')).cards);
function room(id,{round=3,mana=3,hand=[],deck=[],play=[],grave=[],assets=[]}={}){
 const s=fixture();s.societies=[];s.societyStates=[];
 for(const p of [0,1]){
  for(const zone of ['hand','deck','play','graveyard','aside']){for(const id of s.players[p][zone]){delete s.cards[id];delete s.locations[id];}s.players[p][zone]=[];}
  for(const a of s.players[p].assets){delete s.cards[a.id];delete s.locations[a.id];}s.players[p].assets=[];
  s.players[p].costPool=p===0?mana:0;s.players[p].actionCounts={asset:1,secret:0};
  const def=env.find(c=>c.catalogId===getBotProfile(id).deck.societyId),key=`society:${p}`;
  s.cards[key]=s.societies[p]={...structuredClone(def),id:key,owner:p};s.locations[key]={zone:'society',zoneVersion:0,controller:p};s.societyStates[p]={tapped:false,counters:{},uses:{}};
  if(id==='shoggoth-locking')s.deckSelections[p]={core:defs.find(c=>c.catalogId==='BQ045'),choices:{coreId:'BQ045'}};
 }
 if(id==='shoggoth-locking')createAutomationEngine({log(){}}).shoggothInitialize(s);
 for(const d of s.districts){d.plan??={};d.threshold=99;d.influence=[0,0];}
 s.round=round;s.turn.phase='action';s.turn.step='first-action';s.turn.firstPlayer=0;s.flow.priority=0;s.flow.stepOwner=0;
 s.bot={id,seat:0,difficulty:'hard',actionKeys:[],libraryKnown:{}};
 for(const code of hand)put(s,code);for(const code of deck)put(s,code,0,'deck');for(const code of grave)put(s,code,0,'graveyard');
 for(const entry of play){const [code,extra={}]=Array.isArray(entry)?entry:[entry];put(s,code,0,'play',{controller:0,district:0,tapped:false,...extra});}
 for(const code of assets){const card=put(s,code);moveCard(s,card,'asset',{controller:0,tapped:false});}s.players[0].costPool=Math.max(0,mana-assets.length);
 return s;
}
const view=s=>hardBotView(s,viewFor),commands=s=>hardBotCommands(s,view(s));
const scores=(s,kind='hand')=>hardLibraryWeights(s,{side:'top',kind},viewFor);
const score=(s,code,kind='hand')=>{const weights=scores(s,kind);return s.players[0].deck.filter(id=>s.cards[id].catalogId===code).map(id=>weights[id]).sort((a,b)=>b-a);};
function draw(s,n=1,kind='hand'){const previous=installHardLibraryScorer((s,c)=>hardLibraryWeights(s,c,viewFor));try{return hardDeckCards(s,0,n,{kind});}finally{installHardLibraryScorer(previous);}}

test('纯红第2回合未知取牌优先猎人，并在毁灭地区直接打出，先于补信徒',()=>{
 const s=room('red-monastery',{round:2,mana:2,deck:['JC042','XG36','BH24'],hand:['JC042'],assets:['BH24']});s.districts[2].destroyed=1;
 const [id]=draw(s);assert.equal(s.cards[id].catalogId,'XG36');moveCard(s,id,'hand');
 const c=commands(s)[0];assert.equal(c.type,'play');assert.equal(c.cardId,id);assert.equal(c.district,2);cmd(s,0,c);assert.equal(s.flow.stack.at(-1).cardId,id);
});
test('马图塔存活时降低重复副本，死亡且剩余两张盾时提高重建优先级，无盾时不再优先取得',()=>{
 const make=(play=[],grave=[],shields=2)=>room('white-anglican',{round:4,deck:['XG22',...Array(shields).fill('JC078')],play,grave});
 const fresh=score(make(),'XG22')[0],alive=score(make(['XG22']),'XG22')[0],dead=score(make([],['XG22']),'XG22')[0],spent=score(make([],['XG22'],0),'XG22')[0];
 assert.ok(alive<fresh);assert.ok(dead>fresh+40);assert.ok(spent<alive);
});
test('银钥可本回合启动时第一张远高于第二张，第三张降权；无法启动时不提前强取',()=>{
 const options={round:4,mana:3,hand:['BQ010'],deck:['XG01','XG01','XG01'],assets:['JC005','JC005'],play:[['XG06',{attachedTo:'society:0',hostVersion:0,chosenMagicDomain:'心灵'}],['XG06',{attachedTo:'society:0',hostVersion:0,chosenMagicDomain:'心灵'}]]};
 const s=room('yellow-white-spells',options),values=score(s,'XG01');assert.ok(engineCanStart(view(s),view(s).hardInfo.ownDeck[0]));assert.ok(values[0]>values[1]+50);assert.ok(values[1]>values[2]+40);
 const early=room('yellow-white-spells',{round:1,mana:1,deck:['XG01','XG22'],assets:['JC005']});assert.ok(values[0]>score(early,'XG01')[0]+60);
});
test('裁定官有可支付附属配合时按第一、第二、第三张递减，启动前不采用启动后的评分',()=>{
 const s=room('blue-dragon-feast',{mana:3,deck:['BQ030','BQ030','BQ030'],hand:['BQ039'],assets:['BQ040','BQ040'],play:['BQ031']}),values=score(s,'BQ030');
 assert.ok(values[0]>values[1]+50);assert.ok(values[1]>values[2]+30);
 const empty=room('blue-dragon-feast',{mana:1,deck:['BQ030'],assets:['BQ040']});assert.ok(values[0]>score(empty,'BQ030')[0]+60);
});
test('锁定修格斯中期核心回核心区后重新优先线人；无藏身处则不再使用该高权重',()=>{
 const s=room('shoggoth-locking',{round:6,deck:['BH59','BQ066','BH29']});assert.equal(s.cards[draw(s)[0]].catalogId,'BQ066');
 const no=room('shoggoth-locking',{round:6,deck:['BQ066','BH29']});assert.equal(no.cards[draw(no)[0]].catalogId,'BH29');
});
test('藏身处计分后选择把核心取回手中；下回合先打核心，再放移动任务，不把核心用作资产',()=>{
 const s=room('shoggoth-locking',{round:4,mana:4,hand:['BQ112','BQ114'],deck:['BH59'],assets:['BQ064']}),id=s.selectedCoreIds[0];
 s.effectChoice={id:'take-core',kind:'shoggoth-core-hand',controller:0,cardIds:[id],canSkip:true};assert.equal(commands(s)[0].cardId,id);s.effectChoice=null;moveCard(s,id,'hand');s.players[0].actionCounts.asset=0;
 const choices=commands(s);assert.ok(!choices.some(c=>c.type==='build-asset'&&c.cardId===id));assert.equal(choices[0].type,'play');assert.equal(choices[0].cardId,id);
});
test('修格斯任务检索根据手牌余量选择冰封或哨所',()=>{
 const make=hand=>{const s=room('shoggoth-locking',{round:5,hand,deck:['BQ112','BQ114']});moveCard(s,s.selectedCoreIds[0],'play',{controller:0,district:0,tapped:false});s.effectChoice={id:'mission',kind:'shoggoth-mission-search',controller:0,cardIds:s.players[0].deck,canFail:true};return s;};
 const low=make(['BQ048']),high=make(Array(12).fill('BQ048'));
 assert.equal(low.cards[commands(low)[0].cardId].catalogId,'BQ112');assert.equal(high.cards[commands(high)[0].cardId].catalogId,'BQ114');
});
test('黑紫罪犯达莉娅和萨迪金进手评分极低，四张堆墓优先达莉娅加三怪客',()=>{
 const s=room('black-purple-criminals',{round:4,mana:4,hand:['BQ082'],assets:['XQ36','XQ36','CQ32'],deck:['WM060','BQ086','CQ31','CQ31','CQ31','XQ36','BQ091']});
 assert.ok(score(s,'WM060')[0]<0);assert.ok(score(s,'BQ086')[0]<0);assert.ok(score(s,'XQ36')[0]>score(s,'WM060')[0]+100);
 const ids=draw(s,4,'graveyard');assert.deepEqual(ids.map(id=>s.cards[id].catalogId).sort(),['WM060','CQ31','CQ31','CQ31'].sort());
});
test('需要解场时准备萨迪金；已有暮天使和安全宿主时仍先堆传闻',()=>{
 const s=room('black-purple-criminals',{round:4,mana:4,hand:['BQ082'],assets:['XQ36','XQ36','CQ32'],deck:['WM060','BQ086','CQ31','CQ31','CQ31']});put(s,'JC080',1,'play',{controller:1,district:0});
 assert.deepEqual(draw(s,4,'graveyard').map(id=>s.cards[id].catalogId).sort(),['BQ086','CQ31','CQ31','CQ31'].sort());
 const liliel=room('black-purple-criminals',{play:['CQ26'],deck:['WM089','WM089','JC017']});assert.equal(liliel.cards[draw(liliel,1,'graveyard')[0]].catalogId,'WM089');
});
test('毒药专家在缺手牌时拉达莉娅，在高质量敌方场面需要解场时拉萨迪金',()=>{
 const s=room('black-purple-criminals',{grave:['WM060','BQ086','CQ31','CQ31','CQ31']}),v=view(s),candidates=v.players[0].graveyard.filter(c=>['WM060','BQ086'].includes(c.catalogId));
 const h={drawReserve:()=>0,value:c=>c.printedCost,sorted:(cards,fn)=>[...cards].sort((a,b)=>fn(b)-fn(a)),lookup:(v,id)=>v.players.flatMap(p=>[...p.play,...p.graveyard]).find(c=>c.id===id)};
 const trigger=v=>criminalTrigger({...v,abilityTargets:{t:candidates}},{id:'t',controller:0,plan:{effect:'grave-random-enter'}},h)[0];
 assert.equal(s.cards[trigger(v).targetIds[0]].catalogId,'WM060');put(s,'JC080',1,'play',{controller:1,district:0});assert.equal(s.cards[trigger(view(s)).targetIds[0]].catalogId,'BQ086');
});
test('需要隐秘对抗和弃牌时提高第一张传闻的手牌权重',()=>{
 const s=room('black-purple-criminals',{mana:3,deck:['WM089']}),before=score(s,'WM089')[0];put(s,'BQ082');put(s,'WM060',0,'play',{controller:0,district:0});
 assert.ok(score(s,'WM089')[0]>before+60);
});
test('圣公会第2回合优先冥想者，第3回合提高可打出的亚洛尔并先于面壁苦修',()=>{
 const s=room('white-anglican',{round:2,mana:2,hand:['XQ28','XQ32'],deck:['JC078'],assets:['JC078','JC078']});assert.equal(s.cards[commands(s)[0].cardId].catalogId,'XQ28');
 const y=room('white-anglican',{round:3,mana:3,hand:['JC081',...Array(7).fill('JC078'),'XQ32'],deck:['JC078'],assets:['JC078','JC078','JC078']});assert.equal(y.cards[commands(y)[0].cardId].catalogId,'JC081');
});
test('第3回合只能把亚洛尔减至3费时，仍先于马图塔和面壁苦修，不局限于0至2费',()=>{
 const s=room('white-anglican',{round:3,mana:3,hand:['JC081','JC076','JZ47','BQ108','XG22','XQ32'],deck:['JC078'],assets:['JC078','JC078','JC078']});
 const c=commands(s)[0];assert.equal(c.type,'play');assert.equal(s.cards[c.cardId].catalogId,'JC081');assert.equal(c.revealIds.length,4);cmd(s,0,c);
 assert.equal(s.players[0].costPool+s.players[0].assets.filter(a=>!a.tapped).length,0);assert.equal(s.flow.stack.at(-1).cardId,c.cardId);
});
test('绿黑按拳击手、诗人骑士、4费窥秘的曲线取牌，不优先黄雀和默契搭档',()=>{
 const one=room('green-black-renown',{round:1,mana:1,deck:['BH07','BH09','JC014','LC02','BH10'],assets:['JC017']});assert.equal(one.cards[draw(one)[0]].catalogId,'BH07');
 const two=room('green-black-renown',{round:2,mana:2,deck:['BH09','JC014','LC02','BH10'],play:['BH07'],assets:['JC017','JC017']});assert.equal(two.cards[draw(two)[0]].catalogId,'BH09');
 const four=room('green-black-renown',{round:4,mana:4,deck:['BH11','LC02','BH10'],assets:['JC017','JC017','WM043','WM043']});assert.equal(four.cards[draw(four)[0]].catalogId,'BH11');
});
test('清理员或诗人本回合可把墓地填到七张时，提高收容所，已有收容所后提高食尸鬼',()=>{
 const s=room('green-black-renown',{round:3,mana:3,hand:['XQ36'],deck:['BQ091','BH41','LC02'],grave:Array(3).fill('JC017'),assets:['XQ36','JC017']});
 assert.ok(projectedGraveCount(view(s))>=7);const ready=score(s,'BQ091')[0];s.players[0].hand=[];assert.ok(ready>score(s,'BQ091')[0]+30);
 const before=score(s,'BH41')[0];put(s,'BQ091',0,'play',{controller:0,district:1,attachedTo:'district:1',hostVersion:0});assert.ok(score(s,'BH41')[0]>before+20);
});
test('混合检视选择一张进手、其余堆墓时分别按用途取未知牌，并保留已知位置',()=>{
 const s=room('black-purple-criminals',{deck:['WM089','XQ36','WM060','CQ31','CQ31','CQ31','BQ086']}),held=s.players[0].deck.find(id=>s.cards[id].catalogId==='XQ36'),fixed=s.players[0].deck[0];rememberHardDeckCards(s,[fixed]);
 const previous=installHardLibraryScorer((state,ctx)=>Object.fromEntries(state.players[0].deck.map(id=>[id,ctx.kind==='hand'?(id===held?100:0):state.cards[id].catalogId==='CQ31'?200:0])));
 try{const ids=hardDeckCards(s,0,4,{kind:'select-and-mill',handCount:1});assert.equal(ids[0],fixed);assert.ok(ids.includes(held));assert.equal(ids.filter(id=>s.cards[id].catalogId==='CQ31').length,2);}finally{installHardLibraryScorer(previous);}
});

test('手牌少且清理员容易离场时堆墓优先传闻，怪客在引擎准备好后才升权',()=>{
 const s=room('black-purple-criminals',{round:2,mana:2,play:['XQ36'],deck:['WM089','CQ31','WM060']});
 assert.equal(s.cards[draw(s,1,'graveyard')[0]].catalogId,'WM089');const waiting=score(s,'CQ31','graveyard')[0];
 put(s,'BQ082',0,'play',{controller:0,district:1,faceDown:true,hiddenHandle:'ready-seb'});s.players[0].ignoreLoyalty=true;s.players[0].costPool=4;
 assert.ok(score(s,'CQ31','graveyard')[0]>waiting+100);
});
test('暮天使批量堆墓先保证一张角色，再利用其余位置堆可回收传闻',()=>{
 const s=room('black-purple-criminals',{round:2,mana:2,play:['CQ26','XQ36'],deck:['WM089','WM089','WM089','CQ31','JC017']});
 const codes=draw(s,4,'graveyard').map(id=>s.cards[id].catalogId);assert.equal(codes.filter(code=>code==='WM089').length,3);assert.equal(codes.length,4);
});
