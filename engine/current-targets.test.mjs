import test from 'node:test';
import assert from 'node:assert/strict';
import {currentTargetingView} from './current-targets.mjs';
import {stackEntryLabel} from './stack-display.mjs';
import {sealHost} from './sealing.mjs';
import {fixture,put,cmd} from './test-fixture.mjs';
import {viewFor} from './match.mjs';

function state(){
 const s={players:[{hand:[]},{hand:[]}],seats:[{name:'甲'},{name:'乙'}],cards:{},locations:{},districts:[{id:'region',name:'地区'}],societyVersions:[0,0],flow:{stack:[]},pendingTriggers:[]};
 for(const [id,zone] of [['role','play'],['attachment','play'],['asset','asset'],['grave','graveyard'],['sealed','sealed'],['source','play']]){
  s.cards[id]={id,name:id,owner:0};s.locations[id]={zone,zoneVersion:1,controller:0};
 }
 s.cards.hidden={id:'hidden',name:'秘密牌名',owner:1};s.locations.hidden={zone:'play',zoneVersion:1,controller:1,faceDown:true,hiddenHandle:'opaque'};
 return s;
}
const card=(id,extra={})=>({kind:'card',cardId:id,zoneVersion:1,...extra});
function add(s,id,targets,extra={}){const a={id,kind:'auto-ability',cardId:'source',controller:0,displayName:'来源能力',plan:{target:'character'},targets,...extra};s.flow.stack.push(a);return a;}

