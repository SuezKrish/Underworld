import test from 'node:test';
import assert from 'node:assert/strict';
import {packUndoFrames,unpackUndoFrames} from './undo-history-codec.mjs';
const roundtrip=v=>JSON.parse(JSON.stringify(v));
test('撤销差分保留新增、删除、空值、数组顺序与实例文本变化，不修改输入',()=>{
 const base={cards:{a:{name:'现在',icons:{eye:2}},b:{id:'b'}},deck:['b','a'],removed:true};
 const frames=[{label:'旧',state:{cards:{a:{name:'原文',icons:{eye:0}}},deck:['a'],extra:null}},{label:'新',state:{...structuredClone(base),removed:undefined,extra:{x:1}}}];
 const original=structuredClone({base,frames}),packed=packUndoFrames(frames,base);
 assert.deepEqual(roundtrip(unpackUndoFrames(roundtrip(packed),roundtrip(base))),roundtrip(frames));
 assert.deepEqual({base,frames},original);
 assert.deepEqual(roundtrip(unpackUndoFrames(packed.slice(1),base)),roundtrip(frames.slice(1)));
});
test('旧版完整快照与新差分混合可读，截去最旧记录仍可逐步还原',()=>{
 const base={n:3},frames=[{label:'一',state:{n:1}},{label:'二',state:{n:2}}],packed=packUndoFrames(frames,base);
 packed[0]=frames[0];assert.deepEqual(unpackUndoFrames(packed,base),frames);
 assert.deepEqual(roundtrip(unpackUndoFrames(packed.slice(1),base)),roundtrip(frames.slice(1)));
});
test('差分不能沿原型链写入；自有同名键仍按资料保留',()=>{
 const bad=[{state:{__undoDeltaV1:{set:[[['__proto__','polluted'],true]],remove:[]}}}];
 assert.throws(()=>unpackUndoFrames(bad,{}),/路径不存在/);assert.equal({}.polluted,undefined);
 const base=JSON.parse('{"__proto__":{"safe":1}}'),frames=[{state:JSON.parse('{"__proto__":{"safe":2}}')}];
 assert.deepEqual(unpackUndoFrames(roundtrip(packUndoFrames(frames,base)),base),frames);assert.equal({}.safe,undefined);
});
