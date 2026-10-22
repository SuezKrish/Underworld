import {hasCardType} from './card-types.mjs';
import {responseFilter} from './response-effect-semantics.mjs';

const domains={心:'心灵',圣:'神圣',星:'星辰',死:'死亡',血:'鲜血'};
const mana=p=>(p.costPool??0)+(p.assets??[]).filter(c=>!c.tapped).length;
const live=c=>!c.faceDown&&!c.printedTextBlank&&!c.abilitiesSuppressed;
const material=c=>!c.nonAssetNow&&!c.keywords?.includes('非资产');
const supplies=(c,k)=>domains[k]?c.magicDomains?.includes(domains[k]):c.faction?.split('·')[0]===k;

// Describe executable mechanics, including opaque operations, rather than
// recognizing a card's identity, name, printed prose or FAQ.
export function effectPlans(plan){
 if(!plan||typeof plan!=='object')return [];
 return [plan,...[...plan.steps??[],...plan.ops??[],...Object.values(plan.modeTargets??{})].flatMap(effectPlans)];
}
function roots(c){
 const a=c.automation??{};
 return [...['entry','reveal','prepare','end','death'].flatMap(event=>a[event]?[{event,plan:a[event]}]:[]),
  ...(a.watch??[]).map(plan=>({event:'watch',plan})),...(c.availableActions??a.actions??(a.action?[a.action]:[])).map(plan=>({event:'action',plan})),
  ...[c.spell,c.attachment].filter(Boolean).map(plan=>({event:'cast',plan}))];
}
export function graveyardPlanUses(plan,v){
 return effectPlans(plan).flatMap(p=>{
  const t=p.target??'',own=t.startsWith('own-'),op=p.operation;
  if(op==='rigoletto-seal')return [{kind:'seal',own:true,filter:{},nightmareControl:true,plan:p}];
  if(op==='clock-recover')return [{kind:'return',own:true,filter:{subtypesAny:['法术','灾难']},plan:p}];
  if(!t.includes('grave'))return [];
  const markers=v?.players?.[v.seat]?.effectiveMarkers??v?.players?.[v.seat]?.markers;
  const filter={...(t.includes('character')?{type:'character'}:t.includes('attachment')?{type:'attachment'}:{}),
   ...(t.includes('plans')?{subtypesAny:['计划','任务','命令']}:{}),...(t.includes('host-character')?{requireSubtype:'宿主'}:{}),
   ...(t.includes('cheap-character')?{maxCost:markers?.hidden>0?5:3}:{}),...p.filterTarget??p.filter};
  const kind=p.hiddenAfter||['grave-enter','grave-random-enter','grave-hidden'].includes(p.effect)||['grave-place','ghost-revive','curse-revive','grave-district-attachment','restore-equipment','aoi-equip','plan-return-role'].includes(op)?'enter':
   p.effect==='grave-to-hand'||op==='francois-return'?'return':p.effect==='seal-target-to-source'||op==='seal-grave-predict'||op==='containment'?'seal':'recycle';
  return [{kind,own,enemy:t.startsWith('enemy-'),filter,plan:p}];
 });
}
function affordable(v,c,price){
 const m=v.players[v.seat],options=[null,...(!m.actionsUsed?.asset?(m.hand??[]).filter(x=>x.id!==c.id&&material(x)):[])];
 return options.some(asset=>price<=mana(m)+Number(!!asset)&&(m.ignoreLoyalty||Object.entries(c.loyalty??{}).every(([k,n])=>
  k==='核'?!!m.coreArea:k==='紫'&&v.societies?.[v.seat]?.plan?.ignorePurpleLoyalty||
  ((domains[k]?m.loyalty?.domains?.[domains[k]]:m.loyalty?.factions?.[k])??0)+Number(!!asset&&supplies(asset,k))>=n)));
}
function sourceWeight(v,c,event){
 const m=v.players[v.seat],onBoard=m.play.some(x=>x.id===c.id),held=m.hand.some(x=>x.id===c.id);
 if(onBoard&&live(c))return ['entry','reveal','cast','death'].includes(event)?0:1;
 const price=onBoard&&c.faceDown?v.revealCosts?.[c.id]??Math.max(0,(c.printedCost??0)-1):v.castingCosts?.[c.id]??c.printedCost??0;
 return onBoard||held?affordable(v,c,price)?0.85:0.15:0.12;
}
export function hiddenContestReady(v){
 if(v.hidden)return true;
 if((v.flow?.stack??[]).some(a=>a.controller===v.seat&&(a.responseEffect?.hiddenContest||effectPlans(a.plan??a.responseEffect?.enteringCard?.automation?.entry).some(p=>p.operation==='hidden-start'))))return true;
 const m=v.players[v.seat];
 return [...m.hand,...m.play].some(c=>roots(c).some(({event,plan})=>{
  if(!effectPlans(plan).some(p=>p.operation==='hidden-start'))return false;
  if(m.play.some(x=>x.id===c.id)&&live(c))return event==='action'&&!plan.used&&(!plan.tap||!c.tapped&&!c.cannotTap)&&(plan.cost??0)<=mana(m);
  return ['entry','reveal'].includes(event)&&sourceWeight(v,c,event)>=0.8;
 }));
}
export function pendingGraveyardUse(v,id,player=1-v.seat){
 return (v.flow?.stack??[]).find(a=>a.controller===player&&(
  (a.targetIds?.includes(id)||a.targets?.some(t=>t.cardId===id))&&(graveyardPlanUses(a.plan).some(p=>p.kind!=='recycle')||a.responseEffect?.graveyardUse||a.responseEffect?.characterEntry||!a.plan&&!a.responseEffect)||
  (a.sourceId??a.cardId)===id&&(a.responseEffect?.characterEntry||a.effect?.kind==='seal-from-graveyard')));
}

