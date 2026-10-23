import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,put,defs} from './test-fixture.mjs';
import {viewFor} from './match.mjs';
import {cachedViewFor} from './cached-view.mjs';
import {withProjectionReads} from './projection-read-cache.mjs';
import {BOT_PROFILES} from './bot-deck.mjs';
import {botCommands} from './bot-policy.mjs';
import {hardBotView,hardLibraryWeights} from './hard-bot-policy.mjs';

function setup(){
 const s=fixture(),keep=new Set(s.players.flatMap(p=>p.assets.slice(0,4).map(a=>a.id)));
 for(const id of Object.keys(s.cards))if(!keep.has(id)){delete s.cards[id];delete s.locations[id];}
 for(const player of s.players)for(const zone of ['hand','deck','play','graveyard','aside'])player[zone]=[];
 for(const p of [0,1]){
  s.players[p].assets=s.players[p].assets.slice(0,4);
  for(const code of ['JC078','WM089','XG01','CQ31','BQ086'])put(s,code,p,'deck');
  for(const code of ['JC078','WM089','XG01'])put(s,code,p);
  for(const code of ['BH11','CQ32','WM060'])put(s,code,p,'play',{controller:p,district:p});
 }
 s.bot={id:BOT_PROFILES[0].id,seat:0,difficulty:'normal',actionKeys:[]};return s;
}
test('只读缓存完整保留双方界面、能力说明和八套Bot在各阶段的决策',()=>{
 const s=setup();for(const profile of BOT_PROFILES)for(const phase of ['action','contest','end']){
  s.bot.id=profile.id;s.turn.phase=phase;s.turn.step=phase==='action'?'first-action':phase==='contest'?'contest-before':'end';s.turn.kind='battle';s.turn.district=0;
  for(const p of [0,1]){const raw=viewFor(s,p,2,'BOT'),fast=cachedViewFor(s,p,2,'BOT');assert.deepEqual(fast,raw);assert.deepEqual(botCommands(fast),botCommands(raw));}
 }
});
test('困难Bot获取全部信息和选择未知牌时的各用途评分保持一致',()=>{
 const s=setup();s.bot.difficulty='hard';for(const profile of BOT_PROFILES){s.bot.id=profile.id;
  const raw=hardBotView(s,viewFor,{observe:false}),fast=hardBotView(s,cachedViewFor,{observe:false});assert.deepEqual(fast,raw);assert.deepEqual(botCommands(fast),botCommands(raw));
  for(const kind of ['hand','graveyard','seal'])assert.deepEqual(hardLibraryWeights(s,{kind},cachedViewFor),hardLibraryWeights(s,{kind},viewFor));
 }
});
test('沉默、失去能力、尼索斯防御层和两次读取之间的状态变化不会复用过期结果',()=>{
 const s=setup(),host=s.players[0].play.at(-1),hostLoc=s.locations[host];
 for(const code of defs.filter(c=>c.automation?.silenceAttachedAbilities||['blank-host-text','district-role-silence','nisos-silence'].includes(c.automation?.static)).map(c=>c.catalogId)){
  const source=put(s,code,1,'play',{controller:1,district:0,attachedTo:host,hostVersion:hostLoc.zoneVersion});
  assert.deepEqual(cachedViewFor(s,0,0,'BOT'),viewFor(s,0,0,'BOT'),code);
  s.locations[source].faceDown=true;assert.deepEqual(cachedViewFor(s,0,0,'BOT'),viewFor(s,0,0,'BOT'),code+' hidden');
  s.locations[source].faceDown=false;s.locations[source].tapped=true;assert.deepEqual(cachedViewFor(s,0,0,'BOT'),viewFor(s,0,0,'BOT'),code+' tapped');
  s.players[1].play=s.players[1].play.filter(id=>id!==source);delete s.locations[source];delete s.cards[source];
 }
 s.effects.push({kind:'blank-printed-rules',targetId:host,targetZoneVersion:hostLoc.zoneVersion});assert.deepEqual(cachedViewFor(s,0,0,'BOT'),viewFor(s,0,0,'BOT'));
 s.effects=[];assert.deepEqual(cachedViewFor(s,0,0,'BOT'),viewFor(s,0,0,'BOT'));
 assert.throws(()=>withProjectionReads(()=>{viewFor(s,0,0,'BOT');throw Error('test');}));assert.deepEqual(cachedViewFor(s,0,0,'BOT'),viewFor(s,0,0,'BOT'));
});
