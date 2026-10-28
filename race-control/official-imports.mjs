// Separate official import store. No publication path.
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
const path=process.env.JLT_OFFICIAL_IMPORT_STORE||'/var/lib/jlt-race-control/official-imports.json';
export function readOfficialImports(){try{const a=JSON.parse(readFileSync(path,'utf8'));if(!Array.isArray(a))throw Error('Invalid official imports');return a}catch(e){if(e.code==='ENOENT')return [];throw e}}
export function saveOfficialImport(item,rosterSha){
 if(!item||item.official!==true||item.simulated!==false||item.verification!=='PREVIEW_ONLY')throw Error('Only verified official preview accepted');
 if(!/^[a-f0-9]{64}$/.test(rosterSha))throw Error('Official roster checksum required');
 if(!Number.isSafeInteger(Number(item.raceId))||!item.rows?.length||item.matched<1)throw Error('Invalid race preview');
 const existing=readOfficialImports();
 if(existing.some(x=>String(x.raceId)===String(item.raceId)))throw Error('Race already imported');
 if(existing.some(x=>x.groupId===item.groupId&&x.slot===item.slot))throw Error('Group race slot already imported');
 const record={...item,rosterSha,verification:'PENDING_REVIEW',savedAt:new Date().toISOString()};
 mkdirSync(dirname(path),{recursive:true,mode:0o700});
 const tmp=path+'.tmp-'+process.pid;
 writeFileSync(tmp,JSON.stringify([...existing,record],null,2)+'\n',{mode:0o600});
 renameSync(tmp,path);
 return {saved:true,raceId:item.raceId,status:'pending',publicationLocked:true};
}
