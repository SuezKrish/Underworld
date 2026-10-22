import {currentTriggerRound} from './trigger-round.mjs';
import {runDeathCommand} from './death-costs.mjs';
import {undoSnapshot} from './manual.mjs';
import {keywordAmount} from './derived.mjs';
import {readFileSync} from 'node:fs';
import {parseCatalog} from './catalog.mjs';
import {compileSupported,createAutomationEngine} from './automation.mjs';
import {createRoomState,joinSeat,command,moveCard} from './match.mjs';
// Ability tests isolate the existing ability implementation. Production catalog
// eligibility, including unique rules, is verified separately in metadata tests.
export const defs=compileSupported(parseCatalog(readFileSync(new URL('../data/Card.xml',import.meta.url),'utf8')).cards.map(c=>({...c,unique:0})));
export function cmd(s,p,c){
 const offered=s.deathContinuation?.choice,legacy=['trigger-choice','environment-trigger'].includes(c?.type)&&offered?.kind==='trigger-cost'&&c.triggerId===offered.ability.id;
 const op={id:crypto.randomUUID(),...c,...(legacy?{type:'trigger-cost-choice',choiceId:offered.id}:{})};
 const synthetic=(s.deathContinuation?.command??c).type;
 const result=['fixture-move','fixture-event'].includes(synthetic)?runDeathCommand(s,p,op,(s,p,c,checkpoint)=>{checkpoint.before??=undoSnapshot(s);if(c.type==='fixture-move')return moveCard(s,c.cardId,c.zone,c.extra);return createAutomationEngine({move:moveCard,log(){},registerGroup(){},pay(s,p,n){const pool=s.players[p].costPool??0,assets=s.players[p].assets.filter(a=>!a.tapped);if(pool+assets.length<n)throw Error('可用资产不足');const fromPool=Math.min(n,pool);s.players[p].costPool=pool-fromPool;for(let i=0;i<n-fromPool;i++)assets[i].tapped=true;},trigger(s,a){s.pendingTriggers.push(a);}}).event(s,c.cardId,c.event,c.loc,c.group,c.details);}):command(s,p,op);
 // Legacy card tests' "fire" helper means both activate and enqueue. New timing
 // tests use explicit trigger-cost-choice and trigger-round commands instead.
 if(['trigger-choice','environment-trigger'].includes(c.type)&&!s.deathContinuation&&!s.effectChoice&&!s.triggerChoices.length&&s.pendingTriggers.some(a=>a.prepaid&&!a.triggerRoundNumber))stackPaidTriggers(s);
 return result;
}
export function offeredTriggers(s){const a=s.deathContinuation?.choice;return a?.kind==='trigger-cost'?[...s.triggerChoices,a.ability]:s.triggerChoices;}
export function testCostPool(s,p,n){s.players[p].costPool=n;if(s.deathContinuation)s.deathContinuation.before.players[p].costPool=n;}

// Low-level departure tests still use the same serializable replay boundary as
// real commands, so event-time choices finish before the departure continues.
export const moveWithChoices=(s,id,zone,extra={})=>cmd(s,s.locations[id]?.controller??s.cards[id].owner,{type:'fixture-move',cardId:id,zone,extra});
export function payTriggeredCost(s,extra={}){const a=s.deathContinuation?.choice;if(a?.kind!=='trigger-cost')throw Error('Missing immediate trigger cost');cmd(s,a.controller,{type:'trigger-cost-choice',choiceId:a.id,fire:true,targetIds:[],...extra});return a.ability;}

