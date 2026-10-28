// End-to-end official workflow rehearsal using isolated temporary stores.
// No official roster activation, Torn API calls, or public publication.
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export async function runOfficialWorkflowRehearsal(){
 const dir=mkdtempSync(join(tmpdir(),'jlt-official-rehearsal-'));
 const oldImports=process.env.JLT_OFFICIAL_IMPORT_STORE;
 const oldApprovals=process.env.JLT_OFFICIAL_APPROVAL_STORE;
 try{
  process.env.JLT_OFFICIAL_IMPORT_STORE=join(dir,'imports.json');
  process.env.JLT_OFFICIAL_APPROVAL_STORE=join(dir,'approvals.json');
  // Spawn a fresh Node process with isolated stores; never load real store modules here.
  const {execFileSync}=await import('node:child_process');
  const script=join(new URL('.',import.meta.url).pathname,'official-workflow-rehearsal-worker.mjs');
  const raw=execFileSync(process.execPath,[script],{env:{...process.env,JLT_OFFICIAL_IMPORT_STORE:join(dir,'imports.json'),JLT_OFFICIAL_APPROVAL_STORE:join(dir,'approvals.json')},encoding:'utf8',timeout:10000,maxBuffer:1000000});
  const report=JSON.parse(raw);
  return {...report,mode:'test',storage:'isolated-temporary-files',publicationLocked:true};
 }finally{
  if(oldImports===undefined)delete process.env.JLT_OFFICIAL_IMPORT_STORE;else process.env.JLT_OFFICIAL_IMPORT_STORE=oldImports;
  if(oldApprovals===undefined)delete process.env.JLT_OFFICIAL_APPROVAL_STORE;else process.env.JLT_OFFICIAL_APPROVAL_STORE=oldApprovals;
  rmSync(dir,{recursive:true,force:true});
 }
}
