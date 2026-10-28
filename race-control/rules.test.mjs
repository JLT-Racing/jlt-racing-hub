import test from 'node:test';
import assert from 'node:assert/strict';
import {preview} from './imports.mjs';
import {calculateStandings} from './standings.mjs';
import {validateOfficialGroups,qualificationFormat,raceoffRoster} from './rules.mjs';
const group={id:'L1-G01',simulated:true,drivers:[{id:1,name:'A'},{id:2,name:'B'},{id:3,name:'C'},{id:4,name:'D'}]};
const row=(driverId,points,entered=true,crashed=false,time=10)=>({driverId,points,entered,crashed,time});
const imp=(raceId,slot,rows)=>({raceId,groupId:group.id,slot,simulated:true,registered:4,rows});
test('winner points depend on registered roster, not attendance',()=>{
 const result=preview({id:123,status:'finished',title:'test',results:[{driver_id:2,position:1,has_crashed:false,race_time:10}]},group,'Qualification 1');
 assert.equal(result.rows.find(r=>r.driverId===2).points,4);
 assert.equal(result.rows.find(r=>r.driverId===1).points,0);
});
test('official positions must be unique',()=>{
 assert.throws(()=>preview({id:123,status:'finished',results:[{driver_id:1,position:1,has_crashed:false},{driver_id:2,position:1,has_crashed:true}]},group,'Qualification 1'),/Duplicate official positions/);
});
test('tiebreak order: entered, crashes, cumulative time',()=>{
 const races=[imp(11,'Qualification 1',[row(1,3),row(2,3),row(3,3),row(4,3)]),imp(12,'Qualification 2',[row(1,0,false,false,null),row(2,0,false,false,null),row(3,0,false,false,null),row(4,0,false,false,null)])];
 const base=calculateStandings(group,races).standings;
 assert.equal(base.length,4);
 const changed=[imp(11,'Qualification 1',[row(1,3,true,false,20),row(2,3,true,true,5),row(3,3,true,false,10),row(4,3,false,false,null)]),imp(12,'Qualification 2',[row(1,0,false,false,null),row(2,0,false,false,null),row(3,0,false,false,null),row(4,0,true,false,3)])];
 const ranked=calculateStandings(group,changed).standings;
 assert.deepEqual(ranked.map(r=>r.driverId),[3,1,2,4]);
});
test('official roster rejects simulated and duplicate racers',()=>{
 assert.throws(()=>validateOfficialGroups([group]),/officially verified/);
 assert.throws(()=>validateOfficialGroups([{id:'L1-A',league:1,official:true,drivers:[{id:1}]},{id:'L1-B',league:1,official:true,drivers:[{id:1}]}]),/multiple groups/);
});
test('qualification formats enforce 6 versus 4 plus 2',()=>{
 const one=[{league:0}],many=[{league:1},{league:1}];
 assert.equal(qualificationFormat(one,0).regularRaces,6);
 assert.deepEqual(qualificationFormat(many,1),{regularRaces:4,raceoffs:2,qualifyPerGroup:5,advance:3,resetPoints:true});
});
test('race-off roster requires four qualification races per group',()=>{
 const groups=[{id:'L1-A',league:1,drivers:Array.from({length:5},(_,i)=>({id:i+1}))},{id:'L1-B',league:1,drivers:Array.from({length:5},(_,i)=>({id:i+6}))}];
 assert.throws(()=>raceoffRoster(groups,{},1),/Four verified/);
});
