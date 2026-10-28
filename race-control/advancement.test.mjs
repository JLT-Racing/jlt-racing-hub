import test from 'node:test';
import assert from 'node:assert/strict';
import {previewAdvancement} from './advancement.mjs';
const group=(id,league,n)=>({id,league,official:true,simulated:false,drivers:Array.from({length:n},(_,i)=>({id:league*100000+Number(id.charCodeAt(id.length-1))*1000+i+1,name:'Racer '+i}))});
const race=(g,slot,raceId)=>({raceId,groupId:g.id,slot,registered:g.drivers.length,simulated:false,rows:g.drivers.map((d,i)=>({driverId:d.id,name:d.name,points:g.drivers.length-i,entered:true,crashed:false,time:i+100}))});
test('single-group league blocks incomplete qualification and proposes top three after six',()=>{
 const g=group('L1-A',1,6),groups=[g];
 const imports=Array.from({length:6},(_,i)=>race(g,'Qualification '+(i+1),100+i));
 const pending=previewAdvancement(groups,imports.slice(0,5),1);
 assert.equal(pending.ready,false);
 assert.deepEqual(pending.requirements[0].missing,['Qualification 6']);
 const ready=previewAdvancement(groups,imports,1);
 assert.equal(ready.stage,'championship');
 assert.equal(ready.qualifiers.drivers.length,3);
 assert.equal(ready.qualifiers.pendingStewardVerification,true);
 assert.equal(ready.publicationLocked,true);
});
test('multi-group league proposes pooled top five only after all eight approved races',()=>{
 const a=group('L2-A',2,50),b=group('L2-B',2,50),groups=[a,b];
 const imports=[...Array.from({length:4},(_,i)=>race(a,'Qualification '+(i+1),200+i)),...Array.from({length:4},(_,i)=>race(b,'Qualification '+(i+1),300+i))];
 assert.equal(previewAdvancement(groups,imports.slice(0,7),2).ready,false);
 const ready=previewAdvancement(groups,imports,2);
 assert.equal(ready.stage,'raceoff');
 assert.equal(ready.pooledRoster.drivers.length,10);
 assert.equal(ready.pooledRoster.pendingStewardVerification,true);
 assert.equal(ready.publicationLocked,true);
});
test('unverified rosters cannot advance',()=>{
 const g={...group('L0-A',0,6),official:false};
 assert.throws(()=>previewAdvancement([g],[],0),/Official league roster/);
});
