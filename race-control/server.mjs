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
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(html);return}
 if(!url.pathname.startsWith('/api/'))return json(res,404,{error:'Not found'});
 if(url.pathname==='/api/groups')return json(res,200,{groups,simulation:true});
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
