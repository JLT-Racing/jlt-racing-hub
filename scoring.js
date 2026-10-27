/* JLT scoring: normalized, verified results only. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.JLTScoring=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
const key=x=>String(x);
const finite=x=>x===null||x===undefined||x===""?null:(Number.isFinite(Number(x))?Number(x):null);
function scoreRace(roster,results){
if(!Array.isArray(roster)||!Array.isArray(results))throw Error("Expected roster and results arrays");
const ids=roster.map(key);if(new Set(ids).size!==ids.length)throw Error("Duplicate roster ID");
const eligible=new Set(ids),seen=new Set(),finish=[],crash=[];
for(const r of results){const k=key(r.driverId);if(!eligible.has(k))continue;if(seen.has(k))throw Error("Duplicate driver "+k);seen.add(k);
if(r.status==="missed")continue;
if(r.status==="finished"){const p=finite(r.position),t=finite(r.time);if(p===null||p<=0||t===null||t<0)throw Error("Invalid finisher "+k);finish.push({driverId:k,position:p,time:t});}
else if(r.status==="crashed"){const c=finite(r.completion);if(c===null||c<0||c>100)throw Error("Invalid crash completion "+k);crash.push({driverId:k,completion:c,time:finite(r.time)});}
else throw Error("Invalid status "+k);
}
finish.sort((a,b)=>a.position-b.position||a.time-b.time||a.driverId.localeCompare(b.driverId));
if(new Set(finish.map(x=>x.position)).size!==finish.length)throw Error("Duplicate finishing positions");
crash.sort((a,b)=>b.completion-a.completion||a.driverId.localeCompare(b.driverId));
for(let i=1;i<crash.length;i++)if(crash[i].completion===crash[i-1].completion)throw Error("Tied crash completion requires official ordering");
const ranked=finish.concat(crash),index=new Map(ranked.map((r,i)=>[r.driverId,i]));
return ids.map(driverId=>{const i=index.get(driverId),r=i===undefined?null:ranked[i];return {driverId,rank:i===undefined?null:i+1,points:i===undefined?0:ids.length-i,entered:!!r,crashed:!!r&&i>=finish.length,time:r&&r.time!==null?r.time:0};});
}
function standings(roster,races){const totals=new Map(roster.map(id=>[key(id),{driverId:key(id),points:0,entered:0,crashes:0,time:0,races:[]}]));
if(totals.size!==roster.length)throw Error("Duplicate roster ID");
for(const results of races){for(const r of scoreRace(roster,results)){const t=totals.get(r.driverId);t.points+=r.points;t.entered+=Number(r.entered);t.crashes+=Number(r.crashed);t.time+=r.time;t.races.push(r);}}
return [...totals.values()].sort((a,b)=>b.points-a.points||b.entered-a.entered||a.crashes-b.crashes||a.time-b.time||a.driverId.localeCompare(b.driverId));}
return {scoreRace,standings};
});