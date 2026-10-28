// Private, fail-closed official roster storage. Activation does not enable publishing.
import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {validateOfficialGroups} from './rules.mjs';
const store=process.env.JLT_OFFICIAL_ROSTER_STORE||'/var/lib/jlt-race-control/official-roster.json';
const digest=groups=>createHash('sha256').update(JSON.stringify(groups)).digest('hex');
export function loadOfficialRoster(){
 try{
  const data=JSON.parse(readFileSync(store,'utf8'));
  validateOfficialGroups(data.groups);
  if(data.sha256!==digest(data.groups)||data.confirmation!=='ORGANIZER_VERIFIED')throw Error('Official roster integrity check failed');
  return data;
 }catch(e){if(e.code==='ENOENT')return null;throw e}
}
export function activateOfficialRoster({groups,source,confirmation,expectedSha256},imports=[]){
 if(confirmation!=='ACTIVATE VERIFIED JLT ROSTER')throw Error('Typed activation confirmation required');
 if(typeof source!=='string'||source.trim().length<12||source.length>500)throw Error('Provide a specific organizer source reference');
 const report=validateOfficialGroups(groups);
 const sha256=digest(groups);
 if(sha256!==expectedSha256)throw Error('Roster checksum changed since validation');
 if(loadOfficialRoster())throw Error('Official roster already activated; replacement requires separate controlled migration');
 if(imports.length)throw Error('Existing imports must be archived and cleared before activation');
 const record={schema:1,confirmation:'ORGANIZER_VERIFIED',source:source.trim(),activatedAt:new Date().toISOString(),sha256,groups};
 mkdirSync(dirname(store),{recursive:true,mode:0o700});
 const temp=store+'.tmp-'+process.pid;
 writeFileSync(temp,JSON.stringify(record,null,2)+'\n',{mode:0o600,flag:'wx'});
 if(existsSync(store))throw Error('Roster file already exists');
 renameSync(temp,store);
 return {activated:true,report,sha256,source:record.source,publicationLocked:true};
}
export function rosterDigest(groups){validateOfficialGroups(groups);return digest(groups)}
