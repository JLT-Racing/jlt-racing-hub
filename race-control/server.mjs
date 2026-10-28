import {writeFileSync,readFileSync as readStorageFile} from 'node:fs';
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
 if(url.pathname==='/api/groups')return json(res,200,{groups,simulation:true});
 if(url.pathname==='/api/test-storage'&&req.method==='POST'){
  const path='/var/lib/jlt-race-control/storage-test.json';
  const record={kind:'STORAGE_TEST_ONLY',timestamp:new Date().toISOString()};
  try{writeFileSync(path,JSON.stringify(record),{mode:0o600});const check=JSON.parse(readStorageFile(path,'utf8'));if(check.kind!==record.kind||check.timestamp!==record.timestamp)throw Error('Read-back mismatch');return json(res,200,{ok:true,test:check})}
  catch(e){console.error('Storage test failed:',e.message);return json(res,500,{error:'Storage test failed; check service permissions'})}
 }
 if(url.pathname==='/api/imports'&&req.method==='GET')return json(res,200,{imports:readImports()});
 if(url.pathname==='/api/import'&&req.method==='POST'){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)return json(res,413,{error:'Request too large'})}
  let payload;try{payload=JSON.parse(raw)}catch{return json(res,400,{error:'Invalid JSON'})}
  const {raceId,groupId,slot,confirm}=payload||{};
  if(!Number.isSafeInteger(raceId)||raceId<=0)return json(res,400,{error:'Invalid race ID'});
  const group=groups.find(g=>g.id===groupId);if(!group)return json(res,400,{error:'Unknown group'});
  const key=req.headers['x-torn-key'];if(typeof key!=='string'||!key||key.length>200)return json(res,400,{error:'Steward key required'});
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
