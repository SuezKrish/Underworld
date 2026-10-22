import {compareCardOrder} from './card-order.mjs';
export function searchChoiceDisplay(choice){
 if(!choice?.cards)return choice;
 const search=choice.kind==='secrecy-batch-deep-seal'||choice.kind==='search'||choice.kind?.endsWith('-search')||['search','simultaneous-search','setup-secret'].includes(choice.mode);
 if(!search)return choice;
 return {...choice,cards:[...choice.cards].sort(compareCardOrder)};
}
