import test from 'node:test';
import assert from 'node:assert/strict';
import {runOfficialWorkflowRehearsal} from './official-workflow-rehearsal.mjs';
test('official import-to-approval rehearsal uses disposable stores and passes every check',async()=>{
 const result=await runOfficialWorkflowRehearsal();
 assert.equal(result.passed,true);
 assert.equal(result.publicationLocked,true);
 assert.equal(result.storage,'isolated-temporary-files');
 assert.ok(result.checks.length>=14);
 assert.ok(result.checks.every(x=>x.passed));
 assert.equal(result.standings.length,4);
});
