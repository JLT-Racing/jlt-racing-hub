const key=process.env.JLT_TEST_KEY;
if(!key) throw Error('Missing JLT_TEST_KEY');
const raceId='21318988';
const endpoint='https://api.torn.com/v2/racing/'+raceId+'/race';
const res=await fetch(endpoint,{headers:{Authorization:'ApiKey '+key,Accept:'application/json'}});
const data=await res.json();
console.log('HTTP status:',res.status);
console.log('Response keys:',Object.keys(data));
if(data.error){console.log('API error:',JSON.stringify(data.error));process.exitCode=1;}
else {
 const race=data.race??data;
 console.log('Race fields:',Object.keys(race));
 for(const [k,v] of Object.entries(race)){
   if(Array.isArray(v))console.log(k,'array length:',v.length,'first item keys:',v.length&&typeof v[0]==='object'?Object.keys(v[0]):[]);
   else if(v&&typeof v==='object')console.log(k,'object keys:',Object.keys(v).slice(0,25));
   else console.log(k,':',v);
 }
}
