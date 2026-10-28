// Steward-confirmed stage rosters, bound to the active organizer roster and approved advancement.
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const path=process.env.JLT_STAGE_ROSTER_STORE||'/var/lib/jlt-race-control/stage-rosters.json';
export const stageDigest=(roster,rootSha)=>createHash('sha256').update(JSON.stringify({rootSha,id:roster.id,drivers:roster.drivers})).digest('hex');
export function readStageRosters(){try{const a=JSON.parse(readFileSync(path,'utf8'));if(!Array.isArray(a))throw Error('Invalid stage roster store');return a}catch(e){if(e.code==='ENOENT')return [];throw e}}
export function confirmStageRoster({roster,rootSha,expectedDigest,confirmation,source},proposed){
 if(!roster||!proposed||roster.id!==proposed.id||JSON.stringify(roster.drivers)!==JSON.stringify(proposed.drivers))throw Error('Roster differs from approved advancement proposal');
 if(!/^[a-f0-9]{64}$/.test(rootSha)||expectedDigest!==stageDigest(proposed,rootSha))throw Error('Stage roster digest mismatch');
 if(confirmation!=='VERIFY JLT STAGE ROSTER'||typeof source!=='string'||source.trim().length<12||source.length>500)throw Error('Steward confirmation and source required');
 const existing=readStageRosters();
 if(existing.some(x=>x.id===roster.id&&x.rootSha===rootSha))throw Error('Stage roster already confirmed');
 const entry={id:roster.id,league:roster.league,rootSha,digest:expectedDigest,drivers:roster.drivers,source:source.trim(),confirmedAt:new Date().toISOString()};
 mkdirSync(dirname(path),{recursive:true,mode:0o700});
 const tmp=path+'.tmp-'+process.pid;writeFileSync(tmp,JSON.stringify([...existing,entry],null,2)+'\n',{mode:0o600});renameSync(tmp,path);
 return {confirmed:true,id:entry.id,digest:entry.digest,publicationLocked:true};
}
export function verifiedStageRoster(id,rootSha,proposed){
 const entry=readStageRosters().find(x=>x.id===id&&x.rootSha===rootSha);
 if(!entry||!proposed||entry.digest!==stageDigest(proposed,rootSha)||JSON.stringify(entry.drivers)!==JSON.stringify(proposed.drivers))throw Error('Stage roster not verified against current approved advancement');
 return {...proposed,official:true,simulated:false,pendingStewardVerification:false};
}
