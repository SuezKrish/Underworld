import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,put,cmd,approve} from './test-fixture.mjs';
import {moveCard,viewFor} from './match.mjs';
import {transferControl,controllerOf} from './ownership.mjs';
const view=(s,p=0)=>viewFor(s,p,0,'TEST');
const request=(s,operation,cardIds,p=0)=>cmd(s,p,{type:'manual-request',operation,cardIds});
test('检视后的牌库牌经对手批准置于手中，拒绝和自确认不移动，检视和申请不占撤销',()=>{
 const s=fixture(),id=s.players[0].deck[0],hand=s.players[0].hand.length;
 assert.throws(()=>request(s,'to-hand',[id]),/已检视/);
 approve(s,0,'inspect',{zone:'top',count:1});request(s,'to-hand',[id]);
 assert.equal(s.locations[id].zone,'deck');assert.equal(s.undoFrames?.length??0,0);
 assert.ok(!JSON.stringify(view(s,1).manualRequest).includes(s.cards[id].name));
 assert.throws(()=>cmd(s,0,{type:'manual-confirm',requestId:s.manualRequest.id,accept:true}),/对手/);
 cmd(s,1,{type:'manual-confirm',requestId:s.manualRequest.id,accept:false});assert.equal(s.locations[id].zone,'deck');
 approve(s,0,'to-hand',{cardIds:[id]});assert.equal(s.locations[id].zone,'hand');assert.equal(s.players[0].hand.length,hand+1);
 assert.equal(view(s).inspection,null);assert.equal(s.undoFrames.length,1);
 approve(s,1,'undo');assert.equal(s.locations[id].zone,'deck');assert.equal(s.players[0].deck[0],id);
});
for(const zone of ['graveyard','headquarters','play','asset','sealed'])test(`${zone}中自己拥有的单张牌可置于手中，拥有者不变`,()=>{
 const s=fixture(),id=put(s,'JC125');
 moveCard(s,id,zone,zone==='play'?{district:0}:zone==='sealed'?{hostId:'society:0',hostVersion:0}:{});
 if(zone==='play')transferControl(s,id,1);
 assert.ok(view(s).ownedReturnCandidates.some(c=>c.id===id));
 approve(s,0,'to-hand',{cardIds:[id]});assert.equal(s.locations[id].zone,'hand');assert.equal(s.cards[id].owner,0);assert.equal(controllerOf(s,id),0);
});
test('取回宿主照常使结附入墓及封印回手，不把置于手中计为抓牌',()=>{
 const s=fixture(),host=put(s,'JC125',0,'play',{district:0}),sealed=put(s,'JC125'),attachment=put(s,'LC02',0,'play',{district:0,attachedTo:host,hostVersion:1});
 moveCard(s,sealed,'sealed',{hostId:host,hostVersion:1});
 approve(s,0,'to-hand',{cardIds:[host]});assert.equal(s.locations[sealed].zone,'hand');assert.equal(s.locations[attachment].zone,'graveyard');
});
for(const op of ['deck-top','deck-bottom'])for(const count of [1,3])test(`${op}放置${count}张：所选连续置顶底，原牌库其余顺序不变`,()=>{
 const s=fixture(),deck=[...s.players[0].deck],ids=Array.from({length:count},()=>put(s,'JC125'));
 approve(s,0,op,{cardIds:ids});const actual=s.players[0].deck;
 assert.deepEqual(op==='deck-top'?actual.slice(count):actual.slice(0,-count),deck);
 assert.deepEqual((op==='deck-top'?actual.slice(0,count):actual.slice(-count)).toSorted(),ids.toSorted());
 assert.equal(new Set(actual).size,actual.length);
});
test('检视的牌库内卡牌可重新置底，不重复加入也不打乱其他牌',()=>{
 const s=fixture(),deck=[...s.players[0].deck],id=deck[0];approve(s,0,'inspect',{zone:'top',count:1});approve(s,0,'deck-bottom',{cardIds:[id]});
 assert.deepEqual(s.players[0].deck,[...deck.slice(1),id]);
});
test('拒绝不属于自己的牌、重复句柄和旧洗回操作',()=>{
 const s=fixture(),enemy=put(s,'JC125',1,'play',{district:0}),own=put(s,'JC125',0,'play',{district:0}),hidden=put(s,'JC125',0,'play',{faceDown:true,district:0,hiddenHandle:'alias'});
 transferControl(s,enemy,0);assert.throws(()=>request(s,'to-hand',[enemy]),/拥有者/);

 assert.throws(()=>request(s,'deck-top',[hidden,'hidden:alias']),/重复/);
 assert.throws(()=>request(s,'recycle',[own]),/无效/);assert.equal(s.manualRequest,null);
});
test('确认时检查申请对象是否已离开原区域，拒绝陈旧对象且不部分移动',()=>{
 const s=fixture(),a=put(s,'JC125'),b=put(s,'JC125'),deck=[...s.players[0].deck];request(s,'deck-top',[a,b]);
 moveCard(s,b,'graveyard');const rid=s.manualRequest.id;
 assert.throws(()=>cmd(s,1,{type:'manual-confirm',requestId:rid,accept:true}),/改变位置/);
 assert.equal(s.locations[a].zone,'hand');assert.deepEqual(s.players[0].deck,deck);assert.equal(s.manualRequest.id,rid);
});
test('免确认房间双方直接检视、取手、置顶底、抓牌与撤销，检视不占撤销',()=>{
 for(const p of [0,1]){
  const s=fixture();s.manualWithoutConsent=true;
  assert.equal(view(s,p).manualWithoutConsent,true);const id=s.players[p].deck[0];
  cmd(s,p,{type:'manual-request',operation:'inspect',zone:'top',count:1});assert.equal(s.manualRequest,null);assert.equal(view(s,p).inspection.cards[0].id,id);
  const frames=s.undoFrames?.length??0;request(s,'to-hand',[id],p);assert.equal(s.locations[id].zone,'hand');assert.equal(s.manualRequest,null);assert.equal(s.undoFrames.length,frames+1);
  cmd(s,p,{type:'manual-request',operation:'undo'});assert.equal(s.locations[id].zone,'deck');
  request(s,'deck-bottom',[s.players[p].hand[0]],p);assert.equal(s.manualRequest,null);
  cmd(s,p,{type:'manual-request',operation:'draw',count:1});assert.equal(s.manualRequest,null);
  assert.ok(s.logs.some(l=>l.text.includes('免确认')));
 }
});
test('普通房间无法通过命令自行绕过确认；免确认也不绕过结算选择',()=>{
 const s=fixture(),id=put(s,'JC125');cmd(s,0,{type:'manual-request',operation:'deck-top',cardIds:[id],manualWithoutConsent:true});assert.equal(s.locations[id].zone,'hand');assert.ok(s.manualRequest);
 cmd(s,0,{type:'manual-cancel',requestId:s.manualRequest.id});s.manualWithoutConsent=true;s.flow.locked=true;
 assert.throws(()=>request(s,'to-hand',[id]),/快速行动窗口/);assert.equal(s.manualRequest,null);
});
for(const zone of ['top','bottom'])test(`${zone}检视后可自行排列，批准前无改动、批准后保持其余牌序，撤销恢复原牌库`,()=>{
 const s=fixture(),original=[...s.players[0].deck];approve(s,0,'inspect',{zone,count:3});const inspection=s.privateInspections[0],order=[...inspection.ids].reverse();
 cmd(s,0,{type:'manual-request',operation:'reorder-inspection',inspectionId:inspection.id,cardIds:order});assert.deepEqual(s.players[0].deck,original);assert.equal(s.undoFrames.length,0);assert.ok(!JSON.stringify(view(s,1).manualRequest).includes(order[0]));
 cmd(s,1,{type:'manual-confirm',requestId:s.manualRequest.id,accept:true});assert.deepEqual(s.players[0].deck,zone==='top'?[...order,...original.slice(3)]:[...original.slice(0,-3),...order]);assert.equal(view(s).inspection,null);assert.equal(s.undoFrames.length,1);approve(s,1,'undo');assert.deepEqual(s.players[0].deck,original);
});
test('检视排序拒绝缺牌、重复、外部牌、过期检视和确认时改变的牌库',()=>{
 const s=fixture();approve(s,0,'inspect',{zone:'top',count:3});const v=s.privateInspections[0];for(const ids of [[v.ids[0]],[v.ids[0],v.ids[0],v.ids[1]],[...v.ids.slice(1),s.players[0].deck[5]]])assert.throws(()=>cmd(s,0,{type:'manual-request',operation:'reorder-inspection',inspectionId:v.id,cardIds:ids}),/排序/);
 assert.throws(()=>cmd(s,0,{type:'manual-request',operation:'reorder-inspection',inspectionId:'old',cardIds:v.ids}),/检视/);
 cmd(s,0,{type:'manual-request',operation:'reorder-inspection',inspectionId:v.id,cardIds:[...v.ids].reverse()});s.players[0].deck.reverse();const before=structuredClone(s);assert.throws(()=>cmd(s,1,{type:'manual-confirm',requestId:s.manualRequest.id,accept:true}),/改变/);assert.deepEqual(s,before);
});
for(const zone of ['hand','play','sealed','asset'])test(`${zone}自己的卡牌可经对手确认入墓，保留拥有者；附属和封印解除按规则处理`,()=>{
 const s=fixture(),id=put(s,'JC125');if(zone!=='hand')moveCard(s,id,zone,zone==='play'?{district:0}:zone==='sealed'?{hostId:'society:0',hostVersion:0}:{});if(zone==='play')transferControl(s,id,1);
 request(s,'to-graveyard',[id]);assert.equal(s.locations[id].zone,zone);cmd(s,1,{type:'manual-confirm',requestId:s.manualRequest.id,accept:true});assert.equal(s.locations[id].zone,'graveyard');assert.equal(s.cards[id].owner,0);assert.equal(s.undoFrames.length,1);
});
test('手动入墓拒绝他人拥有的牌；指示物按规则回备牌；总部替代仍适用',()=>{
 const s=fixture(),enemy=put(s,'JC125',1,'play',{district:0});transferControl(s,enemy,0);assert.throws(()=>request(s,'to-graveyard',[enemy]),/拥有者/);s.manualWithoutConsent=true;const token=put(s,'TK001',0,'play',{district:0});request(s,'to-graveyard',[token]);assert.equal(s.locations[token].zone,'reserve');s.players[0].headquartersActive=true;const card=put(s,'JC125');request(s,'to-graveyard',[card]);assert.equal(s.locations[card].zone,'headquarters');
});
test('免确认房间支持顶底排序；房间消息双方可见，在待确认和锁定窗口也可发送，不改变优先权和撤销',()=>{
 const s=fixture();s.manualWithoutConsent=true;cmd(s,0,{type:'manual-request',operation:'inspect',zone:'bottom',count:3});const v=s.privateInspections[0],order=[...v.ids].reverse();cmd(s,0,{type:'manual-request',operation:'reorder-inspection',inspectionId:v.id,cardIds:order});assert.deepEqual(s.players[0].deck.slice(-3),order);const frames=s.undoFrames.length,flow=structuredClone(s.flow);s.manualWithoutConsent=false;request(s,'to-hand',[s.players[0].graveyard[0]??put(s,'JC125',0,'play',{district:0})]);cmd(s,1,{type:'room-message',text:'请调整顺序\n然后继续'});assert.equal(view(s,0).logs.at(-1).text,'乙：请调整顺序\n然后继续');assert.equal(view(s,1).logs.at(-1).kind,'message');assert.deepEqual(s.flow,flow);assert.equal(s.undoFrames.length,frames);cmd(s,0,{type:'manual-cancel',requestId:s.manualRequest.id});s.flow.locked=true;cmd(s,0,{type:'room-message',text:'<script>不会执行</script>'});assert.equal(s.flow.locked,true);assert.throws(()=>cmd(s,0,{type:'room-message',text:' '.repeat(5)}),/消息/);assert.throws(()=>cmd(s,0,{type:'room-message',text:'字'.repeat(1001)}),/消息/);
});
