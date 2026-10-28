import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('data/race-manifest.json', 'utf8'));
const key = process.env.TORN_API_KEY;
if (!key) throw Error('Missing repository secret');
for (const race of manifest.races) {
  const response = await fetch('https://api.torn.com/v2/racing/' + Number(race.id) + '/race', {headers: {'Authorization': 'ApiKey ' + key}});
  if (!response.ok) throw Error('Race fetch failed: ' + response.status);
  const data = await response.json();
  if (data.error) throw Error('Race API error');
  mkdirSync('data/race-api-raw', {recursive:true});
  writeFileSync('data/race-api-raw/' + Number(race.id) + '.json', JSON.stringify(data, null, 2));
}
