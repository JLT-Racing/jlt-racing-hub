import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const store=resolve(process.env.JLT_IMPORT_STORE||'/var/lib/jlt-race-control/imports.json');
const id=x=>String(x);
export function preview(race,group,slot){
 if(!group?.simulated)throw Error('Preview requires explicitly simulated group');
 if(race?.status!=='finished'||!Array.isArray(race.results))throw Error('Race is not finished');
 if(!slot||!/^(Qualification [1-6]|Race-off [12]|Championship)$/.test(slot))throw Error('Invalid race slot');
 const roster=group.drivers||[],size=roster.length,eligible=new Map(roster.map(x=>[id(x.id),x]));
 const entries=new Map();
 for(const r of race.results){
  const driver=id(r.driver_id);
  if(!eligible.has(driver))continue;
  if(entries.has(driver))throw Error('Duplicate racer in race results');
  if(!Number.isInteger(r.position)||r.position<1)throw Error('Invalid official position');
  entries.set(driver,r);
 }
 const ranked=[...entries.values()].sort((a,b)=>a.position-b.position);
 if(new Set(ranked.map(r=>r.position)).size!==ranked.length)throw Error('Duplicate race positions');
 // Torn's official position already accounts for crashes. Keep that order.
 const points=new Map(ranked.map((r,i)=>[id(r.driver_id),size-i]));
 return {raceId:race.id,title:race.title,trackId:race.track_id,groupId:group.id,slot,simulated:true,registered:size,matched:ranked.length,outsiders:race.results.length-ranked.length,rows:roster.map(d=>{const r=entries.get(id(d.id));return {driverId:d.id,name:d.name,position:r?.position??null,crashed:!!r?.has_crashed,time:r?.race_time??null,points:points.get(id(d.id))??0,entered:!!r}}).sort((a,b)=>b.points-a.points||String(a.name).localeCompare(String(b.name)))};
}
export function readImports(){try{return JSON.parse(readFileSync(store,'utf8'))}catch(e){if(e.code==='ENOENT')return [];throw e}}
export function saveImport(item){
 const entries=readImports();
 if(entries.some(x=>String(x.raceId)===String(item.raceId)))throw Error('This race was already imported');
 if(entries.some(x=>x.groupId===item.groupId&&x.slot===item.slot))throw Error('This group and race slot already has an import');
 mkdirSync(dirname(store),{recursive:true,mode:0o700});
 const temp=store+'.tmp-'+process.pid;
 writeFileSync(temp,JSON.stringify([...entries,item],null,2)+'\n',{mode:0o600});
 renameSync(temp,store);
 return {saved:true,total:entries.length+1};
}