export function graveyardPlanning(v,cards,handValue,context={},assetValue=handValue){
 const m=v.players[v.seat],sources=[...m.play,...m.hand,...cards],uses=[];
 for(const source of sources){
  if(m.play.some(c=>c.id===source.id)&&!source.faceDown&&!live(source))continue;
  for(const {event,plan} of roots(source)){
   const weight=sourceWeight(v,source,event);if(!weight)continue;
   for(const use of graveyardPlanUses(plan,v))if(!use.enemy){
    const targetReady=!use.nightmareControl||v.players[1-v.seat].play.some(c=>!c.faceDown&&hasCardType(c,'character')&&!c.barrierNow);
    uses.push({...use,source,weight:weight*(plan.tap&&source.tapped||plan.used?0.4:1)*(targetReady?1:0.15)});
   }
  }
 }
 const values=new Map(cards.map(c=>{
  let best=0;
  for(const u of uses){
   if(u.source.id===c.id||!responseFilter(c,u.filter))continue;
   const payoff=u.kind==='enter'?48+Math.min(30,Math.max(0,handValue(v,c))*2):u.kind==='return'?30+Math.min(25,Math.max(0,handValue(v,c))):
    u.kind==='seal'?28+Number(!!u.nightmareControl&&c.subtypes?.includes('梦魇'))*22:8;
   best=Math.max(best,payoff*u.weight);
  }
  if(c.automation?.castFromGrave||c.spell?.castFromGrave||c.attachment?.castFromGrave)best=Math.max(best,85);
  if(c.automation?.zoneActions?.some(p=>p.zone==='graveyard'))best=Math.max(best,75);
  return [c.id,best];
 }));

 // Keep enough actual asset material to meet the deck's future requirements.
 // Held sources count first; duplicate providers beyond that reserve may mill.
 const reserve=new Set(),need={},have={};
 if(!m.ignoreLoyalty){
  const pool=[...m.hand,...cards].filter(material),picked=new Set();
  for(const c of [...sources,...m.coreArea?.cards??[]])for(const [k,n] of Object.entries(c.loyalty??{})){
   if(k==='核'||k==='紫'&&v.societies?.[v.seat]?.plan?.ignorePurpleLoyalty)continue;
   have[k]=(domains[k]?m.loyalty?.domains?.[domains[k]]:m.loyalty?.factions?.[k])??0;
   // A card cannot supply the loyalty needed to play itself as a character
   // or spell. Do not invent an asset demand for an impossible singleton.
   if(have[k]+pool.filter(x=>x.id!==c.id&&supplies(x,k)).length<n)continue;
   need[k]=Math.max(need[k]??0,n);
  }
  while(Object.keys(need).some(k=>(have[k]??0)<need[k])){
   const options=pool.filter(c=>!picked.has(c.id)&&Object.keys(need).some(k=>have[k]<need[k]&&supplies(c,k)));
   if(!options.length)break;
   options.sort((a,b)=>{
    const score=c=>(m.hand.some(x=>x.id===c.id)?assetValue(v,c)<80?-1000:assetValue(v,c):Math.max(0,handValue(v,c)))-Object.keys(need).filter(k=>have[k]<need[k]&&supplies(c,k)).length*8;
    return score(a)-score(b)||a.id.localeCompare(b.id);
   });
   const c=options[0];picked.add(c.id);if(cards.some(x=>x.id===c.id))reserve.add(c.id);
   for(const k of Object.keys(need))if(supplies(c,k))have[k]=(have[k]??0)+1;
  }
 }
 return {uses,values,loyaltyReserve:reserve,context};
}
