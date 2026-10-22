import test from 'node:test';
import assert from 'node:assert/strict';
import {deckStorageOwner} from '../lib/deck-owner.mjs';
test('三个本地测试身份共享卡组，保留各自登录身份',()=>{
 for(const host of ['localhost:5174','127.0.0.1:5173','[::1]:5174'])for(const id of ['local_test_player_a','local_test_player_b','local_seedy'])assert.equal(deckStorageOwner(id,host),'local_seedy');
});
test('线上、其他用户和未登录者保持原有隔离',()=>{
 for(const host of ['example.com','127.0.0.1.evil.test','invalid[host'])assert.equal(deckStorageOwner('local_test_player_a',host),'local_test_player_a');
 assert.equal(deckStorageOwner('actual-user','localhost:5174'),'actual-user');assert.equal(deckStorageOwner(null,'localhost:5174'),null);
});
