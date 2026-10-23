import test from 'node:test';
import assert from 'node:assert/strict';
import {createServiceClient} from './service-client.mjs';

class WorkerDouble extends EventTarget{
 messages=[];
 postMessage(message){this.messages.push(message);}
 answer(data){this.dispatchEvent(new MessageEvent('message',{data}));}
 terminate(){this.terminated=true;}
}
test('后台请求按编号匹配响应，保留状态码与鉴权头，不依赖响应顺序',async()=>{
 const worker=new WorkerDouble(),client=createServiceClient(worker);
 const first=client.request('/api/rooms/A','POST',{type:'pass'},new Headers({Authorization:'Bearer test'}));
 const second=client.request('/api/cards');
 assert.deepEqual(worker.messages[0].headers,[['authorization','Bearer test']]);
 worker.answer({id:2,status:200,headers:[['Content-Type','application/json']],body:'{"cards":[]}'});
 worker.answer({id:1,status:409,headers:[['Content-Type','application/json']],body:'{"error":"版本变化"}'});
 assert.deepEqual(await(await second).json(),{cards:[]});assert.equal((await first).status,409);
 assert.deepEqual(await(await first).json(),{error:'版本变化'});client.close();assert.equal(worker.terminated,true);
});
test('取消等待不会串用迟到响应或取消其他请求',async()=>{
 const worker=new WorkerDouble(),client=createServiceClient(worker),controller=new AbortController();
 const cancelled=client.request('/api/rooms/A','GET',{},[],controller.signal),other=client.request('/api/cards');
 controller.abort();await assert.rejects(cancelled,{name:'AbortError'});
 worker.answer({id:1,status:200,body:'ignored'});worker.answer({id:2,status:200,body:'valid'});
 assert.equal(await(await other).text(),'valid');
 await assert.rejects(client.request('/api/cards','GET',{},[],controller.signal),{name:'AbortError'});assert.equal(worker.messages.length,2);client.close();
});
test('后台线程失败时结束所有等待，后续请求给出错误而非一直等待',async()=>{
 const worker=new WorkerDouble(),client=createServiceClient(worker),pending=client.request('/api/cards');
 worker.dispatchEvent(new Event('error'));await assert.rejects(pending,/离线计算服务启动失败/);await assert.rejects(client.request('/api/cards'),/离线计算服务启动失败/);client.close();
});
