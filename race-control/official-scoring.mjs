// Conservative JLT scorer. A crash must have explicit completion percentage.
// This module does not save, approve or publish anything.
const id=x=>String(x);
export function scoreOfficialRace(race,group,slot){
 if(!group?.official||group.simulated===true)throw Error('Verified official group required');
 if(race?.status!=='finished'||!Array.isArray(race.results))throw Error('Finished race results required');
 if(!/^(Qualification [1-6]|Race-off [12]|Championship [1-7])$/.test(slot))throw Error('Unsupported official race slot');
 const roster=group.drivers;
 if(!Array.isArray(roster)||!roster.length)throw Error('Empty roster');
 const registered=new Map(roster.map(d=>[id(d.id),d]));
 if(registered.size!==roster.length)throw Error('Duplicate registered racer');
 const all=new Set(),positions=new Set(),entries=[];
 for(const r of race.results){
  if(!Number.isSafeInteger(Number(r.driver_id))||Number(r.driver_id)<=0||all.has(id(r.driver_id)))throw Error('Duplicate or invalid race participant');
  all.add(id(r.driver_id));
  if(!Number.isInteger(r.position)||r.position<1||positions.has(r.position))throw Error('Invalid or duplicate official position');
  positions.add(r.position);
  if(typeof r.has_crashed!=='boolean')throw Error('Crash flag missing');
  if(registered.has(id(r.driver_id)))entries.push(r);
 }
 const finishers=entries.filter(r=>!r.has_crashed).sort((a,b)=>a.position-b.position);
 const crashes=entries.filter(r=>r.has_crashed);
 if(crashes.length){
  for(const r of crashes){
   if(typeof r.completion_percentage!=='number'||!Number.isFinite(r.completion_percentage)||r.completion_percentage<0||r.completion_percentage>100)throw Error('Crash completion percentage missing or invalid; manual verification required');
  }
  crashes.sort((a,b)=>b.completion_percentage-a.completion_percentage||a.position-b.position);
  if(crashes.some((r,i)=>i&&r.completion_percentage===crashes[i-1].completion_percentage))throw Error('Tied crash completion percentage requires steward resolution');
 }
 const ranked=[...finishers,...crashes];
 const points=new Map(ranked.map((r,i)=>[id(r.driver_id),roster.length-i]));
 const results=new Map(entries.map(r=>[id(r.driver_id),r]));
 return {raceId:race.id,groupId:group.id,slot,simulated:false,official:true,registered:roster.length,matched:entries.length,outsiders:race.results.length-entries.length,verification:'PREVIEW_ONLY',rows:roster.map(d=>{const r=results.get(id(d.id));return {driverId:d.id,name:d.name,position:r?.position??null,crashed:r?.has_crashed??false,completionPercentage:r?.completion_percentage??null,time:r?.race_time??null,points:points.get(id(d.id))??0,entered:!!r}})};
}
