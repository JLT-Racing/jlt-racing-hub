// Archive simulation-only imports and approvals before official launch.
// This never touches steward keys and never deletes a backup.
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
const importsPath=resolve(process.env.JLT_IMPORT_STORE||'/var/lib/jlt-race-control/imports.json');
const approvalsPath=resolve(process.env.JLT_APPROVAL_STORE||'/var/lib/jlt-race-control/approvals.json');
function read(path){try{const data=JSON.parse(readFileSync(path,'utf8'));if(!Array.isArray(data))throw Error('Invalid store: '+path);return data}catch(e){if(e.code==='ENOENT')return [];throw e}}
export function cleanupPreview(){
 const imports=read(importsPath),approvals=read(approvalsPath);
 return {imports:imports.length,approvals:approvals.length,allSimulated:imports.every(x=>x.simulated===true),canArchive:imports.every(x=>x.simulated===true),stewardKeysAffected:false,publicationAffected:false};
}
export function archiveTestData(confirmation){
 if(confirmation!=='ARCHIVE TEST DATA')throw Error('Confirmation phrase does not match');
 const state=cleanupPreview();
 if(!state.canArchive)throw Error('Refusing to archive non-simulated imports');
 if(!state.imports&&!state.approvals)throw Error('No test data to archive');
 // Save BOTH complete stores in a uniquely named archive before modifying either.
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const path=resolve(dirname(importsPath),'test-archive-'+stamp+'-'+randomBytes(4).toString('hex')+'.json');
 const backup={createdAt:new Date().toISOString(),type:'JLT_TEST_ARCHIVE',imports:read(importsPath),approvals:read(approvalsPath)};
 mkdirSync(dirname(path),{recursive:true,mode:0o700});
 writeFileSync(path,JSON.stringify(backup,null,2)+'\n',{mode:0o600,flag:'wx'});
 for(const store of [importsPath,approvalsPath]){
  mkdirSync(dirname(store),{recursive:true,mode:0o700});
  const tmp=store+'.tmp-'+process.pid+'-'+randomBytes(4).toString('hex');
  writeFileSync(tmp,'[]\n',{mode:0o600,flag:'wx'});
  renameSync(tmp,store);
 }
 return {archived:true,archiveFile:path,importsArchived:backup.imports.length,approvalsArchived:backup.approvals.length,stewardKeysAffected:false};
}