test('所有公共卡牌区域、暗藏者、地区、秘社和堆叠条目使用各自UI身份',()=>{
 const s=state();add(s,'first',[]);add(s,'second',[
  ...['role','attachment','asset','grave','sealed'].map(id=>card(id)),card('hidden',{faceDown:true}),
  {kind:'district',district:0,cardId:'region'},{kind:'host',ref:sealHost(s,'society:0')},{kind:'stack',entryId:'first'}
 ]);
 const v=currentTargetingView(s,0);
 assert.deepEqual(Object.keys(v).sort(),['role','attachment','asset','grave','sealed','hidden:opaque','region','society:0','stack:first'].sort());
 assert.equal(v.asset[0].name,'来源能力 · 能力');assert.equal(v['stack:first'][0].position,1);
 assert.ok(currentTargetingView(s,1).hidden);assert.ok(!JSON.stringify(v).includes('秘密牌名'));
});
test('多个能力各自列出，同一能力重复指定同一对象只显示一条',()=>{
 const s=state();add(s,'one',[card('role'),card('role')]);add(s,'two',[card('role')]);
 assert.deepEqual(currentTargetingView(s,0).role.map(a=>a.id),['stack:one','stack:two']);
 s.flow.stack.pop();assert.equal(currentTargetingView(s,0).role.length,1);
 s.flow.stack=[];assert.deepEqual(currentTargetingView(s,0),{});
});
test('来源离场不移除目标标记，响应期间屏障及条件变化不抹除目标',()=>{
 const s=state();add(s,'one',[card('role')]);s.locations.source={zone:'graveyard',zoneVersion:2};
 s.cards.role.keywords=['屏障'];s.players[0].markers={hidden:0};
 assert.equal(currentTargetingView(s,0).role.length,1);
});
test('血畜牺牲自身支付费用后，双方仍能看到饮血能力的目标，结算后清除',()=>{
 const s=fixture(),source=put(s,'BQ027',0,'play',{controller:0,district:0}),target=put(s,'BQ031',0,'play',{controller:0,district:0});
 cmd(s,0,{type:'activate',cardId:source,targetIds:[target]});
 assert.equal(s.locations[source].zone,'graveyard');
 for(const p of [0,1])assert.equal(viewFor(s,p,0,'TEST').currentTargets[target][0].name,'血畜 · 能力');
 cmd(s,s.flow.priority,{type:'pass'});cmd(s,s.flow.priority,{type:'pass'});
 for(const p of [0,1])assert.equal(viewFor(s,p,0,'TEST').currentTargets[target],undefined);
});
test('目标离场重进或翻面成为新对象后不把旧目标标记转给新对象',()=>{
 const s=state();add(s,'one',[card('role')]);s.locations.role.zoneVersion=2;
 assert.deepEqual(currentTargetingView(s,0),{});
 s.locations.role.zoneVersion=1;s.locations.role.faceDown=true;
 s.flow.stack[0].targets[0].faceDown=false;assert.deepEqual(currentTargetingView(s,0),{});
});
test('地区换牌及堆叠条目离开后不误标新地区或同来源的另一条能力',()=>{
 const s=state();add(s,'one',[]);add(s,'two',[]);add(s,'third',[{kind:'stack',entryId:'one'},{kind:'district',district:0,cardId:'region'}]);
 s.flow.stack.shift();s.districts[0].id='replacement';assert.deepEqual(currentTargetingView(s,0),{});
});
test('环境能力的旧式目标与封印宿主引用均能显示',()=>{
 const s=state();add(s,'one',[{kind:'card',id:'role',version:1},{kind:'district',id:'region',district:0},{kind:'society',player:1}],{kind:'environment-ability'});
 add(s,'two',[{kind:'host',ref:sealHost(s,'district-host:region')}]);
 const v=currentTargetingView(s,0);assert.equal(v.role.length,1);assert.equal(v.region.length,2);assert.equal(v['society:1'].length,1);
});
test('背面封印的目标使用遮蔽身份，不公开对手手牌和牌库',()=>{
 const s=state();s.cards.sealed.owner=1;s.locations.sealed.faceDown=true;s.locations.sealed.hiddenHandle='seal-handle';
 for(const zone of ['hand','deck']){s.cards[zone]={id:zone,name:'私密内容',owner:1};s.locations[zone]={zone,zoneVersion:1};}
 add(s,'one',[card('sealed'),card('hand'),card('deck')]);
 assert.deepEqual(Object.keys(currentTargetingView(s,0)),['sealed:seal-handle']);
 assert.deepEqual(Object.keys(currentTargetingView(s,1)),['sealed']);
});
test('不根据额外费用、普通选择、自身放标志或结附关系推测目标',()=>{
 const s=state();add(s,'one',[card('role')],{plan:{nonTargeted:true}});add(s,'two',[],{effect:{kind:'place-markers',targetId:'asset'},sacrificeIds:['role'],costIds:['sealed']});
 s.locations.attachment.attachedTo='role';s.triggerChoices=[{id:'not-fired',targets:[card('role')]}];
 assert.deepEqual(currentTargetingView(s,0),{});
});
test('已发动待入栈能力显示状态，并兼容传闻的独立目标字段',()=>{
 const s=state();s.pendingTriggers.push({id:'rumor',sourceId:'source',controller:0,displayName:'传闻牌',targetId:'role',targetZoneVersion:1,effect:{kind:'seal-from-graveyard'}});
 assert.equal(currentTargetingView(s,0).role[0].status,'pending');
 assert.equal(currentTargetingView(s,0).role[0].name,'传闻牌 · 从墓地封印');
});
test('暗藏来源的名称保持遮蔽，不以真实牌名补充来源信息',()=>{
 const s=state();add(s,'one',[card('role')],{cardId:'hidden',controller:1,displayName:'秘密牌名 · 能力'});
 assert.ok(!JSON.stringify(currentTargetingView(s,0)).includes('秘密牌名'));
 assert.ok(JSON.stringify(currentTargetingView(s,1)).includes('秘密牌名'));
});
test('真实视图显示资产目标牌名，并在打出后为双方提供当前目标',()=>{
 const s=fixture(),spell=put(s,'XG03');s.cards[s.players[1].assets[0].id].name='资产原始牌名';
 const before=structuredClone(s),v=viewFor(s,0,0,'TEST');
 const asset=s.players[1].assets[0].id;
 assert.ok(v.spellTargets[spell].find(o=>o.id===asset).name.includes('资产原始牌名'));
 assert.deepEqual(s,before,'视图不得更改对局状态');
 cmd(s,0,{type:'play',cardId:spell,targetIds:[asset]});
 for(const p of [0,1])assert.equal(viewFor(s,p,0,'TEST').currentTargets[asset][0].id,`stack:${s.flow.stack[0].id}`);
});
test('堆叠名称区分角色、事务和独立能力',()=>{
 assert.equal(stackEntryLabel({kind:'play-character',displayName:'角色甲'}),'角色甲 · 等待进场');
 assert.equal(stackEntryLabel({kind:'play-spell',displayName:'附属甲',cardType:'attachment'}),'附属甲 · 附属');
 assert.equal(stackEntryLabel({kind:'auto-ability',displayName:'能力甲'}),'能力甲 · 能力');
});
