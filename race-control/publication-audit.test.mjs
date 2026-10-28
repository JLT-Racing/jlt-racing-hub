import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationAudit} from './publication-audit.mjs';
const sha='a'.repeat(64);
const group={id:'L1-A',league:1,official:true,simulated:false,drivers:Array.from({length:4},(_,i)=>({id:i+1,name:'Racer '+i}))};
const make=(id,slot)=>({raceId:id,groupId:group.id,slot,rosterSha:sha,official:true,simulated:false,registered:4,rows:group.drivers.map((d,i)=>({driverId:d.id,name:d.name,points:4-i,entered:true,crashed:false,time:100+i}))});
test('audit blocks missing official roster',()=>{
 const r=publicationAudit([],[],[],[],sha);
 assert.equal(r.ready,false);assert.equal(r.publicationLocked,true);assert.equal(r.preview,null);
});
test('audit blocks unapproved and duplicate official results',()=>{
 const imports=[make(1,'Qualification 1'),make(1,'Qualification 1')];
 const r=publicationAudit([group],imports,[],[],sha);
 assert.equal(r.ready,false);assert.ok(r.blockers.some(x=>x.includes('Duplicate')));
 assert.ok(r.blockers.some(x=>x.includes('Pending')));
});
test('audit blocks missing championship approvals without exposing a payload',()=>{
 const imports=Array.from({length:6},(_,i)=>make(i+1,'Qualification '+(i+1)));
 const r=publicationAudit([group],imports,imports,[],sha);
 assert.equal(r.ready,false);assert.equal(r.preview,null);
 assert.ok(r.blockers.some(x=>x.includes('championship')||x.includes('Championship')));
});
