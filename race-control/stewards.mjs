import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
const path=process.env.JLT_STEWARD_STORE||'/var/lib/jlt-race-control/stewards.json';
function master(){const hex=process.env.JLT_STEWARD_ENCRYPTION_KEY;if(!hex||!/^[a-f0-9]{64}$/i.test(hex))throw Error('JLT_STEWARD_ENCRYPTION_KEY must be 64 hex characters');return Buffer.from(hex,'hex')}
function encrypt(key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',master(),iv);const value=Buffer.concat([cipher.update(key,'utf8'),cipher.final()]);return {iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),value:value.toString('hex')}}
function decrypt(x){const d=createDecipheriv('aes-256-gcm',master(),Buffer.from(x.iv,'hex'));d.setAuthTag(Buffer.from(x.tag,'hex'));return Buffer.concat([d.update(Buffer.from(x.value,'hex')),d.final()]).toString('utf8')}
function load(){try{const a=JSON.parse(readFileSync(path,'utf8'));if(!Array.isArray(a))throw Error('Invalid steward store');return a}catch(e){if(e.code==='ENOENT')return [];throw e}}
function write(items){mkdirSync(dirname(path),{recursive:true,mode:0o700});const tmp=path+'.tmp-'+process.pid;writeFileSync(tmp,JSON.stringify(items,null,2),{mode:0o600});renameSync(tmp,path)}
const safe=x=>({id:x.id,name:x.name,scope:x.scope,groupId:x.groupId||null,league:x.league??null,configured:true,updatedAt:x.updatedAt});
export function listStewards(){return load().map(safe)}
export function saveSteward({id,name,scope,groupId,league,key},groups){
 if(typeof name!=='string'||!name.trim()||name.length>100)throw Error('Steward name required (max 100)');
 if(!['group','league'].includes(scope))throw Error('Invalid key scope');
 if(scope==='group'&&!groups.some(g=>g.id===groupId))throw Error('Unknown group');
 if(scope==='league'&&(!Number.isInteger(league)||league<0||league>6))throw Error('Invalid league');
 if(typeof key!=='string'||key.length<8||key.length>200||/\s/.test(key))throw Error('Invalid Torn API key');
 const items=load(),identity=typeof id==='string'&&id? id:randomBytes(12).toString('hex');
 const entry={id:identity,name:name.trim(),scope,groupId:scope==='group'?groupId:null,league:scope==='league'?league:null,secret:encrypt(key),updatedAt:new Date().toISOString()};
 const idx=items.findIndex(x=>x.id===identity);
 if(id&&idx<0)throw Error('Steward entry not found');
 if(idx>=0)items[idx]=entry;else items.push(entry);
 write(items);return safe(entry);
}
export function deleteSteward(id){const items=load(),remaining=items.filter(x=>x.id!==id);if(remaining.length===items.length)throw Error('Steward entry not found');write(remaining);return true}
export function resolveSteward(groupId,groups){
 const group=groups.find(g=>g.id===groupId);if(!group)throw Error('Unknown group');
 const items=load(),matches=items.filter(x=>x.scope==='group'&&x.groupId===groupId);
 const fallback=items.filter(x=>x.scope==='league'&&x.league===group.league);
 const candidates=matches.length?matches:fallback;
 if(candidates.length!==1)throw Error(candidates.length?'Multiple steward keys match this group; select one explicitly':'No steward key assigned to this group');
 return {key:decrypt(candidates[0].secret),steward:safe(candidates[0])};
}
