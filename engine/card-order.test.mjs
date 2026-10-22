import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCardOrder,expansionOrder} from './card-order.mjs';
test('默认显示按指定扩展顺序及编号排列，牌名和实例ID不影响排序',()=>{
 const cards=[...expansionOrder].reverse().flatMap((set,i)=>[{catalogId:set+'10',id:'z'+i,name:'阿'},{catalogId:set+'2',id:'a'+i,name:'周'}]);
 assert.deepEqual(cards.sort(compareCardOrder).map(c=>c.catalogId),expansionOrder.flatMap(s=>[s+'2',s+'10']));
});
test('目录卡、秘社与转变面均使用所属扩展；未列扩展顺序稳定',()=>{
 const cards=['TK015','BQ002','MSJC03','ZHBQ001','JC100','DQ02','BQ001'].map(id=>({id}));
 assert.deepEqual(cards.sort(compareCardOrder).map(c=>c.id),['MSJC03','JC100','BQ001','ZHBQ001','BQ002','DQ02','TK015']);
 assert.equal(compareCardOrder({},{}),0);
});
