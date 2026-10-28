import {publicationAudit} from './publication-audit.mjs';
import {proposedStageRoster} from './stage-proposals.mjs';
import {stageDigest,confirmStageRoster,verifiedStageRoster,readStageRosters} from './stage-rosters.mjs';
import {previewTournamentStages} from './tournament-stages.mjs';
import {previewAdvancement} from './advancement.mjs';
import {runOfficialWorkflowRehearsal} from './official-workflow-rehearsal.mjs';
import {readOfficialImports,saveOfficialImport} from './official-imports.mjs';
import {officialReviewQueue,reviewOfficialRace,approvedOfficialImports} from './official-approvals.mjs';
import {scoreOfficialRace} from './official-scoring.mjs';
import {loadOfficialRoster,activateOfficialRoster,rosterDigest} from './official-roster.mjs';
import {validateOfficialGroups,qualificationFormat,validateImportSlot,championshipQualifiers,raceoffRoster} from './rules.mjs';
import {cleanupPreview,archiveTestData} from './cleanup.mjs';
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
const simulatedGroups = JSON.parse(readFileSync(new URL('../data/simulated-groups.json', import.meta.url), 'utf8')).groups;
const groups = loadOfficialRoster()?.groups || simulatedGroups;
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
 if(url.pathname==='/api/groups')return json(res,200,{groups,simulation:!loadOfficialRoster(),officialRoster:loadOfficialRoster()?{source:loadOfficialRoster().source,activatedAt:loadOfficialRoster().activatedAt,sha256:loadOfficialRoster().sha256}:null});
 if(url.pathname==='/api/official-readiness'&&req.method==='GET'){
  const leagues=[...new Set(groups.map(g=>g.league))].sort((a,b)=>a-b);
  return json(res,200,{mode:loadOfficialRoster()?'official-roster':'simulation',publicationLocked:true,officialRostersLoaded:!!loadOfficialRoster(),leagues:leagues.map(league=>({league,groupCount:groups.filter(g=>g.league===league).length,format:qualificationFormat(groups,league)})),message:loadOfficialRoster()?'Verified roster active. Race importing and publication remain locked until official scoring workflow is certified.':'Official roster activation requires organizer-verified assignments. Simulated group assignments cannot be promoted.'});
 }
 if(url.pathname==='/api/validate-roster'&&req.method==='POST'){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2000000)return json(res,413,{error:'Roster too large'})}
  let payload;try{payload=JSON.parse(raw)}catch{return json(res,400,{error:'Invalid JSON'})}
  try{
   const report=validateOfficialGroups(payload.groups);
   return json(res,200,{valid:true,report,sha256:rosterDigest(payload.groups),activated:false,publicationLocked:true,message:'Roster structurally valid. NOT activated. Requires organizer confirmation and independent source verification.'});
  }catch(e){return json(res,400,{valid:false,error:e.message,activated:false})}
 }

 if(url.pathname==='/api/activate-roster'&&req.method==='POST'){
  const origin=req.headers.origin;
  if(origin&&origin!=='http://127.0.0.1:'+PORT&&origin!=='http://localhost:'+PORT)return json(res,403,{error:'Invalid request origin'});
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2000000)return json(res,413,{error:'Roster too large'})}
  let payload;try{payload=JSON.parse(raw)}catch{return json(res,400,{error:'Invalid JSON'})}
  try{
   const result=activateOfficialRoster(payload,readImports());
   return json(res,200,{...result,restartRequired:true,message:'Roster saved. Restart Race Control to load it. Publishing and official imports remain locked.'});
  }catch(e){return json(res,409,{error:e.message})}
 }
 if(url.pathname==='/api/official-publication-preview'&&req.method==='GET'){
  const root=loadOfficialRoster();
  if(!root)return json(res,423,{ready:false,publicationLocked:true,blockers:['Official organizer roster not activated'],preview:null});
  try{return json(res,200,publicationAudit(root.groups,readOfficialImports(),approvedOfficialImports(root.sha256),readStageRosters(),root.sha256))}
  catch(e){return json(res,422,{ready:false,publicationLocked:true,blockers:[e.message],preview:null})}
 }
 if(url.pathname==='/api/stage-roster-proposal'&&req.method==='GET'){
  const root=loadOfficialRoster();if(!root)return json(res,423,{error:'Official roster not active'});
  const league=Number(url.searchParams.get('league')),stage=url.searchParams.get('stage');
  if(!Number.isInteger(league)||league<0||league>6)return json(res,400,{error:'Invalid league'});
  try{
   const proposal=proposedStageRoster(groups,approvedOfficialImports(root.sha256),league,stage);
   const digest=stageDigest(proposal,root.sha256);
   const confirmed=readStageRosters().some(x=>x.id===proposal.id&&x.rootSha===root.sha256&&x.digest===digest);
   return json(res,200,{proposal,digest,confirmed,publicationLocked:true});
  }catch(e){return json(res,422,{error:e.message})}
 }
 if(url.pathname==='/api/stage-roster-confirm'&&req.method==='POST'){
  const root=loadOfficialRoster();if(!root)return json(res,423,{error:'Official roster not active'});
  const origin=req.headers.origin;if(origin&&origin!=='http://127.0.0.1:'+PORT&&origin!=='http://localhost:'+PORT)return json(res,403,{error:'Invalid origin'});
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>3000)return json(res,413,{error:'Request too large'})}
  try{
   const data=JSON.parse(raw),league=Number(data.league);
   if(!Number.isInteger(league)||league<0||league>6)throw Error('Invalid league');
   const proposal=proposedStageRoster(groups,approvedOfficialImports(root.sha256),league,data.stage);
   return json(res,200,confirmStageRoster({roster:proposal,rootSha:root.sha256,expectedDigest:data.digest,confirmation:data.confirmation,source:data.source},proposal));
  }catch(e){return json(res,422,{error:e.message,publicationLocked:true})}
 }
 if(url.pathname==='/api/stage-race-preview'&&req.method==='POST'){
  const root=loadOfficialRoster();if(!root)return json(res,423,{error:'Official roster not active'});
  const origin=req.headers.origin;if(origin&&origin!=='http://127.0.0.1:'+PORT&&origin!=='http://localhost:'+PORT)return json(res,403,{error:'Invalid origin'});
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2000)return json(res,413,{error:'Request too large'})}
  let data;try{data=JSON.parse(raw)}catch{return json(res,400,{error:'Invalid JSON'})}
  const league=Number(data.league),raceId=data.raceId,stage=data.stage,slot=data.slot;
  if(!Number.isInteger(league)||league<0||league>6||!Number.isSafeInteger(raceId)||raceId<=0)return json(res,400,{error:'Invalid league or race ID'});
  if(stage==='raceoff'&&!/^Race-off [12]$/.test(slot)||stage==='championship'&&!/^Championship [1-7]$/.test(slot)||!['raceoff','championship'].includes(stage))return json(res,400,{error:'Invalid stage slot'});
  let proposal,group;
  try{proposal=proposedStageRoster(groups,approvedOfficialImports(root.sha256),league,stage);group=verifiedStageRoster(proposal.id,root.sha256,proposal)}
  catch(e){return json(res,423,{error:e.message})}
  let assigned;
  try{assigned=resolveSteward(groups.find(g=>g.league===league).id,groups)}
  catch(e){return json(res,400,{error:'Assign exactly one league or group steward key: '+e.message})}
  let response,dataFromTorn;
  try{response=await fetch('https://api.torn.com/v2/racing/'+raceId+'/race',{headers:{Authorization:'ApiKey '+assigned.key},signal:AbortSignal.timeout(12000)});dataFromTorn=await response.json()}
  catch(e){return json(res,502,{error:'Torn race fetch failed'})}
  if(!response.ok||dataFromTorn.error||!dataFromTorn.race)return json(res,502,{error:'Torn API rejected race'});
  try{
   if(Number(dataFromTorn.race.id)!==raceId)throw Error('Torn returned wrong race');
   const item=scoreOfficialRace(dataFromTorn.race,group,slot);
   if(data.confirm==='SAVE VERIFIED PRIVATE IMPORT'){
    if(item.matched<1)throw Error('No eligible racers');
    return json(res,200,{...saveOfficialImport({...item,stageRosterDigest:stageDigest(proposal,root.sha256)},root.sha256),preview:item,publicationLocked:true});
   }
   return json(res,200,{preview:item,saved:false,publicationLocked:true});
  }catch(e){return json(res,422,{error:e.message})}
 }
 if(url.pathname==='/api/tournament-stages'&&req.method==='GET'){
  const roster=loadOfficialRoster();if(!roster)return json(res,423,{error:'Official roster not activated'});
  const league=Number(url.searchParams.get('league'));
  if(!Number.isInteger(league)||league<0||league>6)return json(res,400,{error:'Invalid league'});
  try{return json(res,200,previewTournamentStages(groups,approvedOfficialImports(roster.sha256),league))}
  catch(e){return json(res,422,{error:e.message,publicationLocked:true})}
 }
 if(url.pathname==='/api/advancement-preview'&&req.method==='GET'){
  const roster=loadOfficialRoster();if(!roster)return json(res,423,{error:'Official roster not activated'});
  const league=Number(url.searchParams.get('league'));
  if(!Number.isInteger(league)||league<0||league>6)return json(res,400,{error:'Select a league 0–6'});
  try{return json(res,200,previewAdvancement(groups,approvedOfficialImports(roster.sha256),league))}
  catch(e){return json(res,422,{error:e.message,publicationLocked:true})}
 }
 if(url.pathname==='/api/official-imports'&&req.method==='GET'){
  const roster=loadOfficialRoster();
  return json(res,200,{imports:roster?readOfficialImports().filter(x=>x.rosterSha===roster.sha256):[],publicationLocked:true});
 }
 if(url.pathname==='/api/official-review-queue'&&req.method==='GET'){
  const roster=loadOfficialRoster();
  return json(res,200,{items:roster?officialReviewQueue(roster.sha256):[],publicationLocked:true});
 }
 if(url.pathname==='/api/official-standings'&&req.method==='GET'){
  const roster=loadOfficialRoster();
  if(!roster)return json(res,423,{error:'Official roster not active'});
  const group=groups.find(g=>g.id===url.searchParams.get('group'));
  if(!group)return json(res,400,{error:'Unknown group'});
  try{
   const imports=approvedOfficialImports(roster.sha256);
   const result=calculateStandings({...group,simulated:false},imports,'qualification');
   return json(res,200,{...result,simulation:false,approvedOnly:true,publicationLocked:true});
  }catch(e){return json(res,422,{error:e.message})}
 }
 if(url.pathname==='/api/official-review'&&req.method==='POST'){
  const roster=loadOfficialRoster();if(!roster)return json(res,423,{error:'Official roster not active'});
  const origin=req.headers.origin;if(origin&&origin!=='http://127.0.0.1:'+PORT&&origin!=='http://localhost:'+PORT)return json(res,403,{error:'Invalid origin'});
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000)return json(res,413,{error:'Too large'})}
  try{const data=JSON.parse(raw);if(!Number.isSafeInteger(data.raceId)||data.raceId<=0)throw Error('Invalid race ID');const item=readOfficialImports().find(x=>x.raceId===data.raceId&&x.rosterSha===roster.sha256);if(!item)throw Error('Unknown official import');if(data.decision==='approve'&&item.stageRosterDigest){const stage=item.slot.startsWith('Race-off')?'raceoff':'championship';const league=Number(item.groupId.match(/^L([0-6])-/)?.[1]);const proposal=proposedStageRoster(groups,approvedOfficialImports(roster.sha256),league,stage);verifiedStageRoster(item.groupId,roster.sha256,proposal);if(item.stageRosterDigest!==stageDigest(proposal,roster.sha256))throw Error('Stage roster changed since import')}return json(res,200,{review:reviewOfficialRace(data.raceId,data.decision,roster.sha256)})}catch(e){return json(res,409,{error:e.message})}
 }
 if(url.pathname==='/api/official-preview'&&req.method==='POST'){
  if(!loadOfficialRoster())return json(res,423,{error:'Official roster not activated'});
  const origin=req.headers.origin;
  if(origin&&origin!=='http://127.0.0.1:'+PORT&&origin!=='http://localhost:'+PORT)return json(res,403,{error:'Invalid request origin'});
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2000)return json(res,413,{error:'Request too large'})}
  let payload;try{payload=JSON.parse(raw)}catch{return json(res,400,{error:'Invalid JSON'})}
  const {raceId,groupId,slot}=payload;
  if(!Number.isSafeInteger(raceId)||raceId<=0)return json(res,400,{error:'Invalid race ID'});
  const group=groups.find(g=>g.id===groupId);
  if(!group)return json(res,400,{error:'Unknown official group'});
  try{validateImportSlot(groups,groupId,slot)}catch(e){return json(res,400,{error:e.message})}
  let assigned;try{assigned=resolveSteward(groupId,groups)}catch(e){return json(res,400,{error:e.message})}
  let data,response;
  try{response=await fetch('https://api.torn.com/v2/racing/'+raceId+'/race',{headers:{Authorization:'ApiKey '+assigned.key},signal:AbortSignal.timeout(12000)});data=await response.json()}catch(e){return json(res,502,{error:'Unable to fetch race from Torn'})}
  if(!response.ok||data.error||!data.race)return json(res,502,{error:'Torn API rejected race'});
  try{
   if(Number(data.race.id)!==raceId)throw Error('Torn returned a different race ID');
   const item=scoreOfficialRace(data.race,group,slot);
   if(payload.confirm==='SAVE VERIFIED PRIVATE IMPORT'){
    if(item.matched<1)throw Error('No eligible racers in race');
    return json(res,200,{...saveOfficialImport(item,loadOfficialRoster().sha256),preview:item,approved:false,published:false});
   }
   return json(res,200,{preview:item,saved:false,approved:false,published:false});
  }
  catch(e){return json(res,422,{error:e.message,saved:false})}
 }
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
 if(url.pathname==='/api/test-cleanup-preview'&&req.method==='GET')return json(res,200,cleanupPreview());
 if(url.pathname==='/api/archive-test-data'&&req.method==='POST'){
  const origin=req.headers.origin;
  if(origin&&origin!=='http://127.0.0.1:'+PORT&&origin!=='http://localhost:'+PORT)return json(res,403,{error:'Invalid request origin'});
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>500)return json(res,413,{error:'Request too large'})}
  let data;try{data=JSON.parse(raw)}catch{return json(res,400,{error:'Invalid JSON'})}
  try{return json(res,200,archiveTestData(data.confirmation))}
  catch(e){return json(res,409,{error:e.message})}
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
 if(url.pathname==='/api/test-official-workflow'&&req.method==='POST'){
  try{const result=await runOfficialWorkflowRehearsal();return json(res,result.passed?200:500,result)}
  catch(e){console.error('Official workflow rehearsal failed:',e.message);return json(res,500,{passed:false,error:'Official rehearsal failed: '+e.message,publicationLocked:true})}
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
  if(loadOfficialRoster())return json(res,423,{error:'Official roster is active, but official race imports are locked until the scorer and approval workflow are certified.'});
  let key=req.headers['x-torn-key'];
  if(payload.useSavedKey===true){try{key=resolveSteward(groupId,groups).key}catch(e){return json(res,400,{error:e.message})}}
  if(typeof key!=='string'||!key||key.length>200)return json(res,400,{error:'Steward key required'});
  const response=await fetch('https://api.torn.com/v2/racing/'+raceId+'/race',{headers:{Authorization:'ApiKey '+key},signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok||data.error||!data.race)return json(res,502,{error:'Torn API rejected race'});
  let item;try{validateImportSlot(groups,groupId,slot);item=preview(data.race,group,slot)}catch(e){return json(res,400,{error:e.message})}
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
