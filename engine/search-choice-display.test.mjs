import test from 'node:test';
import assert from 'node:assert/strict';
import {searchChoiceDisplay} from './search-choice-display.mjs';
test('检索列表按扩展编号显示，同编号牌稳定排列且不修改原始牌序',()=>{
 const cards=[{id:'z',catalogId:'QS001',name:'阿'},{id:'a1',catalogId:'JC010',name:'周'},{id:'y',catalogId:'BQ001',name:'啊'},{id:'a2',catalogId:'JC010',name:'周'}];
 for(const choice of [{kind:'search'},{kind:'seal-search'},{kind:'late-non-qs-search'},{kind:'contact-search'},{kind:'environment',mode:'simultaneous-search'}]){
  const a={...choice,cards},sorted=searchChoiceDisplay(a);assert.deepEqual(sorted.cards.map(c=>c.id),['a1','a2','y','z']);assert.equal(a.cards,cards);assert.equal(a.cards[0].id,'z');
 }
});
test('检视、调查、预测和顶牌分配保留真实展示顺序',()=>{
 for(const kind of ['predict','hidden-predict','investigation','top-select-hand','qs-ghost-top','inspect','batch-top-place','hidden-return-order']){
  const a={kind,cards:[{name:'钟楼怪客'},{name:'阿塔玛斯奉献仪式'}]};assert.equal(searchChoiceDisplay(a),a);
 }
});
