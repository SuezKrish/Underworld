export const expansionOrder=Object.freeze(['JC','XQ','LC','JZ','WM','XG','CQ','BQ','BH','QS']);
const lexical=(a,b)=>a<b?-1:a>b?1:0;
function key(card){
 const id=String(card?.catalogId??card?.code??card?.id??'');
 const match=/^(MS|ZH)?([A-Z]+?)(\d+)(.*)$/.exec(id),set=match?.[2]??id;
 const rank=expansionOrder.indexOf(set);
 return {rank:rank<0?expansionOrder.length:rank,set,number:match?Number(match[3]):Infinity,id};
}
// Display order only. Deck, prediction and other player-committed orders
// must retain their actual order rather than use this comparator.
export function compareCardOrder(a,b){
 const x=key(a),y=key(b);
 return x.rank-y.rank||lexical(x.set,y.set)||(x.number===y.number?0:x.number-y.number)||lexical(x.id,y.id);
}
