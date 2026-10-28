import test from 'node:test';
import assert from 'node:assert/strict';
import {runScoringRehearsal} from '../race-control/rehearsal.mjs';
test('disposable two-race scoring rehearsal passes all assertions',()=>{
 const result=runScoringRehearsal();
 assert.equal(result.passed,true,JSON.stringify(result.checks));
 assert.equal(result.storage,'memory-only');
 assert.equal(result.standings.length,4);
 assert.equal(result.standings[0].name,'Test Beta');
});
