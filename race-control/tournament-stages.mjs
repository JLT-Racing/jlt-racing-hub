// Stage rosters are derived from approved results, never guessed or activated here.
import {previewAdvancement} from './advancement.mjs';
import {calculateStandings} from './standings.mjs';
import {championshipQualifiers} from './rules.mjs';
export function previewTournamentStages(groups,approvedImports,league){
 const base=previewAdvancement(groups,approvedImports,league);
 if(!base.ready)return {...base,nextAction:'Approve remaining qualification races'};
 let championship=base.qualifiers||null,pooled=base.pooledRoster||null,raceoff=null;
 if(pooled){
  const raceoffGroup={...pooled,official:true,simulated:false};
  raceoff=calculateStandings(raceoffGroup,approvedImports,'raceoff');
  const missing=['Race-off 1','Race-off 2'].filter(s=>!raceoff.slots.includes(s));
  if(missing.length)return {...base,raceoff:{...raceoff,missing},ready:false,nextAction:'Verify pooled roster and approve both race-offs',publicationLocked:true};
  championship={...championshipQualifiers(groups,{[pooled.id]:raceoff},league),pendingStewardVerification:true};
 }
 const championshipGroup={id:'L'+league+'-CHAMPIONSHIP',league,official:true,simulated:false,drivers:championship.drivers};
 const standings=calculateStandings(championshipGroup,approvedImports,'championship');
 const missing=Array.from({length:7},(_,i)=>'Championship '+(i+1)).filter(s=>!standings.slots.includes(s));
 return {league,ready:missing.length===0,stage:'championship',pooledRoster:pooled,raceoffStandings:raceoff,championshipRoster:{...championshipGroup,official:false,pendingStewardVerification:true},championshipStandings:standings,missingChampionshipRaces:missing,nextAction:missing.length?'Verify championship roster and approve remaining championship races':'Steward final audit required',publicationLocked:true};
}
