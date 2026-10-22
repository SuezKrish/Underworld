import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,cmd,approve,put,resolve} from './test-fixture.mjs';
import {parseCatalog} from './catalog.mjs';
import {compileSupported} from './automation.mjs';
import {compileEnvironment} from './environment-definitions.mjs';
import {prepareCodeDeck} from './match-deck.mjs';
import {BOT_DECK_CODE} from './bot-deck.mjs';
import {createRoomState,joinSeat,viewFor} from './match.mjs';
import {undoSnapshot,UNDO_HISTORY_LIMIT} from './manual.mjs';
import {serializeRoomState,deserializeRoomState} from './room-storage.mjs';
import {runBot} from './bot.mjs';

const cards=parseCatalog(readFileSync(new URL('../data/Card.xml',import.meta.url),'utf8')).cards;
const compiled=compileSupported(cards);
function constructed(){
 const s=createRoomState('甲','a','automation-play',compiled,compiled.filter(c=>c.token),compileEnvironment(cards));
 const selection=()=>prepareCodeDeck(BOT_DECK_CODE,{cards,compiled,implemented:new Set(compiled.map(c=>c.catalogId)),revision:0,poolRevision:0});
 s.deckSelections=[selection(),selection()];s.deckRequired=true;joinSeat(s,'乙','b');cmd(s,0,{type:'ready'});cmd(s,1,{type:'ready'});
 s.turn={...s.turn,firstPlayer:0,phase:'action',step:'first-action',actionClosed:false};s.flow={...s.flow,priority:0,stepOwner:0,locked:false};s.roundChoice=null;
 s.cardNamePool=cards.map(c=>({name:c.name,magicDomains:[c.magic]}));s.characterNames=cards.map(c=>c.name);return s;
}
for(const automatic of [false,true])test(`构筑对局持久化后连续撤销八次，静态卡组资料只存一份（免确认=${automatic}）`,()=>{
 let s=constructed();s.manualWithoutConsent=automatic;
 const initialHand=[...s.players[0].hand],initialDeck=[...s.players[0].deck],catalogs=structuredClone({deckSelections:s.deckSelections,cardNamePool:s.cardNamePool,characterNames:s.characterNames});
 const action=operation=>{if(automatic)cmd(s,0,{type:'manual-request',operation,count:1});else approve(s,0,operation,{count:1});s=deserializeRoomState(serializeRoomState(s));};
 for(let n=1;n<=8;n++){action('draw');assert.equal(s.undoFrames.length,n);assert.equal(s.players[0].hand.length,initialHand.length+n);}
 assert.ok(Buffer.byteLength(JSON.stringify(s.undoFrames))<=650000);
 for(const frame of s.undoFrames)for(const key of Object.keys(catalogs))assert.equal(Object.hasOwn(frame.state,key),false);
 for(let n=7;n>=0;n--){action('undo');assert.equal(s.undoFrames.length,n);assert.equal(s.players[0].hand.length,initialHand.length+n);assert.equal(viewFor(s,0,0,'TEST').undoAvailable,n>0);}
 assert.deepEqual(s.players[0].hand,initialHand);assert.deepEqual(s.players[0].deck,initialDeck);
 for(const [key,value] of Object.entries(catalogs))assert.deepEqual(s[key],value);
});
test('BOT批准撤销后不重做操作，暂停时仍能批准下一次撤销，显式继续不占历史',()=>{
 let s=fixture();for(const p of s.players)p.deck=p.deck.slice(0,50);const retained=new Set(s.players.flatMap(p=>[...p.hand,...p.deck,...p.play,...p.assets.map(a=>a.id)]));s.cards=Object.fromEntries(Object.entries(s.cards).filter(([id])=>retained.has(id)));s.locations=Object.fromEntries(Object.entries(s.locations).filter(([id])=>retained.has(id)));s.bot={id:'white-anglican',seat:1,pending:false,actionKeys:[]};
 cmd(s,0,{type:'tap-asset',assetId:s.players[0].assets[0].id});cmd(s,0,{type:'tap-asset',assetId:s.players[0].assets[1].id});assert.equal(s.players[0].costPool,2);
 cmd(s,0,{type:'manual-request',operation:'undo'});runBot(s);assert.equal(s.players[0].costPool,1);assert.equal(s.undoFrames.length,1);assert.equal(viewFor(s,0,0,'TEST').bot.undoPaused,true);
 s=deserializeRoomState(serializeRoomState(s));assert.equal(runBot(s).actions,0);assert.equal(s.undoFrames.length,1);
 cmd(s,0,{type:'manual-request',operation:'undo'});runBot(s);assert.equal(s.players[0].costPool,0);assert.equal(s.undoFrames.length,0);assert.equal(s.bot.undoPaused,true);
 cmd(s,0,{type:'bot-resume'});assert.equal(s.bot.undoPaused,false);assert.equal(s.undoFrames.length,0);
 assert.throws(()=>cmd(s,0,{type:'bot-resume'}),/没有因撤销暂停/);
});
test('未启用免确认的BOT对局拒绝隐藏信息手动检视，启用后可以直接检视',()=>{
 const s=fixture();s.bot={id:'white-anglican',seat:1};
 for(const zone of ['deck','top','bottom'])assert.throws(()=>cmd(s,0,{type:'manual-request',operation:'inspect',zone,count:1}),/未启用隐藏信息/);
 s.manualWithoutConsent=true;cmd(s,0,{type:'manual-request',operation:'inspect',zone:'top',count:1});assert.equal(viewFor(s,0,0,'TEST').inspection.count,1);
});
test('撤销恢复势力变化记录，不能把撤销本身当作移除势力事件',()=>{
 const s=fixture();s.districts[0].influence[0]=1;s.undoFrames=[{state:undoSnapshot(s),label:'势力奖励'}];s.districts[0].influence[0]=3;
 approve(s,0,'undo');assert.equal(s.districts[0].influence[0],1);assert.equal(s.influenceRemovedRound,undefined);
});
test('构筑对局每步存读后保留64次操作，连续撤销越过旧8步边界',()=>{
 let s=constructed();s.manualWithoutConsent=true;
 for(let i=0;i<UNDO_HISTORY_LIMIT+4;i++){
  cmd(s,0,{type:'manual-request',operation:'add-mana',count:1});
  const saved=serializeRoomState(s);assert.ok(Buffer.byteLength(saved)<1900000);s=deserializeRoomState(saved);
  assert.equal(s.undoFrames.length,Math.min(i+1,UNDO_HISTORY_LIMIT));
 }
 for(let i=UNDO_HISTORY_LIMIT;i>0;i--){
  cmd(s,0,{type:'manual-request',operation:'undo'});s=deserializeRoomState(serializeRoomState(s));
  assert.equal(s.undoFrames.length,i-1);assert.equal(s.players[0].costPool,i+3);
 }
 assert.equal(viewFor(s,0,0,'COPY').undoAvailable,false);
});
for(const automatic of [false,true])test(`雾羽弥生饮血选择无快速窗口仍可撤销并继续越过八步（免确认=${automatic}）`,()=>{
 let s=constructed();s.manualWithoutConsent=automatic;
 const undo=()=>{if(automatic)cmd(s,0,{type:'manual-request',operation:'undo'});else approve(s,0,'undo');s=deserializeRoomState(serializeRoomState(s));};
 for(let i=0;i<12;i++){if(automatic)cmd(s,0,{type:'manual-request',operation:'add-mana',count:1});else approve(s,0,'add-mana',{count:1});}
 const id=put(s,'BQ034'),blood=put(s,'BQ040',0,'graveyard');
 s.players[0].ignoreLoyalty=true;cmd(s,0,{type:'play',cardId:id,district:0});resolve(s);
 const a=s.triggerChoices.find(a=>a.cardId===id);assert.ok(a);cmd(s,0,{type:'trigger-choice',triggerId:a.id,fire:true});resolve(s);
 assert.equal(s.effectChoice.kind,'discard-deck-drink');assert.equal(s.flow.locked,true);
 s=deserializeRoomState(serializeRoomState(s));undo();assert.equal(s.effectChoice,null);
 assert.ok(s.flow.stack.some(a=>a.cardId===id));
 let steps=1;while(s.undoFrames.length){undo();steps++;assert.ok(steps<40);}
 assert.ok(steps>12);assert.equal(s.players[0].costPool,0);assert.equal(s.locations[blood],undefined);
});
