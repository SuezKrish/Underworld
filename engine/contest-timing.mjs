// The last quick window before the next automatic contest comparison.
export function upcomingContest(v){
 const t=v.turn;if(!t||v.contestWindowRule!=='after-only'||t.phase!=='contest')return null;
 const first=(v.districts??[]).findIndex(Boolean);
 if(t.step==='contest-start')return first<0?null:{district:first,kind:'investigation'};
 if(t.step!=='contest-after')return null;
 const kinds=['investigation','battle','influence'],i=kinds.indexOf(t.kind);
 if(i<0)return null;
 if(i<2)return {district:t.district,kind:kinds[i+1]};
 if(t.extraInfluencePending)return {district:t.district,kind:'influence'};
 const next=(v.districts??[]).findIndex((d,i)=>d&&i>t.district);
 return next<0?null:{district:next,kind:'investigation'};
}
