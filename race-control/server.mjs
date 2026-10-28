import {queue,review,publicationReadiness} from './approvals.mjs';
import {listStewards,saveSteward,deleteSteward,resolveSteward} from './stewards.mjs';
import {runScoringRehearsal} from './rehearsal.mjs';
import {calculateStandings} from './standings.mjs';
import {writeFileSync,readFileSync as readStorageFile,unlinkSync} from 'node:fs';
import {preview,saveImport,readImports} from './imports.mjs';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
const PORT=Number(process.env.PORT||8088);
const PASSWORD=process.env.JLT_ADMIN_PASSWORD;
if(!PASSWORD||PASSWORD.length<16)throw Error('Set JLT_ADMIN_PASSWORD (at least 16 characters)');
const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)};
const html = readFileSync(new URL('./dashboard.html', import.meta.url), 'utf8');
const groups = JSON.parse(readFileSync(new URL('../data/simulated-groups.json', import.meta.url), 'utf8')).groups;
function json(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body))}
http.createServer(async(req,res)=>{try{
 const auth=req.headers.authorization||'';
 const expected='Basic '+Buffer.from('admin:'+PASSWORD).toString('base64');
 if(!equal(auth,expected)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="JLT Race Control"','Cache-Control':'no-store'});res.end('Unauthorized');return}
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(html);return}
 if(!url.pathname.startsWith('/api/'))return json(res,404,{error:'Not found'});
 if(url.pathname==='/api/steward-races'&&req.method==='GET'){
  const groupId=url.searchParams.get('group');
  let assigned;try{assigned=resolveSteward(groupId,groups)}catch(e){return json(res,400,{error:e.message})}
  try{
   const response=await fetch('https://api.torn.com/v2/user/races',{headers:{Authorization:'ApiKey '+assigned.key},signal:AbortSignal.timeout(12000)});
   const data=await response.json();
   if(!response.ok||data.error)return json(res,502,{error:'Assigned steward key could not retrieve races: '+(data.error?.error||'HTTP '+response.status)});
   return json(res,200,{races:Array.isArray(data.races)?data.races:[],steward:assigned.steward,groupId});
  }catch(e){return json(res,502,{error:'Unable to fetch steward races from Torn'})}
 }
 if(url.pathname==='/api/steward-race'&&req.method==='GET'){
  const groupId=url.searchParams.get('group'),raceId=url.searchParams.get('race');
  if(!/^\d+$/.test(raceId||''))return json(res,400,{error:'Invalid race ID'});
  let assigned;try{assigned=resolveSteward(groupId,groups)}catch(e){return json(res,400,{error:e.message})}
  try{
   const response=await fetch('https://api.torn.com/v2/racing/'+raceId+'/race',{headers:{Authorization:'ApiKey '+assigned.key},signal:AbortSignal.timeout(12000)});
   const data=await response.json();
   if(!response.ok||data.error||!data.race)return json(res,502,{error:'Assigned steward key could not retrieve this race'});
   return json(res,200,{race:data.race,steward:assigned.steward,groupId});
  }catch(e){return json(res,502,{error:'Unable to fetch steward race from Torn'})}
 }
 if(url.pathname==='/api/stewards'&&req.method==='GET')return json(res,200,{stewards:listStewards()});
 if(url.pathname==='/api/stewards'&&req.method==='POST'){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4000)return json(res,413,{error:'Request too large'})}
  let payload;try{payload=JSON.parse(raw)}catch{return json(res,400,{error:'Invalid JSON'})}
  try{return json(res,200,{steward:saveSteward(payload,groups)})}catch(e){return json(res,400,{error:e.message})}
 }
 if(url.pathname==='/api/stewards/delete'&&req.method==='POST'){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000)return json(res,413,{error:'Request too large'})}
  try{const {id}=JSON.parse(raw);deleteSteward(id);return json(res,200,{deleted:true})}catch(e){return json(res,400,{error:e.message})}
 }
 if(url.pathname==='/api/groups')return json(res,200,{groups,simulation:true});
 if(url.pathname==='/api/test-storage'&&req.method==='POST'){
  const path='/var/lib/jlt-race-control/storage-test.json';
  const record={kind:'STORAGE_TEST_ONLY',timestamp:new Date().toISOString()};
  try{writeFileSync(path,JSON.stringify(record),{mode:0o600});const check=JSON.parse(readStorageFile(path,'utf8'));if(check.kind!==record.kind||check.timestamp!==record.timestamp)throw Error('Read-back mismatch');return json(res,200,{ok:true,test:check})}
  catch(e){console.error('Storage test failed:',e.message);return json(res,500,{error:'Storage test failed; check service permissions'})}
 }
 if(url.pathname==='/api/test-import'&&req.method==='POST'){
  // Isolated end-to-end test: write, read back, and remove a disposable import record.
  // Does not touch imports.json or any tournament results.
  const path='/var/lib/jlt-race-control/import-e2e-test.json';
  const record={kind:'JLT_DISPOSABLE_IMPORT_TEST',raceId:999999999,groupId:'TEST-ONLY',slot:'Test race',rows:[{driverId:123456,points:10}],createdAt:new Date().toISOString()};
  try{
   writeFileSync(path,JSON.stringify(record),{mode:0o600,flag:'wx'});
   const saved=JSON.parse(readStorageFile(path,'utf8'));
   if(JSON.stringify(saved)!==JSON.stringify(record))throw Error('Read-back mismatch');
   unlinkSync(path);
   return json(res,200,{ok:true,record:{kind:saved.kind,raceId:saved.raceId,groupId:saved.groupId,rows:saved.rows.length},cleanedUp:true,realImports:readImports().length});
  }catch(e){try{unlinkSync(path)}catch{}console.error('Import E2E test failed:',e.message);return json(res,500,{error:'Import test failed: '+e.message})}
 }
 if(url.pathname==='/api/trigger-test-publish'&&req.method==='POST'){
  // Dispatches only the locked-down empty TEST feed workflow. No private imports
  // or steward keys are transferred to GitHub.
  const token=process.env.JLT_GITHUB_TOKEN;
  if(!token)return json(res,503,{error:'GitHub publishing token not configured on Oracle'});
  const origin=req.headers.origin;
  if(origin&&origin!=='http://127.0.0.1:'+PORT&&origin!=='http://localhost:'+PORT)return json(res,403,{error:'Invalid request origin'});
  const target='https://api.github.com/repos/JLT-Racing/jlt-racing-hub/actions/workflows/publish-results.yml/dispatches';
  let response;
  try{response=await fetch(target,{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'jlt-race-control','Content-Type':'application/json'},body:JSON.stringify({ref:'main'}),signal:AbortSignal.timeout(12000)})}
  catch(e){return json(res,502,{error:'Could not contact GitHub'})}
  if(response.status!==204){console.error('GitHub dispatch HTTP status:',response.status);return json(res,502,{error:'GitHub rejected workflow dispatch (HTTP '+response.status+'). Check token permissions.'})}
  return json(res,202,{queued:true,mode:'test',message:'GitHub test publication workflow queued. No race data transferred.',actionsUrl:'https://github.com/JLT-Racing/jlt-racing-hub/actions/workflows/publish-results.yml'});
 }
 if(url.pathname==='/api/review-queue'&&req.method==='GET')return json(res,200,{items:queue(),readiness:publicationReadiness()});
 if(url.pathname==='/api/review'&&req.method==='POST'){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1500)return json(res,413,{error:'Request too large'})}
  let data;try{data=JSON.parse(raw)}catch{return json(res,400,{error:'Invalid JSON'})}
  if(!Number.isSafeInteger(data.raceId)||data.raceId<=0)return json(res,400,{error:'Invalid race ID'});
  try{return json(res,200,{review:review(data.raceId,data.decision),readiness:publicationReadiness()})}catch(e){return json(res,409,{error:e.message})}
 }
 if(url.pathname==='/api/publish-approved'&&req.method==='POST')return json(res,423,{error:'Publication locked: simulated rosters cannot be published. Review decisions remain private.',readiness:publicationReadiness()});
 if(url.pathname==='/api/publication-preview'&&req.method==='GET'){
  const imports=readImports();
  const races=imports.map(({raceId,groupId,slot,matched,registered,rows})=>({raceId,groupId,slot,matched,registered,rows}));
  return json(res,200,{schema:1,mode:'test',generatedAt:new Date().toISOString(),description:'Private draft only. Contains simulated group assignments. NEVER publish as official.',races});
 }
 if(url.pathname==='/api/test-scoring'&&req.method==='POST'){
  const result=runScoringRehearsal();
  return json(res,result.passed?200:500,result);
 }
 if(url.pathname==='/api/standings'&&req.method==='GET'){
  const group=groups.find(g=>g.id===url.searchParams.get('group'));
  if(!group)return json(res,400,{error:'Select a valid group'});
  const stage=url.searchParams.get('stage')||'qualification';
  try{return json(res,200,calculateStandings(group,readImports(),stage))}
  catch(e){return json(res,400,{error:e.message})}
 }
 if(url.pathname==='/api/imports'&&req.method==='GET')return json(res,200,{imports:readImports()});
 if(url.pathname==='/api/import'&&req.method==='POST'){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)return json(res,413,{error:'Request too large'})}
  let payload;try{payload=JSON.parse(raw)}catch{return json(res,400,{error:'Invalid JSON'})}
  const {raceId,groupId,slot,confirm}=payload||{};
  if(!Number.isSafeInteger(raceId)||raceId<=0)return json(res,400,{error:'Invalid race ID'});
  const group=groups.find(g=>g.id===groupId);if(!group)return json(res,400,{error:'Unknown group'});
  let key=req.headers['x-torn-key'];
  if(payload.useSavedKey===true){try{key=resolveSteward(groupId,groups).key}catch(e){return json(res,400,{error:e.message})}}
  if(typeof key!=='string'||!key||key.length>200)return json(res,400,{error:'Steward key required'});
  const response=await fetch('https://api.torn.com/v2/racing/'+raceId+'/race',{headers:{Authorization:'ApiKey '+key},signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok||data.error||!data.race)return json(res,502,{error:'Torn API rejected race'});
  let item;try{item=preview(data.race,group,slot)}catch(e){return json(res,400,{error:e.message})}
  if(confirm===true){
   if(item.matched===0)return json(res,400,{error:'No matching racers; refusing import'});
   try{return json(res,200,{...saveImport({...item,savedAt:new Date().toISOString()}),preview:item})}catch(e){return json(res,409,{error:e.message})}
  }
  return json(res,200,{preview:item});
 }
 
 const key=req.headers['x-torn-key'];if(typeof key!=='string'||!key||key.length>200)return json(res,400,{error:'Steward key required'});
 const match=url.pathname.match(/^\/api\/race\/(\d+)$/);
 const target=url.pathname==='/api/races'?'https://api.torn.com/v2/user/races':match?'https://api.torn.com/v2/racing/'+match[1]+'/race':null;
 if(!target)return json(res,404,{error:'Not found'});
 const response=await fetch(target,{headers:{Authorization:'ApiKey '+key},signal:AbortSignal.timeout(12000)});
 const data=await response.json();if(data.error||!response.ok)return json(res,502,{error:'Torn API: '+(data.error?.error||'HTTP '+response.status)});
 if(match){if(!data.race||!Array.isArray(data.race.results))return json(res,502,{error:'Unexpected race response'});return json(res,200,{race:data.race})}
 return json(res,200,{races:Array.isArray(data.races)?data.races:[]});
 }catch(e){console.error('Request failed:',e.message);json(res,500,{error:'Request failed; check server logs'})}
}).listen(PORT,'127.0.0.1',()=>console.log('JLT Race Control listening on 127.0.0.1:'+PORT));
