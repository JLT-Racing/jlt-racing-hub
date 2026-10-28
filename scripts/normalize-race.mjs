// Convert Torn v2 racing race results into JLT scoring input.
// Never invent crash completion: Torn's response provides has_crashed,
// but does not include percentage completed in each result.
import { readFileSync } from 'node:fs';
import scoring from '../scoring.js';

export function normalizeTornRace(race) {
  if (!race || race.status !== 'finished' || !Array.isArray(race.results)) throw Error('Expected completed race with results');
  return race.results.map(result => {
    const driverId = result.driver_id;
    if (!Number.isSafeInteger(driverId) || driverId <= 0) throw Error('Invalid driver ID');
    if (result.has_crashed) {
      return { driverId, status: 'crashed', position: result.position, completion: null, time: result.race_time ?? null };
    }
    return { driverId, status: 'finished', position: result.position, time: result.race_time };
  });
}
export function scoreImportedRace(roster, race, crashCompletionByDriver = {}) {
  const results = normalizeTornRace(race).map(r => r.status === 'crashed'
    ? { ...r, completion: crashCompletionByDriver[String(r.driverId)] ?? null }
    : r);
  return scoring.scoreRace(roster, results);
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) throw Error('Usage: node scripts/normalize-race.mjs path/to/race.json');
  const race = JSON.parse(readFileSync(path, 'utf8'));
  console.log(JSON.stringify(normalizeTornRace(race.race ?? race), null, 2));
}
