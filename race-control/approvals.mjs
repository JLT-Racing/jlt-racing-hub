// Private review decisions, stored separately from immutable race imports.
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {readImports} from './imports.mjs';
const path=process.env.JLT_APPROVAL_STORE||'/var/lib/jlt-race-control/approvals.json';
const id=x=>String(x);
function load(){try{const data=JSON.parse(readFileSync(path,'utf8'));if(!Array.isArray(data))throw Error('Invalid approval store');return data}catch(e){if(e.code==='ENOENT')return [];throw e}}
function save(data){mkdirSync(dirname(path),{recursive:true,mode:0o700});const tmp=path+'.tmp-'+process.pid;writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600});renameSync(tmp,path)}
export function queue(){const approvals=load(),byRace=new Map(approvals.map(a=>[id(a.raceId),a]));return readImports().map(i=>({raceId:i.raceId,groupId:i.groupId,slot:i.slot,matched:i.matched,registered:i.registered,simulated:i.simulated===true,savedAt:i.savedAt,status:byRace.get(id(i.raceId))?.status||'pending',reviewedAt:byRace.get(id(i.raceId))?.reviewedAt||null}));}
export function review(raceId,decision){if(!['approve','revoke'].includes(decision))throw Error('Invalid review decision');const imports=readImports(),item=imports.find(x=>id(x.raceId)===id(raceId));if(!item)throw Error('Race not imported');if(!item.simulated)throw Error('Unsupported roster mode');const current=load(),existing=current.find(x=>id(x.raceId)===id(raceId));const next=decision==='approve'?'approved':'pending';if(existing?.status===next)throw Error('Race already '+next);const record={raceId:item.raceId,status:next,reviewedAt:new Date().toISOString()};const updated=current.filter(x=>id(x.raceId)!==id(raceId));updated.push(record);save(updated);return record;}
export function publicationReadiness(){const items=queue(),approved=items.filter(i=>i.status==='approved');return {mode:'test',approved:approved.length,pending:items.length-approved.length,blocked:true,reason:'Official race publication remains disabled: roster assignments are simulated. GitHub test dispatch publishes no race data.',approvedRaces:approved.map(({raceId,groupId,slot})=>({raceId,groupId,slot}))}}
