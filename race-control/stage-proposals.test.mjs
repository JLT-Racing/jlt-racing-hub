import test from 'node:test';
import assert from 'node:assert/strict';
import {proposedStageRoster} from './stage-proposals.mjs';
import {stageDigest} from './stage-rosters.mjs';
import {scoreOfficialRace} from './official-scoring.mjs';
import {calculateStandings} from './standings.mjs';
const makeGroup=(suffix,n,offset)=>({id:'L2-'+suffix,league:2,official:true,simulated:false,drivers:Array.from({length:n},(_,i)=>({id:offset+i+1,name:suffix+' '+i}))});
const race=(group,id,slot)=>scoreOfficialRace({id,status:'finished',results:group.drivers.map((d,i)=>({driver_id:d.id,position:i+1,has_crashed:false,race_time:100+i}))},group,slot);
test('pooled stage proposal derives top five from each fully approved group',()=>{
 const a=makeGroup('A',50,0),b=makeGroup('B',50,100),groups=[a,b];
 const imports=[...Array.from({length:4},(_,i)=>race(a,100+i,'Qualification '+(i+1))),...Array.from({length:4},(_,i)=>race(b,200+i,'Qualification '+(i+1)))];
 const pool=proposedStageRoster(groups,imports,2,'raceoff');
 assert.equal(pool.drivers.length,10);
 assert.equal(pool.pendingStewardVerification,true);
 assert.throws(()=>proposedStageRoster(groups,imports,2,'championship'),/race-offs/);
 const verified={...pool,official:true,simulated:false};
 const raceoffs=[race(verified,300,'Race-off 1'),race(verified,301,'Race-off 2')];
 const championship=proposedStageRoster(groups,[...imports,...raceoffs],2,'championship');
 assert.equal(championship.drivers.length,3);
 assert.equal(championship.pendingStewardVerification,true);
 assert.equal(calculateStandings(verified,raceoffs,'raceoff').standings[0].points,20);
});
test('stage digest binds roster, order and organizer root',()=>{
 const g=makeGroup('A',5,0),root='a'.repeat(64);
 assert.notEqual(stageDigest(g,root),stageDigest({...g,drivers:g.drivers.slice().reverse()},root));
 assert.notEqual(stageDigest(g,root),stageDigest(g,'b'.repeat(64)));
});
