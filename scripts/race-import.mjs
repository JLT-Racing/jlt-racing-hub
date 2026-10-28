import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('data/race-manifest.json', 'utf8'));
const key = process.env.TORN_API_KEY;
if (!key) throw Error('Missing TORN_API_KEY repository secret');
if (!Array.isArray(manifest.races)) throw Error('Invalid race manifest');
const seen = new Set();
for (const race of manifest.races) {
  const id = Number(race.id);
  if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id) || !/^L[0-6]-G\d{2}$/.test(race.group)) throw Error('Invalid race mapping');
  seen.add(id);
  const response = await fetch('https://api.torn.com/v2/racing/' + id + '/race', {headers: {'Authorization': 'ApiKey ' + key}});
  if (!response.ok) throw Error('Race fetch failed with HTTP ' + response.status);
  const data = await response.json();
  if (!data || typeof data !== 'object' || data.error || !data.race) throw Error('Unexpected race response; import halted');
  mkdirSync('data/race-api-raw', {recursive:true});
  writeFileSync('data/race-api-raw/' + id + '.json', JSON.stringify(data.race, null, 2) + '\n');
  console.log('Imported race ' + id + ' (raw race object, not scored)');
}
console.log('Import complete: ' + seen.size + ' approved race IDs; demo standings unchanged.');
