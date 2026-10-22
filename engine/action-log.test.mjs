import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,put,cmd,resolve} from './test-fixture.mjs';
import {effectObjectsLog,paidCostsLog} from './action-log.mjs';
const last=s=>s.logs.at(-1).text;
test('角色打出记录实际费用和进场地区；付费翻面也记录地区',()=>{
 const s=fixture(),id=put(s,'XQ28');cmd(s,0,{type:'play',cardId:id,district:1});
 assert.match(last(s),/打出冥想者，支付2点费用，将进入地区2，进入堆叠/);
 const hidden=put(s,'XQ28',0,'play',{controller:0,district:2,faceDown:true,hiddenHandle:'x'});
 cmd(s,0,{type:'reveal',cardId:hidden});assert.match(last(s),/支付2点费用.*付费翻面，将进入地区3/);resolve(s);assert.ok(s.logs.some(l=>l.text==='冥想者付费翻面。'));assert.ok(!s.logs.some(l=>l.text.includes('视为角色进场')));
});
test('混乱角色声明时不记录伪造的固定地区，实际进场另有日志',()=>{
 const s=fixture(),id=put(s,'XG14');cmd(s,0,{type:'play',cardId:id,district:0});
 assert.match(last(s),/具有混乱，结算时随机决定进场地区/);assert.doesNotMatch(last(s),/将进入地区1/);
 resolve(s);assert.ok(s.logs.some(l=>new RegExp(`朽灭者在地区${s.locations[id].district+1}进场`).test(l.text)));
});
test('事务记录实际减费后的支付与多个效果对象，行动记录牺牲费用',()=>{
 const s=fixture(),target=put(s,'BQ031',1,'play',{controller:1,district:1}),source=put(s,'BQ027',0,'play',{controller:0,district:0});
 cmd(s,0,{type:'activate',cardId:source,targetIds:[target]});
 assert.ok(s.logs.some(l=>/血畜.*牺牲血畜，效果对象：雾羽千军（地区2）/.test(l.text)));
 resolve(s);s.flow.priority=0;const spell=put(s,'JC078');s.effects.push({kind:'next-cost-discount',controller:0,amount:99,filter:{},duration:'until-end-of-round'});
 cmd(s,0,{type:'play',cardId:spell,targetIds:[target]});
 assert.match(last(s),/效果对象：雾羽千军（地区2）/);assert.doesNotMatch(last(s),/支付0点费用|，，/);
});
test('公开日志区分资产、墓地、秘社、地区、堆叠对象，不泄漏隐藏牌面',()=>{
 const s=fixture(),asset=s.players[1].assets[0].id,grave=put(s,'JC125',0,'graveyard'),hidden=put(s,'BQ031',1,'play',{controller:1,district:2,faceDown:true,hiddenHandle:'private'}),sealed=put(s,'BQ034',1,'graveyard');s.locations[sealed]={zone:'sealed',zoneVersion:2,faceDown:true,hostId:'society:1'};
 const targets=[{kind:'card',cardId:asset},{kind:'card',cardId:grave},{kind:'card',cardId:hidden},{kind:'card',cardId:sealed},{kind:'player',player:1},{kind:'society',player:0},{kind:'district',district:0}];
 s.flow.stack.push({id:'secret',cardId:sealed,displayName:'不可公开的名称'});s.locations[sealed].secretPlan=true;targets.push({kind:'stack',entryId:'secret'});
 const text=effectObjectsLog(s,targets);assert.match(text,/资产区.*墓地.*暗藏者（地区3）.*秘密计划.*地区1.*堆叠中的秘密计划/);
 assert.doesNotMatch(text,/雾羽千军|雾羽弥生|不可公开/);
 assert.equal(effectObjectsLog(s,[]),'');
});
test('费用代付区分实际费用池支付、代付及名誉点，横置背面牌不暴露名称',()=>{
 const s=fixture(),id=put(s,'JC125',0,'play',{controller:0,district:0,secretPlan:true});
 const text=paidCostsLog(s,5,{sourceId:id,tap:true,honorCost:1},{actionPayments:[{cardId:id,amount:3}]});
 assert.match(text,/支付2点费用.*代付3点.*横置秘密计划.*支付1名誉点/);
});
