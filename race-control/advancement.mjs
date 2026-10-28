// Verified advancement previews only. No activation, storage or publication.
import {qualificationFormat,raceoffRoster,championshipQualifiers} from './rules.mjs';
import {calculateStandings} from './standings.mjs';
export function previewAdvancement(groups,imports,league){
 if(!Number.isInteger(league)||league<0||league>6)throw Error('Invalid league');
 const selected=groups.filter(g=>g.league===league);
 if(!selected.length||selected.some(g=>g.official!==true||g.simulated===true))throw Error('Official league roster required');
 const format=qualificationFormat(groups,league);
 const standingsByGroup={};
 const requirements=[];
 for(const g of selected){
  const s=calculateStandings(g,imports,'qualification');
  const expected=Array.from({length:format.regularRaces},(_,i)=>'Qualification '+(i+1));
  const missing=expected.filter(slot=>!s.slots.includes(slot));
  requirements.push({groupId:g.id,approved:s.importedRaces,required:format.regularRaces,missing});
  if(!missing.length)standingsByGroup[g.id]=s;
 }
 const complete=requirements.every(r=>r.missing.length===0);
 if(!complete)return {league,ready:false,stage:'qualification',requirements,publicationLocked:true,message:'Awaiting approved qualification races'};
 if(selected.length===1){
  const qualifiers=championshipQualifiers(groups,standingsByGroup,league);
  return {league,ready:true,stage:'championship',requirements,qualifiers:{...qualifiers,pendingStewardVerification:true},publicationLocked:true};
 }
 const pooled=raceoffRoster(groups,standingsByGroup,league);
 return {league,ready:true,stage:'raceoff',requirements,pooledRoster:pooled,publicationLocked:true,message:'Pooled roster is a proposal only; steward verification and separate race-off import workflow required'};
}
