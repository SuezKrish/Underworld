import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,put,cmd,resolve} from './test-fixture.mjs';
import {viewFor,moveCard} from './match.mjs';
import {botCommands,botAssetValue} from './bot-policy.mjs';
import {hardBotView,hardBotCommands,hardLibraryWeights} from './hard-bot-policy.mjs';
import {hardDeckCards,installHardLibraryScorer,rememberHardDeckCards} from './hard-bot-library.mjs';
import {assetComboReserve,assetLoyaltyBenefit} from './bot-card-purpose.mjs';
import {graveyardPlanning} from './bot-graveyard-uses.mjs';
import {botCardValue} from './bot-policy.mjs';

function room(profile,{difficulty='hard',round=3,hand=[],deck=[],grave=[],play=[],assets=[],hidden=0}={}){
 const s=fixture();s.societies=[];s.societyStates=[];
 for(const p of [0,1]){
  for(const zone of ['hand','deck','play','graveyard','aside'])s.players[p][zone]=[];
  s.players[p].assets=[];s.players[p].costPool=0;s.players[p].actionCounts={asset:0,secret:1};
  const id=`society:${p}`;s.cards[id]=s.societies[p]={id,owner:p,type:'society',catalogId:'purpose-test',name:'测试秘社',plan:p===0&&profile==='purple-matriarch'?{ignorePurpleLoyalty:true}:{},actions:[]};
  s.locations[id]={zone:'society',zoneVersion:0,controller:p};s.societyStates[p]={tapped:false,counters:{},uses:{}};
 }
 s.round=round;s.bot={id:profile,seat:0,difficulty,actionKeys:[],libraryKnown:{}};
 s.flow={...s.flow,priority:0,stepOwner:0,stack:[],passed:[],locked:false};
 s.turn={...s.turn,phase:'action',step:'first-action',firstPlayer:0,actionClosed:false};
 for(const d of s.districts){d.plan={};d.threshold=99;d.influence=[0,0];}
 s.players[0].markers.hidden=hidden;
 for(const code of hand)put(s,code);for(const code of deck)put(s,code,0,'deck');for(const code of grave)put(s,code,0,'graveyard');
 for(const code of play)put(s,code,0,'play',{controller:0,district:0,tapped:false});
 for(const code of assets){const id=put(s,code);moveCard(s,id,'asset',{controller:0,tapped:false});}
 return s;
}
const view=s=>s.bot.difficulty==='hard'?hardBotView(s,viewFor):viewFor(s,0);
const commands=s=>s.bot.difficulty==='hard'?hardBotCommands(s,view(s)):botCommands(view(s));
const firstAsset=s=>commands(s).find(c=>c.type==='build-asset');
function take(s,count,kind){
 const previous=installHardLibraryScorer((s,c)=>hardLibraryWeights(s,c,viewFor));
 try{return hardDeckCards(s,0,count,{kind});}finally{installHardLibraryScorer(previous);}
}

