import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreOfficialRace} from './official-scoring.mjs';
const group={id:'L1-A',league:1,official:true,drivers:[{id:1,name:'One'},{id:2,name:'Two'},{id:3,name:'Three'},{id:4,name:'Four'}]};
const r=(id,position,crashed=false,completion_percentage=undefined)=>({driver_id:id,position,has_crashed:crashed,completion_percentage,race_time:100});
test('official preview awards roster-sized points and zero for absences',()=>{
 const result=scoreOfficialRace({id:10,status:'finished',results:[r(2,1),r(1,2),r(99,3)]},group,'Qualification 1');
 assert.equal(result.rows.find(x=>x.driverId===2).points,4);
 assert.equal(result.rows.find(x=>x.driverId===1).points,3);
 assert.equal(result.rows.find(x=>x.driverId===3).points,0);
 assert.equal(result.outsiders,1);
});
test('crashes rank below finishers, sorted by completion',()=>{
 const result=scoreOfficialRace({id:11,status:'finished',results:[r(1,1,true,60),r(2,2),r(3,3,true,90)]},group,'Qualification 1');
 assert.equal(result.rows.find(x=>x.driverId===2).points,4);
 assert.equal(result.rows.find(x=>x.driverId===3).points,3);
 assert.equal(result.rows.find(x=>x.driverId===1).points,2);
});
test('ambiguous crash completion is blocked',()=>{
 assert.throws(()=>scoreOfficialRace({id:12,status:'finished',results:[r(1,1,true)]},group,'Qualification 1'),/completion percentage missing/);
 assert.throws(()=>scoreOfficialRace({id:12,status:'finished',results:[r(1,1,true,50),r(2,2,true,50)]},group,'Qualification 1'),/Tied crash/);
});
test('unverified rosters and unfinished races are blocked',()=>{
 assert.throws(()=>scoreOfficialRace({id:12,status:'finished',results:[]},{...group,official:false},'Qualification 1'),/Verified official/);
 assert.throws(()=>scoreOfficialRace({id:12,status:'waiting',results:[]},group,'Qualification 1'),/Finished race/);
});
