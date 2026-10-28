import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateStandings} from '../race-control/standings.mjs';
const group={id:'L0-G01',simulated:true,drivers:[{id:1,name:'Alpha'},{id:2,name:'Beta'},{id:3,name:'Gamma'}]};
const race=(raceId,slot,rows)=>({raceId,slot,groupId:group.id,simulated:true,registered:3,rows});
const row=(driverId,points,entered=true,crashed=false,time=10)=>({driverId,points,entered,crashed,time});
test('cumulative points and missed races',()=>{
 const races=[race(1,'Qualification 1',[row(1,3),row(2,2),row(3,0,false)]),race(2,'Qualification 2',[row(1,0,false),row(2,3),row(3,2)])];
 const d=calculateStandings(group,races);
 assert.equal(d.importedRaces,2);
 assert.deepEqual(d.standings.map(x=>[x.name,x.points,x.entered,x.missed]),[['Beta',5,2,0],['Alpha',3,1,1],['Gamma',2,1,1]]);
});
test('race-off points reset independently',()=>{
 const races=[race(1,'Qualification 1',[row(1,3),row(2,2),row(3,1)]),race(2,'Race-off 1',[row(1,0,false),row(2,3),row(3,2)])];
 assert.equal(calculateStandings(group,races,'raceoff').standings[0].name,'Beta');
 assert.equal(calculateStandings(group,races,'raceoff').importedRaces,1);
});
test('ties favor entered races then fewer crashes',()=>{
 const races=[race(1,'Qualification 1',[row(1,2),row(2,2,true,true),row(3,0,false)])];
 assert.equal(calculateStandings(group,races).standings[0].name,'Alpha');
});
test('rejects malformed snapshots',()=>{
 assert.throws(()=>calculateStandings(group,[race(1,'Qualification 1',[row(1,3)])]),/Incomplete/);
});
