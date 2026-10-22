'use client';
import { useState, useEffect } from 'react';
export function GunfireAction({card,plan,options,disabled,act,room,onDraft,onTargetsChange}:{card:any,plan:any,options:any[],disabled:boolean,act:(c:any)=>void,room:any,onDraft?:(draft:any)=>void,onTargetsChange?:(ids:string[])=>void}){
 const [district,setDistrict]=useState(''),[requestedMode,setMode]=useState('destroy'),[selected,setSelected]=useState<string[]>([]),[firstItem,setFirstItem]=useState('destroy');
 const mode=plan.modes?.some((m:any)=>m.id===requestedMode)?requestedMode:plan.modes?.[0]?.id;
 const districts=options.filter(o=>o.slot==='district'),legal=districts.some(o=>o.id===district)?district:'';
 const hidden=options.filter(o=>o.slot==='hidden'&&o.district===Number(legal.slice(9))),ids=mode==='police'?[]:selected.filter(id=>hidden.some(o=>o.id===id));
 const targetKey=JSON.stringify([legal,...ids].filter(Boolean));useEffect(()=>onTargetsChange?.(JSON.parse(targetKey)),[targetKey,onTargetsChange]);
 const command={type:'play',cardId:card.id,mode,modeOrder:mode==='both'?[firstItem,firstItem==='destroy'?'police':'destroy']:undefined,targetIds:[legal,...ids]},invalid=disabled||!legal||ids.length>2;
 useEffect(()=>{onDraft?.({command,valid:!invalid});},[JSON.stringify(command),invalid,onDraft]);
 return <><select aria-label='枪火谈判目标地区' value={legal} disabled={disabled} onChange={e=>setDistrict(e.target.value)}><option value=''>选择目标地区</option>{districts.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><select aria-label='枪火谈判模式' value={mode} disabled={disabled} onChange={e=>setMode(e.target.value)}>{plan.modes?.map((m:any)=><option key={m.id} value={m.id}>{m.label}</option>)}</select>{mode==='both'&&<label>发动时确定结算顺序<select aria-label='枪火谈判两项结算顺序' disabled={disabled} value={firstItem} onChange={e=>setFirstItem(e.target.value)}><option value='destroy'>先消灭暗藏者，再生成警察</option><option value='police'>先生成警察，再消灭暗藏者</option></select></label>}{mode!=='police'&&legal&&<div className='effect-options'>{hidden.map(o=><label key={o.id}><input type='checkbox' aria-label={`枪火谈判暗藏者 ${o.id}`} checked={ids.includes(o.id)} disabled={disabled||ids.length>=2&&!ids.includes(o.id)} onChange={e=>setSelected(e.target.checked?[...ids,o.id]:ids.filter(id=>id!==o.id))}/>{o.name}</label>)}</div>}{!onDraft&&<button className='primary' disabled={invalid} onClick={()=>act(command)}>打出 · {room.castingCosts?.[card.id]??card.printedCost}费用</button>}</>;
}
export function LateNonQsChoice({ room, busy, act }: {
    room: any;
    busy: boolean;
    act: (c: any) => void;
}) {
    const x = room.effectChoice, [id, setId] = useState(''), [destination, setDestination] = useState('hand');
    if (x?.kind === 'late-non-qs-mother-select')
        return <section className='choice-panel'><h3>{x.choiceLabel}</h3>{x.controller === room.seat ? <div className='effect-options'>{x.cards?.map((c: any) => <button className='secondary' disabled={busy} key={c.id} onClick={() => act({ type: 'effect-choice', choiceId: x.id, cardId: c.id })}>{c.name}{room.players[room.seat].play.some((p: any) => p.id === c.id && p.faceDown) ? ' · 现身' : ' · 打出'}</button>)}<button className='quiet' disabled={busy} onClick={() => act({ type: 'effect-choice', choiceId: x.id, fail: true })}>不选择</button></div> : <p>等待玩家选择。</p>}</section>;
    if (x?.kind !== 'late-non-qs-search')
        return null;
    const bell = x.searchOperation === 'bell-search', legal = x.cards?.some((c: any) => c.id === id) ? id : '';
    return <section className='choice-panel'><h3>{x.choiceLabel}</h3>{room.seat === x.controller ? <><select aria-label='检索角色牌' value={legal} onChange={e => setId(e.target.value)}><option value=''>选择角色牌</option>{x.cards?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{bell && <select aria-label='贝兰丹娜检索去向' value={destination} onChange={e => setDestination(e.target.value)}><option value='hand'>置于手中</option>{x.targetAvailable && <option value='sealed'>封印在已选目标角色上</option>}{x.districtAvailable && <option value='hidden'>以暗藏者状态置于原地区</option>}</select>}<div className='reward-row'><button className='primary' disabled={busy || !legal} onClick={() => act({ type: 'effect-choice', choiceId: x.id, cardId: legal, destination })}>确认</button><button className='secondary' disabled={busy} onClick={() => act({ type: 'effect-choice', choiceId: x.id, fail: true })}>不选择，洗牌</button></div></> : <p>等待 {room.seats[x.controller].name} 选择。</p>}</section>;
}
