const localUsers=new Set(['local_test_player_a','local_test_player_b','local_seedy']);
export function deckStorageOwner(userId,host){
 if(!userId)return null;
 let local=false;
 try{local=['localhost','127.0.0.1','[::1]'].includes(new URL('http://'+host).hostname);}catch{}
 return local&&localUsers.has(userId)?'local_seedy':userId;
}
