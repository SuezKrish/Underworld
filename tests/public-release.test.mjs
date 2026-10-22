import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {offlineContext} from '../offline/service.mjs';
import {BOT_PROFILES} from '../engine/bot-deck.mjs';
import {validateDeck} from '../engine/decks.mjs';
import {simulateBotMatch} from '../engine/bot-simulation.mjs';
import {cardRevisionHistory} from '../engine/card-revision-history.mjs';
import {revisionOverview} from '../engine/revision-overview.mjs';
import {defaultPoolSettings,changeAvailability,requireCurrentPool} from '../engine/card-pool.mjs';
const xml=readFileSync(new URL('../data/Card.xml',import.meta.url),'utf8');
const ctx=offlineContext(xml);

test('the standard pool has matching source and complete automated definitions',()=>{
 assert.equal(ctx.cards.length,738);
 assert.equal(ctx.compiled.length+ctx.environment.length,ctx.cards.length);
 assert.equal(ctx.implemented.size,ctx.cards.length);
 assert.ok(ctx.cards.every(c=>!c.id.includes('QS')));
});
test('eight Bot decks are valid in the published pool',()=>{
 assert.equal(BOT_PROFILES.length,8);
 for(const p of BOT_PROFILES){const v=validateDeck(p.deck,ctx.cards,ctx.implemented);assert.equal(v.playable,true,JSON.stringify({id:p.id,...v}));}
});
test('the fixed standard card pool has no alternate mode setting',()=>{
 assert.deepEqual(defaultPoolSettings(),{disabledCards:[],disabledSets:[]});
 assert.throws(()=>changeAvailability(defaultPoolSettings(),ctx.cards,{type:'set-test-mode',enabled:true}));
 assert.doesNotThrow(()=>requireCurrentPool({status:'waiting',cardPoolRevision:3},3));
 assert.throws(()=>requireCurrentPool({status:'waiting',cardPoolRevision:2},3));
});
test('revisions are original and final comparisons without internal notes',()=>{
 const history=cardRevisionHistory(ctx.cards),rows=history.cards.filter(c=>revisionOverview(c).length);
 assert.equal(rows.length,118);
 assert.ok(rows.every(c=>c.revisions.every(r=>!r.note&&!r.date)));
 assert.ok(rows.every(c=>revisionOverview(c).every(r=>!r.before.includes('FAQ')&&!r.after.includes('FAQ'))));
});
for(const difficulty of ['normal','hard'])for(const [i,profile] of BOT_PROFILES.entries())test(`${difficulty} Bot startup smoke ${profile.id}`,()=>{
 const r=simulateBotMatch({seed:20261022+i,profiles:[profile.id,BOT_PROFILES[(i+1)%BOT_PROFILES.length].id],difficulty,maxCommands:70,openingFirstPlayer:i%2});
 assert.ok(r.commands>0||r.steps>0||r.round>=1,JSON.stringify(r));
 assert.equal(r.stalled,null,JSON.stringify({profile:profile.id,reason:r.stalled}));
});