for(const difficulty of ['normal','hard']){
 test(`${difficulty}：三张嗜杀怪客都是循环组件，已有墓地怪客也不把剩余两张用作资产`,()=>{
  const s=room('black-purple-criminals',{difficulty,hand:['CQ31','CQ31','WM060','WM060'],grave:['CQ31','WM060'],assets:['XQ36','XQ36']});
  const c=firstAsset(s);assert.ok(c);assert.equal(s.cards[c.cardId].catalogId,'WM060');
  const v=view(s);assert.ok(v.players[0].hand.filter(c=>c.catalogId==='CQ31').every(c=>assetComboReserve(v,c)===140));
 });
 test(`${difficulty}：没有其他用途时，不为了继续加资产牺牲唯一的怪客组件`,()=>{
  const s=room('black-purple-criminals',{difficulty,hand:['CQ31'],assets:['XQ36','XQ36']});
  assert.equal(firstAsset(s),undefined);
 });
 test(`${difficulty}：已有可复活的达莉娅时，多余达莉娅比检索到的启动角色更适合建立资产`,()=>{
  const s=room('black-purple-criminals',{difficulty,hand:['BQ082','WM060','CQ31'],grave:['WM060','CQ31','CQ31'],assets:['XQ36','XQ36']});
  const c=firstAsset(s);assert.equal(s.cards[c.cardId].catalogId,'WM060');
  cmd(s,0,c);assert.equal(s.locations[c.cardId].zone,'asset');
 });
}
test('第一张墓地载体与多余载体用途不同，取得墓地副本后重新评估资产候选',()=>{
 const s=room('black-purple-criminals',{hand:['WM060','BQ086','JC084'],assets:['XQ36','XQ36']});
 let v=view(s);const d=v.players[0].hand.find(c=>c.catalogId==='WM060');
 assert.equal(assetComboReserve(v,d),80);put(s,'WM060',0,'graveyard');v=view(s);
 assert.equal(assetComboReserve(v,d),-40);assert.equal(s.cards[firstAsset(s).cardId].catalogId,'WM060');
});
test('忠诚收益只计算留在手中的其他牌，不把资产自身当作待展开组件',()=>{
 const s=room('black-purple-criminals',{round:4,hand:['CQ32','WM060'],assets:['XQ36','XQ36','XQ36']});
 let v=view(s),rigo=v.players[0].hand.find(c=>c.catalogId==='CQ32');assert.equal(assetLoyaltyBenefit(v,rigo),0);
 put(s,'JZ63');v=view(s);rigo=v.players[0].hand.find(c=>c.id===rigo.id);assert.ok(assetLoyaltyBenefit(v,rigo)>0);
});
test('缺少紫忠诚时使用多余的同色牌，保留仍需复数的怪客',()=>{
 const s=room('black-purple-criminals',{round:4,hand:['CQ31','CQ32','CQ32','BQ082'],grave:['CQ31','CQ31','WM060'],assets:['XQ36','XQ36','XQ36']});
 const c=firstAsset(s);assert.ok(c);assert.equal(s.cards[c.cardId].catalogId,'CQ32');
});
test('补足忠诚后不再永久保留颜色优先级，不能读取普通难度牌库顺序',()=>{
 const s=room('black-purple-criminals',{difficulty:'normal',hand:['WM060','CQ32','CQ31'],grave:['WM060','CQ31','CQ31'],assets:['XQ36','XQ36'],deck:['JZ63','BQ082']});
 const before=commands(s);s.players[0].deck.reverse();assert.deepEqual(commands(s),before);
 const v=view(s),c=v.players[0].hand.find(c=>c.catalogId==='CQ32'),needed=assetLoyaltyBenefit(v,c);
 moveCard(s,put(s,'JZ63'),'asset',{controller:0,tapped:false});assert.ok(assetLoyaltyBenefit(view(s),c)<=needed);
});
test('困难取牌可先取得多余的忠诚材料，不再只能取核心然后将核心用作资产',()=>{
 const s=room('black-purple-criminals',{round:3,hand:['CQ31','CQ31','BQ082'],grave:['WM060'],assets:['XQ36','XQ36'],deck:['CQ31','WM060','JC084']});
 const [id]=take(s,1,'hand');assert.notEqual(s.cards[id].catalogId,'CQ31');moveCard(s,id,'hand');
 const c=firstAsset(s);assert.equal(c.cardId,id);assert.ok(botAssetValue(view(s),view(s).players[0].hand.find(c=>c.id===id))<100);
});
test('资产用途同时考虑魔法领域，并尊重主母取消紫忠诚的持续效果',()=>{
 const s=room('purple-matriarch',{hand:['XQ45','JZ63']});
 s.societies[0].plan.ignorePurpleLoyalty=true;let v=view(s),material=v.players[0].hand.find(c=>c.catalogId==='XQ45');
 assert.equal(assetLoyaltyBenefit(v,material),0);
 const role=v.players[0].hand.find(c=>c.catalogId==='JZ63');role.loyalty={心:1};material.magicDomains=['心灵'];
 assert.equal(assetLoyaltyBenefit(v,material),55);
});
test('主母同时堆五张时优先有效传闻，不堆三鲸与两贝兰丹娜',()=>{
 const s=room('purple-matriarch',{hidden:1,play:['BH46'],deck:['JZ64','JZ64','JZ64','WM071','WM071','CQ32','CQ32','CQ32','WM066','WM066']});
 const ids=take(s,5,'graveyard');assert.equal(ids.length,5);
 assert.ok(ids.every(id=>['CQ32','WM066'].includes(s.cards[id].catalogId)),ids.map(id=>s.cards[id].name).join('、'));
});
test('已知顶牌仍须按原位置堆墓，保护核心的评分仅调整未知位置',()=>{
 const s=room('purple-matriarch',{hidden:1,play:['BH46'],deck:['JZ64','JZ64','WM071','CQ32','CQ32','CQ32','WM066','WM066']});
 const fixed=s.players[0].deck[0];rememberHardDeckCards(s,[fixed]);
 const ids=take(s,5,'graveyard');assert.equal(ids[0],fixed);
 assert.ok(ids.slice(1).every(id=>['CQ32','WM066'].includes(s.cards[id].catalogId)));
});
test('主母未获得隐秘时不把原初牧者当作传闻，有隐秘后才提高其堆墓收益',()=>{
 const s=room('purple-matriarch',{deck:['WM066','CQ32','JZ64'],play:['BH46']});
 const [pastor,rigo]=s.players[0].deck,base=hardLibraryWeights(s,{kind:'graveyard'},viewFor);
 assert.ok(base[rigo]>base[pastor]);s.players[0].markers.hidden=1;
 const active=hardLibraryWeights(s,{kind:'graveyard'},viewFor);assert.ok(active[pastor]>base[pastor]+80);
});
test('敌方圣甲虫的清理员实际结算时，困难主母也保留未知鲸和贝兰丹娜并堆下传闻',()=>{
 const s=room('purple-matriarch',{hidden:1,play:['BH46'],deck:['JZ64','JZ64','JZ64','WM071','WM071','CQ32','CQ32','CQ32','WM066','WM066']});
 s.flow.priority=1;s.flow.stepOwner=1;s.turn.firstPlayer=1;s.players[1].costPool=1;s.players[1].ignoreLoyalty=true;
 const cleaner=put(s,'XQ36',1),previous=installHardLibraryScorer((s,c)=>hardLibraryWeights(s,c,viewFor));
 try{cmd(s,1,{type:'play',cardId:cleaner,district:1});resolve(s);
  const trigger=s.triggerChoices.find(a=>a.cardId===cleaner);assert.ok(trigger);
  cmd(s,1,{type:'trigger-choice',triggerId:trigger.id,fire:true,targetIds:[]});resolve(s);
 }finally{installHardLibraryScorer(previous);}
 assert.equal(s.players[0].graveyard.length,4);
 assert.ok(s.players[0].graveyard.every(id=>['CQ32','WM066'].includes(s.cards[id].catalogId)));
 assert.equal(s.players[0].deck.filter(id=>s.cards[id].catalogId==='JZ64').length,3);
 assert.equal(s.players[0].deck.filter(id=>s.cards[id].catalogId==='WM071').length,2);
});
for(const [profile,core,spare,rumor] of [
 ['white-anglican','JC081','JC078','XG22'],
 ['yellow-white-spells','XG01','BQ009','XG22'],
 ['green-black-renown','BH11','JC084',null],
 ['blue-dragon-feast','BQ030','BQ040',null],
 ['shoggoth-locking','BH29','BQ048',null],
 ['red-monastery','XG36','JC043','BQ047'],
 ['purple-matriarch','JZ64','XQ45','CQ32'],
])test(`${profile}：堆墓评分与进手评分分离，优先传闻或低损失牌而非未启动的核心`,()=>{
 const s=room(profile,{round:3,hidden:1,play:['JC125'],deck:[core,spare,...rumor?[rumor]:[]],assets:profile==='blue-dragon-feast'?['BQ040']:[]});
 const [id]=take(s,1,'graveyard');assert.equal(s.cards[id].catalogId,rumor??spare);
});
test('黑紫堆墓仍保留达莉娅加三怪客的专用展开，而不是一律堆传闻',()=>{
 const s=room('black-purple-criminals',{round:4,hand:['BQ082'],assets:['XQ36','XQ36','CQ32'],deck:['CQ31','CQ31','CQ31','WM060','CQ32','WM089']});
 s.players[0].costPool=1;
 assert.deepEqual(take(s,4,'graveyard').map(id=>s.cards[id].catalogId).sort(),['CQ31','CQ31','CQ31','WM060'].sort());
});
test('无隐秘时黄金之蛇不算传闻，角色传闻里戈莱托仍比无用途的高费角色优先堆墓',()=>{
 const s=room('black-purple-criminals',{play:['JC084'],deck:['BQ087','CQ32']});
 assert.equal(s.cards[take(s,1,'graveyard')[0]].catalogId,'CQ32');
 const off=hardLibraryWeights(s,{kind:'graveyard'},viewFor),gold=s.players[0].deck.find(id=>s.cards[id].catalogId==='BQ087');s.players[0].markers.hidden=1;
 const on=hardLibraryWeights(s,{kind:'graveyard'},viewFor);assert.ok(on[gold]>off[gold]+30);
});
test('无隐秘但已准备复活且缺少达莉娅和萨迪金时，黄金之蛇仍可作为有实际用途的复活材料',()=>{
 const s=room('black-purple-criminals',{round:4,hand:['BQ082'],assets:['XQ36','XQ36','CQ32'],deck:['BQ087','CQ32']});
 s.players[0].costPool=1;
 assert.equal(s.cards[take(s,1,'graveyard')[0]].catalogId,'BQ087');
});
test('黄白堆墓保留手牌与牌库中的最后轮回，但已向玩家公开的顶牌不能改动',()=>{
 const s=room('yellow-white-spells',{deck:['XQ02','BQ009']}),wheel=s.players[0].deck[0];
 assert.equal(s.cards[take(s,1,'graveyard')[0]].catalogId,'BQ009');
 s.players[0].deck=[wheel,...s.players[0].deck.filter(id=>id!==wheel)];rememberHardDeckCards(s,[wheel],1);
 assert.equal(take(s,1,'graveyard')[0],wheel);
});

