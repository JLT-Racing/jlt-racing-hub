import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateStandings} from './standings.mjs';
import {scoreOfficialRace} from './official-scoring.mjs';
const group={id:'L1-A',official:true,simulated:false,drivers:[{id:1,name:'One'},{id:2,name:'Two'},{id:3,name:'Three'}]};
const race={id:101,status:'finished',results:[{driver_id:2,position:1,has_crashed:false,race_time:100},{driver_id:1,position:2,has_crashed:false,race_time:105}]};
test('official import calculates private standings without simulating the roster',()=>{
 const item=scoreOfficialRace(race,group,'Qualification 1');
 const result=calculateStandings(group,[item]);
 assert.equal(result.simulation,false);
 assert.equal(result.importedRaces,1);
 assert.equal(result.standings[0].driverId,2);
 assert.equal(result.standings[0].points,3);
 assert.equal(result.standings.find(x=>x.driverId===3).points,0);
});
test('official standings refuse simulated race data',()=>{
 const item=scoreOfficialRace(race,group,'Qualification 1');
 assert.throws(()=>calculateStandings(group,[{...item,simulated:true}]),/Roster snapshot mismatch/);
});
test('simulated standings refuse official race data',()=>{
 const item=scoreOfficialRace(race,group,'Qualification 1');
 assert.throws(()=>calculateStandings({...group,simulated:true},[item]),/Roster snapshot mismatch/);
});
