import {RuleError} from './core.mjs';

export function selectedModeIds(plan,command){
 const rule=plan.multiMode,ids=command.modes??rule.legacyModeGroups?.[command.mode]??(command.mode?[command.mode]:[]);
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.length<rule.min||ids.length>rule.max||ids.some(id=>!plan.modes.some(m=>m.id===id)))throw new RuleError(`请选择${rule.min}至${rule.max}项不同模式`);
 return rule.order==='printed'?plan.modes.filter(m=>ids.includes(m.id)).map(m=>m.id):[...ids];
}

export function unusedCommandModes(entry){
 const chosen=entry.plan?.selectedModes??(entry.mode?[entry.mode]:[]);
 return (entry.plan?.modes??[]).filter(m=>!chosen.includes(m.id));
}