test('黑紫前中期有安全传闻对象时，暮天使也不把尚未启动的高费载体排到传闻之前',()=>{
 const s=room('black-purple-criminals',{round:3,play:['JC084','CQ26'],assets:['XQ36','XQ36','XQ36','CQ32'],deck:['WM060','BQ086','BQ087','CQ31','CQ31','CQ31','CQ32','CQ32','CQ32','WM089','WM089']});
 const ids=take(s,4,'graveyard');assert.ok(ids.every(id=>['CQ32','WM089'].includes(s.cards[id].catalogId)),ids.map(id=>s.cards[id].name).join('、'));
});
test('毒药专家尚不能支付实际打出费用时，仍先堆可回收传闻',()=>{
 const s=room('black-purple-criminals',{round:3,hand:['BQ082'],play:['JC084'],assets:['XQ36','XQ36','CQ32'],deck:['WM060','CQ31','WM089']});
 assert.equal(s.cards[take(s,1,'graveyard')[0]].catalogId,'WM089');
});
test('仅有可快速自行离场的敌方角色时，不把无法可靠封印的传闻当成稳定收益',()=>{
 const s=room('white-anglican',{round:3,deck:['WM089','JC084'],assets:['XQ36']});
 const host=put(s,'JC125',1,'play',{controller:1,district:0,tapped:false});
 s.cards[host].automation={kind:'character',actions:[{timing:'fast',cost:0,target:'none',effect:'return-source-hand'}]};
 const rumor=s.players[0].deck[0],unsafe=hardLibraryWeights(s,{kind:'graveyard'},viewFor)[rumor];
 assert.ok(unsafe<=0);put(s,'JC084',0,'play',{controller:0,district:0,tapped:false});
 assert.ok(hardLibraryWeights(s,{kind:'graveyard'},viewFor)[rumor]>=unsafe+100);
});
test('江莲的同一执行计划在改名后仍能识别可从墓地封印的法术和阴牌',()=>{
 const s=room('purple-matriarch',{play:['LC17'],deck:['JC125','XQ44'],assets:['WM066','XQ44','XQ45']});
 const source=s.players[0].play[0],spell=s.players[0].deck[1];s.cards[source].catalogId='renamed-source';s.cards[source].name='改名的来源';
 s.cards[spell].loyalty={};s.cards[spell].catalogId='renamed-spell';s.cards[spell].name='改名法术';
 assert.equal(take(s,1,'graveyard')[0],spell);
 s.cards[source].automation.prepare={target:'none',effect:'heal'};
 const v=view(s),plan=graveyardPlanning(v,v.hardInfo.ownDeck,botCardValue);
 assert.equal(plan.values.get(spell),0);
});
test('里戈莱托识别墓地梦魇的夺取操控权用途，不靠牌名或ID判断',()=>{
 const s=room('purple-matriarch',{play:['CQ32'],deck:['JC125','JC125'],assets:['XQ45']});
 put(s,'JC080',1,'play',{controller:1,district:0,tapped:false});
 const source=s.players[0].play[0],body=s.players[0].deck[0],spare=s.players[0].deck[1];
 s.cards[source].catalogId='renamed-controller';s.cards[source].name='改名的操控者';
 for(const [id,subtypes] of [[body,['梦魇']],[spare,['人类']]])Object.assign(s.cards[id],{catalogId:'renamed-'+id,loyalty:{},magicDomains:[],subtypes});
 assert.equal(take(s,1,'graveyard')[0],body);
 s.cards[source].automation.watch=[];
 const v=view(s),plan=graveyardPlanning(v,v.hardInfo.ownDeck,botCardValue);assert.equal(plan.values.get(body),0);
});
test('缺领域忠诚时保留两血一心一星的资产材料，优先堆真正多余的组件',()=>{
 const s=room('purple-matriarch',{round:4,hand:['LC17'],deck:['WM066','WM066','XQ44','XQ45','JC125','JC125']});
 Object.assign(s.cards[s.players[0].hand[0]],{loyalty:{血:2,心:1,星:1,紫:5},keywords:['非资产']});
 const v=view(s),plan=graveyardPlanning(v,v.hardInfo.ownDeck,botCardValue,{},botAssetValue);
 assert.equal(plan.loyaltyReserve.size,4);
 assert.ok(take(s,2,'graveyard').every(id=>s.cards[id].catalogId==='JC125'));
});
test('已有足量领域资产后不再把同领域的多余牌永久保留',()=>{
 const s=room('purple-matriarch',{hand:['LC17'],deck:['WM066','WM066','XQ44','XQ45','JC125'],assets:['WM066','WM066','XQ44','XQ45']});
 s.cards[s.players[0].hand[0]].loyalty={血:2,心:1,星:1};
 const v=view(s);assert.equal(graveyardPlanning(v,v.hardInfo.ownDeck,botCardValue,{},botAssetValue).loyaltyReserve.size,0);
});
