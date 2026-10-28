import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
const PORT=Number(process.env.PORT||8088);
const PASSWORD=process.env.JLT_ADMIN_PASSWORD;
if(!PASSWORD||PASSWORD.length<16)throw Error('Set JLT_ADMIN_PASSWORD (at least 16 characters)');
const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)};
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JLT Race Control</title><style>body{background:#10141d;color:#eee;font:16px system-ui;max-width:950px;margin:30px auto;padding:0 16px}h1{color:#ffd34d}input,button{font:inherit;padding:12px;margin:5px 0;background:#202b3a;color:white;border:1px solid #657087;border-radius:5px}input{width:95%}button{cursor:pointer;background:#a67808;color:white}table{border-collapse:collapse;width:100%;margin-top:15px}td,th{padding:9px;border-bottom:1px solid #46505c;text-align:left}small{color:#b9c4d0}.notice{background:#393018;padding:14px}select{padding:10px}</style><h1>JLT / RACE CONTROL</h1><p class="notice">Private test importer. Results are previews only; nothing is published to official standings.</p><label>Admin password<input id="password" type="password" autocomplete="current-password"></label><label>Steward restricted Torn API key<input id="key" type="password" autocomplete="off" placeholder="Paste key for this session"></label><button id="load">Fetch recent races</button><p id="msg"></p><div id="races"></div><div id="details"></div><script>
const $=id=>document.getElementById(id);const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path){const r=await fetch(path,{headers:{'Authorization':'Basic '+btoa('admin:'+$('password').value),'X-Torn-Key':$('key').value},cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed');return data}
$('load').onclick=async()=>{try{$('msg').textContent='Loading…';const d=await api('/api/races');$('msg').textContent=d.races.length+' races found';$('races').innerHTML='<table><tr><th>Race</th><th>Status</th><th></th></tr>'+d.races.map(r=>'<tr><td>'+esc(r.id)+'</td><td>'+esc(r.status)+'</td><td><button data-id="'+esc(r.id)+'">View results</button></td></tr>').join('')+'</table>';$('races').querySelectorAll('button').forEach(b=>b.onclick=()=>detail(b.dataset.id))}catch(e){$('msg').textContent=e.message}};
async function detail(id){try{$('details').textContent='Loading race '+id+'…';const d=await api('/api/race/'+encodeURIComponent(id));const r=d.race;$('details').innerHTML='<h2>Race '+esc(r.id)+'</h2><p>'+esc(r.title)+' · Track '+esc(r.track_id)+' · '+esc(r.laps)+' laps · '+esc(r.status)+'</p><p>Creator: '+esc(r.creator_id)+' · Results: '+esc(r.results?.length??0)+'</p><table><tr><th>Position</th><th>Torn ID</th><th>Car</th><th>Race time</th><th>Crash</th></tr>'+(r.results||[]).map(x=>'<tr><td>'+esc(x.position)+'</td><td>'+esc(x.driver_id)+'</td><td>'+esc(x.car_item_name)+'</td><td>'+esc(x.race_time)+'</td><td>'+(x.has_crashed?'YES':'NO')+'</td></tr>').join('')+'</table>'}catch(e){$('details').textContent=e.message}}
</script></html>`;
function json(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body))}
http.createServer(async(req,res)=>{try{
 const auth=req.headers.authorization||'';
 const expected='Basic '+Buffer.from('admin:'+PASSWORD).toString('base64');
 if(!equal(auth,expected)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="JLT Race Control"','Cache-Control':'no-store'});res.end('Unauthorized');return}
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(html);return}
 if(!url.pathname.startsWith('/api/'))return json(res,404,{error:'Not found'});
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
