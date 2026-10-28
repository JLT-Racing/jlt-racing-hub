import {calculateStandings} from './standings.mjs';

// Fully in-memory rehearsal: does not write imports.json or publish anything.
export function runScoringRehearsal(){
 const group={id:'TEST-ONLY',simulated:true,drivers:[
  {id:900001,name:'Test Alpha'},{id:900002,name:'Test Beta'},
  {id:900003,name:'Test Gamma'},{id:900004,name:'Test Delta'}]};
 const row=(driverId,points,entered=true,crashed=false,time=null)=>({driverId,points,entered,crashed,time});
 const imports=[
  {raceId:99000001,groupId:group.id,slot:'Qualification 1',simulated:true,registered:4,rows:[
   row(900001,4,true,false,80),row(900002,3,true,false,85),
   row(900003,2,true,true,90),row(900004,0,false,false)]},
  {raceId:99000002,groupId:group.id,slot:'Qualification 2',simulated:true,registered:4,rows:[
   row(900001,0,false,false),row(900002,4,true,false,78),
   row(900003,3,true,false,81),row(900004,2,true,true,95)]}
 ];
 const result=calculateStandings(group,imports,'qualification');
 const byId=new Map(result.standings.map(x=>[x.driverId,x]));
 const checks=[
  ['Two races included',result.importedRaces===2],
  ['Beta leads with seven points',byId.get(900002)?.points===7&&result.standings[0]?.driverId===900002],
  ['Gamma totals five points and one crash',byId.get(900003)?.points===5&&byId.get(900003)?.crashes===1],
  ['Alpha missed the second race',byId.get(900001)?.points===4&&byId.get(900001)?.missed===1],
  ['Delta entered once and crashed',byId.get(900004)?.points===2&&byId.get(900004)?.entered===1&&byId.get(900004)?.crashes===1],
  ['All four racers present',result.standings.length===4]
 ];
 return {mode:'test',storage:'memory-only',passed:checks.every(x=>x[1]),checks:checks.map(([name,passed])=>({name,passed})),standings:result.standings};
}
