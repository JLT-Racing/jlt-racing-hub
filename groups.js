/* Unofficial balanced group simulation — NEVER official standings. */
(function(root,factory){const x=factory();if(typeof module==="object"&&module.exports)module.exports=x;else root.JLTGroups=x;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
const counts=[533,220,552,417,329,289,169],perLeague=[12,5,13,10,8,7,4];
function groups(){return counts.flatMap((total,league)=>Array.from({length:perLeague[league]},(_,i)=>({id:'L'+league+'-G'+String(i+1).padStart(2,'0'),league,group:i+1,registeredCount:Math.floor(total/perLeague[league])+(i<total%perLeague[league]?1:0),simulated:true})));}
function assign(drivers){const output=[];for(let league=0;league<7;league++){const members=drivers.filter(d=>Number(d.league)===league).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));const n=perLeague[league];for(let i=0;i<n;i++){const roster=members.filter((_,j)=>j%n===i);output.push({id:'L'+league+'-G'+String(i+1).padStart(2,'0'),league,group:i+1,registeredCount:roster.length,drivers:roster,simulated:true});}}return output;}
return {counts,perLeague,groups,assign};
});