// Validates a JLT publication payload before it can reach the public site.
// Until official group assignments are installed, this pipeline is TEST ONLY.
import { readFileSync, writeFileSync } from 'node:fs';
const input=process.argv[2]||'data/publication-draft.json';
const output='data/published-results.json';
const data=JSON.parse(readFileSync(input,'utf8'));
if(data.schema!==1||data.mode!=='test'||!Array.isArray(data.races))throw Error('Only schema 1 TEST drafts are accepted');
if(data.races.length)throw Error('Race publishing is disabled until official group assignments are installed');
const published={schema:1,mode:'test',publishedAt:new Date().toISOString(),description:'Pipeline test only. No official results have been published.',groups:[],races:[]};
writeFileSync(output,JSON.stringify(published,null,2)+'\n');
console.log('Validated TEST publication: 0 races; official results remain blocked.');
