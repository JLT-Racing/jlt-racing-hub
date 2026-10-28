// Private approvals for official imports. Never publishes.
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {readOfficialImports} from './official-imports.mjs';
const path=process.env.JLT_OFFICIAL_APPROVAL_STORE||'/var/lib/jlt-race-control/official-approvals.json';
function load(){try{const a=JSON.parse(readFileSync(path,'utf8'));if(!Array.isArray(a))throw Error('Invalid approvals');return a}catch(e){if(e.code==='ENOENT')return [];throw e}}
export function officialReviewQueue(rosterSha){
 const decisions=new Map(load().map(x=>[String(x.raceId),x]));
 return readOfficialImports().filter(x=>x.rosterSha===rosterSha).map(x=>({raceId:x.raceId,groupId:x.groupId,slot:x.slot,matched:x.matched,registered:x.registered,status:decisions.get(String(x.raceId))?.status||'pending'}));
}
export function reviewOfficialRace(raceId,decision,rosterSha){
 if(!['approve','revoke'].includes(decision))throw Error('Invalid decision');
 const record=readOfficialImports().find(x=>String(x.raceId)===String(raceId));
 if(!record||record.rosterSha!==rosterSha)throw Error('Race not imported against active official roster');
 const entries=load(),status=decision==='approve'?'approved':'pending';
 if(entries.find(x=>String(x.raceId)===String(raceId))?.status===status)throw Error('Already '+status);
 const next=[...entries.filter(x=>String(x.raceId)!==String(raceId)),{raceId:record.raceId,status,reviewedAt:new Date().toISOString()}];
 mkdirSync(dirname(path),{recursive:true,mode:0o700});const tmp=path+'.tmp-'+process.pid;
 writeFileSync(tmp,JSON.stringify(next,null,2)+'\n',{mode:0o600});renameSync(tmp,path);
 return {raceId,status,publicationLocked:true};
}
export function approvedOfficialImports(rosterSha){
 const approved=new Set(load().filter(x=>x.status==='approved').map(x=>String(x.raceId)));
 return readOfficialImports().filter(x=>x.rosterSha===rosterSha&&approved.has(String(x.raceId)));
}
