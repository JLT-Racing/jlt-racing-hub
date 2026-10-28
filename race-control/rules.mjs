// Official JLT Autumn 2026 phase rules. No publishing or persistence.
export function validateOfficialGroups(groups){
 if(!Array.isArray(groups)||!groups.length)throw Error('Official groups required');
 const ids=new Set(),racers=new Set(),perLeague=new Map();
 for(const g of groups){
  if(!g||g.simulated===true||g.official!==true)throw Error('Group is not officially verified');
  if(!Number.isInteger(g.league)||g.league<0||g.league>6)throw Error('Invalid league');
  if(!new RegExp('^L'+g.league+'-[A-Z]+$').test(g.id))throw Error('Expected official group name such as L1-A');
  if(ids.has(g.id))throw Error('Duplicate group');
  ids.add(g.id);
  if(!Array.isArray(g.drivers)||!g.drivers.length)throw Error('Empty group');
  for(const d of g.drivers){
   if(!Number.isSafeInteger(Number(d.id))||Number(d.id)<=0)throw Error('Invalid racer ID');
   if(racers.has(String(d.id)))throw Error('Racer assigned to multiple groups');
   racers.add(String(d.id));
  }
  perLeague.set(g.league,(perLeague.get(g.league)||0)+g.drivers.length);
 }
 for(const [league,total] of perLeague){
  const count=groups.filter(g=>g.league===league).length;
  if(total>90&&count<2)throw Error('League '+league+' requires multiple groups');
  if(total<=90&&count!==1)throw Error('League '+league+' should be one group');
 }
 return {groups:ids.size,racers:racers.size,leagues:perLeague.size};
}
export function qualificationFormat(groups,league){
 const selected=groups.filter(g=>g.league===league);
 if(!selected.length)throw Error('League not found');
 return selected.length===1?{regularRaces:6,raceoffs:0,advance:3}:{regularRaces:4,raceoffs:2,qualifyPerGroup:5,advance:3,resetPoints:true};
}
export function raceoffRoster(groups,standingsByGroup,league){
 const selected=groups.filter(g=>g.league===league);
 if(selected.length<2)throw Error('Race-offs only for multi-group leagues');
 const drivers=[];
 for(const g of selected){
  const standings=standingsByGroup[g.id];
  if(!standings||standings.importedRaces!==4||standings.stage!=='qualification')throw Error('Four verified qualification races required for '+g.id);
  if(!Array.isArray(standings.standings)||standings.standings.length!==g.drivers.length)throw Error('Incomplete group standings');
  const fifth=standings.standings[4];
  if(!fifth)throw Error('Group too small for five qualifiers');
  if(standings.standings.some((r,i)=>i>=5&&r.rank===fifth.rank))throw Error('Unresolved tie at fifth place for '+g.id);
  drivers.push(...standings.standings.slice(0,5).map(r=>({id:r.driverId,name:r.name,sourceGroup:g.id})));
 }
 return {id:'L'+league+'-RACEOFF',league,official:false,simulated:false,pendingStewardVerification:true,drivers};
}
