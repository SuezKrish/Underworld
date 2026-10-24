import test from 'node:test';
import assert from 'node:assert/strict';
import {battleIntervention} from './bot-battle-intervention.mjs';
import {botCommands} from './bot-policy.mjs';
import {hardBotView,hardBotCommands} from './hard-bot-policy.mjs';
import {fixture,put,cmd,resolve} from './test-fixture.mjs';
import {viewFor} from './match.mjs';
const role=(id,controller,battle,defense,worth)=>({id,controller,type:'character',district:0,icons:{battle},defense,worth,printedCost:3});
const helpers={value:c=>c.worth,keyword:(c,k)=>c.keywords?.includes(k),total:(v,p,d,k)=>v.players[p].play.filter(c=>c.district===d&&!c.tapped).reduce((n,c)=>n+(c.icons?.[k]??0),0)};
const plan={timing:'fast',effect:'bounce'},source={id:'spell'};
function scene(){return {seat:0,contestWindowRule:'after-only',turn:{phase:'contest',step:'contest-after',kind:'investigation',district:0},flow:{stack:[]},districts:[{}],players:[{play:[role('engine',0,0,2,17)]},{play:[role('attacker',1,2,3,10)]}]};}
test('最后战斗窗口比较干预前后损失，不依赖卡名或Bot构筑',()=>{const v=scene();assert.ok(battleIntervention(v,source,plan,['attacker'],helpers).urgent);assert.ok(battleIntervention(v,source,plan,['engine'],helpers).adjustment>17);});
test('战斗已结束、仍有堆叠、角色不会死亡时，不凭空制造紧迫性',()=>{for(const mode of ['finished','stack','safe']){const v=scene();if(mode==='finished')v.turn.kind='battle';if(mode==='stack')v.flow.stack=[{id:'pending'}];if(mode==='safe')v.players[0].play[0].defense=4;assert.equal(battleIntervention(v,source,plan,['attacker'],helpers).urgent,false,mode);}});
test('永恒、战斗伤害防止以及无效点伤不会计算为可救回角色',()=>{for(const mode of ['eternal','prevent','nonlethal']){const v=scene();if(mode==='eternal')v.players[1].play[0].keywords=['永恒'];if(mode==='prevent')v.players[0].play[0].battleDamagePrevented=true;assert.equal(battleIntervention(v,source,mode==='nonlethal'?{timing:'fast',effect:'damage',amount:1}:plan,['attacker'],helpers).urgent,false,mode);}});
test('救走战斗角色若会让另一个更贵引擎死亡，不当作正收益',()=>{const v=scene();v.players[0].play=[role('guard',0,2,1,3),role('engine',0,0,3,20)];v.players[1].play[0].icons.battle=3;assert.equal(battleIntervention(v,source,plan,['guard'],helpers).urgent,false);});
test('额外费用横置本方角色也计入实际战斗差值',()=>{const v=scene();v.players[0].play.push(role('source',0,1,4,2));v.players[1].play[0].icons.battle=3;v.players[1].play.push(role('other',1,1,4,2));assert.equal(battleIntervention(v,{id:'source'},{timing:'fast',effect:'tap',tap:true},['other'],helpers).urgent,false);});
test('暗藏者不能被分配战斗伤害，不以其正面价值虚构战斗损失',()=>{const v=scene();v.players[0].play[0].faceDown=true;assert.equal(battleIntervention(v,source,plan,['attacker'],helpers).urgent,false);});
test('尚未选定要牺牲或横置的费用对象时，不假定其图标仍在场',()=>{for(const cost of ['tapCharacters','sacrificeCharacter','sacrificeAttached'])assert.equal(battleIntervention(scene(),source,{...plan,[cost]:true},['attacker'],helpers).urgent,false);});
for(const difficulty of ['normal','medium','hard'])test(`${difficulty}调查结束后使用改名快效移走敌人，避免本方引擎战斗死亡`,()=>{
 const s=fixture();for(const p of [0,1]){for(const z of ['hand','deck','play','graveyard'])s.players[p][z]=[];s.players[p].costPool=p===0?2:0;s.players[p].assets=[];s.players[p].ignoreLoyalty=true;for(let i=0;i<20;i++)put(s,'JC125',p,'deck');}
 s.bot={id:'future-deck',seat:0,difficulty,actionKeys:[]};s.round=7;s.contestWindowRule='after-only';s.turn={...s.turn,phase:'contest',step:'contest-after',kind:'investigation',district:0};s.flow={...s.flow,priority:0,stepOwner:0,locked:false,passed:[],stack:[]};
 const own=put(s,'XG01',0,'play',{controller:0,district:0,tapped:false}),foe=put(s,'BQ045',1,'play',{controller:1,district:0,tapped:false}),answer=put(s,'JC006');
 s.cards[own].catalogId='UNLISTED-ENGINE';s.cards[own].printedCost=8;s.cards[own].automation={};s.cards[foe].catalogId='UNLISTED-ATTACKER';s.cards[foe].automation={};s.cards[foe].icons.battle=2;s.cards[foe].temporaryIcons={};s.cards[answer].catalogId='UNLISTED-BOUNCE';
 const v=difficulty==='normal'?viewFor(s,0):hardBotView(s,viewFor),cs=difficulty==='normal'?botCommands(v):hardBotCommands(s,v);
 const c=cs[0];assert.equal(c.type,'play');assert.equal(c.cardId,answer);assert.deepEqual(c.targetIds,[foe]);cmd(s,0,c);resolve(s);assert.equal(s.locations[foe].zone,'hand');assert.equal(s.locations[own].zone,'play');
});
