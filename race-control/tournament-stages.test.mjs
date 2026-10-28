import test from 'node:test';
import assert from 'node:assert/strict';
import {previewTournamentStages} from './tournament-stages.mjs';
import {scoreOfficialRace} from './official-scoring.mjs';
const group={id:'L1-A',league:1,official:true,simulated:false,drivers:Array.from({length:6},(_,i)=>({id:i+1,name:'Driver '+(i+1)}))};
const race=(id,slot,roster)=>scoreOfficialRace({id,status:'finished',results:roster.map((d,i)=>({driver_id:d.id,position:i+1,has_crashed:false,race_time:100+i}))},{...group,id:slot.startsWith('Championship')?'L1-CHAMPIONSHIP':group.id,drivers:roster},slot);
test('single group championship waits for six approved qualifiers',()=>{
 const items=Array.from({length:5},(_,i)=>race(100+i,'Qualification '+(i+1),group.drivers));
 assert.equal(previewTournamentStages([group],items,1).ready,false);
});
test('championship points reset and seven daily slots required',()=>{
 const qualifications=Array.from({length:6},(_,i)=>race(100+i,'Qualification '+(i+1),group.drivers));
 const first=previewTournamentStages([group],qualifications,1);
 assert.equal(first.missingChampionshipRaces.length,7);
 assert.equal(first.championshipStandings.importedRaces,0);
 const finalists=first.championshipRoster.drivers;
 const finals=Array.from({length:7},(_,i)=>race(200+i,'Championship '+(i+1),finalists));
 const done=previewTournamentStages([group],[...qualifications,...finals],1);
 assert.equal(done.ready,true);
 assert.equal(done.championshipStandings.importedRaces,7);
 assert.equal(done.championshipStandings.standings[0].points,21);
 assert.equal(done.publicationLocked,true);
});
