// Steward-only local importer: never deploy this page on public GitHub Pages.
// Usage: JLT_TEST_KEY=... node scripts/list-steward-races.mjs
const key=process.env.JLT_TEST_KEY;
if(!key)throw Error('Set JLT_TEST_KEY in the environment');
const r=await fetch('https://api.torn.com/v2/user/races',{headers:{Authorization:'ApiKey '+key}});
const data=await r.json();
if(!r.ok||data.error)throw Error('Race history unavailable: '+JSON.stringify(data.error??r.status));
const races=Array.isArray(data.races)?data.races:[];
console.log('Available races:',races.length);
for(const race of races.slice(0,100))console.log(JSON.stringify({id:race.id,status:race.status,title:race.title??null,track_id:race.track_id??null,creator_id:race.creator_id??null}));