export function fixture(){const reserve=defs.filter(x=>x.token).map(x=>({...x,automated:true})),s=createRoomState('甲','a','automation-play',defs,reserve);joinSeat(s,'乙','b');cmd(s,0,{type:'ready'});cmd(s,1,{type:'ready'});s.automationCards=defs;s.turn={...s.turn,firstPlayer:0,phase:'action',step:'first-action',actionClosed:false};s.flow={...s.flow,priority:0,stepOwner:0,locked:false};for(let p=0;p<2;p++){s.players[p].assets=[];for(let i=0;i<32;i++){const id=`asset:${p}:${i}`;s.cards[id]={id,owner:p,name:'资产',type:'character',faction:['黄','绿','蓝','红','灰','白','黑','紫'][i%8],magicDomains:['心灵','神圣','星辰','死亡','鲜血']};s.locations[id]={zone:'asset',zoneVersion:1};s.players[p].assets.push({id,faction:s.cards[id].faction,magicDomains:s.cards[id].magicDomains,tapped:false})}}return s}
export function put(s,code,p=0,zone='hand',extra={}){const def=defs.find(c=>c.catalogId===code);if(!def)throw Error(code);const id=crypto.randomUUID();s.cards[id]={...structuredClone(def),id,owner:p};s.locations[id]={zone,zoneVersion:1,...extra};s.players[p][zone].push(id);return id}
export function resolve(s){cmd(s,s.flow.priority,{type:'pass'});cmd(s,s.flow.priority,{type:'pass'})}
export function cast(s,code,target,p=0,extra={}){const id=put(s,code,p);s.flow.priority=p;cmd(s,p,{type:'play',cardId:id,targetIds:target?[target]:[],...extra});resolve(s);return id}
export function enter(s,code,p=0){const id=put(s,code,p);s.flow.priority=p;cmd(s,p,{type:'play',cardId:id,district:0});resolve(s);return id}
export function fire(s,cardId,target,event){if(s.deathContinuation?.choice?.kind==='trigger-cost'&&s.deathContinuation.choice.ability.cardId===cardId){const a=payTriggeredCost(s,{targetIds:target?[target]:[]});stackPaidTriggers(s);resolve(s);return a;}const a=s.triggerChoices.find(x=>x.cardId===cardId&&(!event||x.event===event));if(!a)throw Error('Missing trigger');cmd(s,a.controller,{type:'trigger-choice',triggerId:a.id,fire:true,targetIds:target?[target]:[]});resolve(s);return a}
export function approve(s,p,operation,extra={}){cmd(s,p,{type:'manual-request',operation,...extra});cmd(s,1-p,{type:'manual-confirm',requestId:s.manualRequest.id,accept:true})}

// Drivers advance combat with a complete legal allocation; card tests assert effects separately.
export function fullBattleAllocation(s){const a=s.roundChoice,ids=a.targetIds.filter(id=>s.locations[id]?.zone==='play'&&!s.locations[id].faceDown&&s.locations[id].district===s.turn.district);if(!ids.length)return [];let left=a.budget;const amounts=new Map();for(const id of ids.filter(id=>keywordAmount(s,id,'护卫')>0)){const n=Math.min(left,keywordAmount(s,id,'护卫'));if(n)amounts.set(id,n);left-=n;}if(left){const id=amounts.keys().next().value??ids[0];amounts.set(id,(amounts.get(id)??0)+left);}return [...amounts].map(([cardId,amount])=>({cardId,amount}));}

export function stackPaidTriggers(s){const r=currentTriggerRound(s);if(!r)throw Error("Missing paid trigger round");const p=r.players[r.index],own=r.entries.filter(a=>a.controller===p);cmd(s,p,{type:"trigger-round",roundId:r.id,decisions:own.filter(a=>!a.pending).map(a=>({triggerId:a.id,fire:false})),abilityIds:own.filter(a=>a.pending).map(a=>a.id)});}

// Legacy ability tests explicitly accept the newly offered hidden triggers.
// Targeted ones require a supplied target; trigger-round tests submit batches.
export function fireHiddenEffects(s,targets={}){
 for(const a of [...s.triggerChoices].filter(a=>a.plan?.hiddenAbility)){
  if(a.plan.target!=='none'&&!Object.hasOwn(targets,a.cardId))continue;
  cmd(s,a.controller,{type:'trigger-choice',triggerId:a.id,fire:true,targetIds:targets[a.cardId]??[]});
 }
}

export const emitWithChoices=(s,id,event,loc=s.locations[id],group=crypto.randomUUID(),details={})=>cmd(s,loc?.controller??s.cards[id]?.owner??details.player??0,{type:"fixture-event",cardId:id,event,loc:structuredClone(loc),group,details});
