import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,put,cmd,resolve,emitWithChoices} from './test-fixture.mjs';
import {viewFor,moveCard} from './match.mjs';
import {createAutomationEngine} from './automation.mjs';
import {hasBarrier} from './derived.mjs';

const field=(s,code,p=0,district=0,extra={})=>put(s,code,p,'play',{controller:p,district,tapped:false,...extra});
function setup(){
 const s=fixture();s.players[0].ignoreLoyalty=true;
 for(const p of [0,1]){const id=`society:${p}`;s.cards[id]={id,type:'society',name:'测试秘社',owner:p};s.locations[id]={zone:'society',zoneVersion:0,controller:p};}
 return s;
}
function meditation(s){return field(s,'XQ32',0,undefined,{attachedTo:'society:0',hostVersion:0});}
function arsonist(s,p=1){const id=field(s,'JC043',p);emitWithChoices(s,id,'entry');return s.triggerChoices.find(a=>a.cardId===id);}
const fire=(s,a,id)=>cmd(s,a.controller,{type:'trigger-choice',triggerId:a.id,fire:true,targetIds:[id]});

test('朽灭者可不声明地区打出，结算进场才从合法地区随机选择',()=>{
 const s=setup(),id=put(s,'XG14');
 for(const d of [0,2])field(s,'JC064',0,d,{attachedTo:`district-host:${s.districts[d].id}`,hostVersion:s.districts[d].id});
 cmd(s,0,{type:'play',cardId:id});assert.equal(s.locations[id].zone,'stack');resolve(s);
 assert.equal(s.locations[id].zone,'play');assert.equal(s.locations[id].district,1);
});
test('混乱打出忽略外部提交的地区；普通角色仍要求选择地区',()=>{
 const s=setup(),id=put(s,'XG14');cmd(s,0,{type:'play',cardId:id,district:999});resolve(s);assert.ok(s.districts[s.locations[id].district]);
 const other=setup(),ordinary=put(other,'JC125');assert.throws(()=>cmd(other,0,{type:'play',cardId:ordinary}),/请选择/);
});
test('混乱不改变秘密派遣地区的主动选择',()=>{
 const s=setup(),id=put(s,'XG14');cmd(s,0,{type:'secret-deploy',cardId:id,district:2});assert.equal(s.locations[id].district,2);assert.equal(s.locations[id].faceDown,true);
});
test('面壁苦修受赛伊拉屏障保护时，不出现在敌方纵火狂目标中，强行提交也拒绝',()=>{
 const s=setup(),target=meditation(s);field(s,'BH36');assert.equal(hasBarrier(s,target),true);
 const a=arsonist(s);assert.ok(a);assert.ok(!viewFor(s,1).abilityTargets[a.id].some(o=>o.id===target));assert.throws(()=>fire(s,a,target),/不合法/);assert.equal(s.locations[target].zone,'play');
});
test('纵火狂已入栈后获得屏障，结算目标无效且保留附属',()=>{
 const s=setup(),target=meditation(s),a=arsonist(s);fire(s,a,target);field(s,'BH36');
 assert.ok(s.flow.stack.some(x=>x.cardId===a.cardId));resolve(s);assert.equal(s.locations[target].zone,'play');
});
test('响应期间获得又失去屏障，纵火狂结算时仍能消灭原目标',()=>{
 const s=setup(),target=meditation(s),a=arsonist(s);fire(s,a,target);const shielder=field(s,'BH36');moveCard(s,shielder,'hand');resolve(s);assert.equal(s.locations[target].zone,'graveyard');
});
test('屏障允许本方纵火狂指定本方附属，非目标选择也保留既有通则',()=>{
 const s=setup(),target=meditation(s);field(s,'BH36');const a=arsonist(s,0);assert.ok(viewFor(s,0).abilityTargets[a.id].some(o=>o.id===target));
 const engine=createAutomationEngine({});assert.ok(engine.options(s,1,{target:'society-or-source-district-attachment',nonTargeted:true,sourceId:a.cardId,sourceDistrict:0,sourceDistrictCardId:s.districts[0].id}).some(o=>o.id===target));
 fire(s,a,target);resolve(s);assert.equal(s.locations[target].zone,'graveyard');
});
