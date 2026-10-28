// Private cumulative standings for imported JLT race snapshots.
// Qualification, race-off, and championship points are separate stages.
const key=x=>String(x);
export function stageOf(slot){
 if(/^Qualification [1-6]$/.test(slot))return 'qualification';
 if(/^Race-off [12]$/.test(slot))return 'raceoff';
 if(slot==='Championship')return 'championship';
 throw Error('Unknown race slot: '+slot);
}
export function calculateStandings(group,imports,stage='qualification'){
 if(!['qualification','raceoff','championship'].includes(stage))throw Error('Invalid stage');
 if(!group||!Array.isArray(group.drivers))throw Error('Invalid group');
 const roster=group.drivers,seen=new Set(roster.map(d=>key(d.id)));
 if(seen.size!==roster.length)throw Error('Duplicate roster racer');
 const relevant=imports.filter(i=>i.groupId===group.id&&stageOf(i.slot)===stage);
 const slots=new Set(),raceIds=new Set();
 for(const race of relevant){
  if(slots.has(race.slot)||raceIds.has(key(race.raceId)))throw Error('Duplicate imported race or slot');
  slots.add(race.slot);raceIds.add(key(race.raceId));
  if(race.simulated!==true||race.registered!==roster.length)throw Error('Roster snapshot mismatch');
  const rowIds=new Set();
  for(const row of race.rows){
   const id=key(row.driverId);
   if(!seen.has(id)||rowIds.has(id))throw Error('Invalid imported racer');
   rowIds.add(id);
   if(!Number.isInteger(row.points)||row.points<0||row.points>roster.length)throw Error('Invalid points');
  }
  if(rowIds.size!==roster.length)throw Error('Incomplete imported roster');
 }
 const byId=new Map(roster.map(d=>[key(d.id),{driverId:d.id,name:d.name,points:0,entered:0,missed:0,crashes:0,totalTime:0,races:[]}]));
 const ordered=relevant.slice().sort((a,b)=>a.slot.localeCompare(b.slot,undefined,{numeric:true}));
 for(const race of ordered){
  for(const row of race.rows){
   const t=byId.get(key(row.driverId));
   t.points+=row.points;
   t.entered+=Number(row.entered===true);
   t.missed+=Number(row.entered!==true);
   t.crashes+=Number(row.crashed===true);
   const time=Number(row.time);
   if(row.entered===true&&Number.isFinite(time)&&time>=0)t.totalTime+=time;
   t.races.push({raceId:race.raceId,slot:race.slot,points:row.points,entered:row.entered===true,crashed:row.crashed===true});
  }
 }
 const standings=[...byId.values()].sort((a,b)=>b.points-a.points||b.entered-a.entered||a.crashes-b.crashes||a.totalTime-b.totalTime||key(a.driverId).localeCompare(key(b.driverId)));
 standings.forEach((r,i)=>{r.rank=i+1});
 return {groupId:group.id,stage,simulation:group.simulated===true,importedRaces:ordered.length,slots:ordered.map(r=>r.slot),registered:roster.length,standings};
}
